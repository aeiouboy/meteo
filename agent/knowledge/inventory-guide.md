# Inventory Management Guide

## Overview

The OMS inventory system tracks stock levels across stores and SKUs. It manages three core quantities: onhand (physical stock), reserved (allocated to orders), and inbound (expected arrivals).

## Core Concepts

### Onhand

The physical quantity of a SKU currently at a store location. This is the total stock present, regardless of whether it has been allocated to orders.

### Reserved

The quantity that has been allocated (reserved) for pending orders. Reserved stock is not available for new orders.

### Inbound

The quantity expected to arrive at the store. This stock is in transit from a distribution center or supplier.

### Available Stock

Available stock is what can be allocated to new orders:

```
available = onhand - reserved
```

Inbound stock is NOT included in the available calculation because it has not yet arrived physically.

## Inventory Tables

### inventory_stock (Primary)

The `oms.inventory_stock` table is the primary stock table. In the real OMS, it has 9.6 million rows across 60 stores and 160,310 SKUs. In the Supabase mirror, there are 100 rows across 3 stores (004, 005, 007).

Key columns:
- `channel_id`: Sales channel identifier (always 1)
- `store_id`: Store location identifier (e.g., "004", "005", "007")
- `store_format_id`: Store format (TFF)
- `sku`: Product SKU identifier
- `onhand`: Current physical stock quantity
- `reserved`: Quantity reserved for orders
- `inbound`: Expected incoming quantity
- `updated_at`: Last update timestamp

### inventory_stock_full

Extended stock data that includes safety stock levels and unit of measure. In the real OMS this table has 86.5 million rows.

Key columns:
- `store_id`: Store location identifier
- `sku`: Product SKU identifier
- `onhand`: Current physical stock quantity
- `safety`: Safety stock level (minimum stock to maintain)
- `uom`: Unit of measure (e.g., EA for each)
- `updated_at`: Last update timestamp

### inventory_delta

Stock change events that record when inventory levels change. Used for tracking inbound receipts and reservation changes.

Key columns:
- `store_id`: Store location
- `sku`: Product SKU
- `qty_change`: Quantity change amount (positive or negative)
- `event_type`: Type of change -- "inbound" for received stock, "reserved" for allocation changes
- `event_at`: When the change occurred

### inventory_reserve

Reservation requests linked to promising requests.

### inventory_reserve_summary

Daily reservation summary aggregated by store and SKU.

### inventory_movement

Inventory movement requests between locations (e.g., DC to Store transfers).

## How Allocation Affects Inventory

When an order is allocated, the following happens:

1. The promising service identifies a store with available stock (onhand - reserved > required quantity).
2. An allocation record is created in `oms.allocations` linking the order line to the store.
3. The `reserved` quantity in `oms.inventory_stock` increases by the allocated amount.
4. The `available` stock (onhand - reserved) decreases accordingly.

When an order is cancelled or an allocation is removed, the reserved quantity should decrease to free up stock.

## Store Structure

### Supabase Mirror (3 stores)

The Supabase OMS mirror contains inventory data for 3 stores:
- Store `004`
- Store `005`
- Store `007`

### Real OMS (60 stores)

The production OMS database has 60 store locations with location IDs prefixed with `CFR` (e.g., CFR432, CFR581). These include both Distribution Centers (DC) and Retail Stores (Store).

## Safety Stock

Safety stock is the minimum stock level that should be maintained at a store. It acts as a buffer against unexpected demand or supply delays.

The `inventory_stock_full` table includes the `safety` column. When available stock falls below the safety level, it may trigger replenishment from a DC.

```
effective_available = onhand - reserved - safety
```

If effective_available is negative, the store is below safety stock levels.

## Units of Measure

Products in the OMS use these UOM codes:
- `SBOX`: Box -- a case/box containing multiple units
- `SBTL`: Bottle -- individual bottle
- `EA`: Each -- individual unit (used in inventory_stock_full)

Stock quantities are tracked in the product's selling UOM.

## Common Inventory Queries

### Check stock for a specific SKU across all stores

```sql
SELECT store_id, sku, onhand, reserved, inbound,
       (onhand - reserved) as available,
       updated_at
FROM oms.inventory_stock
WHERE sku = 'SKU_HERE'
ORDER BY store_id;
```

### Find stores with available stock for a SKU

```sql
SELECT store_id, onhand, reserved,
       (onhand - reserved) as available
FROM oms.inventory_stock
WHERE sku = 'SKU_HERE'
  AND (onhand - reserved) > 0
ORDER BY (onhand - reserved) DESC;
```

### Check total stock across all stores

```sql
SELECT sku,
       SUM(onhand) as total_onhand,
       SUM(reserved) as total_reserved,
       SUM(inbound) as total_inbound,
       SUM(onhand - reserved) as total_available
FROM oms.inventory_stock
WHERE sku = 'SKU_HERE'
GROUP BY sku;
```

### Find SKUs with low stock (below safety level)

```sql
SELECT s.store_id, s.sku, s.onhand, s.reserved,
       f.safety,
       (s.onhand - s.reserved - f.safety) as effective_available
FROM oms.inventory_stock s
JOIN oms.inventory_stock_full f
  ON f.store_id = s.store_id AND f.sku = s.sku
WHERE (s.onhand - s.reserved) < f.safety
ORDER BY (s.onhand - s.reserved - f.safety) ASC;
```

### View recent stock changes

```sql
SELECT store_id, sku, qty_change, event_type, event_at
FROM oms.inventory_delta
ORDER BY event_at DESC
LIMIT 20;
```

### Check stock at a specific store

```sql
SELECT sku, onhand, reserved, inbound,
       (onhand - reserved) as available
FROM oms.inventory_stock
WHERE store_id = 'STORE_ID_HERE'
ORDER BY sku;
```

### Compare reserved quantity with active allocations

This helps identify orphaned reservations:

```sql
SELECT s.store_id, s.sku, s.reserved as inventory_reserved,
       COALESCE(SUM(a.quantity), 0) as allocation_reserved,
       s.reserved - COALESCE(SUM(a.quantity), 0) as discrepancy
FROM oms.inventory_stock s
LEFT JOIN oms.allocations a
  ON a.item_id = s.sku
  AND a.ship_from_location_id = s.store_id
WHERE s.sku = 'SKU_HERE'
GROUP BY s.store_id, s.sku, s.reserved
HAVING s.reserved != COALESCE(SUM(a.quantity), 0);
```

## Delta Events

Inventory delta events track changes to stock levels over time.

**Inbound events** (`event_type = 'inbound'`): Stock received at a store. The `qty_change` is positive, representing new stock arriving.

**Reserved events** (`event_type = 'reserved'`): Stock reserved for orders. The `qty_change` represents the change in reserved quantity (positive when reserving, negative when releasing).

Delta events are important for:
- Auditing stock changes
- Debugging discrepancies between expected and actual stock
- Tracking when inbound shipments were received
