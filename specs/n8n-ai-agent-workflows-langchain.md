# Plan: Implement n8n AI Agent Workflows with LangChain for Meteo

## Task Description
Based on comprehensive research into n8n AI Agent workflows with LangChain (see `reseach/n8n AI Agent workflows with LangChain.md`), implement a full suite of AI agent workflows on the Meteo project's existing n8n Cloud instance (`metero.app.n8n.cloud`). The implementation covers:

1. **Supabase pgvector setup** for RAG vector storage
2. **Document ingestion pipeline** for OMS documentation, SOPs, and troubleshooting guides
3. **OMS AI Assistant Agent** — an intelligent chat agent querying across all 4 OMS schemas (orders, inventory, event logs, auth)
4. **RAG Knowledge Base Agent** — retrieval-augmented generation for documentation search
5. **Multi-Agent Orchestrator** — a master agent that delegates to specialized sub-workflows
6. **Error handling, memory, and guardrails** across all workflows
7. **Documentation** — comprehensive README.md update

Each workflow will be created directly on n8n Cloud via the n8n MCP server tools (`mcp__n8n-mcp__*`).

## Objective
When this plan is complete, the Meteo project will have a fully functional suite of n8n AI Agent workflows with LangChain that:
- Provides an intelligent OMS assistant that can query orders, check shipping, look up inventory levels (9.6M stock rows across 60 stores), and trace event history (16,896 workflow events)
- Implements RAG for documentation and SOP search using Supabase pgvector
- Uses a multi-agent orchestrator pattern for complex operations
- Follows all best practices from the research (error handling, memory management, guardrails, security)
- Is fully documented in README.md

## Problem Statement
The Meteo project (OMS, Slick Picking Tool) currently has only a basic n8n workflow (a scheduled HTTP request to Google). There are no AI agent capabilities despite the tech stack being ideal for it (n8n Cloud + Supabase + LangChain). The research identified several problems that AI agents can solve:

1. **Operators lack intelligent query capabilities** — they can't ask natural language questions about orders, check inventory levels across stores, or trace fulfillment event history
2. **No centralized documentation search** — warehouse workers can't quickly find SOPs or troubleshooting guides
3. **No intelligent automation** — complex multi-step operations still require manual coordination
4. **No conversation memory** — interactions are stateless with no context persistence
5. **No RAG pipeline** — documents aren't embedded or searchable via semantic search

## Solution Approach
Implement a layered architecture of n8n workflows using LangChain nodes:

```
Layer 1: Foundation
├── Supabase pgvector setup (via Supabase MCP — direct SQL execution)
├── Credential configuration on n8n Cloud
└── Shared utility sub-workflows

Layer 2: Core Workflows
├── Document Ingestion Pipeline (embed & store docs)
├── OMS AI Assistant (Tools Agent + Supabase tools across oms-order, public, support, oms-authentication schemas)
├── Inventory Query Tools (public schema — stock levels, product/location masters, daily snapshots)
├── Event Log Tools (support schema — workflow events, fulfillment tracking)
└── RAG Knowledge Base Agent (Vector Store Retriever)

Layer 3: Orchestration
├── Multi-Agent Orchestrator (delegates to Layer 2 workflows)
└── Error handling & monitoring wrapper

Layer 4: Documentation
└── README.md update with architecture, setup, and usage
```

Each workflow uses the **Tools Agent** type (most reliable) with:
- **LLM**: OpenRouter API (access to GPT-4o, Claude, Llama, etc. via single API key) — OpenAI-compatible base URL: `https://openrouter.ai/api/v1`
- **Memory**: Window Buffer Memory (5-10 messages) for chat, Postgres Chat Memory for persistence
- **Tools**: Supabase query tools, HTTP Request tools, Code tools, Vector Store Retriever, Call n8n Workflow
- **Error Handling**: Max iterations (10), error branches, fallback responses
- **Security**: Credentials via n8n credential system, input sanitization, rate limiting

## Relevant Files
Use these files to complete the task:

- `reseach/n8n AI Agent workflows with LangChain.md` — Comprehensive research document with all technical details, best practices, and architecture patterns. **This is the primary reference for all implementation.**
- `.mcp.json` — MCP server configuration with n8n Cloud endpoint (`metero.app.n8n.cloud`), Supabase MCP (`koyrtluetnitcxirinrx`), and other tools. Used for all n8n workflow creation and Supabase database operations.
- `CLAUDE.md` — Project overview, structure, and **comprehensive OMS database schema documentation** covering all 4 schemas (`oms-order`, `public`, `support`, `oms-authentication`) on the OMS PostgreSQL database (`10.77.3.102:5432/twd_oms_test`). Primary reference for table structures, row counts, and data relationships.
- `.claude/agents/team/builder.md` — Builder agent definition for task execution.
- `.claude/agents/team/validator.md` — Validator agent definition for verification.

