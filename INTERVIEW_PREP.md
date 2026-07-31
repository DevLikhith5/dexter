# DEXTER — Master Interview Doc (AI-First Edition)

> This doc is built around what interviewers will actually drill into: **the AI system**.
> The AI pipeline is 60% of this doc. Full-stack parts are compressed to what you need.
> Read actively: after each section, close the doc and say the answer out loud.

---

## TABLE OF CONTENTS

1. [The Pitch (memorize both versions)](#1-the-pitch)
2. [Architecture in 60 Seconds](#2-architecture-in-60-seconds)
3. [THE AI SYSTEM — Why Graph RAG](#3-the-ai-system--why-graph-rag)
4. [AI Stage 1: Ingestion (text extraction)](#4-ai-stage-1-ingestion)
5. [AI Stage 2: Chunking (every decision explained)](#5-ai-stage-2-chunking)
6. [AI Stage 3: The Knowledge Graph (Neo4j)](#6-ai-stage-3-the-knowledge-graph)
7. [AI Stage 4: Question Generation Pipeline](#7-ai-stage-4-question-generation-pipeline)
8. [AI Stage 5: The Validation Gauntlet](#8-ai-stage-5-the-validation-gauntlet)
9. [AI Stage 6: Concurrency Model (asyncio)](#9-ai-stage-6-concurrency-model)
10. [The Honest Flaws (volunteer these)](#10-the-honest-flaws)
11. [Real-Time Multiplayer (compressed)](#11-real-time-multiplayer-compressed)
12. [Data Layer (compressed)](#12-data-layer-compressed)
13. [The Master Decision Log](#13-the-master-decision-log)
14. [Brutal Q&A Bank](#14-brutal-qa-bank)
15. [Numbers to Memorize](#15-numbers-to-memorize)
16. [Final Self-Test](#16-final-self-test)

---

## 1. The Pitch

### 30-second version (memorize word-for-word)

> "Dexter is an AI-powered quiz platform for educators. A teacher uploads a PDF, a URL, or just types a topic — and my AI pipeline ingests the content, builds a knowledge graph in Neo4j, and generates validated, difficulty-calibrated quiz questions using GPT-4o-mini. The teacher reviews them, then hosts a live multiplayer session over WebSockets where students join by QR code, answer in real time with Redis-backed scoring, and results auto-sync to Google Sheets."

### 2-minute version (when they say "tell me more")

> "The core technical problem is: **LLMs produce bad quiz questions by default** — they hallucinate answers, reference 'the passage', repeat the same concept, and write giveaway distractors. My system solves this in three layers.
>
> **Layer 1 — structured knowledge.** Ingested text is chunked with a sliding-window algorithm, tagged with TF-IDF keywords, and stored as a graph in Neo4j where chunks sharing keywords get RELATED_TO edges. Every document is isolated by a UUID graph_id.
>
> **Layer 2 — grounded generation.** For each chunk, a question agent writes a question using Bloom's-taxonomy stems matched to the requested difficulty. Then an option agent writes three distractors — but crucially, it sees not just the source chunk, but the *graph neighbors*: other chunks sharing the most keywords. That's what makes distractors plausible instead of random.
>
> **Layer 3 — validation.** Every candidate question passes ~10 deterministic gates: answer must be grounded in the chunk text via fuzzy matching, no meta-references, no answer leakage, distractor similarity thresholds, and global dedup using Levenshtein distance so no two questions test the same concept. Failures retry up to 5 times with different strategies.
>
> All of this runs concurrently — an asyncio semaphore processes 6 chunks in parallel with an early-stop event, so cost scales with the number of questions requested, not document size."

---

## 2. Architecture in 60 Seconds

```
React/Vite (3000)  ──REST+WS──▶  Express/Bun (3000)  ──HTTP──▶  FastAPI AI Worker (8000)
                                      │                              │
                              PostgreSQL (5440)              Neo4j (7687)
                              Redis (6389)                   OpenAI GPT-4o-mini
                                                             Tavily Search
```

- **Frontend**: Vite + React 18 + TypeScript + Zustand + Tailwind
- **Backend**: Express 5 on Bun, Drizzle ORM → PostgreSQL, Redis for live sessions, `ws` for WebSockets
- **AI Worker**: Python FastAPI, LangChain ChatOpenAI, Neo4j graph store
- **Infra**: docker-compose runs Postgres, Redis, Neo4j; `dev.sh` boots all three services

**If asked "why three services?":** separation of concerns — the Python AI worker scales independently, has its own dependency ecosystem (LangChain, Neo4j driver, PyMuPDF), and its failure never takes down the API or the live game.

---

## 3. THE AI SYSTEM — Why Graph RAG

### The opening framing (use this when they ask "what is RAG?")

> "RAG = Retrieval-Augmented Generation. Instead of letting the LLM answer from its training data, you **retrieve** relevant source material and **inject it into the prompt**, so generation is grounded in your content. The standard implementation uses vector embeddings and similarity search. Mine uses a **keyword graph** — same RAG pattern, different retrieval mechanism."

### Why not vanilla vector RAG?

| Vector RAG weakness | How the graph solves it |
|---|---|
| Finds chunks with similar *wording* | Finds chunks sharing *concepts* via keyword edges — different wording, same idea |
| Top-k is opaque — you can't explain why a chunk was retrieved | The Cypher query literally counts shared keywords — fully explainable |
| Embedding API cost on every ingest + a vector DB to run | TF-IDF is free, deterministic, runs in-process; Neo4j already in the stack |
| Neighbors in embedding space ≠ logical neighbors | `RELATED_TO` edges are explicit relationships you can traverse and filter |

**If pushed — "would embeddings be better?":**
> "For pure retrieval recall, yes — TF-IDF misses synonyms, so 'car' and 'automobile' never link. The honest answer is the best system is hybrid: keyword edges for explainability + embedding edges for semantic recall. That's my next iteration."

### Why not fine-tuning?

> "Fine-tuning bakes knowledge into weights — it can't cite source material, it goes stale, and it costs far more than prompt-based grounding. RAG keeps the source of truth in the database, so a teacher's new PDF works instantly with zero training."

---

## 4. AI Stage 1: Ingestion

**File:** `graph_rag/app/services/ingest_service.py`, `app/core/loaders.py`, `app/core/tavily.py`

Three input types, three extractors — because teachers have materials in every format:

| Input | Extractor | Details |
|---|---|---|
| `text` | passthrough | raw pasted content |
| `url` | **BeautifulSoup** | strips `<script>`, `<style>`, `<noscript>` → clean text |
| `pdf` | **PyMuPDF (fitz)** | per-page text; if a page yields <50 chars → **OCR fallback** via `get_textpage_ocr` (handles scanned lecture slides) |
| `topic` | **Tavily Search API** | `search_depth: advanced`, 5 results, raw content — turns "Thermodynamics" into source material when the teacher has no document |

**Decisions to name-drop:**
- BeautifulSoup tag decomposition before text extraction → no JavaScript garbage in chunks
- OCR fallback threshold (<50 chars/page) → scanned PDFs still work
- Tavily instead of Google scraping → purpose-built for AI consumption, returns clean content, no rate-limit fights

---

## 5. AI Stage 2: Chunking

**File:** `graph_rag/app/services/chunking.py`

This is deterministic, classic NLP — no LLM involved. Walk them through the 4 steps:

### Step 1 — Structural split
Split text into paragraphs, then sentences via regex on `.!?`.
**Why sentence-level?** Chunk boundaries at sentence ends → no half-thoughts fed to the LLM.

### Step 2 — Hybrid sliding window
`window=3 sentences, overlap=1` → step size 2.
**Why overlap?** A definition in sentence 3 often needs its example in sentence 4. Hard cuts split concept from context; overlap=1 guarantees every sentence appears with its neighbors somewhere.

### Step 3 — Merge short chunks
Any chunk **< 60 words** merges with the next one.
**Why?** The question agent needs enough material to write a non-trivial question. A 20-word chunk produces "What is X?" trivia at best.

### Step 4 — Validation filter
A chunk is kept if:
- **≥ 40 words** (auto-accept — enough substance), OR
- **≥ 2 TF-IDF term hits** AND **stopword ratio < 0.4**

**Why?** This kills junk chunks — headers, footers, "References", page numbers — that would otherwise waste LLM calls. A chunk dense in document-salient terms with few stopwords is real content.

### TF-IDF keyword extraction
- `TfidfVectorizer(stop_words="english", max_features=10)` fit on the **full document** → the document's 10 most salient terms
- Per chunk: keep words (≥3 chars) that appear in that vocabulary → those become the chunk's `keywords`

**Why TF-IDF and not the LLM for keywords?** Free, instant, deterministic, no API cost — and you only need *salient terms* for graph edges, not semantic understanding.

**Output:** `{id: "C_<8 hex>", text, keywords[]}` per chunk.

---

## 6. AI Stage 3: The Knowledge Graph

**File:** `graph_rag/app/services/graph_store.py`, `app/main.py` (constraints)

### The graph model

```
(:Chunk {id, text, graph_id}) ──[:HAS_KEYWORD]──▶ (:Keyword {name, graph_id})
(:Chunk) ──[:RELATED_TO]──▶ (:Chunk)     ← created when two chunks share a keyword
```

### The Cypher — be able to write both queries cold

**Storage (per chunk):**
```cypher
MERGE (c:Chunk {id: $id, graph_id: $graph_id})
SET c.text = $text
WITH c
UNWIND $keywords AS kw
MERGE (k:Keyword {name: kw, graph_id: $graph_id})
MERGE (c)-[:HAS_KEYWORD {graph_id: $graph_id}]->(k)
```

**Relationship building:**
```cypher
MATCH (c1:Chunk {graph_id: $gid})-[:HAS_KEYWORD]->(k:Keyword)<-[:HAS_KEYWORD]-(c2:Chunk)
WHERE c1.id < c2.id
MERGE (c1)-[:RELATED_TO {graph_id: $gid}]->(c2)
```

### Every decision here is deliberate — know all five:

1. **`MERGE` not `CREATE`** → idempotent. Re-ingesting or retrying never creates duplicate nodes/edges. Safe by construction.
2. **Constraint `(keyword.name, keyword.graph_id) IS UNIQUE`** → "entropy" in document A and "entropy" in document B are *different nodes*. Enforced at the DB level on startup.
3. **`graph_id` = UUID per ingest** → multi-tenancy. Each document is an isolated subgraph. Two teachers' materials can never leak into each other's questions.
4. **`c1.id < c2.id`** → each pair processed once — no duplicate reciprocal edges.
5. **`graph_id` stored on edges too** → relationship traversal can filter by graph in the edge pattern, keeping queries clean and correct.

---

## 7. AI Stage 4: Question Generation Pipeline

**File:** `graph_rag/app/services/mcq_pipeline.py` — **the most important file in the project.**

### Retrieval first (the "R" in RAG)

For each chunk, the prompt is built from **three context sources**:

1. **The chunk itself** — the primary source
2. **Sequential neighbors** (window=1) — chunks immediately before/after by index → preserves narrative flow (a concept's setup is often in the previous chunk)
3. **Keyword-overlap chunks** — the query that justifies the whole graph:
```cypher
MATCH (main:Chunk {id: $id})-[:HAS_KEYWORD]->(k:Keyword)<-[:HAS_KEYWORD]-(o:Chunk)
WHERE main.id <> o.id
RETURN o.text, COUNT(DISTINCT k) AS score
ORDER BY score DESC LIMIT 3
```
> "This finds the 3 chunks sharing the **most keywords** with the source chunk, ranked by shared-keyword count. A chunk defining 'entropy' in section 1 connects to an application in section 5 — that's where good distractors live."

### Agent 1 — question_agent

- Receives: chunk text + up to 2 neighbor texts + difficulty + type
- **Bloom's-taxonomy stems injected per difficulty:**
  - *Easy* (recall): "What is…", "Which best defines…"
  - *Medium* (comprehension): "How does…", "Why does…", "What distinguishes X from…"
  - *Hard* (analysis): "Under what conditions would…", "What is the trade-off between…", "What would happen if…"
- **Strict prompt rules** (this is prompt engineering as quality control):
  - Self-contained — never say "the passage / according to the text"
  - Answer must be a **1–6 word phrase that explicitly appears in the chunk**
  - Don't reveal the answer in the question
  - Must end with `?`, no embedded option letters (A/B/C/D)
  - Factual accuracy rule: don't invert relationships
- Output format enforced: `Question: / Answer: / Explanation:` — parsed deterministically, rejected if `Answer:` missing
- `"mixed"` type randomly picks MCQ or True/False per chunk

**Why short extractive answers?** Two reasons: (1) it prevents the LLM from *inventing* an answer, and (2) it makes auto-grading exact-matchable later.

### Agent 2 — option_agent (distractor generation)

- Async LLM call, **structured JSON output** (`{"distractors": [...]}`), markdown fences stripped defensively
- Sees: question, correct answer, chunk text, **overlap texts + neighbors**
- Distractor instructions: common misconceptions, plausible to a novice, grounded in the source, match the answer's grammatical form and length, no giveaway words ("always/never/none")
- **Length-matching heuristic:** distractors should be within `[answer_words − 1, answer_words + 2]` — because test-savvy students pick the oddly-long or oddly-short option

### Three fallback strategies (know this — it shows resilience engineering)

1. **Primary:** JSON distractors with full context
2. **Retry:** "Here are the options already chosen, don't repeat them" + source text → line-per-option
3. **Fallback:** "Name N terms related to X but not the answer" — pure extraction from the chunk

Each candidate still passes `_is_valid_distractor` (see Stage 5) before entering the option set.

### Post-processing per candidate

- `clean_question_text` — strips embedded `A)`/`1.` markers and trailing option lists the LLM sometimes appends
- `strip_meta_references` — regex-removes ~20 phrases like "according to the passage", re-capitalizes
- True/False normalization — answer forced to exactly "True" or "False", options = ["True", "False"]

---

## 8. AI Stage 5: The Validation Gauntlet

> **Framing for the interview:** "The LLM proposes, deterministic code disposes. Nothing reaches the teacher without passing ~10 hard gates — I don't trust probabilistic output for an educational product."

### Per-question gates (`validate_question` + pipeline checks)

| # | Gate | Failure it prevents |
|---|---|---|
| 1 | **Answer grounding** — normalized substring, all significant words (>3 chars), or bigram must appear in chunk | Hallucinated answers |
| 2 | **Meta-reference filter** — ~20 banned phrases | "According to the text…" questions useless outside the document |
| 3 | **No option markers** in question text | "Which of A) … B) …" formatting garbage |
| 4 | **No answer leakage** — answer (if >12 chars) can't appear in the question | Giveaways |
| 5 | **Length: 5–80 words** | Trivial or bloated questions |
| 6 | **Options non-empty, distinct** | Broken MCQs |
| 7 | **Correct answer ∈ options** (fuzzy: exact/substring either direction) | Unanswerable questions |
| 8 | **≥3 content words shared with chunk** | Questions drifting off-source |
| 9 | **No "all/none of the above"** | Lazy question patterns |
| 10 | **Hard-mode reasoning gate** — must contain a reasoning word (why, how, trade-off, scenario, determines…) | Difficulty labels that lie |

### Per-distractor gates (`_is_valid_distractor`)

- 3–200 chars, no giveaway phrases ("not mentioned", "cannot be determined")
- **< 0.70 Levenshtein similarity to the answer** (too close = ambiguous)
- **< 0.80 similarity to every other distractor** (no duplicates)
- **Not a substring of the answer or vice versa** (catches "Black Box" vs "Black Box Testing")
- **Word count within range of the answer** (no odd-one-out length giveaway)

### Global dedup (across the whole quiz)

- New question **>0.75 similar** to any accepted question → reject (same question, different words)
- New answer **>0.85 similar** to any accepted answer → reject (same *concept* tested twice — True/False exempt since answers are just True/False)

> "The answer-level dedup is the subtle one — two differently-worded questions can both test 'What is the capital of France'. Question-text dedup misses that; answer dedup catches it."

### Retry economics

- **Up to 5 attempts per chunk**, each regenerating from scratch
- Failure at any gate → `continue` → fresh LLM call
- After 5 failures → chunk skipped, others continue — **graceful degradation, never a hard failure**

---

## 9. AI Stage 6: Concurrency Model

**File:** `generate_mcqs_async` in `mcq_pipeline.py`

### The mental model (say this first)

> "FastAPI runs on an asyncio event loop — one thread doing cooperative multitasking. LLM calls are 95% I/O wait, so async concurrency gives massive parallelism without threads, the GIL, or process overhead."

### FastAPI endpoint semantics (interviewers love this)

```python
@router.get("/generate/{graph_id}/{count}")
async def generate(...)          # runs ON the event loop

@router.post("/ingest")
def ingest(req: IngestRequest)   # FastAPI auto-offloads to a THREADPOOL
```

- `async def` → on the loop; must never block it
- plain `def` → run in a thread pool so blocking work (Neo4j writes, PDF parsing) can't freeze the loop

### The four primitives, and WHY each exists

```python
semaphore    = asyncio.Semaphore(6)   # max 6 chunks in-flight at once
results      = []                     # shared mutable state
results_lock = asyncio.Lock()         # guards it
done_event   = asyncio.Event()        # broadcast early-stop
```

**Semaphore(6)** — each in-flight chunk makes 2+ OpenAI calls. 6 concurrent chunks ≈ 12+ parallel API calls — high throughput without tripping rate limits or spiking cost. 7th chunk waits at `async with semaphore:` until a slot frees.

**done_event** — the cost-saver. Need 10 questions from a 50-chunk document? Once `len(results) >= limit`, one task sets the event; every other task checks `if done_event.is_set(): return` **before** spending LLM tokens. **Cost scales with questions requested, not document size.**

**results_lock** — the trap question. *"asyncio is single-threaded, why a lock?"*
> "Single-threaded ≠ race-free. Between `if len(results) < limit` and `results.append(...)`, there's an await boundary — the coroutine yields, another runs, sees the same length, and also appends. Now 11 results for a limit of 10. The lock makes check-and-append atomic across coroutines."

**`asyncio.gather(*tasks, return_exceptions=True)`** — all chunk tasks launch concurrently; one chunk's exception (timeout, bad JSON) comes back as a result object instead of killing the whole batch.

### Throughput & scaling answers

- **What limits throughput?** OpenAI rate limits → semaphore=6 → Neo4j connection pool.
- **Scale beyond one process?** Multiple uvicorn workers behind a load balancer; heavy generation jobs → task queue (Celery/Redis) with job IDs and polling/webhook completion.
- **Why not threads?** GIL + context-switch overhead; for I/O-bound work asyncio gives thousands of lightweight coroutines vs dozens of heavy threads.

---

## 10. The Honest Flaws (volunteer these — interview gold)

### Flaw 1: sync LLM call inside the async pipeline

```python
# question_agent:
resp = llm.invoke(prompt)              # BLOCKS the event loop ❌
# option_agent:
raw = await llm_async.ainvoke(prompt)  # properly async ✅
```

> "The question agent uses LangChain's synchronous client, so while it waits on OpenAI, the entire event loop stalls — other chunks can't progress during that window. The option agent correctly uses `ainvoke`. The system still works because the semaphore caps concurrent blocking at 6, but true pipelining requires migrating the question agent to async. That's my first fix."

### Flaw 2: TF-IDF misses synonyms

> "'Car' and 'automobile' never share a keyword edge, so some conceptual links are missed. The upgrade is hybrid retrieval: keep keyword edges for explainability, add embedding-cosine edges for semantic recall."

### Flaw 3: no generation caching

> "Regenerating questions for the same graph_id re-pays the API cost. A question bank keyed by (graph_id, difficulty, type) would make regeneration free."

---

## 11. Real-Time Multiplayer (compressed)

> You know full-stack — just keep these talking points sharp.

- **Session creation:** `POST /api/gateway/start-multiplayer-session` → session hash in Redis (`quiz_session:{id}`) with quizId, host, settings, maxPlayers
- **Join:** QR code → WebSocket `join_quiz` → validated against Redis, max-player check, auto team-assignment (Team A/B balancing) in team mode
- **Start:** questions loaded from Postgres → cached in Redis (`quiz_questions:{id}`) → broadcast one at a time with a server-side timer (auto-advance at timer+5s)
- **Answers:** deduped by `userId:questionId`, evaluated server-side, **speed bonus = up to +50% scaled by time remaining** (speed mode), scores via `HINCRBY` in Redis → leaderboard broadcast
- **Finish:** scores persisted to Postgres (`quizAttempts`, `answers`) → Google Sheets sync via host's OAuth2 refresh token
- **Late joiners:** receive current question + computed remaining time
- **Why Redis?** Ephemeral, sub-millisecond, purpose-built data structures (hashes/sets) — Postgres would be a bottleneck for per-answer leaderboard updates.

---

## 12. Data Layer (compressed)

**PostgreSQL (Drizzle ORM)** — the source of truth:
`users` (auth, googleId, refreshToken) · `documents` (title, type, **graphId** — the Postgres↔Neo4j bridge) · `quizzes` (settings as JSONB: timer, gameMode, googleSheetId…) · `questions` (content, type, options[], correctAnswer, explanation) · `quizAttempts` · `answers`

**Redis** — live session state:
`quiz_session:{id}` hash · `quiz_scores:{id}` hash · `quiz_players:{id}` set · `quiz_names:{id}` · `quiz_teams:{id}` · `quiz_questions:{id}` JSON

**Neo4j** — knowledge graph: Chunk/Keyword nodes, HAS_KEYWORD + RELATED_TO edges, all scoped by graph_id.

**Auth:** bcrypt passwords + JWT (`authenticateToken` middleware) + Google OAuth (refresh token stored for Sheets API).

---

## 13. The Master Decision Log

| Decision | Why |
|---|---|
| Graph RAG over vector RAG | Concept links via keywords, explainable retrieval, no embedding API cost |
| MERGE everywhere in Cypher | Idempotent retries — no duplicates by construction |
| graph_id UUID per ingest | Multi-tenant isolation of every document |
| TF-IDF keywords | Free, deterministic, salient — good enough for graph edges |
| Sliding-window chunking (3/1) | No sentence cut off from its context |
| Merge <60-word chunks | LLM needs substance to write non-trivial questions |
| Chunk validation (40w / TF-IDF hits / stopword ratio) | Kills headers/footers/junk before they cost LLM calls |
| GPT-4o-mini, temp 0.3 | Factual task — minimize hallucination per dollar |
| Bloom's stems per difficulty | Difficulty is a real spectrum, not a label |
| Extractive 1–6 word answers | Prevents invented answers + exact-matchable grading |
| 3 context sources (chunk + neighbors + overlap) | Plausible distractors need related-but-wrong material |
| 3 distractor fallback strategies | LLMs fail differently each retry — change the ask |
| ~10 deterministic validation gates | Never trust probabilistic output in an education product |
| Answer-level Levenshtein dedup (0.85) | Catches same-concept-different-wording duplicates |
| Semaphore(6) | Throughput vs OpenAI rate limits |
| done_event early-stop | Cost scales with questions requested, not doc size |
| asyncio.Lock on shared results | Check-then-append race exists across coroutines |
| gather(return_exceptions=True) | One bad chunk never kills the batch |
| Redis for live sessions | Ephemeral + sub-ms reads; Postgres is the permanent record |
| FastAPI for the AI worker | Native async + Pydantic validation + auto OpenAPI docs |

---

## 14. Brutal Q&A Bank

**"Is this really RAG? You don't use embeddings."**
> "RAG is a pattern — retrieve relevant context, augment the prompt, generate grounded output. My retrieval mechanism is graph traversal over keyword relationships instead of vector similarity, but the pattern is identical: the LLM never generates from parametric memory alone, every question is grounded in retrieved source text. Embeddings are a valid upgrade for the retrieval layer, not a different architecture."

**"How do you know generated answers are correct?"**
> "Three layers: the prompt requires an extractive 1–6 word answer from the chunk; the grounding gate verifies the answer actually appears in the chunk via fuzzy matching; and the question must share at least 3 content words with the chunk. It can't guarantee truth, but it guarantees every answer is *verifiable against the source*."

**"What stops duplicate questions?"**
> "Two-level Levenshtein dedup: >0.75 question similarity rejects reworded duplicates; >0.85 answer similarity rejects the same concept tested differently. True/False is exempt from answer dedup since all T/F answers are identical."

**"Walk me through what happens when 50 chunks need to become 10 questions."**
> "All 50 become asyncio tasks, the semaphore admits 6 at a time. Each runs the agent pipeline with up to 5 attempts. As results pass validation and dedup, they're appended under the results lock. The moment the 10th lands, done_event fires and every remaining task exits before its next LLM call — so a 50-chunk document costs roughly 10 questions' worth of tokens, not 50."

**"Why a lock in single-threaded asyncio?"**
> "Because coroutines interleave at await points. Check-then-act on shared state — read length, then append — spans an await, so two coroutines can both pass the check. The lock serializes the critical section."

**"Single point of failure analysis?"**
> "AI worker down → ingestion/generation fails, but auth, quizzes, and live sessions keep running. Redis down → no live sessions, but CRUD works. Postgres down → read-only degradation. Neo4j down → only the AI pipeline fails. The blast radius of each component is isolated by design."

**"Latency of generating 10 questions?"**
> "Bounded by the slowest of ~2 semaphore rounds of chunk processing — each chunk is 2 sequential LLM calls minimum, up to 5 attempts worst case. The early-stop event means we never wait for the full document."

**"How would you add a new question type, say fill-in-the-blank?"**
> "Add a stem set and type instruction in the question agent, a branch in post-processing (blank marker replacing the answer in the question text), reuse the same grounding and dedup gates, and extend the type enum in the Postgres schema and Zod validator. The pipeline's gate architecture means new types inherit all existing quality controls."

---

## 15. Numbers to Memorize

| Number | What |
|---|---|
| **6** | Semaphore — max concurrent chunks |
| **5** | Max attempts per chunk |
| **3** | Sentences per chunk (window) |
| **1** | Sentence overlap between chunks |
| **60** | Words — below this, chunks merge |
| **40** | Words — at/above this, chunk auto-accepted |
| **10** | TF-IDF top terms per document |
| **0.3** | LLM temperature |
| **0.75** | Question dedup similarity threshold |
| **0.85** | Answer dedup threshold |
| **0.70 / 0.80** | Distractor similarity limits (vs answer / vs each other) |
| **3** | Keyword-overlap chunks fetched (LIMIT 3) |
| **5–80** | Allowed question word count |
| **1–6** | Ideal answer word count |
| **8000 / 3000 / 5173** | Ports: AI worker / backend / frontend dev |
| **5440 / 6389 / 7687** | Ports: Postgres / Redis / Neo4j bolt |

---

## 16. Final Self-Test

Say each answer out loud, no notes. Any stumble → re-read that section only.

1. The 30-second pitch.
2. End-to-end flow: PDF upload → graded quiz, every service touched.
3. Why graph over vector RAG — three reasons.
4. Write the keyword-overlap Cypher query from memory and explain what it returns.
5. Name 6 of the 10 validation gates and what each prevents.
6. Explain the answer-level dedup and why question-level dedup isn't enough.
7. Explain semaphore + done_event + results_lock — and the trap answer for the lock.
8. Volunteer both flaws: sync question agent, TF-IDF synonym blindness — with fixes.
9. "Scale the generation pipeline 10x" → workers + task queue + question-bank caching.
10. "Hardest bug you fixed?" → have one concrete story ready (validation loop, dedup race, or WebSocket session sync).

**If you pass all 10 — walk in and take the job.** 💪
