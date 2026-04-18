import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";
import type { NotificationEvent } from "./notification.events.js";

export type NotificationQueueJob = {
  id: string;
  event: NotificationEvent;
  attempts: number;
  nextRunAt: number;
  createdAt: number;
  lastError?: string;
};

export type NotificationDeadLetter = {
  id: string;
  event: NotificationEvent;
  attempts: number;
  errorMessage: string;
  discardedAt: number;
};

export type NotificationDeadLetterList = {
  total: number;
  items: NotificationDeadLetter[];
};

type BullWorkerHooks = {
  onFailed?: (payload: { jobId: string; attemptsMade: number; maxAttempts: number; error: string }) => void;
};

type BullWorkerHandle = {
  close: () => Promise<void>;
};

export interface NotificationQueueAdapter {
  kind: "polling" | "bullmq";
  initialize?(): Promise<void>;
  enqueue(event: NotificationEvent): Promise<void>;
  claimReady(max: number): Promise<NotificationQueueJob[]>;
  ack(jobId: string): Promise<void>;
  retry(jobId: string, errorMessage: string, delayMs: number): Promise<void>;
  discard(jobId: string, errorMessage: string): Promise<void>;
  size(): Promise<number>;
  listDeadLetters(limit: number, offset: number): Promise<NotificationDeadLetterList>;
  requeueDeadLetter(jobId: string): Promise<boolean>;
  purgeDeadLetter(jobId: string): Promise<boolean>;
  purgeDeadLetters(limit: number, olderThanMs: number): Promise<number>;
  createWorker?(
    processor: (job: NotificationQueueJob) => Promise<void>,
    hooks?: BullWorkerHooks,
  ): Promise<BullWorkerHandle>;
  shutdown?(): Promise<void>;
}

function createJobId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseRedisConnectionOptions(redisUrl: string) {
  const parsed = new URL(redisUrl);
  const dbSegment = parsed.pathname.replace("/", "").trim();
  const db = dbSegment ? Number(dbSegment) : 0;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

class InMemoryNotificationQueueAdapter implements NotificationQueueAdapter {
  kind = "polling" as const;
  private jobs = new Map<string, NotificationQueueJob>();
  private inFlight = new Set<string>();
  private deadLetters = new Map<string, NotificationDeadLetter>();

  async enqueue(event: NotificationEvent): Promise<void> {
    const now = Date.now();
    const job: NotificationQueueJob = {
      id: createJobId(),
      event,
      attempts: 0,
      nextRunAt: now,
      createdAt: now,
    };

    this.jobs.set(job.id, job);
  }

  async claimReady(max: number): Promise<NotificationQueueJob[]> {
    const now = Date.now();
    const claimed: NotificationQueueJob[] = [];

    for (const job of this.jobs.values()) {
      if (claimed.length >= max) break;
      if (this.inFlight.has(job.id)) continue;
      if (job.nextRunAt > now) continue;

      this.inFlight.add(job.id);
      claimed.push(job);
    }

    return claimed;
  }

  async ack(jobId: string): Promise<void> {
    this.inFlight.delete(jobId);
    this.jobs.delete(jobId);
  }

  async retry(jobId: string, errorMessage: string, delayMs: number): Promise<void> {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      this.inFlight.delete(jobId);
      return;
    }

    existing.attempts += 1;
    existing.lastError = errorMessage.slice(0, 500);
    existing.nextRunAt = Date.now() + Math.max(delayMs, 0);
    this.jobs.set(jobId, existing);
    this.inFlight.delete(jobId);
  }

  async discard(jobId: string, errorMessage: string): Promise<void> {
    const existing = this.jobs.get(jobId);
    const message = errorMessage.slice(0, 500);

    if (existing) {
      this.deadLetters.set(jobId, {
        id: jobId,
        event: existing.event,
        attempts: existing.attempts + 1,
        errorMessage: message,
        discardedAt: Date.now(),
      });
    }

    this.inFlight.delete(jobId);
    this.jobs.delete(jobId);
  }

  async size(): Promise<number> {
    return this.jobs.size;
  }

  async listDeadLetters(limit: number, offset: number): Promise<NotificationDeadLetterList> {
    const clampedLimit = Math.max(1, Math.min(limit, 200));
    const clampedOffset = Math.max(0, offset);
    const all = Array.from(this.deadLetters.values()).sort((a, b) => b.discardedAt - a.discardedAt);

    return {
      total: all.length,
      items: all.slice(clampedOffset, clampedOffset + clampedLimit),
    };
  }

  async requeueDeadLetter(jobId: string): Promise<boolean> {
    const dead = this.deadLetters.get(jobId);
    if (!dead) return false;

    this.jobs.set(jobId, {
      id: jobId,
      event: dead.event,
      attempts: 0,
      nextRunAt: Date.now(),
      createdAt: Date.now(),
      lastError: undefined,
    });
    this.deadLetters.delete(jobId);
    return true;
  }

  async purgeDeadLetter(jobId: string): Promise<boolean> {
    return this.deadLetters.delete(jobId);
  }

  async purgeDeadLetters(limit: number, olderThanMs: number): Promise<number> {
    const clampedLimit = Math.max(1, Math.min(limit, 500));
    const minDiscardedAt = Date.now() - Math.max(olderThanMs, 0);
    let purged = 0;

    for (const [id, dead] of this.deadLetters.entries()) {
      if (purged >= clampedLimit) break;
      if (dead.discardedAt > minDiscardedAt) continue;

      this.deadLetters.delete(id);
      purged += 1;
    }

    return purged;
  }
}

