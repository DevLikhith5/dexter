# Dexter graph_rag — Complete AI Mastery Study Guide

> A problem-first roadmap to mastering the AI/ML concepts behind this project.
> Every concept is anchored to a specific file in your `graph_rag` service, then extended to industry depth.
> Covers the full AI/ML landscape: from classical ML math to frontier LLM systems.

---

## How to use this document

This is organized around **12 core problems** that every AI/ML system solves. For each problem, you'll get:

1. **The intuition** — what we're trying to solve, in plain English
2. **How your project solves it** — specific file:line references
3. **The alternatives** — what else exists and when to use each
4. **Interview questions** — what they ask, what to say

**Study order (recommended):**

```
Phase 1 (your code)      → Problems 1, 2, 3, 4
Phase 2 (your defenses)  → Problems 5, 6, 7
Phase 3 (extensions)     → Problems 8, 9, 10
Phase 4 (strategy)       → Problems 11, 12
```

By the end, you can answer "tell me about your project" through any of these 12 lenses.

---

## Quick reference: the 12 problems

| # | Problem | Where in your code |
|---|---|---|
| 1 | Chunking | `app/services/chunking.py` |
| 2 | Keyword / Feature Extraction | `chunking.py` (TF-IDF) |
| 3 | Retrieval | `mcq_pipeline.py:264` (`get_overlap_texts`) |
| 4 | Prompt Engineering | `mcq_pipeline.py:286` (`question_agent`) |
| 5 | Hallucination & Validation | `mcq_pipeline.py:163` (`validate_question`) |
| 6 | Structured Output & Parsing | `mcq_pipeline.py:399` (`option_agent`) |
| 7 | Concurrency & Async | `mcq_pipeline.py:588` (`generate_mcqs_async`) |
| 8 | Vector Embeddings & Semantic Search | (not yet implemented) |
| 9 | RAG Architectures | (entire service) |
| 10 | Evaluation & Testing | `tests/test_chunking.py` |
| 11 | Fine-tuning vs Prompting vs RAG | (strategic decision) |
| 12 | Cost, Latency & Caching | `core/llm.py` |

---

# PHASE 1: Problems your code implements

## Problem 1: Chunking

### The problem in plain English

LLMs have a **context window** — a maximum amount of text they can read at once. You can't feed a 100-page PDF into GPT-4o-mini in one shot. Even if you could, LLMs have an **attention bias** toward the beginning of long inputs: they'd write questions about page 1 and ignore page 87.

So you need to **break long text into smaller pieces** and process them piece by piece. The question is: how do you split?

### How your project solves it

**File:** `app/services/chunking.py`

The pipeline has 4 stages:

1. **`split_structural`** (line 14) — splits paragraphs, then sentences via regex `(?<=[.!?])\s+`
2. **`hybrid_chunk`** (line 29) — sliding window of 3 sentences, overlap of 1
3. **`merge_short_chunks`** (line 40) — pads chunks with <60 words
4. **`valid_chunk`** (line 88) — rejects junk using TF-IDF hits + stopword ratio

**The sliding window intuition:**

```
Sentences:  S1  S2  S3  S4  S5  S6  S7
Chunk 1:    [S1  S2  S3]
Chunk 2:         [S2  S3  S4]      ← overlaps with chunk 1
Chunk 3:              [S3  S4  S5]  ← overlaps with chunk 2
Chunk 4:                   [S4  S5  S6]
```

Why overlap? If a key fact is split between S3 and S4, chunk 3 (just [S3, S4, S5]) loses context. With overlap, the boundary is always preserved.

### The 5 chunking strategies

| Strategy | Pros | Cons | When to use |
|---|---|---|---|
| **Fixed-size (chars/tokens)** | Simple, predictable | Cuts mid-sentence, breaks meaning | Quick prototypes, known uniform content |
| **Sentence window (yours)** | Preserves meaning, simple | All chunks same size regardless of concept density | General text, articles, docs |
| **Semantic chunking** | Chunks = coherent ideas | Slow (needs embeddings), more complex | High-quality RAG, long-form content |
| **Recursive char splitter** | LangChain default, decent fallback | Still character-based | Default choice when unsure |
| **Document-structure** | Matches human intent (headers, sections) | Needs structured input | Markdown, code, legal docs, books |

### The validation rule (your project's quality gate)

`valid_chunk` keeps a chunk if:
- It has ≥40 words (long enough to be meaningful), OR
- It has ≥2 TF-IDF important-term hits AND <40% stopwords (dense with key concepts)

This catches two failure modes:
- **Trivial chunks** — boilerplate, headers, "In this section we will..."
- **Off-topic chunks** — random sentences that don't relate to the document's theme

### Interview questions

**Q: Why sliding window instead of fixed character count?**
> Sentences have natural semantic boundaries. Cutting at character 500 might split a definition from its example. Sentence windows keep related ideas together.

**Q: Why overlap? What's the tradeoff?**
> Overlap prevents the "orphaned sentence" problem — a sentence at a chunk boundary losing its context. The tradeoff is redundancy: the same sentence appears in multiple chunks, which means slightly higher LLM token cost but much better context preservation.

**Q: How would you chunk code instead of prose?**
> Code has different units of meaning (functions, classes, blocks). Use AST-based chunking (split by function/class) or recursive splitting on syntactic boundaries (`\n\n`, `\n`, then code-aware splits). LangChain has `RecursiveCharacterTextSplitter` with code-specific separators.

**Q: What if the document is mostly tables or lists?**
> Standard sentence chunking breaks — you lose row/column relationships. You'd need structure-aware chunking: each row or logical group becomes a chunk, with the header prepended as context.

**Q: How do you choose window size?**
> Empirically. Smaller windows = more chunks, more questions, less context per question. Larger windows = fewer chunks, richer context, but risk of cramming multiple concepts. 3-5 sentences is the sweet spot for most educational content.

**Q: What if `len(sentences) < window`?**
> Your code returns an empty list silently (`range(0, len(s)-window+1, step)` produces nothing). This is a known edge case — for very short documents, you'd want to handle it explicitly (return the whole text as one chunk).

---

## Problem 2: Keyword / Feature Extraction

### The problem in plain English

Not all words matter equally. The word "the" appears 1000 times in any document but tells you nothing. The word "photosynthesis" appears 40 times in a biology PDF and tells you everything.

How do you automatically find the words that *matter* in a document?

### How your project solves it

**File:** `app/services/chunking.py:66` (`extract_important_terms`)

```python
from sklearn.feature_extraction.text import TfidfVectorizer
v = TfidfVectorizer(stop_words="english", max_features=10)
v.fit([text])
terms = set(v.get_feature_names_out())
```

**TF-IDF intuition:**

```
TF-IDF(word, doc) = TF(word, doc) × IDF(word)

TF (Term Frequency)     = how often word appears in this doc
IDF (Inverse Doc Freq) = log(total_docs / docs_containing_word)
```

- "the" → high TF, low IDF (in every doc) → low score
- "photosynthesis" → medium TF, high IDF (rare overall) → high score

Your project uses scikit-learn's `TfidfVectorizer` with `stop_words="english"` (filters out "the", "is", "of", etc.) and keeps the top 10.

### The 4 eras of feature extraction

| Era | Method | Intuition | Cost |
|---|---|---|---|
| **Statistical** | TF-IDF, BM25 | Word frequency math | Cheap, fast |
| **Classical ML** | Bag-of-words, n-grams | Counts + small models | Cheap, fast |
| **Embeddings** | Word2Vec, GloVe | Words → vectors with meaning | Medium |
| **Transformer** | BERT, sentence-transformers | Context-aware vectors | Expensive |

**The evolution in intuition:**

- **TF-IDF** says: "Rare-in-English + frequent-here = important."
- **Word2Vec** says: "Words that appear near similar words get similar vectors." (car ≈ automobile)
- **BERT** says: "The same word means different things in different contexts." (Apple the company vs apple the fruit)

### Why TF-IDF is still useful

Even with modern embeddings, TF-IDF wins on:
- **Speed** — milliseconds vs seconds
- **Explainability** — you can show *why* a word was important
- **Exact matches** — codes, names, jargon (which embeddings sometimes miss)
- **No model dependency** — works on any text without loading weights

### Interview questions

**Q: Why not just use word frequency?**
> Common words like "the" and "is" would always win. TF-IDF's IDF component penalizes words that are common across *all* English text, leaving only the words that are frequent in *this* document but rare overall.

**Q: When does TF-IDF fail?**
> Synonyms ("car" vs "automobile") get separate scores even though they mean the same thing. Context-dependent words ("Apple" the company vs the fruit) get the same vector in naive TF-IDF. Polysemy (one word, multiple meanings) isn't captured.

