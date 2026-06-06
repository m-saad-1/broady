import { fallbackBrands, fallbackProducts } from "./mock-data";
import { useMockFallback } from "./runtime-flags";
import { clearStoredAuthToken, getStoredAuthToken } from "@/lib/auth-client";
import { normalizeProduct } from "@/lib/taxonomy";
import type {
  AdminReviewReportRecord,
  AdminBrandDashboardRecord,
  Brand,
  BrandProvisioningResponse,
  BrandDashboardOrder,
  BrandDashboardOverview,
  BrandWithProducts,
  CartItem,
  NotificationItem,
  NotificationPreference,
  ProductContentTemplate,
  ProductDeliveriesReturns,
  ProductFabricCare,
  ImportJobRecord,
  ImportSourceType,
  ImportLogRecord,
  IngestionQueueMetrics,
  ProductShippingDelivery,
  ProductSizeGuide,
  ProductTemplateType,
  Product,
  ProductReview,
  ProductReviewsResponse,
  ReviewReport,
  ReviewReportReason,
  ReviewReportStatus,
  SearchSuggestion,
  User,
  UserOrder,
  UserPaymentMethod,
  UserPaymentType,
  UserAddress,
} from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type ApiEnvelope<T> = { data: T };
type ApiErrorBody = { message?: string; code?: string };

function normalizeBrandDashboardOrder(order: unknown): BrandDashboardOrder {
  const orderRecord = (order && typeof order === "object" ? order : {}) as Record<string, unknown>;
  const nestedOrder = (orderRecord.order && typeof orderRecord.order === "object" ? orderRecord.order : {}) as Record<string, unknown>;

  const fallbackTimestamp = "1970-01-01T00:00:00.000Z";
  const resolvedCreatedAt =
    typeof orderRecord.createdAt === "string"
      ? orderRecord.createdAt
      : typeof nestedOrder.createdAt === "string"
        ? nestedOrder.createdAt
        : fallbackTimestamp;

  return {
    ...(orderRecord as object),
    paymentMethod: (orderRecord.paymentMethod as string) || (nestedOrder.paymentMethod as string) || "COD",
    paymentStatus: (orderRecord.paymentStatus as string) || (nestedOrder.paymentStatus as string) || "PENDING",
    totalPkr: typeof orderRecord.totalPkr === "number" ? orderRecord.totalPkr : typeof orderRecord.subtotalPkr === "number" ? orderRecord.subtotalPkr : 0,
    deliveryAddress: (orderRecord.deliveryAddress as string) || (nestedOrder.deliveryAddress as string) || "Address unavailable",
    createdAt: resolvedCreatedAt,
    updatedAt:
      typeof orderRecord.updatedAt === "string"
        ? orderRecord.updatedAt
        : typeof nestedOrder.updatedAt === "string"
          ? nestedOrder.updatedAt
          : resolvedCreatedAt,
    user: (orderRecord.user as BrandDashboardOrder["user"]) || (nestedOrder.user as BrandDashboardOrder["user"]) || {
      id: (nestedOrder.userId as string) || "unknown-user",
      fullName: "Customer",
      email: "not-provided@broady.local",
    },
    statusLogs: Array.isArray(orderRecord.statusLogs)
      ? (orderRecord.statusLogs as BrandDashboardOrder["statusLogs"])
      : Array.isArray(nestedOrder.statusLogs)
        ? (nestedOrder.statusLogs as BrandDashboardOrder["statusLogs"])
        : [],
  } as BrandDashboardOrder;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function mergeProductsWithFallback(products: Product[]): Product[] {
  const normalizedApi = products.map(normalizeProduct);
  if (!useMockFallback) {
    return normalizedApi;
  }

  const merged = [...normalizedApi];
  const seenSlugs = new Set(normalizedApi.map((item) => item.slug));
  for (const fallback of fallbackProducts.map(normalizeProduct)) {
    if (!seenSlugs.has(fallback.slug)) {
      merged.push(fallback);
    }
  }

  return merged;
}

async function safeFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("API failed");
    const json = (await response.json()) as ApiEnvelope<T>;
    return json.data;
  } catch {
    throw new Error("FALLBACK");
  } finally {
    clearTimeout(timeout);
  }
}

function getApiBaseCandidates() {
  const candidates = [API_BASE];

  if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL && /^https?:\/\/localhost:4000\/api\/?$/.test(API_BASE)) {
    for (const port of [4001, 4002, 4003, 4004]) {
      candidates.push(`http://localhost:${port}/api`);
    }
  }

  return candidates;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = getStoredAuthToken();
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  let lastTransportError: unknown;

  for (const apiBase of getApiBaseCandidates()) {
    try {
      const response = await fetch(`${apiBase}${path}`, {
        credentials: "include",
        ...init,
        headers: {
          ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(init?.headers || {}),
        },
      });

      if (!response.ok) {
        let message = `Request failed: ${response.status}`;
        let code: string | undefined;
        try {
          const json = (await response.json()) as ApiErrorBody;
          if (json.message) {
            message = json.message;
          }
          code = json.code;
        } catch {
          // Ignore non-JSON error bodies.
        }

        if (
          response.status === 401 &&
          /unauthorized|token expired|session expired|invalid token|session revoked/i.test(message)
        ) {
          clearStoredAuthToken();
          throw new ApiRequestError("Your session expired. Please sign in again and retry.", response.status, code || "AUTH_SESSION_EXPIRED");
        }

        throw new ApiRequestError(message, response.status, code);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastTransportError = error;
      const isTransportFailure = error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
      if (!isTransportFailure) {
        throw error;
      }
    }
  }

  const transportMessage = lastTransportError instanceof Error ? lastTransportError.message : "The API server could not be reached.";
  throw new ApiRequestError(`Unable to reach the API server. ${transportMessage}`.trim(), 0, "NETWORK_ERROR");
}

