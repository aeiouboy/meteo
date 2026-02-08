# Plan: Phase 1 — RAG Knowledge Base Integration

## Task Description
Integrate a RAG (Retrieval-Augmented Generation) knowledge base into the existing standalone Meteo OMS AI Agent (`/Users/tachongrak/Meteo/agent/`). This adds the ability to answer procedural and documentation-based questions — not just structured SQL queries — by embedding OMS documentation into Supabase pgvector and searching it semantically at query time.

The agent currently has ONE tool (`execute_oms_query`) that queries structured data via SQL. After this phase, it will have TWO tools: the existing SQL tool plus a new `search_knowledge_base` tool for semantic document search.

## Objective
When this plan is complete:
1. The agent has a new `search_knowledge_base` tool that performs semantic search over embedded documents
2. An ingestion pipeline (`POST /ingest` endpoint + CLI command) chunks, embeds, and stores documents in Supabase
3. The knowledge base is seeded with OMS documentation (schema docs, status flows, troubleshooting guides)
4. The agent's system prompt is updated to use RAG for procedural questions
5. End-to-end: a user can ask "How does the order fulfillment process work?" and get a grounded answer citing documentation

## Problem Statement
The current agent can only answer questions by running SQL queries against structured OMS data (orders, inventory, events). It cannot:
- Explain business processes ("What is the order status flow?")
- Provide troubleshooting guidance ("Why might an order be stuck in Allocated?")
- Reference documentation or SOPs
- Answer "how-to" questions about the OMS system

The MVP research document targets **85% accuracy** on root cause analysis. Without RAG, the agent has no knowledge of procedures, workflows, or troubleshooting patterns — it can only read raw data.

## Solution Approach
Add RAG capabilities by:
1. **Embedding Service** — Generate embeddings using OpenAI `text-embedding-3-small` (1536 dimensions, matching existing `documents` table schema)
2. **Document Ingestion** — Chunk documents using recursive text splitting, embed each chunk, store in Supabase `documents` table with metadata
3. **Semantic Search Tool** — New agent tool that embeds the user's query, calls `match_documents` RPC for cosine similarity search, returns relevant chunks
4. **Updated System Prompt** — Instruct the agent to use the knowledge base for procedural/documentation questions and SQL for data queries
5. **Seed Data** — Ingest OMS schema documentation, order status flow, and troubleshooting guides

### Embedding Strategy
- **Model**: OpenAI `text-embedding-3-small` (1536 dims, $0.02/1M tokens)
- **Why**: Matches existing `documents` table `vector(1536)` and `match_documents(vector(1536))` function
- **Client**: Reuse the `openai` npm package with a separate client pointing to `https://api.openai.com/v1`
- **Fallback**: If no OpenAI key is available, document how to use alternative providers (Cohere, local models with dimension adjustment)

### Chunking Strategy (from research)
| Document Type | Chunk Size | Overlap |
|---------------|-----------|---------|
| Technical docs / Schema | 800-1200 tokens | 15% |
| FAQs / Troubleshooting | 300-500 tokens | 10% |
| Process descriptions | 600-1000 tokens | 20% |

## Relevant Files

### Existing Files (Read/Modify)
- `agent/src/config.ts` — Add `openaiApiKey` for embedding generation
- `agent/src/supabase.ts` — Add `storeDocument()` and `searchDocuments()` functions
- `agent/src/tools.ts` — Add `search_knowledge_base` tool definition and executor
- `agent/src/agent.ts` — Update system prompt to include RAG usage instructions
- `agent/src/server.ts` — Add `POST /ingest` endpoint
- `agent/package.json` — No new deps needed (`openai` package already installed)
- `CLAUDE.md` — Source of OMS documentation to seed into the knowledge base

### New Files
- `agent/src/embeddings.ts` — Embedding generation service (OpenAI client)
- `agent/src/ingest.ts` — Document chunking and ingestion pipeline
- `agent/src/seed.ts` — Script to seed knowledge base with OMS documentation
- `agent/knowledge/oms-schema.md` — Extracted OMS schema documentation for ingestion
- `agent/knowledge/order-status-flow.md` — Order lifecycle and status flow documentation
- `agent/knowledge/troubleshooting.md` — Common OMS issues and resolution steps
- `agent/knowledge/inventory-guide.md` — Inventory management procedures

### Supabase (Already Exists — No Changes Needed)
- `documents` table: `id uuid, content text, metadata jsonb, embedding vector(1536), created_at timestamptz`
- `match_documents` function: `(query_embedding vector(1536), match_threshold float, match_count int) → TABLE(id, content, metadata, similarity)`
- pgvector extension v0.8.0 enabled

