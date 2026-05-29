import { Worker } from "bullmq";
import { parseRedisConnectionOptions } from "../../../config/redis.js";
import { env } from "../../../config/env.js";
import {
  deadLetterQueue,
  imageProcessingQueue,
  ingestionQueueNames,
  inventorySyncQueue,
  searchIndexingQueue,
} from "../queues/ingestion.queues.js";
import { processImportJob } from "../services/ingestion.service.js";
import { prisma } from "../../../config/prisma.js";

async function processImport(job: any) {
  const payload = job.data?.payload;
  if (!payload) throw new Error("Missing job payload");

  const hydratedPayload = {
    ...payload,
    fileBuffer: payload.fileBuffer ? Buffer.from(payload.fileBuffer, "base64") : undefined,
  };

  await processImportJob(String(job.data.importJobId), hydratedPayload);
}

async function processImageJob(job: any) {
  const productId = String(job.data.productId);
  await prisma.importLog.create({
    data: {
      importJobId: String(job.data.importJobId),
      productId,
      level: "INFO",
      message: "Image processing queued. Optimize/compress/resize/upload hook ready.",
    },
  });
}

async function processSearchIndexJob(job: any) {
  const productId = String(job.data.productId);
  await prisma.product.update({ where: { id: productId }, data: { searchDocument: `indexed:${new Date().toISOString()}` } });
}

async function processInventoryJob(job: any) {
  const productId = String(job.data.productId);
  await prisma.inventory.updateMany({ where: { productId }, data: { syncState: "IDLE", lastSyncedAt: new Date() } });
}

function onFailure(queueName: string) {
  return async (job: any, error: Error) => {
    await deadLetterQueue.add("dead-letter", {
      sourceQueue: queueName,
      jobId: job?.id,
      data: job?.data,
      error: error.message,
    });
  };
}

export function startIngestionWorkers() {
  const connection = parseRedisConnectionOptions(env.redisUrl);

  const importWorker = new Worker(ingestionQueueNames.productImport, processImport, { connection, concurrency: 4 });
  const imageWorker = new Worker(ingestionQueueNames.imageProcessing, processImageJob, { connection, concurrency: 8 });
  const searchWorker = new Worker(ingestionQueueNames.searchIndexing, processSearchIndexJob, { connection, concurrency: 6 });
  const inventoryWorker = new Worker(ingestionQueueNames.inventorySync, processInventoryJob, { connection, concurrency: 6 });

  importWorker.on("failed", onFailure(ingestionQueueNames.productImport));
  imageWorker.on("failed", onFailure(ingestionQueueNames.imageProcessing));
  searchWorker.on("failed", onFailure(ingestionQueueNames.searchIndexing));
  inventoryWorker.on("failed", onFailure(ingestionQueueNames.inventorySync));

  return { importWorker, imageWorker, searchWorker, inventoryWorker };
}

if (process.argv.includes("--run")) {
  startIngestionWorkers();
}
