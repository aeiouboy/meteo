# Plan: Document Upload UI, Orchestrator E2E Testing & Chat Memory

## Task Description
Implement three enhancements to the Meteo OMS AI system running on local n8n (`localhost:5678`):

1. **Document Upload UI** — Add a browser-accessible Form Trigger to the Document Ingestion Pipeline workflow so operators can upload documents (PDF, TXT, MD) via a web form instead of requiring `curl` commands.

2. **Orchestrator End-to-End Testing** — Validate that the Orchestrator Agent correctly routes requests to OMS Assistant (data queries) and RAG Knowledge Base (documentation queries), and fix any routing issues discovered.

3. **Chat Memory / Session Persistence** — Replace the in-memory Window Buffer Memory in the Orchestrator with persistent Postgres Chat Memory backed by Supabase, so conversations survive n8n restarts and sessions can be resumed.

## Objective
When this plan is complete:
1. Operators can upload documents at `http://localhost:5678/form/meteo-doc-upload` — a browser form with file upload, source name, and category fields
2. The Orchestrator Agent correctly routes OMS data queries and documentation questions to the right sub-workflows, verified with test cases
3. Multi-turn conversations persist across n8n restarts via Supabase `chat_memory` table, and users can resume sessions by passing a `sessionId`

## Problem Statement
Three gaps exist in the current Meteo AI system:

1. **No upload UI**: Document ingestion requires `curl POST` to a webhook — non-technical operators cannot add new documents to the knowledge base without developer help.

2. **Untested routing**: The Orchestrator Agent (`BsfWa37nqDDYu7Sl`) has 4 tools (OMS Assistant, Knowledge Base, Ingest Document, Send Notification) but end-to-end routing has not been systematically validated. Routing failures would mean users get wrong answers or errors.

3. **Volatile memory**: The Orchestrator uses `Window Buffer Memory` (in-memory, 10 messages). Conversations are lost when n8n restarts (Docker container restart) or when memory exceeds the buffer window. The `chat_memory` table exists in Supabase but is unused.

## Solution Approach

### Task 1: Document Upload UI (Option B — Hybrid)
Add a **Form Trigger** node to the existing Document Ingestion Pipeline workflow (`Lw3NwyIgKO4JmrZD`). The Form Trigger creates a browser-accessible web form at `http://localhost:5678/form/meteo-doc-upload`. The form collects:
- **Source Name** (text) — for citation tracking in RAG responses
- **Category** (dropdown) — schema / process / troubleshooting / inventory
- **Document Content** (textarea) — paste document text directly

> **Why textarea instead of file upload?** The n8n Default Data Loader throws "Unsupported mime type: text/markdown" for `.md` files, and the existing pipeline's Code node expects text input (not binary). A textarea avoids MIME type issues and works seamlessly with the current chunking logic. File upload can be added later as an enhancement.

The Form Trigger connects to a new **Merge Form Input** Code node that transforms form data into the same format the existing pipeline expects (`{ content, source, metadata }`), then feeds into the existing Validate & Chunk → Embed → Store chain.

**Architecture:**
```
Form Trigger (browser UI) ──→ Merge Form Input ──→ Validate & Chunk ──→ Generate Embedding ──→ Insert to Supabase ──→ Prepare Response ──→ Form Completion Page
Webhook Trigger (API) ──────────────────────────→ Validate & Chunk ──→ (same pipeline)
```

Both triggers coexist — the API webhook continues to work for programmatic ingestion.

### Task 2: Orchestrator E2E Testing
Test the Orchestrator webhook endpoint (`POST http://localhost:5678/webhook/meteo-orchestrator`) with 4 categories of requests:
1. **OMS routing** — data queries that should go to OMS Assistant
2. **RAG routing** — documentation questions that should go to Knowledge Base
3. **Hybrid routing** — diagnostic questions that need both tools
4. **Edge cases** — empty/invalid input, very long messages, ambiguous requests

Fix any routing failures found during testing. Document working test cases and expected responses.

