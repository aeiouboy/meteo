# OMS Database Schema Reference

## Overview

The OMS (Order Management System) database runs on PostgreSQL at host `10.77.3.102:5432`, database `twd_oms_test`. It uses Sequelize ORM with NO foreign key constraints -- all relationships are managed at the application level.

The database has 4 schemas. Schema names with hyphens require double-quoting in SQL: `"oms-order"`, `"oms-authentication"`.

Organization: `CFR`. Selling Channel: `Web`.

## Schema: oms-order (20 tables)

This is the core order management schema containing orders, payments, fulfillment, and configuration data.

### orders (110 rows)

Main order aggregate table. Each row represents a single customer order.

Key columns: `order_id` (PK, business key), `short_order_number`, `customer_id`, `customer_first_name`, `customer_last_name`, `customer_email`, `customer_phone`, `selling_channel`, `org_id`, `order_status`, `fulfillment_status`, `payment_status`, `order_total`, `order_sub_total`, `is_cancelled`, `is_on_hold`, `created_at`.

Order IDs use prefixed patterns: `PRE_SEK-YYYYMMDD-XXXXX`, `T99-XXXXX`, `MSG1-XXXXX`.

Orders have a `version` column and `parent_id` for history tracking.

### order_lines (244 rows)

Individual line items within each order.

Key columns: `order_id`, `order_line_id`, `item_id` (EAN-13 barcode), `item_description`, `quantity`, `uom` (SBOX or SBTL), `unit_price`, `fulfillment_status`, `order_line_status`, `is_cancelled`, `is_pre_order`, `is_gift`.

UOM values: `SBOX` = box, `SBTL` = bottle. Products are grocery/FMCG items (water, milk, beverages).

### allocations (280 rows)

Inventory allocation records linking order lines to fulfillment locations.

Key columns: `order_id`, `order_line_id`, `allocation_id`, `status_id`, `ship_from_location_id`, `item_id`, `quantity`, `carrier_code`, `allocated_on`, `earliest_delivery_date`, `committed_ship_date`.

Allocation status: `ALLOCATED`.

### releases (145 rows)

Shipment release groups. A release represents a batch of items to be shipped from a single location.

Key columns: `order_id`, `release_id`, `org_id`, `ship_from_location_id`, `carrier_code`, `delivery_method_id` (ShipToAddress), `release_type`.

Release IDs are UUID-based: `REL_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

### release_lines (242 rows)

Individual lines within each release.

Key columns: `order_id`, `release_id`, `release_line_id`.

### fulfillment_details (238 rows)

Fulfillment event records per release line. Tracks packing, picking, and shipping events.

### fulfillment_trackings (0 rows)

Fulfillment event tracking. Currently empty.

### delivery_trackings (0 rows)

Delivery/shipping tracking. Currently empty.

### payments (110 rows)

Payment aggregate per order. One payment record per order.

### payment_methods (110 rows)

Payment method details including card info and amounts.

Key columns: `order_id`, `payment_id`, `payment_method_id`.

### payment_transactions (110 rows)

Transaction-level payment records.

Key columns: `order_id`, `payment_method_id`, `payment_transaction_id`.

### promisings (129 rows)

Promising/reservation requests. Tracks when inventory was promised for an order.

Statuses: `REQUESTED`, `ORDER_CREATED`.

### promising_details (280 rows)

Detailed promising request items linked to `promising_request_id`.

### promising_configurations (112 rows)

Promising service configuration per organization and delivery method.

Key columns: `org_id`, `delivery_method_id`.

### quantity_details (244 rows)

Granular quantity tracking per order line.

### master_locations (479 rows)

Warehouse and store master data. Referenced by `allocations.ship_from_location_id` and `releases.ship_from_location_id`.

Location IDs are prefixed: `CFR432`, `CFR581`.

### master_configs (6 rows)

System configuration key-value pairs.

### customer_notifications (13 rows)

Customer notification records linked to orders.

### outbox (13 rows)

Event outbox for async message publishing. Part of the event-driven architecture.

### SequelizeMeta_oms-order (37 rows)

Sequelize migration tracking for the oms-order schema.

## Key Relationships

All relationships are application-level (no FK constraints in the database).

```
orders (order_id)
  -> order_lines (order_id, order_line_id)
     -> allocations (order_id, order_line_id, allocation_id)
     -> quantity_details (order_id, order_line_id)
     -> fulfillment_details (order_id, order_line_id)
  -> releases (order_id, release_id)
     -> release_lines (order_id, release_id, release_line_id)
  -> payments (order_id, payment_id)
     -> payment_methods (order_id, payment_id, payment_method_id)
        -> payment_transactions (order_id, payment_method_id, payment_transaction_id)
  -> delivery_trackings (order_id)
  -> fulfillment_trackings (order_id)
  -> customer_notifications (order_id)
