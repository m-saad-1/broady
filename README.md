# Broady 🛍️

A modern, scalable multi-brand fashion marketplace platform built with a modular monorepo architecture.

**Broady** combines a Next.js customer/admin storefront with an Express/Prisma API and an asynchronous notification worker to support event-driven commerce operations at scale.

---

## 📋 Table of Contents

- [Problem Statement](#problem-statement)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Quick Start](#quick-start)
- [Development](#development)
- [API Surface](#api-surface)
- [Worker Modes](#worker-modes)
- [Database & Prisma](#database--prisma)
- [Documentation](#documentation)
- [Contribution](#contribution)
- [License](#license)

---

## 🎯 Problem Statement

Most marketplace implementations become hard to maintain as they scale because business logic, infrastructure code, and product features are coupled together. 

**Broady** is structured to keep domains isolated with clear separation of concerns:
- Domain modules encapsulate business logic and data access
- Infrastructure (auth, middleware, error handling) is decoupled from business rules
- The notification worker is independent and resilient
- Shared types live in a dedicated package for contract consistency

This architecture enables teams to:
- Add new features without affecting existing domains
- Scale specific services independently
- Write focused, testable code
- Onboard new developers faster

---

## 🏗️ Architecture Overview

Broady follows a **module-oriented monorepo architecture**:

### Workspace Structure
```
broady/
├── apps/
│   ├── api/              # Express API with domain modules
│   └── web/              # Next.js customer & admin interface
├── packages/
│   └── shared/           # Shared types and contracts
└── docs/                 # Architecture & operational guides
```

### Runtime Processes
The system splits into three independent concerns:

1. **HTTP API Process** (`apps/api/src/server.ts`)
   - Handles all business logic endpoints
   - Manages authentication and authorization
   - Exposes domain APIs and admin endpoints

2. **Notification Worker Process** (`apps/api/src/notification-worker.ts`)
   - Processes event-driven notifications asynchronously
   - Can run embedded (in-process) or standalone
   - Supports Redis, PostgreSQL, or in-memory queue adapters

3. **Web Process** (`apps/web`)
   - Customer storefront (product browsing, checkout)
   - Admin dashboard (inventory, orders, brand management)
   - Real-time order status and notifications

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js App Router, React, Tailwind CSS, Zustand, TanStack Query |
| **Backend** | Node.js 20+, Express, TypeScript |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Queueing** | Redis + BullMQ (with PostgreSQL/in-memory fallbacks) |
| **Authentication** | JWT + Session validation + Google OAuth |
| **Monorepo** | npm workspaces |

---

## 📁 Repository Structure

```
broady/
├── apps/
│   ├── api/
│   │   ├── prisma/                 # Schema and migrations
│   │   ├── src/
│   │   │   ├── config/             # Environment and config
│   │   │   ├── middleware/         # Auth, error handling, logging
│   │   │   ├── modules/            # Domain business logic
│   │   │   ├── routes/             # HTTP route definitions
│   │   │   ├── app.ts              # Express app setup
│   │   │   ├── server.ts           # HTTP server entry point
│   │   │   └── notification-worker.ts  # Worker entry point
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── app/                # Next.js App Router pages
│       │   ├── components/         # React components
│       │   ├── lib/                # Utilities and hooks
│       │   ├── providers/          # Context providers
│       │   ├── stores/             # Zustand state management
│       │   └── types/              # Local type definitions
│       ├── .env.example
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   └── types/              # Shared contracts and DTOs
│       └── package.json
│
├── docs/
│   ├── README.md                   # Documentation map
│   ├── Github_push_strategy.md     # Contribution standards
│   ├── Order_flow.md               # Order and fulfillment model
│   └── notification_system.md      # Event-driven architecture
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md (this file)
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **PostgreSQL** (local service)
- **Redis** (local service, or use PostgreSQL fallback)

> [!IMPORTANT]
> **Docker is NOT available on this machine.** All infrastructure must run as local services.

### 1. Clone & Install

```bash
git clone https://github.com/m-saad-1/broady.git
cd broady
npm install
```

### 2. Configure Environment

Copy the environment template and adjust values:

```bash
cp .env.example .env
```

For API-specific overrides, also review:
```bash
cp apps/api/.env.example apps/api/.env
```

### 3. Start Local Infrastructure

Ensure PostgreSQL and Redis are running, then:

```bash
npm run db:up
```

This initializes the database and applies pending migrations.

### 4. Run Applications

**All processes (recommended for development):**
```bash
npm run dev:all
```

**Alternative commands:**
- `npm run dev` – Web + API only
- `npm run dev:web` – Web app only
- `npm run dev:api` – API only
- `npm run dev:worker` – Worker in watch mode

### 5. Verify Setup

- **Web app:** [http://localhost:3000](http://localhost:3000)
- **API health:** `curl http://localhost:4000/health`
- **Worker health:** Check logs for "Worker ready"

---

## 💻 Development

### Build & Lint

```bash
# Lint all workspaces
npm run lint

# Lint specific workspace
npm run lint -w @broady/web
npm run lint -w @broady/api

# Build all workspaces
npm run build

# Build specific workspace
npm run build -w @broady/web
npm run build -w @broady/api
```

### Database & Migrations

From the `apps/api` workspace:

```bash
# Generate Prisma client
npm run prisma:generate -w @broady/api

# Create and apply migrations
npm run prisma:migrate -w @broady/api

# Seed database with sample data
npm run prisma:seed -w @broady/api
```

> [!NOTE]
> The API automatically runs `prisma migrate deploy` on startup before opening the HTTP port. New migrations are applied automatically.

### Testing Status

Currently, validation is done through:
- **Linting** – ESLint and TypeScript strict mode
- **Build checks** – Full workspace compilation
- **Smoke tests** – Focused integration scripts

A formal test suite is on the roadmap.

---

## 📡 API Surface

### Authentication
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # User login
POST   /api/auth/google            # Google OAuth verification
```

### Catalog
```
GET    /api/brands                 # List brands
GET    /api/products               # List products with filters
GET    /api/products/:id           # Product details
```

### Orders
```
POST   /api/orders                 # Create order
GET    /api/orders/:id             # Order details
GET    /api/orders                 # List user orders
```

### User Features
```
GET    /api/users/notifications    # Fetch user notifications
```

### Admin Panel
```
GET    /api/admin/summary          # Dashboard summary stats
GET    /api/admin/notifications/worker        # Worker status
GET    /api/admin/notifications/dead-letters  # Failed jobs
POST   /api/admin/notifications/dead-letters/:jobId/requeue  # Retry job
```

For complete API documentation, see `docs/API.md` (if available).

---

## ⚙️ Worker Modes

The notification worker supports multiple deployment patterns:

### Embedded Mode (Default)
Worker runs in the same process as the API:
```bash
NOTIFICATION_WORKER_EMBEDDED=true npm run dev:api
```

### Standalone Mode
Worker runs as a separate process:
```bash
npm run start:worker -w @broady/api
```

### Configuration

```env
# Enable/disable embedded worker
NOTIFICATION_WORKER_EMBEDDED=true|false

# Queue adapter: redis, postgres, or memory
NOTIFICATION_QUEUE_ADAPTER=redis

# Health check port (0 = disabled)
NOTIFICATION_WORKER_HEALTH_PORT=4001
```

---

## 📦 Database & Prisma

### Schema & Migrations

The Prisma schema is located at `apps/api/prisma/schema.prisma`.

Key models:
- **User** – Authentication and profile
- **Brand** – Marketplace brands
- **Product** – Product catalog
- **Order** – Customer orders (can split into SubOrders)
- **SubOrder** – Fulfillment units per brand

### Common Tasks

```bash
# Create a new migration
npx prisma migrate dev --name add_field_name

# View database in Prisma Studio
npx prisma studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

---

## 📚 Documentation

- **[docs/README.md](./docs/README.md)** – Documentation map and curation policy
- **[docs/Github_push_strategy.md](./docs/Github_push_strategy.md)** – Architecture and contribution standards
- **[docs/Order_flow.md](./docs/Order_flow.md)** – Order model, split logic, and fulfillment semantics
- **[docs/notification_system.md](./docs/notification_system.md)** – Event-driven notifications, queue adapters, and worker lifecycle

---

## 🤝 Contribution

### Getting Started

1. Read `[CONTRIBUTING.md](./CONTRIBUTING.md)` for guidelines
2. Check `[docs/Github_push_strategy.md](./docs/Github_push_strategy.md)` for architecture standards
3. Create a feature branch from `main`

### Commit Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:    Add new feature
fix:     Bug fix
refactor: Code refactoring
docs:    Documentation updates
chore:   Build, dependencies, or tooling
```

Example:
```bash
git commit -m "feat: add product search filters"
```

---

## 📄 License

This project is proprietary. See [LICENSE](./LICENSE) for details.

---

## 🎓 Key Concepts

### Modular Domain Architecture
Each domain (Users, Products, Orders, Notifications) is self-contained with its own logic, data access, and validation.

### Event-Driven Notifications
Rather than synchronous email/SMS, events are queued and processed asynchronously by the worker for reliability and scalability.

### Order Split Model
Orders can split into SubOrders per brand, allowing independent fulfillment workflows while maintaining a unified customer experience.

### Multiple Queue Adapters
Support for Redis (production), PostgreSQL (serverless), and in-memory (development) adapters provides flexibility across deployment scenarios.

---

## 🆘 Troubleshooting

### API won't start
- Ensure PostgreSQL is running: `psql -U postgres`
- Check `.env` database URL is correct
- Run `npm run prisma:migrate -w @broady/api`

### Worker not processing jobs
- Verify Redis is running: `redis-cli ping`
- Check `NOTIFICATION_QUEUE_ADAPTER` setting
- Review worker logs for errors

### Web app can't connect to API
- Verify API is running on `http://localhost:4000`
- Check `NEXT_PUBLIC_API_URL` in `.env`
- Look for CORS errors in browser console

For more help, see `docs/` or open an issue.

---

**Built with ❤️ by the Broady team**
