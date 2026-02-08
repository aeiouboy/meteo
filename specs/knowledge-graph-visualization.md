# Plan: Knowledge Graph Network Visualization for Meteo RAG

## Task Description
Build an interactive network graph visualization for the Meteo RAG knowledge base. The visualization shows 75 document chunks from 14 source documents across 4 categories (schema, process, troubleshooting, inventory), stored in Supabase pgvector. The UI is an OracleNet-style dark-space network graph with animated nodes connected by lines, clickable nodes with a detail panel, category filtering, and search.

## Objective
Deliver a deployed Next.js app on Vercel at `/web` that:
- Fetches graph data from a Supabase Edge Function (`graph-data`)
- Renders an interactive 2D force-directed network graph with ~89 nodes (14 source + 75 chunks)
- Supports click-to-inspect (detail panel), category filtering, search, and zoom/pan
- Uses a dark space-like aesthetic with animated particle edges

## Problem Statement
The Meteo RAG knowledge base has rich semantic relationships between document chunks stored as pgvector embeddings, but no way to visualize the structure, connections, or coverage of the knowledge base. Users cannot see how documents relate to each other or explore the content spatially.

## Solution Approach
1. **Supabase Edge Function** (`graph-data`) computes graph nodes + edges server-side from pgvector embeddings using cosine similarity
2. **Next.js 15 App** with `react-force-graph-2d` renders the interactive network graph
3. **Two-level node hierarchy**: large labeled source nodes (14) + small chunk dots (75), connected by containment and cross-source similarity edges
4. **Overlay UI**: search filter, category legend with toggle, and slide-in detail panel

## Architecture

```
User Browser
    │
    ▼
Next.js App (Vercel)          Supabase
┌──────────────────┐     ┌─────────────────────┐
│ /web              │     │ Edge Function:       │
│  NetworkGraph     │────▶│  graph-data          │
│  NodeDetailPanel  │     │  (computes nodes +   │
│  CategoryLegend   │     │   edges from pgvector)│
│  SearchFilter     │     └─────────────────────┘
└──────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Graph Lib | `react-force-graph-2d` |
| Styling | Tailwind CSS 4 |
| Data | Supabase JS client → Edge Function |
| Deployment | Vercel |

## Relevant Files

### Existing Files
- `CLAUDE.md` — Project overview, OMS schema reference
- `.mcp.json` — MCP server configuration (Supabase, n8n, etc.)

### Supabase Resources (already exist)
- `documents` table — 75 chunks with pgvector embeddings, metadata (source, category)
- `match_documents` RPC — similarity search function (already deployed)
- Edge Functions: `execute-oms-query`, `search-knowledge` — existing patterns to follow

### New Files
- **Edge Function**: `graph-data/index.ts` — deployed via Supabase MCP `deploy_edge_function`
- **`web/`** — entire Next.js app directory (created via `create-next-app`)
  - `web/app/layout.tsx` — Root layout, dark theme, fonts
  - `web/app/page.tsx` — Main page, data fetching, component composition
  - `web/app/globals.css` — Tailwind imports, custom dark styles
  - `web/components/NetworkGraph.tsx` — react-force-graph-2d with custom rendering
  - `web/components/NodeDetailPanel.tsx` — Slide-in detail panel
  - `web/components/CategoryLegend.tsx` — Color legend with filter toggles
  - `web/components/SearchFilter.tsx` — Search bar + stats
  - `web/lib/supabase.ts` — Supabase client initialization
  - `web/lib/types.ts` — TypeScript interfaces for GraphNode, GraphLink, GraphData
  - `web/lib/graph-data.ts` — Fetch + transform graph data from Edge Function
  - `web/.env.local` — Environment variables (Supabase URL + anon key)

## Implementation Phases

### Phase 1: Foundation
- Deploy the `graph-data` Edge Function to Supabase (computes nodes + edges from pgvector)
- Scaffold the Next.js project at `web/` with dependencies

### Phase 2: Core Implementation
- Build the lib layer (types, supabase client, data fetching)
- Build the core `NetworkGraph` component with custom node rendering, particles, force simulation
- Build overlay components (NodeDetailPanel, CategoryLegend, SearchFilter)

### Phase 3: Integration & Polish
- Compose the page layout with all components
- Test locally, fix visual issues
- Deploy to Vercel

## Data Shape

### Supabase `documents` table (75 rows)
| Source | Category | Chunks |
|--------|----------|--------|
| oms-schema.md | schema | 16 |
| order-status-flow.md | process | 10 |
| troubleshooting.md | troubleshooting | 15 |
| inventory-guide.md | inventory | 13 |
| Inventory Management Guide | inventory | 3 |
| cancellation-policy | process | 3 |
| Returns & Refunds Policy | process | 5 |
| MD Upload Test v3 | schema | 1 |
| DOCX Upload Test v3 | troubleshooting | 1 |
| PDF Upload Test v3 | process | 1 |
| e2e_test | process | 1 |
| integration_test | process | 1 |
| test | process/null | 2 |
| manual_upload | null | 1 |

### Edge Function Response Shape
```typescript
{
  nodes: [
    { id: "src:oms-schema.md", type: "source", label: "oms-schema.md", category: "schema", chunkCount: 16, totalChars: 10802 },
    { id: "chunk:uuid-1", type: "chunk", label: "OMS Order Tables...", sourceId: "src:oms-schema.md", category: "schema", contentLength: 800 },
  ],
  links: [
    { source: "src:oms-schema.md", target: "chunk:uuid-1", type: "contains", strength: 1.0 },
    { source: "src:oms-schema.md", target: "src:troubleshooting.md", type: "similarity", strength: 0.72 },
  ],
  stats: { totalDocs: 75, totalSources: 14, categories: 4 }
}
```

### Category Colors
| Category | Color | Hex |
|----------|-------|-----|
| schema | Blue | `#3b82f6` |
| process | Green | `#22c55e` |
| troubleshooting | Amber | `#f59e0b` |
| inventory | Purple | `#a855f7` |
| (uncategorized) | Gray | `#6b7280` |

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to do the building, validating, testing, deploying, and other tasks.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: builder-edge-fn
  - Role: Deploy the Supabase Edge Function `graph-data` that computes graph nodes + edges from pgvector
  - Agent Type: builder
  - Resume: true

