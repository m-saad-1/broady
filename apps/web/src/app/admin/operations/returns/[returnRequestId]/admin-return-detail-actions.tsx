"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  convertAdminExchangeToRefund,
  updateAdminReturnRequestStatus,
} from "@/lib/api";
import { formatReturnStatus, getDisplayReturnStatus, isAvailabilityRejected, isExchangeRequest } from "@/lib/return-workflow";
import { useToastStore } from "@/stores/toast-store";
import type { ReturnRequestRecord } from "@/types/marketplace";

type AdminReturnDetailActionsProps = {
  request: ReturnRequestRecord;
};

export function AdminReturnDetailActions({ request }: AdminReturnDetailActionsProps) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const requestType = isExchangeRequest(request) ? "EXCHANGE" : "RETURN";
  const status = getDisplayReturnStatus(request);
  const availabilityRejected = isAvailabilityRejected(request);
  const [saving, setSaving] = useState(false);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | "NEED_MORE_EVIDENCE">(
    status === "NEED_MORE_EVIDENCE" ? "NEED_MORE_EVIDENCE" : "APPROVE",
  );
  const [note, setNote] = useState(request.adminDecisionNote || request.reviewNote || "");
  const [rejectedReason, setRejectedReason] = useState(request.adminRejectedReason || "");
  const canSubmitReview =
    note.trim().length > 0 &&
    (reviewAction !== "REJECT" || rejectedReason.trim().length > 0);

  async function submitStatus(nextStatus: string) {
    setSaving(true);
    try {
      await updateAdminReturnRequestStatus(request.id, {
        status: nextStatus,
        note: note.trim() || undefined,
        rejectedReason: rejectedReason.trim() || undefined,
      });
      pushToast("Return request updated.", "success");
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to update return request.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 border border-zinc-300 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Admin Actions</p>
        <h2 className="font-heading text-3xl uppercase">Workflow Decision</h2>
      </div>

      {(status === "REQUESTED" || status === "BRAND_REVIEWING") ? (
        <div className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Brand review is still in progress. Final admin actions open once the request reaches admin review.
        </div>
      ) : null}

      {status === "NEED_MORE_EVIDENCE" ? (
        <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Waiting for the customer to provide the requested evidence.
        </div>
      ) : null}

      {(status === "BRAND_REJECTED" || status === "RETURN_CONDITION_DISPUTED" || status === "ADMIN_REVIEWING") ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">Review the customer evidence and the brand submission before approving, rejecting, or requesting more evidence.</p>
          <select className="h-10 w-full border border-zinc-300 px-3 text-sm" value={reviewAction} onChange={(event) => setReviewAction(event.target.value as typeof reviewAction)}>
            <option value="APPROVE">
              {status === "RETURN_CONDITION_DISPUTED"
                ? "Approve refund/exchange anyway"
                : status === "BRAND_REJECTED"
                  ? "Overrule brand rejection (Approve Customer Request)"
                  : "Approve customer request"}
            </option>
            <option value="REJECT">
              {status === "RETURN_CONDITION_DISPUTED"
                ? "Reject refund/exchange"
                : status === "BRAND_REJECTED"
                  ? "Approve brand decision (Confirm Rejection)"
                  : "Confirm brand rejection"}
            </option>
            <option value="NEED_MORE_EVIDENCE">Request More Evidence</option>
          </select>
          <textarea
            className="min-h-24 w-full border border-zinc-300 p-3 text-sm"
            placeholder={reviewAction === "NEED_MORE_EVIDENCE" ? "Evidence request note" : "Decision note"}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {reviewAction === "REJECT" ? (
            <input className="h-10 w-full border border-zinc-300 px-3 text-sm" placeholder="Rejected reason" value={rejectedReason} onChange={(event) => setRejectedReason(event.target.value)} />
          ) : null}
          <button
            type="button"
            disabled={saving || !canSubmitReview}
            onClick={() => void submitStatus(reviewAction === "APPROVE" ? "ADMIN_APPROVED" : reviewAction === "REJECT" ? "ADMIN_REJECTED" : "NEED_MORE_EVIDENCE")}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : reviewAction === "APPROVE" ? "Approve Request" : reviewAction === "REJECT" ? "Reject Request" : "Request Evidence"}
          </button>
        </div>
      ) : null}

      {availabilityRejected ? (
        <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Note:</strong> The brand rejected this exchange because the requested replacement variant is out of stock. You can still overrule the brand rejection, confirm the rejection, or convert this exchange to a refund.
        </div>
      ) : null}

      {(status === "BRAND_APPROVED" || status === "ADMIN_APPROVED" || status === "RETURN_ARRANGED" || status === "RETURN_IN_TRANSIT" || status === "RETURN_RECEIVED") ? (
        <div className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Brand is responsible for the operational return logistics on this request. Admin is monitoring this case in read-only mode unless a dispute or refund action is needed.
        </div>
      ) : null}

      {(status === "RETURN_CONDITION_APPROVED" || status === "REFUND_INITIATED") && requestType === "RETURN" ? (
        <div className="space-y-3 border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>
            {status === "RETURN_CONDITION_APPROVED"
              ? "Original item condition is approved. Initiate the refund to move this request into the refund workflow."
              : "Refund has been initiated. Continue refund processing from the refund queue and the workflow will complete automatically after settlement."}
          </p>
          {status === "RETURN_CONDITION_APPROVED" ? (
            <button type="button" disabled={saving} onClick={() => void submitStatus("REFUND_INITIATED")} className="h-10 border border-blue-900 bg-blue-900 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
              {saving ? "Saving..." : "Initiate Refund"}
            </button>
          ) : null}
        </div>
      ) : null}

      {status === "RETURN_CONDITION_APPROVED" && requestType === "EXCHANGE" ? (
        <div className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Return condition approved. Waiting for the brand to ship the replacement.
        </div>
      ) : null}

      {(status === "REPLACEMENT_PROCESSING" || status === "REPLACEMENT_SHIPPED") && requestType === "EXCHANGE" ? (
        <div className="space-y-3 border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>
            {status === "REPLACEMENT_PROCESSING"
              ? "The brand is preparing the replacement shipment."
              : "Replacement has shipped. Mark it delivered when confirmed."}
          </p>
          {request.replacementUnavailable || request.convertedToRefund ? null : (
            <button type="button" disabled={saving} onClick={() => void submitStatus("REPLACEMENT_DELIVERED")} className="h-10 border border-blue-900 bg-blue-900 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
              {saving ? "Saving..." : "Mark Replacement Delivered"}
            </button>
          )}
        </div>
      ) : null}

      {status === "REPLACEMENT_DELIVERED" && requestType === "EXCHANGE" ? (
        <div className="space-y-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p>Replacement delivered. You can now close the exchange workflow.</p>
          <button type="button" disabled={saving} onClick={() => void submitStatus("EXCHANGE_COMPLETED")} className="h-10 border border-emerald-900 bg-emerald-900 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
            {saving ? "Saving..." : "Mark Exchange Completed"}
          </button>
        </div>
      ) : null}

      {requestType === "EXCHANGE" && (request.replacementUnavailable || availabilityRejected || status === "BRAND_REJECTED") && !request.convertedToRefund && status !== "ADMIN_REJECTED" ? (
        <div className="space-y-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>The brand has rejected this exchange, or the replacement variant is unavailable. Convert this exchange to a refund if the refund path should begin now (requires a decision note).</p>
          <button
            type="button"
            disabled={saving || !note.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await convertAdminExchangeToRefund(request.id, { note: note.trim() });
                pushToast("Exchange converted to refund.", "success");
                router.refresh();
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to convert exchange to refund.", "error");
              } finally {
                setSaving(false);
              }
            }}
            className="h-10 border border-amber-900 bg-amber-900 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Convert To Refund"}
          </button>
        </div>
      ) : null}

      {status === "ADMIN_REJECTED" ? (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Rejected by admin. {request.adminRejectedReason || request.adminDecisionNote || "No further workflow actions are available."}
        </div>
      ) : null}

      {(status === "COMPLETED" || status === "EXCHANGE_COMPLETED") ? (
        <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Final state: {formatReturnStatus(status)}.
        </div>
      ) : null}
    </section>
  );
}
