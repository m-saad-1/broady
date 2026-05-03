# 🛑 IMPORTANT: Docker is NOT installed on this machine

This development environment is configured to run **WITHOUT** Docker. 

## DO NOT:
- Use `npm run db:up`
- Use `docker compose`
- Expect any docker-related commands to work.

## INSTEAD:
- Use local **PostgreSQL** service (already running on port 5432).
- Use local **Redis** service if available, or use the **PostgreSQL fallback** for notifications.
- Ensure your `.env` files point to `localhost` for all infrastructure.

## Configuration:
- `NOTIFICATION_QUEUE_ADAPTER` should be set to `postgres` if Redis is not installed.
- `PRISMA_MIGRATE_ON_BOOT` is currently set to `false` to avoid startup hangs; use `npx prisma db push` manually if schema changes are made.

*This note is placed here to ensure that future AI agents and developers do not attempt to use Docker.*
