import type { ImportJob } from "@prisma/client";
import { parseImportPayload } from "../parsers/ingestion.parser.js";
import { normalizeRecord } from "./normalization.service.js";
import { validateNormalizedProduct } from "../validators/ingestion.validator.js";
import type { ImportInputPayload } from "../ingestion.types.js";
import {
  createImportJob,
  logImport,
  setApprovalState,
  updateImportJobStatus,
  upsertNormalizedProduct,
} from "../repositories/ingestion.repository.js";
import { productImportQueue, searchIndexingQueue, imageProcessingQueue, inventorySyncQueue } from "../queues/ingestion.queues.js";
import { prisma } from "../../../config/prisma.js";
import { getRedisHealthMetrics } from "../../../config/redis.js";

async function hasActiveImportWorker() {
  try {
    const workers = await productImportQueue.getWorkers();
    return workers.length > 0;
  } catch {
    return false;
  }
}

export async function enqueueImport(payload: ImportInputPayload) {
  const redisHealth = await getRedisHealthMetrics();
  const serializedFileBuffer = payload.fileBuffer?.toString("base64");
  const job = await createImportJob({
    brandId: payload.brandId,
    sourceType: payload.sourceType,
    sourceLabel: payload.sourceLabel,
    sourceLocation: payload.sourceLocation,
    metadata: {
      retryPayload: {
        ...payload,
        fileBuffer: serializedFileBuffer,
      },
    },
  });

  if (!redisHealth.ok) {
    await logImport(job.id, "WARN", "Queue backend unavailable. Running inline ingestion fallback.", {
      status: redisHealth.status,
      error: redisHealth.error,
    });
    void processImportJob(job.id, payload).catch(async (error) => {
      await logImport(job.id, "ERROR", "Inline ingestion fallback failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
    });
    return job;
  }

  const hasWorker = await hasActiveImportWorker();
  if (hasWorker) {
    try {
      await productImportQueue.add("import-products", {
        importJobId: job.id,
        payload: {
          ...payload,
          fileBuffer: serializedFileBuffer,
        },
      });
    } catch {
      await logImport(job.id, "WARN", "Queue dispatch failed. Running inline ingestion fallback.");
      void processImportJob(job.id, payload).catch(async (error) => {
        await logImport(job.id, "ERROR", "Inline ingestion fallback failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        await prisma.importJob.update({
          where: { id: job.id },
          data: { status: "FAILED", completedAt: new Date() },
        });
      });
    }
  } else {
    // Fallback for environments where API is running but ingestion worker was not started.
    await logImport(job.id, "WARN", "No active import worker detected. Running inline ingestion fallback.");
    void processImportJob(job.id, payload).catch(async (error) => {
      await logImport(job.id, "ERROR", "Inline ingestion fallback failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
    });
  }

  return job;
}

export async function processImportJob(importJobId: string, payload: ImportInputPayload): Promise<ImportJob> {
  await updateImportJobStatus(importJobId, "PROCESSING");
  const startedAt = new Date();
  await prisma.importJob.update({ where: { id: importJobId }, data: { startedAt } });

  if (
    payload.sourceType === "REST_API" &&
    payload.sourceLocation &&
    payload.rawJson === undefined &&
    payload.rawText === undefined &&
    payload.fileBuffer === undefined
  ) {
    try {
      const response = await fetch(payload.sourceLocation);
      if (!response.ok) {
        throw new Error(`Source API request failed with status ${response.status}`);
      }
      payload.rawJson = await response.json();
    } catch (error) {
      await logImport(importJobId, "ERROR", "Failed to fetch REST API source", {
        sourceLocation: payload.sourceLocation,
        error: error instanceof Error ? error.message : String(error),
      });
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          processedRecords: 0,
          successfulRecords: 0,
          failedRecords: 1,
          status: "FAILED",
          completedAt: new Date(),
        },
      });
      return prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    }
  }

  const parsed = parseImportPayload(payload);
  let successfulRecords = 0;
  let failedRecords = 0;

  await prisma.importJob.update({ where: { id: importJobId }, data: { totalRecords: parsed.length } });

  if (!parsed.length) {
    failedRecords = 1;
    await logImport(importJobId, "ERROR", "No import records detected from source payload");
  }

  for (const record of parsed) {
    try {
      const normalized = normalizeRecord(record);
      const issues = validateNormalizedProduct(normalized);
      const errors = issues.filter((issue) => issue.level === "ERROR");

      if (errors.length) {
        failedRecords += 1;
        await logImport(importJobId, "ERROR", "Validation failed for product", { issues, externalId: record.externalId });
        continue;
      }

      const product = await upsertNormalizedProduct(payload.brandId, importJobId, normalized);
      await enqueuePostImportJobs(product.id, importJobId);

      successfulRecords += 1;

      if (issues.length) {
        await logImport(importJobId, "WARN", "Product ingested with warnings", { issues }, product.id);
      }
    } catch (error) {
      failedRecords += 1;
      await logImport(importJobId, "ERROR", "Unexpected ingestion failure for record", {
        externalId: record.externalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const status = failedRecords === 0 ? "SUCCESS" : successfulRecords === 0 ? "FAILED" : "PARTIAL_SUCCESS";

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      processedRecords: parsed.length,
      successfulRecords,
      failedRecords,
      status,
      completedAt: new Date(),
    },
  });

  return prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
}

