# Order Flow

This document describes Broady's split-order marketplace model.

## Why Split Orders

A single customer checkout can contain items from multiple brands. Each brand must manage only its own fulfillment lifecycle.

## Data Model

Broady uses three layers:

- `Order` (parent order): customer-facing order and payment context.
- `SubOrder`: brand-specific fulfillment unit.
- `OrderItem`: line items linked to both order and sub-order.

Relevant schema is defined in `apps/api/prisma/schema.prisma`.

## Lifecycle

1. Customer places an order.
2. System creates one parent order.
3. System groups cart items by brand and creates sub-orders.
4. Sub-order statuses are updated by authorized brand/admin users.
5. Parent order status is derived from sub-order statuses.

## Status Semantics

Sub-order status values:

- `PENDING`
- `CONFIRMED`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `CANCELED`

Parent order status is computed from the aggregate of sub-order states. This prevents one brand update from incorrectly changing another brand's fulfillment state.

## Access Control

- Brand users can only update sub-orders that belong to their brand.
- Admin users can manage all sub-orders and parent orders.
- Customers only read their own order history and status.

## Logging and Audit

- Parent transitions are tracked in `OrderStatusLog`.
- Sub-order transitions are tracked in `SubOrderStatusLog`.
- Notification events are emitted on key lifecycle transitions.

## API Surface

Primary modules and routes:

- Customer order APIs: `apps/api/src/modules/orders/orders.routes.ts`
- Brand order APIs: `apps/api/src/modules/brands/brand-dashboard.routes.ts`

## Operational Guidance

- Never bypass sub-order transitions for brand-specific fulfillment changes.
- Keep parent status derivation deterministic.
- Keep payment settlement logic attached to the parent order context.