class PostgresNotificationQueueAdapter implements NotificationQueueAdapter {
  kind = "polling" as const;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS notification_event_jobs (
        id TEXT PRIMARY KEY,
        event_json JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        locked_at TIMESTAMPTZ,
        last_error TEXT
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS notification_event_dead_letters (
        id TEXT PRIMARY KEY,
        event_json JSONB NOT NULL,
        attempts INTEGER NOT NULL,
        error_message TEXT NOT NULL,
        discarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS notification_event_jobs_ready_idx
      ON notification_event_jobs (next_run_at)
      WHERE locked_at IS NULL;
    `);

    this.initialized = true;
  }

  async enqueue(event: NotificationEvent): Promise<void> {
    await this.initialize();

    await prisma.$executeRaw`
      INSERT INTO notification_event_jobs (id, event_json, attempts, next_run_at, created_at)
      VALUES (${createJobId()}, ${JSON.stringify(event)}::jsonb, 0, NOW(), NOW())
    `;
  }

  async claimReady(max: number): Promise<NotificationQueueJob[]> {
    await this.initialize();

    if (max <= 0) return [];

    type DbRow = {
      id: string;
      event_json: unknown;
      attempts: number;
      next_run_at: Date;
      created_at: Date;
      last_error: string | null;
    };

    const rows = await prisma.$queryRaw<DbRow[]>`
      WITH candidates AS (
        SELECT id
        FROM notification_event_jobs
        WHERE (
            locked_at IS NULL
            OR locked_at <= NOW() - (${env.notificationWorkerLockTimeoutMs} * INTERVAL '1 millisecond')
          )
          AND next_run_at <= NOW()
        ORDER BY next_run_at ASC
        LIMIT ${max}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_event_jobs j
      SET locked_at = NOW()
      FROM candidates
      WHERE j.id = candidates.id
      RETURNING j.id, j.event_json, j.attempts, j.next_run_at, j.created_at, j.last_error
    `;

    return rows
      .map((row) => {
        const event = row.event_json as NotificationEvent;
        return {
          id: row.id,
          event,
          attempts: row.attempts,
          nextRunAt: row.next_run_at.getTime(),
          createdAt: row.created_at.getTime(),
          lastError: row.last_error || undefined,
        };
      })
      .filter((row) => Boolean(row.event?.name));
  }

  async ack(jobId: string): Promise<void> {
    await this.initialize();

    await prisma.$executeRaw`
      DELETE FROM notification_event_jobs
      WHERE id = ${jobId}
    `;
  }

  async retry(jobId: string, errorMessage: string, delayMs: number): Promise<void> {
    await this.initialize();

    await prisma.$executeRaw`
      UPDATE notification_event_jobs
      SET attempts = attempts + 1,
          locked_at = NULL,
          next_run_at = NOW() + (${Math.max(0, delayMs)} * INTERVAL '1 millisecond'),
          last_error = ${errorMessage.slice(0, 500)}
      WHERE id = ${jobId}
    `;
  }

  async discard(jobId: string, errorMessage: string): Promise<void> {
    await this.initialize();

    type EventRow = { event_json: unknown; attempts: number };
    const row = await prisma.$queryRaw<EventRow[]>`
      SELECT event_json, attempts
      FROM notification_event_jobs
      WHERE id = ${jobId}
      LIMIT 1
    `;

    await prisma.$executeRaw`
      DELETE FROM notification_event_jobs
      WHERE id = ${jobId}
    `;

    if (row[0]) {
      await prisma.$executeRaw`
        INSERT INTO notification_event_dead_letters (id, event_json, attempts, error_message, discarded_at)
        VALUES (${jobId}, ${JSON.stringify(row[0].event_json)}::jsonb, ${row[0].attempts + 1}, ${errorMessage.slice(0, 500)}, NOW())
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  async size(): Promise<number> {
    await this.initialize();

    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM notification_event_jobs
    `;

    return Number(rows[0]?.count || 0n);
  }

  async listDeadLetters(limit: number, offset: number): Promise<NotificationDeadLetterList> {
    await this.initialize();

    const clampedLimit = Math.max(1, Math.min(limit, 200));
    const clampedOffset = Math.max(0, offset);

    type DeadLetterRow = {
      id: string;
      event_json: unknown;
      attempts: number;
      error_message: string;
      discarded_at: Date;
    };

    const rows = await prisma.$queryRaw<DeadLetterRow[]>`
      SELECT id, event_json, attempts, error_message, discarded_at
      FROM notification_event_dead_letters
      ORDER BY discarded_at DESC
      LIMIT ${clampedLimit}
      OFFSET ${clampedOffset}
    `;

    const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM notification_event_dead_letters
    `;

    return {
      total: Number(totalRows[0]?.count || 0n),
      items: rows
        .map((row) => ({
          id: row.id,
          event: row.event_json as NotificationEvent,
          attempts: row.attempts,
          errorMessage: row.error_message,
          discardedAt: row.discarded_at.getTime(),
        }))
        .filter((item) => Boolean(item.event?.name)),
    };
  }

  async requeueDeadLetter(jobId: string): Promise<boolean> {
    await this.initialize();

    const insertedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH moved AS (
        DELETE FROM notification_event_dead_letters
        WHERE id = ${jobId}
        RETURNING event_json
      )
      INSERT INTO notification_event_jobs (id, event_json, attempts, next_run_at, created_at)
      SELECT ${createJobId()}, moved.event_json, 0, NOW(), NOW()
      FROM moved
      RETURNING id
    `;

    return insertedRows.length > 0;
  }

  async purgeDeadLetter(jobId: string): Promise<boolean> {
    await this.initialize();

    const deleted = await prisma.$executeRaw`
      DELETE FROM notification_event_dead_letters
      WHERE id = ${jobId}
    `;

    return deleted > 0;
  }

  async purgeDeadLetters(limit: number, olderThanMs: number): Promise<number> {
    await this.initialize();

    const clampedLimit = Math.max(1, Math.min(limit, 500));
    const clampedOlderThan = Math.max(olderThanMs, 0);

    const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH candidates AS (
        SELECT id
        FROM notification_event_dead_letters
        WHERE discarded_at <= NOW() - (${clampedOlderThan} * INTERVAL '1 millisecond')
        ORDER BY discarded_at ASC
        LIMIT ${clampedLimit}
      )
      DELETE FROM notification_event_dead_letters d
      USING candidates
      WHERE d.id = candidates.id
      RETURNING d.id
    `;

    return deletedRows.length;
  }
}

class RedisBullMqNotificationQueueAdapter implements NotificationQueueAdapter {
  kind = "bullmq" as const;
  private initialized = false;
  private connectionOptions = parseRedisConnectionOptions(env.redisUrl);
  private queue: Queue<NotificationEvent> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.queue = new Queue<NotificationEvent>(env.notificationRedisQueueName, {
      connection: this.connectionOptions,
      prefix: env.notificationRedisPrefix,
    });

    this.initialized = true;
  }

  async enqueue(event: NotificationEvent): Promise<void> {
    await this.initialize();

    await this.queue!.add("notification-event", event, {
      attempts: Math.max(env.notificationWorkerMaxAttempts, 1),
      backoff: {
        type: "exponential",
        delay: 500,
      },
      removeOnComplete: {
        count: 1000,
      },
      removeOnFail: false,
    });
  }

  async claimReady(_max: number): Promise<NotificationQueueJob[]> {
    void _max;
    throw new Error("claimReady is not used in bullmq mode");
  }

  async ack(_jobId: string): Promise<void> {
    void _jobId;
    throw new Error("ack is not used in bullmq mode");
  }

  async retry(_jobId: string, _errorMessage: string, _delayMs: number): Promise<void> {
    void _jobId;
    void _errorMessage;
    void _delayMs;
    throw new Error("retry is not used in bullmq mode");
  }

  async discard(_jobId: string, _errorMessage: string): Promise<void> {
    void _jobId;
    void _errorMessage;
    throw new Error("discard is not used in bullmq mode");
  }

  async size(): Promise<number> {
    await this.initialize();

    const counts = await this.queue!.getJobCounts("waiting", "active", "delayed", "prioritized", "paused");
    return Object.values(counts).reduce((sum, value) => sum + Number(value), 0);
  }

  async listDeadLetters(limit: number, offset: number): Promise<NotificationDeadLetterList> {
    await this.initialize();

    const clampedLimit = Math.max(1, Math.min(limit, 200));
    const clampedOffset = Math.max(0, offset);
    const totalCounts = await this.queue!.getJobCounts("failed");
    const failedJobs = await this.queue!.getFailed(clampedOffset, clampedOffset + clampedLimit - 1);

    return {
      total: Number(totalCounts.failed || 0),
      items: failedJobs
        .map((job) => ({
          id: String(job.id),
          event: job.data,
          attempts: job.attemptsMade,
          errorMessage: String(job.failedReason || "Unknown failure"),
          discardedAt: Number(job.finishedOn || job.processedOn || job.timestamp || Date.now()),
        }))
        .filter((item) => Boolean(item.event?.name)),
    };
  }

  async requeueDeadLetter(jobId: string): Promise<boolean> {
    await this.initialize();

    const job = await this.queue!.getJob(jobId);
    if (!job) return false;

    try {
      await job.retry();
      return true;
    } catch {
      return false;
    }
  }

  async purgeDeadLetter(jobId: string): Promise<boolean> {
    await this.initialize();

    const job = await this.queue!.getJob(jobId);
    if (!job) return false;

    try {
      await job.remove();
      return true;
    } catch {
      return false;
    }
  }

  async purgeDeadLetters(limit: number, olderThanMs: number): Promise<number> {
    await this.initialize();

    const clampedLimit = Math.max(1, Math.min(limit, 500));
    const clampedOlderThan = Math.max(olderThanMs, 0);
    const deleted = await this.queue!.clean(clampedOlderThan, clampedLimit, "failed");
    return deleted.length;
  }

  async createWorker(
    processor: (job: NotificationQueueJob) => Promise<void>,
    hooks?: BullWorkerHooks,
  ): Promise<BullWorkerHandle> {
    await this.initialize();

    const worker = new Worker<NotificationEvent>(
      env.notificationRedisQueueName,
      async (job: Job<NotificationEvent>) => {
        await processor({
          id: String(job.id),
          event: job.data,
          attempts: job.attemptsMade,
          nextRunAt: Date.now(),
          createdAt: Date.now(),
          lastError: (job.failedReason as string | undefined) || undefined,
        });
      },
      {
        connection: this.connectionOptions,
        concurrency: env.notificationWorkerConcurrency,
        prefix: env.notificationRedisPrefix,
      },
    );

    worker.on("failed", (job, error) => {
      if (!job) return;

      hooks?.onFailed?.({
        jobId: String(job.id),
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts || env.notificationWorkerMaxAttempts,
        error: error.message,
      });
    });

    return {
      close: async () => {
        await worker.close();
      },
    };
  }

  async shutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}

let queueAdapter: NotificationQueueAdapter | null = null;

export function getNotificationQueueAdapter(): NotificationQueueAdapter {
  if (queueAdapter) return queueAdapter;

  if (env.notificationQueueAdapter === "redis") {
    queueAdapter = new RedisBullMqNotificationQueueAdapter();
    return queueAdapter;
  }

  if (env.notificationQueueAdapter === "postgres") {
    queueAdapter = new PostgresNotificationQueueAdapter();
    return queueAdapter;
  }

  queueAdapter = new InMemoryNotificationQueueAdapter();
  return queueAdapter;
}

export async function enqueueNotificationEvent(event: NotificationEvent) {
  const adapter = getNotificationQueueAdapter();
  await adapter.enqueue(event);
}

export async function listNotificationDeadLetters(limit: number, offset: number) {
  const adapter = getNotificationQueueAdapter();
  return adapter.listDeadLetters(limit, offset);
}

export async function requeueNotificationDeadLetter(jobId: string) {
  const adapter = getNotificationQueueAdapter();
  return adapter.requeueDeadLetter(jobId);
}

export async function purgeNotificationDeadLetter(jobId: string) {
  const adapter = getNotificationQueueAdapter();
  return adapter.purgeDeadLetter(jobId);
}

export async function purgeNotificationDeadLetters(limit: number, olderThanMs: number) {
  const adapter = getNotificationQueueAdapter();
  return adapter.purgeDeadLetters(limit, olderThanMs);
}