export async function retryImport(importJobId: string) {
  const redisHealth = await getRedisHealthMetrics();
  const importJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!importJob) throw new Error("Import job not found");

  const metadata = (importJob.metadata as { retryPayload?: Record<string, unknown> } | null) ?? null;
  const retryPayload = metadata?.retryPayload;
  if (!retryPayload) {
    throw new Error("Retry payload not available for this job");
  }

  const inlinePayload = {
    ...(retryPayload as ImportInputPayload),
    fileBuffer:
      typeof retryPayload.fileBuffer === "string"
        ? Buffer.from(retryPayload.fileBuffer, "base64")
        : undefined,
  } as ImportInputPayload;

  if (!redisHealth.ok) {
    await logImport(importJobId, "WARN", "Queue backend unavailable. Running inline retry fallback.", {
      status: redisHealth.status,
      error: redisHealth.error,
    });
    await processImportJob(importJobId, inlinePayload);
    return prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
  }

  try {
    await productImportQueue.add(
      "retry-import",
      {
        importJobId,
        payload: {
          ...retryPayload,
          fileBuffer:
            typeof retryPayload.fileBuffer === "string"
              ? Buffer.from(retryPayload.fileBuffer, "base64").toString("base64")
              : undefined,
        },
      },
      { attempts: 3 },
    );
    return updateImportJobStatus(importJobId, "PENDING");
  } catch {
    await logImport(importJobId, "WARN", "Retry queue dispatch failed. Running inline retry fallback.");
    await processImportJob(importJobId, inlinePayload);
    return prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
  }
}

async function enqueuePostImportJobs(productId: string, importJobId: string) {
  const postImportJobs = [
    imageProcessingQueue.add("process-product-images", { productId, importJobId }),
    searchIndexingQueue.add("sync-product-search", { productId, importJobId }),
    inventorySyncQueue.add("sync-product-inventory", { productId, importJobId }),
  ];

  const results = await Promise.allSettled(postImportJobs);
  const failed = results
    .map((result, index) => ({ result, queue: ["imageProcessing", "searchIndexing", "inventorySync"][index] }))
    .filter((entry) => entry.result.status === "rejected");

  if (failed.length) {
    await logImport(importJobId, "WARN", "Some post-import queue tasks could not be scheduled.", {
      productId,
      failedQueues: failed.map((entry) => entry.queue),
      errors: failed.map((entry) =>
        entry.result.status === "rejected" && entry.result.reason instanceof Error
          ? entry.result.reason.message
          : String(entry.result.status === "rejected" ? entry.result.reason : ""),
      ),
    }, productId);
  }
}

export async function approveProduct(productId: string, reviewerId: string) {
  return setApprovalState(productId, reviewerId, "APPROVED");
}

export async function rejectProduct(productId: string, reviewerId: string, reason: string) {
  return setApprovalState(productId, reviewerId, "REJECTED", reason);
}
