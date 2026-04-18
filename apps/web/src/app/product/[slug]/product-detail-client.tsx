"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { addWishlistProduct, removeWishlistProduct } from "@/lib/api";
import { getProductPricing } from "@/lib/pricing";
import { formatPkr } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useToastStore } from "@/stores/toast-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types/marketplace";

type Props = {
  product: Product;
};

export function ProductDetailClient({ product }: Props) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || "");
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] || "Black");
  const [openPanel, setOpenPanel] = useState<"sizeGuide" | "deliveriesReturns" | "shippingDelivery" | "fabricCare" | null>("sizeGuide");
  const [zoomOpen, setZoomOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addToCart);
  const pushToast = useToastStore((state) => state.pushToast);
  const addWishlistLocal = useWishlistStore((state) => state.addItem);
  const removeWishlistLocal = useWishlistStore((state) => state.removeItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(product.id));
  const wishlistActive = hasHydrated ? isInWishlist : false;
  const pricing = getProductPricing(product);

  const getStockColor = () => {
    if (product.stock === 0) return "bg-red-100 border-red-300";
    if (product.stock <= 5) return "bg-amber-100 border-amber-300";
    if (product.stock <= 15) return "bg-yellow-100 border-yellow-300";
    return "bg-emerald-100 border-emerald-300";
  };

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const badge = useMemo(() => {
    if (pricing.hasDiscount) return `-${pricing.discountPercentage}%`;
    if (product.badge) return product.badge;
    if (product.stock <= 0) return "Out of Stock";
    if (product.pricePkr < 3000) return "Sale";
    return "New";
  }, [pricing.discountPercentage, pricing.hasDiscount, product.badge, product.pricePkr, product.stock]);

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

  const canAdd = product.stock > 0;

  return (
    <section className="grid gap-6 md:grid-cols-12">
      <div className="space-y-3 md:col-span-7">
        <button
          type="button"
          className="relative block aspect-[4/5] w-full overflow-hidden border border-zinc-300"
          onClick={() => setZoomOpen(true)}
          title="Click to zoom"
          aria-label="Zoom product image"
        >
          <ProductImage src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" priority />
          <span className="absolute bottom-3 right-3 border border-black bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            Zoom
          </span>
        </button>
      </div>

      <div className="space-y-5 border border-zinc-300 p-6 md:col-span-5">
        <div className="flex items-center justify-between gap-3">
          <Link href={product.brand?.slug ? `/brand/${product.brand.slug}` : "/brands"} className="text-xs uppercase tracking-[0.14em] text-zinc-500 hover:text-black">
            {product.brand?.name || "Verified Brand"}
          </Link>
          <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>{badge}</span>
        </div>

        <h1 className="font-heading text-5xl uppercase leading-[0.95]">{product.name}</h1>
        {pricing.hasDiscount ? (
          <div className="flex items-center gap-3">
            <p className="text-lg font-semibold">{formatPkr(pricing.finalPrice)}</p>
            <p className="text-sm text-zinc-500 line-through">{formatPkr(pricing.basePrice)}</p>
          </div>
        ) : (
          <p className="text-lg">{formatPkr(pricing.basePrice)}</p>
        )}
        <p className="text-sm leading-7 text-zinc-700">{product.descriptionLong || product.description}</p>

        <div className={`border p-3 text-xs uppercase tracking-[0.12em] ${getStockColor()}`}>
          <div className="flex items-center justify-between">
            <span>Stock: {product.stock > 0 ? `${product.stock} available` : "Out of stock"}</span>
            <span>{product.topCategory} / {product.subCategory}</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Size</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`border px-3 py-2 text-xs uppercase tracking-[0.12em] ${selectedSize === size ? "border-black bg-black text-white" : "border-zinc-300 bg-white"}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Color</p>
          <div className="flex flex-wrap gap-2">
            {(product.colors || ["Black", "White"]).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`border px-3 py-2 text-xs uppercase tracking-[0.12em] ${selectedColor === color ? "border-black bg-black text-white" : "border-zinc-300 bg-white"}`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canAdd}
            className="h-11 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              addToCart(product, { selectedColor, selectedSize });
              pushToast("Added to cart", "success");
            }}
          >
            {canAdd ? "Add to Cart" : "Out of Stock"}
          </button>
          <button
            type="button"
            className="h-11 border border-black px-4 text-xs font-semibold uppercase tracking-[0.14em]"
            onClick={async () => {
              if (wishlistActive) {
                if (user) {
                  try {
                    await removeWishlistProduct(product.id);
                  } catch {
                    // Keep local state responsive even if remote remove fails.
                  }
                  removeWishlistLocal(product.id);
                } else {
                  toggleWishlist(product);
                }
                pushToast("Removed from wishlist", "info");
                return;
              }

              if (user) {
                try {
                  await addWishlistProduct(product.id);
                  addWishlistLocal(product);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Failed to save wishlist item";
                  if (message.toLowerCase().includes("product not found")) {
                    addWishlistLocal(product);
                  } else {
                    pushToast(message, "error");
                    return;
                  }
                }
              } else {
                toggleWishlist(product);
              }
              pushToast("Added to wishlist", "success");
            }}
          >
            {wishlistActive ? "Saved" : "Wishlist"}
          </button>
        </div>

        <section className="space-y-3 p-0">
          {[
            {
              key: "sizeGuide" as const,
              title: "Size Guide",
              content: product.sizeGuide?.entries?.length ? (
                <div className="space-y-3">
                  {product.sizeGuide.imageUrl ? (
                    <div className="relative h-48 overflow-hidden border border-zinc-200">
                      <ProductImage src={product.sizeGuide.imageUrl} alt={`${product.name} size chart`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 40vw" />
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-zinc-200 text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-left uppercase tracking-[0.12em] text-zinc-600">
                          <th className="border border-zinc-200 px-2 py-2">Size</th>
                          <th className="border border-zinc-200 px-2 py-2">CM</th>
                          <th className="border border-zinc-200 px-2 py-2">Inches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.sizeGuide.entries.map((entry) => (
                          <tr key={`size-guide-${entry.size}-${entry.cm}-${entry.inches}`}>
                            <td className="border border-zinc-200 px-2 py-2">{entry.size}</td>
                            <td className="border border-zinc-200 px-2 py-2">{entry.cm}</td>
                            <td className="border border-zinc-200 px-2 py-2">{entry.inches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Size guide will be updated soon.</p>
              ),
            },
            {
              key: "deliveriesReturns" as const,
              title: "Deliveries & Returns",
              content: product.deliveriesReturns ? (
                <div className="space-y-2 text-sm text-zinc-700">
                  <p><span className="font-semibold">Delivery Time:</span> {product.deliveriesReturns.deliveryTime}</p>
                  <p><span className="font-semibold">Return Policy:</span> {product.deliveriesReturns.returnPolicy}</p>
                  <p><span className="font-semibold">Refund Conditions:</span> {product.deliveriesReturns.refundConditions}</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Delivery and return policy will be updated soon.</p>
              ),
            },
            {
              key: "shippingDelivery" as const,
              title: "Shipping & Delivery",
              content: product.shippingDelivery ? (
                <div className="space-y-2 text-sm text-zinc-700">
                  <p><span className="font-semibold">Estimated Delivery:</span> {product.shippingDelivery.estimatedDeliveryTime}</p>
                  <p><span className="font-semibold">Regions:</span> {product.shippingDelivery.regions.join(", ")}</p>
                  {product.shippingDelivery.charges ? <p><span className="font-semibold">Charges:</span> {product.shippingDelivery.charges}</p> : null}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Shipping details will be updated soon.</p>
              ),
            },
            {
              key: "fabricCare" as const,
              title: "Fabric & Care",
              content: product.fabricCare ? (
                <div className="space-y-2 text-sm text-zinc-700">
                  <p><span className="font-semibold">Fabric:</span> {product.fabricCare.fabricType}</p>
                  <div>
                    <p className="font-semibold">Care Instructions:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {product.fabricCare.careInstructions.map((instruction) => (
                        <li key={`care-${instruction}`}>{instruction}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Fabric and care details will be updated soon.</p>
              ),
            },
          ].map((panel) => {
            const isOpen = openPanel === panel.key;

            return (
              <article key={panel.key} className="w-full border border-zinc-300">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black hover:text-white"
                  onClick={() => setOpenPanel((current) => (current === panel.key ? null : panel.key))}
                >
                  <span>{panel.title}</span>
                  <span>{isOpen ? "-" : "+"}</span>
                </button>
                {isOpen ? <div className="w-full px-4 py-3">{panel.content}</div> : null}
              </article>
            );
          })}
        </section>
      </div>

      {zoomOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoomOpen(false)}>
          <div className="relative h-[85vh] w-full max-w-4xl border border-zinc-300 bg-white" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="absolute right-3 top-3 z-10 border border-black bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]"
              onClick={() => setZoomOpen(false)}
            >
              Close
            </button>
            <ProductImage src={product.imageUrl} alt={`${product.name} zoomed`} fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
