import { fallbackBrands, fallbackProducts } from "./mock-data";
import { useMockFallback } from "./runtime-flags";
import { normalizeProduct } from "@/lib/taxonomy";
import type {
  Brand,
  BrandWithProducts,
  NotificationPreference,
  Product,
  UserPaymentMethod,
  UserPaymentType,
} from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type ApiEnvelope<T> = { data: T };

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
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 60 },
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
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const json = (await response.json()) as { message?: string };
      if (json.message) {
        message = json.message;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
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
  try {
    const products = await safeFetch<Product[]>(`/products${query}`);
    const mergedProducts = mergeProductsWithFallback(products);
    if (mergedProducts.length) {
      return mergedProducts;
    }
    return fallbackProducts.map(normalizeProduct);
  } catch {
    return fallbackProducts.map(normalizeProduct);
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

type WishlistEnvelope = { data: Array<{ product: Product }> };

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

export async function getAdminBrands(): Promise<Brand[]> {
  const response = await authFetch<ApiEnvelope<Brand[]>>("/brands", { method: "GET" });
  return response.data;
}

export async function getAdminProducts(): Promise<Product[]> {
  const response = await authFetch<ApiEnvelope<Product[]>>("/products", { method: "GET" });
  return response.data.map(normalizeProduct);
}

type BrandMutationPayload = {
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  verified?: boolean;
};

type ProductMutationPayload = {
  brandId: string;
  name: string;
  slug: string;
  description: string;
  pricePkr: number;
  topCategory: "Men" | "Women" | "Kids";
  subCategory: string;
  sizes: string[];
  imageUrl: string;
  stock: number;
  isActive?: boolean;
};

export async function createBrand(payload: BrandMutationPayload): Promise<Brand> {
  const response = await authFetch<ApiEnvelope<Brand>>("/brands", {
    method: "POST",
    body: JSON.stringify(payload),
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
