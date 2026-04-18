import { NotificationType, Prisma, ReviewModerationAction, ReviewReportReason, ReviewReportStatus, ReviewStatus, Role } from "@prisma/client";
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { createNotificationWithChannels } from "../notifications/notification.service.js";
import { productImageUrlSchema } from "../products/product.validation.js";
import { getBrandAccessForUser, recomputeProductReviewAggregate } from "./reviews.service.js";

const router = Router();

const createReviewSchema = z.object({
  orderItemId: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(10).max(2000),
  imageUrls: z.array(productImageUrlSchema).max(6).optional(),
});

const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    content: z.string().trim().min(10).max(2000).optional(),
    imageUrls: z.array(productImageUrlSchema).max(6).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const listProductReviewsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  skip: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["newest", "rating", "helpful"]).default("newest"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

const reportReviewSchema = z.object({
  reason: z.nativeEnum(ReviewReportReason),
  description: z.string().trim().min(4).max(800).optional(),
});

const voteSchema = z.object({
  isHelpful: z.boolean(),
});

const replySchema = z.object({
  content: z.string().trim().min(4).max(1200),
});

const moderationSchema = z.object({
  action: z.nativeEnum(ReviewModerationAction),
  reason: z.string().trim().min(3).max(500).optional(),
});

const resolveReportSchema = z.object({
  status: z.nativeEnum(ReviewReportStatus),
  resolutionNote: z.string().trim().min(3).max(500).optional(),
});

const reviewUploadsDir = path.resolve(process.cwd(), "uploads", "reviews");
fs.mkdirSync(reviewUploadsDir, { recursive: true });

const reviewImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, reviewUploadsDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext && /^[.]([a-z0-9]{2,5})$/.test(ext) ? ext : ".jpg";
      callback(null, `review-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  }),
  limits: {
    files: 6,
    fileSize: 4 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are allowed"));
      return;
    }
    callback(null, true);
  },
});

router.get("/product/:productId", async (req, res) => {
  const query = listProductReviewsSchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: "Invalid query", issues: query.error.flatten() });
  }

  const where: Prisma.ReviewWhereInput = {
    productId: String(req.params.productId),
    status: ReviewStatus.VISIBLE,
    ...(query.data.rating ? { rating: query.data.rating } : {}),
  };

  let orderBy: Prisma.ReviewOrderByWithRelationInput = { createdAt: "desc" };
  if (query.data.sort === "rating") {
    orderBy = { rating: "desc" };
  }

  const reviews = await prisma.review.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true } },
      product: { select: { id: true, name: true, slug: true, imageUrl: true } },
      images: { orderBy: { sortOrder: "asc" } },
      orderItem: {
        select: {
          id: true,
          selectedColor: true,
          selectedSize: true,
        },
      },
      brandReply: {
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
      _count: {
        select: {
          helpfulnessVotes: { where: { isHelpful: true } },
          reports: true,
        },
      },
    },
    orderBy,
    skip: query.data.skip,
    take: query.data.limit,
  });

  const total = await prisma.review.count({ where });

  const aggregate = await prisma.productReviewAggregate.findUnique({
    where: { productId: String(req.params.productId) },
  });

  if (query.data.sort === "helpful") {
    reviews.sort((a, b) => b._count.helpfulnessVotes - a._count.helpfulnessVotes);
  }

  return res.json({
    data: {
      total,
      limit: query.data.limit,
      skip: query.data.skip,
      items: reviews,
      aggregate: aggregate || {
        averageRating: 0,
        totalReviews: 0,
        rating1: 0,
        rating2: 0,
        rating3: 0,
        rating4: 0,
        rating5: 0,
      },
    },
  });
});

router.use(requireAuth);

router.post("/uploads", reviewImageUpload.array("images", 6), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (!files.length) {
    return res.status(400).json({ message: "No image files uploaded" });
  }

  const baseUrl = `${req.protocol}://${req.get("host") || "localhost:4000"}`;
  const urls = files.map((file) => `${baseUrl}/uploads/reviews/${file.filename}`);
  return res.status(201).json({ data: { urls } });
});