export async function getBrands(): Promise<Brand[]> {
  try {
    const brands = await safeFetch<Brand[]>("/brands");
    if (!useMockFallback) {
      return brands;
    }

    const seen = new Set(brands.map((item) => item.slug));
    const merged = [...brands];
    for (const fallback of fallbackBrands) {
      if (!seen.has(fallback.slug)) {
        merged.push(fallback);
      }
    }

    return merged;
  } catch {
    if (!useMockFallback) {
      return [];
    }
    return fallbackBrands;
  }
}

export async function getBrandBySlug(slug: string): Promise<BrandWithProducts | null> {
  const fallbackBrand = fallbackBrands.find((item) => item.slug === slug);

  try {
    const brand = await safeFetch<BrandWithProducts>(`/brands/${slug}`);
    const normalizedBrandProducts = mergeProductsWithFallback(brand.products).filter(
      (product) => product.brandId === brand.id,
    );
    if (!useMockFallback) {
      return {
        ...brand,
        products: normalizedBrandProducts,
      };
    }

    const fallbackBrandProducts = fallbackBrand
      ? fallbackProducts
          .filter((product) => product.brandId === fallbackBrand.id)
          .map(normalizeProduct)
      : [];

    const mergedBrandProducts = [...normalizedBrandProducts];
    const seen = new Set(normalizedBrandProducts.map((item) => item.slug));
    for (const fallback of fallbackBrandProducts) {
      if (!seen.has(fallback.slug)) {
        mergedBrandProducts.push(fallback);
      }
    }

    return {
      ...(fallbackBrand ? { ...fallbackBrand, ...brand } : brand),
      products: mergedBrandProducts,
    };
  } catch {
    if (!fallbackBrand) return null;
    return {
      ...fallbackBrand,
      products: fallbackProducts
        .filter((product) => product.brandId === fallbackBrand.id)
        .map(normalizeProduct),
    };
  }
}

export async function getProducts(params?: Record<string, string>): Promise<Product[]> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const hasActiveFilters = Boolean(
    params?.q ||
      params?.brand ||
      params?.topCategory ||
      params?.juniorCategory ||
      params?.productType ||
      params?.subCategory ||
      params?.size ||
      params?.minPrice ||
      params?.maxPrice,
  );

  try {
    const products = await safeFetch<Product[]>(`/products${query}`);
    const mergedProducts = hasActiveFilters ? products.map(normalizeProduct) : mergeProductsWithFallback(products);
    if (mergedProducts.length) {
      return mergedProducts;
    }

    return hasActiveFilters ? [] : fallbackProducts.map(normalizeProduct);
  } catch {
    if (!useMockFallback) {
      return [];
    }
    return hasActiveFilters ? [] : fallbackProducts.map(normalizeProduct);
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  try {
    const product = await safeFetch<Product>(`/products/${slug}`);
    return normalizeProduct(product);
  } catch {
    if (!useMockFallback) {
      return null;
    }

    const fallback = fallbackProducts.find((item) => item.slug === slug);
    return fallback ? normalizeProduct(fallback) : null;
  }
}

