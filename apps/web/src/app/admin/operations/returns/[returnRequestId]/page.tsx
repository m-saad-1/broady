"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { getAdminReturnRequest } from "@/lib/api";
import {
  formatOperatorReturnStatus,
  formatReturnReasonLabel,
  formatReturnStatus,
  getDisplayReturnStatus,
  getFinalRequestLabel,
  getReturnRequestItems,
  isAvailabilityRejected,
  isExchangeRequest,
} from "@/lib/return-workflow";
import type { ReturnRequestRecord } from "@/types/marketplace";
import { AdminReturnDetailActions } from "./admin-return-detail-actions";

type PageProps = {
  params: Promise<{ returnRequestId: string }>;
};

function formatDateTime(value?: string | null) {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function money(value?: number | null) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function itemSummary(
  items?: Array<{
    id: string;
    quantity: number;
    product?: { name?: string };
  }>,
) {
  if (!items?.length) return "No items listed";
  return items.map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ");
}

function EvidenceLinks({ title, urls }: { title: string; urls?: string[] }) {
  if (!urls?.length) {
    return (
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{title}</p>
        <p className="text-sm text-zinc-600">No files uploaded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <a
            key={`${title}-${index}-${url}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700"
          >
            View Evidence {index + 1}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AdminReturnDetailPage({ params }: PageProps) {
  const { returnRequestId } = use(params);
  const [request, setRequest] = useState<ReturnRequestRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminReturnRequest(returnRequestId)
      .then(setRequest)
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, [returnRequestId]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10">
        <p className="border border-zinc-300 p-5 text-sm text-zinc-700">Loading request detail...</p>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10">
        <p className="border border-zinc-300 p-5 text-sm text-zinc-700">Return request not found.</p>
      </main>
    );
  }

  const isExchange = isExchangeRequest(request);
  const displayStatus = getDisplayReturnStatus(request);
  const refundSnapshot = request.refundRequests || [];
  const requestItems = getReturnRequestItems(request);
  const itemCount = requestItems.reduce((sum, item) => sum + item.quantity, 0);
  const finalLabel = getFinalRequestLabel(request);
  const convertedToRefund = Boolean(request.convertedToRefund);
  const requestType = isExchange ? "EXCHANGE" : "RETURN";
  const availabilityRejected = isAvailabilityRejected(request);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Operations</p>
        <h1 className="font-heading text-4xl uppercase">{isExchange ? "Exchange" : "Return"} Audit Detail</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Use this page to verify evidence, inspect the request lifecycle, and confirm what should happen next in the return or exchange workflow.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/operations?tab=returns" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Back to Return Queue
          </Link>
          <Link href="/admin/operations?tab=refunds" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Open Refund Queue
          </Link>
        </div>
      </header>

      {convertedToRefund ? (
        <section className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          This exchange has been converted to a refund flow.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request</p>
          <p className="mt-2 text-sm font-semibold">{request.id}</p>
          <p className="mt-2 inline-flex border border-zinc-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">{requestType}</p>
          <p className="mt-2 text-sm text-zinc-600">{formatOperatorReturnStatus(displayStatus, requestType)}</p>
          <p className="mt-2 text-xs text-zinc-500">Created: {formatDateTime(request.createdAt)}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order / Brand</p>
          <p className="mt-2 text-sm font-semibold">{request.orderId}</p>
          <p className="mt-2 text-sm text-zinc-600">{request.subOrder?.brand?.name || "Brand"}</p>
          <p className="mt-2 text-xs text-zinc-500">{request.subOrderId} | {itemCount} item(s)</p>
          <p className="mt-2 text-xs text-zinc-500">Customer: {request.order?.user?.fullName || "Customer"}{request.order?.user?.email ? ` • ${request.order.user.email}` : ""}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Resolution</p>
          <p className="mt-2 text-sm font-semibold">{finalLabel}</p>
          <p className="mt-2 text-sm text-zinc-600">Current admin note: {request.reviewNote || "No admin note yet"}</p>
          <p className="mt-2 text-xs text-zinc-500">Updated: {formatDateTime(request.updatedAt)}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <article className="space-y-4 border border-zinc-300 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Items Under Review</p>
              <h2 className="font-heading text-3xl uppercase">Item audit</h2>
            </div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{itemCount} total units</p>
          </div>
          <p className="text-sm text-zinc-600">Item summary: {itemSummary(requestItems)}</p>
          <div className="grid gap-2 border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p><span className="font-semibold">Request type:</span> {requestType}</p>
            <p><span className="font-semibold">Customer reason:</span> {formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
            <p><span className="font-semibold">Customer note:</span> {request.customerNote || "No customer note"}</p>
            <p><span className="font-semibold">Current stage:</span> {formatOperatorReturnStatus(displayStatus, requestType)}</p>
            <p><span className="font-semibold">Payment method:</span> {request.order?.paymentMethod || "N/A"}</p>
            <p><span className="font-semibold">Order date:</span> {formatDateTime(request.order?.createdAt)}</p>
          </div>
          <div className="space-y-3">
            {requestItems.map((item) => (
              <article key={item.id} className="border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.product?.name || "Product"}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Quantity {item.quantity}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.selectedColor || "No color"} / {item.selectedSize || "No size"}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">{item.product?.id || "No product id"}</p>
                </div>
              </article>
            ))}
          </div>
          {isExchange ? (
            <section className="border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              <p className="font-semibold uppercase tracking-[0.12em]">Replacement request</p>
              <p className="mt-2">Requested replacement: {request.requestedVariantSummary || "Exchange request"}</p>
              <p className="mt-2">Color: {request.requestedReplacementColor || "Not provided"}</p>
              <p className="mt-2">Size: {request.requestedReplacementSize || "Not provided"}</p>
            </section>
          ) : null}
        </article>

        <article className="space-y-4 border border-zinc-300 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Evidence</p>
            <h2 className="font-heading text-3xl uppercase">Decision trail</h2>
          </div>
          <div className="space-y-3 text-sm text-zinc-700">
            <p>Customer images: {(request.evidenceImageUrls || []).length}</p>
            <p>Brand evidence: {(request.damageEvidenceUrls || []).length}</p>
            <p>Brand decision: {request.brandRecommendation || "Pending"}</p>
            <p>Brand note: {request.brandRecommendationNote || "No note yet"}</p>
            <p>Admin rejected reason: {request.adminRejectedReason || "Not rejected"}</p>
            <p>Pickup tracking: {request.pickupTracking || "Not set"}</p>
            <p>Return tracking: {request.returnTrackingNumber || "Not set"}</p>
            <p>Replacement status: {isExchange ? formatReturnStatus(displayStatus) : "Not applicable"}</p>
            <p>Replacement tracking: {request.replacementTrackingNo || "Not set"}</p>
          </div>
          <EvidenceLinks title="Customer Evidence" urls={request.evidenceImageUrls} />
          <EvidenceLinks title="Brand Evidence" urls={request.damageEvidenceUrls} />
          {request.replacementUnavailableReason ? (
            <section className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Replacement unavailable reason: {request.replacementUnavailableReason}
            </section>
          ) : null}
          {availabilityRejected ? (
            <section className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This exchange rejection is availability-based. Admin has read-only visibility unless the case is reopened manually.
            </section>
          ) : null}
          <div className="space-y-2 border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Linked refunds</p>
            {refundSnapshot.length ? (
              refundSnapshot.map((refund) => (
                <div key={refund.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{refund.status}</span>
                  <span>{money(refund.adjustedAmountPkr || refund.amountPkr)}</span>
                  <span>{refund.method || "ORIGINAL_SOURCE"}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-600">No refund has been created yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="space-y-3 border border-zinc-300 p-5">
          <h2 className="font-heading text-3xl uppercase">Timeline</h2>
          <div className="space-y-3">
            {(request.statusLogs || []).map((log) => (
              <div key={log.id} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold uppercase tracking-[0.08em]">{formatReturnStatus(log.status)}</p>
                <p className="text-zinc-500">{formatDateTime(log.createdAt)}</p>
                {log.note ? <p className="mt-1 text-zinc-700">{log.note}</p> : null}
              </div>
            ))}
          </div>
        </article>
        <AdminReturnDetailActions request={request} />
      </section>
    </main>
  );
}
