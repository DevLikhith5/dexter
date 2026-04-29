import asyncio
import re
import json
from difflib import SequenceMatcher
from app.core.neo4j import get_driver
from app.core.llm import llm, llm_async

driver = get_driver()
MAX_TRIES_PER_CHUNK = 5
CHUNK_CONCURRENCY = 6


# ─── Bloom's question stems ────────────────────────────────────────────────────
EASY_STEMS = [
    "What is", "Which of the following best defines", "What is the meaning of",
    "What is the main function of", "How is ___ defined",
]
MEDIUM_STEMS = [
    "How does", "Why does", "What is the relationship between",
    "What distinguishes ___ from", "What enables", "How is ___ different from",
    "What is the primary purpose of",
]
HARD_STEMS = [
    "Under what conditions would", "What would happen if",
    "Which factor most critically determines", "Why would ___ fail when",
    "What is the most significant trade-off between",
    "In what scenario would ___ be preferred over",
    "What is the underlying reason that",
]

REASONING_WORDS = {
    "why", "how", "best", "most", "primary", "main", "key", "critical",
    "essential", "significant", "factor", "condition", "scenario",
    "would", "determines", "impact", "consequence", "trade-off",
    "prefer", "differ", "distinguish", "underlying", "result", "enables",
}

# Phrases that make a question feel like a reading-comprehension test
META_REFERENCE_PHRASES = [
    "according to the passage", "according to the text", "based on the passage",
    "based on the text", "as stated in the passage", "as mentioned in the text",
    "the passage states", "the text says", "the author states", "the author mentions",
    "as described in the passage", "in the passage", "from the passage",
    "the passage describes", "in the text", "from the text", "the text describes",
    "the passage suggests", "what does the passage", "what does the text",
    "according to the reading", "the reading states",
]


# ─── Utility helpers ────────────────────────────────────────────────────────────

