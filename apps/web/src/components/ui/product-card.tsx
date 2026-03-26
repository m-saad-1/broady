"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { addWishlistProduct, removeWishlistProduct } from "@/lib/api";
import { getProductPricing } from "@/lib/pricing";
import { formatPkr } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useToastStore } from "@/stores/toast-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types/marketplace";
import { Button } from "./button";
import { Card } from "./card";
import { ConfirmModal } from "./confirm-modal";

export function ProductCard({ product }: { product: Product }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addToCart);
  const pushToast = useToastStore((state) => state.pushToast);
  const addWishlistLocal = useWishlistStore((state) => state.addItem);
  const removeWishlistLocal = useWishlistStore((state) => state.removeItem);
  const toggleWishlistLocal = useWishlistStore((state) => state.toggleWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(product.id));
  const pricing = getProductPricing(product);
  const badge = pricing.hasDiscount
    ? `-${pricing.discountPercentage}%`
    : product.badge || (product.stock <= 0 ? "Out of Stock" : product.pricePkr < 3000 ? "Sale" : "New");
  const canAdd = product.stock > 0;
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

  return (
    <Card className="group overflow-hidden">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] bg-zinc-100">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <span className={`absolute left-2 top-2 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>
            {badge}
          </span>
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{product.brand?.name || "Brand"}</p>
          <Link href={`/product/${product.slug}`} className="mt-1 block font-medium uppercase tracking-[0.08em]">
            {product.name}
          </Link>
          {pricing.hasDiscount ? (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-sm font-semibold text-black">{formatPkr(pricing.finalPrice)}</p>
              <p className="text-xs text-zinc-500 line-through">{formatPkr(pricing.basePrice)}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">{formatPkr(pricing.basePrice)}</p>
          )}
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">{product.topCategory} / {product.productType || "Top"} / {product.subCategory}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (isInWishlist) {
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
            {isInWishlist ? "Saved" : "Wishlist"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              addToCart(product, { selectedColor: defaultColor, selectedSize: defaultSize });
              pushToast("Added to cart", "success");
            }}
            disabled={!canAdd}
          >
            {canAdd ? "Add" : "Stock"}
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