## Implementation Phases

### Phase 1: Foundation
- Set up embedding service with OpenAI API
- Create document chunking pipeline
- Verify Supabase vector storage and retrieval works

### Phase 2: Core Implementation
- Add `search_knowledge_base` tool to the agent
- Add `POST /ingest` endpoint to the server
- Update system prompt for hybrid SQL + RAG behavior
- Create knowledge base seed documents

### Phase 3: Integration & Polish
- Seed the knowledge base with OMS documentation
- Test end-to-end: SQL queries, RAG queries, and hybrid queries
- Validate accuracy and relevance of search results
- Update n8n proxy workflow if needed

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
  - This is critical. Your job is to act as a high level director of the team, not a builder.
  - Your role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: `builder-embeddings`
  - Role: Creates the embedding service (`src/embeddings.ts`) and document ingestion pipeline (`src/ingest.ts`). Handles OpenAI embedding client setup, text chunking logic, and Supabase vector storage.
  - Agent Type: `builder`
  - Resume: true

- Builder
  - Name: `builder-rag-tool`
  - Role: Integrates RAG into the agent — adds `search_knowledge_base` tool to `src/tools.ts`, updates the system prompt in `src/agent.ts`, adds `POST /ingest` endpoint to `src/server.ts`, and updates `src/config.ts`.
  - Agent Type: `builder`
  - Resume: true

- Builder
  - Name: `builder-knowledge-docs`
  - Role: Creates the knowledge base seed documents in `agent/knowledge/` by extracting and structuring content from `CLAUDE.md` and research documents. Creates the seed script (`src/seed.ts`).
  - Agent Type: `builder`
  - Resume: true

- Builder
  - Name: `builder-seed-runner`
  - Role: Runs the seed script to populate the knowledge base, then runs integration tests to verify the full pipeline (ingest → embed → store → search → respond).
  - Agent Type: `general-purpose`
  - Resume: true

- Validator
  - Name: `validator-rag`
  - Role: Validates the complete RAG integration — verifies documents are stored in Supabase, search returns relevant results, agent correctly routes between SQL and RAG tools, and the n8n proxy still works.
  - Agent Type: `validator`
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Build Embedding Service & Ingestion Pipeline
- **Task ID**: build-embeddings-ingestion
- **Depends On**: none
- **Assigned To**: `builder-embeddings`
- **Agent Type**: `builder`
- **Parallel**: false (foundation — must complete first)
- Read the existing agent code at `/Users/tachongrak/Meteo/agent/src/` to understand the current architecture (config, supabase, tools, agent, server)
- Create `agent/src/embeddings.ts`:
  - Create a separate OpenAI client pointing to `https://api.openai.com/v1` using `OPENAI_API_KEY` from config
  - Export `generateEmbedding(text: string): Promise<number[]>` — calls `openai.embeddings.create({ model: 'text-embedding-3-small', input: text })`
  - Export `generateEmbeddings(texts: string[]): Promise<number[][]>` — batch version (OpenAI supports up to 2048 inputs per call)
  - Handle errors gracefully (API key missing, rate limits, etc.)
- Create `agent/src/ingest.ts`:
  - Export `chunkText(text: string, options?: { chunkSize?: number, overlap?: number }): string[]`
    - Default chunk size: 800 characters, overlap: 120 characters (15%)
    - Split on paragraph boundaries (`\n\n`), then sentence boundaries (`. `) if chunks are too large
    - Preserve markdown headers as chunk metadata
  - Export `ingestDocument(content: string, metadata: Record<string, unknown>): Promise<{ chunksStored: number }>`
    - Chunk the content
    - Generate embeddings for all chunks (batch)
    - Store each chunk + embedding in Supabase `documents` table via `INSERT`
    - Include metadata (source, title, category, ingested_at) in the `metadata` JSONB column
  - Export `searchDocuments(query: string, options?: { matchCount?: number, threshold?: number }): Promise<Array<{ content: string, metadata: unknown, similarity: number }>>`
    - Generate embedding for the query
    - Call Supabase RPC `match_documents` with the query embedding
    - Return matched documents sorted by similarity
- Update `agent/src/config.ts`:
  - Add `openaiApiKey` field: `env('OPENAI_API_KEY', '')` — empty default since it's optional/user-provided
  - Add `embeddingModel` field: `env('EMBEDDING_MODEL', 'text-embedding-3-small')`
- Update `agent/src/supabase.ts`:
  - Add `storeDocumentChunk(content: string, metadata: Record<string, unknown>, embedding: number[]): Promise<void>` — INSERT into `documents` table
  - Add `matchDocuments(queryEmbedding: number[], matchCount?: number, threshold?: number): Promise<any[]>` — calls `match_documents` RPC
