import { env } from "../../config/env.js";
import { getNotificationQueueAdapter } from "./notification.queue.js";
import { emitNotificationEvent } from "./notification.service.js";

type WorkerState = {
  running: boolean;
  timer: NodeJS.Timeout | null;
  bullWorker: { close: () => Promise<void> } | null;
  activeJobs: number;
  processed: number;
  retried: number;
  discarded: number;
  failed: number;
  startedAt: number | null;
};

const state: WorkerState = {
  running: false,
  timer: null,
  bullWorker: null,
  activeJobs: 0,
  processed: 0,
  retried: 0,
  discarded: 0,
  failed: 0,
  startedAt: null,
};

function getBackoffMs(attempt: number) {
  const schedule = [500, 1500, 5000, 10000];
  return schedule[Math.min(attempt, schedule.length - 1)];
}

async function tick() {
  if (!state.running) return;

  const adapter = getNotificationQueueAdapter();
  const availableSlots = Math.max(env.notificationWorkerConcurrency - state.activeJobs, 0);

  if (availableSlots <= 0) return;

  const jobs = await adapter.claimReady(availableSlots);
  if (jobs.length === 0) return;

  for (const job of jobs) {
    state.activeJobs += 1;

    void (async () => {
      try {
        await emitNotificationEvent(job.event);
        await adapter.ack(job.id);
        state.processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        state.failed += 1;

        if (job.attempts + 1 >= env.notificationWorkerMaxAttempts) {
          await adapter.discard(job.id, message);
          state.discarded += 1;
          console.error("[notifications] discarded event job after max attempts", {
            jobId: job.id,
            event: job.event.name,
            attempts: job.attempts + 1,
            error: message,
          });
        } else {
          const delay = getBackoffMs(job.attempts);
          await adapter.retry(job.id, message, delay);
          state.retried += 1;
          console.warn("[notifications] retrying event job", {
            jobId: job.id,
            event: job.event.name,
            attempts: job.attempts + 1,
            retryInMs: delay,
            error: message,
          });
        }
      } finally {
        state.activeJobs = Math.max(state.activeJobs - 1, 0);
      }
    })();
  }
}

export function startNotificationWorker() {
  if (state.running) {
    return;
  }

  state.running = true;
  state.startedAt = Date.now();
  const adapter = getNotificationQueueAdapter();

  if (adapter.kind === "bullmq" && adapter.createWorker) {
    const createWorker = adapter.createWorker;
    void (async () => {
      try {
        await adapter.initialize?.();
        state.bullWorker = await createWorker(
          async (job) => {
            state.activeJobs += 1;
            try {
              await emitNotificationEvent(job.event);
              state.processed += 1;
            } catch (error) {
              state.failed += 1;
              throw error;
            } finally {
              state.activeJobs = Math.max(state.activeJobs - 1, 0);
            }
          },
          {
            onFailed: ({ jobId, attemptsMade, maxAttempts, error }) => {
              if (attemptsMade >= maxAttempts) {
                state.discarded += 1;
                console.error("[notifications] discarded event job after max attempts", {
                  jobId,
                  attempts: attemptsMade,
                  error,
                });
              } else {
                state.retried += 1;
                console.warn("[notifications] retrying event job", {
                  jobId,
                  attempts: attemptsMade,
                  error,
                });
              }
            },
          },
        );
      } catch (error) {
        state.running = false;
        console.error("[notifications] bullmq worker failed to start", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  } else {
    void adapter.initialize?.();
    state.timer = setInterval(() => {
      void tick();
    }, env.notificationWorkerPollMs);
  }

  console.log("[notifications] worker started", {
    adapter: env.notificationQueueAdapter,
    pollMs: env.notificationWorkerPollMs,
    concurrency: env.notificationWorkerConcurrency,
    maxAttempts: env.notificationWorkerMaxAttempts,
  });
}

export async function stopNotificationWorker() {
  state.running = false;

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  if (state.bullWorker) {
    await state.bullWorker.close();
    state.bullWorker = null;
  }

  const startedAt = Date.now();
  while (state.activeJobs > 0 && Date.now() - startedAt < env.notificationWorkerShutdownWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log("[notifications] worker stopped", {
    activeJobs: state.activeJobs,
  });

  const adapter = getNotificationQueueAdapter();
  await adapter.shutdown?.();
}

export async function getNotificationWorkerStats() {
  const adapter = getNotificationQueueAdapter();
  const queued = await adapter.size();

  return {
    adapter: env.notificationQueueAdapter,
    running: state.running,
    startedAt: state.startedAt,
    activeJobs: state.activeJobs,
    queued,
    processed: state.processed,
    failed: state.failed,
    retried: state.retried,
    discarded: state.discarded,
  };
}
