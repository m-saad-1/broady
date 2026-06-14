"use client";

import { use, useEffect, useState } from "react";
import { getBrandDashboardOrder, updateBrandOrderStatus } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder } from "@/types/marketplace";

const REASONS = [
  { code: "CUSTOMER_NOT_AVAILABLE", label: "Customer not available" },
  { code: "REFUSED_DELIVERY", label: "Customer refused delivery" },
  { code: "INCORRECT_ADDRESS", label: "Incorrect address" },
  { code: "PHONE_UNREACHABLE", label: "Phone unreachable" },
  { code: "AREA_NOT_SERVICEABLE", label: "Area not serviceable" },
  { code: "COURIER_ISSUE", label: "Courier issue" },
  { code: "OTHER", label: "Other" },
] as const;

export default function BrandDeliveryFailurePage({ params }: { params: Promise<{ id: string }> }) {
  const pushToast = useToastStore((state) => state.pushToast);
  const resolvedParams = use(params);
  const [order, setOrder] = useState<BrandDashboardOrder | null>(null);
  const [reason, setReason] = useState<(typeof REASONS)[number]["code"]>("CUSTOMER_NOT_AVAILABLE");
  const [note, setNote] = useState("");

  useEffect(() => {
    getBrandDashboardOrder(resolvedParams.id).then(setOrder).catch(() => setOrder(null));
  }, [resolvedParams.id]);

  if (!order) return <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><p className="border border-zinc-300 p-5 text-sm text-zinc-700">Order not found.</p></main>;

  const retryAttemptsUsed = order.deliveryAttempts || 0;
  const canRetry = reason === "CUSTOMER_NOT_AVAILABLE" && retryAttemptsUsed < 2;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Orders</p>
        <h1 className="font-heading text-4xl uppercase">Delivery Failure Report</h1>
      </header>
      <section className="space-y-3 border border-zinc-300 p-5">
        <p className="text-sm">Current status: {order.status}</p>
        <p className="text-sm">Retry attempt count: {retryAttemptsUsed} of 2 used</p>
        <select className="h-10 w-full border border-zinc-300 px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value as (typeof REASONS)[number]["code"])}>
          {REASONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
        <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm" placeholder="Courier note" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="flex gap-3">
          {canRetry ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateBrandOrderStatus(order.id, { status: "DELIVERY_FAILED", failureReason: reason, note: note || undefined, nextAttemptDate: new Date(Date.now() + 24 * 60 * 60 * 1000) });
                  pushToast("Delivery failure recorded with retry path.", "success");
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to save delivery failure.", "error");
                }
              }}
              className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Retry Delivery
            </button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              try {
                await updateBrandOrderStatus(order.id, { status: "DELIVERY_FAILED", failureReason: reason, note: note || undefined });
                pushToast(reason === "REFUSED_DELIVERY" || retryAttemptsUsed >= 2 ? "Delivery failure recorded and return flow triggered." : "Delivery failure recorded.", "success");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to save delivery failure.", "error");
              }
            }}
            className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
          >
            Submit Failure
          </button>
        </div>
      </section>
    </main>
  );
}