def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation and extra spaces for loose comparison."""
    return re.sub(r"[^\w\s]", " ", text.lower()).strip()


def _answer_in_chunk(answer: str, chunk_text: str) -> bool:
    """Check whether the answer concept appears in the chunk — fuzzy & robust."""
    a = _normalize(answer)
    c = _normalize(chunk_text)

    if a in c:
        return True

    # All significant words present
    words = [w for w in a.split() if len(w) > 3]
    if words and all(w in c for w in words):
        return True

    # Bigram check for multi-word answers
    parts = a.split()
    for i in range(len(parts) - 1):
        if parts[i] + " " + parts[i + 1] in c:
            return True

    return False


def _clean_overlap_texts(texts: list[str]) -> list[str]:
    cleaned, seen = [], set()
    for t in texts:
        t = re.sub(r"\s+", " ", t).strip()
        if not t or len(t) < 10:
            continue
        key = t.lower()[:80]
        if key not in seen:
            seen.add(key)
            cleaned.append(t)
    return cleaned


def _is_valid_distractor(opt: str, answer: str, chunk_text: str, existing: list[str]) -> bool:
    opt_l = opt.lower().strip()
    ans_l = answer.lower().strip()

    if not opt_l or len(opt_l) < 3 or len(opt) > 200:
        return False

    giveaway = [
        "not mentioned", "does not apply", "unsupported conclusion",
        "not grounded", "none of", "all of", "cannot be determined",
    ]
    if any(g in opt_l for g in giveaway):
        return False

    # Must not be too similar to the correct answer
    if _similarity(opt, answer) > 0.70:
        return False

    # Must not be too similar to existing distractors
    if any(_similarity(opt, ex) > 0.80 for ex in existing):
        return False

    # Must not be a substring of the answer or vice-versa (catches "Black Box" vs "Black Box Testing")
    if ans_l in opt_l or opt_l in ans_l:
        return False

    # Word count consistency
    ans_words = len(ans_l.split())
    opt_words = len(opt_l.split())
    if ans_words > 0 and abs(opt_words - ans_words) > max(6, ans_words * 2):
        return False

    return True


def strip_meta_references(question: str) -> str:
    q = question
    for phrase in META_REFERENCE_PHRASES:
        q = re.compile(re.escape(phrase), re.IGNORECASE).sub("", q)
    q = re.sub(r"\s{2,}", " ", q).strip()
    if q and q[0].islower():
        q = q[0].upper() + q[1:]
    return q


def clean_question_text(question: str) -> str:
    lines = question.split("\n")
    cleaned_lines = []
    for line in lines:
        s = line.strip()
        if s and len(s) > 2:
            if s[0] in "ABCDabcd" and len(s) > 2 and s[1] in ".)":
                continue
            if s[0] in "1234" and len(s) > 2 and s[1] in ".)":
                continue
        cleaned_lines.append(line)
    cleaned = "\n".join(cleaned_lines).strip()
    for phrase in ["A)", "B)", "C)", "D)", "A.", "B.", "C.", "D.", "1.", "2.", "3.", "4.",
                   "Options:", "Choices:", "Select from:", "a)", "b)", "c)", "d)"]:
        idx = cleaned.rfind(phrase)
        if idx > len(cleaned) * 0.5:
            cleaned = cleaned[:idx].strip()
    return cleaned


# ─── Validation ─────────────────────────────────────────────────────────────────

def validate_question(question: str, options: list, correct_answer: str, chunk_text: str) -> bool:
    print("\n[DEBUG] Running quality validation")
    q_lower = question.lower()

    # Reject meta-references
    for phrase in META_REFERENCE_PHRASES:
        if phrase in q_lower:
            print(f"[FILTER FAIL] Meta-reference found: '{phrase}'")
            return False

    # No embedded option markers
    for marker in ["A)", "B)", "C)", "D)", "A.", "B.", "C.", "D.", "1.", "2.", "3.", "4."]:
        if marker in question:
            print("[FILTER FAIL] Question contains option markers")
            return False

    # Question must not give away the answer
    if correct_answer.lower() in q_lower and len(correct_answer) > 12:
        print("[FILTER FAIL] Question reveals the answer")
        return False

    # Length
    q_words = question.split()
    if len(q_words) < 5:
        print("[FILTER FAIL] Question too short")
        return False
    if len(q_words) > 80:
        print("[FILTER FAIL] Question too long")
        return False

    # Options: non-empty, distinct
    seen_opts = set()
    for opt in options:
        ol = opt.lower().strip()
        if not ol or len(ol) < 2:
            print("[FILTER FAIL] Empty option")
            return False
        if ol in seen_opts:
            print("[FILTER FAIL] Duplicate option")
            return False
        seen_opts.add(ol)

    # Correct answer must appear in options (fuzzy)
    ca_l = correct_answer.lower().strip()
    matched = any(
        ca_l == o.lower().strip() or ca_l in o.lower().strip() or o.lower().strip() in ca_l
        for o in options
    )
    if not matched:
        print("[FILTER FAIL] Correct answer not in options")
        return False

    # Chunk grounding: question shares ≥ 3 content words with chunk
    chunk_words = {w for w in chunk_text.lower().split() if len(w) > 3}
    q_words_set = {w for w in q_lower.split() if len(w) > 3}
    if len(q_words_set & chunk_words) < 3:
        print("[FILTER FAIL] Question not grounded in chunk")
        return False

    # Answer grounding
    if not _answer_in_chunk(correct_answer, chunk_text):
        print("[FILTER FAIL] Answer not in chunk text")
        return False

    # No all/none boilerplate
    for banned in ["all of the above", "none of the above", "all of these", "none of these"]:
        if banned in q_lower:
            print("[FILTER FAIL] Banned phrase in question")
            return False

    print("[FILTER PASS] Question accepted ✅")
    return True


# ─── Neo4j fetchers ─────────────────────────────────────────────────────────────

def fetch_chunks(graph_id: str) -> list:
    print("\n[DEBUG] Fetching chunks from Neo4j")
    with driver.session() as s:
        data = s.run(
            "MATCH (c:Chunk {graph_id: $gid}) RETURN c.id AS id, c.text AS text ORDER BY c.id",
            {"gid": graph_id}
        ).data()
    print(f"[DEBUG] Chunks fetched: {len(data)}")
    return data


def fetch_chunk_with_neighbors(chunk_id: str, graph_id: str, window: int = 1):
    with driver.session() as s:
        rows = s.run(
            "MATCH (c:Chunk {graph_id: $gid}) RETURN c.id AS id, c.text AS text ORDER BY c.id",
            {"gid": graph_id}
        ).data()
    id_to_idx = {r["id"]: i for i, r in enumerate(rows)}
    if chunk_id not in id_to_idx:
        return None, []
    idx = id_to_idx[chunk_id]
    neighbors = [rows[i]["text"] for i in range(max(0, idx - window), min(len(rows), idx + window + 1)) if i != idx]
    return rows[idx]["text"], neighbors


def get_overlap_texts(chunk_id: str, graph_id: str, limit: int = 3) -> list:
    query = """
    MATCH (main:Chunk {id: $id, graph_id: $gid})
          -[:HAS_KEYWORD {graph_id: $gid}]->
          (k:Keyword {graph_id: $gid})
          <-[:HAS_KEYWORD {graph_id: $gid}]-
          (o:Chunk {graph_id: $gid})
    WHERE main.id <> o.id
    RETURN o.text AS text, COUNT(DISTINCT k) AS score
    ORDER BY score DESC LIMIT $limit
    """
    try:
        with driver.session() as s:
            rows = s.run(query, {"id": chunk_id, "gid": graph_id, "limit": limit}).data()
        return _clean_overlap_texts([r["text"] for r in rows])
    except Exception as e:
        print("[WARN] Overlap fetch failed:", e)
        return []


# ─── LLM agents ─────────────────────────────────────────────────────────────────

def question_agent(chunk_text: str, difficulty: str = "medium", q_type: str = "mcq", neighbor_texts=None):
    import random
    print(f"\n[DEBUG] question_agent: difficulty={difficulty}, type={q_type}")
    print("Chunk preview:", chunk_text[:200])

    # For mixed type, randomly pick mcq or true_false for this chunk
    effective_type = q_type
    if q_type == "mixed":
        effective_type = random.choice(["mcq", "true_false"])

    if effective_type == "true_false":
        type_instruction = (
            "a True/False question. The answer must be exactly one word: either 'True' or 'False'. "
            "State a factual claim about the concept and ask whether it is true or false."
        )
    else:
        type_instruction = "a multiple-choice question with exactly 4 distinct answer options."

    if difficulty == "easy":
        diff_instruction = (
            "Easy — Knowledge/Recall level. Ask about a specific definition, term, or fact. "
            "The question should test whether the student knows what something IS."
        )
        stem = random.choice(EASY_STEMS)
    elif difficulty == "medium":
        diff_instruction = (
            "Medium — Comprehension/Application level. Ask about HOW or WHY something works, "
            "or how one concept relates to another. Avoid simple recall."
        )
        stem = random.choice(MEDIUM_STEMS)
    else:
        diff_instruction = (
            "Hard — Analysis/Evaluation level. Ask about implications, conditions, trade-offs, "
            "or the most critical factor. The student must deeply understand the concept. "
            "Do NOT ask 'what is X' — ask 'why', 'under what conditions', or 'what would happen if'."
        )
        stem = random.choice(HARD_STEMS)

    neighbor_section = ""
    if neighbor_texts:
        neighbor_section = "\n\nSUPPORTING CONTEXT (use only for background — base the question on the TOPIC CONTENT above):\n" + "\n".join(neighbor_texts[:2])

    if effective_type == "true_false":
        examples = """EXAMPLES:
