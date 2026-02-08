# Meteo Project

## Project Overview

This is the Meteo project — an AI-powered Order Management System (OMS) built with n8n, Supabase, Vercel, and LangChain.

## Project Structure

```
.
├── .claude/          # Claude Code configuration
├── .mcp.json         # MCP server configuration (n8n, Supabase, Playwright, Firecrawl)
├── env/              # Environment configuration
├── reseach/          # Research documents
├── specs/            # Implementation plans
└── CLAUDE.md         # This file
```

## Tech Stack

- **n8n Cloud**: `metero.app.n8n.cloud` — Workflow automation & AI agent orchestration
- **Supabase**: Project `koyrtluetnitcxirinrx` — Database, Auth, pgvector for RAG
- **Vercel**: Frontend hosting (Next.js)
- **LangChain.js**: AI agent framework (integrated via n8n nodes)
- **OpenRouter**: LLM gateway (`https://openrouter.ai/api/v1`) — OpenAI-compatible API providing access to GPT-4o, Claude, Llama, Gemini, etc. API key in `env/key.md`

## MCP Servers

| Server | Purpose |
|--------|---------|
| `n8n-mcp` | Create/manage workflows on n8n Cloud |
| `supabase` | Direct SQL execution on Supabase (project: `koyrtluetnitcxirinrx`) |
| `playwright` | Browser automation for testing |
| `firecrawl-mcp` | Web scraping for research |

## OMS Database Schema

### Connection Details

- **Host**: `10.77.3.102:5432` (internal network)
- **Database**: `twd_oms_test`
- **ORM**: Sequelize (Node.js)
- **Organization**: `CFR`
- **Selling Channel**: `Web`

### Schemas Overview

| Schema | Tables | Purpose |
|--------|--------|---------|
| `oms-order` | 20 | Core order management — orders, payments, fulfillment |
| `public` | ~1,589 | Inventory, product masters, location masters, daily snapshots |
| `support` | 14 | Workflow event logging (partitioned weekly) |
| `oms-authentication` | 5 | OAuth2 authentication system |

> **Note**: Schema names with hyphens require double-quoting in SQL: `"oms-order"`, `"oms-authentication"`

---

### Schema: `oms-order` (20 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| `orders` | 110 | Main order aggregate — customer info, totals, statuses |
| `order_lines` | 244 | Individual line items per order — item_id, quantity, price |
| `allocations` | 280 | Inventory allocation records per order line |
| `releases` | 145 | Shipment release groups (ship_from_location → carrier) |
| `release_lines` | 242 | Individual lines within each release |
| `fulfillment_details` | 238 | Fulfillment event records per release line |
| `fulfillment_trackings` | 0 | Fulfillment event tracking (empty) |
| `delivery_trackings` | 0 | Delivery/shipping tracking (empty) |
| `payments` | 110 | Payment aggregate per order |
| `payment_methods` | 110 | Payment method details (card info, amounts) |
| `payment_transactions` | 110 | Transaction-level payment records |
| `promisings` | 129 | Promising/reservation requests |
| `promising_details` | 280 | Detailed promising request items |
| `promising_configurations` | 112 | Promising service configuration |
| `quantity_details` | 244 | Granular quantity tracking per order line |
| `master_locations` | 479 | Warehouse/store master data (DC, Store) |
| `master_configs` | 6 | System configuration key-value pairs |
| `customer_notifications` | 13 | Customer notification records |
| `outbox` | 13 | Event outbox for async message publishing |
| `SequelizeMeta_oms-order` | 37 | Sequelize migration tracking |

### Order Status Flow

```
Open → Allocated → Released → In Process → Picked → Fulfilled → Delivered
                                    ↓
                              Partial In Process → Partial Picked
```

**Order Statuses**: `Open`, `Allocated`, `Released`, `In Process`, `Partial In Process`, `Picked`, `Partial Picked`, `Fulfilled`, `Delivered`

**Payment Statuses**: `Authorized`, `Awaiting Invoice`, `Paid`

**Promising Statuses**: `REQUESTED`, `ORDER_CREATED`

