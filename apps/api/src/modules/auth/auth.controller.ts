import type { Request, Response } from "express";
import { googleAuthSchema, loginSchema, registerSchema } from "./auth.schemas.js";
import { getSafeUserById, loginUser, loginWithGoogle, registerUser, revokeSessionFromToken } from "./auth.service.js";

export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function hasError(result: unknown): result is { error: { status: number; message: string } } {
  if (!result || typeof result !== "object") return false;
  return "error" in result;
}

function requestMeta(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : req.ip;
  const userAgent = req.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

export async function registerController(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
  }

  const result = await registerUser(parsed.data, requestMeta(req));
  if (hasError(result)) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  res.cookie("broady_token", result.token, tokenCookieOptions);
  return res.status(201).json({ token: result.token, user: result.user });
}

export async function loginController(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
  }

  const result = await loginUser(parsed.data, requestMeta(req));
  if (hasError(result)) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  res.cookie("broady_token", result.token, tokenCookieOptions);
  return res.json({ token: result.token, user: result.user });
}

export async function googleAuthController(req: Request, res: Response) {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
  }

  const result = await loginWithGoogle(parsed.data.idToken, requestMeta(req));
  if (hasError(result)) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  res.cookie("broady_token", result.token, tokenCookieOptions);
  return res.json({ token: result.token, user: result.user });
}

export async function logoutController(req: Request, res: Response) {
  const bearerToken = req.headers.authorization?.replace("Bearer ", "");
  const cookieToken = req.cookies?.broady_token as string | undefined;
  const token = bearerToken || cookieToken;

  await revokeSessionFromToken(token);

  res.clearCookie("broady_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res.status(204).send();
}

export async function meController(req: Request, res: Response) {
  if (!req.auth?.userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await getSafeUserById(req.auth.userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  return res.json({ user });
}