### MCP Tools Available
- **n8n MCP** (`mcp__n8n-mcp__*`) — Create/manage workflows on `metero.app.n8n.cloud`
- **Supabase MCP** (`mcp__supabase__*`) — Direct SQL execution, table management, and database operations on Supabase project `koyrtluetnitcxirinrx`. **Used for RAG/vector storage only** (documents, chat_memory, embeddings).
- **Playwright MCP** (`mcp__playwright__*`) — Browser automation for testing
- **Firecrawl MCP** (`mcp__firecrawl-mcp__*`) — Web scraping for research

> **Note: OMS Database is a separate PostgreSQL instance.** The OMS data (orders, inventory, event logs, auth) lives on an external PostgreSQL database at `10.77.3.102:5432/twd_oms_test` -- this is NOT Supabase. n8n workflows that query OMS data (e.g., the OMS AI Assistant) will need a **PostgreSQL credential configured on n8n Cloud** pointing to this host. Supabase is used exclusively for RAG vector storage and chat memory.

### New Files
- `specs/n8n-ai-agent-workflows-langchain.md` — This plan document (already created)
- `README.md` — Project README with full documentation of the implemented AI agent system

### n8n Workflows to Create (on n8n Cloud)
These are not local files — they are n8n workflows created via the MCP server:
1. **"Meteo - Document Ingestion Pipeline"** — Ingests, chunks, embeds, and stores documents (writes to Supabase)
2. **"Meteo - OMS AI Assistant"** — Chat-triggered AI agent for OMS queries. **Queries the external OMS PostgreSQL database** (`10.77.3.102:5432/twd_oms_test`) for order, inventory, and event data -- NOT Supabase. Requires a PostgreSQL credential on n8n Cloud.
3. **"Meteo - RAG Knowledge Base"** — Chat-triggered RAG agent for documentation search (reads from Supabase vector store)
4. **"Meteo - Orchestrator Agent"** — Master agent that delegates to sub-workflows
5. **"Meteo - Error Handler"** — Shared error handling sub-workflow

## Implementation Phases

### Phase 1: Foundation
- Set up Supabase pgvector extension and required tables (documents, embeddings, chat_memory)
- Configure n8n credentials (OpenAI API key, Supabase connection)
- Create shared error handling sub-workflow on n8n Cloud
- Verify n8n Cloud connectivity via MCP tools

### Phase 2: Core Implementation
- Build the Document Ingestion Pipeline workflow
- Build the OMS AI Assistant workflow with Tools Agent, Supabase tools, and memory
- Build the RAG Knowledge Base workflow with Vector Store Retriever
- Test each workflow independently

### Phase 3: Integration & Polish
- Build the Multi-Agent Orchestrator that delegates to sub-workflows
- Add comprehensive error handling, guardrails, and input validation
- Test end-to-end flow from orchestrator through sub-agents
- Update README.md with complete documentation

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
  - Name: `builder-foundation`
  - Role: Sets up Supabase pgvector tables/functions via Supabase MCP and creates n8n shared error handling workflow
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-ingestion`
  - Role: Creates the Document Ingestion Pipeline workflow on n8n Cloud
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-oms-agent`
  - Role: Creates the OMS AI Assistant workflow on n8n Cloud
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-rag-agent`
  - Role: Creates the RAG Knowledge Base workflow on n8n Cloud
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-orchestrator`
  - Role: Creates the Multi-Agent Orchestrator workflow on n8n Cloud
  - Agent Type: `general-purpose`
  - Resume: true

- Builder
  - Name: `builder-docs`
  - Role: Updates README.md with comprehensive documentation of the entire AI agent system
  - Agent Type: `general-purpose`
  - Resume: false

- Validator
  - Name: `validator-final`
  - Role: Validates all workflows exist on n8n Cloud, checks README.md completeness, verifies workflow configurations
  - Agent Type: `validator`
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Set Up Foundation — Supabase pgvector & Error Handler Workflow
- **Task ID**: setup-foundation
- **Depends On**: none
- **Assigned To**: `builder-foundation`
- **Agent Type**: `general-purpose`
- **Parallel**: false (must complete first)
- Read the research document at `reseach/n8n AI Agent workflows with LangChain.md` for full context on the architecture
- Read `.mcp.json` for the n8n Cloud MCP configuration and Supabase MCP configuration
- **Set up Supabase pgvector database** using Supabase MCP tools (`mcp__supabase__*`):
  - Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
  - Create `documents` table for RAG storage:
    ```sql
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    ```
  - Create `chat_memory` table for conversation persistence:
    ```sql
    CREATE TABLE IF NOT EXISTS chat_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      messages JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX ON chat_memory (session_id);
    ```
  - Create similarity search function for RAG:
    ```sql
    CREATE OR REPLACE FUNCTION match_documents(
      query_embedding vector(1536),
      match_threshold FLOAT DEFAULT 0.78,
      match_count INT DEFAULT 5
    )
    RETURNS TABLE (
      id UUID,
      content TEXT,
      metadata JSONB,
      similarity FLOAT
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
      FROM documents
      WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
      ORDER BY documents.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
    ```
  - Verify all tables and functions were created by querying Supabase
