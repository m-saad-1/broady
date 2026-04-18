# Brand Dashboard System

## Purpose

The Brand Dashboard gives brand operators a focused workspace to manage products, monitor brand-owned orders, and respond to operational events.

## Core Responsibilities

- Product lifecycle for brand catalog items.
- Brand-side order handling through sub-order flows.
- Brand-specific notifications and action prompts.

## Main Web Surfaces

- `apps/web/src/app/brand-dashboard/page.tsx`
- `apps/web/src/app/brand-dashboard/brand-dashboard-client.tsx`
- `apps/web/src/app/brand/dashboard/page.tsx`
- `apps/web/src/app/brand/orders/page.tsx`
- `apps/web/src/app/brand/orders/[id]/page.tsx`

## Main API Surfaces

- `apps/api/src/modules/brands/brand-dashboard.routes.ts`
- `apps/api/src/modules/orders/orders.routes.ts`
- `apps/api/src/modules/notifications/notification.worker.ts`

## Access Model

- Authenticated brand role required.
- Role checks enforced in API middleware and route guards.

## Operational Notes

- Order updates are modeled at sub-order level to isolate each brand's fulfillment boundaries.
- Notification events are pushed asynchronously through worker adapters.

## Related Docs

- `docs/Order_flow.md`
- `docs/notification_system.md`
- `docs/system-design.md`