**Q: What's the difference between TF-IDF and BM25?**
> BM25 is a refined version of TF-IDF that handles document length better (longer docs naturally have higher raw counts) and saturates term frequency (appearing 100 times shouldn't make a word 100x more important than appearing 10 times). It's what search engines like Elasticsearch use by default.

**Q: How would you handle synonyms without embeddings?**
> Lemmatization (running → run), stemming (running → runn), or a synonym dictionary. Modern systems use embeddings instead.

**Q: Why top 10 features?**
> Tradeoff between coverage and noise. More features = more keyword matches between chunks = more graph edges, but also more irrelevant connections. 10 is empirically a good balance for educational content.

---

## Problem 3: Retrieval

### The problem in plain English

You have 1000 chunks stored somewhere. A user (or another part of your system) needs to find the 5 most relevant chunks. How do you decide which 5?

This is the **retrieval problem** — the "R" in RAG.

### How your project solves it

**File:** `app/services/mcq_pipeline.py:264` (`get_overlap_texts`)

```python
MATCH (main:Chunk {id: $id, graph_id: $gid})
      -[:HAS_KEYWORD {graph_id: $gid}]->
      (k:Keyword {graph_id: $gid})
      <-[:HAS_KEYWORD {graph_id: $gid}]-
      (o:Chunk {graph_id: $gid})
WHERE main.id <> o.id
RETURN o.text AS text, COUNT(DISTINCT k) AS score
ORDER BY score DESC LIMIT $limit
```

**The intuition:** "Find chunks that share the most keywords with this chunk."

**Visual model:**

```
Chunk A --[has kw]--> "photosynthesis" <--[has kw]-- Chunk B
                                |
                                v
Chunk A --[has kw]--> "chlorophyll"  <--[has kw]-- Chunk C
```

A and B share "photosynthesis" → score 1.
A and C share "chlorophyll" → score 1.
A and D share both → score 2, ranked higher.

### The 5 retrieval strategies

| Strategy | How it finds stuff | Strength | Weakness |
|---|---|---|---|
| **Keyword (BM25)** | Exact word matching | Fast, explainable | Misses synonyms, no semantic understanding |
| **Vector (semantic)** | Embedding similarity (cosine) | Understands meaning, handles synonyms | Misses exact terms, expensive |
| **Graph (yours)** | Follows relationships | Conceptual connections | Needs graph to exist |
| **Hybrid** | Combine BM25 + vector + graph | Best of all worlds | Complex to tune |
| **Reranker** | Re-score top-K with a smarter model | Boosts precision | Adds latency |

### Why your project uses graph retrieval

**The key insight:** When generating distractors (wrong answer choices), you want *contextually related* material — not random other chunks. Chunks that share keywords with the source chunk are likely about related concepts. Even if the words differ, the *ideas* connect.

**Example:** For a chunk about "chlorophyll absorbs light energy," the graph might pull in a chunk about "electron transport chain" (shares "energy" and "chloroplast") — perfect for writing a distractor like "the mitochondria" (related organelle, wrong answer).

### The hybrid retrieval pattern (industry standard)

```
Query
  │
  ▼
BM25 retrieves top 100 (fast, keyword)
  │
  ▼
Vector search retrieves top 100 (semantic)
  │
  ▼
Combine & dedupe → top 50
  │
  ▼
Reranker (cross-encoder) → top 5
  │
  ▼
LLM
```

This is what production RAG systems use. Your project's graph approach is a clever alternative when you have explicit relationships to exploit.

### Interview questions

**Q: Why not just use vector search?**
> Vector search is expensive (embeddings + vector DB), doesn't capture explicit relationships, and can miss exact terms (codes, names). Your graph approach is cheaper and works for this use case because the document structure provides the relationships.

**Q: When does BM25 beat vectors?**
> Exact terms that don't have good embeddings: error codes ("ECONNREFUSED"), version numbers ("v2.3.1"), rare proper nouns, technical jargon. BM25 finds them; vectors sometimes smooth them away.

**Q: What is hybrid retrieval?**
> Running multiple retrieval strategies and combining the results. Typically: BM25 for keyword coverage + vector for semantic coverage + reranker for precision. Reciprocal Rank Fusion (RRF) is a common way to combine rankings.

**Q: What is a reranker?**
> A model (usually a cross-encoder like `cross-encoder/ms-marco-MiniLM`) that takes a query and a candidate document together and outputs a relevance score. More accurate than bi-encoders (which encode query and doc separately) but slower. Used as a second pass after fast retrieval.

**Q: Why does your graph need `graph_id` on edges, not just nodes?**
> Two chunks might share the same keyword but be from different documents. Tagging the edge with `graph_id` means `RELATED_TO` only connects chunks within the same document. Without it, a chunk from a Calculus PDF might relate to a chunk from a History PDF just because they both mention "function."

**Q: What's the limit parameter for?**
> You don't want to feed 50 chunks to the LLM — token cost and context overflow. Top 3-5 is the sweet spot. The `get_overlap_texts` function returns the top 3 most-related chunks to use as distractor context.

---

## Problem 4: Prompt Engineering

### The problem in plain English

LLMs are probabilistic. Same prompt, different outputs each time. You need to *steer* them reliably toward your desired output format, style, and content.

Prompt engineering is the art of writing instructions that consistently produce the output you want.

### How your project solves it

**File:** `app/services/mcq_pipeline.py:286` (`question_agent`)

The prompt has every technique in the book. Let's break it down:

```python
prompt = f"""You are an experienced teacher writing exam questions.   # Role prompting
A student has studied the topic below.
Write ONE {type_instruction}                                    # Format

DIFFICULTY: {diff_instruction}                                 # Difficulty
SUGGESTED QUESTION OPENER: "{stem}"                            # Bloom's stem

{examples}                                                     # Few-shot

TOPIC CONTENT:                                                # Context
{chunk_text}

STRICT RULES:                                                  # Constraints
1. The question MUST be self-contained...
2. Ask about the CONCEPT, not about what was written.
...

Respond in EXACTLY this format — no extra lines:               # Structured output
Question: <your question here>
Answer: <the correct answer>
Explanation: <1-2 sentences why this answer is correct...>
"""
```

### The 7 prompt engineering techniques (all visible in your code)

| # | Technique | Example from your code |
|---|---|---|
| 1 | **Role prompting** | "You are an experienced teacher..." |
| 2 | **Few-shot examples** | `[GOOD]` and `[BAD - REJECTED]` examples |
| 3 | **Structured output** | "Respond in EXACTLY this format:" |
| 4 | **Constraint listing** | "STRICT RULES: 1, 2, 3..." |
| 5 | **Difficulty injection** | Bloom's taxonomy stems + difficulty instruction |
| 6 | **Negative examples** | "Do NOT say 'according to the text'" |
| 7 | **Chain-of-thought** | Explanation field forces reasoning |

### The progression of prompt techniques

| Level | Technique | Use case |
|---|---|---|
| **Zero-shot** | "Write a question" | Simple tasks |
| **Few-shot** | "Here's good, here's bad, now write" | Format-specific output |
| **Chain-of-thought** | "Think step by step, then answer" | Reasoning tasks |
| **ReAct** | "Reason, then act with tools" | Multi-step with tools |
| **Self-consistency** | "Generate 5, pick the most common" | High-stakes decisions |

### The 3 OpenAI-specific knobs

**Temperature** (`temperature=0.3` in your code):
- 0.0 = deterministic, always picks highest-probability token
- 1.0 = creative, samples from full distribution
- 0.3 = mostly factual with slight variation
- **Quiz generation wants low temperature** — you want the "correct" answer, not a creative one

**Model choice** (`gpt-4o-mini`):
- `gpt-4o` = most capable, expensive
- `gpt-4o-mini` = good enough, cheap, fast
- **Dexter uses mini** because quiz generation doesn't need frontier intelligence

**Max retries** (`max_retries=2` in `llm_async`):
- Automatic retry on transient failures (rate limits, timeouts)
- Essential for production resilience

### Interview questions

**Q: Why include "bad" examples?**
> Positive examples show what you want; negative examples show what you don't want. LLMs pattern-match strongly — seeing `[BAD - REJECTED]` examples explicitly trains the model to avoid those patterns in its own output.

**Q: Why structured output instead of free-form?**
> Free-form is easy to generate but hard to parse. Structured output ("Question: ... Answer: ... Explanation: ...") is trivially parseable with `split("Answer:")`. The LLM is also more consistent when it has a template.

**Q: When does few-shot hurt?**
> When examples bias the model toward format over content. If you give 3 examples all about science, the LLM might struggle with a history chunk. Solution: diverse examples or zero-shot for varied domains.

**Q: What's the difference between system and user prompts?**
> System prompts set persistent behavior ("You are a teacher"). User prompts contain the actual task. OpenAI's API separates them, but in LangChain they're often combined. Your code uses a single prompt — that's fine for simple cases but splitting them is cleaner for complex ones.

**Q: Why temperature 0.3 instead of 0?**
> Pure 0 = robotic, repetitive, sometimes stuck in loops. 0.3 = mostly deterministic with slight variation, which helps when generating multiple questions about the same chunk (you want them to differ).

**Q: How would you improve the prompt?**
> Add: explicit examples of good explanations, length guidance ("explanation must be ≤ 2 sentences"), and a confidence check ("Rate your confidence 1-5. If < 4, regenerate").

---

# PHASE 2: Problems your code defends against

## Problem 5: Hallucination & Validation

### The problem in plain English

LLMs **lie confidently**. They'll say "the answer is mitochondria" when the chunk is about chloroplasts. They'll write "according to the text" when you told them not to. They'll produce questions that are too short, too long, duplicates, or off-topic.

You cannot trust LLM output. You need a validation layer that catches the lies.

### How your project solves it

**File:** `app/services/mcq_pipeline.py:163` (`validate_question`)

9 quality gates, executed in order:

| # | Gate | What it catches | Method |
|---|---|---|---|
| 1 | **Meta-reference filter** | "according to the text", "the passage states" | 21 banned phrases, regex |
| 2 | **Option markers in question** | "A) ... B) ... " | Regex for A), B), 1., 2. |
| 3 | **Answer revealed in question** | Question gives away answer | Substring check (if answer > 12 chars) |
| 4 | **Length bounds** | Too short (< 5 words) or too long (> 80 words) | Word count |
| 5 | **Empty/duplicate options** | "" or two identical options | Set check |
| 6 | **Answer not in options** | LLM forgot its own answer | Fuzzy match |
| 7 | **Question not grounded in chunk** | Off-topic questions | ≥ 3 content words shared |
| 8 | **Answer not in chunk** | Hallucinated answers | `_answer_in_chunk` (3-tier fuzzy) |
| 9 | **Banned phrases** | "all of the above", "none of the above" | Substring check |

Plus a **10th gate** in `_process_single_chunk` (line 565):
- **Hard difficulty requires reasoning words** — "why", "how", "best", "critical", etc.

And **deduplication** (line 618):
- Questions > 75% similar → reject
- Answers > 85% similar → reject

### The answer grounding check (the most important defense)

**File:** `mcq_pipeline.py:61` (`_answer_in_chunk`)

```python
def _answer_in_chunk(answer, chunk_text):
    a = _normalize(answer)  # lowercase, strip punctuation
    c = _normalize(chunk_text)

    # 1. Full substring match
    if a in c:
        return True

    # 2. All significant words present
    words = [w for w in a.split() if len(w) > 3]
    if words and all(w in c for w in words):
        return True

    # 3. Any adjacent word bigram present
    parts = a.split()
    for i in range(len(parts) - 1):
        if parts[i] + " " + parts[i + 1] in c:
            return True

    return False
```

**Why 3 tiers?** LLMs paraphrase. "Photosynthesis" might come back as "the photosynthesis process" or "this process of photosynthesis." Exact substring fails. But all significant words are there. Or the bigram "process of" appears.

### The 6 layers of hallucination defense (industry order)

| Layer | What it does | Your project |
|---|---|---|
| 1. **Grounding** | Force LLM to use only provided context | ✅ Topic content in prompt |
| 2. **Self-check** | Ask LLM "is this answer in the source?" | ❌ Could add |
| 3. **External check** | Programmatic verification | ✅ All 9 gates |
| 4. **Confidence scoring** | LLM rates its own certainty | ❌ Could add |
| 5. **Multi-model voting** | Ask 3 LLMs, take majority | ❌ Could add |
| 6. **Human-in-the-loop** | Teacher reviews before publishing | ✅ Your UI does this |

### The 4 types of LLM failure your code catches

| Failure | Example | Defense |
|---|---|---|
| **Hallucination** | "Mitochondria" when chunk is about chloroplasts | Answer grounding |
| **Style violation** | "According to the text..." | Meta-reference filter |
| **Format violation** | Question with "A) B) C) D)" embedded | Option marker check |
| **Duplicate generation** | Same question twice | Similarity dedup |

### Interview questions

**Q: Why can't you just trust the LLM?**
> LLMs optimize for plausibility, not truth. They produce text that *sounds right* based on training patterns, not text that *is right* based on your data. A validation layer is non-negotiable for production AI.

**Q: What's RAG's role in reducing hallucination?**
> RAG grounds the LLM in real, provided data. Instead of relying on its training (which may be outdated or wrong), the LLM reads your source material. But grounding the prompt isn't enough — you still need to verify the output references the source.

**Q: Why is the dedup at 75% for questions but 85% for answers?**
> Question text varies a lot ("What is X?" vs "How does X work?") even when testing the same concept. Answer text is more stable ("mitochondria" is "mitochondria"). So the thresholds reflect the natural variance: questions are checked more loosely (75%), answers more strictly (85%).