- Builder
  - Name: builder-nextjs-setup
  - Role: Scaffold the Next.js project, install dependencies, create .env.local, and implement lib/ layer (types, supabase, data fetching)
  - Agent Type: builder
  - Resume: true

- Builder
  - Name: builder-graph-ui
  - Role: Build all React components — NetworkGraph, NodeDetailPanel, CategoryLegend, SearchFilter — and compose the page layout
  - Agent Type: builder
  - Resume: true

- Builder
  - Name: builder-deploy
  - Role: Deploy the web app to Vercel, configure env vars
  - Agent Type: general-purpose
  - Resume: false

- Validator
  - Name: validator-final
  - Role: Validate the entire implementation — Edge Function response, local dev, visual checks, Vercel deployment
  - Agent Type: validator
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Deploy Edge Function `graph-data`
- **Task ID**: deploy-edge-fn
- **Depends On**: none
- **Assigned To**: builder-edge-fn
- **Agent Type**: builder
- **Parallel**: true (can run alongside task 2)
- Deploy Supabase Edge Function `graph-data` using `mcp__supabase__deploy_edge_function`
- The function must:
  - Query the `documents` table for all rows with embeddings and source metadata
  - Group by `metadata->>'source'` to create source nodes (id: `src:<source>`, type: `source`)
  - Create chunk nodes (id: `chunk:<uuid>`, type: `chunk`) linked to their source
  - Compute pairwise source-level similarity using average embeddings and cosine distance (`<=>` operator)
  - Create similarity edges where `1 - distance >= 0.65`
  - Create containment edges (source → chunk, type: `contains`, strength: 1.0)
  - Return JSON: `{ nodes, links, stats }`
- Set `verify_jwt: false` (public read-only data)
- SQL for source similarity:
```sql
WITH source_embeddings AS (
  SELECT metadata->>'source' as source, metadata->>'category' as category,
    AVG(embedding) as avg_embedding, COUNT(*) as chunk_count,
    SUM(length(content)) as total_chars
  FROM documents WHERE embedding IS NOT NULL AND metadata->>'source' IS NOT NULL
  GROUP BY metadata->>'source', metadata->>'category'
)
SELECT a.source, a.category, a.chunk_count, a.total_chars,
  b.source as related_source,
  1 - (a.avg_embedding <=> b.avg_embedding) as similarity
FROM source_embeddings a
LEFT JOIN source_embeddings b ON a.source < b.source
  AND 1 - (a.avg_embedding <=> b.avg_embedding) >= 0.65
```
- Test with curl: `curl https://koyrtluetnitcxirinrx.supabase.co/functions/v1/graph-data`

