# BROADY

BROADY is a scalable PWA-based multi-brand fashion marketplace for Pakistan focused on premium editorial UX, performance, and SEO.

## Stack
- Frontend: Next.js App Router, TailwindCSS, shadcn/ui-style component architecture, Zustand, TanStack Query, next-pwa
- Backend: Node.js, Express, Prisma ORM, PostgreSQL, JWT auth + Google OAuth
- Payments: COD + JazzCash/Easypaisa integration points
- Infra-ready: Cloudinary/S3-compatible media strategy, Cloudflare CDN-ready asset URLs, Redis-ready cache abstraction

## Implemented MVP
- Homepage with editorial brand-first layout
- Brand listing
- Dedicated brand pages with dynamic routing (/brand/[slug])
- Product catalog with filters
- Hierarchical categories: Men, Women, Kids with subcategories
- Product detail page
- Wishlist (client-side persisted)
- Cart (client-side persisted)
- Checkout screen with payment method selection
- JWT + httpOnly cookie authentication with role separation (Admin/User)
- Session-backed JWT validation with revocable DB sessions
- Google OAuth login with account linking by email
- Protected routes for wishlist/cart/checkout/admin
- Basic admin panel UI + backend admin summary/orders endpoints
- SEO files: metadata, robots, sitemap
- PWA support: manifest, service worker generation, offline fallback route

## Monorepo Structure
- apps/web: customer-facing PWA storefront
- apps/api: REST API for auth, brands, products, orders, users, admin
- packages/shared: shared types/contracts

### Prisma Model Coverage
Core schema includes:
- `User` with auth-ready fields (`role`, provider, sessions)
- `Brand` -> `Product` catalog relationship
- `Cart` + `CartItem` for scalable cart persistence
- `Order` + `OrderItem` for checkout lifecycle
- `Session` + `WishlistItem` for JWT revocation and user personalization

This structure is production-ready for separation into auth/catalog/orders modules, and can be extended for payment gateways, inventory reservation, and event-driven order processing.

## API Modules (Microservice-ready split)
- Auth module: /api/auth
- Catalog module: /api/brands, /api/products
- Orders module: /api/orders
- Users module: /api/users
- Admin module: /api/admin

## Authentication Details
- Local auth:
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - Passwords are hashed with bcrypt (salt rounds: 12)
- Google auth:
   - `POST /api/auth/google` with `{ idToken }`
   - Verifies ID token server-side using Google OAuth client ID
   - Creates first-time users and links existing accounts by email
- Session security:
   - JWT includes `sessionId` and `tokenId`
   - Every protected API call validates token signature, expiry, and active DB session
   - Logout revokes current DB session and clears cookie
- RBAC:
   - `USER` and `ADMIN` roles in Prisma
   - Admin APIs are guarded by `requireAuth` + `requireAdmin`
   - Client middleware also blocks non-admin access to `/admin`

This modular boundary makes future extraction into independent services straightforward for auth, catalog, orders, and payments while preserving reusable APIs for React Native clients.
