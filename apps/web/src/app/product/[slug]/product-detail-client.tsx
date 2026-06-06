"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { addWishlistProduct, removeWishlistProduct, trackUserBehaviorEvent } from "@/lib/api";
import { getProductPricing } from "@/lib/pricing";
import { formatPkr } from "@/lib/utils";
import { useStableNow } from "@/hooks/use-stable-now";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useToastStore } from "@/stores/toast-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types/marketplace";

type Props = {
  product: Product;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueLines(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!hasText(value)) continue;
    for (const line of value.split(/\n|;/).map((entry) => entry.trim()).filter(Boolean)) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(line);
    }
  }
  return result;
}

export function ProductDetailClient({ product }: Props) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedColor, setSelectedColor] = useState(product.color || "");
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const galleryImages = useMemo(() => {
    const urls = (product.images || [])
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((image) => image.cdnUrl || image.url || image.sourceUrl || "")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const all = [product.imageUrl, ...urls].map((entry) => (entry || "").trim()).filter(Boolean);
    const unique: string[] = [];
    for (const image of all) {
      if (!unique.some((existing) => existing.toLowerCase() === image.toLowerCase())) {
        unique.push(image);
      }
    }
    return unique;
  }, [product.imageUrl, product.images]);
  const [activeImage, setActiveImage] = useState(galleryImages[0] || product.imageUrl);
  const sizeAvailability = useMemo(() => {
    const availability = new Map<string, boolean>();
    const variants = product.variants || [];

    for (const size of product.sizes) {
      const matchingVariants = variants.filter((variant) => (variant.size || "").toLowerCase() === size.toLowerCase());
      const available = matchingVariants.length
        ? matchingVariants.some((variant) => variant.isActive !== false && String(variant.stockStatus || "").toLowerCase() !== "out_of_stock")
        : product.stock > 0;
      availability.set(size, available);
    }

    return availability;
  }, [product.sizes, product.stock, product.variants]);
  const firstAvailableSize = useMemo(
    () => product.sizes.find((size) => sizeAvailability.get(size)) || "",
    [product.sizes, sizeAvailability],
  );
  const [selectedSize, setSelectedSize] = useState(firstAvailableSize);

  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addToCart);
  const pushToast = useToastStore((state) => state.pushToast);
  const addWishlistLocal = useWishlistStore((state) => state.addItem);
  const removeWishlistLocal = useWishlistStore((state) => state.removeItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(product.id));
  const wishlistActive = hasHydrated ? isInWishlist : false;
  const renderNow = useStableNow();
  const pricing = useMemo(() => getProductPricing(product, renderNow), [product, renderNow]);
  const availableColors = useMemo(() => {
    const fromArray = Array.isArray(product.colors) ? product.colors : [];
    const fromColor = product.color
      ? product.color
          .split(/,|\/|\|/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
    return Array.from(new Set([...fromArray, ...fromColor].map((entry) => entry.toLowerCase())))
      .map((normalized) => [...fromArray, ...fromColor].find((entry) => entry.toLowerCase() === normalized) || normalized)
      .filter(Boolean);
  }, [product.color, product.colors]);

  const estimatedDeliveryTime = useMemo(() => {
    const direct = uniqueLines([
      product.shippingDelivery?.estimatedDeliveryTime,
      product.shipping?.deliveryText,
      product.deliveriesReturns?.deliveryTime,
      product.detail?.shippingDelivery,
    ])[0];
    if (direct) return direct;
    if (product.shipping?.estimatedDeliveryMinDays != null && product.shipping?.estimatedDeliveryMaxDays != null) {
      return `Delivered in ${product.shipping.estimatedDeliveryMinDays}-${product.shipping.estimatedDeliveryMaxDays} working days`;
    }
    if (product.shipping?.estimatedDeliveryMaxDays != null) {
      return `Delivered within ${product.shipping.estimatedDeliveryMaxDays} working days`;
    }
    return "";
  }, [product]);

  const detailPanels = useMemo(() => {
    const panels: Array<{ key: string; title: string; content: ReactNode }> = [];

    const sizeGuideImageUrl = product.sizeGuide?.imageUrl || product.detail?.sizeGuideImageUrl || undefined;
    const sizeGuideTextDetails = product.detail?.sizeGuideText ? [product.detail.sizeGuideText] : [];
    const hasSizeGuideEntries = Boolean(product.sizeGuide?.entries?.length);
    const hasSizeGuideImage = Boolean(sizeGuideImageUrl);
    const hasSizeGuideDetails = Boolean(product.sizeGuide?.details?.length || sizeGuideTextDetails.length);
    if (hasSizeGuideEntries || hasSizeGuideImage || hasSizeGuideDetails) {
      panels.push({
        key: "sizeGuide",
        title: "Size Guide",
        content: (
          <div className="space-y-3">
            {sizeGuideImageUrl ? (
              <div className="relative h-48 overflow-hidden border border-zinc-200">
                <ProductImage src={sizeGuideImageUrl} alt={`${product.name} size chart`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 40vw" />
              </div>
            ) : null}
            {product.sizeGuide?.entries?.length ? (
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
            ) : null}
            {product.sizeGuide?.details?.length || sizeGuideTextDetails.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {[...(product.sizeGuide?.details || []), ...sizeGuideTextDetails].map((detail) => (
                  <li key={`size-guide-detail-${detail}`}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ),
      });
    }

    const returnLines = uniqueLines([
      product.deliveriesReturns?.returnPolicy,
      product.deliveriesReturns?.refundConditions,
      product.detail?.returnExchangePolicy,
      product.shipping?.returnWindowDays != null ? `Return window: ${product.shipping.returnWindowDays} days` : undefined,
      product.shipping?.exchangeWindowDays != null ? `Exchange window: ${product.shipping.exchangeWindowDays} days` : undefined,
    ]);
    if (returnLines.length) {
      panels.push({
        key: "returnExchange",
        title: "Return & Exchange",
        content: (
          <div className="space-y-2 text-sm text-zinc-700">
            {returnLines.map((line) => <p key={`return-${line}`}>{line}</p>)}
          </div>
        ),
      });
    }

    if (
      (product.shippingDelivery && (product.shippingDelivery.estimatedDeliveryTime || product.shippingDelivery.regions?.length || product.shippingDelivery.charges)) ||
      (product.shipping && (product.shipping.deliveryText || product.shipping.shippingFee != null)) ||
      hasText(product.detail?.shippingDelivery) ||
      hasText(product.deliveriesReturns?.deliveryTime)
    ) {
      panels.push({
        key: "shippingDelivery",
        title: "Shipping & Delivery",
        content: (
          <div className="space-y-2 text-sm text-zinc-700">
            {product.shippingDelivery?.estimatedDeliveryTime ? <p><span className="font-semibold">Estimated Delivery:</span> {product.shippingDelivery.estimatedDeliveryTime}</p> : null}
            {product.shippingDelivery?.regions?.length ? <p><span className="font-semibold">Regions:</span> {product.shippingDelivery.regions.join(", ")}</p> : null}
            {product.shippingDelivery?.charges ? <p><span className="font-semibold">Charges:</span> {product.shippingDelivery.charges}</p> : null}
            {product.shipping?.deliveryText ? <p><span className="font-semibold">Delivery:</span> {product.shipping.deliveryText}</p> : null}
            {product.detail?.shippingDelivery ? <p><span className="font-semibold">Shipping:</span> {product.detail.shippingDelivery}</p> : null}
            {product.deliveriesReturns?.deliveryTime ? <p><span className="font-semibold">Delivery Time:</span> {product.deliveriesReturns.deliveryTime}</p> : null}
            {product.shipping?.shippingFee != null ? <p><span className="font-semibold">Shipping Fee:</span> {formatPkr(product.shipping.shippingFee)}</p> : null}
          </div>
        ),
      });
    }

    const fabricLines = uniqueLines([product.fabricCare?.fabricType, product.detail?.fabricComposition]);
    const careLines = uniqueLines([...(product.fabricCare?.careInstructions || []), product.detail?.careGuide]);
    if (fabricLines.length || careLines.length) {
      panels.push({
        key: "fabricCare",
        title: "Fabric & Care",
        content: (
          <div className="space-y-2 text-sm text-zinc-700">
            {fabricLines.length ? (
              <div>
                <p className="font-semibold">Fabric:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {fabricLines.map((line) => <li key={`fabric-${line}`}>{line}</li>)}
                </ul>
              </div>
            ) : null}
            {careLines.length ? (
              <div>
                <p className="font-semibold">Care Instructions:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {careLines.map((instruction) => (
                    <li key={`care-${instruction}`}>{instruction}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ),
      });
    }

    if (hasText(product.detail?.modelDetails)) {
      panels.push({
        key: "modelDetails",
        title: "Model Details",
        content: <p className="text-sm text-zinc-700">{product.detail.modelDetails}</p>,
      });
    }

    if (hasText(product.detail?.disclaimer)) {
      panels.push({
        key: "disclaimer",
        title: "Disclaimer",
        content: <p className="text-sm text-zinc-700">{product.detail.disclaimer}</p>,
      });
    }

    const structuredDetails = [
      ["Material Details", product.detail?.materialDetails],
      ["Origin", product.detail?.origin],
      ["Package Includes", product.detail?.packageIncludes],
    ].filter(([, value]) => typeof value === "string" && value.trim());

    if (structuredDetails.length) {
      panels.push({
        key: "productDetails",
        title: "Product Details",
        content: (
          <div className="space-y-2 text-sm text-zinc-700">
            {structuredDetails.map(([label, value]) => (
              <p key={`${label}-${value}`}><span className="font-semibold">{label}:</span> {value}</p>
            ))}
          </div>
        ),
      });
    }

    return panels;
  }, [product.deliveriesReturns, product.detail, product.fabricCare, product.name, product.shipping, product.shippingDelivery, product.sizeGuide]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const trackProductDetailEvent = (
    eventType: "PRODUCT_VIEW" | "PRODUCT_ADDED_TO_CART" | "WISHLIST_ADDED" | "EXPLICIT_PRODUCT_INTEREST",
    metadata?: Record<string, unknown>,
  ) => {
    void trackUserBehaviorEvent({
      eventType,
      productId: product.id,
      brandId: product.brandId,
      sourcePage: "product-detail",
      gender: product.gender,
      topCategory: product.topCategory,
      subCategory: product.subCategory,
      metadata: {
        source: "product-detail",
        ...metadata,
      },
    }).catch(() => {
      // Keep product interactions resilient if telemetry is unavailable.
    });
  };

  useEffect(() => {
    if (!availableColors.length) return;
    if (!selectedColor || !availableColors.some((color) => color.toLowerCase() === selectedColor.toLowerCase())) {
      setSelectedColor(availableColors[0] || "");
    }
  }, [availableColors, selectedColor]);

  useEffect(() => {
    if (!selectedSize || !sizeAvailability.get(selectedSize)) {
      setSelectedSize(firstAvailableSize);
    }
  }, [firstAvailableSize, selectedSize, sizeAvailability]);

  useEffect(() => {
    void trackUserBehaviorEvent({
      eventType: "PRODUCT_VIEW",
      productId: product.id,
      brandId: product.brandId,
      sourcePage: "product-detail",
      gender: product.gender,
      topCategory: product.topCategory,
      subCategory: product.subCategory,
      metadata: { source: "product-detail" },
    }).catch(() => {
      // Ignore telemetry failures to keep browsing uninterrupted.
    });
  }, [product.brandId, product.gender, product.id, product.subCategory, product.topCategory]);

  useEffect(() => {
    const nextImage = galleryImages[0] || product.imageUrl;
    if (!nextImage) return;
    if (!activeImage || !galleryImages.some((image) => image.toLowerCase() === activeImage.toLowerCase())) {
      setActiveImage(nextImage);
    }
  }, [activeImage, galleryImages, product.imageUrl]);

  const badge = useMemo(() => {
    if (pricing.hasDiscount) return `-${pricing.discountPercentage}%`;
    if (product.label) return product.label;
    if (product.badge) return product.badge;
    if (product.stock <= 0) return "Out of Stock";
    if (product.pricePkr < 3000) return "Sale";
    return "New";
  }, [pricing.discountPercentage, pricing.hasDiscount, product.badge, product.label, product.pricePkr, product.stock]);

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

  const canAdd = product.stock > 0 && Boolean(selectedSize) && sizeAvailability.get(selectedSize) !== false;

  // Remove brand name from product title
  const stripBrandPrefix = (title: string, brandName?: string) => {
    if (!brandName) return title;
    const escapedBrand = brandName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cleaned = title.replace(new RegExp(`^${escapedBrand}(?:\\s|:|-)+?`, "i"), "").trim();
    return cleaned || title;
  };

  const displayTitle = stripBrandPrefix(product.name, product.brand?.name);
  const soldCount = product.soldCount || 0;

  return (
    <section className="grid gap-4 md:grid-cols-12">
      <div className="space-y-3 md:col-span-7">
        <button
          type="button"
          className="relative block aspect-[4/5] w-full overflow-hidden border border-zinc-300"
          onClick={() => setZoomOpen(true)}
          title="Click to zoom"
          aria-label="Zoom product image"
        >
          <ProductImage src={activeImage || product.imageUrl} alt={displayTitle} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" priority />
          <span className="absolute bottom-3 right-3 border border-black bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            Zoom
          </span>
        </button>
        {galleryImages.length > 1 ? (
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {galleryImages.map((image, index) => {
              const isActive = (activeImage || "").toLowerCase() === image.toLowerCase();
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  className={`relative aspect-square overflow-hidden border ${isActive ? "border-black" : "border-zinc-300"}`}
                  aria-label={`View image ${index + 1}`}
                >
                  <ProductImage src={image} alt={`${displayTitle} image ${index + 1}`} fill className="object-cover" sizes="20vw" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border border-zinc-300 p-5 md:col-span-5">
        <div className="flex items-center justify-between gap-3">
          <Link href={product.brand?.slug ? `/brand/${product.brand.slug}` : "/brands"} className="text-xs uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-700">
            {product.brand?.name || "Verified Brand"}
          </Link>
          <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>{badge}</span>
        </div>

        <h1 className="font-heading text-4xl uppercase leading-[0.95]" title={product.name}>{displayTitle}</h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {pricing.hasDiscount ? (
              <>
                <p className="text-lg font-semibold">{formatPkr(pricing.finalPrice)}</p>
                <p className="text-sm text-zinc-500 line-through">{formatPkr(pricing.basePrice)}</p>
              </>
            ) : (
              <p className="text-lg font-semibold">{formatPkr(pricing.basePrice)}</p>
            )}
          </div>
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-[0.12em]">{soldCount} Sold</p>
        </div>
        <p className="text-sm leading-6 text-zinc-700">{product.descriptionLong || product.description}</p>

        <div className="space-y-1 text-xs uppercase tracking-[0.12em]">
          <p className={product.stock > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
            Stock: {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-500">
            <p>{product.topCategory} / {product.subCategory}</p>
            {product.fit ? <p>Fit: {product.fit}</p> : null}
          </div>
          {estimatedDeliveryTime ? (
            <p className="normal-case tracking-normal text-zinc-700">
              <span className="font-semibold uppercase tracking-[0.12em] text-zinc-500">Estimated Delivery Time:</span> {estimatedDeliveryTime}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Size</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => {
              const isAvailable = sizeAvailability.get(size) !== false;
              const isSelected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => {
                    if (isAvailable) {
                      setSelectedSize(size);
                      trackProductDetailEvent("EXPLICIT_PRODUCT_INTEREST", {
                        action: "select-size",
                        selectedSize: size,
                      });
                    }
                  }}
                  className={`border px-3 py-2 text-xs uppercase tracking-[0.12em] ${
                    isSelected
                      ? "border-black bg-black text-white"
                      : isAvailable
                        ? "border-zinc-300 bg-white"
                        : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 line-through"
                  }`}
                  aria-disabled={!isAvailable}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Color</p>
          <div className="flex flex-wrap gap-2">
            {(availableColors.length ? availableColors : [product.color || "Default"]).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  setSelectedColor(color);
                  trackProductDetailEvent("EXPLICIT_PRODUCT_INTEREST", {
                    action: "select-color",
                    selectedColor: color,
                  });
                }}
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
              trackProductDetailEvent("PRODUCT_ADDED_TO_CART", {
                action: "add-to-cart",
                selectedColor,
                selectedSize,
              });
            }}
          >
            {canAdd ? "Add to Cart" : "Out of Stock"}
          </button>
          <button
            type="button"
            className="h-11 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-zinc-100"
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
                  trackProductDetailEvent("WISHLIST_ADDED", { action: "wishlist-add" });
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Failed to save wishlist item";
                  if (message.toLowerCase().includes("product not found")) {
                    addWishlistLocal(product);
                    trackProductDetailEvent("WISHLIST_ADDED", { action: "wishlist-add-local" });
                  } else {
                    pushToast(message, "error");
                    return;
                  }
                }
              } else {
                toggleWishlist(product);
                trackProductDetailEvent("WISHLIST_ADDED", { action: "wishlist-add-local" });
              }
              pushToast("Added to wishlist", "success");
            }}
          >
            {wishlistActive ? "Saved" : "Wishlist"}
          </button>
        </div>

        {detailPanels.length ? (
          <section className="space-y-3 p-0">
            {detailPanels.map((panel) => {
            const isOpen = openPanel === panel.key;

            return (
              <article key={panel.key} className="w-full border border-zinc-300">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] hover:bg-zinc-100 hover:text-zinc-900"
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
        ) : null}

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
            <ProductImage src={activeImage || product.imageUrl} alt={`${product.name} zoomed`} fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