export async function getProductSearchSuggestions(
  query: string,
  options?: { topCategory?: string; juniorCategory?: string },
): Promise<{ suggestions: SearchSuggestion[]; correctedQuery?: string }> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return { suggestions: [] };
  }

  const params = new URLSearchParams({ q: normalized });
  if (options?.topCategory) {
    params.set("topCategory", options.topCategory);
  }
  if (options?.juniorCategory) {
    params.set("juniorCategory", options.juniorCategory);
  }

  try {
    const response = await fetch(`${API_BASE}/products/suggest?${params.toString()}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error("API failed");
    }

    const json = (await response.json()) as { data?: SearchSuggestion[]; correctedQuery?: string };
    return {
      suggestions: Array.isArray(json.data) ? json.data : [],
      correctedQuery: json.correctedQuery,
    };
  } catch {
    return { suggestions: [] };
  }
}


type WishlistEnvelope = { data: Array<{ product: Product }> };
type UserCartEnvelope = {
  data: {
    items: Array<{
      quantity: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      product: Product;
    }>;
  };
};

export async function getWishlistProducts(): Promise<Product[]> {
  const response = await authFetch<WishlistEnvelope>("/users/wishlist", { method: "GET" });
  return response.data.map((item) => normalizeProduct(item.product));
}

export async function addWishlistProduct(productId: string): Promise<void> {
  await authFetch(`/users/wishlist/${productId}`, { method: "POST" });
}

export async function removeWishlistProduct(productId: string): Promise<void> {
  await authFetch(`/users/wishlist/${productId}`, { method: "DELETE" });
}

export async function getUserCartItems(): Promise<CartItem[]> {
  const response = await authFetch<UserCartEnvelope>("/users/cart", { method: "GET" });
  return response.data.items.map((item) => ({
    quantity: item.quantity,
    product: normalizeProduct(item.product),
    selectedColor: item.selectedColor || undefined,
    selectedSize: item.selectedSize || undefined,
  }));
}

export async function syncUserCartItems(
  items: Array<{ productId: string; quantity: number; selectedColor?: string; selectedSize?: string }>,
  options?: { merge?: boolean },
): Promise<CartItem[]> {
  const response = await authFetch<UserCartEnvelope>("/users/cart", {
    method: "PUT",
    body: JSON.stringify({ items, merge: Boolean(options?.merge) }),
  });

  return response.data.items.map((item) => ({
    quantity: item.quantity,
    product: normalizeProduct(item.product),
    selectedColor: item.selectedColor || undefined,
    selectedSize: item.selectedSize || undefined,
  }));
}

type CreateOrderPayload = {
  paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
  deliveryAddress: string;
  items: Array<{ productId: string; quantity: number; selectedColor?: string; selectedSize?: string }>;
};

type CreateOrderResponse = {
  data: { id: string };
  paymentRedirect?: string | null;
};

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
  return authFetch<CreateOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getUserOrders(): Promise<UserOrder[]> {
  const response = await authFetch<ApiEnvelope<UserOrder[]>>("/orders/me", {
    method: "GET",
  });
  return response.data;
}

export async function getUserOrder(orderId: string): Promise<UserOrder> {
  const response = await authFetch<ApiEnvelope<UserOrder>>(`/orders/me/${orderId}`, {
    method: "GET",
  });
  return response.data;
}

export async function updateUserOrderAddress(orderId: string, deliveryAddress: string): Promise<UserOrder> {
  const response = await authFetch<ApiEnvelope<UserOrder>>(`/orders/me/${orderId}/address`, {
    method: "PATCH",
    body: JSON.stringify({ deliveryAddress }),
  });
  return response.data;
}

export type CancelReasonCode = "CHANGED_MIND" | "ORDERED_BY_MISTAKE" | "FOUND_BETTER_PRICE" | "DELIVERY_TOO_SLOW" | "PAYMENT_ISSUE" | "OTHER";

export type CancelPayload = {
  reasonCode: CancelReasonCode;
  customReason?: string;
  note?: string;
};

export async function cancelUserOrder(orderId: string, payload?: string | CancelPayload): Promise<UserOrder> {
  const body = typeof payload === "string" ? { note: payload } : payload || {};
  const response = await authFetch<ApiEnvelope<UserOrder>>(`/orders/me/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return response.data;
}

type ReorderResponse = {
  data: {
    id: string;
    userId: string;
    items: Array<{
      id: string;
      quantity: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      product: Product;
    }>;
  };
};

export async function reorderUserOrder(orderId: string): Promise<ReorderResponse["data"]> {
  const response = await authFetch<ReorderResponse>(`/orders/me/${orderId}/reorder`, {
    method: "POST",
  });
  return {
    ...response.data,
    items: response.data.items.map((item) => ({
      ...item,
      product: normalizeProduct(item.product),
    })),
  };
}

export async function cancelUserSubOrder(orderId: string, subOrderId: string, payload?: CancelPayload): Promise<UserOrder> {
  const response = await authFetch<ApiEnvelope<UserOrder>>(`/orders/me/${orderId}/sub-orders/${subOrderId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return response.data;
}

export async function reorderUserSubOrder(orderId: string, subOrderId: string): Promise<ReorderResponse["data"]> {
  const response = await authFetch<ReorderResponse>(`/orders/me/${orderId}/sub-orders/${subOrderId}/reorder`, {
    method: "POST",
  });
  return {
    ...response.data,
    items: response.data.items.map((item) => ({
      ...item,
      product: normalizeProduct(item.product),
    })),
  };
}

export type TrackUserBehaviorEventPayload = {
  eventType:
    | "PRODUCT_VIEW"
    | "PRODUCT_CLICK"
    | "PRODUCT_ADDED_TO_CART"
    | "PRODUCT_REMOVED_FROM_CART"
    | "WISHLIST_ADDED"
    | "SEARCH_QUERY"
    | "CATEGORY_BROWSE"
    | "FILTER_USED"
    | "PRODUCT_PURCHASED"
    | "PRODUCT_RETURNED"
    | "PRODUCT_CANCELLED"
    | "CHECKOUT_STARTED"
    | "ORDER_PLACED"
    | "RECOMMENDATION_CLICK"
    | "EXPLICIT_PRODUCT_INTEREST";
  productId?: string;
  variantId?: string;
  brandId?: string;
  searchQuery?: string;
  filters?: Record<string, unknown>;
  sourcePage?: string;
  device?: string;
  gender?: string;
  topCategory?: string;
  subCategory?: string;
  metadata?: Record<string, unknown>;
};

export type RecommendationMeta = {
  impressionId?: string;
  surface: "FOR_YOU" | "SIMILAR_ITEMS" | "TRENDING" | "POPULAR_IN_CATEGORY" | string;
  algorithm: string;
  generatedAt: string;
  reason?: string;
};

type RecommendationEnvelope = {
  data: Product[];
  meta?: RecommendationMeta;
};

const RECOMMENDATION_SESSION_STORAGE_KEY = "broady-recommendation-session";
const RECOMMENDATION_SESSION_COOKIE = "broady_recommendation_session";

function isValidRecommendationSessionId(value?: string | null) {
  return Boolean(value && /^[a-zA-Z0-9:_-]{12,96}$/.test(value));
}

function createRecommendationSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `rec_${crypto.randomUUID()}`;
  }
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function getRecommendationSessionId() {
  if (typeof window === "undefined") return undefined;

  try {
    const stored = window.localStorage.getItem(RECOMMENDATION_SESSION_STORAGE_KEY);
    if (isValidRecommendationSessionId(stored)) {
      return stored || undefined;
    }

    const sessionId = createRecommendationSessionId();
    window.localStorage.setItem(RECOMMENDATION_SESSION_STORAGE_KEY, sessionId);
    document.cookie = `${RECOMMENDATION_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
    return sessionId;
  } catch {
    return undefined;
  }
}

async function recommendationFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = getStoredAuthToken();
  const recommendationSessionId = getRecommendationSessionId();
  let lastTransportError: unknown;

  for (const apiBase of getApiBaseCandidates()) {
    try {
      const response = await fetch(`${apiBase}${path}`, {
        credentials: "include",
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(recommendationSessionId ? { "X-Recommendation-Session-Id": recommendationSessionId } : {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(init?.headers || {}),
        },
      });

      if (!response.ok) {
        let message = `Request failed: ${response.status}`;
        let code: string | undefined;
        try {
          const json = (await response.json()) as ApiErrorBody;
          message = json.message || message;
          code = json.code;
        } catch {
          // Ignore non-JSON error bodies.
        }
        throw new ApiRequestError(message, response.status, code);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastTransportError = error;
      const isTransportFailure = error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
      if (!isTransportFailure) {
        throw error;
      }
    }
  }

  const transportMessage = lastTransportError instanceof Error ? lastTransportError.message : "The API server could not be reached.";
  throw new ApiRequestError(`Unable to reach the recommendation API. ${transportMessage}`.trim(), 0, "NETWORK_ERROR");
}

async function publicRecommendationFetch(path: string): Promise<RecommendationEnvelope> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error("API failed");
  return (await response.json()) as RecommendationEnvelope;
}

function normalizeRecommendationEnvelope(envelope: RecommendationEnvelope) {
  return {
    products: Array.isArray(envelope.data) ? envelope.data.map(normalizeProduct) : [],
    meta: envelope.meta,
  };
}

export async function trackUserBehaviorEvent(payload: TrackUserBehaviorEventPayload): Promise<void> {
  await recommendationFetch<{ accepted: boolean }>("/recommendations/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getForYouRecommendationFeed(options?: {
  limit?: number;
  topCategory?: string;
  subCategory?: string;
}): Promise<{ products: Product[]; meta?: RecommendationMeta }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.topCategory) params.set("topCategory", options.topCategory);
  if (options?.subCategory) params.set("subCategory", options.subCategory);
  const query = params.toString();
  const envelope = await recommendationFetch<RecommendationEnvelope>(`/recommendations/for-you${query ? `?${query}` : ""}`);
  return normalizeRecommendationEnvelope(envelope);
}

