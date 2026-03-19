from app.core.neo4j import get_driver
driver = get_driver()
from app.core.llm import llm

MAX_TRIES_PER_CHUNK = 3


# ------------------ Difficulty Filter ------------------

def not_easy(question, options):
    print("\n[DEBUG] Checking difficulty filter")
    print("Question:", question)
    print("Options:", options)

    # Relaxed question length
    if len(question.split()) < 8:
        print("[FILTER FAIL] Question too short")
        return False


    lens = [len(o.split()) for o in options]
    if max(lens) - min(lens) > 10:
        print("[FILTER FAIL] Option length variance too high:", lens)
        return False

    banned = ["always", "never", "all", "none"]
    if any(b in question.lower() for b in banned):
        print("[FILTER FAIL] Banned word found")
        return False

    print("[FILTER PASS] Question accepted")
    return True


# ------------------ Neo4j Fetchers ------------------

def fetch_chunks(graph_id):
    print("\n[DEBUG] Fetching chunks from Neo4j")

    query = """
    MATCH (c:Chunk {graph_id: $graph_id})
    RETURN c.id AS id, c.text AS text
    ORDER BY c.id
    """

    with driver.session() as s:
        data = s.run(query, {"graph_id": graph_id}).data()

    print(f"[DEBUG] Total chunks fetched: {len(data)}")
    return data



def get_overlap_texts(chunk_id, graph_id, limit=3):
    print(f"\n[DEBUG] Fetching overlaps for chunk: {chunk_id}")

    query = """
    MATCH (main:Chunk {id: $id, graph_id: $graph_id})
          -[:HAS_KEYWORD {graph_id: $graph_id}]->
          (k:Keyword {graph_id: $graph_id})
          <-[:HAS_KEYWORD {graph_id: $graph_id}]-
          (o:Chunk {graph_id: $graph_id})
    WHERE main.id <> o.id
    RETURN o.text AS text, COUNT(DISTINCT k) AS score
    ORDER BY score DESC
    LIMIT $limit
    """

    try:
        with driver.session() as s:
            rows = s.run(
                query,
                {
                    "id": chunk_id,
                    "graph_id": graph_id,
                    "limit": limit
                }
            ).data()

        texts = [r["text"] for r in rows]
        print(f"[DEBUG] Overlap texts found: {len(texts)}")
        return texts

    except Exception as e:
        print("[WARN] Neo4j overlap fetch failed:", e)
        return []




# ------------------ LLM Agents ------------------

def question_agent(chunk_text, difficulty="medium", q_type="mcq"):
    print(f"\n[DEBUG] Generating {difficulty} {q_type} question from chunk")
    print("Chunk preview:", chunk_text[:200], "...")

    type_instruction = "MCQ question with 4 options"
    if q_type == "true_false":
        type_instruction = "True/False question (The answer must be exactly 'True' or 'False')"
    elif q_type == "mixed":
        type_instruction = "MCQ or True/False question"

    difficulty_instruction = "HARD exam-level. Avoid definitions. Ask about limitations, implications, or conditions."
    if difficulty == "easy":
        difficulty_instruction = "EASY fundamental level. Focus on basic definitions and clear facts."
    elif difficulty == "medium":
        difficulty_instruction = "MEDIUM level. Test conceptual understanding and application."

    prompt = f"""
Create ONE {type_instruction} from the text below.
Difficulty level: {difficulty_instruction}

TEXT:
{chunk_text}

Return strictly:
Question:
Answer:
"""
    resp = llm.invoke(prompt).content.strip()
    print("[DEBUG] LLM response:\n", resp)

    if "Answer:" not in resp:
        raise ValueError("Answer missing")

    q, a = resp.split("Answer:", 1)
    return q.replace("Question:", "").strip(), a.strip()


def option_agent(question, answer, overlap_texts):
    print("\n[DEBUG] Generating options")
    options = [answer]

    for ref in overlap_texts:
        prompt = f"""
Generate ONE tricky but incorrect option.

Rules:
- Similar wording to correct answer
- Partially true but wrong
- No giveaway words

QUESTION:
{question}

CORRECT ANSWER:
{answer}

REFERENCE:
{ref}

Return ONLY the option text.
"""
        opt = llm.invoke(prompt).content.strip()

        if opt.lower() != answer.lower():
            options.append(opt)

        if len(options) == 4:
            break

    print("[DEBUG] Options generated:", options)
    return options


