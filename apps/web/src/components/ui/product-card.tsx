"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addWishlistProduct, removeWishlistProduct } from "@/lib/api";
import { getProductPricing } from "@/lib/pricing";
import { getProductDisplayCategory } from "@/lib/taxonomy";
import { formatPkr } from "@/lib/utils";
import { useStableNow } from "@/hooks/use-stable-now";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useToastStore } from "@/stores/toast-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types/marketplace";
import { Button } from "./button";
import { Card } from "./card";
import { ConfirmModal } from "./confirm-modal";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: Product }) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addToCart);
  const pushToast = useToastStore((state) => state.pushToast);
  const addWishlistLocal = useWishlistStore((state) => state.addItem);
  const removeWishlistLocal = useWishlistStore((state) => state.removeItem);
  const toggleWishlistLocal = useWishlistStore((state) => state.toggleWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(product.id));
  const wishlistActive = hasHydrated ? isInWishlist : false;
  const renderNow = useStableNow();
  const pricing = useMemo(() => getProductPricing(product, renderNow), [product, renderNow]);
  const badge = pricing.hasDiscount
    ? `-${pricing.discountPercentage}%`
    : product.badge || (product.stock <= 0 ? "Out of Stock" : product.pricePkr < 3000 ? "Sale" : "New");
  const canAdd = product.stock > 0;
  const reviewCountRaw = (product as Product & { reviewCount?: number; totalReviews?: number }).reviewCount;
  const reviewCount =
    typeof reviewCountRaw === "number"
      ? reviewCountRaw
      : (product as Product & { reviewCount?: number; totalReviews?: number }).totalReviews || 0;
  const defaultSize = product.sizes[0] || "One Size";
  const defaultColor = product.colors?.[0] || "Black";
  const badgeClass =
    pricing.hasDiscount
      ? "border-rose-700 bg-rose-600 text-white"
      : badge === "Sale"
      ? "border-red-700 bg-red-600 text-white"
      : badge === "New"
        ? "border-emerald-700 bg-emerald-600 text-white"
        : badge === "Limited"
          ? "border-amber-700 bg-amber-500 text-black"
          : "border-zinc-700 bg-zinc-800 text-white";

  // Remove brand name from product title
  const stripBrandPrefix = (title: string, brandName?: string) => {
    if (!brandName) return title;
    const escapedBrand = brandName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cleaned = title.replace(new RegExp(`^${escapedBrand}(?:\\s|:|-)+?`, "i"), "").trim();
    return cleaned || title;
  };

  const displayTitle = stripBrandPrefix(product.name, product.brand?.name);
  const soldCount = product.soldCount || 0;

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return (
    <Card className="group overflow-hidden">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] bg-zinc-100">
          <ProductImage
            src={product.imageUrl}
            alt={displayTitle}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <span className={`absolute left-2 top-2 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>
            {badge}
          </span>
        </div>
      </Link>
      <div className="space-y-2 p-3">
        <div className="space-y-0.5 leading-snug">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{product.brand?.name || "Brand"}</p>
          <Link href={`/product/${product.slug}`} className="block text-sm font-medium uppercase tracking-[0.05em] truncate" title={displayTitle}>
            {displayTitle}
          </Link>
          <div className="mt-1 pb-1 flex items-center justify-between">
            {pricing.hasDiscount ? (
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-black">{formatPkr(pricing.finalPrice)}</p>
                <p className="text-xs text-zinc-500 line-through">{formatPkr(pricing.basePrice)}</p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-zinc-800">{formatPkr(pricing.basePrice)}</p>
            )}
            <p className="text-[11px] font-semibold text-zinc-800">{soldCount} Sold</p>
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-zinc-500">
            <p>{getProductDisplayCategory(product)}</p>
            {reviewCount > 0 ? <p>{reviewCount} reviews</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="col-span-3 px-0"
            aria-label={wishlistActive ? "Remove from wishlist" : "Add to wishlist"}
            onClick={async () => {
              if (wishlistActive) {
                setConfirmOpen(true);
                return;
              }

              if (user) {
                try {
                  await addWishlistProduct(product.id);
                  addWishlistLocal(product);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Failed to save wishlist item";
                  // Mock products have fallback IDs that may not exist in DB yet; keep UX working locally.
                  if (message.toLowerCase().includes("product not found")) {
                    addWishlistLocal(product);
                    pushToast("Saved locally (mock item)", "info");
                  } else {
                    pushToast(message, "error");
                    return;
                  }
                }
              } else {
                toggleWishlistLocal(product);
              }

              pushToast("Added to wishlist", "success");
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill={wishlistActive ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12.001 20.56c-.311 0-.621-.11-.867-.33-3.446-3.073-5.568-5.036-7.039-6.715C2.62 11.856 2 10.389 2 8.853 2 6.174 4.14 4 6.781 4c1.527 0 3.004.69 4.001 1.87C11.779 4.69 13.257 4 14.783 4 17.424 4 19.565 6.174 19.565 8.853c0 1.536-.621 3.003-2.095 4.662-1.47 1.679-3.591 3.642-7.037 6.715-.247.22-.557.33-.868.33z"
              />
            </svg>
          </Button>
          <Button
            size="sm"
            className="col-span-9 border-zinc-900 bg-zinc-900 text-white hover:bg-black"
            onClick={() => {
              addToCart(product, { selectedColor: defaultColor, selectedSize: defaultSize });
              pushToast("Added to cart", "success");
            }}
            disabled={!canAdd}
          >
            {canAdd ? "Add to Cart" : "Out of Stock"}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Remove From Wishlist"
        description="Are you sure you want to remove this item from your wishlist?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          const remove = async () => {
            if (user) {
              try {
                await removeWishlistProduct(product.id);
                removeWishlistLocal(product.id);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to remove wishlist item";
                // Item might exist only in local fallback wishlist.
                removeWishlistLocal(product.id);
                if (!message.toLowerCase().includes("product not found")) {
                  pushToast(message, "error");
                }
              }
            } else {
              toggleWishlistLocal(product);
            }

            pushToast("Removed from wishlist", "info");
            setConfirmOpen(false);
          };

          void remove();
        }}
      />
    </Card>
  );
}
