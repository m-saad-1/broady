# Brands and Order Workflow

## Workflow Summary

Broady uses a split-order model to support multi-brand checkout while preserving per-brand fulfillment operations.

## Order Structure

- Parent order: user checkout envelope.
- Sub-order: brand-specific fulfillment unit.
- Order item: line-level product data under each sub-order.

## Lifecycle

1. Customer places one checkout request.
2. API creates parent order and child sub-orders by brand.
3. Each brand processes only its own sub-orders.
4. Parent order status is derived from child status progression.
5. Notifications are emitted for status transitions.

## Responsibilities

- Customer: place, view, and track consolidated order state.
- Brand: update only assigned sub-order operations.
- Admin: monitor cross-brand workflow and exceptions.

## Route Anchors

- `apps/api/src/modules/orders/orders.routes.ts`
- `apps/api/src/modules/brands/brand-dashboard.routes.ts`
- `apps/web/src/app/account/orders/page.tsx`
- `apps/web/src/app/brand/orders/page.tsx`

## Related Docs

- `docs/Order_flow.md`
- `docs/notification_system.md`