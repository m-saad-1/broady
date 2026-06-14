"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import {
  getBrandDashboardNotifications,
  getBrandDashboardOrders,
  getBrandDashboardOverview,
  getBrandDashboardProducts,
  submitBrandProduct,
  updateBrandDashboardProduct,
  updateBrandOrderStatus,
} from "@/lib/api";
import { buildBrandProductPayload, createDefaultProductFormValues, productToFormValues } from "@/lib/product-form";
import type { ProductFormValues } from "@/lib/product-form";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { getOrderStatusLabel, getOrderStatusOptions } from "@/lib/order-status";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder, BrandDashboardOverview, NotificationItem, Product } from "@/types/marketplace";

type BrandDashboardClientProps = {
  mode?: "dashboard" | "orders";
};

function createEmptyBrandProductForm() {
  const { brandId: _brandId, ...form } = createDefaultProductFormValues("brand");
  return form;
}

export function BrandDashboardClient({ mode = "dashboard" }: BrandDashboardClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [overview, setOverview] = useState<BrandDashboardOverview | null>(null);
  const [orders, setOrders] = useState<BrandDashboardOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, { status: string; trackingId: string; note: string; failureReason: string; failureReasonMessage: string }>>({});
  const [pendingStatusOrderId, setPendingStatusOrderId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, Omit<ProductFormValues, "brandId">>>({});
  const [newProduct, setNewProduct] = useState<Omit<ProductFormValues, "brandId">>(createEmptyBrandProductForm());
  const showOperationsPanels = mode === "dashboard";

  const loadAll = useCallback(async (refreshMode = false) => {
    if (refreshMode) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextOverview, nextOrders, nextProducts, nextNotifications] = await Promise.all([
        getBrandDashboardOverview(),
        getBrandDashboardOrders(),
        showOperationsPanels ? getBrandDashboardProducts() : Promise.resolve([] as Product[]),
        showOperationsPanels ? getBrandDashboardNotifications() : Promise.resolve([] as NotificationItem[]),
      ]);
      setOverview(nextOverview);
      setOrders(nextOrders);
      setProducts(nextProducts);
      setNotifications(nextNotifications);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load brand dashboard";
      pushToast(message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushToast, showOperationsPanels]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const drafts: Record<string, { status: string; trackingId: string; note: string; failureReason: string; failureReasonMessage: string }> = {};
    for (const order of orders) {
      drafts[order.id] = {
        status: order.status,
        trackingId: order.trackingId || "",
        note: "",
        failureReason: order.failureReason || "",
        failureReasonMessage: "",
      };
    }
    setOrderDrafts(drafts);
  }, [orders]);

  useEffect(() => {
    const drafts: Record<string, Omit<ProductFormValues, "brandId">> = {};
    for (const product of products) {
      const { brandId: _brandId, ...baseForm } = createDefaultProductFormValues("brand");
      drafts[product.id] = {
        ...baseForm,
        ...productToFormValues(product),
      };
    }
    setProductDrafts(drafts);
  }, [products]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const changeOrderStatus = async (orderId: string) => {
    const draft = orderDrafts[orderId];
    if (!draft) return;

    setSavingOrderId(orderId);
    try {
      await updateBrandOrderStatus(orderId, {
        status: draft.status,
        trackingId: draft.trackingId.trim() || undefined,
        note: draft.note.trim() || undefined,
        failureReason: draft.failureReason.trim() || undefined,
        failureReasonMessage: draft.failureReasonMessage.trim() || undefined,
      });
      pushToast("Order status updated", "success");
      await loadAll(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update order";
      pushToast(message, "error");
    } finally {
      setSavingOrderId(null);
    }
  };

  const saveProduct = async (productId: string) => {
    const draft = productDrafts[productId];
    if (!draft) return;

    setSavingProductId(productId);
    try {
      await updateBrandDashboardProduct(productId, buildBrandProductPayload(draft));
      pushToast("Product updated", "success");
      setEditingProductId(null);
      await loadAll(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update product";
      pushToast(message, "error");
    } finally {
      setSavingProductId(null);
    }
  };

  const submitNewProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingProduct(true);

    try {
      await submitBrandProduct(buildBrandProductPayload(newProduct));
      pushToast("Product submitted for Broady approval", "success");
      setNewProduct(createEmptyBrandProductForm());
      await loadAll(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit product";
      pushToast(message, "error");
    } finally {
      setCreatingProduct(false);
    }
  };

  const approvalTone: Record<string, string> = {
    PENDING: "border-amber-300 bg-amber-50 text-amber-700",
    APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-700",
    REJECTED: "border-red-300 bg-red-50 text-red-700",
    DRAFT: "border-zinc-300 bg-zinc-100 text-zinc-700",
  };

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading brand dashboard...</p>;
  }

  if (!overview) {
    return <p className="border border-red-300 bg-red-50 p-4 text-sm text-red-700">No brand membership found for this account.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4 border border-zinc-300 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand</p>
          <h2 className="mt-2 font-heading text-4xl uppercase">{overview.brand.name}</h2>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">Unread alerts: {unreadCount}</p>
        </div>
        <button type="button" onClick={() => void loadAll(true)} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Orders</p>
          <p className="mt-3 font-heading text-3xl">{overview.metrics.totalOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Open Orders</p>
          <p className="mt-3 font-heading text-3xl">{overview.metrics.openOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivered Orders</p>
          <p className="mt-3 font-heading text-3xl">{overview.metrics.deliveredOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Sales</p>
          <p className="mt-3 font-heading text-3xl">PKR {overview.metrics.totalSalesPkr.toLocaleString()}</p>
        </article>
      </section>

      <section className="space-y-3 border border-zinc-300 p-4">
        <h2 className="font-heading text-3xl uppercase">Orders</h2>
        <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(140px,1fr)_auto] gap-3 border-b border-zinc-300 pb-2 text-xs uppercase tracking-[0.12em] text-zinc-600">
          <span>Order</span>
          <span>Customer</span>
          <span>Payment</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {orders.map((order) => (
          <div key={order.id} className="space-y-2 border-b border-zinc-200 py-3">
            <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(140px,1fr)_auto] items-center gap-3 text-sm">
              <span>
                <Link href={`/brand/orders/${order.id}`} className="underline decoration-zinc-400 underline-offset-2">
                  {order.id.slice(0, 10)}...
                </Link>
                {' '} / PKR {order.totalPkr.toLocaleString()}
              </span>
              <span>{order.user.fullName}</span>
              <span>{order.paymentMethod} / {order.paymentStatus}</span>
              <span>{order.status}</span>
              <div className="flex items-center gap-2">
                <select
                  value={orderDrafts[order.id]?.status || order.status}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOrderDrafts((current) => ({
                      ...current,
                      [order.id]: {
                        ...current[order.id],
                        status: value,
                      },
                    }));
                  }}
                  disabled={savingOrderId === order.id}
                  className="h-9 border border-zinc-300 px-2 text-xs"
                >
                  <option value={order.status} disabled>
                    Current: {getOrderStatusLabel(order.status)}
                  </option>
                  {getOrderStatusOptions(order.status).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPendingStatusOrderId(order.id)}
                  disabled={savingOrderId === order.id}
                  className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  {savingOrderId === order.id ? "Saving" : "Update"}
                </button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className="h-9 border border-zinc-300 px-3 text-xs"
                placeholder="Tracking ID"
                value={orderDrafts[order.id]?.trackingId || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setOrderDrafts((current) => ({
                    ...current,
                    [order.id]: {
                      ...current[order.id],
                      trackingId: value,
                    },
                  }));
                }}
              />
              <input
                className="h-9 border border-zinc-300 px-3 text-xs"
                placeholder="Internal note"
                value={orderDrafts[order.id]?.note || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setOrderDrafts((current) => ({
                    ...current,
                    [order.id]: {
                      ...current[order.id],
                      note: value,
                    },
                  }));
                }}
              />
              {(orderDrafts[order.id]?.status === "DELIVERY_FAILED" || orderDrafts[order.id]?.status === "ADDRESS_CORRECTION_REQUIRED") && (
                <>
                  <select
                    className="h-9 border border-zinc-300 px-3 text-xs"
                    value={orderDrafts[order.id]?.failureReason || ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setOrderDrafts((current) => ({
                        ...current,
                        [order.id]: {
                          ...current[order.id],
                          failureReason: value,
                        },
                      }));
                    }}
                  >
                    <option value="">Select failure reason...</option>
                    <option value="INCORRECT_ADDRESS">Incorrect Address</option>
                    <option value="CUSTOMER_NOT_AVAILABLE">Customer Unavailable</option>
                    <option value="REFUSED_DELIVERY">Refused by Customer</option>
                    <option value="PHONE_UNREACHABLE">Phone Unreachable</option>
                    <option value="AREA_NOT_SERVICEABLE">Area Not Serviceable</option>
                    <option value="COURIER_ISSUE">Courier Issue</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    className="h-9 border border-zinc-300 px-3 text-xs"
                    placeholder="Failure details (optional)"
                    value={orderDrafts[order.id]?.failureReasonMessage || ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setOrderDrafts((current) => ({
                        ...current,
                        [order.id]: {
                          ...current[order.id],
                          failureReasonMessage: value,
                        },
                      }));
                    }}
                  />
                </>
              )}
            </div>
            <p className="text-xs text-zinc-600">
              Items: {order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}
            </p>
          </div>
        ))}
      </section>

      <ConfirmModal
        open={Boolean(pendingStatusOrderId)}
        title="Confirm Status Update"
        description={(() => {
          if (!pendingStatusOrderId) return "";
          const targetOrder = orders.find((item) => item.id === pendingStatusOrderId);
          const draft = targetOrder ? orderDrafts[targetOrder.id] : undefined;
          if (!targetOrder || !draft) return "";
          return `Order ${targetOrder.id.slice(0, 10)}... will be updated to ${draft.status}${draft.trackingId ? ` with tracking ${draft.trackingId}` : ""}.`;
        })()}
        confirmText="Confirm update"
        cancelText="Review again"
        onCancel={() => setPendingStatusOrderId(null)}
        onConfirm={() => {
          if (!pendingStatusOrderId) return;
          void changeOrderStatus(pendingStatusOrderId);
          setPendingStatusOrderId(null);
        }}
      />

      {showOperationsPanels ? (
        <>
          <section className="space-y-3 border border-zinc-300 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-3xl uppercase">Submit Product</h2>
              <button
                type="button"
                onClick={() => setShowAddProductForm((current) => !current)}
                className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              >
                {showAddProductForm ? "Hide Form" : "Add Product"}
              </button>
            </div>
            {showAddProductForm ? (
              <form className="grid gap-3 md:grid-cols-2" onSubmit={submitNewProduct}>
              <input className="h-10 border border-zinc-300 px-3" placeholder="Product name" value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} required />
              <input className="h-10 border border-zinc-300 px-3" placeholder="Slug" value={newProduct.slug} onChange={(event) => setNewProduct((current) => ({ ...current, slug: event.target.value }))} required />
              <textarea className="min-h-24 border border-zinc-300 p-3 md:col-span-2" placeholder="Description" value={newProduct.description} onChange={(event) => setNewProduct((current) => ({ ...current, description: event.target.value }))} required />
              <input className="h-10 border border-zinc-300 px-3" type="number" min={1} placeholder="Price PKR" value={newProduct.pricePkr} onChange={(event) => setNewProduct((current) => ({ ...current, pricePkr: event.target.value }))} required />
              <input className="h-10 border border-zinc-300 px-3" type="number" min={0} placeholder="Stock" value={newProduct.stock} onChange={(event) => setNewProduct((current) => ({ ...current, stock: event.target.value }))} required />
              <select className="h-10 border border-zinc-300 px-3" value={newProduct.topCategory} onChange={(event) => setNewProduct((current) => ({ ...current, topCategory: event.target.value as Product["topCategory"] }))}>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Toddler Boys">Toddler Boys</option>
                <option value="Toddler Girls">Toddler Girls</option>
                <option value="Junior Boys">Junior Boys</option>
                <option value="Junior Girls">Junior Girls</option>
              </select>
              <input className="h-10 border border-zinc-300 px-3" placeholder="Sub category" value={newProduct.subCategory} onChange={(event) => setNewProduct((current) => ({ ...current, subCategory: event.target.value }))} required />
              <input className="h-10 border border-zinc-300 px-3 md:col-span-2" placeholder="Sizes (comma separated)" value={newProduct.sizes} onChange={(event) => setNewProduct((current) => ({ ...current, sizes: event.target.value }))} required />
              <input className="h-10 border border-zinc-300 px-3 md:col-span-2" placeholder="Image URL" value={newProduct.imageUrl} onChange={(event) => setNewProduct((current) => ({ ...current, imageUrl: event.target.value }))} required />
              <button type="submit" disabled={creatingProduct} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50 md:col-span-2">
                {creatingProduct ? "Submitting" : "Submit for approval"}
              </button>
              </form>
            ) : (
              <p className="text-sm text-zinc-600">Use Add Product to open the submission form.</p>
            )}
          </section>

          <section className="space-y-3 border border-zinc-300 p-4">
            <h2 className="font-heading text-3xl uppercase">Products</h2>
            {products.map((product) => (
              <article key={product.id} className="space-y-3 border-b border-zinc-200 py-3">
                <div className="grid items-center gap-3 md:grid-cols-[72px_2fr_1fr_1fr_auto]">
                  <div className="relative h-16 w-16 overflow-hidden border border-zinc-200">
                    <ProductImage src={product.imageUrl} alt={product.name} fill className="object-cover" />
                  </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">{product.name}</p>
                  <p className="text-xs text-zinc-600">{product.topCategory} / {product.subCategory}</p>
                </div>
                <p className="text-sm">PKR {product.pricePkr.toLocaleString()}</p>
                <span className={`inline-flex w-fit border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${approvalTone[product.approvalStatus || "APPROVED"] || approvalTone.APPROVED}`}>
                  {product.approvalStatus || "APPROVED"}
                </span>
                <div className="flex items-center gap-2">
                  <Link href={`/product/${product.slug}`} className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] leading-9">
                    View Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditingProductId((current) => (current === product.id ? null : product.id))}
                    className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    {editingProductId === product.id ? "Close Edit" : "Edit"}
                  </button>
                </div>
                </div>

                {editingProductId === product.id ? (
                  <div className="grid gap-2 border border-zinc-200 p-3 md:grid-cols-2">
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs"
                      value={productDrafts[product.id]?.name || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          name: event.target.value,
                        },
                      }))}
                      placeholder="Name"
                    />
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs"
                      value={productDrafts[product.id]?.slug || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          slug: event.target.value,
                        },
                      }))}
                      placeholder="Slug"
                    />
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs"
                      value={productDrafts[product.id]?.pricePkr || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          pricePkr: event.target.value,
                        },
                      }))}
                      placeholder="Price"
                      type="number"
                      min={1}
                    />
                    <select
                      className="h-9 border border-zinc-300 px-3 text-xs"
                      value={productDrafts[product.id]?.topCategory || "Men"}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          topCategory: event.target.value as Product["topCategory"],
                        },
                      }))}
                    >
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Toddler Boys">Toddler Boys</option>
                          <option value="Toddler Girls">Toddler Girls</option>
                          <option value="Junior Boys">Junior Boys</option>
                          <option value="Junior Girls">Junior Girls</option>
                    </select>
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs"
                      value={productDrafts[product.id]?.subCategory || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          subCategory: event.target.value,
                        },
                      }))}
                      placeholder="Sub category"
                    />
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs md:col-span-2"
                      value={productDrafts[product.id]?.sizes || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          sizes: event.target.value,
                        },
                      }))}
                      placeholder="Sizes (comma separated)"
                    />
                    <textarea
                      className="min-h-20 border border-zinc-300 p-3 text-xs md:col-span-2"
                      value={productDrafts[product.id]?.description || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          description: event.target.value,
                        },
                      }))}
                      placeholder="Description"
                    />
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs md:col-span-2"
                      value={productDrafts[product.id]?.imageUrl || ""}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          imageUrl: event.target.value,
                        },
                      }))}
                      placeholder="Image URL"
                    />
                    <input
                      className="h-9 border border-zinc-300 px-3 text-xs"
                      value={productDrafts[product.id]?.stock || "0"}
                      onChange={(event) => setProductDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                          stock: event.target.value,
                        },
                      }))}
                      placeholder="Stock"
                      type="number"
                      min={0}
                    />
                    <label className="flex items-center gap-2 text-xs uppercase tracking-[0.12em]">
                      <input
                        type="checkbox"
                        checked={Boolean(productDrafts[product.id]?.isActive)}
                        onChange={(event) => setProductDrafts((current) => ({
                          ...current,
                          [product.id]: {
                            ...(current[product.id] || { name: "", slug: "", description: "", pricePkr: "", topCategory: "Men", subCategory: "", sizes: "", stock: "0", imageUrl: "", isActive: true }),
                            isActive: event.target.checked,
                          },
                        }))}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveProduct(product.id)}
                      disabled={savingProductId === product.id}
                      className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50 md:col-span-2"
                    >
                      {savingProductId === product.id ? "Saving" : "Save Changes"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </section>

          <section className="space-y-3 border border-zinc-300 p-4">
            <h2 className="font-heading text-3xl uppercase">Notifications</h2>
            {notifications.length ? (
              notifications.slice(0, 20).map((item) => (
                <article key={item.id} className="border border-zinc-200 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.type}</p>
                  <p className="mt-1 text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-zinc-700">{item.message}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Channels: {item.channels.map((channel) => `${channel.channel}:${channel.status}`).join(" | ")}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-zinc-600">No notifications yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
