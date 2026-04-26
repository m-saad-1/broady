import { createHash } from "node:crypto";
import type { Brand, Product } from "@prisma/client";
import { getRedisClient } from "../../config/redis.js";

type CacheableProduct = Product & { brand?: Brand | null };

type ProductQueryFilters = {
  brand?: string;
  topCategory?: string;
  productType?: string;
  subCategory?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
};

type ListCacheValue<T> = T;

const PRODUCT_DETAIL_TTL_MS = 10 * 60 * 1000;
const PRODUCT_LIST_TTL_MS = 2 * 60 * 1000;
const PRODUCT_VERSION_KEY = "products:version";
const LOCAL_LOCK_TTL_MS = 10_000;

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

function normalizeString(value?: string) {
  return value?.trim() || undefined;
}

function buildListKey(prefix: string, filters: ProductQueryFilters, version: string) {
  const normalized = {
    brand: normalizeString(filters.brand),
    topCategory: normalizeString(filters.topCategory),
    productType: normalizeString(filters.productType),
    subCategory: normalizeString(filters.subCategory),
    size: normalizeString(filters.size),
    minPrice: typeof filters.minPrice === "number" ? filters.minPrice : undefined,
    maxPrice: typeof filters.maxPrice === "number" ? filters.maxPrice : undefined,
    q: normalizeString(filters.q),
  };

  return `${prefix}:${version}:${stableHash(normalized)}`;
}

class ProductCacheService {
  private inFlight = new Map<string, Promise<unknown>>();

  private get client() {
    return getRedisClient();
  }

  private async readJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn("[cache] read failed", { key, message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async writeJson<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "PX", ttlMs);
    } catch (error) {
      console.warn("[cache] write failed", { key, message: error instanceof Error ? error.message : String(error) });
    }
  }

  private async deleteKeys(keys: string[]): Promise<void> {
    if (!keys.length) return;

    try {
      await this.client.del(...keys);
    } catch (error) {
      console.warn("[cache] delete failed", { keys, message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getVersion(): Promise<string> {
    try {
      const version = await this.client.get(PRODUCT_VERSION_KEY);
      return version || "0";
    } catch {
      return "0";
    }
  }

  async bumpVersion(): Promise<void> {
    try {
      await this.client.incr(PRODUCT_VERSION_KEY);
    } catch (error) {
      console.warn("[cache] version bump failed", { message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.readJson<T>(key);
    if (cached !== null) {
      console.info("[cache] hit", { key });
      return cached;
    }

    console.info("[cache] miss", { key });

    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const lockKey = `${key}:lock`;
    const promise = (async () => {
      const lockToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const gotLock = await this.client.set(lockKey, lockToken, "PX", LOCAL_LOCK_TTL_MS, "NX");

      if (!gotLock) {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const retryCached = await this.readJson<T>(key);
          if (retryCached !== null) return retryCached;
        }
      }

      try {
        const fresh = await loader();
        await this.writeJson(key, fresh, ttlMs);
        return fresh;
      } finally {
        const currentLock = await this.client.get(lockKey);
        if (currentLock === lockToken) {
          await this.client.del(lockKey);
        }
      }
    })();

    this.inFlight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  buildListCacheKey(filters: ProductQueryFilters): Promise<string> {
    return this.getVersion().then((version) => buildListKey("products:filter", filters, version));
  }

  buildSearchCacheKey(filters: ProductQueryFilters): Promise<string> {
    return this.getVersion().then((version) => buildListKey("products:search", filters, version));
  }

  async getProductById(id: string): Promise<CacheableProduct | null> {
    return this.readJson<CacheableProduct>(`product:${id}`);
  }

  async getProductBySlug(slug: string): Promise<CacheableProduct | null> {
    return this.readJson<CacheableProduct>(`product:slug:${slug}`);
  }

  async setProduct(product: CacheableProduct): Promise<void> {
    await Promise.all([
      this.writeJson(`product:${product.id}`, product, PRODUCT_DETAIL_TTL_MS),
      this.writeJson(`product:slug:${product.slug}`, product, PRODUCT_DETAIL_TTL_MS),
    ]);
  }

  async warmProducts(products: CacheableProduct[]): Promise<void> {
    await Promise.all(products.slice(0, 15).map((product) => this.setProduct(product)));
  }

  async cacheList<T>(key: string, loader: () => Promise<ListCacheValue<T>>, ttlMs = PRODUCT_LIST_TTL_MS): Promise<T> {
    return this.getOrSet<T>(key, ttlMs, loader);
  }

  async invalidateProduct(productId: string, slug?: string): Promise<void> {
    await Promise.all([
      this.deleteKeys([`product:${productId}`]),
      slug ? this.deleteKeys([`product:slug:${slug}`]) : Promise.resolve(),
      this.bumpVersion(),
    ]);
  }

  async invalidateProductLists(): Promise<void> {
    await this.bumpVersion();
  }
}

export const productCache = new ProductCacheService();