### Task 3: Chat Memory Persistence
Replace `Window Buffer Memory` (in-memory) with `Postgres Chat Memory` in the Orchestrator workflow. The n8n `@n8n/n8n-nodes-langchain.memoryPostgresChat` node connects directly to a PostgreSQL database for persistent conversation storage.

**Configuration:**
- Use Supabase PostgreSQL connection (pooler endpoint: `aws-1-ap-northeast-2.pooler.supabase.com:6543`)
- Table: `chat_memory` (already exists with correct schema)
- Session key: `={{ $json.sessionId }}` (from Validate Input node)
- Context window: 10 messages (match current setting)

**Key constraint:** Only add memory to the Orchestrator. Sub-workflows (OMS Assistant, RAG KB) must remain stateless — they are called via `toolWorkflow` which does not propagate sessionId.

## Relevant Files

### Existing Workflows (on local n8n at localhost:5678)
- **Workflow `Lw3NwyIgKO4JmrZD`** — Document Ingestion Pipeline (Task 1: add Form Trigger)
  - Nodes: Webhook Trigger → Validate & Chunk Input (Code) → Generate Embedding (HTTP Request to OpenRouter) → Insert to Supabase (HTTP Request) → Prepare Response (Code) → Respond to Webhook
  - Webhook path: `meteo-doc-ingestion`
  - Chunking: 1000 chars, 200 overlap, recursive character splitting
  - Embedding: `openai/text-embedding-3-small` via OpenRouter `/v1/embeddings`

- **Workflow `BsfWa37nqDDYu7Sl`** — Orchestrator Agent (Tasks 2 & 3)
  - Nodes: Webhook Trigger → Validate Input → AI Agent (4 tools) → Format Response → Respond to Webhook
  - Tools: OMS Assistant (`sto28rkSpvr7OGke`), Knowledge Base (`Vp62EHB0nSoBGiuF`), Ingest Document (`Lw3NwyIgKO4JmrZD`), Send Notification (HTTP)
  - Memory: Window Buffer Memory (in-memory, sessionKey from input, 10 messages)
  - LLM: OpenRouter Chat Model (`lmChatOpenRouter` v1)
  - Webhook path: `meteo-orchestrator`
  - Input format: `{ message: string, sessionId?: string, context?: string }`
  - Validate Input generates `sessionId: session_${Date.now()}` if not provided

- **Workflow `sto28rkSpvr7OGke`** — OMS AI Assistant (sub-workflow, no changes needed)
  - Dual trigger: Chat Trigger + Execute Workflow Trigger (input: `query`)
  - AI Agent → toolHttpRequest → Edge Function `execute-oms-query` → Supabase RPC
  - Stateless (no memory — correct for sub-workflow)

- **Workflow `Vp62EHB0nSoBGiuF`** — RAG Knowledge Base (sub-workflow, no changes needed)
  - Dual trigger: Chat Trigger + Execute Workflow Trigger (input: `query`)
  - AI Agent → toolHttpRequest → Edge Function `search-knowledge`
  - Stateless (no memory — correct for sub-workflow)

### Supabase Resources
- **Edge Function `execute-oms-query`** — validates SELECT-only, calls `execute_oms_query` RPC
- **Edge Function `search-knowledge`** — embeds query via OpenRouter, calls `match_documents` RPC
- **Table `documents`** — 72 chunks, pgvector embeddings (1536 dims), 12 sources
- **Table `chat_memory`** — exists but empty (columns: id uuid, session_id text, messages jsonb, created_at, updated_at)
- **RPC `match_documents`** — cosine similarity search on pgvector embeddings
- **RPC `execute_oms_query`** — SELECT-only SQL execution against oms schema

### Configuration
- **n8n API key**: in `env/key.md` (local n8n section)
- **n8n local URL**: `http://localhost:5678`
- **n8n Docker container**: `meteo-n8n`
- **OpenRouter credential ID**: `Qmq2ZGaK63MiswAW` (type: `openAiApi`)
- **Supabase project**: `koyrtluetnitcxirinrx`
- **Supabase anon key**: in `env/key.md`
- **Supabase service role key**: in `env/key.md`
- **Supabase pooler endpoint**: `aws-1-ap-northeast-2.pooler.supabase.com:6543` (for Postgres Chat Memory)
- **Supabase direct endpoint**: `aws-1-ap-northeast-2.pooler.supabase.com:5432`

