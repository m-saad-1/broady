import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

type SafeUser = {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";
  brandId?: string | null;
};

type BrandInviteResult = {
  user: SafeUser;
  brandEmail: string;
  inviteToken: string;
  inviteUrl: string;
};

type AuthTokenPayload = {
  userId: string;
  role: "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";
  brandId?: string | null;
  sessionId: string;
  tokenId: string;
};

const oauthClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toSafeUser(user: { id: string; email: string; fullName: string; role: SafeUser["role"]; brandId?: string | null }): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    brandId: user.brandId,
  };
}

function buildToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

async function createSessionAndToken(
  user: { id: string; role: SafeUser["role"]; brandId?: string | null },
  meta?: { userAgent?: string; ipAddress?: string },
) {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenId,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      expiresAt,
    },
  });

  const token = buildToken({
    userId: user.id,
    role: user.role,
    brandId: user.brandId,
    sessionId: session.id,
    tokenId,
  });

  return { token, session };
}

export async function registerUser(input: RegisterInput, meta?: { userAgent?: string; ipAddress?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    return { error: { status: 409, message: "Email already in use" } } as const;
  }

  const hashed = await bcrypt.hash(input.password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        password: hashed,
        role: "USER",
        authProvider: "LOCAL",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: { status: 409, message: "Email already in use" } } as const;
    }
    throw error;
  }

  const { token } = await createSessionAndToken(user, meta);
  return { token, user: toSafeUser(user) } as const;
}

export async function loginUser(input: LoginInput, meta?: { userAgent?: string; ipAddress?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.password) {
    return { error: { status: 401, message: "Invalid credentials" } } as const;
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    return { error: { status: 401, message: "Invalid credentials" } } as const;
  }

  const { token } = await createSessionAndToken(user, meta);
  return { token, user: toSafeUser(user) } as const;
}

export async function loginWithGoogle(idToken: string, meta?: { userAgent?: string; ipAddress?: string }) {
  if (!oauthClient || !env.googleClientId) {
    return { error: { status: 503, message: "Google OAuth is not configured" } } as const;
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub || payload.email_verified !== true) {
      return { error: { status: 401, message: "Invalid Google token" } } as const;
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const fullName = payload.name || email.split("@")[0] || "Google User";

    const userByGoogle = await prisma.user.findUnique({ where: { googleId } });
    const userByEmail = userByGoogle ? null : await prisma.user.findUnique({ where: { email } });

    let user;
    if (userByGoogle) {
      user = await prisma.user.update({
        where: { id: userByGoogle.id },
        data: {
          fullName,
          email,
        },
      });
    } else if (userByEmail) {
      user = await prisma.user.update({
        where: { id: userByEmail.id },
        data: {
          googleId,
          fullName,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          fullName,
          googleId,
          authProvider: "GOOGLE",
          role: "USER",
        },
      });
    }

    const { token } = await createSessionAndToken(user, meta);
    return { token, user: toSafeUser(user) } as const;
  } catch {
    return { error: { status: 401, message: "Invalid Google token" } } as const;
  }
}

export async function createBrandInviteAccount(input: {
  prismaClient: PrismaClient | Prisma.TransactionClient;
  brandId: string;
  brandName: string;
  contactEmail?: string | null;
  fullName?: string;
}): Promise<any> {
  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenHash = hashInviteToken(inviteToken);
  const brandInviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const brandEmail = input.contactEmail?.trim().toLowerCase() || `brand.${input.brandName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || input.brandId}@broady.local`;

  const existingBrandAccount = await input.prismaClient.user.findUnique({
    where: { brandId: input.brandId } as any,
    select: { id: true, fullName: true } as any,
  });

  const userDelegate: any = input.prismaClient.user;
  const updateResult: any = existingBrandAccount
    ? await userDelegate.update({
        where: { id: existingBrandAccount.id },
        data: {
          email: brandEmail,
          fullName: input.fullName || existingBrandAccount.fullName || `${input.brandName} Brand Admin`,
          role: "BRAND_ADMIN",
          authProvider: "LOCAL",
          brandInviteTokenHash: inviteTokenHash,
          brandInviteTokenExpiresAt,
          brandInviteAcceptedAt: null,
        },
        select: { id: true, email: true, fullName: true, role: true },
      })
    : await userDelegate.create({
        data: {
          email: brandEmail,
          fullName: input.fullName || `${input.brandName} Brand Admin`,
          role: "BRAND_ADMIN",
          brandId: input.brandId,
          authProvider: "LOCAL",
          password: null,
          brandInviteTokenHash: inviteTokenHash,
          brandInviteTokenExpiresAt,
        },
        select: { id: true, email: true, fullName: true, role: true },
      });

  const account: any = updateResult;

  const accountData = account as any;

  return {
    user: {
      id: accountData.id,
      email: accountData.email,
      fullName: accountData.fullName,
      role: accountData.role,
      brandId: accountData.brandId,
    },
    brandEmail,
    inviteToken,
    inviteUrl: `${env.webAppUrl.replace(/\/$/, "")}/brand/invite?token=${inviteToken}`,
  } satisfies BrandInviteResult;
}

export async function completeBrandInvite(input: { token: string; password: string }) {
  const tokenHash = hashInviteToken(input.token);
  const user = await prisma.user.findFirst({
    where: {
      brandInviteTokenHash: tokenHash,
      brandInviteTokenExpiresAt: { gt: new Date() },
    } as any,
  });

  if (!user) {
    return { error: { status: 400, message: "Invalid or expired invite link" } } as const;
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      brandInviteTokenHash: null,
      brandInviteTokenExpiresAt: null,
      brandInviteAcceptedAt: new Date(),
      authProvider: "LOCAL",
    } as any,
    select: { id: true, email: true, fullName: true, role: true, brandId: true } as any,
  });

  const updatedData = updated as any;

  const { token } = await createSessionAndToken({
    id: updatedData.id,
    role: updatedData.role,
    brandId: updatedData.brandId,
  });
  return {
    token,
    user: {
      id: updatedData.id,
      email: updatedData.email,
      fullName: updatedData.fullName,
      role: updatedData.role,
      brandId: updatedData.brandId,
    },
  } as const;
}

export async function revokeSessionFromToken(token: string | undefined) {
  if (!token) return;

  try {
    const payload = jwt.verify(token, env.jwtSecret) as Partial<AuthTokenPayload>;
    if (!payload.sessionId || !payload.tokenId) return;

    await prisma.session.updateMany({
      where: {
        id: payload.sessionId,
        tokenId: payload.tokenId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Intentionally ignore invalid/expired tokens for logout flow.
  }
}

export async function getSafeUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, role: true, brandId: true },
  });
  return user;
}
