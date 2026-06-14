"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  decideAdminCancellationRequest,
  getAdminCancellationRequests,
  getAdminOperations,
  updateAdminRefundRequestStatus,
  updateAdminReturnRequestStatus,
} from "@/lib/api";
import { getOrderStatusLabel } from "@/lib/order-status";
import {
  formatOperatorReturnStatus,
  formatReturnReasonLabel,
  getAdminQueueStatusOptions,
  getDisplayReturnStatus,
  getReturnRequestType,
} from "@/lib/return-workflow";
import { useToastStore } from "@/stores/toast-store";
import type {
  AdminOperationsRecord,
  CancellationRequestRecord,
  RefundRequestRecord,
  RefundRequestStatus,
  ReturnRequestRecord,
  ReturnRequestStatus,
} from "@/types/marketplace";

type AdminOperationsClientProps = {
  activeTab: "overview" | "cancellations" | "returns" | "refunds";
};

const refundStatuses: RefundRequestStatus[] = ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "FAILED"];
const refundMethods = ["ORIGINAL_SOURCE", "BANK_TRANSFER", "WALLET_CREDIT"];
const cancellationDecisionFilters = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
const refundStatusFilters = ["ALL", ...refundStatuses] as const;
const finalCancellationStatuses = new Set(["APPROVED", "REJECTED"]);
const finalRefundStatuses = new Set(["COMPLETED", "REJECTED", "FAILED"]);

type RefundDraft = {
  method: string;
  adjustedAmountPkr: string;
  gatewayRefundId: string;
  note: string;
};

type ReturnDraft = {
  status: ReturnRequestStatus;
  pickupTracking: string;
  note: string;
};

type CancellationDraft = {
  status: "APPROVED" | "REJECTED";
  refundMethod: string;
  note: string;
};

function cancellationDecisionLabel(status: CancellationRequestRecord["status"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "EXPIRED") return "Expired";
  if (status === "CANCELLED_BY_USER") return "Cancelled by user";
  return "Pending";
}