- Verify by writing a quick test that generates an embedding and stores/retrieves a test document

### 2. Integrate RAG Tool into Agent
- **Task ID**: integrate-rag-tool
- **Depends On**: build-embeddings-ingestion
- **Assigned To**: `builder-rag-tool`
- **Agent Type**: `builder`
- **Parallel**: false
- Read the completed embeddings/ingestion code from Task 1
- Read the existing `agent/src/tools.ts` and `agent/src/agent.ts` to understand current tool structure
- Update `agent/src/tools.ts`:
  - Add new tool definition `search_knowledge_base`:
    ```typescript
    {
      type: 'function',
      function: {
        name: 'search_knowledge_base',
        description: 'Search the OMS knowledge base for documentation, procedures, troubleshooting guides, and how-to information. Use this for questions about processes, workflows, status meanings, or how things work — NOT for querying live data.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language search query describing what information you need'
            },
            category: {
              type: 'string',
              enum: ['schema', 'process', 'troubleshooting', 'inventory', 'all'],
              description: 'Optional category to narrow search scope'
            }
          },
          required: ['query']
        }
      }
    }
    ```
  - Update `executeTool()` to handle `search_knowledge_base`:
    - Call `searchDocuments(args.query)` from `ingest.ts`
    - If `category` is provided, filter metadata
    - Format results as a readable string with source citations
    - Return top 5 matches with similarity scores
- Update `agent/src/agent.ts` system prompt:
  - Add a new section `## Tools Available` explaining when to use each tool:
    - `execute_oms_query` — for live data queries (order counts, specific order details, inventory levels, event logs)
    - `search_knowledge_base` — for documentation, procedures, troubleshooting, "how does X work?" questions
  - Add examples of when to use each:
    - "How many orders are fulfilled?" → `execute_oms_query`
    - "What does the Allocated status mean?" → `search_knowledge_base`
    - "Why is order X stuck?" → `search_knowledge_base` first (for possible causes), then `execute_oms_query` (to check actual data)
- Update `agent/src/server.ts`:
  - Add `POST /ingest` endpoint:
    ```typescript
    app.post('/ingest', async (req, res) => {
      const { content, metadata } = req.body;
      // Validate input
      // Call ingestDocument(content, metadata)
      // Return { success: true, chunksStored: N }
    });
    ```
  - Add `GET /knowledge/stats` endpoint:
    - Return document count, categories, latest ingestion timestamp
- Run the agent (`npm run dev`) and verify both tools appear in a test query

### 3. Create Knowledge Base Seed Documents
- **Task ID**: create-seed-documents
- **Depends On**: none (can run in parallel with Tasks 1 and 2)
- **Assigned To**: `builder-knowledge-docs`
- **Agent Type**: `builder`
- **Parallel**: true
- Read `CLAUDE.md` at `/Users/tachongrak/Meteo/CLAUDE.md` — this is the primary source of OMS documentation
- Read the research documents at `/Users/tachongrak/Meteo/reseach/` for additional context
- Create `agent/knowledge/` directory
- Create `agent/knowledge/oms-schema.md`:
  - Extract the full database schema documentation from CLAUDE.md
  - Include all 4 schemas: `oms-order`, `public`, `support`, `oms-authentication`
  - Include table descriptions, column names, row counts, data types
  - Include key relationships diagram
  - Include data characteristics (Thai language, EAN barcodes, UOM types)
- Create `agent/knowledge/order-status-flow.md`:
  - Document the complete order lifecycle: Open → Allocated → Released → In Process → Picked → Fulfilled → Delivered
  - Explain each status transition: what triggers it, what it means, typical duration
  - Document payment status flow: Authorized → Awaiting Invoice → Paid
  - Document fulfillment status flow and its relationship to order status
  - Document partial statuses (Partial In Process, Partial Picked)
  - Include the event types from `support.log_workflow_events` and how they map to status transitions
- Create `agent/knowledge/troubleshooting.md`:
  - Common issue: Order stuck in "Allocated" — possible causes (inventory mismatch, promising failure, carrier unavailable)
  - Common issue: Payment status not updating — possible causes (payment gateway timeout, webhook failure)
  - Common issue: Stock mismatch between OMS and actual — diagnostic steps
  - Common issue: Order delay to fulfillment — how to trace using event log
  - Common issue: Release not created after allocation — possible causes
  - For each issue: symptoms, diagnostic SQL queries, resolution steps
