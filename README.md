# ai_chat

This repository contains a small AI chat backend stack built around:

- **`main_service`** (NestJS): HTTP API + SSE streaming endpoint, auth/session cookie, rate limiting, semantic cache/firewall.
- **`llmservice`** (NestJS + BullMQ worker): consumes jobs from Redis queue and streams tokens/progress.
- **`ollama`**: local LLM runtime.
- **`chromadb`**: vector store for semantic cache + firewall.
- **`postgres`**: persistent relational storage (queries/responses/logs).
- **`redis`**: BullMQ + token bucket state + request log staging.
- **`nginx`**: reverse proxy + rate limiting + basic UA blocking + logging.

## Quick start (Docker)

### Prerequisites

- Docker Desktop
- `docker compose`

### Run

From repo root:

```bash
docker compose up
```

## Frontend (`aichatapp`)

Frontend app is located in `ai-chat-stream` (your `aichatapp` UI).

### Run frontend locally

```bash
cd ai-chat-stream
npm install
npm run dev
```

By default, Vite runs on `http://localhost:8080` and proxies API calls to `http://localhost:3001`.
If needed, override backend target with:

```bash
VITE_DEV_PROXY_TARGET=http://localhost:3001 npm run dev
```

## Environment setup (`.env`)

This project uses separate env files per service:

- `main_service/.env`
- `llmservice/.env`

### `main_service/.env` (required keys)

- DB: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Redis: `REDIS_HOST`, `REDIS_PORT`
- Chroma: `CHROMA_URL`
- Cookies/session: `COOKIE_SECRET`, `SESSION_EXPIRY_TIME`
- Rate limit: `RATE_LIMIT_CAPACITY`, `RATE_LIMIT_REFILL_RATE`
- Semantic cache/firewall:
  - `SEMANTIC_CACHE_THRESHOLD`
  - `SEMANTIC_FIREWALL_THRESHOLD`
  - `SEMANTIC_FIREWALL_SENTENCES_HEADER`
  - `<HEADER>_0`, `<HEADER>_1`, ... (sequential keys, stop on first missing index)
- reCAPTCHA: `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SCORE_THRESHOLD`, `RECAPTCHA_URL`

`RECAPTCHA_SITE_KEY` (public key) is used by frontend.
Current reCAPTCHA setup in this project is test/dev-oriented and expected to work only with `localhost` origin.

### `llmservice/.env` (required keys)

- Runtime: `PORT`
- Redis: `REDIS_HOST`, `REDIS_PORT`
- Ollama: `OLLAMA_HOST`, `OLLAMA_PORT`, `OLLAMA_MODEL`

### Ports

- **API via nginx**: `http://localhost:3001`
- **Frontend (`aichatapp` / `ai-chat-stream`)**: `http://localhost:8080`
- **main_service (direct)**: `http://localhost:3000`
- **llmservice (direct)**: `http://localhost:3100`
- **Postgres**: `localhost:5432`
- **Redis**: `localhost:6379`
- **ChromaDB**: `http://localhost:8000`
- **Ollama**: `http://localhost:11434`

## Model (GGUF)

Current setup uses an Ollama model initialized from local files in `ollama/models/`.

If you need to download the MamayLM GGUF manually, use:

