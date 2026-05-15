# Brand Product Feature Guide

## Scope

This guide describes how brand-managed product creation and editing flows are represented across the web app, API routes, and shared contracts.

## Product Data Ownership

- Brand users can create and maintain products linked to their brand identity.
- Admin users retain moderation and approval controls.

## Product Fields

Primary product fields include:

- Name, slug, description.
- Category and subcategory metadata.
- Pricing and inventory attributes.
- Media assets and presentation content.

## Relevant Web Areas

- `apps/web/src/app/brand-dashboard/brand-dashboard-client.tsx`
- `apps/web/src/app/admin/admin-panel-client.tsx`
- `apps/web/src/app/product/[slug]/page.tsx`

## Relevant API Areas

- `apps/api/src/modules/products/products.routes.ts`
- `apps/api/src/modules/brands/brand-dashboard.routes.ts`

## Shared Types

- `packages/shared/src/index.ts`
- `apps/web/src/types/marketplace.ts`

## Validation and Moderation

- Input validation happens at API boundary and schema level.
- Approval and visibility states are controlled by role-aware flows.

## Related Docs

- `docs/Order_flow.md`
- `docs/system-design.md`