### 2. Scaffold Next.js Project + Install Dependencies
- **Task ID**: scaffold-nextjs
- **Depends On**: none
- **Assigned To**: builder-nextjs-setup
- **Agent Type**: builder
- **Parallel**: true (can run alongside task 1)
- Run: `cd /Users/tachongrak/Meteo && npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack --yes`
- Run: `cd /Users/tachongrak/Meteo/web && npm install react-force-graph-2d @supabase/supabase-js`
- Create `web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://koyrtluetnitcxirinrx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtveXJ0bHVldG5pdGN4aXJpbnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjY4OTIsImV4cCI6MjA4NjAwMjg5Mn0.ZGN-Tap3wBAsDB9ZZCepn-3sDwOcuAw4PpRz367gcK4
```

### 3. Implement lib/ Layer
- **Task ID**: implement-lib
- **Depends On**: scaffold-nextjs
- **Assigned To**: builder-nextjs-setup (resume)
- **Agent Type**: builder
- **Parallel**: false (needs scaffolded project)
- Create `web/lib/types.ts` with interfaces: `GraphNode`, `GraphLink`, `GraphData`
- Create `web/lib/supabase.ts` — Supabase client using env vars
- Create `web/lib/graph-data.ts`:
  - Fetch from `${SUPABASE_URL}/functions/v1/graph-data`
  - Transform into react-force-graph format
  - Add computed properties: `color` (by category), `val` (node size: 8 for source, 3 for chunk)
  - Category color map: schema=#3b82f6, process=#22c55e, troubleshooting=#f59e0b, inventory=#a855f7, default=#6b7280

### 4. Build NetworkGraph Component
- **Task ID**: build-network-graph
- **Depends On**: implement-lib
- **Assigned To**: builder-graph-ui
- **Agent Type**: builder
- **Parallel**: false (needs lib/ types)
- Create `web/components/NetworkGraph.tsx`:
  - Use `dynamic(() => import('react-force-graph-2d'), { ssr: false })` for client-only rendering
  - Props: `data: GraphData`, `onNodeClick`, `onNodeHover`, `selectedNode`, `visibleCategories`, `searchQuery`
  - Config: `backgroundColor="#0a0a1a"`, `cooldownTicks={100}`, `d3AlphaDecay={0.02}`, `d3VelocityDecay={0.3}`
  - Custom `nodeCanvasObject`:
    - Source nodes: filled circle r=8, label text below, category-colored glow
    - Chunk nodes: small filled circle r=3, no label, slightly transparent
    - Hovered: larger with brighter glow
    - Selected: ring highlight
  - Edge rendering:
    - `linkDirectionalParticles={2}`, `linkDirectionalParticleSpeed={0.004}`, `linkDirectionalParticleWidth={1.5}`
    - Similarity edges: `rgba(255,165,0,{strength*0.5})`, width = `strength * 2`
    - Containment edges: `rgba(255,255,255,0.08)`, width = `0.5`
  - Force simulation:
    - `d3Force('charge').strength(-120)` for source nodes, `-30` for chunks
    - `d3Force('link').distance(link => link.type === 'contains' ? 30 : 100)`
  - Click handler: `onNodeClick(node)` → opens detail panel
  - Filter by `visibleCategories` and `searchQuery`

### 5. Build Overlay Components
- **Task ID**: build-overlays
- **Depends On**: implement-lib
- **Assigned To**: builder-graph-ui (resume)
- **Agent Type**: builder
- **Parallel**: true (can run after lib/ is done, alongside or after NetworkGraph)
- Create `web/components/NodeDetailPanel.tsx`:
  - Slide-in panel from right (w-96, dark bg `#111827`, border-left)
  - Shows: node label, category badge (colored), type badge
  - Source nodes: chunk count, total chars, list of chunk previews, related sources
  - Chunk nodes: full content text, parent source link, content length
  - Close button (X) top-right
  - Animated slide-in (CSS transition or transform)
- Create `web/components/CategoryLegend.tsx`:
  - Fixed bottom-left position
  - 4 colored circles with category names + chunk counts
  - Click to toggle category visibility (strike-through when hidden)
  - Semi-transparent dark background
- Create `web/components/SearchFilter.tsx`:
  - Fixed top-center position
  - Search input with magnifying glass icon, dark styling
  - Stats display: "75 chunks from 14 sources across 4 categories"
  - Debounced search (300ms)

### 6. Compose Page Layout
- **Task ID**: compose-layout
- **Depends On**: build-network-graph, build-overlays
- **Assigned To**: builder-graph-ui (resume)
- **Agent Type**: builder
- **Parallel**: false
- Edit `web/app/layout.tsx`:
  - Dark theme: `<html className="dark">`, body bg `#0a0a1a`, text white
  - Inter font via `next/font/google`
  - Full viewport height, no scroll
