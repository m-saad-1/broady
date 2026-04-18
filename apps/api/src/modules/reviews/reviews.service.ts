import { Prisma, PrismaClient, ReviewStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

function getDbClient(client?: DbClient) {
  return client ?? prisma;
}

export async function recomputeProductReviewAggregate(productId: string, client?: DbClient) {
  const db = getDbClient(client);

  const stats = await db.review.groupBy({
    by: ["rating"],
    where: {
      productId,
      status: ReviewStatus.VISIBLE,
    },
    _count: {
      _all: true,
    },
  });

  let totalReviews = 0;
  let weighted = 0;

  const counts = {
    rating1: 0,
    rating2: 0,
    rating3: 0,
    rating4: 0,
    rating5: 0,
  };

  for (const row of stats) {
    const count = row._count._all;
    totalReviews += count;
    weighted += row.rating * count;

    if (row.rating === 1) counts.rating1 = count;
    if (row.rating === 2) counts.rating2 = count;
    if (row.rating === 3) counts.rating3 = count;
    if (row.rating === 4) counts.rating4 = count;
    if (row.rating === 5) counts.rating5 = count;
  }

  const averageRating = totalReviews > 0 ? Number((weighted / totalReviews).toFixed(2)) : 0;

  await db.productReviewAggregate.upsert({
    where: { productId },
    create: {
      productId,
      averageRating,
      totalReviews,
      ...counts,
    },
    update: {
      averageRating,
      totalReviews,
      ...counts,
    },
  });
}

export async function getBrandAccessForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, brandId: true },
  });

  if (!user) {
    return null;
  }

  if (user.brandId) {
    return {
      brandId: user.brandId,
      role: user.role,
      canReply: true,
    };
  }

  const membership = await prisma.brandMember.findFirst({
    where: { userId },
    select: { brandId: true, canManageProducts: true },
  });

  if (!membership) {
    return null;
  }

  return {
    brandId: membership.brandId,
    role: user.role,
    canReply: membership.canManageProducts,
  };
}