**Allocation Statuses**: `ALLOCATED`

### Key Relationships (Application-Level, No FK Constraints)

```
orders (order_id)
├── order_lines (order_id, order_line_id)
│   ├── allocations (order_id, order_line_id, allocation_id)
│   ├── quantity_details (order_id, order_line_id)
│   └── fulfillment_details (order_id, order_line_id)
├── releases (order_id, release_id)
│   └── release_lines (order_id, release_id, release_line_id)
├── payments (order_id, payment_id)
│   └── payment_methods (order_id, payment_id, payment_method_id)
│       └── payment_transactions (order_id, payment_method_id, payment_transaction_id)
├── delivery_trackings (order_id)
├── fulfillment_trackings (order_id)
└── customer_notifications (order_id)

master_locations (location_id) ← referenced by allocations.ship_from_location_id, releases.ship_from_location_id
master_configs (config_key) ← system configuration
promisings (promising_request_id) ← referenced by allocations.promising_request_id
promising_details (promising_request_id)
promising_configurations (org_id, delivery_method_id)
```

### Location Types

| Type | Group | Description |
|------|-------|-------------|
| `DC` | `ACTIVE`, `LARGE`, `LARGE_EX` | Distribution Centers |
| `Store` | `ACTIVE`, `LARGE`, `LARGE_EX` | Retail Stores |

### Key Columns Reference

**orders**: `order_id` (PK business key), `short_order_number`, `customer_id`, `customer_first_name`, `customer_last_name`, `customer_email`, `customer_phone`, `selling_channel`, `org_id`, `order_status`, `fulfillment_status`, `payment_status`, `order_total`, `order_sub_total`, `is_cancelled`, `is_on_hold`, `created_at`

**order_lines**: `order_id`, `order_line_id`, `item_id` (EAN/barcode), `item_description`, `quantity`, `uom` (SBOX, SBTL), `unit_price`, `fulfillment_status`, `order_line_status`, `is_cancelled`, `is_pre_order`, `is_gift`

**allocations**: `order_id`, `order_line_id`, `allocation_id`, `status_id`, `ship_from_location_id`, `item_id`, `quantity`, `carrier_code`, `allocated_on`, `earliest_delivery_date`, `committed_ship_date`

**releases**: `order_id`, `release_id`, `org_id`, `ship_from_location_id`, `carrier_code`, `delivery_method_id` (ShipToAddress), `release_type`

### Data Characteristics

