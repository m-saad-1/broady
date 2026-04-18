# Quick Start

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local Postgres and Redis)

## 1) Install

Run from repository root:

```bash
npm install
```

## 2) Configure Environment

Create a root env file from template:

```bash
cp .env.example .env
```

Review API-specific template:

- `apps/api/.env.example`

## 3) Start Local Services

```bash
npm run db:up
```

## 4) Run Applications

```bash
npm run dev:all
```

Optional modes:

- `npm run dev` for web and api only.
- `npm run dev:worker` for standalone worker development.

## 5) Validate

```bash
npm run lint
npm run build
```

## References

- `README.md`
- `docs/README.md`