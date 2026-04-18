"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveProduct,
  createBrand,
  createProduct,
  deleteBrand,
  deleteProduct,
  getAdminBrands,
  getAdminProducts,
  getPendingProducts,
  rejectProduct,
  updateBrand,
  updateProduct,
} from "@/lib/api";
import { buildAdminProductPayload } from "@/lib/product-form";
import type { ProductFormValues } from "@/lib/product-form";
import { useToastStore } from "@/stores/toast-store";
import type { Brand, Product } from "@/types/marketplace";

type BrandFormState = {
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  verified: boolean;
};

type ProductFormState = Omit<ProductFormValues, "brandId"> & { brandId: string };

const defaultBrandForm: BrandFormState = {
  name: "",
  slug: "",
  logoUrl: "",
  description: "",
  verified: true,
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

function toBrandFormState(brand: Brand): BrandFormState {
  return {
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl || "",
    description: brand.description || "",
    verified: brand.verified,
  };
}

function toProductFormState(product: Product): ProductFormState {
  const sizeGuideEntries = product.sizeGuide?.entries?.length
    ? product.sizeGuide.entries
    : [{ size: "S", cm: "", inches: "" }];

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
    sizeGuideImageUrl: product.sizeGuide?.imageUrl || "",
    sizeGuideRows: sizeGuideEntries,
    deliveriesReturnsTemplateId: product.deliveriesReturnsTemplateId || "",
    deliveryTime: product.deliveriesReturns?.deliveryTime || "3-5 business days",
    returnPolicy: product.deliveriesReturns?.returnPolicy || "Returns accepted within 7 days for unused items.",
    refundConditions: product.deliveriesReturns?.refundConditions || "Refund to original payment method after inspection.",
    shippingDeliveryTemplateId: product.shippingDeliveryTemplateId || "",
    shippingRegions: (product.shippingDelivery?.regions || ["Pakistan"]).join(", "),
    shippingEstimatedDeliveryTime: product.shippingDelivery?.estimatedDeliveryTime || "3-5 business days",
    shippingCharges: product.shippingDelivery?.charges || "",
    fabricCareTemplateId: product.fabricCareTemplateId || "",
    fabricType: product.fabricCare?.fabricType || "Cotton",
    careInstructions: (product.fabricCare?.careInstructions || ["Machine wash cold", "Do not bleach"]).join(", "),
    stock: String(product.stock),
    isActive: product.isActive,
  };
}

