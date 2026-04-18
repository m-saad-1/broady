# Notification System

This document defines the production notification model used by Broady.

## Goals

- Keep domain logic and delivery logic decoupled.
- Support multiple delivery channels without changing feature modules.
- Provide retry and dead-letter handling for operational safety.

## Event-Driven Flow

1. A domain module emits a notification event (order, payment, product moderation, review).
2. The event is queued through the notification service.
3. Worker processes the event and resolves recipients, templates, and channels.
4. Delivery results are persisted for audit and troubleshooting.

## Core Components

- Event names: `apps/api/src/modules/notifications/notification.events.ts`
- Queue and adapter routing: `apps/api/src/modules/notifications/notification.queue.ts`
- Delivery orchestration: `apps/api/src/modules/notifications/notification.service.ts`
- Worker runtime: `apps/api/src/modules/notifications/notification.worker.ts`
- Content templates: `apps/api/src/modules/notifications/notification.templates.ts`
- Channel rules: `apps/api/src/modules/notifications/notification.rules.ts`

## Delivery Channels

- Dashboard notifications (first-class channel)
- Email notifications
- WhatsApp webhook integration (optional based on event and config)

## Worker Deployment Modes

Broady supports both deployment patterns.

- Embedded mode: worker runs inside API process.
- Standalone mode: worker runs as a separate process.

Use environment variables to choose mode:

- `NOTIFICATION_WORKER_EMBEDDED=true|false`
- `NOTIFICATION_QUEUE_ADAPTER=redis|postgres|memory`
- `NOTIFICATION_WORKER_HEALTH_PORT=0|<port>`

## Reliability and Operations

- Retries are handled by the active adapter and worker config.
- Dead-letter records are available via admin endpoints.
- Worker health and queue behavior should be monitored in production.

## Admin Endpoints

- `GET /api/admin/notifications/worker`
- `GET /api/admin/notifications/dead-letters`
- `POST /api/admin/notifications/dead-letters/:jobId/requeue`
- `DELETE /api/admin/notifications/dead-letters/:jobId`

## Rules for Contributors

- Do not send external notifications directly inside domain route handlers.
- Emit structured events and let notification services decide delivery.
- Add templates and routing rules for any new event type.