### Reference Files
- `/Users/tachongrak/Meteo/env/key.md` — All API keys and credentials
- `/Users/tachongrak/Meteo/.mcp.json` — MCP server configuration
- `/Users/tachongrak/Meteo/CLAUDE.md` — Project documentation and OMS schema reference

### New Files
- `specs/doc-upload-orchestrator-memory.md` — This plan document

## Implementation Phases

### Phase 1: Document Upload UI
- Add Form Trigger node to Ingestion Pipeline workflow
- Add Merge Form Input Code node to transform form data
- Connect Form Trigger to existing pipeline via the merge node
- Test form submission with a sample document
- Verify existing webhook API still works (regression)

### Phase 2: Orchestrator E2E Testing
- Test OMS routing with data queries
- Test RAG routing with documentation questions
- Test hybrid routing with diagnostic questions
- Test edge cases (invalid input, no sessionId)
- Fix any routing issues discovered
- Document test results

### Phase 3: Chat Memory Persistence
- Create PostgreSQL credential on local n8n for Supabase connection
- Verify `chat_memory` table schema is compatible with n8n's Postgres Chat Memory node
- Replace Window Buffer Memory with Postgres Chat Memory in Orchestrator
- Test multi-turn conversations with persistent sessions
- Test session resumption after n8n restart
- Verify sub-workflows remain stateless

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
  - Name: `builder-form-upload`
  - Role: Adds Form Trigger and Merge Form Input nodes to the Document Ingestion Pipeline workflow via n8n REST API. Handles workflow JSON modification and deployment.
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-orchestrator-test`
  - Role: Executes end-to-end tests against the Orchestrator webhook endpoint. Tests OMS routing, RAG routing, hybrid queries, and edge cases. Fixes any routing issues found.
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-chat-memory`
  - Role: Creates PostgreSQL credential on local n8n for Supabase, replaces Window Buffer Memory with Postgres Chat Memory in the Orchestrator workflow, and verifies the chat_memory table schema compatibility.
  - Agent Type: `general-purpose`
  - Resume: true

- Validator
  - Name: `validator-final`
  - Role: Validates all three tasks are complete — form upload works via browser, orchestrator routing is correct, and chat memory persists across restarts.
  - Agent Type: `validator`
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Add Form Trigger to Document Ingestion Pipeline
- **Task ID**: add-form-trigger
- **Depends On**: none
- **Assigned To**: `builder-form-upload`
- **Agent Type**: `general-purpose`
- **Parallel**: false (foundation for upload testing)
- Read `env/key.md` for the n8n local API key
- Fetch the current workflow JSON via `GET http://localhost:5678/api/v1/workflows/Lw3NwyIgKO4JmrZD` with the API key header
- Add a **Form Trigger** node to the workflow with:
  - `formTitle`: "Meteo - Document Upload"
  - `formDescription`: "Upload a document to the Meteo RAG Knowledge Base"
  - `path`: "meteo-doc-upload" (produces URL: `http://localhost:5678/form/meteo-doc-upload`)
  - `responseMode`: "responseNode" (to show success page after processing)
  - `formFields.values`:
    1. `{ fieldLabel: "Source Name", fieldType: "text", requiredField: true, placeholder: "e.g. Returns & Refunds Policy" }`
    2. `{ fieldLabel: "Category", fieldType: "dropdown", requiredField: true, fieldOptions: { values: [ { option: "process" }, { option: "schema" }, { option: "troubleshooting" }, { option: "inventory" } ] } }`
    3. `{ fieldLabel: "Document Content", fieldType: "textarea", requiredField: true, placeholder: "Paste your document content here (Markdown supported)" }`