- **Configure OMS PostgreSQL credential on n8n Cloud** (separate from Supabase — this is the OMS database):
  - The OMS database is a standalone PostgreSQL instance at `10.77.3.102:5432/twd_oms_test` (user: `postgres`). It is NOT Supabase.
  - On n8n Cloud, create a **Postgres** credential named **"OMS PostgreSQL"** (Settings > Credentials > Add Credential > Postgres):
    - Host: `10.77.3.102`
    - Port: `5432`
    - Database: `twd_oms_test`
    - User: `postgres`
    - Password: (obtain from team or environment variables — do not hardcode)
  - This credential is used by PostgreSQL Execute tool nodes in the OMS AI Assistant workflow to query across 4 schemas:
    - `"oms-order"` — 20 tables including orders (110 rows), order_lines (244), allocations (280), releases (145), release_lines (242), fulfillment_details (238), payments (110)
    - `public` — inventory: `00_inventory_stock` (9.6M rows), `00_inventory_stock_full` (86.5M rows), `00_inventory_delta` (34 rows) across 60 stores, 160,310 SKUs
    - `support` — `log_workflow_events` (16,896 rows) with 12 event types tracking order lifecycle
    - `"oms-authentication"` — user and authentication data
  - Note: Schema names `oms-order` and `oms-authentication` contain hyphens and must be double-quoted in SQL (e.g., `"oms-order".orders`)
  - The n8n MCP tools cannot create credentials programmatically — this must be done manually on n8n Cloud. Verify the credential works by testing the connection.
- **Configure OpenRouter API credential on n8n Cloud** (unified LLM gateway — provides access to GPT-4o, Claude, Llama, and 200+ models via a single API key):
  - On n8n Cloud, create an **OpenAI-compatible** credential named **"OpenRouter"** (Settings > Credentials > Add Credential > OpenAI):
    - API Key: (obtain from `env/key.md` — starts with `sk-or-v1-`)
    - Base URL: `https://openrouter.ai/api/v1`
  - OpenRouter is OpenAI-compatible — n8n's OpenAI Chat Model node works with it by overriding the base URL
  - Default model: `google/gemini-3-flash-preview` — fast, cost-effective, strong function calling support
  - Alternative models if needed:
    - `anthropic/claude-sonnet-4` — best reasoning capability
    - `openai/gpt-4o` — strong function calling support
  - Rate limits: Standard tier, 20 req/min for free models. Check credits via `GET https://openrouter.ai/api/v1/key`
  - This credential is used by all AI Agent workflow LLM sub-nodes as the **preferred LLM provider**
- Use `mcp__n8n-mcp__search_workflows` to verify current workflows on n8n Cloud
- Create a new n8n workflow **"Meteo - Error Handler"** using n8n MCP tools. This workflow should:
  - Accept error input via webhook trigger
  - Log error details (node name, error message, workflow name, timestamp)
  - Send error notification (placeholder for Slack/email integration)
  - Return structured error response
- Verify the workflow was created successfully by listing workflows

### 2. Create Document Ingestion Pipeline Workflow
- **Task ID**: build-ingestion-pipeline
- **Depends On**: setup-foundation
- **Assigned To**: `builder-ingestion`
- **Agent Type**: `general-purpose`
- **Parallel**: false
- Read the research document at `reseach/n8n AI Agent workflows with LangChain.md` — focus on "Implementation Guide > Step 3: Build a RAG Pipeline" and "RAG Architecture"
- Read `.mcp.json` for n8n Cloud connection details
- Create a new n8n workflow **"Meteo - Document Ingestion Pipeline"** on n8n Cloud using `mcp__n8n-mcp__*` tools. The workflow should include:
  - **Webhook Trigger** — accepts POST with document content (text/URL/file)
  - **Document Loader** — Default Data Loader for text input
  - **Text Splitter** — Recursive Character Text Splitter (chunk size: 1000, overlap: 200)
  - **Embeddings** — OpenAI Embeddings (model: text-embedding-3-small)
  - **Vector Store** — Supabase Vector Store (upsert to documents table with pgvector)
  - **Error Handling** — Error branch that calls the "Meteo - Error Handler" sub-workflow
  - **Response** — Returns success/failure with document count and chunk count
- Verify the workflow was created via `mcp__n8n-mcp__search_workflows`
- Test by describing the expected input/output format
- **Note**: The OMS schema documentation from `CLAUDE.md` (covering all 4 schemas, table structures, and data relationships) should be one of the first documents ingested into the RAG knowledge base after this workflow is operational

