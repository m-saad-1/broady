"use client";

import { use, useEffect, useState } from "react";
import { cancelBrandOrder, getBrandDashboardOrder, type BrandCancelReasonCode } from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder } from "@/types/marketplace";

const BRAND_CANCEL_REASON_OPTIONS: Array<{ code: BrandCancelReasonCode; label: string }> = [
  { code: "OUT_OF_STOCK", label: "Out of stock" },
  { code: "ITEM_DAMAGED", label: "Item damaged" },
  { code: "WRONG_PRICE_LISTED", label: "Wrong price listed" },
  { code: "CANNOT_FULFILL_ORDER", label: "Cannot fulfill order" },
  { code: "ADDRESS_NOT_SERVICEABLE", label: "Address not serviceable" },
  { code: "DUPLICATE_ORDER_ISSUE", label: "Duplicate order issue" },
  { code: "OTHER", label: "Other" },
];

export default function BrandCancelOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const pushToast = useToastStore((state) => state.pushToast);
  const resolvedParams = use(params);
  const [order, setOrder] = useState<BrandDashboardOrder | null>(null);
  const [reasonCode, setReasonCode] = useState<BrandCancelReasonCode>("OUT_OF_STOCK");
  const [note, setNote] = useState("");

  useEffect(() => {
    getBrandDashboardOrder(resolvedParams.id).then(setOrder).catch(() => setOrder(null));
  }, [resolvedParams.id]);

  if (!order) return <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><p className="border border-zinc-300 p-5 text-sm text-zinc-700">Order not found.</p></main>;

  const blocked = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"].includes(order.status);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Orders</p>
        <h1 className="font-heading text-4xl uppercase">Cancel Sub-order</h1>
      </header>
      <section className="space-y-3 border border-zinc-300 p-5">
        <p className="text-sm">Sub-order: {order.id}</p>
        <p className="text-sm">Status: {order.status}</p>
        <p className="text-sm">Payment: {order.paymentMethod} / {order.paymentStatus}</p>
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-b border-zinc-200 pb-2 text-sm">
            <p>{item.product.name} x{item.quantity}</p>
            <p>{formatPkr(item.unitPricePkr * item.quantity)}</p>
          </div>
        ))}
      </section>
      {blocked ? (
        <section className="border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Cancellation is not available after shipment. Use the delivery failure flow.
        </section>
      ) : (
        <section className="space-y-3 border border-zinc-300 p-5">
          <select className="h-10 w-full border border-zinc-300 px-3 text-sm" value={reasonCode} onChange={(event) => setReasonCode(event.target.value as BrandCancelReasonCode)}>
            {BRAND_CANCEL_REASON_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
          <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm" placeholder="Additional note" value={note} onChange={(event) => setNote(event.target.value)} />
          <button
            type="button"
            onClick={async () => {
              if (reasonCode === "OTHER" && !note.trim()) {
                pushToast("A note is required when choosing Other.", "error");
                return;
              }
              if (!window.confirm(`Cancel ${order.items.length} item(s) for reason "${reasonCode}"?`)) return;
              try {
                await cancelBrandOrder(order.id, { reasonCode, note: note.trim() || undefined });
                pushToast("Cancellation submitted.", "success");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to cancel sub-order.", "error");
              }
            }}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Confirm Cancellation
          </button>
        </section>
      )}
    </main>
  );
}
