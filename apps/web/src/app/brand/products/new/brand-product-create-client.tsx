"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { submitBrandProduct, uploadBrandProductImages } from "@/lib/api";
import { buildBrandProductPayload } from "@/lib/product-form";
import { useToastStore } from "@/stores/toast-store";
import type { ProductFormValues } from "@/lib/product-form";

type ProductCreateForm = Omit<ProductFormValues, "brandId">;

const defaultForm: ProductCreateForm = {
  name: "",
  slug: "",
  description: "",
  pricePkr: "",
  topCategory: "Men" as const,
  subCategory: "",
  sizes: "S, M, L",
  imageUrl: "",
  sizeGuideTemplateId: "",
  sizeGuideImageUrl: "",
  sizeGuideRows: [{ size: "S", cm: "", inches: "" }],
  deliveriesReturnsTemplateId: "",
  deliveryTime: "3-5 business days",
  returnPolicy: "Returns accepted within 7 days for unused items.",
  refundConditions: "Refund to original payment method after inspection.",
  shippingDeliveryTemplateId: "",
  shippingRegions: "Pakistan",
  shippingEstimatedDeliveryTime: "3-5 business days",
  shippingCharges: "Calculated at checkout",
  fabricCareTemplateId: "",
  fabricType: "Cotton",
  careInstructions: "Machine wash cold, do not bleach",
  stock: "0",
  isActive: true,
};

