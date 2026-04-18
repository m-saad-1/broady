import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { createBrandInviteAccount } from "../auth/auth.service.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";

const router = Router();

const brandCreateSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  logoUrl: z.string().url().optional(),
  description: z.string().trim().min(10).optional(),
  verified: z.boolean().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  apiEnabled: z.boolean().optional(),
  contactEmail: z.string().email().optional(),
  whatsappNumber: z.string().trim().min(8).max(20).optional(),
});

const brandUpdateSchema = brandCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

const brandAccountSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().email().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
});

router.get("/", async (_req, res) => {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  res.json({ data: brands });
});

router.get("/id/:id", async (req, res) => {
  const brand = await prisma.brand.findUnique({ where: { id: String(req.params.id) } });
  if (!brand) return res.status(404).json({ message: "Brand not found" });
  return res.json({ data: brand });
});

router.get("/:slug", async (req, res) => {
  const brand = await prisma.brand.findUnique({
    where: { slug: req.params.slug },
    include: {
      products: {
        where: { isActive: true, approvalStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!brand) return res.status(404).json({ message: "Brand not found" });
  return res.json({ data: brand });
});

router.get("/:id/members", requireAuth, requireAdmin, async (req, res) => {
  const members = await prisma.brandMember.findMany({
    where: { brandId: String(req.params.id) },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: members });
});

router.post("/:id/members", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      userId: z.string(),
      canManageProducts: z.boolean().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const brand = await prisma.brand.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!brand) return res.status(404).json({ message: "Brand not found" });

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, role: true } });
  if (!user) return res.status(404).json({ message: "User not found" });

  const member = await prisma.$transaction(async (tx) => {
    if ((user.role as string) !== "BRAND_STAFF") {
      await tx.user.update({ where: { id: user.id }, data: { role: "BRAND_STAFF" as never } });
    }

    return tx.brandMember.upsert({
      where: {
        userId_brandId: {
          userId: parsed.data.userId,
          brandId: brand.id,
        },
      },
      update: { canManageProducts: parsed.data.canManageProducts ?? true },
      create: {
        userId: parsed.data.userId,
        brandId: brand.id,
        canManageProducts: parsed.data.canManageProducts ?? true,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true } },
      },
    });
  });

  return res.status(201).json({ data: member });
});

router.post("/:id/account", requireAuth, requireAdmin, async (req, res) => {
  const parsed = brandAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const brand = await prisma.brand.findUnique({ where: { id: String(req.params.id) }, select: { id: true, name: true, slug: true, contactEmail: true } });
  if (!brand) return res.status(404).json({ message: "Brand not found" });

  try {
    const invite = await prisma.$transaction(async (tx) =>
      createBrandInviteAccount({
        prismaClient: tx,
        brandId: brand.id,
        brandName: brand.name,
        contactEmail: parsed.data.contactEmail || brand.contactEmail,
        fullName: parsed.data.fullName,
      }),
    );

    return res.status(201).json({
      data: {
        account: invite.user,
        inviteUrl: invite.inviteUrl,
        brandEmail: invite.brandEmail,
        brand,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Invite email is already used by another account" });
    }
    throw error;
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = brandCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  try {
    const { brand, invite } = await prisma.$transaction(async (tx) => {
      const createdBrand = await tx.brand.create({ data: parsed.data });
      const createdInvite = await createBrandInviteAccount({
        prismaClient: tx,
        brandId: createdBrand.id,
        brandName: createdBrand.name,
        contactEmail: createdBrand.contactEmail,
      });

      return { brand: createdBrand, invite: createdInvite };
    });

    return res.status(201).json({
      data: {
        brand,
        account: invite.user,
        inviteUrl: invite.inviteUrl,
        brandEmail: invite.brandEmail,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Brand name or slug already exists" });
    }
    throw error;
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = brandUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const existing = await prisma.brand.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, verified: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const brand = await prisma.brand.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
    });

    if (existing.verified === false && brand.verified === true) {
      queueNotificationEvent({
        name: notificationEventNames.brandApproved,
        brandId: brand.id,
      });
    }

    return res.json({ data: brand });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ message: "Brand not found" });
      if (error.code === "P2002") return res.status(409).json({ message: "Brand name or slug already exists" });
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const brandId = String(req.params.id);
  const linkedProducts = await prisma.product.count({ where: { brandId } });
  if (linkedProducts > 0) {
    return res.status(409).json({ message: "Cannot delete brand with linked products" });
  }

  try {
    await prisma.brand.delete({ where: { id: brandId } });
    return res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ message: "Brand not found" });
    }
    throw error;
  }
});

export default router;