- Add a **Merge Form Input** Code node that transforms form data to match the existing pipeline format:
  ```javascript
  const formData = $input.first().json;
  return [{
    json: {
      body: {
        content: formData['Document Content'],
        source: formData['Source Name'],
        metadata: {
          category: formData['Category'],
          uploadedVia: 'form',
          uploadedAt: new Date().toISOString()
        }
      }
    }
  }];
  ```
- Connect: `Form Trigger` → `Merge Form Input` → `Validate & Chunk Input` (existing node)
- Keep the existing `Webhook Trigger` → `Validate & Chunk Input` connection intact
- Add a second **Respond to Webhook** node (or reuse the existing one) connected from `Prepare Response` for the form completion response. n8n Form Trigger with `responseMode: "responseNode"` uses the Respond to Webhook node to show a completion page.
- **IMPORTANT**: The existing `Respond to Webhook` node is already connected to `Prepare Response`. The Form Trigger should also be able to use this same response node — n8n routes the response back to the correct trigger automatically. Test both paths.
- Deploy the updated workflow via `PUT http://localhost:5678/api/v1/workflows/Lw3NwyIgKO4JmrZD` (remember: do NOT include the `active` field — it's read-only in PUT requests)
- Activate the workflow if needed via `POST http://localhost:5678/api/v1/workflows/Lw3NwyIgKO4JmrZD/activate`
- Test the form by opening `http://localhost:5678/form/meteo-doc-upload` in Playwright browser
- Submit a test document via the form and verify chunks appear in Supabase
- Test the existing webhook still works: `curl -X POST http://localhost:5678/webhook/meteo-doc-ingestion -H 'Content-Type: application/json' -d '{"content":"API test doc","source":"api-regression-test"}'`
- Clean up test documents from Supabase after verification

### 2. Test Orchestrator End-to-End Routing
- **Task ID**: test-orchestrator-e2e
- **Depends On**: none
- **Assigned To**: `builder-orchestrator-test`
- **Agent Type**: `general-purpose`
- **Parallel**: true (can run alongside Task 1)
- The Orchestrator webhook is at `POST http://localhost:5678/webhook/meteo-orchestrator`
- Input format: `{ "message": "...", "sessionId": "test-session-1", "context": "general" }`
- Run the following test cases and document results:

**Test Case 1 — OMS Data Query (should route to OMS Assistant):**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "How many orders are in Allocated status?", "sessionId": "e2e-test-1"}'
```
Expected: Response mentions "8 orders" in Allocated status (from Supabase oms.orders)

**Test Case 2 — RAG Documentation Query (should route to Knowledge Base):**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "What is the return policy for delivered orders? How long do customers have?", "sessionId": "e2e-test-2"}'
```
Expected: Response cites "Returns & Refunds Policy" with 7-day window

**Test Case 3 — Inventory Query (should route to OMS Assistant):**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "What is the stock level for store 004?", "sessionId": "e2e-test-3"}'
```
Expected: Response with inventory data from oms.inventory_stock

**Test Case 4 — Hybrid Diagnostic Query (may use both tools):**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "I have an order stuck in Allocated status. What could be wrong and can you check the latest allocated orders?", "sessionId": "e2e-test-4"}'
```
Expected: Response combines KB troubleshooting info with live data from OMS Assistant

**Test Case 5 — Context hint routing:**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "Show me recent events", "sessionId": "e2e-test-5", "context": "events"}'
```
Expected: Routes to OMS Assistant with event history query

**Test Case 6 — Edge case: No sessionId:**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "How many orders do we have?"}'
```
Expected: Auto-generates sessionId and responds normally

**Test Case 7 — Edge case: Invalid input:**
```bash
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": ""}'
```
Expected: Error response about missing/empty message

- For each test case, document: request, response, which sub-workflow was called (check n8n execution logs), pass/fail
- If any routing failures are found, investigate and fix the Orchestrator system prompt or Validate Input code
- Set timeout to 60s for each curl call (`--max-time 60`) since AI Agent calls can take time

