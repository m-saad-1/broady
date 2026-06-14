"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  confirmBrandReturnReceipt,
  getBrandCancellationRequests,
  getBrandReturnRequests,
  getBrandRefundRequests,
  respondBrandCancellationRequest,
  submitBrandReturnRecommendation,
} from "@/lib/api";
import { getOrderStatusLabel } from "@/lib/order-status";
import {
  formatOperatorReturnStatus,
  formatReturnReasonLabel,
  getDisplayReturnStatus,
  getReturnRequestItems,
  getReturnRequestType,
} from "@/lib/return-workflow";
import { useToastStore } from "@/stores/toast-store";
import type { CancellationRequestRecord, RefundRequestRecord, ReturnRequestRecord } from "@/types/marketplace";

const cancellationResponseOptions = [
  { value: "STILL_CANCELLABLE", label: "Still cancellable" },
  { value: "ORDER_ALREADY_PACKED", label: "Order already packed" },
  { value: "COURIER_PICKUP_SCHEDULED", label: "Courier pickup scheduled" },
  { value: "TRACKING_ALREADY_GENERATED", label: "Tracking already generated" },
  { value: "ALREADY_HANDED_TO_COURIER", label: "Already handed to courier" },
  { value: "OTHER_OPERATIONAL_REASON", label: "Other operational reason" },
];

const recommendationOptions = [
  { value: "APPROVE", label: "Recommend Approve" },
  { value: "REJECT", label: "Recommend Reject" },
  { value: "NEED_MORE_EVIDENCE", label: "Need more evidence" },
] as const;

const cancellationResponseLabels: Record<string, string> = {
  STILL_CANCELLABLE: "Still cancellable",
  ORDER_ALREADY_PACKED: "Order already packed",
  COURIER_PICKUP_SCHEDULED: "Courier pickup scheduled",
  TRACKING_ALREADY_GENERATED: "Tracking already generated",
  ALREADY_HANDED_TO_COURIER: "Already handed to courier",
  OTHER_OPERATIONAL_REASON: "Other operational reason",
};

const cancellationResponsesRequiringTrackingEvidence = new Set([
  "ORDER_ALREADY_PACKED",
  "COURIER_PICKUP_SCHEDULED",
  "TRACKING_ALREADY_GENERATED",
  "ALREADY_HANDED_TO_COURIER",
  "OTHER_OPERATIONAL_REASON",
]);

type CancellationItems = NonNullable<CancellationRequestRecord["subOrder"]>["items"];
type ReturnItems = NonNullable<ReturnRequestRecord["subOrder"]>["items"];

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function productSummary(
  items?: Array<{
    quantity: number;
    product?: { name?: string };
  }>,
) {
  if (!items?.length) return "No items listed";
  return items.map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ");
}

function getCancellationResponseLabel(value?: string | null) {
  if (!value) return "Awaiting response";
  return cancellationResponseLabels[value] || value;
}

function hasCancellationEvidence(trackingEvidence?: string | null, evidenceUrl?: string | null) {
  return Boolean(trackingEvidence?.trim() || evidenceUrl?.trim());
}

type CancellationDraft = {
  responseCode: string;
  note: string;
  trackingEvidence: string;
  evidenceUrl: string;
};

type ReturnDraft = {
  recommendation: "APPROVE" | "REJECT" | "NEED_MORE_EVIDENCE";
  note: string;
  rejectReason: string;
  replacementAvailable: "YES" | "NO";
  conditionNote: string;
  damageEvidenceUrls: string;
  damageClaimNote: string;
};

type BrandOperationsClientProps = {
  activeTab: "overview" | "cancellations" | "returns" | "refunds";
};

function validateCancellationDraft(draft: CancellationDraft) {
  if (draft.responseCode === "OTHER_OPERATIONAL_REASON" && !draft.note.trim()) {
    return "Add an operational note before submitting an 'Other' cancellation response.";
  }
  if (draft.responseCode !== "STILL_CANCELLABLE" && !hasCancellationEvidence(draft.trackingEvidence, draft.evidenceUrl)) {
    return "Evidence is required when the response is not Still cancellable.";
  }
  if (cancellationResponsesRequiringTrackingEvidence.has(draft.responseCode) && !draft.trackingEvidence.trim()) {
    return "Add tracking or pickup evidence before submitting this response.";
  }
  return null;
}

