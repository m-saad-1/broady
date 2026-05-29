import { prisma } from "../../../config/prisma.js";
import type { ImportLogLevel, ImportJobStatus, ImportSourceType, ProductApprovalState } from "@prisma/client";
import type { NormalizedProduct } from "../ingestion.types.js";
import { stableHash } from "../utils/ingestion.utils.js";

export async function createImportJob(data: {
  brandId: string;
  sourceType: ImportSourceType;
  sourceLabel?: string;
  sourceLocation?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.importJob.create({
    data: {
      brandId: data.brandId,
      sourceType: data.sourceType,
      sourceLabel: data.sourceLabel,
      sourceLocation: data.sourceLocation,
      metadata: (data.metadata ?? null) as any,
      status: "PENDING",
    },
  });
}

export async function updateImportJobStatus(importJobId: string, status: ImportJobStatus) {
  return prisma.importJob.update({ where: { id: importJobId }, data: { status } });
}

export async function logImport(importJobId: string, level: ImportLogLevel, message: string, details?: unknown, productId?: string) {
  return prisma.importLog.create({
    data: {
      importJobId,
      level,
      message,
      details: details as any,
      productId,
    },
  });
}

function hasStructuredBlock(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((entry) => entry !== undefined && entry !== null && String(entry).trim() !== "");
}

async function syncStructuredBlocks(productId: string, importJobId: string, product: NormalizedProduct) {
  const operations: Array<Promise<unknown>> = [];

  if (hasStructuredBlock(product.detail)) {
    operations.push(
      prisma.productDetail.upsert({
        where: { productId },
        create: { productId, ...(product.detail as any) },
        update: product.detail as any,
      }),
    );
  }

  if (hasStructuredBlock(product.shipping)) {
    operations.push(
      prisma.productShipping.upsert({
        where: { productId },
        create: { productId, ...(product.shipping as any) },
        update: product.shipping as any,
      }),
    );
  }

  if (hasStructuredBlock(product.seo)) {
    operations.push(
      prisma.productSEO.upsert({
        where: { productId },
        create: { productId, ...(product.seo as any) },
        update: product.seo as any,
      }),
    );
  }

  operations.push(
    prisma.productImportMeta.upsert({
      where: { productId },
      create: {
        productId,
        importBatchId: importJobId,
        sourceFormat: product.externalSource,
        sourceBrandName: typeof product.metadata?.raw === "object" ? String((product.metadata.raw as any)?.vendor || "") || undefined : undefined,
        rawProductData: product.metadata?.raw as any,
        mappingStatus: "mapped",
        lastSyncedAt: new Date(),
      },
      update: {
        importBatchId: importJobId,
        sourceFormat: product.externalSource,
        rawProductData: product.metadata?.raw as any,
        mappingStatus: "mapped",
        lastSyncedAt: new Date(),
      },
    }),
  );

  await Promise.all(operations);
}

export async function upsertNormalizedProduct(brandId: string, importJobId: string, product: NormalizedProduct) {
  const hash = stableHash(product);

  const existing = await prisma.product.findFirst({
    where: {
      brandId,
      OR: [
        product.externalProductId ? { externalProductId: product.externalProductId } : undefined,
        { slug: product.slug },
      ].filter(Boolean) as any,
    },
    include: { variants: true },
  });

  const persisted = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: product.name,
          shortDescription: product.shortDescription,
          description: product.description,
          gender: product.gender,
          color: product.color,
          type: product.type,
          fit: product.fit,
          season: product.season,
          collection: product.collection,
          productUrl: product.productUrl,
          visibility: product.visibility || "hidden",
          source: product.source || "json_import",
          topCategory: product.topCategory,
          subCategory: product.subCategory,
          actualPrice: product.actualPrice,
          salePrice: product.salePrice,
          discountPercentage: product.discountPercentage,
          pricePkr: product.pricePkr,
          currency: product.currency || "PKR",
          label: product.label,
          sizes: product.sizes,
          tags: product.tags,
          imageUrl: product.imageUrl,
          sizeGuide: product.sizeGuide as any,
          deliveriesReturns: product.deliveriesReturns as any,
          shippingDelivery: product.shippingDelivery as any,
          fabricCare: product.fabricCare as any,
          stock: product.stock,
          externalProductId: product.externalProductId,
          externalSource: product.externalSource,
          importHash: hash,
          metadata: product.metadata as any,
          approvalStatus: "PENDING",
          isActive: false,
          deletedAt: null,
        },
      })
    : await prisma.product.create({
        data: {
          brandId,
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription,
          description: product.description,
          gender: product.gender,
          color: product.color,
          type: product.type,
          fit: product.fit,
          season: product.season,
          collection: product.collection,
          productUrl: product.productUrl,
          visibility: product.visibility || "hidden",
          source: product.source || "json_import",
          topCategory: product.topCategory,
          subCategory: product.subCategory,
          actualPrice: product.actualPrice,
          salePrice: product.salePrice,
          discountPercentage: product.discountPercentage,
          pricePkr: product.pricePkr,
          currency: product.currency || "PKR",
          label: product.label,
          sizes: product.sizes,
          tags: product.tags,
          imageUrl: product.imageUrl,
          sizeGuide: product.sizeGuide as any,
          deliveriesReturns: product.deliveriesReturns as any,
          shippingDelivery: product.shippingDelivery as any,
          fabricCare: product.fabricCare as any,
          stock: product.stock,
          externalProductId: product.externalProductId,
          externalSource: product.externalSource,
          importHash: hash,
          metadata: product.metadata as any,
          approvalStatus: "PENDING",
          isActive: false,
        },
      });

  await prisma.rawImportData.create({
    data: {
      importJobId,
      productId: persisted.id,
      externalId: product.externalProductId,
      payload: product as any,
      normalizedHash: hash,
    },
  });

  await syncStructuredBlocks(persisted.id, importJobId, product);

  await prisma.productApproval.create({
    data: {
      productId: persisted.id,
      importJobId,
      status: "PENDING",
    },
  });

  await prisma.productVariant.deleteMany({ where: { productId: persisted.id } });
  await prisma.productImage.deleteMany({ where: { productId: persisted.id } });
  await prisma.productAttribute.deleteMany({ where: { productId: persisted.id } });

  for (const variant of product.variants) {
    const createdVariant = await prisma.productVariant.create({
      data: {
        productId: persisted.id,
        externalVariantId: variant.externalVariantId,
        sku: variant.sku,
        barcode: variant.barcode,
        color: variant.color,
        colorHex: variant.colorHex,
        size: variant.size,
        fit: variant.fit,
        season: variant.season,
        style: variant.style,
        pricePkr: variant.pricePkr,
        salePricePkr: variant.salePricePkr,
        compareAtPricePkr: variant.compareAtPricePkr,
        stockStatus: variant.stockStatus,
        lowStockThreshold: variant.lowStockThreshold,
        weight: variant.weight,
      },
    });

    await prisma.inventory.upsert({
      where: { productId_sku: { productId: persisted.id, sku: variant.sku } },
      update: {
        quantity: variant.quantity ?? 0,
        available: variant.quantity ?? 0,
        syncState: "PENDING",
      },
      create: {
        productId: persisted.id,
        variantId: createdVariant.id,
        sku: variant.sku,
        quantity: variant.quantity ?? 0,
        available: variant.quantity ?? 0,
        syncState: "PENDING",
      },
    });
  }

  for (const image of product.images) {
    await prisma.productImage.create({
      data: {
        productId: persisted.id,
        sourceUrl: image.sourceUrl,
        url: image.url,
        cdnUrl: image.cdnUrl,
        altText: image.altText,
        imageType: image.imageType || (image.isPrimary ? "main" : "gallery"),
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
        dedupeHash: image.dedupeHash,
      },
    });
  }

  for (const attribute of product.attributes) {
    await prisma.productAttribute.create({
      data: {
        productId: persisted.id,
        key: attribute.key,
        value: attribute.value,
      },
    });
  }

  return persisted;
}

export async function setApprovalState(productId: string, reviewerId: string, status: ProductApprovalState, rejectionReason?: string) {
  await prisma.productApproval.create({
    data: {
      productId,
      reviewerId,
      status,
      rejectionReason,
      reviewedAt: new Date(),
    },
  });

  return prisma.product.update({
    where: { id: productId },
    data: {
      approvalStatus: status === "APPROVED" ? "APPROVED" : "REJECTED",
      isActive: status === "APPROVED",
      approvalReviewedById: reviewerId,
      approvalReviewedAt: new Date(),
    },
  });
}
