# MultiCoder

A real-time collaborative code editor with sandboxed execution, AI-powered code review, and plagiarism detection. Built as a full-stack portfolio project demonstrating real-time communication (ShareDB + WebSockets), layered architecture, OAuth + JWT auth, structured LLM output, and classic algorithms (Rabin-Karp + winnowing).

## What it does

- **Live multi-cursor editing** — open the same room URL in two tabs and watch edits sync via Operational Transformation (ShareDB JSON0 + Monaco)
- **GitHub OAuth login** — JWT in HTTP-only cookie, verified on both REST calls and WebSocket upgrades
- **AI code review** — Gemini Flash returns structured JSON (time complexity, suggestions, bugs with line+severity, security concerns, 1-100 score), streamed token-by-token via Server-Sent Events
- **Plagiarism detection** — Rabin-Karp k-grams + winnowing fingerprints, Jaccard similarity against everyone's submitted snippets
- **Room history** — manual snapshot save + restore, with retention pruning
- **Code execution** *(Phase 2C — code-complete, runtime blocked: see [§Code execution](#code-execution))*

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript, Monaco Editor, react-router |
| Real-time | ShareDB (json0 OT) over `ws` with JWT-authed upgrades |
| Backend | Node 20 + Express + TypeScript (strict, ES2022, NodeNext) |
| Database | PostgreSQL (Neon free tier in dev) via Prisma |
| Auth | GitHub OAuth 2.0 (hand-rolled, no Passport) + JWT in HTTP-only cookie |
| AI review | Google Gemini (`gemini-flash-latest`) with structured `responseSchema` JSON output |
| Plagiarism | Custom: language-aware normalizer → Rabin-Karp rolling hash (BigInt, base 257, mod 2⁶¹−1) → winnowing |
| Validation | zod (env + every request body) |
| Logging | pino + pino-http with redaction |
| Security | helmet, CORS allowlist, in-memory per-user rate limiter |

## Repository layout

```
MultiCoder/
├── backend/                Node + Express API + ShareDB realtime
│   ├── prisma/             schema.prisma + migrations
│   ├── src/
│   │   ├── ai/             AiReviewProvider interface + Gemini adapter
│   │   ├── auth/           jwt, github OAuth, cookies, user repo+service
│   │   ├── config/         env parsing + zod validation
│   │   ├── constants/      timeouts, limits, model names
│   │   ├── db/             prisma client wrapper
│   │   ├── execution/      Piston client + ExecutionService
│   │   ├── http/           Express app, routes, middleware
│   │   ├── plagiarism/     normalizer, winnowing, repo, service
│   │   ├── realtime/       ShareDB backend, ws server, document service
│   │   ├── rooms/          room repo + service
│   │   ├── snapshots/      snapshot repo + service
│   │   ├── utils/          logger, errors
│   │   ├── types/          ambient .d.ts (express, modules)
│   │   └── index.ts        composition root
│   ├── Dockerfile          multi-stage build for production
│   └── .env.example        every env var with descriptions
├── frontend/               React + Vite + Monaco client
│   ├── src/
│   │   ├── api/            REST client + SSE frame parser
│   │   ├── auth/           AuthProvider + RequireAuth
│   │   ├── components/
│   │   │   ├── editor/     CollaborativeEditor, EditorToolbar, OutputPanel
│   │   │   ├── history/    HistoryPanel
│   │   │   ├── plagiarism/ PlagiarismPanel
│   │   │   └── review/     ReviewPanel
│   │   ├── pages/          LoginPage, DashboardPage, RoomPage
│   │   ├── realtime/       sharedb connection + Monaco↔json0 binding
│   │   └── types/          shared TS types
│   ├── vercel.json         Vite preset + SPA rewrite
│   └── .env.example
├── docs/
│   ├── prd.txt             Original Product Requirements Document
│   └── engineering-rules.txt   Engineering rules this codebase follows
├── docker-compose.yml      Local Postgres + Redis (optional alt to Neon)
└── render.yaml             One-click backend deploy blueprint
```

## Local development

You'll need:
- **Node 20+** and **npm 10+**
- A **Postgres** — easiest path is a free [Neon](https://neon.tech) project (no Docker required)
- A **GitHub OAuth app** — create one at https://github.com/settings/developers with callback `http://localhost:8080/auth/github/callback`
- A **Gemini API key** — free from https://aistudio.google.com/app/apikey

### 1. Clone & install

```bash
git clone <your-fork>
cd MultiCoder
(cd backend  && npm install)
(cd frontend && npm install)
```

### 2. Configure env

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and fill in `DATABASE_URL`, `JWT_SECRET` (32+ random chars — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GEMINI_API_KEY`. Other vars have working defaults.

### 3. Run migrations

```bash
cd backend
npx prisma migrate dev
```

### 4. Start both services

Start Piston (code execution sandbox) if you want the Run button to work:

```bash
docker compose up -d piston
# First start installs language runtimes — wait ~60s, then verify:
curl http://localhost:2000/api/v2/runtimes
```

In two terminals:

```bash
cd backend  && npm run dev    # → http://localhost:8080
cd frontend && npm run dev    # → http://localhost:5173
```

Open `http://localhost:5173`, sign in with GitHub, create a room, share the URL.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `PORT` | no | `8080` | HTTP + WS port |
| `HOST` | no | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | no | `info` | pino level |
| `CORS_ORIGINS` | no | `http://localhost:5173` | Comma-separated allowlist |
| `DATABASE_URL` | **yes** | — | Postgres connection string |
| `FRONTEND_URL` | no | `http://localhost:5173` | Where to redirect after OAuth |
| `JWT_SECRET` | **yes** | — | 32+ chars; rotate to invalidate every session |
| `JWT_EXPIRES_IN` | no | `7d` | vercel-ms format |
| `GITHUB_CLIENT_ID` | **yes** | — | From github.com/settings/developers |
| `GITHUB_CLIENT_SECRET` | **yes** | — | From the same OAuth app |
| `OAUTH_CALLBACK_URL` | no | `http://localhost:8080/auth/github/callback` | Must match the GitHub OAuth app exactly |
| `AI_PROVIDER` | no | `gemini` | Only `gemini` is shipped; provider abstraction lives in `src/ai/providerFactory.ts` |
| `GEMINI_API_KEY` | **yes** | — | From aistudio.google.com/app/apikey |
| `GEMINI_MODEL` | no | `gemini-flash-latest` | Pin a specific version if you prefer |
| `PISTON_BASE_URL` | no | `http://localhost:2000/api/v2` | Piston v2 API base URL (self-hosted via `docker compose up -d piston`) |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | **yes** | `http://localhost:8080` | REST base URL |
| `VITE_WS_URL` | **yes** | `ws://localhost:8080/sharedb` | ShareDB WebSocket endpoint |

## API surface

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness probe |
| `GET` | `/auth/github` | — | Starts OAuth (302 to github.com + state cookie) |
| `GET` | `/auth/github/callback` | — | OAuth callback (sets session cookie, redirects to dashboard) |
| `POST` | `/auth/logout` | — | Clears session cookie |
| `GET` | `/api/user/me` | ✅ | Current user |
| `POST` | `/api/rooms` | ✅ | Create room |
| `GET` | `/api/rooms` | ✅ | List caller's rooms |
| `GET` | `/api/rooms/:id` | — | Get room (public — invite links work) |
| `POST` | `/api/rooms/:id/snapshots` | ✅ | Snapshot current ShareDB doc |
| `GET` | `/api/rooms/:id/snapshots` | ✅ | List snapshots |
| `GET` | `/api/rooms/:id/snapshots/:snapshotId` | ✅ | Get snapshot detail (content) |
| `POST` | `/api/execute` | ✅ + 10/min | Run code (Piston) |
| `POST` | `/api/review` | ✅ + 5/min | Non-streaming AI review |
| `POST` | `/api/review/stream` | ✅ + 5/min | SSE: `event: chunk|result|error` |
| `POST` | `/api/check-plagiarism` | ✅ + 20/min | Submit/check fingerprints |
| WS upgrade | `/sharedb` | ✅ (cookie) | ShareDB JSON traffic, JWT-verified pre-upgrade |

All error responses share `{ error: { code, message, details? } }`.

## Code execution

The execution module targets [Piston](https://github.com/engineer-man/piston) for sandboxed multi-language execution. **Self-host Piston locally** (recommended):

```bash
docker compose up -d piston
```

Set `PISTON_BASE_URL=http://localhost:2000/api/v2` in `backend/.env` (this is the default). The Run button sends code to Piston and displays stdout/stderr. The client already uses a multi-file-ready `files[]` payload shape; Stage 4 will send the full project.

The public emkc.org Piston API is whitelist-only — do not rely on it for local dev.

**Alternatives:** Judge0 CE via RapidAPI (~50 runs/day free) — swap `PistonClient` for a Judge0 adapter.

## Production deployment

The recommended setup is **Vercel (frontend) + Render (backend, free tier) + Neon (Postgres, free tier)** — all three have free tiers that work without a credit card.

### Backend → Render (via render.yaml)

1. Push your repo to GitHub.
2. Open Render → **New → Blueprint** → connect your repo. It will detect `render.yaml`.
3. After the service is created, open it and set these env vars in the dashboard (they are marked `sync: false`):
   - `DATABASE_URL` — your Neon production connection string
   - `FRONTEND_URL` — your Vercel deploy URL (e.g. `https://multicoder.vercel.app`)
   - `CORS_ORIGINS` — same URL (comma-separated if you have multiple)
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from a **new** GitHub OAuth app whose callback is `https://your-render-url.onrender.com/auth/github/callback`
   - `OAUTH_CALLBACK_URL` — that same callback URL
   - `GEMINI_API_KEY` — your Gemini key
4. `JWT_SECRET` is auto-generated by Render (`generateValue: true`).
5. Trigger a deploy. The `preDeployCommand` runs `npx prisma migrate deploy` against your Neon DB.

### Frontend → Vercel

1. Open Vercel → **Add new → Project** → import your repo → **Root Directory** = `frontend`.
2. Vercel auto-detects Vite via `vercel.json`.
3. Add env vars:
   - `VITE_API_URL` = `https://your-render-url.onrender.com`
   - `VITE_WS_URL` = `wss://your-render-url.onrender.com/sharedb` (note `wss` and no trailing slash)
4. Deploy.

### Cookies & CORS gotcha

Production has frontend and backend on **different origins**, so cookies must use `sameSite: 'none'` and `secure: true` — that's already handled automatically when `NODE_ENV=production`. Render gives you HTTPS for free, which is required for `secure` cookies.

### Backend Docker (alternative to Render)

```bash
cd backend
docker build -t multicoder-backend .
docker run --rm -p 8080:8080 --env-file .env multicoder-backend
```

The image is multi-stage (~150 MB), runs as `node` (non-root), and includes a `HEALTHCHECK` hitting `/health`.

## Engineering notes worth calling out

- **Layered architecture** — routes → services → repositories. No business logic in handlers; nothing in services imports Express.
- **Provider abstraction for AI** — `AiReviewProvider` interface in `src/ai/types.ts` is the seam. Adding Ollama/Groq/OpenAI = one new class + one factory case (`src/ai/providerFactory.ts` uses an exhaustive `never`-typed switch).
- **Structured LLM output** — Gemini's `responseSchema` constrains the JSON shape, then zod validates at runtime. No prompt-parsing fragility.
- **Plagiarism algorithm** — winnowing per Schleimer/Wilkerson/Aiken (SIGMOD 2003): Rabin-Karp k-grams (k=5), sliding-window min (w=4), right-most tie-break. Live test catches near-duplicates that renamed every variable at 50% Jaccard similarity.
- **Streaming AI review** — POST + SSE rather than `EventSource` (which is GET-only, can't carry the auth cookie cleanly). Custom SSE parser in `frontend/src/api/sseClient.ts`.
- **Snapshot restore is broadcast-aware** — `editorRef.setValue()` flows through the Monaco↔ShareDB binding, so restoring on one peer propagates to every other connected client automatically.

## Documents

- [`docs/prd.txt`](docs/prd.txt) — Original Product Requirements Document.
- [`docs/engineering-rules.txt`](docs/engineering-rules.txt) — Production-grade engineering rules this codebase follows.