### 3. Create OMS AI Assistant Workflow
- **Task ID**: build-oms-assistant
- **Depends On**: setup-foundation
- **Assigned To**: `builder-oms-agent`
- **Agent Type**: `general-purpose`
- **Parallel**: true (can run alongside Task 2)
- Read the research document at `reseach/n8n AI Agent workflows with LangChain.md` — focus on "Relevance to Meteo Project > 1. OMS AI Assistant" and "Key Concepts > AI Agents"
- Read `CLAUDE.md` for comprehensive OMS database schema documentation (all 4 schemas, table structures, column names, row counts, relationships)
- Read `.mcp.json` for n8n Cloud connection details
- Create a new n8n workflow **"Meteo - OMS AI Assistant"** on n8n Cloud. The workflow should include:
  - **Chat Trigger** — for interactive testing and production chat
  - **AI Agent Node** — Tools Agent type (most reliable for function calling)
  - **LLM Sub-Node** — OpenAI Chat Model via **OpenRouter** credential (base URL: `https://openrouter.ai/api/v1`, model: `google/gemini-3-flash-preview`) with system prompt:
    ```
    You are the Meteo OMS AI Assistant. You help operators manage orders, check inventory, track fulfillment, and answer operational questions by querying the OMS PostgreSQL database (10.77.3.102:5432/twd_oms_test).

    ## Database Schemas

    The OMS database has 4 schemas. Schema names with hyphens MUST be double-quoted in SQL.

    ### Schema: "oms-order" (Order Management — 20 tables)
    Key tables:
    - "oms-order".orders — 110 orders. Columns: order_id (UUID PK), short_order_number, customer_first_name, customer_last_name, customer_email, order_status, fulfillment_status, payment_status, order_total, created_at
    - "oms-order".order_lines — 244 rows. Columns: order_line_id, order_id (FK), sku, product_name, quantity, unit_price, line_total
    - "oms-order".allocations — 280 rows. Columns: allocation_id, order_line_id, store_id, allocated_quantity, allocation_status
    - "oms-order".releases — 145 rows. Columns: release_id, order_id, store_id, release_status, release_type
    - "oms-order".release_lines — 242 rows. Columns: release_line_id, release_id, order_line_id, quantity
    - "oms-order".fulfillment_details — 238 rows. Columns: fulfillment_id, release_line_id, fulfillment_status, tracking_number, carrier
    - "oms-order".payments — 110 rows. Columns: payment_id, order_id, payment_status, payment_method, amount

    Order status flow: Open -> Allocated -> Released -> In Process -> Picked -> Fulfilled -> Delivered
    Payment statuses: Authorized, Awaiting Invoice, Paid

    ### Schema: public (Inventory — 3 tables)
    - public."00_inventory_stock" — 9.6M rows. Columns: channel_id, store_id, store_format_id, sku, onhand, reserved, inbound. Covers 60 stores, 160,310 SKUs.
    - public."00_inventory_stock_full" — 86.5M rows. Columns: store_id, sku, onhand, safety, uom
    - public."00_inventory_delta" — 34 rows. Columns: store_id, sku, qty_change, event_type (inbound/reserved)
    WARNING: Inventory tables are very large. ALWAYS filter by store_id AND/OR sku. Never run unfiltered queries.

    ### Schema: support (Event Logs — 1 table)
    - support.log_workflow_events — 16,896 rows (weekly partitioned). Columns: order_id, entity_type, event_type, previous_status, new_status, event_payload (jsonb), created_at
    Event types: ORDER_CREATED, ORDER_VALIDATED, PROMISING_REQUESTED, ALLOCATION_CREATED, RELEASE_CREATED, RELEASE_LINE_CREATED, RELEASE_SENT_TO_STORE, FULFILLMENT_PACKED, FULFILLMENT_PICKED, FULFILLMENT_SHIPPED, FULFILLMENT_STATUS_UPDATED, FULFILLMENT_DELIVERED

    ### Schema: "oms-authentication" (Auth)
    - User and OAuth2 authentication data. Rarely queried directly.

    ## Guidelines
    - Always provide specific, actionable answers with order IDs, statuses, and dates
    - When querying orders, join with order_lines, releases, or fulfillment_details as needed for complete answers
    - For inventory queries, ALWAYS ask for store_id and/or sku filters before querying — the tables are too large for unfiltered scans
    - For event history, filter by order_id and optionally by created_at date range
    - If you cannot find the requested information, say so clearly
    - Never make up data — only report what the database tools return
    - Use short_order_number when displaying order references to users (more human-readable than UUID)
    ```
  - **Tool Sub-Nodes** (all use the **"OMS PostgreSQL"** credential configured in Task 1):
    - **PostgreSQL Execute Tool** — "Query Orders": Executes parameterized SQL against `"oms-order".orders`, `"oms-order".order_lines`, and `"oms-order".payments`. Used for order lookups by short_order_number, customer name/email, order status, date range. Example: `SELECT o.short_order_number, o.order_status, o.fulfillment_status, o.payment_status, o.order_total, o.created_at FROM "oms-order".orders o WHERE o.short_order_number = $1`
    - **PostgreSQL Execute Tool** — "Check Fulfillment & Shipping": Executes SQL against `"oms-order".releases`, `"oms-order".release_lines`, and `"oms-order".fulfillment_details`. Used for tracking shipment status, carrier info, tracking numbers. Example: `SELECT r.release_id, r.release_status, fd.fulfillment_status, fd.tracking_number, fd.carrier FROM "oms-order".releases r JOIN "oms-order".release_lines rl ON r.release_id = rl.release_id JOIN "oms-order".fulfillment_details fd ON rl.release_line_id = fd.release_line_id WHERE r.order_id = $1`
    - **PostgreSQL Execute Tool** — "Check Inventory": Executes SQL against `public."00_inventory_stock"`. Used for stock availability checks by store and SKU. Example: `SELECT store_id, sku, onhand, reserved, inbound, (onhand - reserved) as available FROM public."00_inventory_stock" WHERE store_id = $1 AND sku = $2`
    - **PostgreSQL Execute Tool** — "Order Event History": Executes SQL against `support.log_workflow_events`. Used for tracing order lifecycle events and status transitions. Example: `SELECT event_type, previous_status, new_status, created_at, event_payload FROM support.log_workflow_events WHERE order_id = $1 ORDER BY created_at ASC`
    - **Code Tool** — "Format Response" (formats query results into readable tabular or summary output)
  - **Memory Sub-Node** — Window Buffer Memory (last 10 messages)
  - **Output Parser** — Structured output for consistent responses
  - **Error Handling** — Max iterations: 10, error branch to Error Handler
  - **Guardrails** — Input validation node before AI Agent to sanitize user input and prevent SQL injection
