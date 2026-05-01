"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveProduct,
  createProduct,
  createProductContentTemplate,
  deleteProduct,
  getAdminBrands,
  getAdminProducts,
  getPendingProducts,
  getProductContentTemplates,
  rejectProduct,
  updateProduct,
} from "@/lib/api";
import { buildAdminProductPayload } from "@/lib/product-form";
import { useToastStore } from "@/stores/toast-store";
import type {
  Brand,
  Product,
  ProductContentTemplate,
  ProductDeliveriesReturns,
  ProductFabricCare,
  ProductShippingDelivery,
  ProductSizeGuide,
  ProductTemplateType,
} from "@/types/marketplace";

type ProductFormState = {
  brandId: string;
  name: string;
  slug: string;
  description: string;
  pricePkr: string;
  topCategory: "Men" | "Women" | "Kids";
  subCategory: string;
  sizes: string;
  imageUrl: string;
  sizeGuideTemplateId?: string;
  sizeGuideImageUrl?: string;
  sizeGuideRows: Array<{ size: string; cm: string; inches: string }>;
  deliveriesReturnsTemplateId?: string;
  deliveryTime: string;
  returnPolicy: string;
  refundConditions: string;
  shippingDeliveryTemplateId?: string;
  shippingRegions: string;
  shippingEstimatedDeliveryTime: string;
  shippingCharges?: string;
  fabricCareTemplateId?: string;
  fabricType: string;
  careInstructions: string;
  stock: string;
  isActive: boolean;
};

type TemplateLibraryState = {
  SIZE_GUIDE: ProductContentTemplate[];
  DELIVERIES_RETURNS: ProductContentTemplate[];
  SHIPPING_DELIVERY: ProductContentTemplate[];
  FABRIC_CARE: ProductContentTemplate[];
};

const defaultProductForm: ProductFormState = {
  brandId: "",
  name: "",
  slug: "",
  description: "",
  pricePkr: "",
  topCategory: "Men",
  subCategory: "",
  sizes: "",
  imageUrl: "",
  sizeGuideTemplateId: "",
  sizeGuideImageUrl: "",
  sizeGuideRows: [{ size: "S", cm: "", inches: "" }],
  deliveriesReturnsTemplateId: "",
  deliveryTime: "",
  returnPolicy: "",
  refundConditions: "",
  shippingDeliveryTemplateId: "",
  shippingRegions: "",
  shippingEstimatedDeliveryTime: "",
  shippingCharges: "",
  fabricCareTemplateId: "",
  fabricType: "",
  careInstructions: "",
  stock: "0",
  isActive: true,
};

const emptyTemplateLibrary: TemplateLibraryState = {
  SIZE_GUIDE: [],
  DELIVERIES_RETURNS: [],
  SHIPPING_DELIVERY: [],
  FABRIC_CARE: [],
};

function toProductFormState(product: Product): ProductFormState {
  const sizeGuide = product.sizeGuide;
  const deliveriesReturns = product.deliveriesReturns;
  const shippingDelivery = product.shippingDelivery;
  const fabricCare = product.fabricCare;

  return {
    brandId: product.brandId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    pricePkr: String(product.pricePkr),
    topCategory: product.topCategory,
    subCategory: product.subCategory,
    sizes: product.sizes.join(", "),
    imageUrl: product.imageUrl,
    sizeGuideTemplateId: product.sizeGuideTemplateId || "",
    sizeGuideImageUrl: sizeGuide?.imageUrl || "",
    sizeGuideRows: sizeGuide?.entries?.length ? sizeGuide.entries : [{ size: "S", cm: "", inches: "" }],
    deliveriesReturnsTemplateId: product.deliveriesReturnsTemplateId || "",
    deliveryTime: deliveriesReturns?.deliveryTime || "",
    returnPolicy: deliveriesReturns?.returnPolicy || "",
    refundConditions: deliveriesReturns?.refundConditions || "",
    shippingDeliveryTemplateId: product.shippingDeliveryTemplateId || "",
    shippingRegions: shippingDelivery?.regions?.join("\n") || "",
    shippingEstimatedDeliveryTime: shippingDelivery?.estimatedDeliveryTime || "",
    shippingCharges: shippingDelivery?.charges || "",
    fabricCareTemplateId: product.fabricCareTemplateId || "",
    fabricType: fabricCare?.fabricType || "",
    careInstructions: fabricCare?.careInstructions?.join("\n") || "",
    stock: String(product.stock),
    isActive: product.isActive,
  };
}

