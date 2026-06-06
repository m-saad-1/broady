"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError, approveProduct, getAdminProductById, rejectProduct } from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import { ProductImage } from "@/components/ui/product-image";
import { ProductEditorForm } from "@/components/dashboard/product-editor-form";
import { productToFormValues } from "@/lib/product-form";
import { useToastStore } from "@/stores/toast-store";
import type { Product } from "@/types/marketplace";

type AdminProductDetailClientProps = {
  productId: string;
};

function resolveStatusLabel(product: Product) {
  if (!product.isActive || product.approvalStatus === "PENDING") return "INACTIVE";
  return product.approvalStatus || "APPROVED";
}

export function AdminProductDetailClient({ productId }: AdminProductDetailClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAdminProductById(productId);
      setProduct(response);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setError("Product not found.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to load product.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleApprove = async () => {
    if (!product) return;
    setIsSaving(true);
    try {
      await approveProduct(product.id);
      pushToast("Product approved", "success");
      await loadProduct();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to approve product";
      pushToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!product) return;
    setIsSaving(true);
    try {
      await rejectProduct(product.id, "Rejected during admin product review");
      pushToast("Product rejected", "success");
      await loadProduct();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reject product";
      pushToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const hasDiscount = useMemo(() => Number(product?.discountPercentage || 0) > 0 && Number(product?.salePrice || 0) > 0, [product]);
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const urls = (product.images || [])
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((image) => image.cdnUrl || image.url || image.sourceUrl || "")
      .filter(Boolean);
    return Array.from(new Set([product.imageUrl, ...urls].map((url) => (url || "").trim()).filter(Boolean)));
  }, [product]);
  const [activeImage, setActiveImage] = useState("");

  useEffect(() => {
    if (!galleryImages.length) return;
    if (!activeImage || !galleryImages.some((image) => image.toLowerCase() === activeImage.toLowerCase())) {
      setActiveImage(galleryImages[0] || "");
    }
  }, [activeImage, galleryImages]);

  if (isLoading) {
    return <p className="text-sm text-zinc-600">Loading product details...</p>;
  }

  if (error || !product) {
    return <p className="text-sm text-red-600">{error || "Unable to load product."}</p>;
  }

  return (
    <section className="grid gap-6 md:grid-cols-12">
      <div className="md:col-span-7">
        <div className="relative aspect-[4/5] w-full overflow-hidden border border-zinc-300">
          <ProductImage src={activeImage || product.imageUrl} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" />
        </div>
        {galleryImages.length > 1 ? (
          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
            {galleryImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`relative aspect-square overflow-hidden border ${(activeImage || "").toLowerCase() === image.toLowerCase() ? "border-black" : "border-zinc-300"}`}
                aria-label={`View product image ${index + 1}`}
              >
                <ProductImage src={image} alt={`${product.name} image ${index + 1}`} fill className="object-cover" sizes="20vw" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-5 border border-zinc-300 p-6 md:col-span-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{product.brand?.name || "Brand"}</p>
          <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${resolveStatusLabel(product) === "INACTIVE" ? "border-amber-700 bg-amber-500 text-black" : "border-emerald-700 bg-emerald-600 text-white"}`}>
            {resolveStatusLabel(product)}
          </span>
        </div>

        <h2 className="font-heading text-5xl uppercase leading-[0.95]">{product.name}</h2>

        <div className="flex items-center gap-3">
          {hasDiscount ? (
            <>
              <p className="text-lg font-semibold">{formatPkr(product.salePrice || product.pricePkr)}</p>
              <p className="text-sm text-zinc-500 line-through">{formatPkr(product.actualPrice || product.pricePkr)}</p>
            </>
          ) : (
            <p className="text-lg font-semibold">{formatPkr(product.pricePkr)}</p>
          )}
        </div>

        <div className="space-y-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
          <p>{product.topCategory} / {product.subCategory}</p>
          <p>Stock: {product.stock}</p>
          <p>Color: {product.color || "-"}</p>
          <p>Sizes: {product.sizes.join(", ") || "-"}</p>
          {product.fit ? <p>Fit: {product.fit}</p> : null}
        </div>

        <p className="text-sm leading-7 text-zinc-700">{product.descriptionLong || product.description}</p>

        {product.detail ? (
          <section className="space-y-2 border border-zinc-200 p-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Structured Details</h3>
            {[
              ["Fabric", product.detail.fabricComposition],
              ["Care", product.detail.careGuide],
              ["Model", product.detail.modelDetails],
              ["Material", product.detail.materialDetails],
              ["Origin", product.detail.origin],
              ["Includes", product.detail.packageIncludes],
              ["Disclaimer", product.detail.disclaimer],
            ].filter(([, value]) => typeof value === "string" && value.trim()).map(([label, value]) => (
              <p key={`${label}-${value}`}><span className="font-semibold">{label}:</span> {value}</p>
            ))}
          </section>
        ) : null}

        {product.variants?.length ? (
          <section className="space-y-2 border border-zinc-200 p-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Variants</h3>
            <div className="space-y-1">
              {product.variants.map((variant) => (
                <p key={variant.id} className="text-xs text-zinc-700">
                  {variant.sku} | {variant.color || "-"} | {variant.size || "-"} | {variant.stockStatus || "in_stock"} | PKR {variant.pricePkr.toLocaleString()}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {product.sizeGuide?.entries?.length || product.sizeGuide?.details?.length || product.sizeGuide?.imageUrl ? (
          <section className="space-y-2 border border-zinc-200 p-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Size Guide</h3>
            {product.sizeGuide?.imageUrl ? (
              <div className="relative h-40 overflow-hidden border border-zinc-200">
                <ProductImage src={product.sizeGuide.imageUrl} alt={`${product.name} size guide`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 40vw" />
              </div>
            ) : null}
            {product.sizeGuide?.entries?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-zinc-700">
                {product.sizeGuide.entries.map((entry) => (
                  <li key={`${entry.size}-${entry.cm}-${entry.inches}`}>{entry.size}: {entry.cm} cm / {entry.inches} in</li>
                ))}
              </ul>
            ) : null}
            {product.sizeGuide?.details?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-zinc-700">
                {product.sizeGuide.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            disabled={isSaving}
            className="h-11 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={isSaving || product.approvalStatus === "APPROVED"}
            className="h-11 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => void handleReject()}
            disabled={isSaving}
            className="h-11 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Reject"}
          </button>
        </div>
      </div>

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsEditOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-3xl uppercase">Edit Product</h3>
                <p className="text-xs text-zinc-600">{product.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Close
              </button>
            </div>
            <ProductEditorForm
              scope="admin"
              mode="edit"
              productId={product.id}
              initialValues={productToFormValues(product)}
              cancelHref="/admin/products"
              onCancel={() => setIsEditOpen(false)}
              onCompleted={() => {
                setIsEditOpen(false);
                void loadProduct();
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