- Verify the workflow was created successfully

### 4. Create RAG Knowledge Base Workflow
- **Task ID**: build-rag-knowledge-base
- **Depends On**: build-ingestion-pipeline
- **Assigned To**: `builder-rag-agent`
- **Agent Type**: `general-purpose`
- **Parallel**: true (can run alongside Task 3, but depends on Task 2)
- Read the research document — focus on "RAG Architecture" and "Relevance to Meteo > 2. RAG for Documentation & SOPs"
- Read `.mcp.json` for n8n Cloud connection details
- Create a new n8n workflow **"Meteo - RAG Knowledge Base"** on n8n Cloud. The workflow should include:
  - **Chat Trigger** — for interactive document search
  - **AI Agent Node** — Tools Agent type
  - **LLM Sub-Node** — OpenAI Chat Model via **OpenRouter** credential (base URL: `https://openrouter.ai/api/v1`, model: `google/gemini-3-flash-preview`) with system prompt:
    ```
    You are the Meteo Knowledge Base Assistant. You help warehouse workers and operators find information in OMS documentation, SOPs, and troubleshooting guides.

    Your knowledge base covers:
    - Order workflow procedures (creation, payment, fulfillment, shipping, delivery)
    - Inventory management procedures (stock checks, replenishment, cycle counts across 60 stores)
    - Fulfillment and picking processes (Slick Picking Tool usage, warehouse operations)
    - Troubleshooting guides for common OMS issues

    Guidelines:
    - Always cite the source document when answering
    - If the retrieved documents don't contain the answer, say "I couldn't find this in the knowledge base"
    - Provide step-by-step instructions when explaining procedures
    - Use simple, clear language suitable for warehouse workers
    ```
  - **Tool Sub-Nodes**:
    - **Vector Store Retriever Tool** — Supabase Vector Store with similarity search (top_k: 5)
    - **Code Tool** — "Format Citations" (adds source document references to responses)
  - **Memory Sub-Node** — Window Buffer Memory (last 5 messages)
  - **Error Handling** — Max iterations: 8, error branch to Error Handler
- Verify the workflow was created successfully

### 5. Create Multi-Agent Orchestrator Workflow
- **Task ID**: build-orchestrator
- **Depends On**: build-oms-assistant, build-rag-knowledge-base
- **Assigned To**: `builder-orchestrator`
- **Agent Type**: `general-purpose`
- **Parallel**: false (depends on both sub-agent workflows)
- Read the research document — focus on "Relevance to Meteo > 4. Multi-Agent Orchestration" and "Step 4: Configure Sub-Agent Workflows"
- Read `.mcp.json` for n8n Cloud connection details
- Use `mcp__n8n-mcp__search_workflows` to find the workflow IDs of:
  - "Meteo - OMS AI Assistant"
  - "Meteo - RAG Knowledge Base"
  - "Meteo - Document Ingestion Pipeline"