- Create `agent/knowledge/inventory-guide.md`:
  - How inventory works: onhand, reserved, inbound quantities
  - How to check stock availability: `onhand - reserved = available`
  - Store structure: 3 stores in Supabase (004, 005, 007), 60 stores in real OMS
  - How to interpret inventory_stock data
  - How allocation affects reserved quantities
- Create `agent/src/seed.ts`:
  - Script that reads all `.md` files from `agent/knowledge/`
  - For each file: extracts title from filename, sets metadata `{ source: filename, category: 'schema'|'process'|'troubleshooting'|'inventory', ingested_at: new Date() }`
  - Calls `ingestDocument(content, metadata)` for each file
  - Logs progress and final counts
  - Add `npm run seed` script to package.json: `"seed": "tsx src/seed.ts"`

### 4. Seed Knowledge Base & Integration Test
- **Task ID**: seed-and-test
- **Depends On**: build-embeddings-ingestion, integrate-rag-tool, create-seed-documents
- **Assigned To**: `builder-seed-runner`
- **Agent Type**: `general-purpose`
- **Parallel**: false (depends on all 3 previous tasks)
- Read the completed code from Tasks 1, 2, and 3
- Ensure `OPENAI_API_KEY` is configured in `agent/src/config.ts` (user must provide this — check `env/key.md` or prompt)
- Run the seed script: `cd /Users/tachongrak/Meteo/agent && npx tsx src/seed.ts`
- Verify documents were stored in Supabase: `SELECT count(*), metadata->>'category' as category FROM documents GROUP BY metadata->>'category'`
- Start the agent: `npm run dev`
- Run integration tests via curl:
  - **SQL query test**: `curl -X POST http://localhost:3100/chat -H "Content-Type: application/json" -d '{"message":"How many orders do we have?"}'` — should use `execute_oms_query`
  - **RAG query test**: `curl -X POST http://localhost:3100/chat -H "Content-Type: application/json" -d '{"message":"What does the Allocated order status mean?"}'` — should use `search_knowledge_base`
  - **Hybrid query test**: `curl -X POST http://localhost:3100/chat -H "Content-Type: application/json" -d '{"message":"I have an order stuck in Allocated status. Why might this happen and can you check order PRE_SEK-20260206-B00119?"}'` — should use BOTH tools
  - **Ingestion test**: `curl -X POST http://localhost:3100/ingest -H "Content-Type: application/json" -d '{"content":"Test document about order processing","metadata":{"source":"test","category":"process"}}'` — should return chunksStored
  - **Stats test**: `curl -s http://localhost:3100/knowledge/stats` — should show document counts
- Verify the n8n proxy workflow still works (send a message through n8n chat UI)
- Log all test results with actual responses

### 5. Final Validation
- **Task ID**: validate-all
- **Depends On**: seed-and-test
- **Assigned To**: `validator-rag`
- **Agent Type**: `validator`
- **Parallel**: false
- **Validate Supabase documents** using Supabase MCP tools (`mcp__supabase__execute_sql`):
  - [ ] `SELECT count(*) FROM documents` — should be > 0 (at least 20+ chunks from 4 knowledge docs)
  - [ ] `SELECT DISTINCT metadata->>'category' FROM documents` — should include: schema, process, troubleshooting, inventory
  - [ ] `SELECT metadata->>'source', count(*) FROM documents GROUP BY metadata->>'source'` — verify all 4 knowledge docs were ingested
  - [ ] Test `match_documents` RPC directly: generate a test embedding and verify similarity search returns results
- **Validate agent code** by reading files:
  - [ ] `agent/src/embeddings.ts` exists with `generateEmbedding` and `generateEmbeddings` exports
  - [ ] `agent/src/ingest.ts` exists with `chunkText`, `ingestDocument`, and `searchDocuments` exports
  - [ ] `agent/src/tools.ts` contains both `execute_oms_query` and `search_knowledge_base` tool definitions
  - [ ] `agent/src/agent.ts` system prompt includes RAG usage instructions
  - [ ] `agent/src/server.ts` has `/ingest` and `/knowledge/stats` endpoints
  - [ ] `agent/src/seed.ts` exists and references knowledge docs
  - [ ] `agent/src/config.ts` has `openaiApiKey` and `embeddingModel` fields
- **Validate knowledge documents**:
  - [ ] `agent/knowledge/oms-schema.md` exists and contains all 4 schema descriptions
  - [ ] `agent/knowledge/order-status-flow.md` exists with complete status lifecycle
  - [ ] `agent/knowledge/troubleshooting.md` exists with at least 4 common issues
  - [ ] `agent/knowledge/inventory-guide.md` exists with inventory explanation