[GOOD]
Question: Does the CAP theorem guarantee that all three properties can be achieved simultaneously?
Answer: False
Explanation: The CAP theorem mathematically proves that a distributed data store can only simultaneously provide two of the three guarantees.
"""
    else:
        examples = """EXAMPLES:
[GOOD]
Question: Which system property must be sacrificed during a network partition to maintain consistency?
Answer: Availability
Explanation: The CAP theorem states that during a partition, a system must choose between consistency and availability.

[BAD - REJECTED]
Question: According to the text, what does CAP stand for?
Reason for rejection: Violates Rule 1 (uses "According to the text") and is a trivial recall question.
"""

    prompt = f"""You are an experienced teacher writing exam questions. A student has studied the topic below.
Write ONE {type_instruction}

DIFFICULTY: {diff_instruction}
SUGGESTED QUESTION OPENER: "{stem}" — adapt it naturally to fit the topic.

{examples}

TOPIC CONTENT:
{chunk_text}{neighbor_section}

STRICT RULES:
1. The question MUST be self-contained — do NOT say "the passage", "the text", "according to", 
   "as mentioned", "the reading", or reference any document. Write as if you simply know this topic.
2. Ask about the CONCEPT, not about what was written.
3. The correct answer MUST be a word or short phrase that explicitly appears in the topic content.
4. Do NOT reveal the answer inside the question.
5. The question must end with a question mark.
6. Answer should be concise: 1–6 words is ideal.
7. Do NOT embed option letters (A, B, C, D) in the question.
8. FACTUAL ACCURACY IS CRITICAL: Base the logic strictly on the topic content. Do NOT invert definitions or relationships (e.g., if a high metric means good reliability, do not state it means poor reliability).