- Create a new n8n workflow **"Meteo - Orchestrator Agent"** on n8n Cloud. The workflow should include:
  - **Webhook Trigger** — accepts POST with `{ "message": "...", "sessionId": "...", "context": "oms|inventory|events|knowledge|general" }`
  - **AI Agent Node** — Tools Agent type (orchestrator)
  - **LLM Sub-Node** — OpenAI Chat Model via **OpenRouter** credential (base URL: `https://openrouter.ai/api/v1`, model: `google/gemini-3-flash-preview`) with system prompt:
    ```
    You are the Meteo AI Orchestrator. You route requests to the appropriate specialist.

    The OMS Assistant queries the OMS PostgreSQL database (10.77.3.102:5432/twd_oms_test) across 4 schemas. Route to it for any live data queries:
    - Order queries, status checks, payments, shipping/fulfillment → OMS Assistant (queries oms-order schema)
    - Inventory checks, stock levels, store availability, product/location lookups → OMS Assistant (queries public schema — 9.6M stock rows, 60 stores, 160K SKUs)
    - Order event history, status change timelines, workflow event logs → OMS Assistant (queries support schema — 16,896 events, 12 event types)

    For non-data requests:
    - Documentation, SOPs, troubleshooting guides, how-to procedures → use the "Knowledge Base" tool
    - Document ingestion requests (adding new docs to the knowledge base) → use the "Ingest Document" tool

    Always determine the best specialist for the request. If unclear, ask the user for clarification.
    ```
  - **Tool Sub-Nodes**:
    - **Call n8n Workflow Tool** — "OMS Assistant" (calls Meteo - OMS AI Assistant workflow)
    - **Call n8n Workflow Tool** — "Knowledge Base" (calls Meteo - RAG Knowledge Base workflow)
    - **Call n8n Workflow Tool** — "Ingest Document" (calls Meteo - Document Ingestion Pipeline)
    - **HTTP Request Tool** — "Send Notification" (placeholder for Slack/email notifications)
  - **Memory Sub-Node** — Window Buffer Memory (last 10 messages) with session ID from input
  - **Error Handling** — Max iterations: 15 (higher for orchestrator), comprehensive error branch
  - **Input Validation** — Code node before AI Agent to validate and sanitize input
  - **Response** — Webhook Response node with structured JSON output
- Verify the workflow was created and test connectivity to sub-workflows

### 6. Update README.md Documentation
- **Task ID**: update-documentation
- **Depends On**: build-orchestrator
- **Assigned To**: `builder-docs`
- **Agent Type**: `general-purpose`
- **Parallel**: false (needs all workflows created first)
- Read the research document at `reseach/n8n AI Agent workflows with LangChain.md` for full context
- Read the current `CLAUDE.md` for project context
- Use `mcp__n8n-mcp__search_workflows` to list all created workflows and their IDs
- Create/update `README.md` at the project root with the following sections:
  - **Project Overview** — Meteo project with AI agent capabilities
  - **Architecture** — Mermaid diagram showing Vercel → n8n → Supabase architecture (from research)
  - **Database Architecture** — Document the multi-schema OMS database:
    - OMS PostgreSQL database at `10.77.3.102:5432/twd_oms_test` (separate from Supabase)
    - 4 schemas: `oms-order` (orders, payments, fulfillment — 20 tables), `public` (inventory — 9.6M stock rows, 60 stores, 160K SKUs), `support` (workflow event log — 16,896 events, 12 event types), `oms-authentication` (OAuth2 auth — 5 tables)
    - Supabase (`koyrtluetnitcxirinrx`) used exclusively for RAG vector storage and chat memory
    - How the OMS AI Assistant queries across schemas via PostgreSQL credential on n8n Cloud
  - **AI Agent Workflows** — Description of each workflow:
    - Orchestrator Agent (entry point — routes to OMS Assistant for orders/inventory/events, Knowledge Base for docs)
    - OMS AI Assistant (queries all 4 OMS schemas on the external PostgreSQL database)
    - RAG Knowledge Base
    - Document Ingestion Pipeline
    - Error Handler
  - **Setup Guide** — Step-by-step setup instructions:
    1. Supabase pgvector setup (already automated via Supabase MCP — document the SQL for reference)
    2. OMS PostgreSQL credential on n8n Cloud (host: `10.77.3.102`, port: `5432`, database: `twd_oms_test`)
    3. n8n Cloud credentials configuration
    4. OpenAI API key setup
    5. Workflow activation order
    6. Supabase MCP configuration (project ref: `koyrtluetnitcxirinrx`)
  - **Usage** — How to interact with each workflow:
    - Webhook endpoints
    - Chat interface usage
    - Document ingestion API
    - Inventory queries (e.g., "Check stock for SKU X at store Y", "Which stores have low stock on product Z?")
    - Event history queries (e.g., "Show the timeline of events for order #123", "What happened to fulfillment for order X?")
  - **Best Practices** — Key best practices from the research
  - **Tech Stack** — n8n, LangChain.js, Supabase (pgvector), OpenAI, PostgreSQL (OMS), Vercel
  - **Project Structure** — Updated directory structure
