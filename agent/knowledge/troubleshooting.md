# OMS Troubleshooting Guide

## Overview

This guide covers common OMS issues with symptoms, possible causes, diagnostic steps, and resolution approaches. All SQL queries use the `oms.` schema prefix for Supabase.

## Issue: Order Stuck in "Allocated" Status

### Symptoms

An order has been in `Allocated` status for longer than expected. No release has been created. The customer may be waiting for shipment.

### Possible Causes

1. **Promising failure**: The promising service returned an allocation but the release creation service failed to process it.
2. **Carrier unavailable**: The assigned carrier is not available or not configured for the ship-from location.
3. **Release service down**: The release creation service encountered an error and did not create a release.
4. **Configuration issue**: Missing or incorrect promising configuration for the org/delivery method combination.

### Diagnostic Steps

Check when the order was allocated:

```sql
SELECT order_id, order_status, created_at
FROM oms.orders
WHERE order_id = 'ORDER_ID_HERE';
```

Check if allocations exist:

```sql
SELECT allocation_id, order_line_id, ship_from_location_id,
       carrier_code, allocated_on, status_id
FROM oms.allocations
WHERE order_id = 'ORDER_ID_HERE';
```

Check if any releases were attempted:

```sql
SELECT release_id, ship_from_location_id, carrier_code
FROM oms.releases
WHERE order_id = 'ORDER_ID_HERE';
```

Check the event log for the last event:

```sql
SELECT event_type, previous_status, new_status,
       event_timestamp, event_payload
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE'
ORDER BY event_timestamp DESC
LIMIT 5;
```

Check promising configuration:

```sql
SELECT * FROM oms.promising_configurations
WHERE org_id = 'CFR';
```

### Resolution

If no release exists, the release creation service needs to be triggered again. Check that the carrier_code in the allocation is valid and that the ship-from location is active.

## Issue: Payment Status Not Updating

### Symptoms

The order has been fulfilled but payment_status is still `Authorized` or stuck at `Awaiting Invoice`. The payment has not been captured.

### Possible Causes

1. **Gateway timeout**: The payment gateway did not respond in time during capture.
2. **Webhook failure**: The payment service webhook for status updates failed or was not received.
3. **Payment method declined**: The payment method can no longer be charged (expired card, insufficient funds).
4. **Invoice generation failure**: The invoicing service could not generate an invoice for the order.

### Diagnostic Steps

Check current payment status:

```sql
SELECT p.payment_id, p.order_id,
       o.payment_status, o.order_status
FROM oms.payments p
JOIN oms.orders o ON o.order_id = p.order_id
WHERE p.order_id = 'ORDER_ID_HERE';
```

Check payment methods and transactions:

```sql
SELECT pm.payment_method_id, pt.payment_transaction_id
FROM oms.payment_methods pm
LEFT JOIN oms.payment_transactions pt
  ON pt.order_id = pm.order_id
  AND pt.payment_method_id = pm.payment_method_id
WHERE pm.order_id = 'ORDER_ID_HERE';
```

Check order fulfillment status (payment capture usually depends on fulfillment):

```sql
SELECT order_id, fulfillment_status, order_status
FROM oms.orders
WHERE order_id = 'ORDER_ID_HERE';
```

### Resolution

If the order is fulfilled but payment is stuck at `Authorized`, the payment capture process may need to be retriggered. Verify the payment gateway connectivity and check webhook delivery logs.

## Issue: Stock Mismatch

### Symptoms

The reported stock (onhand) does not match expected values. Reserved quantities seem incorrect. Orders may fail allocation due to perceived lack of stock.

### Possible Causes

1. **Delta events not processed**: Inbound or reservation delta events were not applied to the stock table.
2. **Stale snapshot data**: The inventory snapshot is outdated.
3. **Double reservation**: The same stock was reserved by multiple orders due to a race condition.
4. **Manual adjustment not reflected**: A physical stock count was done but not entered into the system.

### Diagnostic Steps

Check current stock for a SKU at a specific store:

```sql
SELECT store_id, sku, onhand, reserved, inbound, updated_at
FROM oms.inventory_stock
WHERE sku = 'SKU_HERE'
  AND store_id = 'STORE_ID_HERE';
```

Check for recent delta events:

```sql
SELECT store_id, sku, qty_change, event_type, event_at
FROM oms.inventory_delta
WHERE sku = 'SKU_HERE'
ORDER BY event_at DESC;
```

Compare onhand minus reserved to see available stock:

```sql
SELECT store_id, sku, onhand, reserved,
       (onhand - reserved) as available
FROM oms.inventory_stock
WHERE sku = 'SKU_HERE';
```

Check allocations that reserved this SKU:

```sql
SELECT a.order_id, a.allocation_id, a.item_id,
       a.quantity, a.ship_from_location_id, a.allocated_on
FROM oms.allocations a
WHERE a.item_id = 'SKU_HERE'
  AND a.ship_from_location_id = 'STORE_ID_HERE'
ORDER BY a.allocated_on DESC;
```

### Resolution

