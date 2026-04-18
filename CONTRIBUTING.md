# Contributing to Broady

Thanks for contributing to Broady. This repository is structured as a multi-app monorepo, and changes should preserve modular boundaries and production quality.

## Development Principles

- Keep modules cohesive and focused on one domain concern.
- Keep controllers/routes thin and move business logic into services.
- Preserve API backward compatibility unless a breaking change is explicitly planned.
- Prefer small, reviewable pull requests.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start local infrastructure:

```bash
npm run db:up
```

3. Configure environment:

```bash
cp .env.example .env
```

4. Start development:

```bash
npm run dev:all
```

The API startup path applies pending Prisma migrations automatically. If you change the schema, you still need to create and commit the migration in `apps/api/prisma/migrations/`.

## Quality Checks

Run before opening a pull request:

```bash
npm run lint
npm run build
```

If your change touches Prisma schema or migrations, also run API Prisma workflows as needed.

## Commit Convention

Use Conventional Commits:

- `feat: add brand invite acceptance flow`
- `fix: prevent duplicate notification queue jobs`
- `refactor: split product query builder into service`
- `docs: clarify worker deployment modes`
- `chore: update workspace lint scripts`

Guidelines:

- One logical change per commit.
- Use imperative, concise commit subjects.
- Reference issue IDs in commit body when relevant.

## Pull Request Expectations

Each PR should include:

- Clear summary of what changed and why.
- Testing notes (lint/build/manual scenarios).
- Migration notes if DB or environment settings changed.
- API impact notes for request/response changes.

## Architecture Guardrails

- Do not place heavy business logic directly in route handlers.
- Do not introduce cross-module imports that bypass service boundaries.
- Put shared contracts and cross-app primitives in `packages/shared`.
- Keep app-specific implementation details inside each app workspace.

## Security and Secrets

- Never commit real secrets or tokens.
- Use `.env` for local development only.
- Keep `.env.example` updated when adding new required variables.

## Documentation

When adding features:

- Update `README.md` if onboarding/run instructions change.
- Update relevant docs in `docs/` when architecture or behavior changes.