```

master_locations is referenced by allocations and releases via `ship_from_location_id`.

promisings is referenced by allocations via `promising_request_id`.

## Location Types

Locations are either Distribution Centers (DC) or Retail Stores (Store).

Each location belongs to a group: `ACTIVE`, `LARGE`, or `LARGE_EX`.

## Schema: public (~1,589 tables)

This schema contains inventory data, product masters, location masters, and ~1,500 daily snapshot tables.

### Core Inventory Tables

**00_inventory_stock** (9,618,600 rows): Current stock levels per channel/store/SKU. Columns: `channel_id`, `store_id`, `store_format_id` (TFF), `sku`, `onhand`, `reserved`, `inbound`, `updated_at`. Dimensions: 60 stores, 160,310 SKUs, 1 channel.

**00_inventory_stock_full** (86,567,400 rows): Complete stock with safety stock and UOM. Columns: `store_id`, `sku`, `onhand`, `safety`, `uom`, `updated_at`.

**00_inventory_delta** (34 rows): Stock change events. Columns: `store_id`, `sku`, `qty_change`, `event_type` (inbound/reserved), `event_at`.

**00_inventory_reserve** (1 row): Reservation requests by reservation request ID.

**00_inventory_reserve_summary** (5 rows): Daily reservation summary by store/SKU.

**00_inventory_movement** (2 rows): Inventory movement requests between locations.

### Other Table Categories

Order mirrors: `00_orders`, `00_order_lines`, `00_allocations`, `00_releases`, `00_release_lines`, `00_fulfillment_details`, `00_order_tracking`. These are copies of oms-order data with `00_` prefix.

Product masters: `00_product`, `00_pim_master_product_info`, `products`, `product_online`, `pim_master_product_base_info`.

Location masters: `00_location_master`, `master_locations`, `location_zones`, `branches`.

Price masters: `00_plpp_master_price`.

Marketplace: `product_mkp_lazada`, `product_mkp_shopee`, `shopeemart_products`.

Inventory operations: `inv_stock_card`, `inv_summary`, `inv_reserve`, `inv_release`, `inv_deduct`, `inv_event_*`.

### Daily Snapshots

Approximately 1,500 tables named `inventory_reserve_YYYYMMDD`. These are daily partition snapshots of inventory reservations.

## Schema: support (14 tables)

Workflow event logging schema with weekly partitioned tables.

### log_workflow_events (16,896 rows)

Main event sourcing table. Partitioned weekly as `log_workflow_events_2026_wNN`.

Columns: `id` (uuid), `order_id`, `org_id`, `entity_type`, `entity_id`, `event_type`, `event_source`, `previous_status`, `new_status`, `trace_id`, `correlation_id`, `event_payload` (jsonb), `event_timestamp`, `processed_at`, `actor_id`, `actor_type`, `created_at`.

12 distinct event types: ORDER_CREATED, ORDER_VALIDATED, PROMISING_REQUESTED, ALLOCATION_CREATED, RELEASE_CREATED, RELEASE_LINE_CREATED, RELEASE_SENT_TO_STORE, FULFILLMENT_PACKED, FULFILLMENT_PICKED, FULFILLMENT_SHIPPED, FULFILLMENT_STATUS_UPDATED, FULFILLMENT_DELIVERED.

This log enables full order lifecycle reconstruction.

## Schema: oms-authentication (5 tables)

OAuth2 authentication system.

**users**: User accounts with username, password_hash, email, is_active.

**clients**: OAuth2 clients with client_id, client_secret, grants, scope.

**access_tokens**: Issued access tokens with user_id, client_id, scope, expires_at.

**refresh_tokens**: Refresh tokens linked to access tokens.

**authorization_codes**: OAuth2 authorization code grants.

## Data Characteristics

- **Language**: Thai -- customer names and item descriptions are in Thai
- **Products**: Grocery/FMCG items (water, milk, beverages) with EAN-13 barcodes
- **UOM**: SBOX (box), SBTL (bottle)
- **JSONB fields**: Extensive use for flexible data (order_extension1, delivery_method, change_log)
- **Versioning**: Orders and order_lines have version column + parent_id for history
- **Event-driven**: Outbox pattern for async message publishing

## Querying Tips

When querying the Supabase OMS mirror, use the `oms.` schema prefix for tables. Example:

```sql
SELECT * FROM oms.orders WHERE order_status = 'Open';
SELECT * FROM oms.order_lines WHERE order_id = 'some-order-id';
```

For the original OMS database, schema names with hyphens need quoting:

```sql
SELECT * FROM "oms-order".orders;
```