- The README should be comprehensive, well-formatted, and include code examples for API calls

### 7. Final Validation
- **Task ID**: validate-all
- **Depends On**: update-documentation
- **Assigned To**: `validator-final`
- **Agent Type**: `validator`
- **Parallel**: false
- **Validate Supabase database** using Supabase MCP tools (`mcp__supabase__*`):
  - [ ] `pgvector` extension is enabled
  - [ ] `documents` table exists with correct schema (id, content, metadata, embedding vector(1536), created_at)
  - [ ] `chat_memory` table exists with correct schema (id, session_id, messages, created_at, updated_at)
  - [ ] `match_documents` function exists and is callable
  - [ ] Index on `documents.embedding` exists (ivfflat)
  - [ ] Index on `chat_memory.session_id` exists
- Use `mcp__n8n-mcp__search_workflows` to verify ALL 5 workflows exist on n8n Cloud:
  - [ ] "Meteo - Error Handler"
  - [ ] "Meteo - Document Ingestion Pipeline"
  - [ ] "Meteo - OMS AI Assistant"
  - [ ] "Meteo - RAG Knowledge Base"
  - [ ] "Meteo - Orchestrator Agent"
- Use `mcp__n8n-mcp__get_workflow_details` on each workflow to verify:
  - [ ] Each has appropriate trigger nodes
  - [ ] Each has AI Agent or Chain nodes configured
  - [ ] Each has error handling
- Read `README.md` and verify:
  - [ ] All sections listed above are present
  - [ ] Architecture diagram is included
  - [ ] Setup guide is complete
  - [ ] All 5 workflows are documented
- Read `CLAUDE.md` and verify project structure is still accurate
- **Validate OMS PostgreSQL connectivity and workflow configuration**:
  - [ ] Verify the OMS PostgreSQL credential exists on n8n Cloud (or is documented as a required setup step)
  - [ ] Verify the "Meteo - OMS AI Assistant" workflow has PostgreSQL tool nodes (not just HTTP Request) for querying the OMS database
  - [ ] Verify the OMS AI Assistant system prompt references real table names from all 4 OMS schemas (`oms-order`, `public`, `support`, `oms-authentication`)
  - [ ] Verify the orchestrator routing includes inventory query and event history capabilities (not just order lookups)
- Run all validation commands listed below
- Provide a comprehensive pass/fail report

## Acceptance Criteria

1. **5 n8n workflows exist on n8n Cloud**:
   - "Meteo - Error Handler" — active, with webhook trigger
   - "Meteo - Document Ingestion Pipeline" — active, with webhook trigger and AI nodes
   - "Meteo - OMS AI Assistant" — active, with chat trigger and Tools Agent
   - "Meteo - RAG Knowledge Base" — active, with chat trigger and Tools Agent
   - "Meteo - Orchestrator Agent" — active, with webhook trigger and Tools Agent

2. **Each workflow follows research best practices**:
   - Tools Agent type used (not ReAct)
   - Max iterations configured (8-15 depending on complexity)
   - Error handling branches present
   - Memory configured (Window Buffer Memory)
   - System prompts are detailed and specific

3. **Orchestrator correctly references sub-workflows**:
   - Can invoke OMS Assistant
   - Can invoke RAG Knowledge Base
   - Can invoke Document Ingestion Pipeline
   - Routing includes inventory queries and event history capabilities (not only orders)

4. **OMS AI Assistant queries all relevant schemas**:
   - Can query orders and payments from `oms-order` schema
   - Can query inventory/stock from `public` schema (with store_id/sku filters)
   - Can query workflow event history from `support` schema
   - System prompt references actual schema and table names
   - OMS PostgreSQL connection credential is configured or documented as a required setup step

5. **README.md is comprehensive**:
   - Architecture diagram present (Mermaid)
   - All 5 workflows documented
   - Setup guide with SQL migrations
   - Usage examples with curl/API calls
   - Tech stack listed

6. **Supabase database is fully provisioned** (verified via Supabase MCP):
   - pgvector extension enabled
   - `documents` table with vector(1536) column and ivfflat index
   - `chat_memory` table with session_id index
   - `match_documents` similarity search function operational

## Validation Commands
Execute these commands to validate the task is complete:

- **Supabase validation** (via Supabase MCP `mcp__supabase__*`):
  - Query: `SELECT extname FROM pg_extension WHERE extname = 'vector';` — verify pgvector is enabled
  - Query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('documents', 'chat_memory');` — verify tables exist
  - Query: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'match_documents';` — verify function exists
  - Query: `SELECT indexname FROM pg_indexes WHERE tablename = 'documents' AND indexdef LIKE '%ivfflat%';` — verify vector index