export function BrandOperationsClient({ activeTab }: BrandOperationsClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequestRecord[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequestRecord[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingCancellationResponseId, setPendingCancellationResponseId] = useState<string | null>(null);
  const [cancellationDrafts, setCancellationDrafts] = useState<Record<string, CancellationDraft>>({});
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnDraft>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCancellationRequests, nextReturnRequests, nextRefundRequests] = await Promise.all([
        getBrandCancellationRequests(),
        getBrandReturnRequests(),
        getBrandRefundRequests(),
      ]);
      setCancellationRequests(nextCancellationRequests);
      setReturnRequests(nextReturnRequests);
      setRefundRequests(nextRefundRequests);
      setCancellationDrafts((current) => {
        const next = { ...current };
        for (const request of nextCancellationRequests) {
          next[request.id] ||= {
            responseCode: request.brandResponseCode || "STILL_CANCELLABLE",
            note: request.brandResponseNote || "",
            trackingEvidence: request.trackingEvidence || "",
            evidenceUrl: request.evidenceUrl || "",
          };
        }
        return next;
      });
      setReturnDrafts((current) => {
        const next = { ...current };
        for (const request of nextReturnRequests) {
          next[request.id] ||= {
            recommendation: request.brandRecommendation || "APPROVE",
            note: request.brandRecommendationNote || "",
            rejectReason: request.brandRejectReason || "",
            replacementAvailable: request.replacementUnavailable ? "NO" : "YES",
            conditionNote: request.reviewNote || "",
            damageEvidenceUrls: (request.damageEvidenceUrls || []).join("\n"),
            damageClaimNote: request.damageClaimNote || "",
          };
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load brand operations";
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveCancellationResponse = async (requestId: string) => {
    const draft = cancellationDrafts[requestId];
    if (!draft) return;
    const validationMessage = validateCancellationDraft(draft);
    if (validationMessage) {
      pushToast(validationMessage, "error");
      return;
    }

    setSavingId(requestId);
    try {
      await respondBrandCancellationRequest(requestId, {
        responseCode: draft.responseCode,
        note: draft.note.trim() || undefined,
        trackingEvidence: draft.trackingEvidence.trim() || undefined,
        evidenceUrl: draft.evidenceUrl.trim() || undefined,
      });
      setPendingCancellationResponseId(null);
      pushToast("Cancellation response submitted for review.", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit cancellation response";
      pushToast(message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const saveReturnRecommendation = async (requestId: string) => {
    const draft = returnDrafts[requestId];
    if (!draft) return;
    setSavingId(requestId);
    try {
      await submitBrandReturnRecommendation(requestId, {
        recommendation: draft.recommendation,
        note: draft.note.trim() || undefined,
        rejectReason: draft.rejectReason.trim() || undefined,
        replacementAvailable: draft.recommendation === "APPROVE" ? draft.replacementAvailable === "YES" : undefined,
      });
      pushToast("Return recommendation submitted.", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit return recommendation";
      pushToast(message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const confirmReceipt = async (requestId: string) => {
    const draft = returnDrafts[requestId];
    if (!draft) return;
    setSavingId(requestId);
    try {
      const damageEvidenceUrls = draft.damageEvidenceUrls
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean);
      await confirmBrandReturnReceipt(requestId, {
        outcome: draft.damageClaimNote.trim() || damageEvidenceUrls.length ? "DISPUTED" : "APPROVED",
        conditionNote: draft.conditionNote.trim() || "Receipt confirmed",
        damageNote: draft.damageClaimNote.trim() || undefined,
        disputeReason: draft.damageClaimNote.trim() || undefined,
        evidenceUrls: damageEvidenceUrls.length ? damageEvidenceUrls : undefined,
      });
      pushToast("Return receipt confirmed.", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to confirm return receipt";
      pushToast(message, "error");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading brand operations...</p>;
  }

  const showCancellationSection = activeTab === "overview" || activeTab === "cancellations";
  const showReturnSection = activeTab === "overview" || activeTab === "returns";
  const showRefundSection = activeTab === "overview" || activeTab === "refunds";
  const pendingCancellationRequest = pendingCancellationResponseId
    ? cancellationRequests.find((request) => request.id === pendingCancellationResponseId)
    : null;
  const pendingCancellationDraft = pendingCancellationResponseId ? cancellationDrafts[pendingCancellationResponseId] : null;

  return (
    <div className="space-y-8">
      {showCancellationSection ? (
        <section className="space-y-3 border border-zinc-300 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-3xl uppercase">Cancellation Requests</h2>
              <p className="text-sm text-zinc-600">Respond with operational evidence. Broady makes the final decision.</p>
            </div>
            <button type="button" onClick={() => void loadData()} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              Refresh
            </button>
          </div>
          {cancellationRequests.length ? (
            <div className="space-y-3">
              {cancellationRequests.map((request) => {
              const draft = cancellationDrafts[request.id] || {
                responseCode: "STILL_CANCELLABLE",
                note: "",
                trackingEvidence: "",
                evidenceUrl: "",
              };
              const hasResponse = Boolean(request.brandResponseCode || request.respondedAt);
              const responseLabel = getCancellationResponseLabel(request.brandResponseCode);
              const evidenceMissing = draft.responseCode !== "STILL_CANCELLABLE" && !hasCancellationEvidence(draft.trackingEvidence, draft.evidenceUrl);
              const cardTone = hasResponse ? "border-emerald-200 bg-emerald-50/60" : "border-zinc-200 bg-white";

              return (
                <article key={request.id} className={`space-y-4 border p-4 ${cardTone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">User request</p>
                      <Link href={`/brand/orders/${request.subOrderId}`} className="text-sm font-semibold underline decoration-zinc-400 underline-offset-2">
                        {request.orderId}
                      </Link>
                      <p className="text-sm text-zinc-700">{productSummary(request.subOrder?.items)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-700">
                        {request.status}
                      </p>
                      {hasResponse ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                          Response submitted for review
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order status</p>
                      <p className="text-sm text-zinc-800">{request.subOrder?.status ? getOrderStatusLabel(request.subOrder.status) : "SubOrder"}</p>
                      <p className="text-xs text-zinc-500">Expires: {formatDateTime(request.expiresAt)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer reason</p>
                      <p className="text-sm text-zinc-600">{request.reasonText}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                        <span className="font-semibold text-zinc-900">Brand response:</span>
                      </p>
                      <p className="text-sm font-semibold text-zinc-900">{responseLabel}</p>
                      {request.brandResponseNote ? <p className="text-sm text-zinc-600">{request.brandResponseNote}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Response Reason
                      <select
                        className="h-10 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
                        value={draft.responseCode}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, responseCode: event.target.value },
                          }))
                        }
                      >
                        {cancellationResponseOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Operational Note
                      <input
                        className="h-10 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
                        placeholder="Add review note"
                        value={draft.note}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, note: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Tracking / Pickup Evidence
                      <input
                        className="h-10 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
                        placeholder="Tracking ID, pickup note, or courier evidence"
                        value={draft.trackingEvidence}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, trackingEvidence: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Evidence URL
                      <input
                        className="h-10 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
                        placeholder="Optional image or evidence link"
                        value={draft.evidenceUrl}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, evidenceUrl: event.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>

                  {draft.responseCode !== "STILL_CANCELLABLE" ? (
                    <p className={`text-xs ${evidenceMissing ? "font-semibold text-red-700" : "text-zinc-500"}`}>
                      Evidence is required when the response is not Still cancellable.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    {hasResponse ? (
                      <span className="inline-flex h-10 items-center border border-emerald-300 bg-emerald-100 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                        Response submitted for review
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={savingId === request.id}
                        onClick={() => {
                          const validationMessage = validateCancellationDraft(draft);
                          if (validationMessage) {
                            pushToast(validationMessage, "error");
                            return;
                          }
                          setPendingCancellationResponseId(request.id);
                        }}
                        className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        Review & Submit Response
                      </button>
                    )}
                    {request.respondedAt ? <p className="text-xs text-zinc-500">Responded {formatDateTime(request.respondedAt)}</p> : null}
                  </div>
                </article>
              );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No cancellation requests need attention.</p>
          )}
        </section>
      ) : null}

      {showReturnSection ? (
        <section className="space-y-3 border border-zinc-300 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-3xl uppercase">Return / Exchange Requests</h2>
              <p className="text-sm text-zinc-600">Keep cards lightweight here and open the request detail page for the full workflow.</p>
            </div>
            <Link href="/brand/operations/returns" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
              Open detail queue
            </Link>
          </div>
          {returnRequests.length ? (
            <div className="space-y-3">
              {returnRequests.map((request) => {
              const requestType = getReturnRequestType(request);
              const displayStatus = getDisplayReturnStatus(request);
              const requestItems = getReturnRequestItems(request);
              const leadItem = requestItems[0];
              return (
                <article key={request.id} className="space-y-3 border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request ID</p>
                      <p className="text-sm font-semibold">{request.id}</p>
                      <p className="text-sm text-zinc-600">{formatOperatorReturnStatus(displayStatus, requestType)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        requestType === "EXCHANGE"
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : "border-sky-300 bg-sky-100 text-sky-800"
                      }`}>
                        {requestType}
                      </span>
                      <p className="text-xs text-zinc-500">{formatDateTime(request.createdAt)}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order / Product</p>
                      <p className="text-sm font-semibold">{request.orderId}</p>
                      <p className="text-sm text-zinc-700">
                        {leadItem ? `${leadItem.product?.name || "Product"} (${leadItem.product?.id || leadItem.id})` : productSummary(requestItems)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Basic Details</p>
                      <p className="text-sm text-zinc-600">{formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
                      <p className="text-sm text-zinc-600">{request.evidenceImageUrls?.length || 0} customer evidence file(s)</p>
                      {leadItem ? <p className="text-xs text-zinc-500">{leadItem.selectedColor || "No color"} / {leadItem.selectedSize || "No size"}</p> : null}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link href={`/brand/operations/returns/${request.id}`} className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                      Open Details
                    </Link>
                  </div>
                </article>
              );
            })}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No return requests need attention.</p>
          )}
        </section>
      ) : null}

      {showRefundSection ? (
        <section className="space-y-3 border border-zinc-300 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-3xl uppercase">Refund Requests</h2>
              <p className="text-sm text-zinc-600">Track every refund after admin approval, completion, and wallet credit confirmation.</p>
            </div>
            <Link href="/account/wallet" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
              Open Wallet
            </Link>
          </div>
          {refundRequests.length ? (
            <div className="space-y-3">
              {refundRequests.map((request) => (
                <article key={request.id} className="space-y-3 border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund request</p>
                      <p className="text-sm font-semibold">{request.orderId}</p>
                      <p className="text-sm text-zinc-600">{request.subOrder?.brand?.name || "Brand"}</p>
                      <p className="text-sm text-zinc-600">{request.reasonCode || "Refund"}</p>
                      <p className="text-sm text-zinc-600">{request.items?.length || 0} refunded line item(s)</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        request.status === "COMPLETED"
                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                          : request.status === "REJECTED" || request.status === "FAILED"
                            ? "border-red-300 bg-red-100 text-red-800"
                            : "border-zinc-300 bg-white text-zinc-700"
                      }`}>
                        {request.status}
                      </p>
                      {request.returnRequest?.brandRecommendation ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                          Recommendation submitted
                        </span>
                      ) : null}
                      <p className="text-xs text-zinc-500">{`PKR ${Number(request.adjustedAmountPkr || request.amountPkr).toLocaleString()}`}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Method</p>
                      <p className="text-sm text-zinc-700">{request.method || "ORIGINAL_SOURCE"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Gateway reference</p>
                      <p className="text-sm text-zinc-700">{request.gatewayRefundId || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Updated</p>
                      <p className="text-sm text-zinc-700">{formatDateTime(request.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund link</p>
                      <p className="text-sm text-zinc-700">{request.returnRequest?.status || "Linked to return workflow"}</p>
                      <p className="text-xs text-zinc-500">{request.returnRequest?.id || "Return reference pending"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={request.returnRequest?.id ? `/brand/operations/returns/${request.returnRequest.id}` : "/brand/operations?tab=refunds"} className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                      Open Return Detail
                    </Link>
                    <Link href="/account/wallet" className="inline-flex h-9 items-center border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
                      View Wallet Credit
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No refund requests found.</p>
          )}
        </section>
      ) : null}

      {pendingCancellationRequest && pendingCancellationDraft ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingCancellationResponseId(null)}>
          <div className="w-full max-w-2xl space-y-5 border border-zinc-300 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Confirm Cancellation Response</p>
              <h3 className="font-heading text-3xl uppercase">Review Before Submit</h3>
              <p className="text-sm text-zinc-600">Please confirm the request details, response code, and evidence before sending it for Broady review.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">User request</p>
                <p className="text-sm font-semibold">{pendingCancellationRequest.orderId}</p>
                <p className="text-sm text-zinc-700">{productSummary(pendingCancellationRequest.subOrder?.items)}</p>
                <p className="text-sm text-zinc-600">{pendingCancellationRequest.reasonText}</p>
              </div>
              <div className="space-y-2 border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand response</p>
                <p className="text-sm font-semibold">{getCancellationResponseLabel(pendingCancellationDraft.responseCode)}</p>
                <p className="text-sm text-zinc-600">{pendingCancellationDraft.note.trim() || "No note added"}</p>
                <p className="text-sm text-zinc-600">
                  Evidence: {hasCancellationEvidence(pendingCancellationDraft.trackingEvidence, pendingCancellationDraft.evidenceUrl) ? "Provided" : "Missing"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingCancellationResponseId(null)}
                className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={savingId === pendingCancellationRequest.id}
                onClick={() => void saveCancellationResponse(pendingCancellationRequest.id)}
                className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {savingId === pendingCancellationRequest.id ? "Submitting..." : "Submit Response for Review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