router.get("/me", async (req, res) => {
  const limit = Number(req.query.limit || 20);
  const skip = Number(req.query.skip || 0);

  const items = await prisma.review.findMany({
    where: { userId: req.auth!.userId },
    include: {
      product: { select: { id: true, name: true, slug: true, imageUrl: true } },
      images: { orderBy: { sortOrder: "asc" } },
      brandReply: {
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
      orderItem: {
        include: {
          order: { select: { id: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20,
    skip: Number.isFinite(skip) ? Math.max(skip, 0) : 0,
  });

  return res.json({ data: items });
});

router.post("/", async (req, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: parsed.data.orderItemId },
    include: {
      order: {
        select: {
          id: true,
          userId: true,
          status: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          approvalStatus: true,
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          whatsappNumber: true,
        },
      },
    },
  });

  if (!orderItem) {
    return res.status(404).json({ message: "Order item not found" });
  }

  if (orderItem.order.userId !== req.auth!.userId) {
    return res.status(403).json({ message: "You can only review your own purchases" });
  }

  if (orderItem.order.status !== "DELIVERED") {
    return res.status(409).json({ message: "You can review only delivered orders" });
  }

  if (!orderItem.product.isActive || orderItem.product.approvalStatus !== "APPROVED") {
    return res.status(409).json({ message: "Product is not available for reviews" });
  }

  const existing = await prisma.review.findUnique({
    where: { orderItemId: orderItem.id },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ message: "A review already exists for this order item" });
  }

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        productId: orderItem.product.id,
        brandId: orderItem.brand.id,
        orderItemId: orderItem.id,
        userId: req.auth!.userId,
        rating: parsed.data.rating,
        content: parsed.data.content,
        status: ReviewStatus.VISIBLE,
        images: parsed.data.imageUrls
          ? {
              create: parsed.data.imageUrls.map((url, index) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    await recomputeProductReviewAggregate(orderItem.product.id, tx);

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.PRODUCT_REVIEW_SUBMITTED,
      title: "Review submitted",
      message: `Thanks for reviewing ${orderItem.product.name} on Broady.`,
      userId: req.auth!.userId,
      orderId: orderItem.order.id,
      emailRecipient: created.user.email,
      emailSubject: `Review received for ${orderItem.product.name}`,
      emailText: `Thanks for sharing your feedback on ${orderItem.product.name}.`,
    });

    const members = await tx.brandMember.findMany({
      where: { brandId: orderItem.brand.id },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    for (const member of members) {
      await createNotificationWithChannels({
        prismaClient: tx,
        type: NotificationType.PRODUCT_REVIEW_SUBMITTED,
        title: "New product review",
        message: `A customer reviewed ${orderItem.product.name} on Broady.`,
        userId: member.user.id,
        brandId: orderItem.brand.id,
        orderId: orderItem.order.id,
        emailRecipient: member.user.email || orderItem.brand.contactEmail,
      });
    }

    const admins = await tx.user.findMany({
      where: {
        role: {
          in: [Role.ADMIN, Role.SUPER_ADMIN],
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    for (const admin of admins) {
      await createNotificationWithChannels({
        prismaClient: tx,
        type: NotificationType.PRODUCT_REVIEW_SUBMITTED,
        title: "Review tracking event",
        message: `New review submitted for ${orderItem.product.name}.`,
        userId: admin.id,
        brandId: orderItem.brand.id,
        orderId: orderItem.order.id,
        emailRecipient: admin.email,
      });
    }

    return created;
  });

  return res.status(201).json({ data: review });
});

router.patch("/item/:reviewId", async (req, res) => {
  const parsed = updateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const review = await prisma.review.findUnique({
    where: { id: String(req.params.reviewId) },
    include: {
      orderItem: {
        include: {
          order: {
            select: { userId: true, status: true },
          },
        },
      },
    },
  });

  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (review.userId !== req.auth!.userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (review.status === ReviewStatus.REMOVED) {
    return res.status(409).json({ message: "Removed reviews cannot be edited" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReview = await tx.review.update({
      where: { id: review.id },
      data: {
        rating: parsed.data.rating,
        content: parsed.data.content,
      },
      include: {
        user: { select: { id: true, fullName: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (parsed.data.imageUrls) {
      await tx.reviewImage.deleteMany({ where: { reviewId: review.id } });
      if (parsed.data.imageUrls.length > 0) {
        await tx.reviewImage.createMany({
          data: parsed.data.imageUrls.map((url, index) => ({
            reviewId: review.id,
            url,
            sortOrder: index,
          })),
        });
      }
    }

    await recomputeProductReviewAggregate(review.productId, tx);

    return updatedReview;
  });

  return res.json({ data: updated });
});

router.delete("/item/:reviewId", async (req, res) => {
  const review = await prisma.review.findUnique({
    where: { id: String(req.params.reviewId) },
    select: { id: true, userId: true, productId: true, status: true },
  });

  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (review.userId !== req.auth!.userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (review.status === ReviewStatus.REMOVED) {
    return res.status(204).send();
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: {
        status: ReviewStatus.REMOVED,
      },
    });

    await recomputeProductReviewAggregate(review.productId, tx);
  });

  return res.status(204).send();
});

router.post("/item/:reviewId/helpfulness", async (req, res) => {
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const review = await prisma.review.findUnique({
    where: { id: String(req.params.reviewId) },
    select: { id: true, status: true, userId: true },
  });

  if (!review || review.status !== ReviewStatus.VISIBLE) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (review.userId === req.auth!.userId) {
    return res.status(409).json({ message: "You cannot vote on your own review" });
  }

  const vote = await prisma.reviewHelpfulnessVote.upsert({
    where: {
      reviewId_userId: {
        reviewId: review.id,
        userId: req.auth!.userId,
      },
    },
    create: {
      reviewId: review.id,
      userId: req.auth!.userId,
      isHelpful: parsed.data.isHelpful,
    },
    update: {
      isHelpful: parsed.data.isHelpful,
    },
  });

  return res.json({ data: vote });
});

router.post("/item/:reviewId/report", async (req, res) => {
  const parsed = reportReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const review = await prisma.review.findUnique({
    where: { id: String(req.params.reviewId) },
    include: {
      product: { select: { name: true } },
    },
  });

  if (!review || review.status === ReviewStatus.REMOVED) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (review.userId === req.auth!.userId) {
    return res.status(409).json({ message: "You cannot report your own review" });
  }

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.reviewReport.create({
      data: {
        reviewId: review.id,
        reportedByUserId: req.auth!.userId,
        reason: parsed.data.reason,
        description: parsed.data.description,
      },
    });

    await tx.review.update({
      where: { id: review.id },
      data: {
        status: review.status === ReviewStatus.VISIBLE ? ReviewStatus.FLAGGED : review.status,
      },
    });

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.PRODUCT_REVIEW_REPORTED,
      title: "Review reported",
      message: `A review for ${review.product.name} was reported and needs moderation.`,
      userId: req.auth!.userId,
    });

    const admins = await tx.user.findMany({
      where: {
        role: {
          in: [Role.ADMIN, Role.SUPER_ADMIN],
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    for (const admin of admins) {
      await createNotificationWithChannels({
        prismaClient: tx,
        type: NotificationType.PRODUCT_REVIEW_REPORTED,
        title: "Review report requires moderation",
        message: `A review for ${review.product.name} was reported by a customer.`,
        userId: admin.id,
        emailRecipient: admin.email,
      });
    }

    return created;
  });

  return res.status(201).json({ data: report });
});

router.get("/brand", async (req, res) => {
  const access = await getBrandAccessForUser(req.auth!.userId);
  if (!access) {
    return res.status(403).json({ message: "Brand access required" });
  }

  const limit = Number(req.query.limit || 20);
  const skip = Number(req.query.skip || 0);

  const reviews = await prisma.review.findMany({
    where: {
      brandId: access.brandId,
      status: {
        in: [ReviewStatus.VISIBLE, ReviewStatus.HIDDEN, ReviewStatus.FLAGGED],
      },
    },
    include: {
      user: { select: { id: true, fullName: true } },
      product: { select: { id: true, name: true, slug: true, imageUrl: true } },
      images: { orderBy: { sortOrder: "asc" } },
      brandReply: {
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
      reports: {
        where: { status: ReviewReportStatus.OPEN },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20,
    skip: Number.isFinite(skip) ? Math.max(skip, 0) : 0,
  });

  return res.json({ data: reviews });
});

router.post("/item/:reviewId/reply", async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const access = await getBrandAccessForUser(req.auth!.userId);
  if (!access || !access.canReply) {
    return res.status(403).json({ message: "Brand permissions required" });
  }

  const review = await prisma.review.findUnique({
    where: { id: String(req.params.reviewId) },
    include: {
      product: { select: { name: true } },
      user: { select: { id: true, email: true } },
    },
  });

  if (!review || review.status === ReviewStatus.REMOVED) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (review.brandId !== access.brandId) {
    return res.status(403).json({ message: "You can reply only to your brand reviews" });
  }

  const reply = await prisma.$transaction(async (tx) => {
    const upserted = await tx.brandReviewReply.upsert({
      where: { reviewId: review.id },
      create: {
        reviewId: review.id,
        brandId: access.brandId,
        userId: req.auth!.userId,
        content: parsed.data.content,
      },
      update: {
        userId: req.auth!.userId,
        content: parsed.data.content,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.PRODUCT_REVIEW_REPLIED,
      title: "Brand replied to your review",
      message: `A brand replied to your review for ${review.product.name}.`,
      userId: review.user.id,
      emailRecipient: review.user.email,
    });

    return upserted;
  });

  return res.status(201).json({ data: reply });
});

router.get("/admin/reports", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "OPEN") as ReviewReportStatus;
  const limit = Number(req.query.limit || 20);
  const skip = Number(req.query.skip || 0);

  const reports = await prisma.reviewReport.findMany({
    where: {
      status: Object.values(ReviewReportStatus).includes(status) ? status : ReviewReportStatus.OPEN,
    },
    include: {
      review: {
        include: {
          product: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, fullName: true } },
        },
      },
      reportedByUser: { select: { id: true, fullName: true, email: true } },
      resolvedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
    skip: Number.isFinite(skip) ? Math.max(skip, 0) : 0,
  });

  return res.json({ data: reports });
});

router.patch("/admin/reports/:reportId", requireAdmin, async (req, res) => {
  const parsed = resolveReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const report = await prisma.reviewReport.findUnique({
    where: { id: String(req.params.reportId) },
    include: {
      review: {
        select: {
          id: true,
          productId: true,
          status: true,
        },
      },
    },
  });

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReport = await tx.reviewReport.update({
      where: { id: report.id },
      data: {
        status: parsed.data.status,
        resolutionNote: parsed.data.resolutionNote,
        resolvedById: req.auth!.userId,
        resolvedAt: new Date(),
      },
      include: {
        resolvedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (parsed.data.status === ReviewReportStatus.RESOLVED && report.review.status === ReviewStatus.FLAGGED) {
      await tx.review.update({
        where: { id: report.review.id },
        data: {
          status: ReviewStatus.HIDDEN,
          moderatedById: req.auth!.userId,
          moderatedAt: new Date(),
          moderationReason: parsed.data.resolutionNote || "Hidden after report resolution",
        },
      });
      await recomputeProductReviewAggregate(report.review.productId, tx);
    }

    return updatedReport;
  });

  return res.json({ data: updated });
});

router.patch("/admin/:reviewId/moderate", requireAdmin, async (req, res) => {
  const parsed = moderationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const review = await prisma.review.findUnique({
    where: { id: String(req.params.reviewId) },
    include: {
      user: { select: { id: true, email: true } },
      product: { select: { name: true } },
    },
  });

  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }

  const statusByAction: Record<ReviewModerationAction, ReviewStatus> = {
    HIDE: ReviewStatus.HIDDEN,
    UNHIDE: ReviewStatus.VISIBLE,
    FLAG: ReviewStatus.FLAGGED,
    REMOVE: ReviewStatus.REMOVED,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReview = await tx.review.update({
      where: { id: review.id },
      data: {
        status: statusByAction[parsed.data.action],
        moderatedById: req.auth!.userId,
        moderatedAt: new Date(),
        moderationReason: parsed.data.reason,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    await tx.reviewModerationLog.create({
      data: {
        reviewId: review.id,
        action: parsed.data.action,
        moderatorId: req.auth!.userId,
        reason: parsed.data.reason,
      },
    });

    await recomputeProductReviewAggregate(review.productId, tx);

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.PRODUCT_REVIEW_MODERATED,
      title: "Your review was moderated",
      message: `Your review for ${review.product.name} is now ${statusByAction[parsed.data.action].toLowerCase()}.`,
      userId: review.user.id,
      emailRecipient: review.user.email,
    });

    return updatedReview;
  });

  return res.json({ data: updated });
});

export default router;
