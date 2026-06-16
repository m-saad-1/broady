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

      <section className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Customer Submission & Items */}
        <div className="space-y-6">
          {/* Customer Request Info Card */}
          <article className="space-y-4 border border-zinc-300 p-5 bg-white">
            <header className="border-b border-zinc-200 pb-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-semibold">Customer Submission</p>
              <h2 className="font-heading text-2xl uppercase mt-1">Request Details</h2>
            </header>
            <div className="grid gap-3 border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p><span className="font-semibold text-zinc-800">Request Type:</span> <span className="uppercase font-medium">{requestType}</span></p>
              <p><span className="font-semibold text-zinc-800">Preferred Resolution:</span> <span className="uppercase font-medium text-zinc-900">{formatReturnStatus(request.preferredResolution)}</span></p>
              {request.customerRefundPreference ? (
                <p><span className="font-semibold text-zinc-800">Refund Preference:</span> {request.customerRefundPreference}</p>
              ) : null}
              <p><span className="font-semibold text-zinc-800">Reason:</span> {formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
              <p><span className="font-semibold text-zinc-800">Customer Note:</span> {request.customerNote || <span className="italic text-zinc-400">No customer note</span>}</p>
              <p><span className="font-semibold text-zinc-800">Current Stage:</span> <span className="font-semibold text-blue-700">{formatOperatorReturnStatus(displayStatus, requestType)}</span></p>
              <p><span className="font-semibold text-zinc-800">Payment Method:</span> {request.order?.paymentMethod || "N/A"}</p>
              <p><span className="font-semibold text-zinc-800">Order Date:</span> {formatDateTime(request.order?.createdAt)}</p>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-semibold">Items in Request ({itemCount} units)</p>
              {requestItems.map((item) => (
                <article key={item.id} className="border border-zinc-200 bg-zinc-50/50 p-3 flex gap-4 items-center">
                  {item.product?.imageUrl ? (
                    <img 
                      src={item.product.imageUrl} 
                      alt={item.product.name || "Product"} 
                      className="w-14 h-14 object-cover border border-zinc-200" 
                    />
                  ) : (
                    <div className="w-14 h-14 bg-zinc-200 border border-zinc-300 flex items-center justify-center text-xs text-zinc-500 font-medium uppercase">No Img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{item.product?.name || "Product"}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Qty: {item.quantity} • Color: {item.selectedColor || "N/A"} • Size: {item.selectedSize || "N/A"}</p>
                    {item.unitPricePkr ? (
                      <p className="text-xs font-semibold text-zinc-800 mt-1">{money(item.unitPricePkr)} each</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {isExchange ? (
              <section className="border border-zinc-200 bg-zinc-50/30 p-4 text-sm text-zinc-700 space-y-2">
                <p className="font-semibold uppercase tracking-[0.12em] text-xs text-zinc-500">Requested Replacement</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                  <p><span className="font-medium text-zinc-600">Variant Summary:</span> {request.requestedVariantSummary || "Exchange request"}</p>
                  <p><span className="font-medium text-zinc-600">Color:</span> {request.requestedReplacementColor || "Not provided"}</p>
                  <p><span className="font-medium text-zinc-600">Size:</span> {request.requestedReplacementSize || "Not provided"}</p>
                </div>
              </section>
            ) : null}

            <EvidenceLinks title="Customer Evidence Files" urls={request.evidenceImageUrls} />
          </article>

          {/* Linked Refund Info Card */}
          <div className="border border-zinc-300 p-5 bg-white space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-semibold">Linked Refunds</p>
            {refundSnapshot.length ? (
              <div className="divide-y divide-zinc-200">
                {refundSnapshot.map((refund) => (
                  <div key={refund.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-800">Status: <span className="uppercase text-blue-700">{refund.status}</span></p>
                      <p className="text-xs text-zinc-500 mt-0.5">Method: {refund.method || "ORIGINAL_SOURCE"}</p>
                    </div>
                    <span className="font-semibold text-zinc-900">{money(refund.adjustedAmountPkr || refund.amountPkr)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600 italic">No refund requests have been generated for this request yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Brand Decision, Logistics & Receipt Condition */}
        <div className="space-y-6">
          {/* Brand Recommendation & Recommendation Notes */}
          <article className="space-y-4 border border-zinc-300 p-5 bg-white">
            <header className="border-b border-zinc-200 pb-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-semibold">Brand Review</p>
              <h2 className="font-heading text-2xl uppercase mt-1">Brand Decision</h2>
            </header>
            
            <div className="grid gap-3 text-sm text-zinc-700 bg-zinc-50 p-4 border border-zinc-200">
              <p>
                <span className="font-semibold text-zinc-800">Brand Recommendation: </span>
                {request.brandRecommendation ? (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold uppercase border ${
                    request.brandRecommendation === "APPROVE" 
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : request.brandRecommendation === "REJECT"
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-amber-300 bg-amber-50 text-amber-800"
                  }`}>
                    {request.brandRecommendation}
                  </span>
                ) : (
                  <span className="text-zinc-500 italic">Pending brand response</span>
                )}
              </p>
              {request.brandRecommendedAt ? (
                <p><span className="font-semibold text-zinc-800">Submitted At:</span> {formatDateTime(request.brandRecommendedAt)}</p>
              ) : null}
              {request.brandRejectReason ? (
                <p><span className="font-semibold text-zinc-800">Brand Reject Reason:</span> <span className="font-medium text-red-700">{request.brandRejectReason}</span></p>
              ) : null}
              <p><span className="font-semibold text-zinc-800">Brand Notes:</span> {request.brandRecommendationNote || <span className="italic text-zinc-400">No recommendation notes</span>}</p>
              {isExchange ? (
                <p><span className="font-semibold text-zinc-800">Can Fulfill Replacement:</span> {request.canFulfillReplacement === true ? "Yes" : request.canFulfillReplacement === false ? "No" : "N/A"}</p>
              ) : null}
            </div>

            {availabilityRejected ? (
              <section className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Availability Rejection:</strong> The brand rejected this exchange because the requested replacement is out of stock. You can overrule the brand, confirm the rejection, or convert this exchange to a refund.
              </section>
            ) : null}
          </article>

          {/* Logistics & Pickup Info Card */}
          <article className="space-y-4 border border-zinc-300 p-5 bg-white">
            <header className="border-b border-zinc-200 pb-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-semibold">Logistics</p>
              <h2 className="font-heading text-2xl uppercase mt-1">Return Courier Details</h2>
            </header>
            <div className="grid grid-cols-2 gap-3 text-xs text-zinc-700">
              <p><span className="font-semibold text-zinc-800">Pickup Courier:</span> {request.pickupCourier || "Not set"}</p>
              <p><span className="font-semibold text-zinc-800">Pickup Tracking ID:</span> {request.pickupTracking || "Not set"}</p>
              <p><span className="font-semibold text-zinc-800">Return Tracking ID:</span> {request.returnTrackingNumber || "Not set"}</p>
              <p><span className="font-semibold text-zinc-800">Pickup Date:</span> {formatDateTime(request.pickupDate)}</p>
              <p className="col-span-2"><span className="font-semibold text-zinc-800">Pickup Address:</span> {request.pickupAddress || "Not set"}</p>
            </div>
          </article>

          {/* Brand Return Receipt & Condition Report */}
          <article className="space-y-4 border border-zinc-300 p-5 bg-white">
            <header className="border-b border-zinc-200 pb-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-semibold">Quality Inspection</p>
              <h2 className="font-heading text-2xl uppercase mt-1">Condition Report</h2>
            </header>
            <div className="grid gap-3 text-sm text-zinc-700 bg-zinc-50 p-4 border border-zinc-200">
              <p><span className="font-semibold text-zinc-800">Return Received At:</span> {formatDateTime(request.returnReceivedAt)}</p>
              <p><span className="font-semibold text-zinc-800">Receipt Condition Note:</span> {request.returnReceiptConditionNote || <span className="italic text-zinc-400">No receipt condition note</span>}</p>
              {request.brandConditionNote || request.brandDamageNote || request.damageClaimNote ? (
                <div className="border-t border-zinc-200 pt-2.5 mt-1 space-y-2">
                  <p className="font-semibold text-xs uppercase text-red-600 tracking-wider">Brand Damage Report</p>
                  {request.brandConditionNote ? <p><span className="font-semibold text-zinc-800">Condition note:</span> {request.brandConditionNote}</p> : null}
                  {request.brandDamageNote ? <p><span className="font-semibold text-zinc-800">Damage note:</span> {request.brandDamageNote}</p> : null}
                  {request.damageClaimNote ? <p><span className="font-semibold text-zinc-800">Claim note:</span> {request.damageClaimNote}</p> : null}
                </div>
              ) : null}
            </div>

            <EvidenceLinks title="Brand Return Receipt Evidence" urls={request.returnReceiptEvidenceUrls} />
            <EvidenceLinks title="Brand Damage/Dispute Evidence" urls={request.damageEvidenceUrls} />
            
            {request.replacementUnavailableReason ? (
              <section className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Replacement Unavailable Reason:</strong> {request.replacementUnavailableReason}
              </section>
            ) : null}
          </article>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="space-y-3 border border-zinc-300 p-5">
          <h2 className="font-heading text-3xl uppercase">Timeline</h2>
          <div className="space-y-3">
            {(request.statusLogs || []).map((log) => (
              <div key={log.id} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold uppercase tracking-[0.08em] flex flex-wrap items-center gap-2">
                  <span>{formatReturnStatus(log.status)}</span>
                  {log.updatedBy ? (
                    <span className="text-[10px] font-normal lowercase tracking-wider text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 first-letter:uppercase">
                      by {log.updatedBy.toLowerCase()}
                    </span>
                  ) : null}
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">{formatDateTime(log.createdAt)}</p>
                {log.note ? <p className="mt-1.5 text-zinc-700 border-l-2 border-zinc-200 pl-2 text-xs italic">{log.note}</p> : null}
              </div>
            ))}
          </div>
        </article>
        <AdminReturnDetailActions request={request} />
      </section>
    </main>
  );
}