- **Validate package.json**:
  - [ ] `scripts.seed` exists (`tsx src/seed.ts`)
- **Validate n8n proxy workflow** still works:
  - [ ] Workflow `sto28rkSpvr7OGke` is active on n8n Docker
  - [ ] Chat Trigger → Call Agent → Format Response flow intact
- Run a final end-to-end test via curl and report results
- Provide comprehensive pass/fail report

## Acceptance Criteria

1. **Two working tools in the agent**:
   - `execute_oms_query` — queries live OMS data from Supabase (existing)
   - `search_knowledge_base` — searches embedded documentation (new)

2. **Document ingestion pipeline works**:
   - `POST /ingest` accepts content + metadata and stores embedded chunks
   - `GET /knowledge/stats` returns document counts by category
   - `npm run seed` successfully ingests all knowledge documents

3. **Knowledge base is populated**:
   - At least 20+ document chunks in Supabase `documents` table
   - 4 categories: schema, process, troubleshooting, inventory
   - Embeddings are valid 1536-dimensional vectors

4. **Agent correctly routes between tools**:
   - Data questions → `execute_oms_query` (SQL)
   - Documentation/process questions → `search_knowledge_base` (RAG)
   - Complex diagnostic questions → both tools (hybrid)

5. **Search quality**:
   - Similarity scores > 0.78 for relevant queries
   - Top-5 results include at least 1 highly relevant chunk for test queries
   - Agent cites sources from knowledge base in responses

6. **Backward compatibility**:
   - Existing `execute_oms_query` tool still works
   - n8n proxy workflow still functions
   - `POST /chat` and `GET /health` endpoints unchanged

## Validation Commands
Execute these commands to validate the task is complete:

- **Supabase document validation** (via Supabase MCP `mcp__supabase__execute_sql`):
  - `SELECT count(*) as total_chunks FROM documents;` — should be > 20
  - `SELECT metadata->>'category' as cat, count(*) FROM documents GROUP BY 1;` — should show 4 categories
  - `SELECT metadata->>'source' as src, count(*) FROM documents GROUP BY 1;` — should show 4 source files

- **Agent endpoint tests** (via curl):
  - `curl -s http://localhost:3100/health` — should return `{ status: "ok" }`
  - `curl -s http://localhost:3100/knowledge/stats` — should return document counts
  - `curl -s -X POST http://localhost:3100/chat -H "Content-Type: application/json" -d '{"message":"How many orders are in Allocated status?"}'` — should use SQL tool
  - `curl -s -X POST http://localhost:3100/chat -H "Content-Type: application/json" -d '{"message":"What does the order status Allocated mean?"}'` — should use RAG tool

- **Code validation**:
  - `ls /Users/tachongrak/Meteo/agent/src/embeddings.ts` — file exists
  - `ls /Users/tachongrak/Meteo/agent/src/ingest.ts` — file exists
  - `ls /Users/tachongrak/Meteo/agent/src/seed.ts` — file exists
  - `ls /Users/tachongrak/Meteo/agent/knowledge/*.md` — 4 knowledge docs exist

## Notes

- **OpenAI API Key Required**: The embedding service uses OpenAI's `text-embedding-3-small` model, which requires an OpenAI API key. This is SEPARATE from the OpenRouter key. Cost is ~$0.02 per 1M tokens — essentially free for this use case. The user needs to provide this key in `config.ts` or via `OPENAI_API_KEY` environment variable.
- **Vector Dimension**: The existing `documents` table and `match_documents` function use `vector(1536)`, which matches OpenAI's embedding dimensions. Do NOT change the vector dimension.
- **Supabase Already Provisioned**: The `documents` table, `match_documents` function, and pgvector extension are already set up. No database migrations needed.
- **n8n Proxy Unchanged**: The n8n proxy workflow (Chat Trigger → HTTP Request → Agent) requires no changes. It calls `/chat` which the agent handles with the updated tool set.
- **Chunk Metadata**: Each chunk stored in `documents.metadata` should include: `{ source: "filename.md", category: "schema|process|troubleshooting|inventory", title: "extracted title", chunk_index: N, ingested_at: "ISO timestamp" }`
- **No New Dependencies**: The `openai` npm package is already installed and supports both chat completions and embeddings. No `npm install` needed.
- **Config Fallback**: If `OPENAI_API_KEY` is empty, the agent should still work — it just won't have the `search_knowledge_base` tool available. The SQL tool should continue to function independently.
- **`.env` files are blocked** by a pre_tool_use hook. All config values must be set directly in `config.ts` with fallback defaults, or the user must export environment variables before starting the agent.
