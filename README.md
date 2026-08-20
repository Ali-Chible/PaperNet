# PaperNet

PaperNet is a research tool that draws a net of research papers for any topic. It uses OpenAlex to fetch papers, finds the best match by cosine similarity (adjustable value in gui) and connects other paper that either cites/cited by it or are close enough in abstract similarity. You can chat with A.I. Model that has access to the net built.

## How it works

1. You search a keyword. PaperNet embeds it, checks Postgres/pgvector for a locally cached match above a similarity threshold, and falls back to querying [OpenAlex](https://openalex.org/) for a fresh candidate if nothing local is good enough.
2. Around that root paper, it builds a net: papers it cites and papers that cite it (citation edges), plus papers with a similar abstract embedding (semantic edges) including edges *between* those neighbor papers, not just back to the root.
3. The whole assembled net is cached in Postgres, so re-running the same search later is instant no re-fetching or re-embedding.
4. You can filter by year range, similarity threshold, and max papers shown, and toggle whether neighbor-to-neighbor connections are drawn or only revealed per-paper on click.
5. The chat panel is grounded in the currently built net (root paper + neighbors) and can link directly to any paper it references.

## Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) for embedding similarity search
- **Embeddings:** [`@huggingface/transformers`](https://github.com/huggingface/transformers.js) running locally (no external embedding API needed)
- **Frontend:** vanilla JS/HTML/CSS, [vis-network](https://visjs.github.io/vis-network/) for the graph
- **External data:** [OpenAlex API](https://openalex.org/) for paper metadata and citation resolution

Architecture is layered: routes → controllers → services (business logic) → models (DB access), with a schema-first Postgres setup (no ORM).

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for the bundled Postgres/pgvector container) or your own Postgres 16+ instance with the `pgvector` and `pg_trgm` extensions available

## Setup

```bash
git clone https://github.com/Ali-Chible/PaperNet.git
cd "PaperNet"
npm install
```

Copy the example environment file and adjust if needed:

```bash
cp .env.example .env
```

The defaults in `.env.example` already match `docker-compose.yml`'s default credentials, so if you're using the bundled DB container you likely don't need to change anything.

Start Postgres (schema is applied automatically on first boot via `docker-entrypoint-initdb.d`):

```bash
docker compose up -d
```

Start the app:

```bash
npm start
```

By default it's available at `http://localhost:3000`.

For development with auto-restart on file changes:

```bash
npx nodemon src/app.js
```

## Configuration

Two optional integrations: an AI provider for the chat feature, and an OpenAlex API key (required as of Feb 2026 per OpenAlex's updated ToS), can be set either via `.env` or, at runtime, through the in-app **Settings** panel. Settings entered in the UI are stored in the database and take priority over the `.env` values if both are present.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `PORT` | No | Server port (default `3000`) |
| `EMBEDDING_MODEL` | No | HuggingFace model id for local embeddings (default `Xenova/all-MiniLM-L6-v2`) |
| `OPENALEX_API_KEY` | No* | OpenAlex API key: configurable via Settings instead |
| `AI_PROVIDER` | No | AI provider for the chat feature: configurable via Settings instead |
| `AI_API_KEY` | No | API key for the above: configurable via Settings instead |
| `AI_MODEL` | No | Model name for the above: configurable via Settings instead |

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/search?keyword=&minYear=&maxYear=&maxNodes=&threshold=` | Builds (or returns a cached) citation/semantic net around the best-matching paper for `keyword` |
| `GET` | `/papers/:id` | Fetch a single paper's metadata |
| `GET` | `/settings` | Get current settings (API keys are masked in the response) |
| `POST` | `/settings` | Update settings (`openalex_api_key`, `ai_provider`, `ai_api_key`, `ai_model`) |
| `POST` | `/chat` | Send a chat message; body: `{ netContext, messages }` |

`/search` query parameters:
- `minYear`, `maxYear`: restrict candidate papers by publication year
- `maxNodes`: cap how many papers are shown (applied to an already-cached net when possible, so it's free to change between searches)
- `threshold`: minimum cosine similarity for a local paper to be reused as the root instead of fetching a fresh one from OpenAlex (default `0.62`)

## Project structure

```
├── docker-compose.yml       # Postgres + pgvector container
├── public/                  # Frontend (vanilla JS/HTML/CSS)
└── src/
    ├── app.js               # Express entrypoint
    ├── config/db.js         # Postgres connection pool
    ├── db/schema.sql        # Schema-first SQL (papers, citations, settings, etc.)
    ├── routers/             # Route definitions
    ├── controllers/         # Request handling, validation
    ├── services/            # Business logic (embedding, net building, AI chat, etc.)
    ├── models/               # Direct DB access
    └── utils/               # Small shared helpers
```

## Known limitations

- Citation edges between neighbor papers only reflect citations already resolved locally, the net doesn't fetch fresh citation data for every neighbor on every search, to keep searches fast. It gets richer as more papers get cross-resolved over time.
- Local embeddings run through `onnxruntime-node` (via `@huggingface/transformers`), which ships platform-specific native binaries. This is fine for `npm start`, but matters if you ever package the app as a standalone executable, native addons can't be bundled into a single file and need to travel alongside it.