### 3. Implement Persistent Chat Memory
- **Task ID**: implement-chat-memory
- **Depends On**: test-orchestrator-e2e (routing must work before adding memory complexity)
- **Assigned To**: `builder-chat-memory`
- **Agent Type**: `general-purpose`
- **Parallel**: false (depends on Task 2)
- **Step 3a: Research n8n Postgres Chat Memory node requirements**
  - The n8n node is `@n8n/n8n-nodes-langchain.memoryPostgresChat`
  - It requires a **Postgres** credential (host, port, database, user, password)
  - It creates/uses a table for storing chat messages (may have its own schema expectations)
  - Research the exact table schema the node expects — it may NOT match our existing `chat_memory` table
  - Check if the node auto-creates tables or requires a specific schema
  - To research: run `docker exec meteo-n8n find /usr/local/lib/node_modules/n8n -path "*memoryPostgresChat*" -name "*.js" | head -5` to find the node source, then inspect the table schema it uses

- **Step 3b: Create PostgreSQL credential on local n8n**
  - Use the n8n REST API to create a Postgres credential:
    ```
    POST http://localhost:5678/api/v1/credentials
    {
      "name": "Supabase PostgreSQL",
      "type": "postgres",
      "data": {
        "host": "aws-1-ap-northeast-2.pooler.supabase.com",
        "port": 6543,
        "database": "postgres",
        "user": "postgres.koyrtluetnitcxirinrx",
        "password": "GV9DKp5KeOYT435S",
        "ssl": "allow"
      }
    }
    ```
  - Note: The credential API may require different field names. Check n8n docs or Docker container for the correct Postgres credential schema.
  - Alternative: Create the credential manually via n8n UI at `http://localhost:5678/credentials`
  - Test the connection works by verifying via n8n UI

- **Step 3c: Update Orchestrator workflow — replace memory node**
  - Fetch current workflow: `GET http://localhost:5678/api/v1/workflows/BsfWa37nqDDYu7Sl`
  - Replace the `Window Buffer Memory` node (`@n8n/n8n-nodes-langchain.memoryBufferWindow` v1.3) with `Postgres Chat Memory` node (`@n8n/n8n-nodes-langchain.memoryPostgresChat`):
    ```json
    {
      "parameters": {
        "sessionIdType": "customKey",
        "sessionKey": "={{ $json.sessionId }}",
        "contextWindowLength": 10,
        "tableName": "n8n_chat_histories"
      },
      "name": "Postgres Chat Memory",
      "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
      "typeVersion": 1.3,
      "credentials": {
        "postgres": {
          "id": "<CREDENTIAL_ID>",
          "name": "Supabase PostgreSQL"
        }
      }
    }
    ```
  - Update connections: replace `Window Buffer Memory --(ai_memory)--> AI Agent` with `Postgres Chat Memory --(ai_memory)--> AI Agent`
  - **NOTE**: The Postgres Chat Memory node may use its own table name (typically `n8n_chat_histories`) with its own schema. If so, let it auto-create the table rather than trying to use our existing `chat_memory` table. The existing `chat_memory` table can remain for future standalone agent use.
  - Deploy via `PUT http://localhost:5678/api/v1/workflows/BsfWa37nqDDYu7Sl`

- **Step 3d: Test persistent memory**
  - Test 1 — Multi-turn conversation:
    ```bash
    # Turn 1
    curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
      -H 'Content-Type: application/json' \
      -d '{"message": "How many orders are in Allocated status?", "sessionId": "memory-test-1"}'

    # Turn 2 (same session — should remember context)
    curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
      -H 'Content-Type: application/json' \
      -d '{"message": "Can you show me the details of the first one?", "sessionId": "memory-test-1"}'
    ```
    Expected: Turn 2 should understand "the first one" refers to an Allocated order from Turn 1

  - Test 2 — Verify persistence in Supabase:
    ```sql
    SELECT session_id, length(messages::text) as msg_size, created_at
    FROM n8n_chat_histories
    ORDER BY created_at DESC LIMIT 5;
    ```

  - Test 3 — Session isolation:
    ```bash
    # Different session should NOT have previous context
    curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
      -H 'Content-Type: application/json' \
      -d '{"message": "Can you show me the details of the first one?", "sessionId": "memory-test-2"}'
    ```
    Expected: Should ask for clarification since no prior context in this session

  - Test 4 — Persistence across restart (if feasible):
    - Send a message with a known sessionId
    - Restart n8n container: `docker restart meteo-n8n`
    - Wait for n8n to come back up
    - Send a follow-up message with the same sessionId
    - Verify the conversation context is preserved
    - **WARNING**: Only do this restart test if the user approves — it temporarily takes down n8n