Reconcile the reserved quantity against active (non-cancelled) allocations. If the reserved count is higher than the sum of active allocations, there may be orphaned reservations that need cleanup.

## Issue: Order Delay to Fulfillment

### Symptoms

An order was created but took an unusually long time to reach fulfillment. The customer is complaining about delayed shipping.

### Possible Causes

1. **Bottleneck at a specific stage**: One status transition took longer than others.
2. **Store processing delay**: The store received the release but took time to pick and pack.
3. **Multiple re-releases**: The order was released, then cancelled and re-released due to stock issues.
4. **On-hold status**: The order was placed on hold at some point.

### Diagnostic Steps

Get the full event timeline to identify the bottleneck:

```sql
SELECT event_type, event_timestamp,
       event_timestamp - LAG(event_timestamp)
         OVER (ORDER BY event_timestamp) as gap
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE'
ORDER BY event_timestamp ASC;
```

Check if the order was ever on hold:

```sql
SELECT order_id, is_on_hold, order_status, created_at
FROM oms.orders
WHERE order_id = 'ORDER_ID_HERE';
```

Check the time from order creation to delivery:

```sql
SELECT
  MIN(CASE WHEN event_type = 'ORDER_CREATED' THEN event_timestamp END) as created,
  MIN(CASE WHEN event_type = 'FULFILLMENT_DELIVERED' THEN event_timestamp END) as delivered,
  MIN(CASE WHEN event_type = 'FULFILLMENT_DELIVERED' THEN event_timestamp END) -
  MIN(CASE WHEN event_type = 'ORDER_CREATED' THEN event_timestamp END) as total_time
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE';
```

### Resolution

Identify which transition took the longest. If it's the store fulfillment stage (RELEASE_SENT_TO_STORE to FULFILLMENT_PICKED), the delay is at the store. If it's between ALLOCATION_CREATED and RELEASE_CREATED, there may be a release service issue.

## Issue: Release Not Created After Allocation

### Symptoms

The order has allocations but no releases. Order status is stuck at `Allocated`. The event log shows ALLOCATION_CREATED but no RELEASE_CREATED event.

### Possible Causes

1. **Carrier routing failure**: The system could not find a valid carrier route for the allocated location.
2. **Missing location configuration**: The ship-from location is not configured for the carrier or delivery method.
3. **Release service error**: The release creation service threw an error while processing.
4. **Partial allocation**: Not all order lines were allocated, and the system is waiting for complete allocation before releasing.

### Diagnostic Steps

Check allocations and their locations:

```sql
SELECT a.allocation_id, a.order_line_id,
       a.ship_from_location_id, a.carrier_code, a.status_id
FROM oms.allocations
WHERE order_id = 'ORDER_ID_HERE';
```

Verify the ship-from location exists and is active:

```sql
SELECT location_id, location_type, location_group
FROM oms.master_locations
WHERE location_id IN (
  SELECT DISTINCT ship_from_location_id
  FROM oms.allocations
  WHERE order_id = 'ORDER_ID_HERE'
);
```

Check if all order lines have allocations:

```sql
SELECT ol.order_line_id, ol.item_id,
       a.allocation_id, a.ship_from_location_id
FROM oms.order_lines ol
LEFT JOIN oms.allocations a
  ON a.order_id = ol.order_id
  AND a.order_line_id = ol.order_line_id
WHERE ol.order_id = 'ORDER_ID_HERE';
```

Check event log for errors after allocation:

```sql
SELECT event_type, event_timestamp, event_payload
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE'
  AND event_timestamp > (
    SELECT MAX(event_timestamp)
    FROM oms.log_workflow_events
    WHERE order_id = 'ORDER_ID_HERE'
      AND event_type = 'ALLOCATION_CREATED'
  )
ORDER BY event_timestamp ASC;
```

### Resolution

Verify that the carrier_code in each allocation is valid and that the ship-from location supports the delivery method. Check promising configuration for the org and delivery method. If everything looks correct, the release service may need to reprocess the order.

## General Diagnostic Tips

### Quick order health check

```sql
SELECT o.order_id, o.order_status, o.payment_status,
       o.fulfillment_status, o.is_cancelled, o.is_on_hold,
       o.created_at,
       COUNT(DISTINCT ol.order_line_id) as line_count,
       COUNT(DISTINCT a.allocation_id) as allocation_count,
       COUNT(DISTINCT r.release_id) as release_count
FROM oms.orders o
LEFT JOIN oms.order_lines ol ON ol.order_id = o.order_id
LEFT JOIN oms.allocations a ON a.order_id = o.order_id
LEFT JOIN oms.releases r ON r.order_id = o.order_id
WHERE o.order_id = 'ORDER_ID_HERE'
GROUP BY o.order_id, o.order_status, o.payment_status,
         o.fulfillment_status, o.is_cancelled, o.is_on_hold,
         o.created_at;
```

### Event log summary for an order

```sql
SELECT event_type, COUNT(*) as count,
       MIN(event_timestamp) as first_occurrence,
       MAX(event_timestamp) as last_occurrence
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE'
GROUP BY event_type
ORDER BY MIN(event_timestamp) ASC;
```