- Edit `web/app/globals.css`:
  - Tailwind v4 imports
  - Custom scrollbar styling (dark)
  - Hide default padding/margin
- Edit `web/app/page.tsx`:
  - Client component (`'use client'`)
  - State: `graphData`, `selectedNode`, `visibleCategories`, `searchQuery`, `loading`
  - `useEffect` to fetch graph data on mount via `fetchGraphData()` from `lib/graph-data.ts`
  - Loading state: dark bg with pulsing "Loading knowledge graph..." text
  - Layout: full-screen relative container
    - `<NetworkGraph>` fills entire bg
    - `<SearchFilter>` top-center overlay (absolute positioned)
    - `<CategoryLegend>` bottom-left overlay
    - `<NodeDetailPanel>` right side, conditionally visible when `selectedNode` is set
  - Wire up state: category toggles filter graph, search highlights nodes, node click opens panel

### 7. Test Locally
- **Task ID**: test-local
- **Depends On**: compose-layout, deploy-edge-fn
- **Assigned To**: validator-final
- **Agent Type**: validator
- **Parallel**: false
- Verify Edge Function: `curl https://koyrtluetnitcxirinrx.supabase.co/functions/v1/graph-data` returns valid JSON with nodes, links, stats
- Start dev server: `cd /Users/tachongrak/Meteo/web && npm run dev`
- Open http://localhost:3000 in Playwright browser
- Visual checks:
  - Dark background with nodes visible
  - Source nodes are larger and labeled
  - Chunk nodes are small dots
  - Animated particles on edges
  - Click a source node → side panel slides in with details
  - Category legend visible at bottom-left
  - Search bar at top
  - Zoom/pan with mouse works
- Take screenshot for verification

### 8. Deploy to Vercel
- **Task ID**: deploy-vercel
- **Depends On**: test-local
- **Assigned To**: builder-deploy
- **Agent Type**: general-purpose
- **Parallel**: false
- Run: `cd /Users/tachongrak/Meteo/web && npx vercel --yes`
- Set environment variables via Vercel CLI or dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify deployment URL loads correctly
- Report the production URL

### 9. Final Validation
- **Task ID**: validate-all
- **Depends On**: deploy-vercel
- **Assigned To**: validator-final
- **Agent Type**: validator
- **Parallel**: false
- Open the Vercel production URL in Playwright
- Verify all visual elements render correctly
- Take screenshot
- Report pass/fail status

## Acceptance Criteria

1. **Edge Function `graph-data`** returns valid JSON with ~89 nodes (14 sources + 75 chunks) and links (containment + similarity)
2. **Next.js app** at `web/` builds without errors (`npm run build`)
3. **Dark space aesthetic**: background `#0a0a1a`, glowing nodes, animated particles on edges
4. **Source nodes** are large (r=8), labeled, colored by category
5. **Chunk nodes** are small (r=3), clustered near their parent source
6. **Similarity edges** (orange, varying opacity by strength) connect related sources where similarity ≥ 0.65
7. **Containment edges** (faint white) connect sources to their chunks
8. **Click a node** → detail panel slides in from right showing content/metadata
9. **Category legend** at bottom-left with toggles to show/hide categories
10. **Search bar** at top-center filters/highlights matching nodes
11. **Zoom/pan** works via mouse
12. **Deployed to Vercel** with working production URL

## Validation Commands

- `curl -s https://koyrtluetnitcxirinrx.supabase.co/functions/v1/graph-data | jq '.stats'` — Verify Edge Function returns stats
- `cd /Users/tachongrak/Meteo/web && npm run build` — Verify Next.js builds without errors
- `cd /Users/tachongrak/Meteo/web && npm run dev` — Start local dev server
- Playwright: navigate to localhost:3000, take screenshot, verify nodes render

## Notes

- `react-force-graph-2d` must be loaded with `dynamic(() => import(...), { ssr: false })` because it uses Canvas API (browser-only)
- Supabase pgvector `<=>` operator computes cosine distance (NOT similarity). Similarity = `1 - distance`.
- `AVG(embedding)` works on pgvector columns in PostgreSQL — it averages each dimension across the group
- The Edge Function is public (`verify_jwt: false`) because the knowledge base data is non-sensitive read-only metadata
- The `.env.local` file contains the Supabase anon key which is safe to embed in client-side code (it's a public key with RLS)
- Tailwind CSS 4 uses `@import "tailwindcss"` instead of the v3 `@tailwind` directives
- Some sources have `null` category — map these to "uncategorized" with gray color
