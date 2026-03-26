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

## Setup
1. Install dependencies
   npm install --workspaces --include-workspace-root
2. Configure environment variables
   - copy apps/web/.env.local.example to apps/web/.env.local
   - copy apps/api/.env.example to apps/api/.env
   - ensure API DB vars are set:
     - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/broady`
     - `DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:5432/broady`
3. Start PostgreSQL locally
   - Option A (Docker, recommended):
     - `npm run db:up`
   - Option B (native PostgreSQL install):
     - install PostgreSQL 15+ and create DB: `broady`
     - ensure the same credentials in `apps/api/.env`
4. Generate Prisma client
   npm run prisma:generate -w @broady/api
5. Apply migrations and create tables
   npm run prisma:migrate -w @broady/api -- --name init_ecommerce
6. Optional: seed demo catalog data
   npm run prisma:seed -w @broady/api
7. Verify DB connectivity and CRUD flow
   npm run prisma:verify-crud -w @broady/api
8. Run development servers
   npm run dev

### Local PostgreSQL Operations
- Start DB: `npm run db:up`
- Stop DB: `npm run db:down`
- Tail DB logs: `npm run db:logs`

### Prisma Model Coverage
Core schema includes:
- `User` with auth-ready fields (`role`, provider, sessions)
- `Brand` -> `Product` catalog relationship
- `Cart` + `CartItem` for scalable cart persistence
- `Order` + `OrderItem` for checkout lifecycle
- `Session` + `WishlistItem` for JWT revocation and user personalization

This structure is production-ready for separation into auth/catalog/orders modules, and can be extended for payment gateways, inventory reservation, and event-driven order processing.

## Build Validation
- API build
  npm run build -w @broady/api
- Web build
  npm run build -w @broady/web

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

## Google OAuth Manual Setup
1. Create OAuth credentials in Google Cloud Console.
2. Set authorized JavaScript origin: `http://localhost:3000`.
3. Set API env vars in `apps/api/.env`:
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET` (reserved for future code-exchange flow)
    - `GOOGLE_CALLBACK_URL` (reserved for callback/code flow if enabled)
4. Set web env var in `apps/web/.env.local`:
    - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

If these are missing, local JWT auth still works and Google login endpoint will return a configuration error.

This modular boundary makes future extraction into independent services straightforward for auth, catalog, orders, and payments while preserving reusable APIs for React Native clients.
