import { Queue, type JobsOptions } from "bullmq";
import { env } from "../../../config/env.js";
import { parseRedisConnectionOptions } from "../../../config/redis.js";

export const ingestionQueueNames = {
  productImport: "product-import",
  imageProcessing: "image-processing",
  productValidation: "product-validation",
  searchIndexing: "search-indexing",
  inventorySync: "inventory-sync",
  notifications: "notifications",
  deadLetter: "ingestion-dead-letter",
} as const;

const defaultJobOptions: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 2000,
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
};

function createQueue(name: string) {
  const queue = new Queue(name, {
    connection: parseRedisConnectionOptions(env.redisUrl),
    defaultJobOptions,
  });
  queue.on("error", () => {
    // Import routes fall back to inline processing when Redis is unavailable.
  });
  return queue;
}

export const productImportQueue = createQueue(ingestionQueueNames.productImport);
export const imageProcessingQueue = createQueue(ingestionQueueNames.imageProcessing);
export const productValidationQueue = createQueue(ingestionQueueNames.productValidation);
export const searchIndexingQueue = createQueue(ingestionQueueNames.searchIndexing);
export const inventorySyncQueue = createQueue(ingestionQueueNames.inventorySync);
export const ingestionNotificationQueue = createQueue(ingestionQueueNames.notifications);
export const deadLetterQueue = createQueue(ingestionQueueNames.deadLetter);
