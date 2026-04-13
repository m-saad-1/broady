import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

type AuthRole = "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";

type AuthPayload = {
  userId: string;
  role: AuthRole;
  brandId?: string | null;
  sessionId: string;
  tokenId: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
  const cookieToken = req.cookies?.broady_token as string | undefined;
  const token = cookieToken || bearerToken;
  if (!token) return res.status(401).json({ message: "Unauthorized", code: "AUTH_MISSING" });

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: { select: { id: true, role: true, brandId: true } } },
    });

    if (!session || session.tokenId !== payload.tokenId || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ message: "Session expired or revoked", code: "AUTH_SESSION_EXPIRED" });
    }

    req.auth = {
      userId: session.user.id,
      role: session.user.role,
      brandId: session.user.brandId,
      sessionId: session.id,
      tokenId: session.tokenId,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired", code: "AUTH_TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Invalid token", code: "AUTH_INVALID_TOKEN" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || (req.auth.role !== "ADMIN" && req.auth.role !== "SUPER_ADMIN")) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}
