import {
  deadLetterQueue,
  imageProcessingQueue,
  ingestionNotificationQueue,
  productImportQueue,
  productValidationQueue,
  searchIndexingQueue,
  inventorySyncQueue,
} from "./ingestion.queues.js";

const queueRegistry = {
  productImport: productImportQueue,
  imageProcessing: imageProcessingQueue,
  productValidation: productValidationQueue,
  searchIndexing: searchIndexingQueue,
  inventorySync: inventorySyncQueue,
  notifications: ingestionNotificationQueue,
  deadLetter: deadLetterQueue,
} as const;

export type IngestionQueueName = keyof typeof queueRegistry;

export async function getIngestionQueueMetrics() {
  const entries = await Promise.all(
    Object.entries(queueRegistry).map(async ([name, queue]) => {
      let counts: Record<string, number>;
      try {
        counts = await queue.getJobCounts("wait", "active", "completed", "failed", "delayed", "paused");
      } catch {
        counts = { wait: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
      }
      return [name, counts] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<IngestionQueueName, Record<string, number>>;
}