export async function getSimilarRecommendationProducts(
  productId: string,
  limit = 12,
): Promise<{ products: Product[]; meta?: RecommendationMeta }> {
  const path = `/recommendations/similar/${encodeURIComponent(productId)}?limit=${limit}`;
  const envelope = typeof window === "undefined"
    ? await publicRecommendationFetch(path)
    : await recommendationFetch<RecommendationEnvelope>(path);
  return normalizeRecommendationEnvelope(envelope);
}

export async function getTrendingRecommendationProducts(options?: {
  limit?: number;
  topCategory?: string;
  subCategory?: string;
}): Promise<{ products: Product[]; meta?: RecommendationMeta }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.topCategory) params.set("topCategory", options.topCategory);
  if (options?.subCategory) params.set("subCategory", options.subCategory);
  const query = params.toString();
  const path = `/recommendations/trending${query ? `?${query}` : ""}`;
  const envelope = typeof window === "undefined"
    ? await publicRecommendationFetch(path)
    : await recommendationFetch<RecommendationEnvelope>(path);
  return normalizeRecommendationEnvelope(envelope);
}

export async function getAdminBrands(): Promise<Brand[]> {
  const response = await authFetch<ApiEnvelope<Brand[]>>("/brands", { method: "GET" });
  return response.data;
}

export async function getAdminProducts(): Promise<Product[]> {
  const response = await authFetch<ApiEnvelope<Product[]>>("/products/admin", { method: "GET" });
  return response.data.map(normalizeProduct);
}

