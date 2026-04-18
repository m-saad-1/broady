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
  UserOrder,
  UserPaymentMethod,
  UserPaymentType,
} from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type ApiEnvelope<T> = { data: T };
type ApiErrorBody = { message?: string; code?: string };

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

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = getStoredAuthToken();
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
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
  options?: { topCategory?: string },
): Promise<{ suggestions: SearchSuggestion[]; correctedQuery?: string }> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return { suggestions: [] };
  }

  const params = new URLSearchParams({ q: normalized });
  if (options?.topCategory) {
    params.set("topCategory", options.topCategory);
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
  items: Array<{ productId: string; quantity: number }>;
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

export async function cancelUserOrder(orderId: string, note?: string): Promise<UserOrder> {
  const response = await authFetch<ApiEnvelope<UserOrder>>(`/orders/me/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  });
  return response.data;
}

export async function getAdminBrands(): Promise<Brand[]> {
  const response = await authFetch<ApiEnvelope<Brand[]>>("/brands", { method: "GET" });
  return response.data;
}

export async function getAdminProducts(): Promise<Product[]> {
  const response = await authFetch<ApiEnvelope<Product[]>>("/products/admin", { method: "GET" });
  return response.data.map(normalizeProduct);
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
  description: string;
  pricePkr: number;
  topCategory: "Men" | "Women" | "Kids";
  subCategory: string;
  sizes: string[];
  imageUrl: string;
  sizeGuideTemplateId?: string;
  sizeGuide: ProductSizeGuide;
  deliveriesReturnsTemplateId?: string;
  deliveriesReturns: ProductDeliveriesReturns;
  shippingDeliveryTemplateId?: string;
  shippingDelivery: ProductShippingDelivery;
  fabricCareTemplateId?: string;
  fabricCare: ProductFabricCare;
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

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await authFetch(`/users/notifications/${notificationId}/read`, { method: "PATCH" });
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
  return response.data;
}

export async function getBrandDashboardOrder(orderId: string): Promise<BrandDashboardOrder> {
  const response = await authFetch<ApiEnvelope<BrandDashboardOrder>>(`/brand-dashboard/orders/${orderId}`, {
    method: "GET",
  });
  return response.data;
}

export async function updateBrandOrderStatus(
  orderId: string,
  payload: { status: string; trackingId?: string; note?: string; customerNote?: string },
): Promise<BrandDashboardOrder> {
  const response = await authFetch<ApiEnvelope<BrandDashboardOrder>>(`/brand-dashboard/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateAdminOrderStatus(
  orderId: string,
  payload: { status: string; trackingId?: string; note?: string; customerNote?: string },
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

export async function updateBrandDashboardProduct(
  productId: string,
  payload: Partial<
    Pick<
      Product,
      | "name"
      | "slug"
      | "description"
      | "pricePkr"
      | "topCategory"
      | "subCategory"
      | "sizes"
      | "stock"
      | "isActive"
      | "imageUrl"
      | "sizeGuideTemplateId"
      | "sizeGuide"
      | "deliveriesReturnsTemplateId"
      | "deliveriesReturns"
      | "shippingDeliveryTemplateId"
      | "shippingDelivery"
      | "fabricCareTemplateId"
      | "fabricCare"
    >
  >,
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