### 4. Final Validation
- **Task ID**: validate-all
- **Depends On**: add-form-trigger, test-orchestrator-e2e, implement-chat-memory
- **Assigned To**: `validator-final`
- **Agent Type**: `validator`
- **Parallel**: false
- **Validate Document Upload UI (Task 1):**
  - [ ] Form is accessible at `http://localhost:5678/form/meteo-doc-upload`
  - [ ] Form has 3 fields: Source Name (text), Category (dropdown with 4 options), Document Content (textarea)
  - [ ] Submitting the form creates chunks in Supabase `documents` table with correct metadata
  - [ ] Existing webhook API (`POST /webhook/meteo-doc-ingestion`) still works (regression test)
  - [ ] Form shows success message after submission

- **Validate Orchestrator Routing (Task 2):**
  - [ ] OMS data queries route to OMS Assistant and return live data
  - [ ] Documentation queries route to RAG Knowledge Base and return cited content
  - [ ] Inventory queries route to OMS Assistant with store/SKU data
  - [ ] Edge cases (empty input, missing sessionId) are handled gracefully
  - [ ] All test cases documented with pass/fail status

- **Validate Chat Memory (Task 3):**
  - [ ] Postgres Chat Memory node is configured in Orchestrator workflow
  - [ ] PostgreSQL credential for Supabase exists and is connected
  - [ ] Multi-turn conversations work — model remembers context within same sessionId
  - [ ] Different sessionIds are properly isolated
  - [ ] Chat history is stored in Supabase (check `n8n_chat_histories` or equivalent table)
  - [ ] Sub-workflows (OMS Assistant, RAG KB) remain stateless (no memory nodes)

- **Validate workflow integrity:**
  - [ ] All 5 workflows are active: Orchestrator, OMS Assistant, RAG KB, Ingestion Pipeline, Error Handler
  - [ ] Ingestion Pipeline has both Webhook Trigger AND Form Trigger
  - [ ] No broken connections in any workflow

- Run all validation commands listed below
- Provide comprehensive pass/fail report

## Acceptance Criteria

1. **Document Upload UI works:**
   - Browser form at `http://localhost:5678/form/meteo-doc-upload` with Source Name, Category, and Document Content fields
   - Form submission triggers the full ingestion pipeline (chunk → embed → store)
   - Existing webhook API continues to work (backward compatibility)
   - Success feedback shown to user after form submission

2. **Orchestrator routes correctly:**
   - OMS data queries (orders, inventory, events) → OMS Assistant → correct data returned
   - Documentation/process questions → RAG Knowledge Base → cited content returned
   - At least 5 test cases documented with pass/fail status
   - Error handling works for invalid input

3. **Chat memory persists:**
   - Multi-turn conversations maintain context within same sessionId
   - Conversations stored in Supabase PostgreSQL (not just in-memory)
   - Different sessions are properly isolated
   - Sub-workflows remain stateless (no memory nodes added)

4. **No regressions:**
   - All 5 existing workflows remain active and functional
   - Webhook-based ingestion still works
   - OMS Assistant and RAG KB still work independently via Chat UI

## Validation Commands
Execute these commands to validate the task is complete:

