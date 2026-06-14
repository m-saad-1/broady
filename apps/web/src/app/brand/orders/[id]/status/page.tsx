"use client";

import { use, useEffect, useState } from "react";
import { getBrandDashboardOrder, updateBrandOrderStatus } from "@/lib/api";
import { getOrderStatusOptions } from "@/lib/order-status";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder, OrderStatus } from "@/types/marketplace";

export default function BrandShipmentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const pushToast = useToastStore((state) => state.pushToast);
  const resolvedParams = use(params);
  const [order, setOrder] = useState<BrandDashboardOrder | null>(null);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [trackingId, setTrackingId] = useState("");
  const [courierName, setCourierName] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    getBrandDashboardOrder(resolvedParams.id).then((data) => {
      setOrder(data);
      setStatus((getOrderStatusOptions(data.status)[0] || "") as OrderStatus | "");
      setTrackingId(data.trackingId || "");
      setCourierName(data.courierName || "");
    }).catch(() => setOrder(null));
  }, [resolvedParams.id]);

  if (!order) return <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><p className="border border-zinc-300 p-5 text-sm text-zinc-700">Order not found.</p></main>;

  const validNextStatuses = getOrderStatusOptions(order.status);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Orders</p>
        <h1 className="font-heading text-4xl uppercase">Shipment Status Update</h1>
      </header>
      <section className="space-y-3 border border-zinc-300 p-5">
        <p className="text-sm">Current status: {order.status}</p>
        <select className="h-10 w-full border border-zinc-300 px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "")}>
          <option value="">Select next status</option>
          {validNextStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="h-10 w-full border border-zinc-300 px-3 text-sm" placeholder="Tracking number" value={trackingId} onChange={(event) => setTrackingId(event.target.value)} />
        <input className="h-10 w-full border border-zinc-300 px-3 text-sm" placeholder="Courier name" value={courierName} onChange={(event) => setCourierName(event.target.value)} />
        <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm" placeholder="Operational note" value={note} onChange={(event) => setNote(event.target.value)} />
        <button
          type="button"
          onClick={async () => {
            if (!status || !(validNextStatuses as OrderStatus[]).includes(status)) {
              pushToast("Select a valid next status from the transition matrix.", "error");
              return;
            }
            if (status === "SHIPPED" && !trackingId.trim()) {
              pushToast("Tracking number is required before moving to Shipped.", "error");
              return;
            }
            if (["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status) && !window.confirm(`Move sub-order to ${status}?`)) return;
            try {
              await updateBrandOrderStatus(order.id, { status, trackingId: trackingId || undefined, courierName: courierName || undefined, note: note || undefined });
              pushToast("Shipment status updated.", "success");
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Unable to update shipment status.", "error");
            }
          }}
          className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
        >
          Submit Update
        </button>
      </section>
    </main>
  );
}
