import { PrismaClient } from "@prisma/client";
import { productBaseSchema } from "./product.validation.js";
import { z } from "zod";

const prisma = new PrismaClient();

type ProductCreateData = z.infer<typeof productBaseSchema>;

export async function createProduct(data: ProductCreateData, brandId: string) {
  const validation = productBaseSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Invalid product data: ${validation.error.message}`);
  }

  let { salePrice, discountPercentage, actualPrice } = validation.data;

  if (discountPercentage !== undefined && discountPercentage > 0) {
    salePrice = actualPrice - (actualPrice * discountPercentage) / 100;
  }

  const productData = {
    ...validation.data,
    brandId,
    actualPrice,
    salePrice,
    discountPercentage,
    pricePkr: salePrice ?? actualPrice,
  };

  return prisma.product.create({
    data: productData,
  });
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { brand: true },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: { brand: true },
  });
}

export async function updateProduct(id: string, data: Partial<ProductCreateData>) {
    const validation = productBaseSchema.partial().safeParse(data);
    if (!validation.success) {
        throw new Error(`Invalid product data: ${validation.error.message}`);
    }

    let { salePrice, discountPercentage, actualPrice } = validation.data;
    
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
        throw new Error("Product not found");
    }
    
    const currentActualPrice = actualPrice ?? existingProduct.actualPrice;

    if (discountPercentage !== undefined && discountPercentage > 0) {
        salePrice = currentActualPrice - (currentActualPrice * discountPercentage) / 100;
    } else if (salePrice === undefined) {
      salePrice = existingProduct.salePrice ?? undefined;
    }

    const productData = {
        ...validation.data,
        actualPrice: currentActualPrice,
        salePrice,
        discountPercentage,
        pricePkr: salePrice ?? currentActualPrice,
    };

    return prisma.product.update({
        where: { id },
        data: productData,
    });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({
    where: { id },
  });
}

export async function listProducts(options: Record<string, any>) {
  const {
    brandId,
    topCategory,
    juniorCategory,
    productType,
    subCategory,
    size,
    sort = "latest",
    query,
    page = 1,
    limit = 100,
  } = options;

  const where: any = {};
  const andConditions: any[] = [];

  // Handle brand filter
  if (brandId) {
    where.brandId = brandId;
  }

  // Handle top category filter (case-insensitive). Build AND conditions to avoid
  // clobbering the search OR later.
  if (topCategory) {
    if (topCategory === "Juniors" && juniorCategory) {
      andConditions.push({ topCategory: { equals: juniorCategory, mode: "insensitive" } });
    } else if (topCategory === "Juniors") {
      andConditions.push({
        OR: [
          { topCategory: { equals: "Toddler Boys", mode: "insensitive" } },
          { topCategory: { equals: "Toddler Girls", mode: "insensitive" } },
          { topCategory: { equals: "Junior Boys", mode: "insensitive" } },
          { topCategory: { equals: "Junior Girls", mode: "insensitive" } },
        ],
      });
    } else {
      andConditions.push({ topCategory: { equals: topCategory, mode: "insensitive" } });
    }
  }

  // Handle product type filter
  if (productType) {
    andConditions.push({ type: { equals: productType, mode: "insensitive" } });
  }

  // Handle subcategory filter
  if (subCategory) {
    andConditions.push({ subCategory: { equals: subCategory, mode: "insensitive" } });
  }

  // Handle size filter - check if size is in the sizes array
  if (size) {
    // Prisma's `has` is exact-match. Assume sizes are stored with consistent casing.
    andConditions.push({ sizes: { has: size } });
  }

  // Handle search query. This is an OR block that must be combined with other AND filters.
  const orConditions: any[] = [];
  if (query && query.trim()) {
    orConditions.push({ name: { contains: query, mode: "insensitive" } });
    orConditions.push({ description: { contains: query, mode: "insensitive" } });
  }

  // Determine sort order
  const orderBy: any = {};
  if (sort === "latest") {
    orderBy.createdAt = "desc";
  } else if (sort === "oldest") {
    orderBy.createdAt = "asc";
  } else if (sort === "price-low") {
    orderBy.pricePkr = "asc";
  } else if (sort === "price-high") {
    orderBy.pricePkr = "desc";
  } else if (sort === "name-asc") {
    orderBy.name = "asc";
  } else if (sort === "name-desc") {
    orderBy.name = "desc";
  }

  // Compose final where clause from AND / OR pieces
  if (andConditions.length) where.AND = andConditions;
  if (orConditions.length) {
    // Combine search OR as an AND element so it is applied together with other filters
    where.AND = where.AND || [];
    where.AND.push({ OR: orConditions });
  }

  const skipValue = (Number(page) - 1) * Number(limit);
  const takeValue = Number(limit);

  return prisma.product.findMany({
    where,
    include: {
      brand: true,
    },
    orderBy: Object.keys(orderBy).length > 0 ? orderBy : undefined,
    skip: skipValue,
    take: takeValue,
  });
}
