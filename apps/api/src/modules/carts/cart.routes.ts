import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  addCartItem,
  clearCart,
  createGuestCartSessionId,
  getCart,
  getCartScopeFromSession,
  getCartScopeFromUser,
  removeCartItem,
  replaceCart,
  setCartItemQuantity,
} from "./cart.service.js";

const router = Router();

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  selectedColor: z.string().trim().min(1).max(60).optional(),
  selectedSize: z.string().trim().min(1).max(40).optional(),
});

const replaceCartSchema = z.object({
  items: z.array(cartItemSchema).max(200),
  merge: z.boolean().optional(),
});

function ensureGuestSession(req: Request, res: Response) {
  const existing = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const headerSession = typeof req.headers["x-cart-session-id"] === "string" ? req.headers["x-cart-session-id"] : undefined;
  const sessionId = existing || headerSession || createGuestCartSessionId();

  if (!existing) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 14 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  return getCartScopeFromSession(sessionId);
}

function resolveCartScope(req: Request, res: Response) {
  const auth = req as Request & { auth?: { userId?: string } };
  if (auth.auth?.userId) {
    return getCartScopeFromUser(auth.auth.userId);
  }

  return ensureGuestSession(req, res);
}

function hasResultError<T extends { error?: { status: number } }>(result: T): result is T & { error: { status: number } } {
  return Boolean(result.error);
}

router.get("/", async (req, res) => {
  const scope = resolveCartScope(req, res);
  const cart = await getCart(scope);
  return res.json({ data: cart });
});

router.put("/", async (req, res) => {
  const parsed = replaceCartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const scope = resolveCartScope(req, res);
  const result = await replaceCart(scope, parsed.data.items);
  if (hasResultError(result)) {
    return res.status(result.error.status).json(result.error);
  }

  return res.json({ data: result.cart });
});

router.post("/items", async (req, res) => {
  const parsed = cartItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const scope = resolveCartScope(req, res);
  const result = await addCartItem(scope, parsed.data);
  if (hasResultError(result)) {
    return res.status(result.error.status).json(result.error);
  }

  return res.status(201).json({ data: result.cart });
});

router.patch("/items", async (req, res) => {
  const parsed = cartItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const scope = resolveCartScope(req, res);
  const result = await setCartItemQuantity(scope, parsed.data);
  if (hasResultError(result)) {
    return res.status(result.error.status).json(result.error);
  }

  return res.json({ data: result.cart });
});

router.delete("/items", async (req, res) => {
  const parsed = z
    .object({
      productId: z.string().min(1),
      selectedColor: z.string().trim().min(1).max(60).optional(),
      selectedSize: z.string().trim().min(1).max(40).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const scope = resolveCartScope(req, res);
  const result = await removeCartItem(scope, parsed.data);
  return res.json({ data: result.cart });
});

router.delete("/", async (req, res) => {
  const scope = resolveCartScope(req, res);
  await clearCart(scope);
  return res.status(204).send();
});

export default router;
