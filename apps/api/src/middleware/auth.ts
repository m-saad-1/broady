import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

type AuthPayload = {
  userId: string;
  role: "USER" | "ADMIN";
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
  const bearerToken = req.headers.authorization?.replace("Bearer ", "");
  const cookieToken = req.cookies?.broady_token as string | undefined;
  const token = bearerToken || cookieToken;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!session || session.tokenId !== payload.tokenId || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }

    req.auth = {
      userId: session.user.id,
      role: session.user.role,
      sessionId: session.id,
      tokenId: session.tokenId,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}
