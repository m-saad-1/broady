"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBrandCancellationRequests } from "@/lib/api";
import type { CancellationRequestRecord } from "@/types/marketplace";

const cancellationResponseLabels: Record<string, string> = {
  STILL_CANCELLABLE: "Still cancellable",
  ORDER_ALREADY_PACKED: "Order already packed",
  COURIER_PICKUP_SCHEDULED: "Courier pickup scheduled",
  TRACKING_ALREADY_GENERATED: "Tracking already generated",
  ALREADY_HANDED_TO_COURIER: "Already handed to courier",
  OTHER_OPERATIONAL_REASON: "Other operational reason",
};

const resolvedCancellationStatuses = new Set(["APPROVED", "REJECTED", "CANCELLED_BY_USER"]);

function formatDistance(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m ago`;
}

function countdown(value?: string | null) {
  if (!value) return "N/A";
  const diffMs = new Date(value).getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

export default function BrandCancellationInboxPage() {
  const [requests, setRequests] = useState<CancellationRequestRecord[]>([]);
  const [filter, setFilter] = useState<"PENDING" | "RESPONDED" | "RESOLVED">("PENDING");

  useEffect(() => {
    getBrandCancellationRequests().then(setRequests).catch(() => setRequests([]));
  }, []);

  const filtered = useMemo(() => requests.filter((request) => {
    const hasBrandResponse = Boolean(request.respondedAt || request.brandResponseCode || request.brandResponseNote);
    if (filter === "PENDING") return !hasBrandResponse && ["REQUESTED", "EXPIRED"].includes(request.status);
    if (filter === "RESPONDED") return hasBrandResponse && !resolvedCancellationStatuses.has(request.status);
    return resolvedCancellationStatuses.has(request.status);
  }), [filter, requests]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-5xl uppercase">Cancellation Requests</h1>
        <p className="text-sm text-zinc-600">Respond with fulfillment evidence only. Broady keeps final approval authority.</p>
        <div className="flex gap-2">
          {(["PENDING", "RESPONDED", "RESOLVED"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={`h-10 border px-4 text-xs font-semibold uppercase tracking-[0.12em] ${filter === item ? "border-black bg-black text-white" : "border-zinc-300"}`}>
              {item === "PENDING" ? "Pending" : item === "RESPONDED" ? "Responded" : "Resolved"}
            </button>
          ))}
        </div>
      </header>
      <section className="space-y-3">
        {!filtered.length ? <p className="border border-zinc-300 p-5 text-sm text-zinc-700">No requests in this view.</p> : filtered.map((request) => {
          const urgent = request.expiresAt && new Date(request.expiresAt).getTime() - Date.now() <= 60 * 60 * 1000;
          const isBrandApproved = request.brandResponseCode === "APPROVED_STILL_CANCELLABLE" || request.history?.some((entry: any) => entry.action === "AUTO_APPROVED" || entry.action === "APPROVED");
          const responseLabel = request.brandResponseCode ? cancellationResponseLabels[request.brandResponseCode] || request.brandResponseCode : null;
          const cardTone = isBrandApproved ? "border-emerald-300 bg-emerald-50/60" : urgent ? "border-orange-300 bg-orange-50" : "border-zinc-300";

          return (
            <article key={request.id} className={`border p-4 ${cardTone}`}>
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request {request.id}</p>
                  <Link href={`/brand/orders/${request.orderId}?subOrderId=${request.subOrderId}`} className="text-sm font-semibold underline decoration-zinc-400 underline-offset-2">
                    {request.subOrderId}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-600">
                    {(request.subOrder?.items || [])
                      .filter((item: any) => !request.orderItemIds?.length || request.orderItemIds.includes(item.id))
                      .map((item: any) => `${item.product?.name || "Product"} x${item.quantity}`)
                      .join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer reason</p>
                  <p className="text-sm text-zinc-700">{request.reasonText || request.reasonCode}</p>
                  <p className="text-xs text-zinc-500">Submitted {formatDistance(request.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Window</p>
                  <p className="text-sm text-zinc-700">{countdown(request.expiresAt)} remaining</p>
                  <p className="text-xs font-semibold text-zinc-800">{isBrandApproved ? "Brand Approved" : request.status}</p>
                  {responseLabel ? <p className="mt-1 text-sm text-zinc-800"><span className="font-semibold">Brand response:</span> {responseLabel}</p> : null}
                  {request.brandResponseNote ? <p className="mt-1 text-sm text-zinc-600">{request.brandResponseNote}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {urgent ? <span className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">Urgent</span> : null}
                  <Link href="/brand/operations" className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                    Open Review Queue
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