- [INSAIT-Institute/MamayLM-Gemma-3-4B-IT-v1.0-GGUF](https://huggingface.co/INSAIT-Institute/MamayLM-Gemma-3-4B-IT-v1.0-GGUF)

Pick a quantization that fits your hardware (for example `Q4_K_M`, `Q5_K_S`, or `Q8_0`) and update your local model/init flow if needed.

## API overview

### `GET /auth`

- Uses `x-recaptcha-token` header (reCAPTCHA v3).
- Returns `204` on success.
- Sets a signed session cookie (`sessionId`) via middleware.

### `GET /queries/sse?text=...`

- SSE endpoint (`text/event-stream`) protected by token bucket guard.
- Emits events:
  - `progress`
  - `completed`
  - `failed`

Run ai-chat-stream client to try it and check implementation.

## Database migrations (Flyway)

Flyway project lives in `flyway_ai_chat/`.

- Migrations folder: `flyway_ai_chat/migrations/`
- Initial schema: `flyway_ai_chat/migrations/V1__init.sql`

### Run migrations (Flyway CLI)

If you installed Flyway on your machine:

```bash
cd flyway_ai_chat
flyway -environment=target1 -user=app_user -password=app_password info
flyway -environment=target1 -user=app_user -password=app_password migrate
```

Alternatively, provide credentials via environment variables:

```bash
export FLYWAY_USER=app_user
export FLYWAY_PASSWORD=app_password
cd flyway_ai_chat
flyway -environment=target1 info
flyway -environment=target1 migrate
```

## Maintenance scripts

### Clear Postgres + Chroma

Script: `scripts/clear_postgres_chroma.py`

```bash
cd scripts
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-clear.txt

python3 clear_postgres_chroma.py --dry-run
python3 clear_postgres_chroma.py --yes
```

## Architecture

### Overview

This project is a small multi-service backend stack that provides:

- Session-based access (signed cookie)
- Rate limiting (token bucket per session + nginx rate limits)
- SSE streaming for LLM output
- Semantic cache and semantic firewall (vector similarity via ChromaDB)
- Background job processing (BullMQ)

### Services

#### `main_service` (NestJS)

Responsibilities:

- HTTP API entrypoint and SSE endpoint
- Session cookie middleware (`sessionId`)
- Auth endpoint protected by reCAPTCHA
- Per-session token bucket rate limiting
- Semantic firewall check (embedding similarity)
- Semantic cache lookup (embedding similarity)
- Enqueues LLM jobs to BullMQ and streams progress events over SSE
- Persists data to Postgres and embeddings to ChromaDB

Key endpoints:

- `GET /auth`:
  - Requires header `x-recaptcha-token`
  - Returns `204`
  - Initializes token bucket state in Redis (via `RateLimiterService`)
  - Session cookie is set by middleware

- `GET /queries/sse?text=...`:
  - SSE (`text/event-stream`)
  - Protected by `TokenBucketGuard`
  - Emits events (`progress`, `completed`, `failed`)

#### `llmservice` (NestJS + BullMQ worker)

Responsibilities:

- BullMQ worker consuming jobs from Redis queue
- Calls the LLM client (Ollama or mock) and streams tokens/chunks
- Updates BullMQ job progress, which `main_service` re-emits as SSE events

Notes:

- If worker concurrency is increased, ensure Ollama has sufficient resources (VRAM) and is configured for parallelism.
- In current implementation, worker concurrency is controlled by `const CONCURRENCY = 2;` inside `llmservice/src/bullmq/bullmq.processor.ts`.
- To allow more concurrent job processing in `llmservice`, change this constant and rebuild/restart containers.

#### `ollama`

Responsibilities:

- Local LLM runtime and model management
- Accepts generation requests from `llmservice`

Important config:

- `OLLAMA_NUM_PARALLEL`: max number of concurrent requests handled by a single Ollama server instance (not number of containers).

#### `chromadb`

Responsibilities:

- Vector store for:
  - **semantic cache** (`cache` collection)
  - **semantic firewall** (`firewall` collection)

`main_service` provides embeddings explicitly, so Chroma should not need a default embedding function.

#### `postgres`

Responsibilities:

- Relational persistence for:
  - `queries`
  - `responses`
  - `request_logs`

Migrations:

- Managed by Flyway: `flyway_ai_chat/migrations/`

#### `redis`

Responsibilities:

- BullMQ queue backend
- Token bucket state (rate limiting)
- Staging request log data for job completion handling

#### `nginx`

Responsibilities:

- Reverse proxy to `main_service`
- Global rate limiting per IP (`limit_req`)
- Simple UA blocking map (logs blocked and 429)

### Data flow

#### Auth flow

1. Client obtains reCAPTCHA token (v3).
2. Client calls `GET /auth` with `x-recaptcha-token`.
3. `RecaptchaGuard` verifies token.
4. Session middleware sets signed cookie `sessionId`.
5. Server initializes Redis token bucket for that `sessionId`.

#### SSE LLM flow

1. Client calls `GET /queries/sse?text=...` with cookies.
2. `TokenBucketGuard`:
   - reads signed cookie `sessionId`
   - consumes token bucket
3. Server embeds input text and checks semantic firewall.
4. Server tries semantic cache. If hit:
   - returns `completed` event immediately (no queue)
5. Otherwise:
   - enqueues BullMQ job
   - stores request log data in Redis (TTL)
   - returns job id, and SSE stream listens for BullMQ events
6. `llmservice` processes job and updates progress.
7. `main_service` re-emits progress/completed/failed events.
8. On completion, `main_service` persists:
   - Postgres rows
   - Chroma cache record
   - request log

### Error handling

- Domain errors are represented as custom `Error` classes (not `HttpException`):
  - Redis: `RedisOperationError`
  - Chroma: `ChromaOperationError`
  - DB: `DatabaseOperationError`
  - reCAPTCHA: `RecaptchaOperationError`
  - embedding model: `EmbeddingModelOperationError`

- A global exception filter formats these errors as HTTP responses for non-SSE endpoints.

SSE note:

- For SSE endpoints, HTTP status is typically `200` once the stream starts; failures are communicated via SSE events or connection close.