Respond in EXACTLY this format — no extra lines:
Question: <your question here>
Answer: <the correct answer>
Explanation: <1-2 sentences why this answer is correct, strictly aligned with the topic content>
"""
    resp = llm.invoke(prompt).content.strip()
    print("[DEBUG] LLM response:\n", resp)

    if "Answer:" not in resp:
        raise ValueError("LLM did not return an Answer field")

    q_part, rest = resp.split("Answer:", 1)
    question_text = q_part.replace("Question:", "").strip()
    question_text = clean_question_text(question_text)
    question_text = strip_meta_references(question_text)

    answer_text = rest.strip()
    explanation_text = ""

    if "Explanation:" in rest:
        answer_text, explanation_text = rest.split("Explanation:", 1)
        answer_text = answer_text.strip()
        explanation_text = explanation_text.strip()

    answer_text = answer_text.split("\n")[0].strip()

    # Carry forward the effective type so the caller knows whether this is T/F or MCQ
    return question_text, answer_text, explanation_text, effective_type


async def option_agent(question: str, answer: str, overlap_texts: list, chunk_text: str) -> list:
    print("\n[DEBUG] option_agent: generating distractors")

    context_parts = [f"TOPIC CONTENT:\n{chunk_text[:700]}"]
    if overlap_texts:
        related = "\n".join(f"- {t[:250]}" for t in overlap_texts[:3] if t.strip())
        if related:
            context_parts.append(f"RELATED SECTIONS:\n{related}")
    context = "\n\n".join(context_parts)

    ans_words = len(answer.split())
    style_hint = (
        f'Each distractor should be roughly {max(1, ans_words - 1)}–{ans_words + 2} words, '
        f'using the same grammatical form as the correct answer: "{answer}".'
    )

    prompt = f"""You are writing WRONG but convincing answer options for a multiple-choice exam question.

QUESTION: {question}
CORRECT ANSWER: {answer}

{context}

Generate exactly 3 INCORRECT distractors that:
1. Represent common misconceptions, frequent student errors, or closely related but incorrect concepts.
2. Are clearly wrong when you know the subject well, but sound highly plausible to a novice.
3. Are factually grounded in the content above — do not invent random meaningless phrases.
4. Match the grammatical style and approximate length of the correct answer.
5. Do NOT contain the correct answer or a trivial rephrase of it.
6. Do NOT use giveaway words: "always", "never", "all", "none", "cannot be determined".
7. Do NOT start with A), B), C) etc.

{style_hint}

Return ONLY valid JSON, no markdown, no explanation:
{{"distractors": ["wrong option 1", "wrong option 2", "wrong option 3"]}}
"""

    candidates = []
    try:
        raw = await llm_async.ainvoke(prompt)
        content = raw.content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.MULTILINE).strip()
        data = json.loads(content)
        candidates = data.get("distractors", [])
        if not isinstance(candidates, list) or len(candidates) < 2:
            raise ValueError("Too few distractors")
    except Exception as e:
        print(f"[WARN] option_agent first call failed: {e}")

    options = [answer]
    seen = {answer.lower()}

    for opt in candidates:
        opt = re.sub(r"^[A-H1-9][.)]\s*", "", opt.split("\n")[0].strip())
        if opt and opt.lower() not in seen and _is_valid_distractor(opt, answer, chunk_text, options):
            options.append(opt)
            seen.add(opt.lower())
        if len(options) >= 4:
            break

    # Retry 1: request more with context about what's already chosen
    if len(options) < 4:
        needed = 4 - len(options)
        already = ", ".join(f'"{o}"' for o in options[1:]) or "none"
        retry_prompt = f"""Need {needed} more WRONG answer option(s) for this question.

QUESTION: {question}
CORRECT ANSWER: {answer}
ALREADY HAVE THESE WRONG OPTIONS (do not repeat): {already}