### Task 1 — Document Upload UI
```bash
# Check form is accessible (should return HTML form page)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/form/meteo-doc-upload
# Expected: 200

# Test webhook API still works (regression)
curl -s -X POST http://localhost:5678/webhook/meteo-doc-ingestion \
  -H 'Content-Type: application/json' \
  -d '{"content":"Validation test document for regression check","source":"validation-test","metadata":{"category":"process"}}'
# Expected: {"success":true, "message":"Document ingested successfully..."}

# Verify test document in Supabase
# SQL: SELECT count(*) FROM documents WHERE metadata->>'source' = 'validation-test'
# Expected: >= 1 chunk
```

### Task 2 — Orchestrator Routing
```bash
# OMS routing test
curl -s --max-time 60 -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "How many orders are in Allocated status?", "sessionId": "validate-1"}'
# Expected: Response with order count (8 allocated)

# RAG routing test
curl -s --max-time 60 -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "What does the order fulfillment process look like?", "sessionId": "validate-2"}'
# Expected: Response citing knowledge base documents

# Error handling test
curl -s -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": ""}'
# Expected: Error response about empty message
```

### Task 3 — Chat Memory
```bash
# Multi-turn test — Turn 1
curl -s --max-time 60 -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "How many orders do we have total?", "sessionId": "validate-memory-1"}'

# Multi-turn test — Turn 2 (should reference previous context)
curl -s --max-time 60 -X POST http://localhost:5678/webhook/meteo-orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"message": "And how many of those are in Fulfilled status?", "sessionId": "validate-memory-1"}'
# Expected: Understands "those" refers to orders from Turn 1
```

### Supabase Validation (via Supabase MCP)
```sql
-- Check documents table has form-uploaded content
SELECT metadata->>'source' as source, metadata->>'uploadedVia' as via, count(*) as chunks
FROM documents
WHERE metadata->>'uploadedVia' = 'form'
GROUP BY 1, 2;

-- Check chat memory persistence
SELECT session_id, created_at FROM n8n_chat_histories ORDER BY created_at DESC LIMIT 5;
```

### Workflow Validation
```bash
# List all workflows and check they're active
curl -s http://localhost:5678/api/v1/workflows \
  -H 'X-N8N-API-KEY: <API_KEY>' | python3 -c "
import sys, json
data = json.load(sys.stdin)
for w in data['data']:
    print(f\"{w['id']} | {w['name']} | active={w['active']}\")
"
# Expected: All 5 workflows active
```

## Notes
- **n8n API quirk**: The `active` field is read-only in PUT requests. Never include it when updating workflows via API — use the separate activate/deactivate endpoints instead.
- **Form Trigger URL**: Production URL is `http://localhost:5678/form/<path>` (when workflow is active). Test URL is `http://localhost:5678/form-test/<path>` (when using "Execute workflow" in editor).
- **Postgres Chat Memory table**: The n8n node may auto-create its own table (often `n8n_chat_histories`) rather than using our existing `chat_memory` table. This is fine — let it manage its own schema. The existing `chat_memory` table remains available for the standalone agent.
- **Supabase connection pooling**: Use port `6543` (PgBouncer pooler) for the Postgres credential, NOT `5432` (direct). Pooler handles connection limits better for n8n's connection pattern.
- **Credential creation via API**: The n8n REST API for credential creation may require encrypted data. If API creation fails, create the credential manually via the n8n UI at `http://localhost:5678/credentials` and note the resulting credential ID for the workflow update.
- **Docker restart for memory test**: The Task 3 restart test (`docker restart meteo-n8n`) is optional and should only be done with user approval, as it temporarily takes down all n8n workflows.
- **OpenRouter Chat Model**: The Orchestrator uses `lmChatOpenRouter` v1 (native OpenRouter node), NOT `lmChatOpenAi` with base URL override. This is different from the OMS Assistant and RAG KB which use `lmChatOpenAi` with OpenRouter base URL. Both patterns work.
- **Sub-workflow memory constraint**: NEVER add memory to OMS Assistant or RAG KB workflows. They are called via `toolWorkflow` which does not propagate sessionId, causing "No session ID found" errors. Only the Orchestrator should have memory.