function refundStatusLabel(status: RefundRequestStatus) {
  return status.replace("_", " ").toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function money(value?: number | null) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function productSummary(items?: NonNullable<CancellationRequestRecord["subOrder"]>["items"]) {
  if (!items?.length) return "No items listed";
  return items.map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ");
}

export function AdminOperationsClient({ activeTab }: AdminOperationsClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [operations, setOperations] = useState<AdminOperationsRecord | null>(null);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequestRecord[]>([]);
  const [cancellationDecisionFilter, setCancellationDecisionFilter] = useState<(typeof cancellationDecisionFilters)[number]>("ALL");
  const [refundStatusFilter, setRefundStatusFilter] = useState<(typeof refundStatusFilters)[number]>("ALL");
  const [onlyEscalated, setOnlyEscalated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cancellationDrafts, setCancellationDrafts] = useState<Record<string, CancellationDraft>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, RefundDraft>>({});
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnDraft>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOperations, nextCancellationRequests] = await Promise.all([
        getAdminOperations({ onlyEscalated }),
        getAdminCancellationRequests(),
      ]);
      setOperations(nextOperations);
      setCancellationRequests(nextCancellationRequests);
      setCancellationDrafts((current) => {
        const next = { ...current };
        for (const request of nextCancellationRequests) {
          next[request.id] ||= {
            status: "APPROVED",
            refundMethod: "ORIGINAL_SOURCE",
            note: request.decisionNote || "",
          };
        }
        return next;
      });
      setRefundDrafts((current) => {
        const next = { ...current };
        for (const request of nextOperations.refundRequests) {
          next[request.id] ||= {
            method: request.method || "ORIGINAL_SOURCE",
            adjustedAmountPkr: request.adjustedAmountPkr ? String(request.adjustedAmountPkr) : "",
            gatewayRefundId: request.gatewayRefundId || "",
            note: request.reviewNote || "",
          };
        }
        return next;
      });
      setReturnDrafts((current) => {
        const next = { ...current };
        for (const request of nextOperations.returnRequests) {
          next[request.id] ||= {
            status: request.status,
            pickupTracking: request.pickupTracking || "",
            note: request.reviewNote || "",
          };
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load admin operations";
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [onlyEscalated, pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refundRequestsData = operations?.refundRequests ?? [];

  const visibleCancellationRequests = useMemo(() => {
    return cancellationRequests.filter((request) => {
      if (cancellationDecisionFilter === "ALL") return true;
      if (cancellationDecisionFilter === "PENDING") return !finalCancellationStatuses.has(request.status);
      return request.status === cancellationDecisionFilter;
    });
  }, [cancellationDecisionFilter, cancellationRequests]);

  const visibleRefundRequests = useMemo(() => {
    return refundRequestsData.filter((request) => {
      if (refundStatusFilter === "ALL") return true;
      return request.status === refundStatusFilter;
    });
  }, [refundRequestsData, refundStatusFilter]);

  const refundRequestByKey = useMemo(() => {
    const map = new Map<string, RefundRequestRecord>();
    for (const request of refundRequestsData) {
      map.set(`${request.orderId}:${request.subOrderId}`, request);
    }
    return map;
  }, [refundRequestsData]);

  const decideCancellation = async (requestId: string) => {
    const draft = cancellationDrafts[requestId];
    if (!draft) return;
    setSavingId(requestId);
    try {
      await decideAdminCancellationRequest(requestId, {
        status: draft.status,
        note: draft.note.trim() || undefined,
        refundMethod: draft.refundMethod,
      });
      pushToast("Cancellation request updated.", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to decide cancellation request";
      pushToast(message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const runRefundAction = async (
    request: RefundRequestRecord,
    action:
      | "APPROVE_REFUND"
      | "REJECT_REFUND"
      | "RETRY_FAILED_REFUND"
      | "MARK_MANUAL_REFUND_COMPLETED",
  ) => {
    const draft = refundDrafts[request.id];
    if (!draft) return;
    setSavingId(request.id);
    try {
      const adjustedAmountPkr = draft.adjustedAmountPkr.trim() ? Number(draft.adjustedAmountPkr) : undefined;
      await updateAdminRefundRequestStatus(request.id, {
        action,
        method: draft.method,
        adjustedAmountPkr: Number.isFinite(adjustedAmountPkr) ? adjustedAmountPkr : undefined,
        gatewayRefundId: draft.gatewayRefundId.trim() || undefined,
        note: draft.note.trim() || undefined,
      });
      pushToast("Refund request updated.", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update refund request";
      pushToast(message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const updateReturn = async (request: ReturnRequestRecord) => {
    const draft = returnDrafts[request.id];
    if (!draft) return;
    setSavingId(request.id);
    try {
      await updateAdminReturnRequestStatus(request.id, {
        status: draft.status,
        pickupTracking: draft.pickupTracking.trim() || undefined,
        note: draft.note.trim() || undefined,
      });
      pushToast("Return request updated.", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update return request";
      pushToast(message, "error");
    } finally {
      setSavingId(null);
    }
  };

  if (loading || !operations) {
    return <p className="text-sm text-zinc-600">Loading admin operations...</p>;
  }

  const showOverview = activeTab === "overview";
  const showCancellationSection = showOverview || activeTab === "cancellations";
  const showReturnSection = showOverview || activeTab === "returns";
  const showRefundSection = showOverview || activeTab === "refunds";

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3 border border-zinc-300 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Filters</p>
          <p className="mt-1 text-sm text-zinc-600">
            {showOverview
              ? "Use escalated mode for failed deliveries that need admin attention."
              : "Use the tab buttons above to focus on one queue at a time."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOnlyEscalated((current) => !current)}
            className={`h-10 border px-4 text-xs font-semibold uppercase tracking-[0.12em] ${onlyEscalated ? "border-black bg-black text-white" : "border-zinc-300"}`}
          >
            {onlyEscalated ? "Escalated Only" : "All Issues"}
          </button>
          <button type="button" onClick={() => void loadData()} className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Refresh
          </button>
        </div>
      </section>

      {showCancellationSection ? (
      <section className="space-y-4 border border-zinc-300 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-heading text-3xl uppercase">Cancellation Decisions</h2>
            <p className="text-sm text-zinc-600">Review brand evidence, then approve or reject each cancellation request.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cancellationDecisionFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCancellationDecisionFilter(item)}
                className={`h-10 border px-4 text-xs font-semibold uppercase tracking-[0.12em] ${
                  cancellationDecisionFilter === item ? "border-black bg-black text-white" : "border-zinc-300"
                }`}
              >
                {item === "ALL" ? "All" : item === "PENDING" ? "Pending" : item === "APPROVED" ? "Approved" : "Rejected"}
              </button>
            ))}
          </div>
        </div>
        {visibleCancellationRequests.length ? (
          <div className="space-y-3">
            {visibleCancellationRequests.map((request) => {
              const draft = cancellationDrafts[request.id] || { status: "APPROVED" as const, refundMethod: "ORIGINAL_SOURCE", note: "" };
              const isDecided = finalCancellationStatuses.has(request.status);
              const refundMatch = refundRequestByKey.get(`${request.orderId}:${request.subOrderId}`);
              const cardTone = request.status === "APPROVED" ? "border-emerald-200 bg-emerald-50/60" : request.status === "REJECTED" ? "border-red-200 bg-red-50/60" : "border-zinc-200 bg-white";

              return (
                <article key={request.id} className={`space-y-4 border p-4 ${cardTone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">User request</p>
                      <Link href={`/admin/orders/${request.orderId}`} className="text-sm font-semibold underline decoration-zinc-400 underline-offset-2">
                        {request.orderId}
                      </Link>
                      <p className="text-sm text-zinc-600">{request.brand?.name || request.subOrder?.brand?.name || "Brand"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        request.status === "APPROVED"
                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                          : request.status === "REJECTED"
                            ? "border-red-300 bg-red-100 text-red-800"
                            : "border-zinc-300 bg-white text-zinc-700"
                      }`}>
                        {cancellationDecisionLabel(request.status)}
                      </p>
                      {request.decisionNote ? <p className="text-xs text-zinc-500">{request.decisionNote}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request status</p>
                      <p className="text-sm font-semibold">{request.status}</p>
                      <p className="text-sm text-zinc-600">{request.reasonText}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand evidence</p>
                      <p className="text-sm font-semibold">{request.brandResponseCode || "No response"}</p>
                      <p className="text-sm text-zinc-600">{request.trackingEvidence || request.evidenceUrl || request.brandResponseNote || "No evidence"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Items</p>
                      <p className="text-sm text-zinc-600">{productSummary(request.subOrder?.items)}</p>
                      <p className="text-xs text-zinc-500">Auto approve: {formatDateTime(request.autoApproveAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund link</p>
                      {refundMatch ? (
                        <>
                          <p className="text-sm font-semibold">{refundMatch.status}</p>
                          <p className="text-sm text-zinc-600">{money(refundMatch.adjustedAmountPkr || refundMatch.amountPkr)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-600">No refund yet</p>
                      )}
                    </div>
                  </div>

                  {isDecided ? (
                    <div className="grid gap-3 border border-zinc-200 bg-white p-4 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Decision</p>
                        <p className="text-sm font-semibold">{cancellationDecisionLabel(request.status)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Decided at</p>
                        <p className="text-sm text-zinc-700">{formatDateTime(request.decidedAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund method</p>
                        <p className="text-sm text-zinc-700">{refundMatch?.method || "No refund method yet"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-[150px_180px_1fr_auto]">
                      <select
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        value={draft.status}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, status: event.target.value as CancellationDraft["status"] },
                          }))
                        }
                      >
                        <option value="APPROVED">Approve</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                      <select
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        value={draft.refundMethod}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, refundMethod: event.target.value },
                          }))
                        }
                      >
                        {refundMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                      <input
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        placeholder="Decision note"
                        value={draft.note}
                        onChange={(event) =>
                          setCancellationDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, note: event.target.value },
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={savingId === request.id || !["REQUESTED", "EXPIRED"].includes(request.status) || !draft.note.trim()}
                        onClick={() => void decideCancellation(request.id)}
                        className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        Decide
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No cancellation requests found.</p>
        )}
      </section>
      ) : null}

      {showRefundSection ? (
      <section className="space-y-4 border border-zinc-300 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-heading text-3xl uppercase">Refund Requests</h2>
            <p className="text-sm text-zinc-600">Filter and update refund lifecycle statuses, references, and notes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {refundStatusFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRefundStatusFilter(item)}
                className={`h-10 border px-4 text-xs font-semibold uppercase tracking-[0.12em] ${
                  refundStatusFilter === item ? "border-black bg-black text-white" : "border-zinc-300"
                }`}
              >
                {item === "ALL" ? "All" : refundStatusLabel(item)}
              </button>
            ))}
          </div>
        </div>
        {visibleRefundRequests.length ? (
          <div className="space-y-3">
            {visibleRefundRequests.map((request) => {
              const draft = refundDrafts[request.id] || {
                method: request.method || "ORIGINAL_SOURCE",
                adjustedAmountPkr: "",
                gatewayRefundId: "",
                note: "",
              };
              const isFinal = finalRefundStatuses.has(request.status);
              const cardTone =
                request.status === "COMPLETED"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : request.status === "REJECTED" || request.status === "FAILED"
                    ? "border-red-200 bg-red-50/60"
                    : "border-zinc-200 bg-white";

              return (
                <article key={request.id} className={`space-y-4 border p-4 ${cardTone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund request</p>
                      <p className="text-sm font-semibold">{request.orderId}</p>
                      <p className="text-sm text-zinc-600">{request.subOrder?.brand?.name || "Brand"}</p>
                      <p className="text-sm text-zinc-600">{request.reasonCode || "Refund"}</p>
                      <p className="text-sm text-zinc-600">{productSummary(request.subOrder?.items)}</p>
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
                      <p className="text-xs text-zinc-500">{money(request.adjustedAmountPkr || request.amountPkr)}</p>
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
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Note</p>
                      <p className="text-sm text-zinc-700">{request.reviewNote || "No note yet"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Updated</p>
                      <p className="text-sm text-zinc-700">{formatDateTime(request.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {request.returnRequest?.id ? (
                      <Link
                        href={`/admin/operations/returns/${request.returnRequest.id}`}
                        className="inline-flex h-9 items-center border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      >
                        Open Return Detail
                      </Link>
                    ) : null}
                  </div>

                  {isFinal ? (
                    <div className="border border-zinc-200 bg-white p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.12em]">Final refund state</p>
                      <p className="mt-1 text-sm text-zinc-700">This refund is now locked in {request.status.toLowerCase()} state.</p>
                      <p className="mt-1 text-xs text-zinc-500">Completed at: {formatDateTime(request.completedAt)}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-[180px_150px_1fr]">
                      <select
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        value={draft.method}
                        onChange={(event) =>
                          setRefundDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, method: event.target.value },
                          }))
                        }
                      >
                        {refundMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                      <input
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        placeholder="Adjusted amount"
                        value={draft.adjustedAmountPkr}
                        onChange={(event) =>
                          setRefundDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, adjustedAmountPkr: event.target.value },
                          }))
                        }
                      />
                      <input
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        placeholder="Decision or processing note"
                        value={draft.note}
                        onChange={(event) =>
                          setRefundDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, note: event.target.value },
                          }))
                        }
                      />
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                      <input
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        placeholder="Gateway/reference"
                        value={draft.gatewayRefundId}
                        onChange={(event) =>
                          setRefundDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, gatewayRefundId: event.target.value },
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        {request.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              disabled={savingId === request.id}
                              onClick={() => void runRefundAction(request, "APPROVE_REFUND")}
                              className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                            >
                              Approve Refund
                            </button>
                            <button
                              type="button"
                              disabled={savingId === request.id || !draft.note.trim()}
                              onClick={() => void runRefundAction(request, "REJECT_REFUND")}
                              className="h-10 border border-red-300 bg-red-50 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-red-700 disabled:opacity-50"
                            >
                              Reject Refund
                            </button>
                          </>
                        ) : null}
                        {request.status === "FAILED" ? (
                          <button
                            type="button"
                            disabled={savingId === request.id}
                            onClick={() => void runRefundAction(request, "RETRY_FAILED_REFUND")}
                            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                          >
                            Retry Failed Refund
                          </button>
                        ) : null}
                        {request.status === "PROCESSING" && draft.method !== "ORIGINAL_SOURCE" ? (
                          <button
                            type="button"
                            disabled={savingId === request.id || !draft.gatewayRefundId.trim() || !draft.note.trim()}
                            onClick={() => void runRefundAction(request, "MARK_MANUAL_REFUND_COMPLETED")}
                            className="h-10 border border-emerald-700 bg-emerald-700 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                          >
                            Mark Manual Refund Completed
                          </button>
                        ) : null}
                      </div>
                      </div>
                      {request.status === "PROCESSING" && draft.method === "ORIGINAL_SOURCE" ? (
                        <p className="text-xs text-zinc-500">
                          This refund is processing through the original source. Completion or failure should come from the gateway/webhook path.
                        </p>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No refund requests found.</p>
        )}
      </section>
      ) : null}

      {showReturnSection ? (
        <section className="space-y-3 border border-zinc-300 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-heading text-3xl uppercase">Return Requests</h2>
              <p className="text-sm text-zinc-600">Audit the request, brand recommendation, item list, and the next workflow action.</p>
            </div>
            <Link href="/admin/operations/returns" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
              Open Detail Queue
            </Link>
          </div>
          {operations.returnRequests.length ? (
            <div className="space-y-3">
              {operations.returnRequests.map((request) => {
                const draft = returnDrafts[request.id] || { status: request.status, pickupTracking: "", note: "" };
                const requestType = getReturnRequestType(request);
                const displayStatus = getDisplayReturnStatus(request);
                const statusOptions = getAdminQueueStatusOptions(request);
                const refundSnapshot = request.refundRequests?.[0];
                const exchangeOutOfStock =
                  requestType === "EXCHANGE" &&
                  Boolean((request.brandRecommendationNote || request.reviewNote || "").toLowerCase().includes("out of stock"));
                const finalLabel =
                  displayStatus === "COMPLETED" || displayStatus === "EXCHANGE_COMPLETED"
                    ? requestType === "EXCHANGE"
                      ? "Exchanged"
                      : "Returned"
                    : requestType === "EXCHANGE"
                      ? "Exchange requested"
                      : "Return requested";

                return (
                  <article key={request.id} className="space-y-4 border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">User request</p>
                      <p className="text-sm font-semibold">{request.orderId}</p>
                      <p className="text-sm text-zinc-600">{request.subOrder?.brand?.name || "Brand"} | {request.subOrderId}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        displayStatus === "COMPLETED" || displayStatus === "EXCHANGE_COMPLETED"
                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                          : displayStatus === "ADMIN_REJECTED"
                            ? "border-red-300 bg-red-100 text-red-800"
                            : "border-zinc-300 bg-white text-zinc-700"
                      }`}>
                        {displayStatus === "COMPLETED" || displayStatus === "EXCHANGE_COMPLETED"
                          ? finalLabel
                          : formatOperatorReturnStatus(displayStatus, requestType)}
                      </p>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        requestType === "EXCHANGE"
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : "border-sky-300 bg-sky-100 text-sky-800"
                      }`}>
                        {requestType}
                      </span>
                      {displayStatus === "COMPLETED" || displayStatus === "EXCHANGE_COMPLETED" ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                          {finalLabel}
                        </span>
                      ) : exchangeOutOfStock ? (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                          Replacement unavailable
                        </span>
                      ) : request.brandRecommendation ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                          Brand decision submitted
                        </span>
                      ) : null}
                      <Link href={`/admin/operations/returns/${request.id}`} className="inline-flex h-8 items-center border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        Open Detail
                      </Link>
                    </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Reason</p>
                        <p className="text-sm text-zinc-700">{formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
                        <p className="text-xs text-zinc-500">Type: {requestType}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Items</p>
                        <p className="text-sm text-zinc-600">{productSummary(request.subOrder?.items)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand decision</p>
                        <p className="text-sm font-semibold">{request.brandRecommendation || "Pending"}</p>
                        <p className="text-sm text-zinc-600">{request.brandRecommendationNote || "No note yet"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund snapshot</p>
                        <p className="text-sm text-zinc-700">{refundSnapshot ? refundSnapshot.status : "No refund yet"}</p>
                        <p className="text-sm text-zinc-600">{refundSnapshot ? money(refundSnapshot.adjustedAmountPkr || refundSnapshot.amountPkr) : "Awaiting admin action"}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[180px_1fr_1fr_auto]">
                      <select
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        value={draft.status}
                        onChange={(event) =>
                          setReturnDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, status: event.target.value as ReturnRequestStatus },
                          }))
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {formatOperatorReturnStatus(status, requestType)}
                          </option>
                        ))}
                      </select>
                      <input
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        placeholder="Pickup tracking"
                        value={draft.pickupTracking}
                        onChange={(event) =>
                          setReturnDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, pickupTracking: event.target.value },
                          }))
                        }
                      />
                      <input
                        className="h-10 border border-zinc-300 px-3 text-sm"
                        placeholder="Decision note"
                        value={draft.note}
                        onChange={(event) =>
                          setReturnDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, note: event.target.value },
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={savingId === request.id || !draft.note.trim()}
                        onClick={() => void updateReturn(request)}
                        className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        Update
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No return requests found.</p>
          )}
        </section>
      ) : null}

      {showOverview ? (
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 border border-zinc-300 p-5">
          <h2 className="font-heading text-3xl uppercase">Failed Deliveries</h2>
          {operations.failedDeliveries.length ? (
            operations.failedDeliveries.map((entry) => (
              <article key={entry.id} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold">{entry.brand?.name || "Brand"} / {entry.orderId}</p>
                <p className="text-zinc-600">{getOrderStatusLabel(entry.status)} / {entry.failureReason || "No reason"}</p>
                <p className="text-zinc-500">Next attempt: {formatDateTime(entry.nextAttemptDate)}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-zinc-600">No failed deliveries in this view.</p>
          )}
        </div>
        <div className="space-y-3 border border-zinc-300 p-5">
          <h2 className="font-heading text-3xl uppercase">Stuck Shipments</h2>
          {operations.stuckShipments.length ? (
            operations.stuckShipments.map((entry) => (
              <article key={entry.id} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold">{entry.brand?.name || "Brand"} / {entry.orderId}</p>
                <p className="text-zinc-600">Tracking: {entry.trackingId || "Missing"}</p>
                <p className="text-zinc-500">Updated: {formatDateTime(entry.updatedAt)}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-zinc-600">No stuck shipments in this view.</p>
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}
