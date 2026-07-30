# DEXTER — Complete Interview Prep Guide

> Everything you need to explain any aspect of this project in an interview.
> Read this cover to cover and you can answer any question.

---

## TABLE OF CONTENTS

1. [What is Dexter? (30-second pitch)](#1-what-is-dexter-30-second-pitch)
2. [High-Level Architecture](#2-high-level-architecture)
3. [End-to-End Data Flow](#3-end-to-end-data-flow)
4. [Component Deep-Dives](#4-component-deep-dives)
   - [4.1 Frontend (web/)](#41-frontend-web)
   - [4.2 Backend (backend/)](#42-backend-backend)
   - [4.3 AI Worker (graph_rag/)](#43-ai-worker-graph_rag)
5. [Database Schema](#5-database-schema)
6. [Real-Time Multiplayer Quiz System](#6-real-time-multiplayer-quiz-system)
7. [AI Pipeline — Ingestion & Question Generation](#7-ai-pipeline--ingestion--question-generation)
8. [Technology Choices — Why Each One](#8-technology-choices--why-each-one)
9. [Game Modes & Settings](#9-game-modes--settings)
10. [Authentication & Security](#10-authentication--security)
11. [Google Sheets Integration](#11-google-sheets-integration)
12. [Edge Cases & Design Decisions](#12-edge-cases--design-decisions)
13. [Sample Interview Q&A](#13-sample-interview-qa)
14. [Known Weaknesses & Future Work](#14-known-weaknesses--future-work)

---

## 1. What is Dexter? (30-second pitch)

> **"Dexter is an AI-powered quiz platform for educators. A teacher uploads course materials — PDFs, URLs, or just types a topic — and Dexter automatically ingests the content, generates high-quality MCQs and True/False questions using GPT-4o-mini, stores them in a Neo4j knowledge graph for semantic relationships, and lets the teacher host a live multiplayer quiz session. Students join via QR code from any device, answer in real-time via WebSocket, get instant grading with speed bonuses, and scores auto-sync to Google Sheets."**

**One-liner:** Turn any content into interactive, auto-graded live quizzes.

**Problem it solves:** Teachers spend hours writing quiz questions. Dexter automates question generation and adds live engagement + auto-grading.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (web/)                       │
│              Vite + React 18 + TypeScript + Tailwind         │
│     Port 3000 (prod) / 5173 (dev) — Serves the SPA          │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST (fetch) + WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND (backend/)                    │
│            Express 5 + Bun + TypeScript + Drizzle ORM        │
│                   Port 3000                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL   │  │    Redis     │  │  WebSocket   │       │
│  │  (Drizzle)    │  │  (Sessions)  │  │  (ws)        │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP (axios)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI WORKER (graph_rag/)                  │
│              FastAPI + Python + GPT-4o-mini + Neo4j          │
│                       Port 8000                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Neo4j      │  │   OpenAI     │  │   Tavily     │       │
│  │  (Graph DB)   │  │  (GPT-4o-mini)│  │  (Web Search)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

**Infrastructure (Docker Compose):**
- **PostgreSQL** (port 5440) — persistent data (users, quizzes, questions, attempts)
- **Redis** (port 6389) — real-time quiz sessions, scores, timers
- **Neo4j** (ports 7474/7687) — knowledge graph for chunk relationships

---

## 3. End-to-End Data Flow

This is the most important thing to explain. Walk through this step by step:

### Step 1: Teacher Creates Quiz
- Teacher fills in title, topic, difficulty, question count on **CreateQuizPage**
- Uploads PDF files or pastes URLs, or picks from saved library
- Frontend sends to **Backend** → `POST /api/graph-rag/ingest`

### Step 2: Content Ingestion (AI Worker)
- Backend proxies to **Python AI Worker** → `POST /api/ingest`
- Python extracts text:
  - **URL**: BeautifulSoup scrapes and cleans HTML
  - **PDF**: PyMuPDF extracts text (with OCR fallback for scanned pages)
  - **Topic**: Tavily API does web search and returns content
- Text is **chunked**:
  - Split into sentences → sliding-window hybrid chunks (window=3, overlap=1)
  - Short chunks merged (min 60 words)
  - TF-IDF extracts top 10 important terms per document
  - Keywords tagged per chunk
- Stored in **Neo4j**:
  - `(:Chunk {id, text, graph_id})` nodes
  - `(:Keyword {name, graph_id})` nodes
  - `(:Chunk)-[:HAS_KEYWORD]->(:Keyword)` edges
  - `(:Chunk)-[:RELATED_TO]->(:Chunk)` edges between chunks sharing keywords
- Returns `graph_id` to backend → saved in PostgreSQL `documents` table

### Step 3: Question Generation (AI Worker)
- Backend calls → `GET /api/generate/{graph_id}/{count}?difficulty=medium&type=mcq`
- Python pipeline runs (see Section 7 for details):
  - Fetches chunks from Neo4j
  - Processes 6 chunks concurrently (semaphore)
  - Each chunk → question_agent writes question → option_agent writes distractors → validation
  - Stops when requested count reached
- Returns array of MCQs with question, options, answer, explanation

### Step 4: Teacher Reviews
- Questions displayed on frontend with edit capability
- **Batch refine**: Teacher types "make harder" → `POST /api/refine-batch` → GPT-4o-mini rewrites all questions
- Configure settings: timer, game mode, leaderboard, shuffle, Google Sheet ID
- Quiz saved to PostgreSQL → `POST /api/quizzes`

### Step 5: Host Live Session
- Teacher clicks "Host" → `POST /api/gateway/start-multiplayer-session`
- Backend creates session in **Redis** (sessionId, quizId, hostUserId, settings)
- Generates **QR code** — students scan to join
- Students connect via **WebSocket** → `join_quiz` message

### Step 6: Live Gameplay
- Host starts quiz → `start_quiz` WebSocket message
- Questions fetched from PostgreSQL, cached in Redis, delivered one at a time
- Each question has a **timer** (default 30s, configurable)
- Players submit answers → `submit_answer` → server evaluates:
  - Correct: base points + speed bonus (Speed Run mode)
  - Incorrect: 0 points
- Scores updated in **Redis** and broadcast to all participants
- Leaderboard updates in real-time

### Step 7: Auto-Grading & Export
- Quiz ends → scores persisted to PostgreSQL (`quizAttempts` + `answers`)
- If Google Sheet ID configured → auto-syncs scores via **Google Sheets API** (OAuth2)
- Teacher can also manually sync from dashboard

---

## 4. Component Deep-Dives

### 4.1 Frontend (web/)

**Stack:** Vite + React 18 + TypeScript + Tailwind CSS + Framer Motion

**Key Libraries:**
- `react-router-dom` — SPA routing
- `zustand` — state management (quizStore)
- `framer-motion` — animations
- `html5-qrcode` — QR code scanning for joining quizzes
- `qrcode.react` — QR code generation for hosting
- `@react-oauth/google` — Google OAuth login
- `three` — 3D shader effects on landing page
- `sonner` — toast notifications

**Pages:**
| Page | Purpose |
|------|---------|
| `LandingPage.tsx` | Marketing page — hero, features, pricing, testimonials |
| `LoginPage.tsx` / `SignupPage.tsx` | Auth (email/password + Google OAuth) |
| `DashboardPage.tsx` | Quiz library, stats, knowledge base |
| `CreateQuizPage.tsx` | 4-step wizard: Details → Resources → Questions → Settings |
| `HostQuizPage.tsx` | Live hosting interface with QR code and leaderboard |
| `JoinQuizPage.tsx` | Student joins via QR code or session code |
| `QuizRoomPage.tsx` | Live quiz room — answer questions, see scores |
| `CalendarPage.tsx` | Schedule/view quizzes |

**State Management (`quizStore.ts` — Zustand):**
- Manages multi-step quiz creation flow (step 1-4)
- Stores formData (title, topic, difficulty, questions, settings)
- Handles ingestion status, question generation, quiz saving

**WebSocket Service (`websocketService.ts`):**
- `WebSocketManager` class — singleton pattern
- Auto-reconnect (5 attempts, 3s interval)
- Event subscription pattern (`subscribe`/`unsubscribe`)
- Methods: `joinQuiz`, `submitAnswer`, `startQuiz`, `nextQuestion`, `leaveQuiz`

**API Services (layered architecture):**
```
services/
├── api/
│   ├── auth/authService.ts      — login, signup, Google OAuth, token refresh
│   ├── quiz/quizService.ts      — CRUD quizzes, get results
│   ├── answer/answerService.ts  — submit answers
│   ├── document/documentService.ts — upload/process documents
│   ├── gateway/gatewayService.ts — createQuizWithAI, startMultiplayer
│   ├── ai/aiService.ts          — AI-related calls
│   ├── utils/requestHandler.ts  — fetch wrapper with auth headers
│   ├── utils/errorHandler.ts    — centralized error handling
│   └── utils/responseHandler.ts — response normalization
├── websocketService.ts          — WebSocket manager
└── authService.ts               — legacy auth (being phased out)
```

**Custom Hooks:**
- `useQuiz.ts` — fetch/create quizzes
- `useAuth.ts` — authentication state
- `useDocument.ts` — file upload
- `useAnswer.ts` — answer submission
- `useWebSocket.ts` — WebSocket connection

---

### 4.2 Backend (backend/)

**Stack:** Express 5 + Bun + TypeScript + Drizzle ORM + PostgreSQL + Redis

**Entry Point (`src/index.ts`):**
- Creates Express app + HTTP server
- Mounts routes: `/api/users`, `/api/auth`, `/api/quizzes`, `/api/answers`, `/api/gateway`, `/api/documents`, `/api/graph-rag`, `/api/stats`
- Sets up WebSocket server on same HTTP server
- CORS configured for frontend origins

**Database Layer:**
- `src/db/index.ts` — PostgreSQL connection pool via `pg` driver
- `src/db/schema.ts` — Drizzle ORM schema definitions
- `drizzle.config.ts` — migration configuration
- `drizzle/` — generated migrations (6 snapshots)

**Services:**

| Service | Purpose |
|---------|---------|
| `GraphRagService.ts` | Proxies to Python AI worker (ingest, generate, refine) |
| `RedisQuizService.ts` | Real-time session management (scores, players, teams, settings) |
| `QuizService.ts` | CRUD for quizzes and questions (PostgreSQL) |
| `QuizAttemptService.ts` | Tracks attempts, answer submissions, score calculation |
| `GoogleSheetsService.ts` | OAuth2 + Google Sheets API export |
| `APIGatewayService.ts` | Orchestrates AI pipeline: ingest → generate → create quiz |
| `AIWorkerService.ts` | Legacy (partially disabled) |

**Controllers:**
| Controller | Routes Handled |
|-----------|---------------|
| `authController.ts` | Login, signup, Google OAuth callback |
| `quizController.ts` | CRUD quizzes, get results, sync to sheets |
| `graphRagController.ts` | Ingest, generate, refine, get stored graphs |
| `apiGatewayController.ts` | createQuizWithAI, startMultiplayerSession |
| `answerController.ts` | Answer submission |
| `statsController.ts` | Dashboard stats |
| `userController.ts` | User profile management |

**Middleware:**
- `auth.ts` — JWT verification (`authenticateToken`) — extracts `userId` from Bearer token

**Utils:**
- `password.ts` — bcrypt hashing/compare
- `jwt.ts` — JWT sign/verify

---

### 4.3 AI Worker (graph_rag/)

**Stack:** FastAPI + Python + LangChain + OpenAI (GPT-4o-mini) + Neo4j + Tavily

**Entry Point (`app/main.py`):**
- FastAPI app with CORS
- Startup: creates Neo4j constraints (unique keyword per graph)
- Routes: `/api/ingest`, `/api/generate/{graph_id}/{count}`, `/api/refine-batch`, `/ping`

**Core Modules:**

| Module | Purpose |
|--------|---------|
| `core/neo4j.py` | Neo4j driver singleton (env vars: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD) |
| `core/llm.py` | ChatOpenAI instances (sync + async) — gpt-4o-mini, temperature=0.3 |
| `core/loaders.py` | Text extraction: URL (BeautifulSoup), PDF (PyMuPDF + OCR fallback) |
| `core/tavily.py` | Web search via Tavily API (for "topic" input type) |

**Services:**

| Service | Purpose |
|---------|---------|
| `ingest_service.py` | Routes input to correct text extractor |
| `chunking.py` | Sliding-window chunking + TF-IDF keywords + validation |
| `graph_store.py` | Stores chunks/keywords in Neo4j, creates RELATED_TO edges |
| `mcq_pipeline.py` | Multi-step LLM question generation pipeline |

**Schemas (Pydantic):**
- `IngestRequest` — `{input_type: "text"|"url"|"pdf"|"topic", value: str}`
- `IngestResponse` — `{status: str, chunks: int, graph_id: str}`

---

## 5. Database Schema

### PostgreSQL (Drizzle ORM)

```typescript
// users — authentication and profile
users: {
  id: serial PK,
  username: varchar(50) UNIQUE,
  email: varchar(100) UNIQUE,
  password: text (nullable for Google OAuth users),
  googleId: varchar(255) UNIQUE,
  avatarUrl: varchar(255),
  refreshToken: varchar(255),  // Google OAuth refresh token
  bio: text,
  createdAt, updatedAt
}

// documents — knowledge base (ingested sources)
documents: {
  id: serial PK,
  title: varchar(255),
  sourceValue: text,        // original URL, filename, or topic
  type: varchar(20),        // 'url' | 'pdf' | 'topic'
  graphId: varchar(255),    // Neo4j graph ID
  userId: FK → users.id,
  createdAt
}

// quizzes — quiz definitions
quizzes: {
  id: serial PK,
  title: varchar(255),
  description: text,
  userId: FK → users.id,
  graphId: varchar(255),    // link to knowledge graph
  isActive: boolean,
  maxParticipants: integer (default 10),
  settings: jsonb,          // {timer, gameMode, showLeaderboard, shuffleQuestions, showTeacherNotes, googleSheetId}
  createdAt, updatedAt
}

// questions — individual questions per quiz
questions: {
  id: serial PK,
  quizId: FK → quizzes.id,
  content: text,
  type: 'mcq' | 'tf' | 'short_answer',
  correctAnswer: text,
  options: text[],          // MCQ options
  explanation: text,        // AI explanation
  source: text,             // source material reference
  points: integer (default 1),
  createdAt
}

// quizAttempts — tracks each user's attempt
quizAttempts: {
  id: serial PK,
  quizId: FK → quizzes.id,
  userId: FK → users.id,
  score: integer (nullable until completed),
  totalScore: integer,
  completedAt: timestamp (nullable),
  createdAt
}

// answers — individual answers per attempt
answers: {
  id: serial PK,
  attemptId: FK → quizAttempts.id,
  questionId: FK → questions.id,
  content: text,
  isCorrect: boolean (nullable until evaluated),
  pointsAwarded: integer (nullable),
  answeredAt: timestamp
}
```

### Neo4j Graph Model

```
(:Chunk {id: "C_a1b2c3d4", text: "...", graph_id: "uuid"})
  ├─[:HAS_KEYWORD {graph_id: "uuid"}]→ (:Keyword {name: "entropy", graph_id: "uuid"})
  └─[:RELATED_TO {graph_id: "uuid"}]→ (:Chunk {id: "C_e5f6g7h8", ...})

Constraints:
  - (k:Keyword) REQUIRE (k.name, k.graph_id) IS UNIQUE
```

**Key insight:** `graph_id` isolates each ingested document. Multiple documents can coexist in Neo4j without cross-contamination.

### Redis Keys (Real-Time Sessions)

```
quiz_session:{sessionId}     — hash: {id, quizId, hostUserId, currentQuestionIndex, participantCount, isActive, startTime, maxPlayers, settings}
quiz_scores:{sessionId}      — hash: {userId: score}
quiz_names:{sessionId}       — hash: {userId: userName}
quiz_players:{sessionId}     — set: {userId, ...}
quiz_teams:{sessionId}       — hash: {userId: teamName}
quiz_questions:{sessionId}   — string: JSON array of questions
```

---

## 6. Real-Time Multiplayer Quiz System

### WebSocket Protocol

**Connection:** Client connects to `ws://localhost:3001` (same port as HTTP server)

**Message Types:**

| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| `join_quiz` | Client → Server | `{sessionId, userId, userName}` | Join a quiz session |
| `joined_quiz` | Server → Client | `{sessionId, participantCount, isHost, currentQuestion, settings, team?}` | Confirmation |
| `start_quiz` | Client → Server | `{sessionId}` | Host starts quiz |
| `quiz_started` | Server → All | `{sessionId, startTime, totalQuestions}` | Notify all participants |
| `next_question` | Server → All | `{sessionId, currentQuestionIndex, question, timer}` | Deliver next question |
| `submit_answer` | Client → Server | `{sessionId, userId, questionId, answer}` | Player submits answer |
| `answer_submitted` | Server → Client | `{questionId, isCorrect, newScore, explanation?, speedBonus?}` | Evaluation result |
| `scores_update` | Server → All | `{sessionId, scores, teamScores?}` | Leaderboard update |
| `participant_joined` | Server → Others | `{userId, participantCount}` | New player joined |
| `participant_left` | Server → Others | `{userId, participantCount}` | Player left |
| `leave_quiz` | Client → Server | `{sessionId, userId}` | Player leaves |
| `quiz_finished` | Server → All | `{sessionId}` | Quiz ended |

### Session Flow

```
1. Host creates session → Redis stores session data
2. Students scan QR → connect WebSocket → join_quiz
3. Server validates session → checks max participants → adds to Redis set
4. Team mode: auto-assigns to Team A or Team B (whichever has fewer)
5. Host sends start_quiz → server fetches questions from Postgres
6. Questions cached in Redis → first question broadcast
7. Timer starts (default 30s) → auto-advances after timer + 5s buffer
8. Players submit answers → server evaluates → updates Redis scores
9. Leaderboard broadcast to all participants
10. Repeat until all questions done → quiz_finished
11. Scores persisted to Postgres → Google Sheets sync (if configured)
```

### Scoring System

- **Base points:** `question.points` (default 10)
- **Speed Run bonus:** Up to 50% extra based on time remaining
  - `speedBonus = (timeRemaining / timerDuration) * (basePoints * 0.5)`
- **Team mode:** Individual scores aggregated into team totals

---

## 7. AI Pipeline — Ingestion & Question Generation

### Ingestion Pipeline

```
Input (text/url/pdf/topic)
    │
    ▼
┌─────────────────┐
│  Text Extraction │  URL → BeautifulSoup, PDF → PyMuPDF, Topic → Tavily
└────────┬────────┘
         ▼
┌─────────────────┐
│   Chunking       │  Sentences → sliding window (3 sentences, 1 overlap)
│                  │  Merge short chunks (< 60 words)
│                  │  Validate: ≥ 40 words OR ≥ 2 TF-IDF hits + < 40% stopwords
└────────┬────────┘
         ▼
┌─────────────────┐
│  Keyword Extract │  TF-IDF top 10 terms per document
│                  │  Filter words ≥ 3 chars that match important terms
└────────┬────────┘
         ▼
┌─────────────────┐
│  Neo4j Storage   │  MERGE Chunk nodes, Keyword nodes, HAS_KEYWORD edges
│                  │  Create RELATED_TO edges between chunks sharing keywords
└─────────────────┘
```

### Question Generation Pipeline (mcq_pipeline.py)

This is the most technically interesting part — study this:

**Step 1: Fetch Chunks**
- Query Neo4j for all `Chunk` nodes with matching `graph_id`
- Each chunk has `id` and `text`

**Step 2: Concurrent Processing**
- `asyncio.Semaphore(6)` — processes 6 chunks concurrently
- `asyncio.Event` — stops all tasks when `limit` questions reached

**Step 3: Per-Chunk Processing (up to 5 retries)**

```
┌──────────────────┐
│  question_agent   │  LLM writes question + answer + explanation
│  (sync LLM call)  │  Difficulty-based stems (Bloom's taxonomy)
│                   │  Type: MCQ (4 options) or True/False
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Answer Grounding │  Check answer appears in chunk text (fuzzy match)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  option_agent     │  LLM generates 3 wrong but plausible distractors
│  (async LLM call) │  Uses chunk text + overlap texts from Neo4j
│                   │  3 retry strategies if < 4 options
└────────┬─────────┘
         ▼
┌──────────────────┐
│  validate_question│  Quality gates:
│                   │  - No meta-references ("according to the text")
│                   │  - No option markers (A), B), etc.)
│                   │  - Answer not revealed in question
│                   │  - 5-80 words
│                   │  - Options non-empty, distinct
│                   │  - Correct answer in options (fuzzy)
│                   │  - ≥ 3 content words shared with chunk
│                   │  - Answer grounded in chunk
│                   │  - No "all/none of the above"
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Hard difficulty  │  Must contain reasoning words
│  check            │  (why, how, best, most, critical, trade-off, etc.)
└────────┬─────────┘
         ▼
     ACCEPTED ✅
```

**Step 4: Deduplication**
- Questions: reject if > 75% similar to existing (Levenshtein)
- Answers: reject if > 85% similar to existing (prevents testing same concept twice)

**Bloom's Taxonomy Difficulty:**

| Level | Stems | Example |
|-------|-------|---------|
| Easy | "What is", "Which defines", "What is the meaning of" | Recall/definition |
| Medium | "How does", "Why does", "What distinguishes" | Comprehension |
| Hard | "Under what conditions", "What would happen if", "What is the trade-off" | Analysis/evaluation |

**Distractor Quality Rules:**
- Must not contain correct answer
- Must not be > 70% similar to correct answer
- Must not be > 80% similar to other distractors
- Must match grammatical style and approximate length
- No giveaway words ("always", "never", "all", "none")
- Must be factually grounded in the content

### Batch Refinement (`/api/refine-batch`)

- Teacher provides instruction: "make harder", "focus on edge cases"
- Each question sent to GPT-4o-mini with instruction
- Returns refined question, options, correct answer, explanation
- Preserves original structure (id, isCorrect flags)

---

## 8. Technology Choices — Why Each One

| Technology | Why It Was Chosen | Alternative Considered |
|-----------|-------------------|----------------------|
| **Neo4j** | Graph relationships enable "overlap texts" — finding semantically connected chunks through shared keywords. Vector DBs only find similar language; graphs find conceptual connections. | Pinecone/Weaviate (vector-only), PostgreSQL (no graph) |
| **GPT-4o-mini** | Good quality-to-cost ratio. Low temperature (0.3) reduces hallucination for factual quiz questions. | GPT-4 (more expensive, slower), Claude (different API) |
| **Redis** | In-memory = sub-millisecond reads for real-time leaderboard. Quiz sessions are ephemeral — Redis is perfect. | In-memory Map (doesn't scale), PostgreSQL (too slow for real-time) |
| **Bun** | Fast all-in-one JS runtime. Faster startup than Node for dev. Compatible with npm packages. | Node.js (slower), Deno (less ecosystem) |
| **Drizzle ORM** | Lightweight, type-safe, SQL-like syntax. No heavy abstractions. Better DX than Prisma for this scale. | Prisma (heavier), raw SQL (less safe) |
| **WebSocket** | Real-time bidirectional communication essential for live quizzes. Polling would be too slow. | HTTP polling (latency), SSE (server→client only) |
| **FastAPI** | Async Python, auto-generated OpenAPI docs, Pydantic validation. Perfect for AI pipeline. | Flask (sync), Django (too heavy) |
| **Tavily** | Purpose-built for AI search — returns clean, relevant content. Better than raw Google scraping. | Google Custom Search (rate limits), SerpAPI (expensive) |
| **Vite** | Instant HMR, fast builds. Much faster than Create React App. | CRA (slow), Next.js (overkill for SPA) |
| **Tailwind CSS** | Utility-first, rapid prototyping, consistent design system. | CSS modules (more boilerplate), styled-components (runtime cost) |
| **Zustand** | Lightweight state management. Less boilerplate than Redux. Perfect for multi-step form state. | Redux (too heavy), Context API (re-render issues) |

---

## 9. Game Modes & Settings

### Game Modes

| Mode | Description | Scoring |
|------|-------------|---------|
| **Classic** | Standard quiz — answer questions, get points | Base points per correct answer |
| **Speed Run** | Faster answers = more points | Base + up to 50% speed bonus |
| **Team** | Players auto-assigned to Team A/B | Individual scores → team totals |

### Quiz Settings (stored in `settings` JSONB)

```typescript
{
  timer: number,              // seconds per question (10-120, default 30)
  participantLimit: number,   // max players (default 50)
  showLeaderboard: boolean,   // show scores after each question
  shuffleQuestions: boolean,  // randomize question order
  showTeacherNotes: boolean,  // show AI explanations to students
  gameMode: 'classic' | 'team' | 'speed',
  googleSheetId: string       // optional — auto-sync scores
}
```

---

## 10. Authentication & Security

### Auth Flow

1. **Email/Password:**
   - Signup: `bcrypt.hash(password)` → store in `users.password`
   - Login: `bcrypt.compare()` → return JWT
2. **Google OAuth:**
   - Frontend: `@react-oauth/google` → Google login popup
   - Backend: exchange code for tokens → store `refreshToken` in `users.refreshToken`
   - `password` field is nullable for OAuth users

### JWT

- Signed with secret key, contains `{userId}`
- Sent as `Authorization: Bearer <token>` header
- Verified by `authenticateToken` middleware
- Extracts `userId` → attaches to `req.userId`

### Security Measures

- **bcrypt** for password hashing (cost factor 10+)
- **JWT** with expiration
- **CORS** restricted to frontend origins
- **Zod** validation on all API inputs
- **SQL injection** prevented by Drizzle ORM parameterized queries
- **Google OAuth** refresh tokens stored securely

---

## 11. Google Sheets Integration

### Flow

1. Teacher authenticates with Google (OAuth2) → `refreshToken` stored in `users.refreshToken`
2. Teacher provides Google Sheet ID in quiz settings
3. On quiz finish (or manual sync):
   - Backend retrieves host's `refreshToken`
   - Creates OAuth2 client → refreshes access token
   - Calls Google Sheets API:
     - Verifies sheet access
     - Checks if headers exist (adds if not)
     - Appends score rows: `[timestamp, quizName, sessionId, userId, userName, score]`

### Error Handling

- No refresh token → "Please authenticate with Google"
- Expired token → "Please re-authenticate"
- Sheet not found (404) → "Check the Sheet ID"
- Access denied (403) → "Check the Google Sheets permission box"

---

## 12. Edge Cases & Design Decisions

### AI Pipeline Edge Cases

| Edge Case | How It's Handled |
|-----------|-----------------|
| LLM returns garbage | Up to 5 retries per chunk |
| Not enough distractors | 3 retry strategies: more context → related terms → fallback |
| Answer not in chunk | Fuzzy matching (substring, all significant words, bigrams) |
| Duplicate questions | Levenshtein similarity > 75% rejected |
| Same concept tested twice | Answer similarity > 85% rejected |
| Meta-references | Filtered: "according to the passage", "the text says" |
| Question reveals answer | Rejected if correct answer appears in question text |
| Too short/long questions | Rejected: < 5 words or > 80 words |

### Real-Time Edge Cases

| Edge Case | How It's Handled |
|-----------|-----------------|
| Player joins mid-quiz | Receives current question + remaining time |
| WebSocket disconnects | Auto-reconnect (5 attempts, 3s interval) |
| Session full | Rejected with "Maximum participants reached" |
| Duplicate answer submission | Deduplicated by `{userId}:{questionId}` key |
| Host disconnects | Session persists in Redis, other players continue |
| Timer expires | Auto-advances to next question after 5s buffer |

### Data Consistency

- **PostgreSQL** = source of truth (persistent)
- **Redis** = real-time state (ephemeral)
- **Neo4j** = knowledge graph (isolated per graph_id)
- Scores: Redis (real-time) → PostgreSQL (persisted on quiz end)

---

## 13. Sample Interview Q&A

### "What does this project do?"

> "Dexter is an AI-powered quiz platform. Teachers upload course materials — PDFs, URLs, or topics — and our AI automatically generates quiz questions using GPT-4o-mini. The questions are stored in a Neo4j knowledge graph for semantic relationships. Teachers host live multiplayer quiz sessions where students join via QR code, answer in real-time via WebSocket, get instant grading, and scores auto-sync to Google Sheets."

### "Walk me through the architecture."

> "Three-tier architecture. Frontend is Vite + React 18 + TypeScript with Tailwind — it handles the UI, quiz creation wizard, and WebSocket connections. Backend is Express 5 with Bun runtime — it handles REST APIs, PostgreSQL via Drizzle ORM for persistence, Redis for real-time session state, and WebSocket for live gameplay. The AI worker is FastAPI + Python — it handles content ingestion from URLs/PDFs/topics, chunks text, stores it in Neo4j, and generates questions using a multi-step LLM pipeline with GPT-4o-mini."

### "Why did you use a graph database?"

> "Simple vector similarity only finds chunks that use similar language. Neo4j's graph lets us find semantically connected chunks through shared keywords. When generating distractors, we pull 'overlap texts' — chunks that share keywords with the source chunk — which gives us better context for creating plausible wrong answers. Each document is isolated by `graph_id` so multiple documents don't cross-contaminate."

### "How does the AI generate questions?"

> "It's a multi-step LLM pipeline. First, `question_agent` writes the question stem using difficulty-appropriate Bloom's taxonomy stems — 'What is' for easy, 'Why does' for medium, 'Under what conditions' for hard. Then `option_agent` generates 3 wrong but plausible distractors using the chunk text plus overlapping chunks from Neo4j. Each question goes through validation — we check the answer is grounded in the chunk, no meta-references like 'according to the text', no duplicate concepts, and the question isn't too similar to existing ones. We process 6 chunks concurrently with an asyncio semaphore and stop when we reach the requested count."

### "How does the live quiz work?"

> "When a host clicks start, we create a session in Redis with quiz metadata. The frontend connects via WebSocket. Questions are fetched from PostgreSQL, cached in Redis, and delivered one at a time with a configurable timer. Players submit answers which are evaluated server-side — for Speed Run mode, we calculate time-based bonus points up to 50% extra. Scores update in Redis and are broadcast to all participants in real-time. When the quiz ends, scores are persisted to PostgreSQL and auto-synced to Google Sheets via OAuth2."

### "What was the hardest technical challenge?"

> "The question generation quality. Getting LLMs to consistently produce good quiz questions is hard — they hallucinate, use meta-references like 'according to the passage', or produce duplicate concepts. We solved this with a multi-layer validation pipeline: answer grounding checks, meta-reference filtering, Levenshtein deduplication, distractor quality rules, and difficulty-appropriate Bloom's stems. We also implemented concurrent processing with early stopping to keep latency low."

### "How do you handle scale?"

> "Backend runs on Bun which is fast. The AI worker uses async Python with semaphore concurrency. Redis handles real-time state in-memory. PostgreSQL is indexed on foreign keys. The WebSocket server uses the same HTTP server, so we don't need a separate port. For horizontal scaling, we'd add Redis clustering and load balance the WebSocket connections with sticky sessions."

### "What would you improve?"

> "Support for multiple LLM providers (Claude, Gemini), more comprehensive test coverage, production deployment configs, rate limiting on AI endpoints, caching of generated questions, and better error recovery in the WebSocket layer."

---

## 14. Known Weaknesses & Future Work

### Current Limitations

- **Single LLM provider** — hardcoded to OpenAI GPT-4o-mini
- **No question caching** — regenerating same content costs API calls
- **Limited test coverage** — only a few test files exist
- **Local-focused configs** — environment variables assume localhost
- **No rate limiting** — AI endpoints could be abused
- **No horizontal scaling** — WebSocket sessions are in-memory per server
- **Legacy code** — some AI worker endpoints are disabled/commented out

### Future Improvements

- **Multi-LLM support** — Claude, Gemini, local models
- **Question bank** — cache generated questions per graph_id
- **Comprehensive tests** — unit + integration + E2E
- **Production deployment** — Docker, CI/CD, monitoring
- **Rate limiting** — per-user API quotas
- **Horizontal scaling** — Redis pub/sub for cross-server WebSocket broadcast
- **Question difficulty auto-calibration** — based on student performance data
- **Mobile app** — React Native or PWA

---

## Quick Reference Card

| Question | Answer |
|----------|--------|
| **What is it?** | AI-powered quiz platform for educators |
| **Frontend?** | Vite + React 18 + TypeScript + Tailwind |
| **Backend?** | Express 5 + Bun + PostgreSQL (Drizzle) + Redis |
| **AI Worker?** | FastAPI + Python + GPT-4o-mini + Neo4j |
| **Database?** | PostgreSQL (persistent) + Redis (sessions) + Neo4j (knowledge graph) |
| **Real-time?** | WebSocket (ws library) |
| **LLM?** | GPT-4o-mini, temperature 0.3 |
| **Auth?** | JWT + bcrypt + Google OAuth |
| **Export?** | Google Sheets API (OAuth2) |
| **Dev startup?** | `docker-compose up -d` → `dev.sh` |
| **Ports?** | Frontend 3000/5173, Backend 3000, AI Worker 8000, Postgres 5440, Redis 6389, Neo4j 7474/7687 |

---

*Generated from codebase analysis. Read this before your interview and you can answer any question about Dexter.*
