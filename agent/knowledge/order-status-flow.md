# Order Status Flow

## Overview

An order in the OMS goes through a defined lifecycle from creation to delivery. Each status transition is triggered by a specific business event and recorded in the workflow event log.

## Order Status Lifecycle

The primary order status flow is:

```
Open -> Allocated -> Released -> In Process -> Picked -> Fulfilled -> Delivered
```

With partial status branches:

```
In Process -> Partial In Process (some lines picked, others still processing)
Picked -> Partial Picked (some lines fulfilled, others still being picked)
```

## Status Definitions

### Open

The order has been created and validated. Payment is authorized. The system is ready to begin inventory promising and allocation.

Triggered by: Order creation via the selling channel (Web).

What happens next: The promising service requests inventory reservation.

### Allocated

Inventory has been reserved (allocated) for all order lines. Each line is assigned a ship-from location and carrier.

Triggered by: Successful promising and allocation response.

What happens next: The system creates releases (shipment groups) from the allocated locations.

### Released

Release groups have been created. Items are grouped by ship-from location and carrier for shipment.

Triggered by: Release creation service processes allocations into release groups.

What happens next: Releases are sent to the store/warehouse for fulfillment processing.

### In Process

The store or warehouse has received the release and begun processing. Items are being picked from shelves.

Triggered by: Store acknowledgment of the release (RELEASE_SENT_TO_STORE event).

What happens next: Items are picked and packed for shipment.

### Partial In Process

Some order lines have been picked while others are still being processed. This occurs when an order has multiple releases from different locations, or when some items take longer to locate.

### Picked

All items in the order have been picked from shelves and are ready for packing and shipment.

Triggered by: FULFILLMENT_PICKED event for all lines.

What happens next: Items are packed and shipped.

### Partial Picked

Some order lines have been fulfilled (shipped) while others are still at the picked stage. This occurs with multi-release orders.

### Fulfilled

All items have been packed and shipped. The order is in transit to the customer.

Triggered by: FULFILLMENT_SHIPPED event for all lines.

What happens next: Delivery carrier transports the order to the customer.

### Delivered

The customer has received the order. This is the terminal status for a successful order.

Triggered by: FULFILLMENT_DELIVERED event confirming delivery.

## Payment Status Flow

Payment follows a separate lifecycle:

```
Authorized -> Awaiting Invoice -> Paid
```

### Authorized

Payment has been authorized (funds reserved) but not yet captured.

### Awaiting Invoice

The order has been fulfilled and an invoice needs to be generated for payment capture.

### Paid

Payment has been captured. The transaction is complete.

## Event Types and Status Mapping

The `support.log_workflow_events` table records every state transition. Here is how the 12 event types map to the order lifecycle:

### ORDER_CREATED

The order is first created in the system. Order status becomes `Open`.

Previous status: none. New status: Open.

### ORDER_VALIDATED

The order passes validation checks (payment authorized, items valid, customer info complete).

Occurs while order is still in `Open` status.

### PROMISING_REQUESTED

The system sends a request to the promising service to find inventory availability and reserve stock.

Occurs while order is still in `Open` status.

### ALLOCATION_CREATED

Inventory has been allocated (reserved) for specific order lines at specific locations.

Order status transitions to `Allocated`.

### RELEASE_CREATED

A release group is created, grouping allocated items by ship-from location.

Order status transitions to `Released`.

### RELEASE_LINE_CREATED

Individual lines are added to the release group.

Occurs during the `Released` status.

### RELEASE_SENT_TO_STORE

The release is sent to the store/warehouse for processing.

Order status transitions to `In Process`.

### FULFILLMENT_PACKED

Items in the release have been packed for shipment.

Occurs during `In Process` status.

### FULFILLMENT_PICKED

Items have been picked from shelves.

Order status transitions to `Picked` (or `Partial Picked` if not all lines are complete).

### FULFILLMENT_SHIPPED

The shipment has left the store/warehouse.

Order status transitions to `Fulfilled`.

### FULFILLMENT_STATUS_UPDATED

A generic fulfillment status update event. Used for intermediate status changes.

### FULFILLMENT_DELIVERED

The order has been delivered to the customer.

Order status transitions to `Delivered`.

## Diagnostic Queries

### Check current order status

```sql
SELECT order_id, order_status, fulfillment_status, payment_status,
       is_cancelled, is_on_hold, created_at
FROM oms.orders
WHERE order_id = 'ORDER_ID_HERE';
```

### View order event timeline

```sql
SELECT event_type, previous_status, new_status,
       event_timestamp, entity_type, entity_id
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE'
ORDER BY event_timestamp ASC;
```

### Count orders by status

```sql
SELECT order_status, COUNT(*) as count
FROM oms.orders
WHERE is_cancelled = false
GROUP BY order_status
ORDER BY count DESC;
```

### Find orders stuck in a status

```sql
SELECT order_id, order_status, created_at,
       NOW() - created_at as age
FROM oms.orders
WHERE order_status = 'Allocated'
  AND is_cancelled = false
  AND is_on_hold = false
ORDER BY created_at ASC;
```

### View the latest event for each order

```sql
SELECT DISTINCT ON (order_id)
       order_id, event_type, new_status, event_timestamp
FROM oms.log_workflow_events
ORDER BY order_id, event_timestamp DESC;
```

### Check time between status transitions

```sql
SELECT order_id,
       event_type,
       event_timestamp,
       LAG(event_timestamp) OVER (PARTITION BY order_id ORDER BY event_timestamp) as prev_event_time,
       event_timestamp - LAG(event_timestamp) OVER (PARTITION BY order_id ORDER BY event_timestamp) as duration
FROM oms.log_workflow_events
WHERE order_id = 'ORDER_ID_HERE'
ORDER BY event_timestamp;
```