- **Language**: Thai (customer names, descriptions are in Thai)
- **Items**: Grocery/FMCG products (water, milk, beverages) with EAN-13 barcodes
- **UOM**: `SBOX` (box), `SBTL` (bottle)
- **Order IDs**: Prefixed patterns like `PRE_SEK-YYYYMMDD-XXXXX`, `T99-XXXXX`, `MSG1-XXXXX`
- **Release IDs**: UUID-based like `REL_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Locations**: Prefixed like `CFR432`, `CFR581`
- **JSONB fields**: Extensive use of JSONB for flexible data (order_extension1, delivery_method, change_log, etc.)
- **No FK constraints**: All relationships managed at application level (Sequelize ORM)
- **Versioning**: Orders and order_lines have `version` column + `parent_id` for history tracking
- **Outbox pattern**: Event-driven architecture with outbox table for async message publishing

---

### Schema: `public` — Inventory & Product Masters

#### Core Inventory Tables (6 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| `00_inventory_stock` | 9,618,600 | Current stock levels per channel/store/SKU (onhand, reserved, inbound) |
| `00_inventory_stock_full` | 86,567,400 | Complete stock with safety stock and UOM |
| `00_inventory_delta` | 34 | Stock change events (inbound, reserved) |
| `00_inventory_reserve` | 1 | Reservation requests (by reservation request ID) |
| `00_inventory_reserve_summary` | 5 | Daily reservation summary by store/SKU |
| `00_inventory_movement` | 2 | Inventory movement requests between locations |

**Key columns — `00_inventory_stock`**: `channel_id`, `store_id`, `store_format_id` (TFF), `sku`, `onhand`, `reserved`, `inbound`, `updated_at`

**Key columns — `00_inventory_stock_full`**: `store_id`, `sku`, `onhand`, `safety`, `uom`, `updated_at`

**Key columns — `00_inventory_delta`**: `store_id`, `sku`, `qty_change`, `event_type` (inbound/reserved), `event_at`

**Inventory dimensions**: 60 stores, 160,310 SKUs, 1 channel (channel_id=1)

#### Other `public` Tables (75+ non-snapshot tables)

| Category | Tables | Purpose |
|----------|--------|---------|
| Order mirrors | `00_orders`, `00_order_lines`, `00_allocations`, `00_releases`, `00_release_lines`, `00_fulfillment_details`, `00_order_tracking` | Order data copies (prefixed `00_`) |
| Product masters | `00_product`, `00_pim_master_product_info`, `products`, `product_online`, `pim_master_product_base_info` | Product information management |
| Location masters | `00_location_master`, `master_locations`, `location_zones`, `branches` | Store/warehouse location data |
| Price masters | `00_plpp_master_price` | Product pricing data |
| Marketplace | `product_mkp_lazada`, `product_mkp_shopee`, `shopeemart_products` | Marketplace integrations |
| QC/Quality | `product_qc_gokoo`, `product_qc_grabmart`, `product_qc_lineman`, `qc_*` | Quality control per platform |
| Inventory ops | `inv_stock_card`, `inv_summary`, `inv_reserve`, `inv_release`, `inv_deduct`, `inv_event_*` | Operational inventory tracking |
| Promising | `00_promising_configurations`, `00_promising_details`, `00_promisings`, `00_quantity_details` | Promising/reservation data |
| Migrations | `SequelizeMeta_public`, `SequelizeMeta_oms-authentication` | Schema migration tracking |

> **Daily snapshots**: ~1,500+ `inventory_reserve_YYYYMMDD` tables — daily partition snapshots of inventory reservations

---

### Schema: `support` — Workflow Event Logging (14 tables)

**Main table**: `log_workflow_events` (16,896 rows, partitioned weekly as `log_workflow_events_2026_wNN`)

**Columns**: `id` (uuid), `order_id`, `org_id`, `entity_type`, `entity_id`, `event_type`, `event_source`, `previous_status`, `new_status`, `trace_id`, `correlation_id`, `event_payload` (jsonb), `event_timestamp`, `processed_at`, `actor_id`, `actor_type`, `created_at`

**Event Types** (12 distinct):
```
ORDER_CREATED → ORDER_VALIDATED → PROMISING_REQUESTED → ALLOCATION_CREATED →
RELEASE_CREATED → RELEASE_LINE_CREATED → RELEASE_SENT_TO_STORE →
FULFILLMENT_PACKED → FULFILLMENT_PICKED → FULFILLMENT_SHIPPED →
FULFILLMENT_STATUS_UPDATED → FULFILLMENT_DELIVERED
```

> This is an event sourcing log — the AI agent can reconstruct full order lifecycle from these events.

---

### Schema: `oms-authentication` — OAuth2 Auth System (5 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, password_hash, email, is_active) |
| `clients` | OAuth2 clients (client_id, client_secret, grants, scope) |
| `access_tokens` | Issued access tokens (user_id, client_id, scope, expires_at) |
| `refresh_tokens` | Refresh tokens linked to access tokens |
| `authorization_codes` | OAuth2 authorization code grants |

---

## Guidelines

- All n8n workflows are managed on `metero.app.n8n.cloud` via MCP — never run n8n locally
- Database operations on Supabase use the Supabase MCP server
- OMS database queries use `psql` via `/opt/homebrew/opt/libpq/bin/psql`
- Schema name requires quoting: `"oms-order"` (contains hyphen)
- All SQL against OMS must be READ-ONLY unless explicitly authorized
- Research documents go in `reseach/`, implementation plans in `specs/`
- **Plan mode**: After a plan is approved, always save it to `specs/<descriptive-name>.md` before starting implementation