# ------------------ Main Generator ------------------

def generate_mcqs(graph_id, limit=10, difficulty="medium", q_type="mcq"):
    print(f"\n[DEBUG] Starting {difficulty} {q_type} generation")
    mcqs = []

    chunks = fetch_chunks(graph_id)

    for chunk in chunks:
        print("\n==============================")
        print("[DEBUG] Processing chunk:", chunk["id"])

        if len(mcqs) == limit:
            break

        for attempt in range(MAX_TRIES_PER_CHUNK):
            print(f"[DEBUG] Attempt {attempt+1}/{MAX_TRIES_PER_CHUNK}")

            try:
                question, answer = question_agent(chunk["text"], difficulty, q_type)

                # If True/False, we don't need overlaps for options
                is_tf_answer = answer.lower() in ["true", "false"] or "true" in answer.lower() or "false" in answer.lower()
                if q_type == "true_false" or (q_type == "mixed" and is_tf_answer):
                    options = ["True", "False"]
                    answer = "True" if "true" in answer.lower() else "False"
                else:
                    overlaps = get_overlap_texts(
                        chunk["id"],
                        graph_id,
                        limit=3
                    )

                    if not overlaps:
                        print("[DEBUG] Using fallback overlaps")
                        overlaps = [chunk["text"]] * 3

                    options = option_agent(question, answer, overlaps)

                if len(options) < 2:
                    continue

                if difficulty == "hard" and q_type == "mcq":
                    if not not_easy(question, options):
                        continue

                mcqs.append({
                    "graph_id": graph_id,
                    "chunk_id": chunk["id"],
                    "question": question,
                    "options": options,
                    "answer": answer
                })

                print("[DEBUG] MCQ ACCEPTED ✅")
                break

            except Exception as e:
                print("[ERROR] Generation failed:", e)

    print("\n[DEBUG] MCQ generation completed")
    print("[DEBUG] Total MCQs generated:", len(mcqs))
    return mcqs


def refine_questions(questions: list, instruction: str):
    print("\n[DEBUG] Refining batch of questions")
    print(f"Instruction: {instruction}")
    
    refined_questions = []
    
    for q in questions:
        prompt = f"""
Refine the following MCQ based on the Instruction.

MCQ:
Question: {q.get('text', q.get('question'))}
Options: {', '.join([o['text'] for o in q.get('options', [])])}

Instruction:
{instruction}

Return strictly the refined MCQ in this format:
Question: <new question text>
Options: <opt1>, <opt2>, <opt3>, <opt4>
Correct: <exact text of the correct option>
Explanation: <brief explanation>
"""
        try:
            resp = llm.invoke(prompt).content.strip()
            
            # Simple parser
            lines = resp.split('\n')
            new_q = q.get('text', q.get('question'))
            new_opts = [o['text'] for o in q.get('options', [])]
            new_correct = ""
            new_explanation = q.get('explanation', "")
            
            for line in lines:
                if line.startswith("Question:"):
                    new_q = line.replace("Question:", "").strip()
                elif line.startswith("Options:"):
                    new_opts = [o.strip() for o in line.replace("Options:", "").split(',')]
                elif line.startswith("Correct:"):
                    new_correct = line.replace("Correct:", "").strip()
                elif line.startswith("Explanation:"):
                    new_explanation = line.replace("Explanation:", "").strip()
            
            # Normalize new_correct to match one of the options exactly if AI was slightly off
            actual_correct = ""
            new_correct_str = str(new_correct).lower()
            for opt in new_opts:
                opt_str = str(opt).lower()
                if opt_str in new_correct_str or new_correct_str in opt_str:
                    actual_correct = opt
                    break
            if not actual_correct and new_opts:
                actual_correct = new_opts[0] # Fallback if no match
            
            # Reconstruct the question object
            refined_q = {
                **q,
                "text": new_q,
                "question": new_q,
                "answer": actual_correct,
                "options": [
                    {"id": i, "text": opt, "isCorrect": opt == actual_correct}
                    for i, opt in enumerate(new_opts)
                ],
                "explanation": new_explanation
            }
            refined_questions.append(refined_q)
        except Exception as e:
            print(f"[ERROR] Failed to refine question: {e}")
            refined_questions.append(q)
            
    return refined_questions
