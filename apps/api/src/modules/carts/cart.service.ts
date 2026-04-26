import { randomUUID } from "node:crypto";
import type { Cart, CartItem, Product } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { getRedisClient } from "../../config/redis.js";

export type CartLineItem = {
  productId: string;
  quantity: number;
  selectedColor?: string | null;
  selectedSize?: string | null;
  pricePkr: number;
  brandId?: string;
  product?: Product & { brand?: { id: string; name: string; slug: string } | null };
};

export type CartSession = {
  ownerType: "user" | "guest";
  ownerId: string;
  items: CartLineItem[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type CartScope =
  | { kind: "user"; userId: string }
  | { kind: "guest"; sessionId: string };

const CART_TTL_SECONDS = 14 * 24 * 60 * 60;
const SESSION_COOKIE_NAME = "broady_cart_session";

function cartKey(scope: CartScope) {
  return scope.kind === "user" ? `cart:user:${scope.userId}` : `cart:guest:${scope.sessionId}`;
}

function cartOwnerId(scope: CartScope) {
  return scope.kind === "user" ? scope.userId : scope.sessionId;
}

function lineItemKey(item: Pick<CartLineItem, "productId" | "selectedColor" | "selectedSize">) {
  return [item.productId, item.selectedColor || "", item.selectedSize || ""].join("::");
}

function emptyCart(scope: CartScope): CartSession {
  const now = Date.now();
  return {
    ownerType: scope.kind,
    ownerId: cartOwnerId(scope),
    items: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + CART_TTL_SECONDS * 1000,
  };
}

function normalizeCartItem(item: CartLineItem) {
  return {
    productId: item.productId,
    quantity: item.quantity,
    selectedColor: item.selectedColor || null,
    selectedSize: item.selectedSize || null,
    pricePkr: item.pricePkr,
    brandId: item.brandId || null,
  };
}

function hydratePrismaCart(cart: CartSession, products: Array<Product & { brand?: { id: string; name: string; slug: string } | null }>) {
  const productById = new Map(products.map((product) => [product.id, product]));

  return {
    id: cart.ownerId,
    userId: cart.ownerType === "user" ? cart.ownerId : null,
    createdAt: new Date(cart.createdAt),
    updatedAt: new Date(cart.updatedAt),
    items: cart.items
      .map((item) => {
        const product = productById.get(item.productId);
        if (!product) return null;

        return {
          id: lineItemKey(item),
          quantity: item.quantity,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          product,
          productId: item.productId,
          pricePkr: item.pricePkr,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

async function loadCartFromRedis(scope: CartScope): Promise<CartSession | null> {
  const client = getRedisClient();

  try {
    const raw = await client.get(cartKey(scope));
    if (!raw) return null;
    return JSON.parse(raw) as CartSession;
  } catch (error) {
    console.warn("[cart] redis read failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function storeCartToRedis(scope: CartScope, cart: CartSession): Promise<void> {
  const client = getRedisClient();

  try {
    await client.set(cartKey(scope), JSON.stringify(cart), "EX", CART_TTL_SECONDS);
  } catch (error) {
    console.warn("[cart] redis write failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

async function removeCartKey(scope: CartScope): Promise<void> {
  try {
    await getRedisClient().del(cartKey(scope));
  } catch (error) {
    console.warn("[cart] redis delete failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

async function loadProductsForCart(cart: CartSession) {
  const productIds = Array.from(new Set(cart.items.map((item) => item.productId)));
  if (!productIds.length) return [] as Array<Product & { brand?: { id: string; name: string; slug: string } | null }>;

  return prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { id: true, name: true, slug: true } } },
  });
}

async function loadProductSnapshots(items: Array<{ productId: string; selectedColor?: string | null; selectedSize?: string | null; quantity: number }>) {
  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true, approvalStatus: "APPROVED" },
    include: { brand: { select: { id: true, name: true, slug: true } } },
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const invalidProductIds = productIds.filter((productId) => !productById.has(productId));

  return {
    productById,
    invalidProductIds,
  };
}

function mergeItems(items: CartLineItem[]) {
  const merged = new Map<string, CartLineItem>();

  for (const item of items) {
    const key = lineItemKey(item);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }

    merged.set(key, {
      ...existing,
      quantity: existing.quantity + item.quantity,
    });
  }

  return Array.from(merged.values());
}

async function syncUserCartToDatabase(userId: string, cart: CartSession): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ensuredCart = await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: ensuredCart.id } });

    if (!cart.items.length) return;

    await tx.cartItem.createMany({
      data: cart.items.map((item) => ({
        cartId: ensuredCart.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null,
      })),
    });
  });
}

export function createGuestCartSessionId() {
  return randomUUID();
}

export { SESSION_COOKIE_NAME };

export function getCartScopeFromUser(userId: string): CartScope {
  return { kind: "user", userId };
}

export function getCartScopeFromSession(sessionId: string): CartScope {
  return { kind: "guest", sessionId };
}

export async function getCart(scope: CartScope) {
  const cart = (await loadCartFromRedis(scope)) || emptyCart(scope);
  const products = await loadProductsForCart(cart);
  return hydratePrismaCart(cart, products);
}

export async function replaceCart(scope: CartScope, items: Array<{ productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null }>) {
  const { productById, invalidProductIds } = await loadProductSnapshots(items);
  if (invalidProductIds.length) {
    return { error: { status: 400, message: "One or more cart products are invalid or inactive", invalidProductIds } };
  }

  const now = Date.now();
  const cart: CartSession = {
    ownerType: scope.kind,
    ownerId: cartOwnerId(scope),
    items: mergeItems(
      items.map((item) => {
        const product = productById.get(item.productId)!;
        return {
          productId: item.productId,
          quantity: item.quantity,
          selectedColor: item.selectedColor || null,
          selectedSize: item.selectedSize || null,
          pricePkr: product.pricePkr,
          brandId: product.brandId,
        };
      }),
    ),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + CART_TTL_SECONDS * 1000,
  };

  await storeCartToRedis(scope, cart);

  if (scope.kind === "user") {
    await syncUserCartToDatabase(scope.userId, cart);
  }

  return { cart };
}

export async function addCartItem(scope: CartScope, item: { productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null }) {
  const { productById, invalidProductIds } = await loadProductSnapshots([item]);
  if (invalidProductIds.length) {
    return { error: { status: 400, message: "Product is not available for cart updates", invalidProductIds } };
  }

  const product = productById.get(item.productId)!;
  const cart = (await loadCartFromRedis(scope)) || emptyCart(scope);
  const key = lineItemKey(item);
  const existing = cart.items.find((line) => lineItemKey(line) === key);

  if (existing) {
    existing.quantity += item.quantity;
    existing.pricePkr = product.pricePkr;
    existing.brandId = product.brandId;
  } else {
    cart.items.push({
      productId: item.productId,
      quantity: item.quantity,
      selectedColor: item.selectedColor || null,
      selectedSize: item.selectedSize || null,
      pricePkr: product.pricePkr,
      brandId: product.brandId,
    });
  }

  cart.updatedAt = Date.now();
  cart.expiresAt = cart.updatedAt + CART_TTL_SECONDS * 1000;

  await storeCartToRedis(scope, cart);
  if (scope.kind === "user") {
    await syncUserCartToDatabase(scope.userId, cart);
  }

  return { cart };
}

export async function setCartItemQuantity(scope: CartScope, item: { productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null }) {
  const { productById, invalidProductIds } = await loadProductSnapshots([item]);
  if (invalidProductIds.length) {
    return { error: { status: 400, message: "Product is not available for cart updates", invalidProductIds } };
  }

  const product = productById.get(item.productId)!;
  const cart = (await loadCartFromRedis(scope)) || emptyCart(scope);
  const key = lineItemKey(item);
  const existing = cart.items.find((line) => lineItemKey(line) === key);

  if (existing) {
    existing.quantity = item.quantity;
    existing.pricePkr = product.pricePkr;
    existing.brandId = product.brandId;
  } else {
    cart.items.push({
      productId: item.productId,
      quantity: item.quantity,
      selectedColor: item.selectedColor || null,
      selectedSize: item.selectedSize || null,
      pricePkr: product.pricePkr,
      brandId: product.brandId,
    });
  }

  cart.items = cart.items.filter((line) => line.quantity > 0);
  cart.updatedAt = Date.now();
  cart.expiresAt = cart.updatedAt + CART_TTL_SECONDS * 1000;

  await storeCartToRedis(scope, cart);
  if (scope.kind === "user") {
    await syncUserCartToDatabase(scope.userId, cart);
  }

  return { cart };
}

export async function removeCartItem(scope: CartScope, item: { productId: string; selectedColor?: string | null; selectedSize?: string | null }) {
  const cart = (await loadCartFromRedis(scope)) || emptyCart(scope);
  const key = lineItemKey(item);
  cart.items = cart.items.filter((line) => lineItemKey(line) !== key);
  cart.updatedAt = Date.now();
  cart.expiresAt = cart.updatedAt + CART_TTL_SECONDS * 1000;

  await storeCartToRedis(scope, cart);
  if (scope.kind === "user") {
    await syncUserCartToDatabase(scope.userId, cart);
  }

  return { cart };
}

export async function clearCart(scope: CartScope) {
  await removeCartKey(scope);

  if (scope.kind === "user") {
    await prisma.cartItem.deleteMany({
      where: {
        cart: { userId: scope.userId },
      },
    });
  }
}

export async function syncCheckoutCart(scope: CartScope, purchasedItems: Array<{ productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null }>) {
  if (scope.kind !== "user") return;

  const cart = (await loadCartFromRedis(scope)) || emptyCart(scope);
  const purchasedKeys = new Set(purchasedItems.map((item) => lineItemKey(item)));
  cart.items = cart.items.filter((line) => !purchasedKeys.has(lineItemKey(line)));
  cart.updatedAt = Date.now();
  cart.expiresAt = cart.updatedAt + CART_TTL_SECONDS * 1000;

  await storeCartToRedis(scope, cart);
  await syncUserCartToDatabase(scope.userId, cart);
}
