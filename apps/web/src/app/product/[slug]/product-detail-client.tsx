"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getProductPricing } from "@/lib/pricing";
import { formatPkr } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useToastStore } from "@/stores/toast-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types/marketplace";

type Props = {
  product: Product;
};

function DetailAccordion({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="border border-zinc-300">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em]"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <span>{open ? "-" : "+"}</span>
      </button>
      {open ? <p className="border-t border-zinc-300 px-4 py-3 text-sm leading-7 text-zinc-700">{content}</p> : null}
    </article>
  );
}

export function ProductDetailClient({ product }: Props) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || "");
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] || "Black");
  const [zoomOpen, setZoomOpen] = useState(false);

  const addToCart = useCartStore((state) => state.addToCart);
  const pushToast = useToastStore((state) => state.pushToast);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(product.id));
  const pricing = getProductPricing(product);

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
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" priority />
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
            {canAdd ? `Add to Cart (${selectedSize}, ${selectedColor})` : "Out of Stock"}
          </button>
          <button
            type="button"
            className="h-11 border border-black px-4 text-xs font-semibold uppercase tracking-[0.14em]"
            onClick={() => {
              const action = isInWishlist ? "Removed from wishlist" : "Added to wishlist";
              toggleWishlist(product);
              pushToast(action, isInWishlist ? "info" : "success");
            }}
          >
            {isInWishlist ? "Saved" : "Wishlist"}
          </button>
        </div>

        <div className="space-y-2">
          <DetailAccordion title="Size Guide" content="Fits true to size. For an oversized look, size up by one. Full chest and length chart available in future release." />
          <DetailAccordion title="Shipping & Delivery" content="Karachi, Lahore, Islamabad: 2-3 business days. Other cities: 3-5 business days. Free shipping above PKR 7,500." />
          <DetailAccordion title="Returns & Exchange" content="7-day return and exchange window for unworn items with tags and original packaging." />
          <DetailAccordion title="Fabric & Care" content="Premium blended fabric. Machine wash cold on gentle cycle. Do not bleach. Iron inside out at low heat." />
        </div>
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
            <Image src={product.imageUrl} alt={`${product.name} zoomed`} fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