- **n8n validation** (via n8n MCP):
  - `mcp__n8n-mcp__search_workflows` with no filter — verify 6 workflows exist (5 new + 1 existing "Meteo")
  - `mcp__n8n-mcp__get_workflow_details` for each workflow ID — verify node configurations
- **OMS database validation** (via psql to `10.77.3.102:5432/twd_oms_test`):
  - `/opt/homebrew/opt/libpq/bin/psql "host=10.77.3.102 port=5432 dbname=twd_oms_test user=postgres password=@12345678" -c "SELECT COUNT(*) FROM \"oms-order\".orders;"` — verify orders table (~110 orders)
  - `/opt/homebrew/opt/libpq/bin/psql "host=10.77.3.102 port=5432 dbname=twd_oms_test user=postgres password=@12345678" -c "SELECT COUNT(*) FROM public.\"00_inventory_stock\" LIMIT 1;"` — verify inventory table (~9.6M rows)
  - `/opt/homebrew/opt/libpq/bin/psql "host=10.77.3.102 port=5432 dbname=twd_oms_test user=postgres password=@12345678" -c "SELECT COUNT(*) FROM support.log_workflow_events;"` — verify event log (~16,896 events)
  - `/opt/homebrew/opt/libpq/bin/psql "host=10.77.3.102 port=5432 dbname=twd_oms_test user=postgres password=@12345678" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('oms-order','public','support','oms-authentication');"` — verify all 4 schemas exist
- **Documentation validation**:
  - Read `/Users/tachongrak/Meteo/README.md` — verify all documentation sections exist
  - Check README.md contains "pgvector", "AI Agent", "Orchestrator", "RAG", "LangChain" keywords
  - Verify README.md contains at least one Mermaid diagram block

## Notes

- **n8n Cloud Instance**: All workflows are created on `metero.app.n8n.cloud` via the n8n MCP server configured in `.mcp.json`
- **No local n8n**: We are NOT running n8n locally — all workflow creation happens via MCP tools
- **Supabase MCP Available**: Direct database access is available via Supabase MCP (project: `koyrtluetnitcxirinrx`). Use `mcp__supabase__*` tools for all SQL execution, table creation, and database verification. No manual SQL execution needed.
- **Supabase Project Ref**: `koyrtluetnitcxirinrx` — this is the Supabase project connected to the Meteo n8n Cloud instance
- **LLM Provider — OpenRouter (Preferred)**: All workflows use **OpenRouter** (`https://openrouter.ai/api/v1`) as the LLM provider. OpenRouter is OpenAI-compatible — configure it as an OpenAI credential on n8n Cloud with the base URL overridden. API key is in `env/key.md`. This gives access to 200+ models (Claude, GPT-4o, Llama, Gemini) through a single credential. See [OpenRouter API docs](https://openrouter.ai/docs/api/reference/limits) for rate limits and credit management.
- **Existing Workflow**: The existing "Meteo" workflow (scheduled HTTP request) should NOT be modified or deleted
- **Research Reference**: All implementation decisions should reference the research document at `reseach/n8n AI Agent workflows with LangChain.md`
- **Workflow JSON**: n8n workflows created via MCP may have limited node configuration options. If the MCP tools don't support full workflow creation with AI nodes, the builders should document the expected workflow JSON structure for manual import
- **Rate Limiting**: Be mindful of n8n Cloud and Supabase API rate limits when creating multiple resources in succession
- **Database Safety**: When executing SQL via Supabase MCP, always use `IF NOT EXISTS` / `CREATE OR REPLACE` to ensure idempotency. Never drop existing tables without explicit user confirmation.
- **OMS Database (Separate from Supabase)**: The OMS database is a standalone PostgreSQL instance at `10.77.3.102:5432/twd_oms_test` — it is NOT part of Supabase and requires its own PostgreSQL credential on n8n Cloud.
- **OMS Database Schemas**: The OMS DB has 4 schemas that the AI agent queries across: `oms-order` (orders, payments, fulfillment — 20 tables, ~110 orders), `public` (inventory — 9.6M+ stock rows, 60 stores, 160K SKUs), `support` (workflow event log — ~16,896 events, 12 event types), and `oms-authentication` (OAuth2 auth — 5 tables).
- **OMS Inventory Query Performance**: The `public` schema inventory data is large (9.6M+ rows). All queries against inventory tables MUST include `WHERE` clauses filtering by `store_id` and/or `sku` to avoid timeouts. The AI agent system prompt should instruct the LLM to always request these filters from the user.
- **OMS Event Log Partitioning**: The `support.log_workflow_events` table uses weekly partitioning. Time-range queries (e.g., filtering by `created_at`) are efficient and should be preferred over full-table scans.
- **OMS psql Path**: Use `/opt/homebrew/opt/libpq/bin/psql` for local OMS database validation (Homebrew libpq installation).