export async function getAdminProductById(productId: string): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/products/admin/${productId}`, { method: "GET" });
  return normalizeProduct(response.data);
}

export async function createAdminImportJob(payload: {
  brandId: string;
  sourceType: ImportSourceType;
  sourceLabel?: string;
  sourceLocation?: string;
  rawText?: string;
  rawJson?: unknown;
  file?: File;
}): Promise<ImportJobRecord> {
  const formData = new FormData();
  formData.append("brandId", payload.brandId);
  formData.append("sourceType", payload.sourceType);
  if (payload.sourceLabel) formData.append("sourceLabel", payload.sourceLabel);
  if (payload.sourceLocation) formData.append("sourceLocation", payload.sourceLocation);
  if (payload.rawText) formData.append("rawText", payload.rawText);
  if (payload.rawJson !== undefined) formData.append("rawJson", JSON.stringify(payload.rawJson));
  if (payload.file) formData.append("file", payload.file);

  const response = await authFetch<ApiEnvelope<ImportJobRecord>>("/admin/ingestion/imports", {
    method: "POST",
    body: formData,
  });
  return response.data;
}

export async function getAdminImportJobs(): Promise<ImportJobRecord[]> {
  const response = await authFetch<ApiEnvelope<ImportJobRecord[]>>("/admin/ingestion/imports", { method: "GET" });
  return response.data;
}

export async function getAdminImportJob(importJobId: string): Promise<ImportJobRecord> {
  const response = await authFetch<ApiEnvelope<ImportJobRecord>>(`/admin/ingestion/imports/${importJobId}`, { method: "GET" });
  return response.data;
}

export async function getAdminImportFailedProducts(importJobId: string): Promise<ImportLogRecord[]> {
  const response = await authFetch<ApiEnvelope<ImportLogRecord[]>>(`/admin/ingestion/imports/${importJobId}/failed-products`, {
    method: "GET",
  });
  return response.data;
}

export async function retryAdminImportJob(importJobId: string): Promise<ImportJobRecord> {
  const response = await authFetch<ApiEnvelope<ImportJobRecord>>(`/admin/ingestion/imports/${importJobId}/retry`, { method: "POST" });
  return response.data;
}

export async function deleteAdminImportJob(importJobId: string): Promise<void> {
  await authFetch(`/admin/ingestion/imports/${importJobId}`, { method: "DELETE" });
}

export async function getAdminIngestionQueueMetrics(): Promise<IngestionQueueMetrics> {
  const response = await authFetch<ApiEnvelope<IngestionQueueMetrics>>("/admin/ingestion/queues/metrics", { method: "GET" });
  return response.data;
}

export async function getAdminIngestionPendingProducts(): Promise<Product[]> {
  const response = await authFetch<ApiEnvelope<Product[]>>("/admin/ingestion/approvals/pending", { method: "GET" });
  return response.data.map(normalizeProduct);
}

export async function getAdminIngestionPendingProductById(productId: string): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/admin/ingestion/approvals/pending/${productId}`, { method: "GET" });
  return normalizeProduct(response.data);
}

export async function fixAdminIngestionProduct(
  productId: string,
  payload: Partial<Pick<Product, "name" | "description" | "topCategory" | "subCategory" | "color" | "pricePkr" | "stock" | "sizes" | "tags" | "imageUrl">>,
): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/admin/ingestion/products/${productId}/fix`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response.data);
}

export async function triggerAdminInventorySync(productId: string): Promise<{ queued: boolean; productId: string }> {
  const response = await authFetch<ApiEnvelope<{ queued: boolean; productId: string }>>(
    `/admin/ingestion/products/${productId}/inventory-sync`,
    { method: "POST" },
  );
  return response.data;
}

export async function createBrandImportJob(payload: {
  sourceType: ImportSourceType;
  sourceLabel?: string;
  sourceLocation?: string;
  rawText?: string;
  rawJson?: unknown;
  file?: File;
}): Promise<ImportJobRecord> {
  const formData = new FormData();
  formData.append("sourceType", payload.sourceType);
  if (payload.sourceLabel) formData.append("sourceLabel", payload.sourceLabel);
  if (payload.sourceLocation) formData.append("sourceLocation", payload.sourceLocation);
  if (payload.rawText) formData.append("rawText", payload.rawText);
  if (payload.rawJson !== undefined) formData.append("rawJson", JSON.stringify(payload.rawJson));
  if (payload.file) formData.append("file", payload.file);

  const response = await authFetch<ApiEnvelope<ImportJobRecord>>("/brand-dashboard/ingestion/imports", {
    method: "POST",
    body: formData,
  });
  return response.data;
}

export async function getBrandImportJobs(): Promise<ImportJobRecord[]> {
  const response = await authFetch<ApiEnvelope<ImportJobRecord[]>>("/brand-dashboard/ingestion/imports", { method: "GET" });
  return response.data;
}

export async function getBrandImportJob(importJobId: string): Promise<ImportJobRecord> {
  const response = await authFetch<ApiEnvelope<ImportJobRecord>>(`/brand-dashboard/ingestion/imports/${importJobId}`, {
    method: "GET",
  });
  return response.data;
}

export async function retryBrandImportJob(importJobId: string): Promise<ImportJobRecord> {
  const response = await authFetch<ApiEnvelope<ImportJobRecord>>(`/brand-dashboard/ingestion/imports/${importJobId}/retry`, {
    method: "POST",
  });
  return response.data;
}

export async function deleteBrandImportJob(importJobId: string): Promise<void> {
  await authFetch(`/brand-dashboard/ingestion/imports/${importJobId}`, { method: "DELETE" });
}

export async function getBrandPendingFixProducts(status?: "PENDING" | "REJECTED"): Promise<Product[]> {
  const query = status ? `?status=${status}` : "";
  const response = await authFetch<ApiEnvelope<Product[]>>(`/brand-dashboard/ingestion/products/pending-fixes${query}`, {
    method: "GET",
  });
  return response.data.map(normalizeProduct);
}

export async function getBrandPendingFixProductById(productId: string): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/brand-dashboard/ingestion/products/pending-fixes/${productId}`, {
    method: "GET",
  });
  return normalizeProduct(response.data);
}