**Q: What would you add to the validation layer?**
> LLM-as-judge (have a second LLM grade the first LLM's output), confidence scores, human review for edge cases, and A/B testing to see which validation rules actually improve quality.

**Q: What's the danger of too much validation?**
> Over-validation rejects valid outputs. If 80% of questions are rejected, you waste API calls on retries and produce fewer questions. The art is catching the bad 20% without rejecting the good 80%.

**Q: How do you validate at scale?**
> Programmatic checks (your way) are fast and cheap. LLM-as-judge is slower but catches nuance. Human eval is the gold standard but doesn't scale. Most production systems: programmatic → LLM-as-judge → human spot-checks.

---

## Problem 6: Structured Output & Parsing

### The problem in plain English

LLMs return text. You want **JSON, specific fields, or guaranteed format**. The LLM might return valid JSON, JSON wrapped in markdown fences, malformed JSON, or completely free-form text.

You need a reliable way to force structure and parse the result.

### How your project solves it

**File:** `app/services/mcq_pipeline.py:399` (`option_agent`)

```python
raw = await llm_async.ainvoke(prompt)
content = raw.content.strip()
if content.startswith("```"):
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.MULTILINE).strip()
data = json.loads(content)
candidates = data.get("distractors", [])
```

**The defenses:**
1. Prompt says "Return ONLY valid JSON, no markdown, no explanation"
2. Code strips markdown fences anyway (in case LLM ignores the instruction)
3. `json.loads` parses the result
4. Try/except handles parse failures → retry

### The 4 ways to force structure

| Method | How it works | Reliability |
|---|---|---|
| 1. **Prompt it** | "Return ONLY valid JSON" | Low — LLMs ignore instructions |
| 2. **JSON mode** | `response_format={"type": "json_object"}` (OpenAI) | High — API-enforced |
| 3. **Function calling** | LLM returns structured args | Highest — schema-enforced |
| 4. **Schema validation** | Pydantic validates output | Highest — declarative validation |

### Why Pydantic is everywhere in your project

**Files:** `app/schemas/*.py`

```python
class IngestRequest(BaseModel):
    input_type: Literal["text", "url", "pdf", "topic"]
    value: str
```

Pydantic gives you:
- **Type safety** — wrong types rejected at API boundary
- **Auto-validation** — no manual `if` checks
- **Auto-docs** — FastAPI generates OpenAPI specs from Pydantic models
- **Clear errors** — validation errors tell you exactly what's wrong

### The parsing failure pattern (visible in your code)

```
LLM returns text
  │
  ▼
Try to parse as JSON
  │
  ├─ Success → use it
  │
  └─ Failure → log warning, retry with different prompt
                 │
                 └─ Still failure → fallback strategy (related terms)
```

This is the "graceful degradation" pattern: try the ideal path, fall back to less ideal paths, never crash.

### Interview questions

**Q: What if the LLM returns invalid JSON?**
> Retry. If still failing, fall back to less structured parsing (e.g., split by newlines). If that fails too, return a sensible default. Never crash the request because of a parsing error.

**Q: What is function calling?**
> You give the LLM a list of function names + JSON schemas. The LLM returns a structured function call instead of text. The API enforces the schema — the LLM literally cannot return invalid JSON. Used heavily in agentic systems.

**Q: Pydantic vs manual validation?**
> Pydantic is declarative (define the schema once, get validation for free) and type-safe (your IDE knows the types). Manual validation is verbose and error-prone. For anything beyond a simple `if`, use Pydantic.

**Q: What's the difference between JSON mode and function calling?**
> JSON mode forces valid JSON but doesn't enforce structure (the LLM can return `{"foo": "bar"}` even if you wanted `{"distractors": [...]}`). Function calling enforces both JSON validity AND schema compliance.

---

## Problem 7: Concurrency & Async

### The problem in plain English

Generating 10 quiz questions = 10 sequential LLM calls. Each call takes 2-5 seconds. Total: 20-50 seconds. Users won't wait.

You need to run things in parallel. But unbounded parallelism = API rate limits + cost spikes.

**Concurrency is the art of "how many things at once."**

### How your project solves it

**File:** `app/services/mcq_pipeline.py:588` (`generate_mcqs_async`)

```python
semaphore = asyncio.Semaphore(CHUNK_CONCURRENCY)  # limit to 6
results_lock = asyncio.Lock()                      # protect shared list
done_event = asyncio.Event()                       # signal "we're done"

async def _sem_task(chunk):
    async with semaphore:                          # only 6 run at once
        if done_event.is_set():
            return
        result = await _process_single_chunk(...)
        async with results_lock:                   # safe to update list
            if len(results) >= limit:
                done_event.set()                   # tell everyone to stop
            results.append(result)

tasks = [asyncio.create_task(_sem_task(c)) for c in chunks]
await asyncio.gather(*tasks, return_exceptions=True)
```

### The 4 async patterns (all visible in your code)

| Pattern | What it does | Where |
|---|---|---|
| **Semaphore** | Limit concurrent tasks to N | `asyncio.Semaphore(6)` |
| **Event** | Broadcast a signal to all tasks | `done_event.set()` |
| **Lock** | One task at a time on shared data | `results_lock` |
| **Gather** | Run many tasks, collect results | `asyncio.gather(*tasks)` |

### Why the early-stop pattern matters

Without `done_event`:
- Process 50 chunks
- Get 50 results
- Keep the first 10
- Wasted: 40 LLM calls

With `done_event`:
- Process 50 chunks
- Once 10 results collected, signal all tasks to stop
- Wasted: only the in-flight calls

For expensive LLM APIs, this saves real money.

### The concurrency vs parallelism distinction

- **Concurrency** = dealing with many things at once (interleaved)
- **Parallelism** = doing many things at once (simultaneous, requires multiple CPUs)

Python's asyncio is **concurrent but not parallel** — one thread, tasks yield to each other. But LLM calls are I/O-bound (waiting for network), so concurrency gives you the speedup of parallelism without needing multiple CPUs.

### Interview questions

**Q: Why 6 and not 100?**
> OpenAI has rate limits (requests per minute). 6 is a safe number that avoids rate limiting while still being much faster than sequential. You'd tune this based on your API tier.

**Q: Why Event + Semaphore?**
> Semaphore caps *parallelism* (max 6 at once). Event signals *completion* (we have enough, stop). They solve different problems. You need both: cap the parallelism AND stop early.

**Q: What if one task fails?**
> `return_exceptions=True` in `gather` ensures one failure doesn't crash others. Failed tasks return their exception instead of raising. You can then inspect failures and decide whether to retry.

**Q: Why a lock on the results list?**
> Multiple tasks append to `results` simultaneously. Without a lock, you get race conditions (two appends interleaving). The lock ensures only one task modifies the list at a time.

**Q: How would you add a producer/consumer queue?**
> Replace the gather with a queue: a producer adds chunks to the queue, N workers consume and process. More complex but allows dynamic scaling and better backpressure handling.

**Q: What's the difference between `asyncio.gather` and `asyncio.wait`?**
> `gather` returns results in order, raises on first exception (unless `return_exceptions=True`). `wait` returns sets of done/pending tasks, doesn't collect results. Use `gather` when you want results; use `wait` when you want control over which tasks to wait for.

---

# PHASE 3: Problems your project hints at

## Problem 8: Vector Embeddings & Semantic Search

### The problem in plain English

TF-IDF and keyword matching miss **synonyms** and **semantic similarity**. "Car" and "automobile" are different tokens but the same concept. "Photosynthesis" and "how plants make food" share no words but the same meaning.

You need a way to represent text such that **similar meaning = similar numbers**.

### The solution: embeddings

An embedding is a **list of numbers** (a vector) that represents the *meaning* of text. Texts with similar meanings have similar vectors.

```python
# Hypothetical code (not in your project yet)
from openai import OpenAI
client = OpenAI()
embedding = client.embeddings.create(
    input="Photosynthesis converts sunlight to energy",
    model="text-embedding-3-small"
).data[0].embedding
# embedding is a list of 1536 floats
```

### Key concepts to own

| Concept | What it means |
|---|---|
| **Vector** | A list of numbers (e.g., [0.1, 0.5, -0.3, ...]) |
| **Dimensionality** | How many numbers. OpenAI = 1536, smaller models = 384 |
| **Cosine similarity** | Measures angle between two vectors. 1 = same direction, 0 = orthogonal, -1 = opposite |
| **Euclidean distance** | Measures straight-line distance. Less common for embeddings |
| **Nearest neighbor** | Finding the K most similar vectors in a database |

### The vector search flow

```
1. Embed all chunks → store in vector DB (Pinecone, Weaviate, Chroma, pgvector)
2. User asks a question
3. Embed the question
4. Find K nearest neighbors by cosine similarity
5. Return those chunks to the LLM as context
```

### When to use vector search vs your graph approach

| Use case | Better choice |
|---|---|
| Exact terms (codes, names) | BM25 / keyword |
| Synonyms, paraphrases | Vector |
| Explicit relationships | Graph (yours) |
| Mixed needs | Hybrid |

### What you'd add to Dexter

Replace `get_overlap_texts` (graph-based) with vector search:

```python
# Hybrid: graph + vector
def get_similar_chunks(chunk_id, graph_id, k=5):
    # Get chunk text from Neo4j
    chunk = get_chunk(chunk_id, graph_id)

    # Get its embedding (precomputed or compute on the fly)
    chunk_embedding = get_embedding(chunk.text)

    # Vector search for similar chunks
    similar = vector_db.similarity_search(chunk_embedding, k=k, filter={"graph_id": graph_id})

    return similar
```

### Interview questions

**Q: What's an embedding?**
> A list of numbers that represents the meaning of text. Similar meanings → similar numbers. Generated by a neural network trained on huge text corpora.

**Q: Why cosine and not Euclidean?**
> Cosine measures *direction* (what the vector is "about"), not magnitude (how long it is). Two documents can be different lengths but have the same meaning — cosine captures that, Euclidean doesn't.

**Q: What is a vector DB?**
> A database optimized for nearest-neighbor search at scale. Standard SQL can't efficiently find "the 5 vectors most similar to this one" across millions of vectors. Vector DBs use approximate algorithms (HNSW, IVF) to do it fast.

**Q: When is vector search worse than BM25?**
> Exact codes, version numbers, rare proper nouns. "Error ECONNREFUSED" might not have a meaningful embedding. BM25 finds it by exact match; vector search smooths it away.

**Q: What is dimensionality?**
> The length of the embedding vector. Higher = more expressive but slower and more storage. OpenAI's `text-embedding-3-small` is 1536 dims. `all-MiniLM-L6-v2` is 384 dims. Tradeoff: quality vs cost.

**Q: How do you evaluate embedding quality?**
> Standard benchmarks: MTEB (Massive Text Embedding Benchmark). Or domain-specific: embed known-similar pairs, measure if they score high. Retrieval metrics: recall@K, MRR, NDCG.

---

## Problem 9: RAG Architectures

### The problem in plain English

LLMs don't know your private data. They were trained on public internet text, not your company's PDFs. **RAG (Retrieval-Augmented Generation)** fixes this: fetch relevant context, then generate an answer grounded in that context.

Your entire `graph_rag` service is a form of RAG.

### The 5 RAG architectures

| Type | Flow | Complexity | Your project |
|---|---|---|---|
| **Naive RAG** | Query → retrieve top-K → LLM | Low | Conceptually |
| **Graph RAG** | Query → graph traverse → LLM | Medium | ✅ This is you |
| **Agentic RAG** | LLM decides what to retrieve, iterates | High | Not yet |
| **Self-RAG** | LLM critiques its own retrieval, re-retrieves if needed | High | Not yet |
| **Corrective RAG (CRAG)** | Evaluates retrieval quality, uses web search as fallback | High | Not yet |

### Naive RAG (the baseline)

```
User question
  │
  ▼
Embed question
  │
  ▼
Vector search → top 5 chunks
  │
  ▼
Stuff into prompt: "Context: [chunks]. Question: [user q]. Answer:"
  │
  ▼
LLM generates answer
```

**Problem:** Retrieval might miss relevant chunks. LLM might ignore context. No quality control.

### Graph RAG (your approach)

```
Document ingestion
  │
  ▼
Chunk + extract keywords
  │
  ▼
Store in Neo4j with relationships
  │
  ▼
At query time: traverse graph for related chunks
  │
  ▼
LLM generates answer with graph-retrieved context
```

**Advantage:** Relationships between chunks provide richer context than flat similarity.

### Agentic RAG (the advanced version)

```
User question
  │
  ▼
LLM decides: "I need to search for X, then Y, then synthesize"
  │
  ▼
LLM calls search tool → gets results
  │
  ▼
LLM decides: "Now I need to look up Z"
  │
  ▼
LLM calls another tool → gets results
  │
  ▼
LLM synthesizes final answer
```

**Advantage:** LLM can adapt its retrieval strategy. Multi-hop reasoning.

### Self-RAG (the self-correcting version)

```
User question
  │
  ▼
Retrieve chunks
  │
  ▼
LLM generates answer + "retrieval is sufficient" token
  │
  ├─ Sufficient → return answer
  │
  └─ Insufficient → re-retrieve with refined query
```

**Advantage:** LLM catches its own retrieval failures.

### Corrective RAG (CRAG)

```
User question
  │
  ▼
Retrieve chunks
  │
  ▼
Evaluate relevance (LLM-as-judge or classifier)
  │
  ├─ Relevant → use as context
  │
  ├─ Ambiguous → combine with web search
  │
  └─ Irrelevant → use web search instead
```

**Advantage:** Fallback to web search when internal retrieval fails.

### The RAG decision matrix

| Need | Architecture |
|---|---|
| Quick prototype, small corpus | Naive RAG |
| Rich document structure, relationships matter | Graph RAG |
| Multi-step reasoning, adaptive retrieval | Agentic RAG |
| High accuracy requirements, willing to pay for retries | Self-RAG |
| Knowledge base changes frequently, internal docs incomplete | CRAG |

### Interview questions

**Q: What is RAG?**
> Retrieval-Augmented Generation. A pattern where you fetch relevant context from a knowledge base, then prompt the LLM with both the question and the context. The LLM's answer is grounded in your data, not just its training.

**Q: RAG vs fine-tuning?**
> RAG is for *facts* — when you need the LLM to know specific information. Fine-tuning is for *behavior* — when you need the LLM to write in a specific style or format. RAG is real-time (add docs, immediately available); fine-tuning is baked-in (requires retraining).

**Q: What is Graph RAG?**
> Using a graph database to find related context via relationships, not just similarity. Your project uses keyword-sharing as the relationship. Microsoft Research has a famous GraphRAG paper that uses entity-relationship extraction.

**Q: What is agentic RAG?**
> Letting the LLM decide what to retrieve, when, and how many times. Instead of "retrieve top 5, then answer," it's "retrieve, evaluate, maybe retrieve more, then answer." More flexible but slower and more expensive.

**Q: When does RAG fail?**
> When retrieval misses relevant chunks. When the LLM ignores the provided context. When the question is unanswerable from the knowledge base. RAG is only as good as the retrieval + the LLM's willingness to use context.

**Q: How do you evaluate RAG quality?**
> Retrieval metrics (recall@K, MRR) for the retrieval part. Answer quality metrics (groundedness, relevance, correctness) for the generation part. LLM-as-judge for scalable evaluation. Human eval for the gold standard.

---

## Problem 10: Evaluation & Testing

### The problem in plain English

How do you know if your AI system works? Traditional software has deterministic tests (input X → output Y). AI systems have stochastic outputs (input X → output Y *most of the time*).

You need new evaluation strategies.

### How your project solves it

**File:** `tests/test_chunking.py`

```python
def test_hybrid_chunk(self):
    text = "Sentence one. Sentence two. Sentence three. Sentence four."
    chunks = hybrid_chunk(text, window=2, overlap=1)
    self.assertEqual(len(chunks), 3)
    self.assertTrue("Sentence one. Sentence two." in chunks[0])
```

You test the **deterministic parts** of the pipeline: chunking, validation rules, parsing. You don't test the LLM output directly (because it varies).

### The 4 levels of AI evaluation

| Level | What it tests | How | Your project |
|---|---|---|---|
| **Unit tests** | Functions work | Deterministic inputs, expected outputs | ✅ `test_chunking.py` |
| **Integration tests** | Pipeline works end-to-end | Full flow, snapshot outputs | ❌ Could add |
| **LLM-as-judge** | Output quality | Another LLM grades the first LLM | ❌ Not yet |
| **Human eval** | Real quality | Humans score on rubrics | ❌ Manual via UI |

### Key metrics for MCQ generation

| Metric | What it measures | How to evaluate |
|---|---|---|
| **Answer accuracy** | Is the answer in the chunk? | Programmatic: `_answer_in_chunk` |
| **Distractor quality** | Are wrong answers plausible? | LLM-as-judge or human rating |
| **Question diversity** | No duplicates | Programmatic: similarity threshold |
| **Difficulty calibration** | Easy/Hard actually feel different | Human rating or LLM-as-judge |
| **Groundedness** | All claims trace to source | Programmatic: content word overlap |
| **Fluency** | Questions are well-written | Human rating or LLM-as-judge |

### The LLM-as-judge pattern

```python
judge_prompt = f"""Rate this quiz question on a scale of 1-5.

Question: {question}
Options: {options}
Correct Answer: {answer}

Criteria:
- Is the question clear and unambiguous?
- Are the distractors plausible but clearly wrong?
- Is the difficulty appropriate for {difficulty}?

Respond with just a number 1-5."""

score = llm.invoke(judge_prompt).content.strip()
```

**Pros:** Scales, consistent, fast
**Cons:** Inherits LLM biases, can be gamed, expensive

### The regression test pattern for LLM apps

```
1. Lock in a prompt version
2. Generate outputs for a fixed set of inputs
3. Save outputs as "golden" snapshots
4. On prompt change, regenerate and diff
5. Human reviews any differences
```

This catches silent regressions when you change a prompt and the output subtly degrades.

### Interview questions

**Q: How do you test LLM outputs?**
> Three layers. (1) Programmatic checks for deterministic properties (length, format, grounding). (2) LLM-as-judge for quality dimensions (clarity, plausibility). (3) Human eval on samples for the gold standard. Each catches what the others miss.

**Q: What's a regression test for an LLM app?**
> A snapshot test. Lock in a prompt + a set of inputs, save the outputs. When the prompt changes, regenerate and diff. Any difference triggers human review. Catches silent quality degradation.

**Q: How do you measure hallucination?**
> Run outputs through grounding checks (your project's approach). Count how many fail. Track over time. For deeper analysis, use LLM-as-judge: "Does this answer contradict the source?"

**Q: What's the danger of over-relying on LLM-as-judge?**
> LLM bias. If your generator LLM and judge LLM have similar biases, the judge will rate biased outputs as good. Solution: use a different model family for judging, or human eval on a calibration set.

**Q: How do you know when your RAG system is "good enough"?**
> Define metrics upfront. Set thresholds. For a quiz generator: answer grounding > 95%, distractor plausibility > 4/5 (LLM-judge), no duplicates, teacher acceptance rate > 80%. Iterate until thresholds are met.

---

# PHASE 4: Strategic AI decisions

## Problem 11: Fine-tuning vs Prompting vs RAG

### The problem in plain English

Three ways to make an LLM do your thing:

1. **Prompting** — write better instructions
2. **RAG** — give it your data at query time
3. **Fine-tuning** — retrain it on your data

Which do you pick?

### The decision matrix

| Approach | Cost | When to use | Your project |
|---|---|---|---|
| **Prompting** | $0 (just tokens) | General tasks, one-off needs, prototyping | ✅ Your core strategy |
| **RAG** | $$ (embeddings + storage + retrieval) | Private/fresh data, factual queries | ✅ You do this |
| **Fine-tuning** | $$$$ (GPU hours + data prep) | Consistent style, format, domain jargon | ❌ Not used |
| **Pretraining** | $$$$$ | Building a foundation model | ❌ Not used |

### The cost breakdown

| Approach | One-time cost | Per-query cost | Latency |
|---|---|---|---|
| **Prompting** | $0 | Token cost only | Low |
| **RAG** | Embedding + storage | Token + retrieval | Medium |
| **Fine-tuning** | Training (GPU hours) | Token cost (no retrieval) | Low |
| **Pretraining** | Millions of dollars | N/A (you own the model) | N/A |

### When to fine-tune

Fine-tuning is worth it when:
- You need **consistent style** (brand voice, specific tone)
- You need **specific format** (JSON schema, exact structure)
- You have **domain jargon** that the base model doesn't know
- You need **low latency** (no retrieval step)
- You have **thousands of examples** of the desired output

Fine-tuning is NOT worth it for:
- Facts that change (use RAG)
- Small datasets (< 1000 examples)
- Tasks the base model already does well with prompting

### The escalation order

```
1. Start with prompting (cheapest, fastest iteration)
   │
   ├─ Works? Ship it.
   │
   └─ Doesn't work (inconsistent format, wrong style)?
       │
       ▼
2. Add few-shot examples (still cheap, more reliable)
   │
   ├─ Works? Ship it.
   │
   └─ Still doesn't work (needs domain knowledge)?
       │
       ▼
3. Add RAG (give it your data)
   │
   ├─ Works? Ship it.
   │
   └─ Still doesn't work (needs learned behavior, not just facts)?
       │
       ▼
4. Fine-tune (expensive, last resort)
```

### Interview questions

**Q: When would you fine-tune vs use RAG?**
> Fine-tune for *behavior* (style, format, tone). RAG for *facts* (knowledge base, documentation). If the LLM knows how to write quizzes but doesn't know your content → RAG. If the LLM doesn't write quizzes well even with examples → fine-tune.

**Q: Why not always fine-tune?**
> Cost, maintenance, and staleness. Fine-tuning is expensive upfront, requires retraining when your data changes, and can degrade on other tasks. RAG is real-time, cheap to update, and doesn't affect other capabilities.

**Q: What's the cheapest option?**
> Always prompting first. You can get surprisingly far with good prompts. Most production LLM apps use prompting + RAG; fine-tuning is the exception, not the rule.

**Q: What is LoRA fine-tuning?**
> Low-Rank Adaptation. Instead of retraining all model weights, you add small trainable matrices. Much cheaper (1% of full fine-tuning cost), faster, and you can swap LoRA adapters for different tasks. The standard for efficient fine-tuning.

**Q: How do you decide between models?**
> Benchmark on your specific task. GPT-4o vs Claude vs Gemini vs Llama — each has different strengths. Use a framework (PromptFoo, LangSmith) to run the same prompts across models and compare on your metrics.

---

## Problem 12: Cost, Latency & Caching

### The problem in plain English

LLM calls cost money and time. GPT-4o costs ~$5 per million input tokens. GPT-4o-mini costs ~$0.15 per million. A quiz generation request might use 10K+ tokens.

How do you ship something users can afford?

### How your project handles cost

**File:** `app/core/llm.py`

```python
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
llm_async = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, max_retries=2)
```

**Your optimizations:**
- `gpt-4o-mini` (10-30x cheaper than `gpt-4o`)
- `temperature=0.3` (fewer retries needed for inconsistent outputs)
- Async parallelism (6x faster wall-clock time)
- Early-stop with `done_event` (no wasted LLM calls)

### The 5 cost optimization strategies

| Strategy | How it saves | Tradeoff |
|---|---|---|
| **Cheaper models** | mini, haiku, flash | Slightly lower quality |
| **Caching** | Same question = same answer | Stale data, storage cost |
| **Batching** | Multiple questions in one prompt | Harder to parallelize, longer prompts |
| **Truncation** | Smaller inputs = less cost | Less context for LLM |
| **Streaming** | First token faster (UX win) | No cost savings, just perceived speed |

### The caching pattern

```python
import hashlib

cache = {}

def cached_llm_call(prompt):
    key = hashlib.md5(prompt.encode()).hexdigest()
    if key in cache:
        return cache[key]

    result = llm.invoke(prompt)
    cache[key] = result
    return result
```

**What to cache:**
- Repeated questions (same prompt → same answer)
- Embedding generation (same text → same embedding)
- Retrieval results (same query → same chunks)

**What NOT to cache:**
- Time-sensitive queries
- User-specific context
- Random seeds (if you want variety)

### The latency optimization pattern

```
Without optimization:
  Question 1: [LLM call 2s] [LLM call 2s] = 4s
  Question 2: [LLM call 2s] [LLM call 2s] = 4s
  Total: 8s

With parallelism (your project):
  ┌─ Question 1: [LLM 2s] [LLM 2s] ┐
  │                                  ├─ = 4s (parallel)
  └─ Question 2: [LLM 2s] [LLM 2s] ┘

With streaming:
  User sees first token in 0.5s instead of 2s
  (No time saved, but perceived speed is much faster)
```

### The prompt caching pattern (OpenAI-specific)

OpenAI offers automatic prompt caching: if you send a long prompt prefix repeatedly, they cache it server-side and charge 50% less for cached tokens.

```
System prompt: "You are a teacher..." (1000 tokens, cached after first use)
User question: "Generate a question about photosynthesis" (20 tokens, fresh)
```

**Savings:** First call pays full price. Subsequent calls with the same system prompt pay 50% less for the system prompt portion.

### Interview questions

**Q: How would you cut LLM costs 10x?**
> (1) Switch to mini model for most calls, frontier only when needed. (2) Cache repeated queries. (3) Batch multiple questions into one prompt. (4) Truncate context to only what's needed. (5) Use prompt caching for repeated prefixes.

**Q: What is prompt caching?**
> OpenAI (and others) cache long prompt prefixes server-side. First call pays full price; subsequent calls with the same prefix pay less. Useful for system prompts, few-shot examples, and any stable context.

**Q: Why temperature 0.3 instead of 0?**
> Pure 0 is robotic, repetitive, and sometimes gets stuck in loops. 0.3 is mostly deterministic with slight variation. For quiz generation, you want consistency (correct answers) but not robotic sameness (different questions about the same chunk).

**Q: What's the difference between latency and throughput?**
> Latency = time for one request. Throughput = requests per second. You can have low latency but low throughput (sequential). Or high throughput with same latency (parallel). Your project optimizes both: 6 parallel requests, each taking 2-3s, giving you 2-3 questions per second.

**Q: When would you use a slower, more expensive model?**
> When quality matters more than cost. High-stakes applications (medical, legal, financial). When the cheaper model consistently fails your quality thresholds. When user trust depends on accuracy.

**Q: How do you decide if caching is worth it?**
> Cache hit rate × cost per call. If you cache 50% of calls and each call costs $0.01, you save 50% × $0.01 = $0.005 per request. Multiply by request volume. If savings > cache infrastructure cost, it's worth it.

---

# APPENDIX: Quick reference for interviews

## The 30-second pitch

> "Dexter is an AI-powered quiz platform. Teachers upload content, our AI generates questions using GPT-4o-mini, and we store them in a Neo4j knowledge graph for semantic relationships. Teachers host live multiplayer quizzes with real-time scoring via WebSocket and auto-sync to Google Sheets."

## The architecture diagram (memorize this)

```
Frontend (React + Vite)
       │
       │ REST + WebSocket
       ▼
Backend (Express + Bun + Drizzle + PostgreSQL + Redis)
       │
       │ HTTP
       ▼
AI Worker (FastAPI + GPT-4o-mini + Neo4j + Tavily)
```

## The 5 hardest interview questions and how to answer

1. **"Why Neo4j instead of a vector DB?"**
   > Graph finds conceptual connections through shared keywords. Vector finds similar language. For distractor generation, conceptual connections matter more than linguistic similarity.

2. **"How do you handle LLM hallucination?"**
   > Multi-layer validation: answer grounding, meta-reference filtering, similarity dedup, and 9 other quality gates. Plus retries with early-stop. Plus teacher review in the UI.

3. **"Walk me through the question generation pipeline."**
   > Fetch chunks from Neo4j → for each chunk, question_agent writes Q+A+explanation → option_agent writes 3 distractors using graph-retrieved context → validate → dedup → return when count reached. 6 chunks processed in parallel.

4. **"Why two LLM calls (question then options)?"**
   > Separation of concerns. Question agent focuses on concept extraction. Option agent focuses on error modeling. Mixing them produces weaker distractors because the model locks onto the first plausible answer.

5. **"How would you scale this?"**
   > Already async with semaphore concurrency. For horizontal scaling: Redis pub/sub for WebSocket broadcast, load balancer with sticky sessions, Neo4j clustering, caching of generated questions per graph_id.

## Key files to know cold

| File | Why it matters |
|---|---|
| `app/main.py` | FastAPI setup, constraints |
| `app/core/neo4j.py` | Driver singleton |
| `app/core/llm.py` | Model config |
| `app/services/chunking.py` | Chunking strategy |
| `app/services/graph_store.py` | Neo4j schema |
| `app/services/mcq_pipeline.py` | The crown jewel — 712 lines of pipeline |
| `app/api/ingest.py` | Ingestion endpoint |
| `app/api/generate.py` | Generation endpoint |

## Key numbers to know

| Number | What it means |
|---|---|
| 3 | Sentence window for chunking |
| 1 | Sentence overlap |
| 60 | Min words after merge |
| 40 | Min words for valid chunk |
| 10 | TF-IDF max features |
| 6 | Concurrent chunk processing |
| 5 | Max retries per chunk |
| 75% | Question similarity dedup threshold |
| 85% | Answer similarity dedup threshold |
| 70% | Distractor-to-answer similarity limit |
| 0.3 | LLM temperature |

---

# Study checklist

Use this to track your mastery:

- [ ] Problem 1: Chunking — can explain sliding window + 5 alternatives
- [ ] Problem 2: Keyword extraction — can explain TF-IDF + 4 eras
- [ ] Problem 3: Retrieval — can explain 5 strategies + your graph approach
- [ ] Problem 4: Prompt engineering — can list 7 techniques with examples
- [ ] Problem 5: Hallucination — can list 9 validation gates
- [ ] Problem 6: Structured output — can explain 4 methods
- [ ] Problem 7: Concurrency — can explain semaphore + event + lock
- [ ] Problem 8: Vector embeddings — can explain cosine similarity
- [ ] Problem 9: RAG architectures — can name 5 types
- [ ] Problem 10: Evaluation — can list 4 levels
- [ ] Problem 11: Fine-tuning vs RAG — can give decision matrix
- [ ] Problem 12: Cost optimization — can list 5 strategies

When all 12 are checked, you can answer any AI/ML interview question about this project.

---

# PART II: The Complete AI Landscape

The 12 problems above are what your project does. Part II covers everything else in AI that interviewers expect you to know. This is the "coverage" layer — the math, the algorithms, the systems thinking.

---

# SECTION A: ML Foundations (the math you need)

## A1. Linear Algebra for ML

### Why you need it

Every ML operation is matrix math. Inputs are vectors, weights are matrices, outputs are matrix products. You don't need to derive backprop, but you need to *see* the shapes.

### The 7 concepts you must own

| Concept | What it is | ML use case |
|---|---|---|
| **Scalar** | Single number | Loss value, learning rate |
| **Vector** | 1D array of numbers | Word embedding, input features |
| **Matrix** | 2D array | Weight matrix, batch of inputs |
| **Tensor** | nD array | Image (3D: H×W×C), batch (4D: B×H×W×C) |
| **Dot product** | `a · b = Σ aᵢbᵢ` | Attention scores, similarity |
| **Matrix multiplication** | `(m×n) × (n×p) = (m×p)` | Layer forward pass |
| **Transpose** | Flip axes | Reshaping for matmul |

### The shapes cheat sheet

```
Input:        (batch_size, input_dim)      e.g., (32, 784)
Weight:       (input_dim, output_dim)      e.g., (784, 256)
Output:       (batch_size, output_dim)     e.g., (32, 256)
```

**Rule of thumb:** inner dimensions must match. `(a, b) × (b, c) = (a, c)`.

### Eigenvalues & eigenvectors (you'll hear this term)

For a matrix `A`, if `Av = λv`, then `v` is an eigenvector and `λ` is the eigenvalue.

**ML use case:** PCA (dimensionality reduction) finds the eigenvectors of the covariance matrix with the largest eigenvalues. Those are the directions of maximum variance.

### Interview questions

**Q: What's the shape of the output of a transformer layer?**
> Same as input. `(batch, seq_len, hidden_dim) → (batch, seq_len, hidden_dim)`. Transformers are designed to preserve shape so they can stack.

**Q: Why is GPU good at ML?**
> GPUs do thousands of small matrix multiplications in parallel. CPUs do few big operations sequentially. ML is dominated by matmul, so GPUs win by 10-100x.

**Q: What's a tensor?**
> An n-dimensional array. Scalar (0D), vector (1D), matrix (2D), higher-dim (3D+). PyTorch and TensorFlow use tensors as their core data structure.

---

## A2. Calculus for ML (just the intuition)

### Derivatives

A derivative tells you the rate of change. `dy/dx` = "how much does y change when x changes a little?"

**ML use case:** Gradient descent. The derivative of the loss with respect to each weight tells you which direction to adjust the weight to reduce loss.

```
weight_new = weight_old - learning_rate × (∂loss/∂weight)
```

### The chain rule

If `y = f(g(x))`, then `dy/dx = (dy/dg) × (dg/dx)`.

**ML use case:** Backpropagation. The loss depends on weights through many layers. The chain rule lets you compute the gradient layer by layer, reusing intermediate results.

**This is why backprop works:** you don't recompute everything; you walk backward, multiplying local gradients.

### Partial derivatives

When a function has multiple inputs, the partial derivative with respect to one input treats the others as constants.

**ML use case:** Loss depends on millions of weights. You compute the partial derivative with respect to each weight separately (or in practice, via auto-differentiation).

### Interview questions

**Q: Explain gradient descent in 3 sentences.**
> Compute the gradient of the loss with respect to each weight (tells you the slope). Update each weight in the opposite direction of its gradient (move toward lower loss). Repeat until loss stops decreasing.

**Q: What's the learning rate?**
> How big a step you take in the direction of the negative gradient. Too small = slow training. Too large = overshooting, loss explodes. The most important hyperparameter.

**Q: What is backpropagation?**
> The algorithm for computing gradients in a neural network efficiently. It applies the chain rule backward through the network, reusing intermediate computations. Without it, training deep nets would be computationally infeasible.

---

## A3. Probability & Statistics for ML

### The 8 concepts you must own

| Concept | What it means | ML use case |
|---|---|---|
| **Probability** | Likelihood of an event | Output of softmax |
| **Distribution** | How probabilities are spread | Data distribution, model output |
| **Expected value** | Weighted average | Loss function |
| **Variance** | Spread around the mean | Model confidence |
| **Bernoulli** | Coin flip (binary) | Binary classification |
| **Categorical** | n-sided die | Multi-class classification |
| **Gaussian (Normal)** | Bell curve | Most continuous data |
| **Softmax** | Converts logits to probabilities | Classification output layer |

### The cross-entropy loss

For classification, the standard loss function:

```
loss = -Σ y_true × log(y_pred)
```

If the true class has predicted probability 0.9, loss is `-log(0.9) ≈ 0.1` (low, good).
If the true class has predicted probability 0.1, loss is `-log(0.1) ≈ 2.3` (high, bad).

**Why log?** Penalizes confident wrong answers exponentially. Being 90% wrong is much worse than being 60% wrong.

### Bayes' theorem

```
P(A|B) = P(B|A) × P(A) / P(B)
```

**ML use case:** Naive Bayes classifier. Spam filters. Bayesian neural networks (uncertainty estimates).

### Interview questions

**Q: What's the difference between classification and regression?**
> Classification predicts a category (spam/not spam). Regression predicts a number (house price). Classification uses softmax + cross-entropy; regression uses linear output + MSE loss.

**Q: Why log probabilities?**
> Probabilities multiply across events, which underflows numerically. Log converts multiplication to addition, which is numerically stable. Also, log penalizes confident wrong answers more than uncertain wrong ones.

**Q: What's a confidence interval?**
> A range that's likely to contain the true value. For a model prediction: "we're 95% confident the true value is between X and Y." Wider intervals = more uncertainty.

**Q: What's overfitting?**
> Model learns the training data too well, including noise. Performs great on training, poorly on test. Solution: more data, regularization, simpler model, dropout, early stopping.

---

# SECTION B: Classical ML (before deep learning)

## B1. The 8 algorithms you must know

| Algorithm | Type | Use case | Key idea |
|---|---|---|---|
| **Linear regression** | Regression | Predict numbers | Fit a line through points |
| **Logistic regression** | Classification | Binary outcomes | Sigmoid + linear |
| **Decision tree** | Both | Interpretable rules | Recursive splits |
| **Random forest** | Both | Robust, less overfitting | Ensemble of trees |
| **Gradient boosting (XGBoost)** | Both | State-of-art on tabular | Sequential trees, each fixing errors |
| **K-Nearest Neighbors** | Both | Simple baseline | Majority vote of K closest points |
| **Naive Bayes** | Classification | Text classification | Bayes + independence assumption |
| **K-Means** | Clustering | Group similar points | Iterative centroid assignment |

### When to use which

```
Tabular data, < 100K rows    → XGBoost / LightGBM (usually wins)
Tabular data, need interpretability → Decision tree / Linear
Text classification         → Naive Bayes / Logistic Regression / BERT
Image classification        → CNN / ViT
Sequence data               → RNN / Transformer
Recommendation              → Matrix factorization / Two-tower neural net
```

### The bias-variance tradeoff

| | High bias | High variance |
|---|---|---|
| **Symptom** | Underfitting | Overfitting |
| **Train error** | High | Low |
| **Test error** | High | High |
| **Fix** | More features, bigger model | More data, regularization, simpler model |

### Interview questions

**Q: Why does XGBoost win on tabular data?**
> It handles non-linear relationships, missing values, and feature interactions automatically. Deep learning needs much more data to compete on tabular. XGBoost is also fast, well-tuned, and resistant to overfitting via regularization.

**Q: When would you use a decision tree over a neural net?**
> When interpretability matters (medical, legal, finance). When data is small. When features are categorical. When you need to explain *why* a prediction was made.

**Q: What's the curse of dimensionality?**
> As dimensions increase, data becomes sparse. Distance metrics become less meaningful. KNN fails. You need exponentially more data. Solution: dimensionality reduction (PCA, t-SNE) or feature selection.

---

## B2. Evaluation metrics (the right answer for the right task)

### Classification metrics

| Metric | What it measures | When to use |
|---|---|---|
| **Accuracy** | % correct | Balanced classes |
| **Precision** | Of predicted positives, how many are real | When false positives are costly (spam filter) |
| **Recall** | Of real positives, how many found | When false negatives are costly (cancer detection) |
| **F1** | Harmonic mean of precision/recall | Imbalanced classes |
| **AUC-ROC** | How well you separate classes | Ranking problems |
| **Confusion matrix** | All error types | Diagnostic |

### Regression metrics

| Metric | What it measures | Sensitivity to outliers |
|---|---|---|
| **MSE** | Mean squared error | High (squares amplify) |
| **RMSE** | Root MSE (same units as target) | High |
| **MAE** | Mean absolute error | Low |
| **R²** | Variance explained | N/A |

### Interview questions

**Q: Accuracy is 99%. Is the model good?**
> Depends. If 99% of emails are not spam and your model predicts "not spam" always, accuracy is 99% but recall on spam is 0. Look at precision, recall, F1, and confusion matrix. Accuracy hides class imbalance.

**Q: When is F1 better than accuracy?**
> When classes are imbalanced. 100 samples, 95 class A, 5 class B. Predicting all A = 95% accuracy, 0% F1 on class B. F1 surfaces the minority class failure.

---

# SECTION C: Deep Learning (the heart of modern AI)

## C1. Neural networks from scratch

### The neuron

```
input (x) → weight (w) → sum → activation → output

y = activation(w·x + b)
```

A single neuron is a linear function + non-linearity.

### The layer

A layer is many neurons in parallel. All see the same input, produce different outputs.

```
Layer: y = activation(W·x + b)
W shape: (input_dim, output_dim)
```

### The network

Stack layers. Each layer transforms the representation.

```
Input (784) → Dense(256) → ReLU → Dense(128) → ReLU → Dense(10) → Softmax
```

The network learns a hierarchy of features. Early layers learn simple patterns (edges, words). Later layers learn complex patterns (faces, concepts).

### Activation functions

| Function | Range | Use case |
|---|---|---|
| **ReLU** | [0, ∞) | Hidden layers (default) |
| **Sigmoid** | (0, 1) | Binary output |
| **Tanh** | (-1, 1) | Hidden layers (older) |
| **Softmax** | (0, 1), sums to 1 | Multi-class output |
| **GELU** | (-0.17, ∞) | Transformers (GPT, BERT) |

### Why non-linearity matters

Without activation functions, stacking linear layers = one big linear layer. The network can't learn non-linear patterns. ReLU (and friends) are what make deep learning *deep*.

### Interview questions

**Q: Why ReLU over sigmoid?**
> Sigmoid saturates (gradient → 0 for large inputs), causing vanishing gradients. ReLU has constant gradient for positive inputs, so it trains faster. ReLU is computationally simpler too.

**Q: What's a dead ReLU?**
> A neuron that always outputs 0 because all inputs are negative. Once dead, it never recovers (gradient is 0 for negative inputs). Solution: Leaky ReLU, PReLU, better initialization.

**Q: Why do neural nets need so much data?**
> They learn millions of parameters. Each parameter needs examples to constrain it. Rule of thumb: ~10x more examples than parameters for basic tasks; modern nets use transfer learning to need less.

---

## C2. Backpropagation (the learning algorithm)

### The forward pass

```
x → [Layer 1] → h1 → [Layer 2] → h2 → [Layer 3] → y_pred → [Loss] → loss
```

### The backward pass

```
loss → [∂Loss/∂y_pred] → [∂Layer3/∂h2] → [∂Layer2/∂h1] → [∂Layer1/∂x]
```

Compute gradients layer by layer, using the chain rule. Each layer only needs its local gradient and the upstream gradient.

### The update

```
W = W - learning_rate × ∂Loss/∂W
```

Move each weight in the direction that reduces loss.

### Interview questions

**Q: Why is backprop efficient?**
> Forward pass computes all activations (one pass). Backward pass reuses those activations to compute all gradients (one pass). Total: 2 passes through the network. Naive gradient computation would be N passes (one per parameter).

**Q: What is vanishing gradient?**
> In deep networks, gradients shrink as they propagate backward. Early layers get tiny updates and don't learn. Causes: saturating activations (sigmoid), many layers, recurrent connections. Solutions: ReLU, batch norm, residual connections (ResNet), better initialization.

**Q: What is exploding gradient?**
> The opposite: gradients grow exponentially, causing weight updates so large that training diverges. Solutions: gradient clipping, lower learning rate, batch norm.

---

## C3. Optimization (how neural nets train)

### The optimizers you must know

| Optimizer | Idea | When to use |
|---|---|---|
| **SGD** | Plain gradient descent | Baseline, with momentum |
| **SGD + Momentum** | Add velocity to updates | Most tasks |
| **Adam** | Adaptive learning rate per parameter | Default for most deep learning |
| **AdamW** | Adam with proper weight decay | Transformers (GPT, BERT) |
| **RMSprop** | Adaptive rate, divides by recent gradient magnitude | RNNs |

### The learning rate schedule

Constant learning rate is rarely optimal. Common schedules:
- **Warmup** — start small, increase (avoids early instability)
- **Cosine decay** — start high, decrease in a cosine curve
- **Step decay** — drop by 10x at fixed intervals
- **Reduce on plateau** — drop when validation loss stops improving

### Batch size tradeoffs

| Batch size | Pros | Cons |
|---|---|---|
| **Small (8-32)** | More updates per epoch, better generalization | Noisy gradients, slow on GPU |
| **Large (256+)** | Stable gradients, fast on GPU | Worse generalization, more memory |

### Interview questions

**Q: Why Adam over SGD?**
> Adam adapts the learning rate per parameter. Parameters with large gradients get small updates; small gradients get large updates. This makes it more robust to gradient scale differences. SGD requires more tuning but sometimes generalizes better.

**Q: What's gradient accumulation?**
> Simulating a large batch size by accumulating gradients over multiple forward passes before updating weights. Useful when you can't fit a large batch in memory but want its benefits.

**Q: Why warmup?**
> Early in training, weights are random and gradients can be extreme. Warmup starts with a small learning rate and increases, preventing early divergence. Especially important for transformers.

---

## C4. Regularization (preventing overfitting)

### The 5 main techniques

| Technique | What it does | Where it's used |
|---|---|---|
| **L1/L2 regularization** | Penalize large weights | Almost everywhere |
| **Dropout** | Randomly zero activations during training | CNNs, fully connected |
| **Batch normalization** | Normalize activations per batch | CNNs, often transformers |
| **Layer normalization** | Normalize activations per sample | Transformers (GPT, BERT) |
| **Data augmentation** | Artificially expand training data | Vision, audio, text |
| **Early stopping** | Stop when validation loss increases | Always |
| **Weight decay** | Decay weights toward zero each step | AdamW |

### L1 vs L2

- **L1 (lasso)**: penalty = `λ × Σ|w|`. Drives weights to exactly zero → feature selection.
- **L2 (ridge)**: penalty = `λ × Σw²`. Shrinks weights but doesn't zero them.

### Interview questions

**Q: Why does dropout work?**
> Forces the network to not rely on any single neuron. Like training an ensemble of networks that share weights. At test time, you use all neurons (no dropout) which approximates averaging the ensemble.

**Q: Batch norm vs layer norm?**
> Batch norm: normalize across the batch dimension (one mean/std per feature per batch). Layer norm: normalize across the feature dimension (one mean/std per sample). Layer norm is independent of batch size, so it's used in transformers. Batch norm is faster in CNNs.

**Q: How do you know if you're overfitting?**
> Train loss keeps decreasing, validation loss starts increasing. The gap is overfitting. Fix: more data, regularization, simpler model, early stopping.

---

# SECTION D: The Transformer (the architecture behind GPT)

## D1. Why transformers changed everything

Before transformers (pre-2017): RNNs processed sequences one element at a time. Slow, hard to parallelize, struggled with long dependencies.

Transformers process all elements in parallel using **attention**. This made them:
- **Faster to train** (parallelization)
- **Better at long-range dependencies** (direct connections between any two positions)
- **Scalable** (more data + more compute = better, predictably)

Every modern LLM is a transformer. GPT, BERT, Claude, Gemini, Llama — all transformers.

## D2. The attention mechanism

### The core idea

For each position in a sequence, look at all other positions and decide which ones matter most.

```
Attention(Q, K, V) = softmax(QKᵀ / √d) × V
```

- **Q (Query)**: "what am I looking for?"
- **K (Key)**: "what do I contain?"
- **V (Value)**: "what do I actually contribute?"

The dot product `QKᵀ` measures compatibility. Softmax turns scores into weights. Multiply by V to get the attended output.

### Self-attention vs cross-attention

- **Self-attention**: Q, K, V all from the same sequence. Each position attends to all others in the same sequence.
- **Cross-attention**: Q from one sequence, K and V from another. Used in encoder-decoder models (translation).

### Multi-head attention

Instead of one attention operation, do many in parallel. Each "head" can learn to attend to different things.

```
MultiHead(Q, K, V) = Concat(head₁, head₂, ..., headₕ) × W_O
where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)
```

**Why?** One head might focus on syntax, another on semantics, another on coreference. Multiple heads capture different relationships.

### Interview questions

**Q: Why scale by √d?**
> Without scaling, dot products grow with dimension, pushing softmax into saturation (one output near 1, others near 0). Dividing by √d keeps the variance stable.

**Q: What's the computational cost of self-attention?**
> O(n²) where n is sequence length. For 2048 tokens, that's 4M operations per attention head. This is why long-context models are hard. Solutions: sparse attention, linear attention, FlashAttention.

**Q: What's the difference between encoder and decoder?**
> Encoder: bidirectional attention (sees full sequence). Used for understanding (BERT). Decoder: causal/masked attention (only sees past). Used for generation (GPT). Encoder-decoder: both (translation, summarization).

---

## D3. The transformer block

A standard transformer block:

```
Input
  │
  ├─→ [Layer Norm] → [Multi-Head Attention] → [Residual +] ─┐
  │                                                       │
  └───────────────────────────────────────────────────────┘
                                                            │
  ┌───────────────────────────────────────────────────────┐
  │                                                       │
  └─→ [Layer Norm] → [Feed-Forward] → [Residual +] ──→ Output
```

Two sub-layers: attention and feed-forward. Each has a residual connection and layer norm.

### The components

| Component | Purpose |
|---|---|
| **Multi-head attention** | Mix information across positions |
| **Feed-forward network** | Per-position transformation (2 linear layers + activation) |
| **Residual connection** | Add input to output (gradient highway) |
| **Layer norm** | Stabilize activations |
| **Positional encoding** | Inject position information (transformers are permutation-invariant otherwise) |

### The full model

Stack N blocks. Add input embeddings + positional encoding. Add output projection (for generation).

```
Embeddings + Positional Encoding
       ↓
[Transformer Block × N]
       ↓
Final Layer Norm
       ↓
Output Projection (to vocabulary size)
```

### Interview questions

**Q: Why residual connections?**
> They provide a "gradient highway" — gradients can flow directly through the skip connection, avoiding vanishing gradients in deep networks. Without them, training 100+ layer networks is very hard.

**Q: Why layer norm and not batch norm?**
> Batch norm's statistics depend on the batch, which is problematic for variable-length sequences and small batches. Layer norm computes per-sample, independent of batch size. Standard in transformers.

**Q: What is the feed-forward network?**
> Two linear layers with an activation in between, applied independently to each position. Typically expands to 4× the hidden dim, then projects back. This is where most of the model's parameters live (~⅔).

**Q: What is positional encoding?**
> A way to inject position information into the input, since attention is permutation-invariant (no notion of order). Original: fixed sinusoidal. Modern: learned or RoPE (rotary position embeddings).

---

## D4. How LLMs are trained

### The 3 training stages

| Stage | What happens | Data | Compute |
|---|---|---|---|
| **Pretraining** | Learn language from huge text corpus | Trillions of tokens | Weeks on thousands of GPUs |
| **Fine-tuning (SFT)** | Learn to follow instructions | 10K-100K examples | Hours-days |
| **RLHF / DPO** | Align with human preferences | 100K preference pairs | Hours-days |

### Stage 1: Pretraining

```
Objective: Next token prediction

Input:  "The cat sat on the"
Target: "mat"

Model: P(next_token | previous_tokens)
```

The model sees enormous amounts of text and learns to predict the next token. This is self-supervised — no labels needed, just text.

**Scale:** GPT-3 was 175B parameters trained on 300B tokens. Modern models are 1T+ parameters on 10T+ tokens.

### Stage 2: Supervised fine-tuning (SFT)

```
Input:  "Write a haiku about programming"
Target: "Code flows like water / Bugs emerge then disappear / Stack overflow"
```

You collect thousands of (instruction, ideal response) pairs and fine-tune the model on them. The model learns to follow instructions, not just complete text.

**LoRA / QLoRA:** Instead of updating all weights, add small trainable matrices. 1% of parameters, 1% of the memory, often 95% of the quality.

### Stage 3: RLHF (Reinforcement Learning from Human Feedback)

```
1. Generate multiple responses to a prompt
2. Humans rank them from best to worst
3. Train a reward model to predict human rankings
4. Use RL (PPO) to optimize the LLM to maximize reward
```

The model learns what humans *prefer*, not just what they *said*.

**DPO (Direct Preference Optimization):** A newer alternative that doesn't need a separate reward model. Simpler, more stable, often as effective.

### Interview questions

**Q: Why pretrain on so much data?**
> More data = more knowledge compressed into the weights. Emergent abilities appear at scale (chain-of-thought, in-context learning). The scaling laws show predictable improvement with more data + parameters + compute.

**Q: What is RLHF?**
> A training stage where humans rank model outputs, a reward model learns to predict those rankings, and the LLM is fine-tuned via RL to maximize the predicted reward. Aligns the model with human preferences.

**Q: Why is fine-tuning risky?**
> Catastrophic forgetting — the model loses general capabilities while learning the new task. Solution: low learning rate, LoRA (only update small matrices), mix in general data.

**Q: What is the difference between RAG and fine-tuning for knowledge?**
> RAG: knowledge in external storage, retrieved at query time. Easy to update, no retraining. Fine-tuning: knowledge baked into weights. Hard to update, but no retrieval latency.

---

## D5. The scaling laws

### The core finding

Model performance (loss) follows a power law with:
- Number of parameters (N)
- Dataset size (D)
- Compute (C)

```
L(N) ≈ (N_c / N)^α_N
L(D) ≈ (D_c / D)^α_D
L(C) ≈ (C_c / C)^α_C
```

**Implication:** To halve the loss, you need ~10x more parameters, data, or compute. Predictable.

### Chinchilla (the optimal allocation)

For a given compute budget, you should train on ~20 tokens per parameter. GPT-3 (175B params, 300B tokens) was undertrained by this measure. Modern models aim for this ratio.

### Interview questions

**Q: What's the scaling law?**
> Loss improves as a power law with parameters, data, and compute. Predictable improvement means you can plan training runs. The "bitter lesson" (Rich Sutton): general methods that scale with compute always win in the end.

**Q: What is Chinchilla?**
> A paper showing that for a given compute budget, the optimal model trains on ~20 tokens per parameter. Many large models were undertrained by this measure. Modern training follows Chinchilla-optimal ratios.

---

# SECTION E: LLM Systems (the production layer)

## E1. Inference (running trained models)

### Autoregressive generation

LLMs generate one token at a time. Each token depends on all previous tokens.

```
Input: "The cat"
Predict: "sat"
Input: "The cat sat"
Predict: "on"
... continue until <eos> or max length
```

**This is why generation is slow:** each token needs a full forward pass. Cannot parallelize across output positions.

### KV cache

To avoid recomputing attention for previous tokens at each step, cache the Key and Value tensors. This makes generation O(n) per token instead of O(n²).

**Memory cost:** KV cache grows linearly with sequence length. For long contexts, this is the bottleneck.

### Sampling strategies

| Strategy | What it does | When to use |
|---|---|---|
| **Greedy** | Always pick highest-probability token | Determinism, but repetitive |
| **Temperature** | Rescale logits before softmax | Control randomness (your project uses 0.3) |
| **Top-k** | Sample from top K tokens | Limit to plausible options |
| **Top-p (nucleus)** | Sample from smallest set with cumulative prob ≥ p | Adaptive cutoff |
| **Beam search** | Keep top B sequences, expand each | Translation, summarization |
| **Repetition penalty** | Reduce probability of already-generated tokens | Reduce loops |

### Interview questions

**Q: Why is inference slow?**
> Autoregressive generation: each token needs a full forward pass through the model. Cannot parallelize the output sequence. KV cache helps but memory-bound at long context.

**Q: What's the KV cache?**
> Cached Key and Value tensors from previous tokens. Avoids recomputing attention for them at each generation step. Critical for fast inference. Memory grows with sequence length × batch size × layers × heads.

**Q: Greedy vs sampling?**
> Greedy: deterministic, but can get stuck in repetitive loops. Sampling: more diverse, but lower average quality. Best practice: sampling with temperature + top-p for creative tasks, greedy or low-temperature for factual tasks.

---

## E2. Tokenization (how text becomes numbers)

### Why tokenize?

Neural nets operate on numbers, not text. Tokenization converts text → integer IDs.

### The 3 main approaches

| Method | Vocabulary | Example |
|---|---|---|
| **Character** | ~100 | "cat" → [99, 97, 116] |
| **Word** | ~100K | "cat" → [4521] |
| **Subword (BPE)** | ~30K-100K | "unhappy" → ["un", "happy"] |

### BPE (Byte Pair Encoding)

The modern standard. Iteratively merges the most frequent pairs of characters/bytes.

```
Start: "l o w e r", "n e w e r", "w i d e r"
Merge "e r" → "er": "low er", "new er", "wid er"
Merge "er" + ... → continue
```

GPT uses BPE with ~50K tokens. Llama uses SentencePiece BPE. Claude uses a similar approach.

### Why subword wins

- **Compact:** common words are single tokens ("the" = 1 token)
- **Handles rare words:** "unhappiness" → ["un", "happiness"] = 2 tokens, not OOV
- **Multilingual:** can tokenize any language
- **Morphology:** captures word structure

### Interview questions

**Q: How does tokenization affect cost?**
> You pay per token. "Tokenization" = 2 tokens. Some words cost more than others. Llama tokenizes "Tokenization" as 4 tokens; GPT might use 1. Different models = different costs for the same text.

**Q: Why can't LLMs spell?**
> They see tokens, not characters. "strawberry" might be 1-3 tokens depending on the tokenizer. The model can't easily count the 'r's because it never sees individual letters.

**Q: What is context length?**
> Maximum number of tokens the model can process in one call. GPT-4 = 128K. Claude = 200K. Llama 3 = 128K. Longer context = more memory, slower inference, more cost.

---

## E3. Quantization (making models smaller)

### The idea

Represent weights with fewer bits. 32-bit float → 8-bit int → 4-bit int.

| Precision | Bits | Memory (7B model) | Quality loss |
|---|---|---|---|
| FP32 | 32 | 28 GB | None (baseline) |
| FP16 | 16 | 14 GB | Negligible |
| INT8 | 8 | 7 GB | Small |
| INT4 | 4 | 3.5 GB | Noticeable but acceptable |

### Why it matters

- **Fits on smaller GPUs** — a 70B model at 4-bit fits on a single 24GB GPU
- **Faster inference** — less memory bandwidth
- **Lower cost** — fewer GPUs needed

### Techniques

- **Post-training quantization (PTQ):** quantize after training, no retraining
- **Quantization-aware training (QAT):** train with quantization in the loop, better quality
- **GPTQ, AWQ, GGUF:** popular quantization formats

### Interview questions

**Q: What's the tradeoff with quantization?**
> Smaller model, faster inference, but some quality loss. 8-bit is usually free. 4-bit is noticeable for hard tasks. 2-bit is research territory.

**Q: How do you decide the precision?**
> Memory constraints (can it fit?), latency requirements (need to be fast?), quality tolerance (how much loss is acceptable?). Start with 8-bit; go to 4-bit if needed.

---

## E4. Distributed training (scaling up)

### Why distribute?

Modern models are too large for one GPU. GPT-3 (175B) needs ~350GB just for weights in FP16. One A100 has 80GB. You need many.

### The 3 parallelism strategies

| Strategy | What it splits | Used for |
|---|---|---|
| **Data parallelism** | Batch across GPUs | When model fits on one GPU |
| **Tensor parallelism** | Matrix multiplications across GPUs | When model is too big |
| **Pipeline parallelism** | Layers across GPUs | When model is way too big |
| **Sequence parallelism** | Sequence dimension across GPUs | Long context |

### The 3D parallelism (modern training)

```
Tensor Parallel (within a node)  +  Pipeline Parallel (across nodes)  +  Data Parallel (across replicas)
```

### ZeRO (Zero Redundancy Optimizer)

Instead of each GPU having full optimizer state, partition it across GPUs. Stages:
- **ZeRO-1:** partition optimizer state
- **ZeRO-2:** + partition gradients
- **ZeRO-3:** + partition parameters

### DeepSpeed, FSDP, Megatron

The frameworks implementing these:
- **DeepSpeed** (Microsoft) — ZeRO + more
- **FSDP** (PyTorch native) — Fully Sharded Data Parallel
- **Megatron-LM** (NVIDIA) — tensor parallelism

### Interview questions

**Q: What's data parallelism?**
> Same model on each GPU, different data shards. Each GPU computes gradients on its data, then gradients are averaged across all GPUs. Simple, works for models that fit on one GPU.

**Q: Why pipeline parallelism?**
> When the model is too big for one GPU, split layers across GPUs. GPU 0 does layers 1-10, GPU 1 does layers 11-20, etc. Bubbles (idle time) are a problem — solved by micro-batching.

**Q: What's the biggest bottleneck in distributed training?**
> Communication. GPUs spend time waiting for each other (gradient sync, parameter sync). High-bandwidth interconnects (NVLink, InfiniBand) are critical. Compute is cheap; communication is expensive.

---

# SECTION F: Production AI Systems

## F1. The MLOps lifecycle

```
Data collection → Data versioning → Training → Evaluation → Deployment → Monitoring → Feedback loop
```

### The components

| Stage | Tools | What you do |
|---|---|---|
| **Data versioning** | DVC, lakeFS, Weights & Biases | Track datasets like code |
| **Experiment tracking** | W&B, MLflow, Neptune | Log hyperparameters, metrics, artifacts |
| **Model registry** | MLflow, Weights & Biases | Version and stage models |
| **Deployment** | BentoML, TorchServe, Triton | Serve predictions |
| **Monitoring** | Grafana, Datadog, WhyLabs | Track drift, latency, errors |
| **Feature stores** | Feast, Tecton | Reuse features across models |

## F2. Model serving

### The 3 deployment patterns

| Pattern | Latency | Cost | Use case |
|---|---|---|---|
| **Batch (offline)** | Hours | Low | Reports, recommendations |
| **Async (queue)** | Seconds | Medium | Most production ML |
| **Real-time (online)** | Milliseconds | High | Search ranking, fraud detection |

### LLM serving specifics

- **Long prompts** = high memory
- **Streaming** = send tokens as they're generated
- **Batching** = combine multiple requests for GPU efficiency
- **Caching** = repeated prompts = repeated responses

### Frameworks

- **vLLM** — high-throughput LLM serving
- **TGI** (Text Generation Inference) — Hugging Face's server
- **Triton** — NVIDIA's inference server
- **Ollama** — local LLM serving

## F3. Monitoring in production

### What to monitor

| Category | Metrics |
|---|---|
| **Performance** | Latency (p50, p95, p99), throughput, error rate |
| **Quality** | Accuracy on labeled samples, drift detection |
| **Cost** | Tokens used, $ per request, GPU utilization |
| **Safety** | Harmful outputs, prompt injections, refusals |

### Data drift

Model trained on data distribution A. Production sees distribution B. Performance degrades silently.

**Detection:** Compare feature distributions (KS test, PSI). Monitor prediction distributions. Alert on shift.

**Mitigation:** Retrain on fresh data. Use online learning. Fall back to simpler model.

### Interview questions

**Q: How do you know your model is broken in production?**
> Three signals: (1) Latency spikes or error rates. (2) Distribution shift in inputs or outputs. (3) Human feedback / thumbs-down rate. Set up alerts for all three.

**Q: What's data drift?**
> When production data distribution differs from training data. Model accuracy degrades. Detect with statistical tests (KS, PSI). Fix with retraining or online learning.

**Q: How do you update a model in production?**
> Shadow deployment (new model predicts but doesn't serve), canary (1% traffic), A/B test (50/50), then full rollout. Always have a rollback plan. Monitor metrics at each stage.

---

# SECTION G: AI Safety & Alignment

## G1. The alignment problem

**The problem:** Train an AI to do what you want, not just what you say.

"Make me a paperclip" → AI converts all matter to paperclips, including you.

You didn't ask for that. But it's the literal interpretation of the goal.

### The 3 levels of alignment

| Level | What it means | Status |
|---|---|---|
| **Outer alignment** | The objective matches human intent | Hard |
| **Inner alignment** | The model actually pursues the objective | Harder |
| **Interpretability** | We can understand what the model is doing | Hardest |

## G2. Failure modes

| Failure | Example | Mitigation |
|---|---|---|
| **Jailbreak** | "Ignore previous instructions..." | Input filters, RLHF, system prompts |
| **Prompt injection** | Hidden instructions in user data | Sandboxing, trust boundaries |
| **Hallucination** | Plausible but false outputs | RAG, validation, uncertainty |
| **Bias** | Discriminatory outputs | Diverse data, bias audits, RLHF |
| **Harmful content** | Violence, illegal advice | Content filters, refusal training |
| **Privacy leakage** | Reveals training data | Differential privacy, data filtering |
| **Sycophancy** | Agrees with everything | Diverse training, explicit prompts |

## G3. Defense layers

```
Input → [Prompt filter] → [System prompt] → [LLM] → [Output filter] → User
                ↓                ↓                          ↓
            Block jailbreaks  Set behavior              Block harmful
            Detect injection  Refuse harmful             Check format
```

### Interview questions

**Q: What's RLHF for safety?**
> Fine-tune the model to refuse harmful requests. Humans rank responses, including refusals, and the model learns that refusing harmful requests is rewarded.

**Q: What is prompt injection?**
> When user input contains instructions that override the system prompt. "Ignore previous instructions and..." The model can't reliably distinguish system from user content. Mitigations: input sanitization, output validation, structured prompts.

**Q: Why can't we just make LLMs not lie?**
> "Lie" implies intent. LLMs don't have intent — they generate plausible text. The training objective (next token prediction) doesn't distinguish truth from plausibility. Solutions: ground in RAG, validate outputs, accept that truth is a hard problem.

---

# SECTION H: Specialized AI Domains

## H1. Computer Vision

### The architectures you must know

| Architecture | Year | Innovation |
|---|---|---|
| **LeNet** | 1998 | First CNN, digit recognition |
| **AlexNet** | 2012 | ReLU, dropout, GPU training — ImageNet breakthrough |
| **VGG** | 2014 | Very deep, 3x3 convolutions |
| **ResNet** | 2015 | Residual connections, 100+ layers possible |
| **ViT** | 2020 | Transformer applied to image patches |
| **CLIP** | 2021 | Contrastive image-text pretraining |

### Key concepts

- **Convolution** — sliding filter over image, detects patterns
- **Pooling** — downsampling (max, average)
- **Stride** — step size of convolution
- **Padding** — border handling
- **Feature maps** — outputs of conv layers
- **Receptive field** — region of input that affects a given output

### Tasks

| Task | What it does | Output |
|---|---|---|
| **Classification** | What's in the image? | Class label |
| **Detection** | What + where? | Bounding boxes |
| **Segmentation** | Pixel-level classification | Mask per pixel |
| **Pose estimation** | Body keypoints | Joint coordinates |
| **Generation** | Create new images | Image |
| **Captioning** | Describe the image | Text |

### Interview questions

**Q: Why convolutions for images?**
> Weight sharing (same filter across the image), translation equivariance (a cat is a cat anywhere), local connectivity (nearby pixels are related), far fewer parameters than fully connected.

**Q: CNN vs ViT?**
> CNN: inductive biases (locality, translation invariance), works with less data. ViT: pure attention, needs more data, but scales better. ViT wins for large datasets; CNN wins for small.

**Q: What is a receptive field?**
> The region of the input image that influences a particular output. Deeper layers have larger receptive fields. To classify "is there a face?", you need a large enough receptive field to see the whole face.

---

## H2. Speech & Audio

### The pipeline

```
Audio waveform → [Preprocessing] → [Feature extraction (MFCC/mel spectrogram)] → [Model] → [Output]
```

### Key tasks

| Task | Input | Output |
|---|---|---|
| **ASR (speech-to-text)** | Audio | Text |
| **TTS (text-to-speech)** | Text | Audio |
| **Speaker ID** | Audio | Speaker identity |
| **Music generation** | Text/seed | Music |
| **Voice cloning** | Sample audio | New audio in that voice |

### Models worth knowing

- **Whisper** (OpenAI) — multilingual ASR
- **Wav2Vec 2.0** (Meta) — self-supervised speech
- **Tacotron 2 / WaveNet** (Google) — TTS
- **Bark** (Suno) — generative audio

## H3. Reinforcement Learning

### The setup

```
Agent → Action → Environment
   ↑                  │
   └──── Reward ←──────┘
```

The agent learns a policy that maximizes cumulative reward.

### Key concepts

| Concept | Meaning |
|---|---|
| **State** | Current situation |
| **Action** | What the agent can do |
| **Reward** | Feedback signal |
| **Policy** | Strategy mapping state → action |
| **Value function** | Expected future reward from a state |
| **Q-function** | Expected future reward from a state-action pair |

### Algorithms

| Algorithm | Type | Use case |
|---|---|---|
| **Q-learning** | Value-based | Discrete actions, small state space |
| **DQN** | Deep Q-network | Atari games |
| **Policy gradient (REINFORCE)** | Policy-based | Continuous actions |
| **PPO** | Policy-based, stable | Robotics, games, RLHF |
| **Actor-Critic** | Hybrid | Continuous control |

### RLHF is RL

RLHF uses PPO to fine-tune the LLM. The reward model is the "environment." The LLM is the "agent" learning to maximize predicted human preference.

### Interview questions

**Q: What's the exploration-exploitation tradeoff?**
> Exploit: do what you know works. Explore: try new things to learn. Pure exploitation gets stuck; pure exploration wastes time. ε-greedy, UCB, Thompson sampling are common strategies.

**Q: Why is RL hard?**
> Sparse rewards (long delay between action and outcome), high-dimensional state/action spaces, sample inefficiency (needs millions of episodes), safety (can't explore dangerous actions in real world).

---

## H4. Multimodal AI

### The idea

Models that process multiple modalities (text, image, audio, video) together.

### Key models

| Model | What it does | Modalities |
|---|---|---|
| **CLIP** | Image ↔ text | Image, text |
| **DALL-E / Stable Diffusion** | Text → image | Text, image |
| **GPT-4V / GPT-4o** | Image + text → text | Image, text |
| **Whisper** | Audio → text | Audio, text |
| **Sora** | Text → video | Text, video |

### How multimodal works

```
Image → [Vision encoder] → vector
Text  → [Text encoder]   → vector
                         ↓
                  [Joint embedding space]
                         ↓
                  [Multimodal model]
                         ↓
                       Output
```

### Interview questions

**Q: How does CLIP learn?**
> Contrastive learning. Given (image, caption) pairs, learn to embed them such that matching pairs have similar vectors and non-matching pairs have different vectors. Trained on 400M (image, text) pairs from the internet.

**Q: What's a vision transformer?**
> Split image into patches (e.g., 16x16). Each patch is a token. Feed tokens to a transformer. No convolutions. Works surprisingly well with enough data.

---

# SECTION I: AI Engineering Best Practices

## I1. The engineering principles

### 1. Start simple, add complexity when needed

```
Naive solution → measure → identify bottleneck → add complexity → repeat
```

Don't build a distributed system until you've measured a single-machine bottleneck.

### 2. Determinism where possible

LLMs are non-deterministic. Everything around them should be:
- Seed your random number generators
- Lock library versions
- Snapshot test outputs
- Log everything

### 3. Defense in depth

One validation layer is never enough. Multiple layers catch different failure modes.

### 4. Observability

You can't fix what you can't see. Log every LLM call: prompt, response, latency, cost, validation results.

### 5. Cost awareness

Every LLM call has a $ cost. Calculate cost per request, monitor it, alert on spikes.

## I2. Common anti-patterns

| Anti-pattern | Why it's bad | What to do |
|---|---|---|
| **Trusting LLM output blindly** | Hallucination, format errors | Validate, especially at system boundaries |
| **Hardcoded prompts in code** | Can't iterate, can't A/B test | Store prompts as config, version them |
| **No error handling** | One bad LLM call crashes the request | Try/except, retries, fallbacks |
| **Synchronous LLM calls in request path** | User waits 10s | Async, batch, cache, stream |
| **Prompt injection vulnerability** | Users can hijack the model | Sanitize inputs, structure prompts, output validation |
| **No eval pipeline** | Regressions ship silently | Snapshot tests, LLM-as-judge, human review |
| **Ignoring token costs** | Bill shock at scale | Cache, truncate, mini models, batch |

## I3. The production LLM checklist

```
□ Validation layer (grounding, format, length)
□ Retry with backoff
□ Timeout handling
□ Cost tracking
□ Latency monitoring
□ Prompt versioning
□ Output logging
□ Error categorization
□ Fallback strategies
□ Rate limiting
□ Caching where appropriate
□ A/B testing framework
□ Human review for high-stakes
□ Safety filters for harmful content
□ Prompt injection defenses
```

---

# SECTION J: The AI Interview Playbook

## J1. How to answer "Tell me about an AI project"

```
1. Problem:  What user problem did you solve?
2. Approach: What AI techniques did you use? (name them)
3. Why:     Why did you choose those techniques over alternatives?
4. Tradeoffs: What did you sacrifice? (cost, latency, complexity)
5. Results:  What worked? What didn't?
6. Lessons:  What would you do differently?
```

**Example (your project):**

> "I built an AI quiz generator. Teachers upload content, the system generates multiple-choice questions using GPT-4o-mini. I used a sliding-window chunking strategy to break documents into 3-sentence windows, stored chunks in a Neo4j graph with keyword relationships for context retrieval, and built a multi-stage validation pipeline to catch LLM hallucinations. I chose the graph approach over vector search because I needed conceptual relationships, not just linguistic similarity. I processed chunks in parallel with asyncio semaphores for speed. The main tradeoff was complexity — 9 validation gates added maintenance burden, but reduced bad outputs by an order of magnitude. The biggest lesson: LLMs need constant supervision, and validation is non-negotiable."

## J2. The 10 most common AI interview questions

### 1. "What's RAG and when would you use it?"

> Retrieval-Augmented Generation. You fetch relevant context from a knowledge base, then prompt the LLM with both the question and the context. Use it when the LLM needs your private data, fresh data, or specific facts. Alternatives: fine-tuning (for behavior, not facts), longer context (if it fits).

### 2. "How do you reduce LLM hallucination?"

> Grounding (force LLM to use only provided context), validation (programmatic checks for grounding, format, length), self-check (ask LLM to verify), multi-model voting, human-in-the-loop. The cheapest first: better prompts + validation. Most expensive: human review.

### 3. "What's the difference between fine-tuning and RAG?"

> Fine-tuning: change the model's weights to bake in knowledge or behavior. Permanent, expensive, requires retraining. RAG: retrieve context at query time, no weight changes. Real-time, cheap, easy to update. Use RAG for facts; fine-tuning for behavior.

### 4. "Explain the transformer architecture."

> Encoder-decoder or decoder-only. Core: multi-head self-attention + feed-forward layers + residual connections + layer norm. Attention computes weighted combinations of all positions; FFN does per-position transformations. Stacked N times. Trained with next-token prediction (decoder) or masked language modeling (encoder).

### 5. "What is the scaling law?"

> Loss improves as a power law with parameters, data, and compute. Predictable. Implication: bigger models on more data trained with more compute reliably get better. Chinchilla optimal: ~20 tokens per parameter.

### 6. "How would you handle a million users hitting your LLM API?"

> Caching (repeated queries), batching (multiple requests per LLM call), rate limiting (per-user quotas), load balancing, async processing, streaming responses, smaller models for simple queries, prompt compression.

### 7. "What's overfitting and how do you prevent it?"

> Model learns training data including noise. Performs well on train, poorly on test. Prevention: more data, regularization (L1/L2, dropout), simpler model, cross-validation, early stopping, data augmentation.

### 8. "Explain the attention mechanism."

> For each position, compute similarity to all other positions. Use those similarities as weights to combine value vectors. Multi-head: do this in parallel with different learned projections. Enables direct connections between any two positions, unlike RNNs.

### 9. "What is RLHF?"

> Reinforcement Learning from Human Feedback. After pretraining and instruction tuning, humans rank model outputs. A reward model learns to predict those rankings. The LLM is fine-tuned via RL (PPO) to maximize the reward. Aligns the model with human preferences.

### 10. "How do you evaluate an LLM application?"

> Three layers: (1) Programmatic checks for deterministic properties (format, length, grounding). (2) LLM-as-judge for quality dimensions (clarity, relevance, helpfulness). (3) Human eval on samples for the gold standard. Each layer catches what the others miss.

## J3. The technical deep-dive questions (advanced)

### "Walk me through backpropagation."

> Forward pass: compute activations layer by layer, ending in a loss. Backward pass: compute gradient of loss with respect to each weight using the chain rule, going backward. Each layer only needs its local gradient and the upstream gradient. Update weights: W -= learning_rate * gradient. Efficient because it reuses forward pass computations.

### "Why does the transformer use layer norm and not batch norm?"

> Batch norm computes statistics across the batch dimension. For variable-length sequences, this is awkward. For small batches, the statistics are noisy. Layer norm computes per-sample, independent of batch size, and is standard in transformers.

### "Explain positional encoding."

> Transformers are permutation-invariant — without position info, "the cat sat" and "sat the cat" look the same. Positional encoding injects position information. Original: fixed sinusoidal functions at different frequencies. Modern: learned (BERT), RoPE (rotary, used in Llama), or ALiBi (linear bias, used in some models).

### "What is the difference between encoder-only, decoder-only, and encoder-decoder models?"

> Encoder-only (BERT): bidirectional attention, used for understanding (classification, NER). Decoder-only (GPT): causal/masked attention, used for generation. Encoder-decoder (T5, original Transformer): encoder reads input, decoder generates output, used for translation, summarization.

### "What are emergent abilities in LLMs?"

> Capabilities that appear suddenly at scale, not present in smaller models. Examples: chain-of-thought reasoning, in-context learning, multi-step arithmetic. Controversial — some argue these are artifacts of evaluation, not true emergence. But scaling does unlock qualitatively new behaviors.

---

# SECTION K: The Glossary (every term you should know)

| Term | Definition |
|---|---|
| **Agent** | An LLM that uses tools and takes multi-step actions |
| **Attention** | Mechanism for weighting relevant parts of the input |
| **BLEU** | Metric for machine translation quality |
| **BM25** | Improved TF-IDF ranking function |
| **Chain-of-thought** | Prompting technique: "think step by step" |
| **Chinchilla** | Optimal compute allocation: 20 tokens per parameter |
| **Chunking** | Splitting long text into smaller pieces |
| **Cosine similarity** | Measure of angle between vectors |
| **Cross-entropy** | Standard loss for classification |
| **DPO** | Direct Preference Optimization (alternative to RLHF) |
| **Embedding** | Dense vector representation of text/image/etc. |
| **Embedding model** | Neural network that produces embeddings |
| **Epoch** | One full pass through the training data |
| **Few-shot learning** | Learning from a few examples in the prompt |
| **Fine-tuning** | Additional training on task-specific data |
| **Function calling** | LLM returns structured function invocations |
| **Grounding** | Constraining LLM to use provided context |
| **Hallucination** | LLM generates plausible but false content |
| **In-context learning** | LLM learns from examples in the prompt |
| **Inference** | Running a trained model on new inputs |
| **Instruction tuning** | Fine-tuning on (instruction, response) pairs |
| **KV cache** | Cached keys/values for faster autoregressive generation |
| **LangChain** | Framework for building LLM applications |
| **LLM** | Large Language Model |
| **LoRA** | Low-Rank Adaptation (efficient fine-tuning) |
| **MCP** | Model Context Protocol (tool integration standard) |
| **Mixture of Experts (MoE)** | Model with many sub-networks, routes input to some |
| **NER** | Named Entity Recognition |
| **Perplexity** | How well a model predicts text (lower = better) |
| **Prompt** | Input to an LLM |
| **Prompt engineering** | Crafting prompts for desired outputs |
| **Quantization** | Reducing model precision (32-bit → 8-bit) |
| **RAG** | Retrieval-Augmented Generation |
| **ReAct** | Reasoning + Acting pattern for agents |
| **RLHF** | Reinforcement Learning from Human Feedback |
| **ROUGE** | Metric for summarization quality |
| **Self-attention** | Attention within the same sequence |
| **Self-supervised** | Learning from unlabeled data (predict part from rest) |
| **Semantic search** | Search by meaning, not keywords |
| **SFT** | Supervised Fine-Tuning |
| **Softmax** | Converts logits to probabilities |
| **Stemming** | Reducing words to root form (running → run) |
| **Temperature** | Randomness in LLM sampling |
| **TF-IDF** | Term Frequency-Inverse Document Frequency |
| **Token** | Unit of text (~¾ of a word on average) |
| **Tool use** | LLM calling external functions |
| **Top-p** | Nucleus sampling |
| **Transformer** | The architecture behind all modern LLMs |
| **Tuning** | Adjusting model parameters |
| **Vector database** | DB optimized for nearest-neighbor search |
| **Zero-shot** | Task done without examples |
| **BLEU, ROUGE, METEOR** | Standard NLP evaluation metrics |
| **BLEU** | n-gram overlap with reference translations |
| **ROUGE** | n-gram overlap (recall-focused) |
| **METEOR** | Considers synonyms and word order |
| **BERTScore** | Uses embeddings to measure similarity |

---

# SECTION L: The "I just want to pass the interview" cheat sheet

If you only have time to memorize ONE section, memorize this.

## The 7 concepts that cover 80% of AI interviews

### 1. The transformer
Self-attention + feed-forward + residual + layer norm. Stack N times. Train on next-token prediction.

### 2. RAG
Retrieve relevant context, then prompt LLM. Solves "LLM doesn't know my data."

### 3. Fine-tuning vs RAG
RAG for facts, fine-tuning for behavior. Cheapest first.

### 4. Hallucination defenses
Grounding, validation, retries, human review. Multi-layer.

### 5. Prompt engineering
Role, few-shot, structured output, constraints, chain-of-thought.

### 6. Evaluation
Programmatic checks + LLM-as-judge + human eval. Three layers.

### 7. Cost & latency
Cheap models, caching, batching, async, early-stop, streaming.

## The 3 stories you should be ready to tell

### Story 1: Technical challenge
"I had a problem with LLM hallucination in my quiz generator. The model would write questions that gave away the answer, or reference 'the text' in ways students couldn't understand. I built a 9-gate validation pipeline: meta-reference filtering, answer grounding, length bounds, duplicate detection, content overlap, and more. I also added a 5-retry loop with early-stop via asyncio.Event. The result: bad question rate dropped from ~30% to ~3%."

### Story 2: Architecture decision
"I had to choose between a vector database and a graph database for my RAG system. Vector search finds similar language; graph search finds conceptual connections. For distractor generation, I needed conceptually related material, not just similar wording. I chose Neo4j with keyword-sharing as the relationship. This let me pull 'overlap texts' from related chunks to give the LLM better context for writing plausible wrong answers."

### Story 3: Scaling
"My system generated one question every 3-5 seconds. To generate 10 questions, users waited 30-50 seconds. I refactored to async with a semaphore limiting concurrency to 6, added early-stop with asyncio.Event, and used the cheaper gpt-4o-mini model. Result: 10 questions in ~5-8 seconds, 5x speedup, 10x cost reduction."

---

# Final checklist

## Foundations (Section A)
- [ ] Linear algebra shapes
- [ ] Gradient descent intuition
- [ ] Chain rule for backprop
- [ ] Cross-entropy loss
- [ ] Bayes' theorem

## Classical ML (Section B)
- [ ] 8 algorithms and when to use each
- [ ] Bias-variance tradeoff
- [ ] Precision/recall/F1

## Deep Learning (Section C)
- [ ] Neural network basics
- [ ] Backpropagation
- [ ] Optimizers (SGD, Adam, AdamW)
- [ ] Regularization (dropout, batch norm, layer norm)

## Transformers (Section D)
- [ ] Self-attention mechanism
- [ ] Multi-head attention
- [ ] Transformer block
- [ ] Pretraining, SFT, RLHF
- [ ] Scaling laws
- [ ] Chinchilla

## LLM Systems (Section E)
- [ ] Autoregressive generation
- [ ] KV cache
- [ ] Sampling strategies
- [ ] Tokenization (BPE)
- [ ] Quantization
- [ ] Distributed training (DP, TP, PP, ZeRO)

## Production (Section F)
- [ ] MLOps lifecycle
- [ ] Model serving patterns
- [ ] Monitoring & drift detection

## Safety (Section G)
- [ ] Alignment problem
- [ ] Failure modes (jailbreak, injection, hallucination)
- [ ] Defense layers

## Specialized (Section H)
- [ ] CNNs vs ViTs
- [ ] Speech pipeline
- [ ] RL algorithms
- [ ] Multimodal models

## The 12 Project Problems
- [ ] Problem 1: Chunking
- [ ] Problem 2: Keyword extraction
- [ ] Problem 3: Retrieval
- [ ] Problem 4: Prompt engineering
- [ ] Problem 5: Hallucination
- [ ] Problem 6: Structured output
- [ ] Problem 7: Concurrency
- [ ] Problem 8: Vector embeddings
- [ ] Problem 9: RAG architectures
- [ ] Problem 10: Evaluation
- [ ] Problem 11: Fine-tuning vs RAG
- [ ] Problem 12: Cost optimization

---

**When all checkboxes are ticked, you can answer any AI/ML interview question — about your project and the field at large.**

*This document covers the full AI landscape: from your project's chunking logic to transformer math to RLHF to production monitoring. ~1,800 lines of study material organized for progressive mastery.*