export function BrandProductCreateClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);

  const handleProductImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.currentTarget.value = "";

    if (!selectedFiles.length) {
      return;
    }

    setUploadingImages(true);
    try {
      const uploadedUrls = await uploadBrandProductImages(selectedFiles);
      setUploadedImageUrls((current) => {
        const next = [...current, ...uploadedUrls];
        return Array.from(new Set(next));
      });
      if (!form.imageUrl && uploadedUrls[0]) {
        setForm((current) => ({ ...current, imageUrl: uploadedUrls[0] }));
      }
      pushToast("Image uploaded", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload images";
      pushToast(message, "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const updateSizeRow = (index: number, field: keyof ProductCreateForm["sizeGuideRows"][number], value: string) => {
    setForm((current) => ({
      ...current,
      sizeGuideRows: current.sizeGuideRows.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry)),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await submitBrandProduct(buildBrandProductPayload(form));
      pushToast("Product submitted for approval", "success");
      setForm(defaultForm);
      setUploadedImageUrls([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit product";
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="border border-zinc-300 p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Create Product</p>
        <h2 className="mt-2 font-heading text-4xl uppercase">Add Product</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">Create a new brand product without selecting any other brand or shared admin scope.</p>
      </section>

      <form className="space-y-4 border border-zinc-300 p-5" onSubmit={submit}>
        {/* Basic Product Info */}
        <section className="space-y-3 border-b border-zinc-300 pb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Basic Information</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="h-10 border border-zinc-300 px-3" placeholder="Product name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            <input className="h-10 border border-zinc-300 px-3" placeholder="Slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} required />
            <textarea className="min-h-24 border border-zinc-300 p-3 md:col-span-2" placeholder="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
            <input className="h-10 border border-zinc-300 px-3" type="number" min={1} placeholder="Price PKR" value={form.pricePkr} onChange={(event) => setForm((current) => ({ ...current, pricePkr: event.target.value }))} required />
            <input className="h-10 border border-zinc-300 px-3" type="number" min={0} placeholder="Stock" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} required />
            <select className="h-10 border border-zinc-300 px-3" value={form.topCategory} onChange={(event) => setForm((current) => ({ ...current, topCategory: event.target.value as typeof form.topCategory }))}>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Kids">Kids</option>
            </select>
            <input className="h-10 border border-zinc-300 px-3" placeholder="Sub category" value={form.subCategory} onChange={(event) => setForm((current) => ({ ...current, subCategory: event.target.value }))} required />
            <input className="h-10 border border-zinc-300 px-3 md:col-span-2" placeholder="Image URL" value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} required />
            <label className="inline-flex h-10 cursor-pointer items-center justify-center border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] md:col-span-2">
              {uploadingImages ? "Uploading images..." : "Upload from file or folder"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleProductImageSelection(event)} disabled={uploadingImages} />
            </label>
            {uploadedImageUrls.length ? (
              <div className="grid gap-2 md:col-span-2 sm:grid-cols-2">
                {uploadedImageUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, imageUrl: url }))}
                    className={`border p-2 text-left text-xs ${form.imageUrl === url ? "border-black bg-zinc-50" : "border-zinc-300"}`}
                  >
                    <img src={url} alt="Uploaded product" className="h-28 w-full border border-zinc-200 object-cover" />
                    <span className="mt-2 block truncate uppercase tracking-[0.08em]">Use this image</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* Size & Size Guide */}
        <section className="space-y-3 border-b border-zinc-300 pb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Size & Size Guide</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="h-10 border border-zinc-300 px-3 md:col-span-2" placeholder="Sizes (comma separated)" value={form.sizes} onChange={(event) => setForm((current) => ({ ...current, sizes: event.target.value }))} required />
            <input className="h-10 border border-zinc-300 px-3 md:col-span-2" placeholder="Size guide image URL" value={form.sizeGuideImageUrl} onChange={(event) => setForm((current) => ({ ...current, sizeGuideImageUrl: event.target.value }))} />
          </div>
          <div className="space-y-2">
            {form.sizeGuideRows.map((row, index) => (
              <div key={`size-row-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input className="h-9 border border-zinc-300 px-2 text-xs" placeholder="Size" value={row.size} onChange={(event) => updateSizeRow(index, "size", event.target.value)} />
                <input className="h-9 border border-zinc-300 px-2 text-xs" placeholder="CM" value={row.cm} onChange={(event) => updateSizeRow(index, "cm", event.target.value)} />
                <input className="h-9 border border-zinc-300 px-2 text-xs" placeholder="Inches" value={row.inches} onChange={(event) => updateSizeRow(index, "inches", event.target.value)} />
                <button type="button" onClick={() => setForm((current) => ({ ...current, sizeGuideRows: current.sizeGuideRows.filter((_, entryIndex) => entryIndex !== index) }))} disabled={form.sizeGuideRows.length <= 1} className="h-9 border border-zinc-300 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-40">Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => setForm((current) => ({ ...current, sizeGuideRows: [...current.sizeGuideRows, { size: "", cm: "", inches: "" }] }))} className="h-9 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">Add row</button>
          </div>
        </section>

        {/* Delivery & Returns */}
        <section className="space-y-3 border-b border-zinc-300 pb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Delivery & Returns</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="h-10 border border-zinc-300 px-3" placeholder="Delivery time" value={form.deliveryTime} onChange={(event) => setForm((current) => ({ ...current, deliveryTime: event.target.value }))} />
            <textarea className="min-h-20 border border-zinc-300 p-3" placeholder="Return policy" value={form.returnPolicy} onChange={(event) => setForm((current) => ({ ...current, returnPolicy: event.target.value }))} />
            <textarea className="min-h-20 border border-zinc-300 p-3" placeholder="Refund conditions" value={form.refundConditions} onChange={(event) => setForm((current) => ({ ...current, refundConditions: event.target.value }))} />
          </div>
        </section>

        {/* Shipping & Delivery */}
        <section className="space-y-3 border-b border-zinc-300 pb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Shipping & Delivery</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea className="min-h-20 border border-zinc-300 p-3 md:col-span-2" placeholder="Shipping regions" value={form.shippingRegions} onChange={(event) => setForm((current) => ({ ...current, shippingRegions: event.target.value }))} />
            <input className="h-10 border border-zinc-300 px-3" placeholder="Estimated delivery time" value={form.shippingEstimatedDeliveryTime} onChange={(event) => setForm((current) => ({ ...current, shippingEstimatedDeliveryTime: event.target.value }))} />
            <input className="h-10 border border-zinc-300 px-3" placeholder="Shipping charges" value={form.shippingCharges} onChange={(event) => setForm((current) => ({ ...current, shippingCharges: event.target.value }))} />
          </div>
        </section>

        {/* Fabric & Care */}
        <section className="space-y-3 border-b border-zinc-300 pb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Fabric & Care</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="h-10 border border-zinc-300 px-3" placeholder="Fabric type" value={form.fabricType} onChange={(event) => setForm((current) => ({ ...current, fabricType: event.target.value }))} />
            <textarea className="min-h-20 border border-zinc-300 p-3 md:col-span-2" placeholder="Care instructions" value={form.careInstructions} onChange={(event) => setForm((current) => ({ ...current, careInstructions: event.target.value }))} />
          </div>
        </section>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
          Product is active
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
            {saving ? "Submitting" : "Submit for approval"}
          </button>
          <Link href="/brand/products" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to Products
          </Link>
        </div>
      </form>
    </div>
  );
}