export async function fixBrandIngestionProduct(
  productId: string,
  payload: Partial<Pick<Product, "name" | "description" | "topCategory" | "subCategory" | "color" | "pricePkr" | "stock" | "sizes" | "tags" | "imageUrl">>,
): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/brand-dashboard/ingestion/products/${productId}/fix`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response.data);
}

export async function getAdminBrandDashboard(): Promise<AdminBrandDashboardRecord[]> {
  const response = await authFetch<ApiEnvelope<AdminBrandDashboardRecord[]>>("/admin/brand-dashboard", {
    method: "GET",
  });
  return response.data.map((entry) => ({
    ...entry,
    products: entry.products.map(normalizeProduct),
    orders: entry.orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: normalizeProduct(item.product),
      })),
    })),
  }));
}

type BrandMutationPayload = {
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  verified?: boolean;
  contactEmail?: string;
  whatsappNumber?: string;
};

export type ProductMutationPayload = {
  brandId: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  actualPrice: number;
  salePrice?: number;
  discountPercentage?: number;
  pricePkr: number;
  currency?: string;
  label?: string;
  saleStartDate?: string;
  saleEndDate?: string;
  gender: "Men" | "Women" | "Juniors";
  color: string;
  type: "Top" | "Bottom" | "Footwear" | "Accessories";
  fit?: string;
  season?: string;
  collection?: string;
  productUrl?: string;
  visibility?: "visible" | "hidden";
  source?: string;
  topCategory: "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";
  subCategory: string;
  sizes: string[];
  tags?: string[];
  imageUrl: string;
  sizeGuideTemplateId?: string;
  sizeGuide?: ProductSizeGuide;
  deliveriesReturnsTemplateId?: string;
  deliveriesReturns?: Partial<ProductDeliveriesReturns>;
  shippingDeliveryTemplateId?: string;
  shippingDelivery?: Partial<ProductShippingDelivery>;
  fabricCareTemplateId?: string;
  fabricCare?: Partial<ProductFabricCare>;
  detail?: {
    fabricComposition?: string;
    careGuide?: string;
    fitDetails?: string;
    modelDetails?: string;
    sizeGuideText?: string;
    sizeGuideImageUrl?: string;
    shippingDelivery?: string;
    returnExchangePolicy?: string;
    disclaimer?: string;
    materialDetails?: string;
    origin?: string;
    packageIncludes?: string;
  };
  shipping?: {
    estimatedDeliveryMinDays?: number;
    estimatedDeliveryMaxDays?: number;
    deliveryText?: string;
    shippingFee?: number;
    freeShippingAvailable?: boolean;
    codAvailable?: boolean;
    returnAvailable?: boolean;
    exchangeAvailable?: boolean;
    returnWindowDays?: number;
    exchangeWindowDays?: number;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    ogImageUrl?: string;
  };
  stock: number;
  isActive?: boolean;
};

export async function getProductContentTemplates(type: ProductTemplateType): Promise<ProductContentTemplate[]> {
  const response = await authFetch<ApiEnvelope<ProductContentTemplate[]>>(`/products/templates?type=${encodeURIComponent(type)}`, {
    method: "GET",
  });
  return response.data;
}

export async function createProductContentTemplate(
  payload: {
    type: ProductTemplateType;
    name: string;
    content: ProductSizeGuide | ProductDeliveriesReturns | ProductShippingDelivery | ProductFabricCare;
  },
): Promise<ProductContentTemplate> {
  const response = await authFetch<ApiEnvelope<ProductContentTemplate>>("/products/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function createBrand(payload: BrandMutationPayload): Promise<BrandProvisioningResponse> {
  const response = await authFetch<ApiEnvelope<BrandProvisioningResponse>>("/brands", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function createBrandAccountInvite(
  brandId: string,
  payload?: { contactEmail?: string; fullName?: string },
): Promise<BrandProvisioningResponse> {
  const response = await authFetch<ApiEnvelope<BrandProvisioningResponse>>(`/brands/${brandId}/account`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return response.data;
}

export async function updateBrand(brandId: string, payload: Partial<BrandMutationPayload>): Promise<Brand> {
  const response = await authFetch<ApiEnvelope<Brand>>(`/brands/${brandId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteBrand(brandId: string): Promise<void> {
  await authFetch(`/brands/${brandId}`, { method: "DELETE" });
}

export async function createProduct(payload: ProductMutationPayload): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response.data);
}

export async function getPendingProducts(): Promise<Product[]> {
  const response = await authFetch<ApiEnvelope<Product[]>>("/products/approval/pending", { method: "GET" });
  return response.data.map(normalizeProduct);
}

export async function approveProduct(productId: string, note?: string): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/products/${productId}/approval`, {
    method: "PATCH",
    body: JSON.stringify({ approvalStatus: "APPROVED", note }),
  });
  return normalizeProduct(response.data);
}

export async function rejectProduct(productId: string, note?: string): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/products/${productId}/approval`, {
    method: "PATCH",
    body: JSON.stringify({ approvalStatus: "REJECTED", note }),
  });
  return normalizeProduct(response.data);
}

export async function submitBrandProduct(payload: Omit<ProductMutationPayload, "brandId">): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>("/brand-dashboard/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response.data);
}

export async function updateProduct(productId: string, payload: Partial<ProductMutationPayload>): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response.data);
}

export async function deleteProduct(productId: string): Promise<string | null> {
  const response = await authFetch<{ message?: string } | undefined>(`/products/${productId}`, { method: "DELETE" });
  return response?.message || null;
}