SOURCE TEXT:
{chunk_text[:800]}

Write {needed} convincing wrong answer(s):
- A confused student might choose these.
- Factually incorrect but related to the topic.
- Match length/style of: "{answer}"
- Under 15 words each.

One option per line. No prefixes."""
        try:
            raw = await llm_async.ainvoke(retry_prompt)
            for line in raw.content.strip().split("\n"):
                line = re.sub(r"^[A-H1-9][.)]\s*", "", line.strip())
                if line and line.lower() not in seen and _is_valid_distractor(line, answer, chunk_text, options):
                    options.append(line)
                    seen.add(line.lower())
                if len(options) >= 4:
                    break
        except Exception as e:
            print(f"[WARN] Retry 1 failed: {e}")

    # Retry 2: fallback — ask for related but wrong terms
    if len(options) < 4:
        needed = 4 - len(options)
        fallback_prompt = f"""From the text below, name {needed} specific term(s) or concept(s) that:
- Are RELATED to "{answer}" but are NOT the correct answer for: "{question}"
- Would be plausible wrong choices.
- Are 1–5 words each.

TEXT: {chunk_text[:500]}

One term per line. No explanation."""
        try:
            raw = await llm_async.ainvoke(fallback_prompt)
            for line in raw.content.strip().split("\n"):
                line = re.sub(r"^[A-H1-9][.)-]\s*", "", line.strip())
                if line and line.lower() not in seen and _is_valid_distractor(line, answer, chunk_text, options):
                    options.append(line)
                    seen.add(line.lower())
                if len(options) >= 4:
                    break
        except Exception as e:
            print(f"[WARN] Retry 2 failed: {e}")

    print("[DEBUG] Final options:", options)
    return options[:4]


# ─── Core processing ────────────────────────────────────────────────────────────

async def _process_single_chunk(chunk: dict, graph_id: str, difficulty: str, q_type: str, limit: int):
    print("\n" + "=" * 40)
    print("[DEBUG] Processing chunk:", chunk["id"])

    chunk_text, neighbor_texts = fetch_chunk_with_neighbors(chunk["id"], graph_id, window=1)
    if not chunk_text:
        chunk_text = chunk["text"]

    for attempt in range(MAX_TRIES_PER_CHUNK):
        print(f"[DEBUG] Attempt {attempt + 1}/{MAX_TRIES_PER_CHUNK}")
        try:
            question, answer, explanation, effective_type = question_agent(
                chunk_text, difficulty, q_type, neighbor_texts=neighbor_texts
            )

            # Answer must appear in the chunk
            if not _answer_in_chunk(answer, chunk_text):
                print("[FILTER FAIL] Answer not found in chunk")
                continue

            # Handle True/False
            is_tf = (effective_type == "true_false") or answer.lower() in {"true", "false"}
            if is_tf:
                # Validate T/F answer is exactly True or False
                if answer.lower() not in {"true", "false"}:
                    print("[FILTER FAIL] T/F answer is not True/False")
                    continue
                options = ["True", "False"]
                answer = "True" if answer.lower() == "true" else "False"
            else:
                overlaps = get_overlap_texts(chunk["id"], graph_id, limit=3)
                if not overlaps:
                    overlaps = [chunk_text]
                options = await option_agent(question, answer, overlaps + neighbor_texts, chunk_text)

            if len(options) < 2:
                print("[FILTER FAIL] Not enough options")
                continue

            if not validate_question(question, options, answer, chunk_text):
                continue

            # Hard difficulty: question must use reasoning language
            if difficulty == "hard" and not is_tf:
                q_words = set(question.lower().split())
                if not (q_words & REASONING_WORDS):
                    print("[FILTER FAIL] Hard question lacks reasoning trigger")
                    continue

            print("[DEBUG] ACCEPTED ✅")
            return {
                "graph_id": graph_id,
                "chunk_id": chunk["id"],
                "question": question,
                "options": options,
                "answer": answer,
                "explanation": explanation,
                "difficulty": difficulty,
                "type": effective_type,
            }
        except Exception as e:
            print(f"[ERROR] Generation exception: {e}")

    return None


async def generate_mcqs_async(graph_id: str, limit: int = 10, difficulty: str = "medium", q_type: str = "mcq") -> list:
    print(f"\n[DEBUG] generate_mcqs_async: graph={graph_id}, limit={limit}, difficulty={difficulty}, type={q_type}")
    chunks = fetch_chunks(graph_id)

    if not chunks:
        print("[WARN] No chunks found")
        return []

    semaphore = asyncio.Semaphore(CHUNK_CONCURRENCY)
    results: list = []
    results_lock = asyncio.Lock()
    done_event = asyncio.Event()
    seen_questions: set = set()
    seen_answers: set = set()

    async def _sem_task(chunk):
        async with semaphore:
            if done_event.is_set():
                return
            result = await _process_single_chunk(chunk, graph_id, difficulty, q_type, limit)
            if result:
                q_norm = _normalize(result["question"])
                a_norm = _normalize(result["answer"])
                is_tf = result["type"] == "true_false" or a_norm in {"true", "false"}

                async with results_lock:
                    if done_event.is_set():
                        return
                    
                    # Reject if question text is too similar
                    if any(_similarity(q_norm, sq) > 0.75 for sq in seen_questions):
                        print("[DEDUP] Skipping question with similar text")
                        return
                    
                    # For standard MCQs, reject if we already have a question testing the same exact answer concept
                    if not is_tf and any(_similarity(a_norm, sa) > 0.85 for sa in seen_answers):
                        print(f"[DEDUP] Skipping duplicate concept tested: {result['answer']}")
                        return

                    if len(results) < limit:
                        results.append(result)
                        seen_questions.add(q_norm)
                        if not is_tf:
                            seen_answers.add(a_norm)
                        print(f"[DEBUG] Progress: {len(results)}/{limit}")
                    
                    if len(results) >= limit:
                        done_event.set()

    tasks = [asyncio.create_task(_sem_task(c)) for c in chunks]
    await asyncio.gather(*tasks, return_exceptions=True)

    print(f"\n[DEBUG] Done: {len(results)}/{limit} questions generated")
    return results[:limit]


def generate_mcqs(graph_id: str, limit: int = 10, difficulty: str = "medium", q_type: str = "mcq") -> list:
    """Synchronous entry point — always creates a fresh event loop."""
    return asyncio.run(generate_mcqs_async(graph_id, limit, difficulty, q_type))


# ─── Batch refine ────────────────────────────────────────────────────────────────

def refine_questions(questions: list, instruction: str) -> list:
    print(f"\n[DEBUG] refine_questions: instruction='{instruction}'")
    refined = []
    for q in questions:
        prompt = f"""Refine the following MCQ according to the instruction.