export function AdminPanelClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState<BrandFormState>(defaultBrandForm);
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextBrands, nextProducts, nextPendingProducts] = await Promise.all([
        getAdminBrands(),
        getAdminProducts(),
        getPendingProducts(),
      ]);
      setBrands(nextBrands);
      setProducts(nextProducts);
      setPendingProducts(nextPendingProducts);
      setProductForm((current) => ({
        ...current,
        brandId: current.brandId || nextBrands[0]?.id || "",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load admin data";
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
      brands: brands.length,
      products: products.length,
      activeProducts: products.filter((item) => item.isActive).length,
    }),
    [brands, products],
  );

  const handleBrandSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingBrand(true);

    try {
      const payload = {
        name: brandForm.name.trim(),
        slug: brandForm.slug.trim(),
        logoUrl: brandForm.logoUrl.trim() || undefined,
        description: brandForm.description.trim() || undefined,
        verified: brandForm.verified,
      };

      if (editingBrandId) {
        await updateBrand(editingBrandId, payload);
        pushToast("Brand updated", "success");
      } else {
        const result = await createBrand(payload);
        setInviteUrl(result.inviteUrl);
        pushToast("Brand created", "success");
      }

      setEditingBrandId(null);
      setBrandForm(defaultBrandForm);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save brand";
      pushToast(message, "error");
    } finally {
      setIsSavingBrand(false);
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

  const handleDeleteBrand = async (brand: Brand) => {
    if (!window.confirm(`Delete brand ${brand.name}?`)) return;

    try {
      await deleteBrand(brand.id);
      pushToast("Brand deleted", "success");
      if (editingBrandId === brand.id) {
        setEditingBrandId(null);
        setBrandForm(defaultBrandForm);
      }
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete brand";
      pushToast(message, "error");
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
      {inviteUrl ? (
        <section className="border border-black bg-black p-4 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-300">Brand invite</p>
          <p className="mt-2 text-sm">A secure invite link was generated for the new brand account.</p>
          <p className="mt-2 break-all text-sm underline">{inviteUrl}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brands</p>
          <p className="mt-3 font-heading text-4xl">{totals.brands}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.products}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Active Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.activeProducts}</p>
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
                <button
                  type="button"
                  onClick={() => void handleApproveProduct(product)}
                  className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void handleRejectProduct(product)}
                  className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <form className="space-y-3 border border-zinc-300 p-4" onSubmit={handleBrandSubmit}>
          <h2 className="font-heading text-3xl uppercase">{editingBrandId ? "Edit Brand" : "Create Brand"}</h2>
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Brand name"
            value={brandForm.name}
            onChange={(event) => setBrandForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Slug"
            value={brandForm.slug}
            onChange={(event) => setBrandForm((current) => ({ ...current, slug: event.target.value }))}
            required
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Logo URL"
            value={brandForm.logoUrl}
            onChange={(event) => setBrandForm((current) => ({ ...current, logoUrl: event.target.value }))}
          />
          <textarea
            className="min-h-24 w-full border border-zinc-300 p-3"
            placeholder="Description"
            value={brandForm.description}
            onChange={(event) => setBrandForm((current) => ({ ...current, description: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={brandForm.verified}
              onChange={(event) => setBrandForm((current) => ({ ...current, verified: event.target.checked }))}
            />
            Verified brand
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isSavingBrand} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
              {isSavingBrand ? "Saving" : editingBrandId ? "Update Brand" : "Create Brand"}
            </button>
            {editingBrandId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingBrandId(null);
                  setBrandForm(defaultBrandForm);
                }}
                className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <form className="space-y-3 border border-zinc-300 p-4" onSubmit={handleProductSubmit}>
          <h2 className="font-heading text-3xl uppercase">{editingProductId ? "Edit Product" : "Create Product"}</h2>
          <select
            className="h-10 w-full border border-zinc-300 px-3"
            value={productForm.brandId}
            onChange={(event) => setProductForm((current) => ({ ...current, brandId: event.target.value }))}
            required
          >
            <option value="" disabled>Select brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Product name"
            value={productForm.name}
            onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Slug"
            value={productForm.slug}
            onChange={(event) => setProductForm((current) => ({ ...current, slug: event.target.value }))}
            required
          />
          <textarea
            className="min-h-24 w-full border border-zinc-300 p-3"
            placeholder="Description"
            value={productForm.description}
            onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 w-full border border-zinc-300 px-3"
              type="number"
              min={1}
              placeholder="Price PKR"
              value={productForm.pricePkr}
              onChange={(event) => setProductForm((current) => ({ ...current, pricePkr: event.target.value }))}
              required
            />
            <input
              className="h-10 w-full border border-zinc-300 px-3"
              type="number"
              min={0}
              placeholder="Stock"
              value={productForm.stock}
              onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full border border-zinc-300 px-3"
              value={productForm.topCategory}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  topCategory: event.target.value as ProductFormState["topCategory"],
                }))
              }
            >
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Kids">Kids</option>
            </select>
            <input
              className="h-10 w-full border border-zinc-300 px-3"
              placeholder="Sub category"
              value={productForm.subCategory}
              onChange={(event) => setProductForm((current) => ({ ...current, subCategory: event.target.value }))}
              required
            />
          </div>
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Sizes (comma separated, e.g. S,M,L)"
            value={productForm.sizes}
            onChange={(event) => setProductForm((current) => ({ ...current, sizes: event.target.value }))}
            required
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Image URL"
            value={productForm.imageUrl}
            onChange={(event) => setProductForm((current) => ({ ...current, imageUrl: event.target.value }))}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={productForm.isActive}
              onChange={(event) => setProductForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
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
      </section>

      <section className="space-y-3 border border-zinc-300 p-4">
        <h2 className="font-heading text-3xl uppercase">Brands</h2>
        {isLoading ? <p className="text-sm text-zinc-600">Loading...</p> : null}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-3 border-b border-zinc-300 pb-2 text-xs uppercase tracking-[0.12em] text-zinc-600">
          <span>Name</span>
          <span>Slug</span>
          <span>Verified</span>
          <span>Actions</span>
        </div>
        {brands.map((brand) => (
          <div key={brand.id} className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-3 border-b border-zinc-200 py-2 text-sm">
            <span>{brand.name}</span>
            <span>{brand.slug}</span>
            <span>{brand.verified ? "Yes" : "No"}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingBrandId(brand.id);
                  setBrandForm(toBrandFormState(brand));
                }}
                className="border border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.12em]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteBrand(brand)}
                className="border border-black bg-black px-3 py-1 text-xs uppercase tracking-[0.12em] text-white"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 border border-zinc-300 p-4">
        <h2 className="font-heading text-3xl uppercase">Products</h2>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 border-b border-zinc-300 pb-2 text-xs uppercase tracking-[0.12em] text-zinc-600">
          <span>Name</span>
          <span>Brand</span>
          <span>Category</span>
          <span>Price</span>
          <span>Actions</span>
        </div>
        {products.map((product) => (
          <div key={product.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-zinc-200 py-2 text-sm">
            <span>{product.name}</span>
            <span>{product.brand?.name || "-"}</span>
            <span>{product.topCategory} / {product.subCategory}</span>
            <span>PKR {product.pricePkr.toLocaleString()} {product.approvalStatus ? `(${product.approvalStatus})` : ""}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingProductId(product.id);
                  setProductForm(toProductFormState(product));
                }}
                className="border border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.12em]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteProduct(product)}
                className="border border-black bg-black px-3 py-1 text-xs uppercase tracking-[0.12em] text-white"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