export async function updateUserProfile(payload: { fullName: string; email: string }): Promise<User> {
  const response = await authFetch<ApiEnvelope<User>>("/users/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updatePassword(payload: { currentPassword?: string; newPassword: string }): Promise<void> {
  await authFetch<{ message: string }>("/users/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPaymentMethods(): Promise<UserPaymentMethod[]> {
  const response = await authFetch<ApiEnvelope<UserPaymentMethod[]>>("/users/payment-methods", { method: "GET" });
  return response.data;
}

type PaymentMethodPayload = {
  type: UserPaymentType;
  label: string;
  last4: string;
  expiresMonth?: number;
  expiresYear?: number;
  isDefault?: boolean;
};

export async function addPaymentMethod(payload: PaymentMethodPayload): Promise<UserPaymentMethod> {
  const response = await authFetch<ApiEnvelope<UserPaymentMethod>>("/users/payment-methods", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updatePaymentMethod(methodId: string, payload: Partial<PaymentMethodPayload>): Promise<UserPaymentMethod> {
  const response = await authFetch<ApiEnvelope<UserPaymentMethod>>(`/users/payment-methods/${methodId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function removePaymentMethod(methodId: string): Promise<void> {
  await authFetch(`/users/payment-methods/${methodId}`, { method: "DELETE" });
}

export async function getUserAddresses(): Promise<UserAddress[]> {
  const response = await authFetch<ApiEnvelope<UserAddress[]>>("/users/addresses", { method: "GET" });
  return response.data;
}

export async function addUserAddress(payload: Omit<UserAddress, "id">): Promise<UserAddress> {
  const response = await authFetch<ApiEnvelope<UserAddress>>("/users/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateUserAddress(addressId: string, payload: Partial<Omit<UserAddress, "id">>): Promise<UserAddress> {
  const response = await authFetch<ApiEnvelope<UserAddress>>(`/users/addresses/${addressId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function removeUserAddress(addressId: string): Promise<void> {
  await authFetch(`/users/addresses/${addressId}`, { method: "DELETE" });
}

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const response = await authFetch<ApiEnvelope<NotificationPreference>>("/users/notification-preferences", {
    method: "GET",
  });
  return response.data;
}

export async function updateNotificationPreferences(
  payload: Omit<NotificationPreference, "id" | "userId">,
): Promise<NotificationPreference> {
  const response = await authFetch<ApiEnvelope<NotificationPreference>>("/users/notification-preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getUserNotifications(): Promise<NotificationItem[]> {
  const response = await authFetch<ApiEnvelope<NotificationItem[]>>("/users/notifications", {
    method: "GET",
  });
  return response.data;
}

export async function getUserNotificationsUnreadCount(): Promise<number> {
  const response = await authFetch<ApiEnvelope<{ count: number }>>("/users/notifications/unread-count", {
    method: "GET",
  });
  return response.data.count;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await authFetch(`/users/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await authFetch("/users/notifications/read-all", { method: "PATCH" });
}

export async function registerNotificationDeviceToken(payload: {
  token: string;
  platform?: string;
  userAgent?: string;
}): Promise<void> {
  await authFetch("/users/notification-device-tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBrandDashboardOverview(): Promise<BrandDashboardOverview> {
  const response = await authFetch<ApiEnvelope<BrandDashboardOverview>>("/brand-dashboard/overview", {
    method: "GET",
  });
  return response.data;
}

export async function getBrandDashboardOrders(status?: string): Promise<BrandDashboardOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await authFetch<ApiEnvelope<BrandDashboardOrder[]>>(`/brand-dashboard/orders${query}`, {
    method: "GET",
  });
  return response.data.map(normalizeBrandDashboardOrder);
}

export async function getBrandDashboardOrder(orderId: string): Promise<BrandDashboardOrder> {
  const response = await authFetch<ApiEnvelope<BrandDashboardOrder>>(`/brand-dashboard/orders/${orderId}`, {
    method: "GET",
  });
  return normalizeBrandDashboardOrder(response.data);
}

export async function updateBrandOrderStatus(
  orderId: string,
  payload: { status: string; trackingId?: string; courierName?: string; estimatedDelivery?: string; note?: string; failureReason?: string; failureReasonMessage?: string; nextAttemptDate?: Date },
): Promise<BrandDashboardOrder> {
  const body = {
    status: payload.status,
    trackingId: payload.trackingId,
    courierName: payload.courierName,
    estimatedDelivery: payload.estimatedDelivery,
    note: payload.note,
    failureReason: payload.failureReason,
    failureReasonMessage: payload.failureReasonMessage,
    nextAttemptDate: payload.nextAttemptDate ? payload.nextAttemptDate.toISOString() : undefined,
  };
  const response = await authFetch<ApiEnvelope<BrandDashboardOrder>>(`/brand-dashboard/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeBrandDashboardOrder(response.data);
}

export async function cancelBrandOrder(
  orderId: string,
  payload: { reasonCode: "OUT_OF_STOCK" | "ITEM_DAMAGED"; note?: string; orderItemIds?: string[] },
): Promise<{ success: boolean }> {
  const response = await authFetch<ApiEnvelope<{ success: boolean }>>(`/brand-dashboard/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateAdminOrderStatus(
  orderId: string,
  payload: { status: string; trackingId?: string; note?: string; customerNote?: string; failureReason?: string; nextAttemptDate?: string },
): Promise<BrandDashboardOrder> {
  const response = await authFetch<ApiEnvelope<BrandDashboardOrder>>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getBrandDashboardProducts(): Promise<Product[]> {
  const response = await authFetch<ApiEnvelope<Product[]>>("/brand-dashboard/products", {
    method: "GET",
  });
  return response.data.map(normalizeProduct);
}

export async function uploadBrandProductImages(files: File[]): Promise<string[]> {
  if (!files.length) {
    return [];
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  const response = await authFetch<ApiEnvelope<{ urls: string[] }>>("/brand-dashboard/products/uploads", {
    method: "POST",
    body: formData,
  });

  return response.data.urls;
}

export async function updateBrandDashboardProduct(
  productId: string,
  payload: Partial<Omit<ProductMutationPayload, "brandId">>,
): Promise<Product> {
  const response = await authFetch<ApiEnvelope<Product>>(`/brand-dashboard/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response.data);
}

export async function getBrandDashboardNotifications(): Promise<NotificationItem[]> {
  const response = await authFetch<ApiEnvelope<NotificationItem[]>>("/brand-dashboard/notifications", {
    method: "GET",
  });
  return response.data;
}

export async function getBrandDashboardNotificationsUnreadCount(): Promise<number> {
  const response = await authFetch<ApiEnvelope<{ count: number }>>("/brand-dashboard/notifications/unread-count", {
    method: "GET",
  });
  return response.data.count;
}

export async function getAdminOrder(orderId: string): Promise<UserOrder> {
  const response = await authFetch<ApiEnvelope<UserOrder>>(`/admin/orders/${orderId}`, {
    method: "GET",
  });
  return response.data;
}

export type ReviewMutationPayload = {
  orderItemId: string;
  rating: number;
  content: string;
  imageUrls?: string[];
};

export async function uploadReviewImages(files: File[]): Promise<string[]> {
  if (!files.length) {
    return [];
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  const response = await authFetch<ApiEnvelope<{ urls: string[] }>>("/reviews/uploads", {
    method: "POST",
    body: formData,
  });

  return response.data.urls;
}

export async function getProductReviews(
  productId: string,
  options?: { limit?: number; skip?: number; sort?: "newest" | "rating" | "helpful"; rating?: number },
): Promise<ProductReviewsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.skip) params.set("skip", String(options.skip));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.rating) params.set("rating", String(options.rating));

  const query = params.toString();
  const path = query ? `/reviews/product/${productId}?${query}` : `/reviews/product/${productId}`;
  const response = await safeFetch<ProductReviewsResponse>(path);
  return response;
}

export async function createReview(payload: ReviewMutationPayload): Promise<ProductReview> {
  const response = await authFetch<ApiEnvelope<ProductReview>>("/reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getMyReviews(limit = 20, skip = 0): Promise<ProductReview[]> {
  const response = await authFetch<ApiEnvelope<ProductReview[]>>(`/reviews/me?limit=${limit}&skip=${skip}`, {
    method: "GET",
  });
  return response.data;
}

export async function updateReview(
  reviewId: string,
  payload: Partial<Omit<ReviewMutationPayload, "orderItemId">>,
): Promise<ProductReview> {
  const response = await authFetch<ApiEnvelope<ProductReview>>(`/reviews/item/${reviewId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await authFetch(`/reviews/item/${reviewId}`, {
    method: "DELETE",
  });
}

export async function voteReviewHelpfulness(reviewId: string, isHelpful: boolean): Promise<void> {
  await authFetch(`/reviews/item/${reviewId}/helpfulness`, {
    method: "POST",
    body: JSON.stringify({ isHelpful }),
  });
}

export async function reportReview(reviewId: string, payload: { reason: ReviewReportReason; description?: string }): Promise<ReviewReport> {
  const response = await authFetch<ApiEnvelope<ReviewReport>>(`/reviews/item/${reviewId}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getBrandReviews(limit = 20, skip = 0): Promise<ProductReview[]> {
  const response = await authFetch<ApiEnvelope<ProductReview[]>>(`/reviews/brand?limit=${limit}&skip=${skip}`, {
    method: "GET",
  });
  return response.data;
}

export async function replyToReview(reviewId: string, content: string): Promise<void> {
  await authFetch(`/reviews/item/${reviewId}/reply`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getAdminReviewReports(options?: {
  status?: ReviewReportStatus;
  limit?: number;
  skip?: number;
}): Promise<AdminReviewReportRecord[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.skip) params.set("skip", String(options.skip));
  const query = params.toString();

  const response = await authFetch<ApiEnvelope<AdminReviewReportRecord[]>>(
    query ? `/reviews/admin/reports?${query}` : "/reviews/admin/reports",
    {
      method: "GET",
    },
  );

  return response.data;
}

export async function resolveAdminReviewReport(
  reportId: string,
  payload: { status: ReviewReportStatus; resolutionNote?: string },
): Promise<ReviewReport> {
  const response = await authFetch<ApiEnvelope<ReviewReport>>(`/reviews/admin/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function moderateReview(
  reviewId: string,
  payload: { action: "HIDE" | "UNHIDE" | "FLAG" | "REMOVE"; reason?: string },
): Promise<ProductReview> {
  const response = await authFetch<ApiEnvelope<ProductReview>>(`/reviews/admin/${reviewId}/moderate`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}