MCQ:
Question: {q.get('text', q.get('question', ''))}
Options: {', '.join(o['text'] for o in q.get('options', []))}

Instruction: {instruction}

Return in EXACTLY this format:
Question: <refined question>
Options: <opt1>, <opt2>, <opt3>, <opt4>
Correct: <exact text of the correct option>
Explanation: <brief explanation>
"""
        try:
            resp = llm.invoke(prompt).content.strip()
            lines = resp.split("\n")
            new_q = q.get("text", q.get("question", ""))
            new_opts = [o["text"] for o in q.get("options", [])]
            new_correct = ""
            new_explanation = q.get("explanation", "")

            for line in lines:
                if line.startswith("Question:"):
                    new_q = line.replace("Question:", "").strip()
                elif line.startswith("Options:"):
                    new_opts = [o.strip() for o in line.replace("Options:", "").split(",")]
                elif line.startswith("Correct:"):
                    new_correct = line.replace("Correct:", "").strip()
                elif line.startswith("Explanation:"):
                    new_explanation = line.replace("Explanation:", "").strip()

            actual_correct = ""
            nc_l = new_correct.lower()
            for opt in new_opts:
                ol = opt.lower()
                if ol == nc_l or nc_l in ol or ol in nc_l:
                    actual_correct = opt
                    break
            if not actual_correct and new_opts:
                actual_correct = new_opts[0]

            refined.append({
                **q,
                "text": new_q,
                "question": new_q,
                "answer": actual_correct,
                "options": [
                    {"id": i, "text": opt, "isCorrect": opt == actual_correct}
                    for i, opt in enumerate(new_opts)
                ],
                "explanation": new_explanation,
            })
        except Exception as e:
            print(f"[ERROR] refine failed: {e}")
            refined.append(q)

    return refined