export function ProductsAdminClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<TemplateLibraryState>(emptyTemplateLibrary);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextBrands, nextProducts, nextPendingProducts, sizeGuides, deliveriesReturns, shippingDelivery, fabricCare] = await Promise.all([
        getAdminBrands(),
        getAdminProducts(),
        getPendingProducts(),
        getProductContentTemplates("SIZE_GUIDE"),
        getProductContentTemplates("DELIVERIES_RETURNS"),
        getProductContentTemplates("SHIPPING_DELIVERY"),
        getProductContentTemplates("FABRIC_CARE"),
      ]);
      setBrands(nextBrands);
      setProducts(nextProducts);
      setPendingProducts(nextPendingProducts);
      setTemplates({
        SIZE_GUIDE: sizeGuides,
        DELIVERIES_RETURNS: deliveriesReturns,
        SHIPPING_DELIVERY: shippingDelivery,
        FABRIC_CARE: fabricCare,
      });
      setProductForm((current) => ({
        ...current,
        brandId: current.brandId || nextBrands[0]?.id || "",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load products";
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(
    () => ({
      products: products.length,
      activeProducts: products.filter((item) => item.isActive && item.approvalStatus === "APPROVED").length,
      pendingApprovals: pendingProducts.length,
      outOfStockProducts: products.filter((item) => item.isActive && item.approvalStatus === "APPROVED" && item.stock <= 0).length,
    }),
    [pendingProducts.length, products],
  );

  const applyTemplate = (type: ProductTemplateType, templateId: string) => {
    const template = templates[type].find((item) => item.id === templateId);
    if (!template) return;

    setProductForm((current) => {
      if (type === "SIZE_GUIDE") {
        const content = template.content as ProductSizeGuide;
        return {
          ...current,
          sizeGuideTemplateId: template.id,
          sizeGuideImageUrl: content.imageUrl || "",
          sizeGuideRows: content.entries.length ? content.entries : current.sizeGuideRows,
        };
      }

      if (type === "DELIVERIES_RETURNS") {
        const content = template.content as ProductDeliveriesReturns;
        return {
          ...current,
          deliveriesReturnsTemplateId: template.id,
          deliveryTime: content.deliveryTime,
          returnPolicy: content.returnPolicy,
          refundConditions: content.refundConditions,
        };
      }

      if (type === "SHIPPING_DELIVERY") {
        const content = template.content as ProductShippingDelivery;
        return {
          ...current,
          shippingDeliveryTemplateId: template.id,
          shippingRegions: content.regions.join("\n"),
          shippingEstimatedDeliveryTime: content.estimatedDeliveryTime,
          shippingCharges: content.charges || "",
        };
      }

      const content = template.content as ProductFabricCare;
      return {
        ...current,
        fabricCareTemplateId: template.id,
        fabricType: content.fabricType,
        careInstructions: content.careInstructions.join("\n"),
      };
    });
  };

  const saveTemplate = async (type: ProductTemplateType) => {
    const name = window.prompt("Template name");
    if (!name?.trim()) return;

    const content = (() => {
      if (type === "SIZE_GUIDE") {
        return {
          imageUrl: productForm.sizeGuideImageUrl || undefined,
          entries: productForm.sizeGuideRows,
        };
      }
      if (type === "DELIVERIES_RETURNS") {
        return {
          deliveryTime: productForm.deliveryTime,
          returnPolicy: productForm.returnPolicy,
          refundConditions: productForm.refundConditions,
        };
      }
      if (type === "SHIPPING_DELIVERY") {
        return {
          regions: productForm.shippingRegions.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
          estimatedDeliveryTime: productForm.shippingEstimatedDeliveryTime,
          charges: productForm.shippingCharges || undefined,
        };
      }
      return {
        fabricType: productForm.fabricType,
        careInstructions: productForm.careInstructions.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
      };
    })();

    try {
      const created = await createProductContentTemplate({ type, name: name.trim(), content });
      setTemplates((current) => ({
        ...current,
        [type]: [...current[type], created].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      pushToast("Template saved", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save template";
      pushToast(message, "error");
    }
  };

  const handleProductSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProduct(true);

    try {
      const payload = buildAdminProductPayload(productForm);

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        pushToast("Product updated", "success");
      } else {
        await createProduct(payload);
        pushToast("Product created", "success");
      }

      setEditingProductId(null);
      setProductForm((current) => ({
        ...defaultProductForm,
        brandId: current.brandId || brands[0]?.id || "",
      }));
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save product";
      pushToast(message, "error");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete product ${product.name}?`)) return;

    try {
      const message = await deleteProduct(product.id);
      pushToast(message || "Product deleted", "success");
      if (editingProductId === product.id) {
        setEditingProductId(null);
        setProductForm((current) => ({
          ...defaultProductForm,
          brandId: current.brandId || brands[0]?.id || "",
        }));
      }
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete product";
      pushToast(message, "error");
    }
  };

  const handleApproveProduct = async (product: Product) => {
    try {
      await approveProduct(product.id);
      pushToast("Product approved", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve product";
      pushToast(message, "error");
    }
  };

  const handleRejectProduct = async (product: Product) => {
    try {
      await rejectProduct(product.id, "Rejected by Broady");
      pushToast("Product rejected", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reject product";
      pushToast(message, "error");
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.products}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Active Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.activeProducts}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending Approval</p>
          <p className="mt-3 font-heading text-4xl">{totals.pendingApprovals}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Out of Stock</p>
          <p className="mt-3 font-heading text-4xl">{totals.outOfStockProducts}</p>
        </article>
      </section>

      {pendingProducts.length ? (
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-heading text-3xl uppercase">Pending Product Approvals</h2>
          {pendingProducts.map((product) => (
            <div key={product.id} className="grid gap-3 border-b border-amber-200 py-3 md:grid-cols-[2fr_1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">{product.name}</p>
                <p className="text-xs text-zinc-700">{product.brand?.name || "Brand"} / {product.topCategory} / {product.subCategory}</p>
              </div>
              <p className="text-sm">PKR {product.pricePkr.toLocaleString()}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleApproveProduct(product)} className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white">Approve</button>
                <button type="button" onClick={() => void handleRejectProduct(product)} className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]">Reject</button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[520px_1fr]">
        <form className="space-y-3 border border-zinc-300 p-4" onSubmit={handleProductSubmit}>
          <h2 className="font-heading text-3xl uppercase">{editingProductId ? "Edit Product" : "Create Product"}</h2>
          <select className="h-10 w-full border border-zinc-300 px-3" value={productForm.brandId} onChange={(event) => setProductForm((current) => ({ ...current, brandId: event.target.value }))} required>
            <option value="" disabled>Select brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
          <input className="h-10 w-full border border-zinc-300 px-3" placeholder="Product name" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} required />
          <input className="h-10 w-full border border-zinc-300 px-3" placeholder="Slug" value={productForm.slug} onChange={(event) => setProductForm((current) => ({ ...current, slug: event.target.value }))} required />
          <textarea className="min-h-24 w-full border border-zinc-300 p-3" placeholder="Description" value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="h-10 w-full border border-zinc-300 px-3" type="number" min={1} placeholder="Price PKR" value={productForm.pricePkr} onChange={(event) => setProductForm((current) => ({ ...current, pricePkr: event.target.value }))} required />
            <input className="h-10 w-full border border-zinc-300 px-3" type="number" min={0} placeholder="Stock" value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="h-10 w-full border border-zinc-300 px-3" value={productForm.topCategory} onChange={(event) => setProductForm((current) => ({ ...current, topCategory: event.target.value as ProductFormState["topCategory"] }))}>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Kids">Kids</option>
            </select>
            <input className="h-10 w-full border border-zinc-300 px-3" placeholder="Sub category" value={productForm.subCategory} onChange={(event) => setProductForm((current) => ({ ...current, subCategory: event.target.value }))} required />
          </div>
          <input className="h-10 w-full border border-zinc-300 px-3" placeholder="Sizes (comma separated, e.g. S,M,L)" value={productForm.sizes} onChange={(event) => setProductForm((current) => ({ ...current, sizes: event.target.value }))} required />
          <input className="h-10 w-full border border-zinc-300 px-3" placeholder="Image URL" value={productForm.imageUrl} onChange={(event) => setProductForm((current) => ({ ...current, imageUrl: event.target.value }))} required />

          <section className="space-y-2 border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Size Guide Library</p>
              <button type="button" onClick={() => void saveTemplate("SIZE_GUIDE")} className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">Save as template</button>
            </div>
            <select className="h-9 w-full border border-zinc-300 px-3 text-xs" value={productForm.sizeGuideTemplateId || ""} onChange={(event) => applyTemplate("SIZE_GUIDE", event.target.value)}>
              <option value="">Select template</option>
              {templates.SIZE_GUIDE.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <input className="h-9 w-full border border-zinc-300 px-3 text-xs" placeholder="Size chart image URL (optional)" value={productForm.sizeGuideImageUrl || ""} onChange={(event) => setProductForm((current) => ({ ...current, sizeGuideImageUrl: event.target.value }))} />
            <div className="space-y-2">
              {productForm.sizeGuideRows.map((row, index) => (
                <div key={`size-row-${index}`} className="grid gap-2 sm:grid-cols-4">
                  <input className="h-9 border border-zinc-300 px-2 text-xs" placeholder="Size" value={row.size} onChange={(event) => setProductForm((current) => ({ ...current, sizeGuideRows: current.sizeGuideRows.map((entry, entryIndex) => (entryIndex === index ? { ...entry, size: event.target.value } : entry)) }))} />
                  <input className="h-9 border border-zinc-300 px-2 text-xs" placeholder="CM" value={row.cm} onChange={(event) => setProductForm((current) => ({ ...current, sizeGuideRows: current.sizeGuideRows.map((entry, entryIndex) => (entryIndex === index ? { ...entry, cm: event.target.value } : entry)) }))} />
                  <input className="h-9 border border-zinc-300 px-2 text-xs" placeholder="Inches" value={row.inches} onChange={(event) => setProductForm((current) => ({ ...current, sizeGuideRows: current.sizeGuideRows.map((entry, entryIndex) => (entryIndex === index ? { ...entry, inches: event.target.value } : entry)) }))} />
                  <button type="button" onClick={() => setProductForm((current) => ({ ...current, sizeGuideRows: current.sizeGuideRows.filter((_, entryIndex) => entryIndex !== index) }))} disabled={productForm.sizeGuideRows.length <= 1} className="h-9 border border-zinc-300 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-40">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setProductForm((current) => ({ ...current, sizeGuideRows: [...current.sizeGuideRows, { size: "", cm: "", inches: "" }] }))} className="h-9 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">Add row</button>
            </div>
          </section>

          <section className="space-y-2 border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Deliveries & Returns</p>
              <button type="button" onClick={() => void saveTemplate("DELIVERIES_RETURNS")} className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">Save as template</button>
            </div>
            <select className="h-9 w-full border border-zinc-300 px-3 text-xs" value={productForm.deliveriesReturnsTemplateId || ""} onChange={(event) => applyTemplate("DELIVERIES_RETURNS", event.target.value)}>
              <option value="">Select template</option>
              {templates.DELIVERIES_RETURNS.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <input className="h-9 w-full border border-zinc-300 px-3 text-xs" placeholder="Delivery time" value={productForm.deliveryTime} onChange={(event) => setProductForm((current) => ({ ...current, deliveryTime: event.target.value }))} />
            <textarea className="min-h-16 w-full border border-zinc-300 p-2 text-xs" placeholder="Return policy" value={productForm.returnPolicy} onChange={(event) => setProductForm((current) => ({ ...current, returnPolicy: event.target.value }))} />
            <textarea className="min-h-16 w-full border border-zinc-300 p-2 text-xs" placeholder="Refund conditions" value={productForm.refundConditions} onChange={(event) => setProductForm((current) => ({ ...current, refundConditions: event.target.value }))} />
          </section>

          <section className="space-y-2 border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Shipping & Delivery</p>
              <button type="button" onClick={() => void saveTemplate("SHIPPING_DELIVERY")} className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">Save as template</button>
            </div>
            <select className="h-9 w-full border border-zinc-300 px-3 text-xs" value={productForm.shippingDeliveryTemplateId || ""} onChange={(event) => applyTemplate("SHIPPING_DELIVERY", event.target.value)}>
              <option value="">Select template</option>
              {templates.SHIPPING_DELIVERY.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <textarea className="min-h-16 w-full border border-zinc-300 p-2 text-xs" placeholder="Shipping regions (one per line)" value={productForm.shippingRegions} onChange={(event) => setProductForm((current) => ({ ...current, shippingRegions: event.target.value }))} />
            <input className="h-9 w-full border border-zinc-300 px-3 text-xs" placeholder="Estimated delivery time" value={productForm.shippingEstimatedDeliveryTime} onChange={(event) => setProductForm((current) => ({ ...current, shippingEstimatedDeliveryTime: event.target.value }))} />
            <input className="h-9 w-full border border-zinc-300 px-3 text-xs" placeholder="Shipping charges (optional)" value={productForm.shippingCharges || ""} onChange={(event) => setProductForm((current) => ({ ...current, shippingCharges: event.target.value }))} />
          </section>

          <section className="space-y-2 border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Fabric & Care</p>
              <button type="button" onClick={() => void saveTemplate("FABRIC_CARE")} className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">Save as template</button>
            </div>
            <select className="h-9 w-full border border-zinc-300 px-3 text-xs" value={productForm.fabricCareTemplateId || ""} onChange={(event) => applyTemplate("FABRIC_CARE", event.target.value)}>
              <option value="">Select template</option>
              {templates.FABRIC_CARE.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <input className="h-9 w-full border border-zinc-300 px-3 text-xs" placeholder="Fabric type" value={productForm.fabricType} onChange={(event) => setProductForm((current) => ({ ...current, fabricType: event.target.value }))} />
            <textarea className="min-h-16 w-full border border-zinc-300 p-2 text-xs" placeholder="Care instructions (one per line)" value={productForm.careInstructions} onChange={(event) => setProductForm((current) => ({ ...current, careInstructions: event.target.value }))} />
          </section>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={productForm.isActive} onChange={(event) => setProductForm((current) => ({ ...current, isActive: event.target.checked }))} />
            Product is active
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isSavingProduct || !productForm.brandId} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
              {isSavingProduct ? "Saving" : editingProductId ? "Update Product" : "Create Product"}
            </button>
            {editingProductId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingProductId(null);
                  setProductForm((current) => ({
                    ...defaultProductForm,
                    brandId: current.brandId || brands[0]?.id || "",
                  }));
                }}
                className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Products</h2>
          {isLoading ? <p className="text-sm text-zinc-600">Loading products...</p> : null}
          <div className="space-y-3">
            {products.map((product) => (
              <article key={product.id} className="space-y-3 border border-zinc-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/product/${product.slug}`} className="block text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                      {product.name}
                    </Link>
                    <p className="text-xs text-zinc-600">
                      {product.brand?.name || "-"} / {product.topCategory} / {product.subCategory}
                    </p>
                    <p className="text-xs text-zinc-700 line-clamp-2">{product.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProductId(product.id);
                        setProductForm(toProductFormState(product));
                      }}
                      className="border border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.12em] hover:border-black"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => void handleDeleteProduct(product)} className="border border-black bg-black px-3 py-1 text-xs uppercase tracking-[0.12em] text-white">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-700">
                  <p>
                    <span className="font-semibold text-zinc-900">Price:</span> PKR {product.pricePkr.toLocaleString()}
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-900">Stock:</span> {product.stock}
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-900">Color:</span> {product.colors?.join(", ") || "-"}
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-900">Size:</span> {product.sizes.join(", ")}
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-900">Activity:</span> {product.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
