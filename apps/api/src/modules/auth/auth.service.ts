import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

type SafeUser = {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
};

type AuthTokenPayload = {
  userId: string;
  role: "USER" | "ADMIN";
  sessionId: string;
  tokenId: string;
};

const oauthClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

function toSafeUser(user: { id: string; email: string; fullName: string; role: "USER" | "ADMIN" }): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

function buildToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

async function createSessionAndToken(user: { id: string; role: "USER" | "ADMIN" }, meta?: { userAgent?: string; ipAddress?: string }) {
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
    select: { id: true, email: true, fullName: true, role: true },
  });
  return user;
}
