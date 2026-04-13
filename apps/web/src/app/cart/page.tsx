"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { getProductPricing } from "@/lib/pricing";
import { formatPkr } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useToastStore } from "@/stores/toast-store";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const pushToast = useToastStore((state) => state.pushToast);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [previewItemKey, setPreviewItemKey] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ productId: string; selectedColor?: string; selectedSize?: string } | null>(null);

  const getRowKey = useCallback(
    (item: (typeof items)[number]) => `${item.product.id}:${item.selectedSize || ""}:${item.selectedColor || ""}`,
    [],
  );

  const allSelected = items.length > 0 && selectedRows.length === items.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRows([]);
    } else {
      setSelectedRows(items.map(getRowKey));
    }
  };

  const toggleRow = (key: string) => {
    setSelectedRows((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const subtotal = items.reduce((total, item) => total + getProductPricing(item.product).finalPrice * item.quantity, 0);
  const selectedSubtotal = useMemo(
    () =>
      items
        .filter((item) => selectedRows.includes(getRowKey(item)))
        .reduce((total, item) => total + getProductPricing(item.product).finalPrice * item.quantity, 0),
    [getRowKey, items, selectedRows],
  );

  const previewItem = items.find((item) => getRowKey(item) === previewItemKey) || null;
  const checkoutHref = selectedRows.length
    ? `/checkout?items=${encodeURIComponent(selectedRows.join(","))}`
    : "/checkout";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Checkout</p>
        <h1 className="font-heading text-5xl uppercase">Cart</h1>
      </header>

      <section className="space-y-3">
        {items.length === 0 ? (
          <p className="border border-zinc-300 p-6 text-sm uppercase tracking-[0.12em] text-zinc-600">Your cart is empty.</p>
        ) : (
          <>
            <div className="flex items-center justify-between border border-zinc-300 px-4 py-3">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                Select all
              </label>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">Selected: {selectedRows.length}</p>
            </div>

            {items.map((item) => {
              const rowKey = getRowKey(item);
              const pricing = getProductPricing(item.product);
              return (
                <article key={rowKey} className="grid gap-3 border border-zinc-300 p-4 md:grid-cols-[auto_88px_1fr_auto_auto] md:items-center">
                  <input type="checkbox" checked={selectedRows.includes(rowKey)} onChange={() => toggleRow(rowKey)} />

                  <button
                    type="button"
                    className="relative block h-20 w-20 overflow-hidden border border-zinc-300"
                    title="Preview image"
                    aria-label="Preview product image"
                    onClick={() => setPreviewItemKey(rowKey)}
                  >
                    <Image src={item.product.imageUrl} alt={item.product.name} fill sizes="80px" className="object-cover" />
                  </button>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{item.product.brand?.name || "Verified Brand"}</p>
                    <Link href={`/product/${item.product.slug}`} className="font-semibold uppercase tracking-[0.08em] hover:underline">
                      {item.product.name}
                    </Link>
                    {pricing.hasDiscount ? (
                      <p className="text-sm text-zinc-600">
                        <span className="font-semibold text-black">{formatPkr(pricing.finalPrice)}</span>
                        <span className="ml-2 text-xs text-zinc-500 line-through">{formatPkr(pricing.basePrice)}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-600">{formatPkr(pricing.basePrice)}</p>
                    )}
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Color: {item.selectedColor || item.product.colors?.[0] || "Black"} | Size: {item.selectedSize || item.product.sizes[0] || "One Size"}
                    </p>
                  </div>

                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => {
                      updateQuantity(item.product.id, Number(event.target.value), {
                        selectedColor: item.selectedColor,
                        selectedSize: item.selectedSize,
                      });
                      pushToast("Cart quantity updated", "info");
                    }}
                    className="h-10 w-20 border border-zinc-300 px-2"
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRemoveTarget({
                        productId: item.product.id,
                        selectedColor: item.selectedColor,
                        selectedSize: item.selectedSize,
                      })
                    }
                  >
                    Remove
                  </Button>
                </article>
              );
            })}
          </>
        )}
      </section>

      <section className="grid gap-2 border border-zinc-300 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">Subtotal (All)</p>
          <p className="font-heading text-2xl uppercase">{formatPkr(subtotal)}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">Subtotal (Selected)</p>
          <p className="font-heading text-2xl uppercase">{formatPkr(selectedSubtotal)}</p>
        </div>
      </section>

      <Link href={checkoutHref} className="inline-flex h-11 items-center border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white">
        {selectedRows.length ? `Checkout Selected (${selectedRows.length})` : "Proceed to Checkout"}
      </Link>

      <ConfirmModal
        open={!!removeTarget}
        title="Remove Cart Item"
        description="Are you sure you want to remove this item from your cart?"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          removeFromCart(removeTarget.productId, {
            selectedColor: removeTarget.selectedColor,
            selectedSize: removeTarget.selectedSize,
          });
          pushToast("Removed from cart", "info");
          setRemoveTarget(null);
        }}
      />

      {previewItem ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewItemKey(null)}>
          <div className="relative h-[85vh] w-full max-w-3xl border border-zinc-300 bg-white" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="absolute right-3 top-3 z-10 border border-black bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]"
              onClick={() => setPreviewItemKey(null)}
            >
              Close
            </button>
            <Link
              href={`/product/${previewItem.product.slug}`}
              className="absolute left-3 top-3 z-10 border border-black bg-black px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              View Product
            </Link>
            <Link href={`/product/${previewItem.product.slug}`} className="absolute inset-0" aria-label="Open product detail page">
              <Image src={previewItem.product.imageUrl} alt={`${previewItem.product.name} preview`} fill className="object-contain" sizes="100vw" />
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
