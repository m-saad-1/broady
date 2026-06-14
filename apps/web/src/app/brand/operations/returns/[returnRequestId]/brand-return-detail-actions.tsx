"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmBrandReturnReceipt,
  markBrandReplacementDelivered,
  submitBrandReturnRecommendation,
  updateBrandReplacementShipment,
  updateBrandReturnLogistics,
} from "@/lib/api";
import { REGISTERED_COURIERS } from "@/lib/couriers";
import {
  formatReturnReasonLabel,
  formatReturnStatus,
  getDisplayReturnStatus,
  getNextReplacementStatuses,
  isAvailabilityRejected,
  isExchangeRequest,
} from "@/lib/return-workflow";
import { useToastStore } from "@/stores/toast-store";
import type { ReturnRequestRecord } from "@/types/marketplace";

type BrandReturnDetailActionsProps = {
  request: ReturnRequestRecord;
  onUpdated: (request: ReturnRequestRecord) => void;
};

function getRejectReasonOptions(request: ReturnRequestRecord) {
  const reasonCode = request.reasonCode;
  const options = [
    { value: "PRODUCT_NOT_AVAILABLE", label: "Product not available" },
    { value: "PRODUCT_DISCONTINUED", label: "Product discontinued" },
    { value: "EVIDENCE_UNCLEAR", label: "Evidence is unclear" },
    { value: "DAMAGE_NOT_VISIBLE", label: "Damage not visible in images" },
    { value: "CLAIM_MISMATCH", label: "Claim does not match uploaded evidence" },
    { value: "WRONG_PRODUCT_IN_EVIDENCE", label: "Wrong product shown in evidence" },
    { value: "EVIDENCE_INSUFFICIENT", label: "Evidence image is insufficient" },
    { value: "RETURN_WINDOW_EXPIRED", label: "Return window expired" },
    { value: "PRODUCT_NON_RETURNABLE", label: "Product is non-returnable" },
    { value: "OTHER", label: "Other" },
  ];

  if (request.requestType === "EXCHANGE" || request.preferredResolution?.startsWith("EXCHANGE")) {
    if (reasonCode === "WRONG_SIZE" || reasonCode === "SIZE_ISSUE" || request.preferredResolution === "EXCHANGE_SIZE") {
      options.unshift({ value: "SIZE_UNAVAILABLE", label: "Selected size unavailable" });
    }
    if (reasonCode === "WRONG_COLOR" || request.preferredResolution === "EXCHANGE_COLOR") {
      options.unshift({ value: "COLOR_UNAVAILABLE", label: "Selected color unavailable" });
    }
    options.unshift({ value: "EXCHANGE_VARIANT_UNAVAILABLE", label: "Exchange variant unavailable" });
  }

  if (reasonCode !== "DAMAGED_ITEM" && reasonCode !== "DEFECTIVE_PRODUCT") {
    options.splice(2, 0, { value: "ITEM_DAMAGED", label: "Item damaged" });
  }

  return Array.from(new Map(options.map((option) => [option.value, option])).values());
}

const replacementStageOptions = [
  { value: "REPLACEMENT_PROCESSING", label: "Replacement Processing" },
  { value: "REPLACEMENT_PACKED", label: "Replacement Packed" },
  { value: "REPLACEMENT_READY_FOR_PICKUP", label: "Ready for Pickup" },
  { value: "REPLACEMENT_SHIPPED", label: "Ship Replacement" },
  { value: "REPLACEMENT_OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "REPLACEMENT_DELIVERY_FAILED", label: "Delivery Failed" },
  { value: "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED", label: "Address Correction Required" },
  { value: "REPLACEMENT_READY_FOR_REDELIVERY", label: "Ready for Re-Delivery" },
  { value: "REPLACEMENT_SHIPMENT_RETURNED", label: "Shipment Returned" },
  { value: "REPLACEMENT_DELIVERED", label: "Replacement Delivered" },
] as const;

const replacementFailureReasonOptions = [
  { value: "CUSTOMER_NOT_AVAILABLE", label: "Customer not available" },
  { value: "INCORRECT_ADDRESS", label: "Incorrect address" },
  { value: "PHONE_UNREACHABLE", label: "Phone unreachable" },
  { value: "REFUSED_DELIVERY", label: "Refused delivery" },
  { value: "AREA_NOT_SERVICEABLE", label: "Area not serviceable" },
  { value: "COURIER_ISSUE", label: "Courier issue" },
  { value: "OTHER", label: "Other" },
] as const;

export function BrandReturnDetailActions({ request, onUpdated }: BrandReturnDetailActionsProps) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const requestType = isExchangeRequest(request) ? "EXCHANGE" : "RETURN";
  const rejectReasonOptions = getRejectReasonOptions(request);
  const status = getDisplayReturnStatus(request);
  const availabilityRejected = isAvailabilityRejected(request);
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "NEED_MORE_EVIDENCE">("APPROVE");
  const [decisionNote, setDecisionNote] = useState(request.brandRecommendationNote || "");
  const [rejectReason, setRejectReason] = useState(request.brandRejectReason || "");

  const [returnCourier, setReturnCourier] = useState(request.pickupCourier || "");
  const [returnTrackingNumber, setReturnTrackingNumber] = useState(request.returnTrackingNumber || request.pickupTracking || "");
  const [returnInstructions, setReturnInstructions] = useState(request.pickupAddress || "");
  const [expectedReturnDate, setExpectedReturnDate] = useState(request.pickupDate?.slice(0, 10) || "");
  const [returnNote, setReturnNote] = useState(request.reviewNote || "");

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptOutcome, setReceiptOutcome] = useState<"APPROVED" | "DISPUTED">("APPROVED");
  const [receiptConditionNote, setReceiptConditionNote] = useState(
    request.returnReceiptConditionNote || request.brandConditionNote || "",
  );
  const [receiptDamageNote, setReceiptDamageNote] = useState(request.brandDamageNote || "");
  const [receiptDisputeReason, setReceiptDisputeReason] = useState(request.damageClaimNote || "");
  const [receiptEvidenceUrls, setReceiptEvidenceUrls] = useState(
    (request.returnReceiptEvidenceUrls || request.damageEvidenceUrls || []).join("\n"),
  );
  const [receiptReceivedAt, setReceiptReceivedAt] = useState(
    request.returnReceivedAt ? request.returnReceivedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );

  const [replacementStage, setReplacementStage] = useState<
    "REPLACEMENT_PROCESSING"
    | "REPLACEMENT_PACKED"
    | "REPLACEMENT_READY_FOR_PICKUP"
    | "REPLACEMENT_SHIPPED"
    | "REPLACEMENT_OUT_FOR_DELIVERY"
    | "REPLACEMENT_DELIVERY_FAILED"
    | "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
    | "REPLACEMENT_READY_FOR_REDELIVERY"
    | "REPLACEMENT_SHIPMENT_RETURNED"
    | "REPLACEMENT_DELIVERED"
  >("REPLACEMENT_PROCESSING");
  const [replacementCourier, setReplacementCourier] = useState(request.replacementCourier || "");
  const [replacementTrackingNo, setReplacementTrackingNo] = useState(request.replacementTrackingNo || "");
  const [replacementDispatchDate, setReplacementDispatchDate] = useState(
    request.replacementDispatchDate?.slice(0, 10) || "",
  );
  const [replacementEstimatedDelivery, setReplacementEstimatedDelivery] = useState(
    request.replacementEstimatedDelivery?.slice(0, 10) || "",
  );
  const [replacementShipmentNote, setReplacementShipmentNote] = useState(request.replacementShipmentNote || "");
  const [replacementFailureReason, setReplacementFailureReason] = useState(request.replacementFailureReason || "CUSTOMER_NOT_AVAILABLE");
  const [replacementFailureReasonMessage, setReplacementFailureReasonMessage] = useState(request.replacementFailureReasonMessage || "");

  const isApprove = decision === "APPROVE";
  const isReject = decision === "REJECT";
  const isNeedMoreEvidence = decision === "NEED_MORE_EVIDENCE";
  const canSubmitDecision =
    decisionNote.trim().length > 0 &&
    (isNeedMoreEvidence || (isReject && rejectReason.trim().length > 0) || isApprove);
  const showReplacementShipmentSection =
    requestType === "EXCHANGE" &&
    ["RETURN_RECEIVED", "RETURN_CONDITION_APPROVED", "REPLACEMENT_PROCESSING", "REPLACEMENT_PACKED", "REPLACEMENT_READY_FOR_PICKUP", "REPLACEMENT_SHIPPED", "REPLACEMENT_OUT_FOR_DELIVERY", "REPLACEMENT_DELIVERY_FAILED", "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED", "REPLACEMENT_READY_FOR_REDELIVERY", "REPLACEMENT_SHIPMENT_RETURNED"].includes(status || "");
  const requiresReceiptEvidence = receiptOutcome === "DISPUTED";
  const nextReplacementStatuses = getNextReplacementStatuses(status);
  const availableReplacementStageOptions = replacementStageOptions.filter((option) =>
    nextReplacementStatuses.includes(option.value),
  );
  const selectedReplacementStage =
    availableReplacementStageOptions.find((option) => option.value === replacementStage)?.value ||
    availableReplacementStageOptions[0]?.value;

  useEffect(() => {
    if (selectedReplacementStage && replacementStage !== selectedReplacementStage) {
      setReplacementStage(selectedReplacementStage);
    }
  }, [replacementStage, selectedReplacementStage]);

  return (
    <>
      <section className="space-y-4 border border-zinc-300 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Actions</p>
          <h2 className="font-heading text-3xl uppercase">Workflow Control</h2>
        </div>

        {status === "REQUESTED" || status === "BRAND_REVIEWING" ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Review the request and choose the next step. Only the fields required for the selected action are shown.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Decision
                <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
                  <option value="APPROVE">Approve Request</option>
                  <option value="REJECT">Reject Request</option>
                  <option value="NEED_MORE_EVIDENCE">Need More Evidence</option>
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {isNeedMoreEvidence ? "Evidence request note" : "Decision note"}
                <input
                  className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900"
                  placeholder={isNeedMoreEvidence ? "Tell the customer exactly what is missing" : "Explain the decision"}
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                />
              </label>
            </div>

            {isReject ? (
              requestType === "EXCHANGE" ? (
                <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Reject reason
                  <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}>
                    <option value="">Select reject reason</option>
                    {rejectReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Reject reason
                  <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Reason for rejection" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
                </label>
              )
            ) : null}

            <button
              type="button"
              disabled={saving || !canSubmitDecision}
              onClick={async () => {
                setSaving(true);
                try {
                  const updated = await submitBrandReturnRecommendation(request.id, {
                    recommendation: decision,
                    recommendationNote: decisionNote.trim() || undefined,
                    rejectReason: rejectReason.trim() || undefined,
                  });
                  onUpdated(updated);
                  pushToast("Request decision saved.", "success");
                  router.refresh();
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to save the request decision.", "error");
                } finally {
                  setSaving(false);
                }
              }}
              className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Submit Decision"}
            </button>
          </div>
        ) : null}

        {status === "NEED_MORE_EVIDENCE" ? (
          <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Waiting for the customer to provide the additional evidence you requested.
          </div>
        ) : null}

        {status === "ADMIN_REVIEWING" ? (
          <div className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            This request is waiting on Broady admin because of a rejection or a disputed receipt condition.
          </div>
        ) : null}

        {availabilityRejected ? (
          <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This exchange was rejected because the requested replacement is unavailable. Admin can monitor the case, but no further approval is required here.
          </div>
        ) : null}

        <div className="border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500">Customer reason</p>
          <p className="mt-2">{formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
          {request.customerNote ? <p className="mt-2 text-zinc-600">Customer note: {request.customerNote}</p> : null}
        </div>

        {status === "BRAND_APPROVED" || status === "ADMIN_APPROVED" ? (
          <div className="space-y-4 border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-700">Request approved. Arrange the return pickup or return route with your courier details.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Return courier
                <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={returnCourier} onChange={(event) => setReturnCourier(event.target.value)}>
                  <option value="">Select courier</option>
                  {REGISTERED_COURIERS.map((courier) => (
                    <option key={courier} value={courier}>
                      {courier}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Return tracking number
                <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Courier tracking number" value={returnTrackingNumber} onChange={(event) => setReturnTrackingNumber(event.target.value)} />
              </label>
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Expected return date
                <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" type="date" value={expectedReturnDate} onChange={(event) => setExpectedReturnDate(event.target.value)} />
              </label>
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Return arrangement note
                <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Pickup or return note" value={returnNote} onChange={(event) => setReturnNote(event.target.value)} />
              </label>
            </div>
            <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Return instructions
              <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm text-zinc-900" placeholder="Pickup address or return instructions" value={returnInstructions} onChange={(event) => setReturnInstructions(event.target.value)} />
            </label>
            <button
              type="button"
              disabled={saving || !returnCourier.trim() || !returnTrackingNumber.trim() || !returnInstructions.trim() || !expectedReturnDate}
              onClick={async () => {
                setSaving(true);
                try {
                  const updated = await updateBrandReturnLogistics(request.id, {
                    status: "RETURN_ARRANGED",
                    returnCourier: returnCourier.trim(),
                    returnTrackingNumber: returnTrackingNumber.trim(),
                    returnInstructions: returnInstructions.trim(),
                    expectedReturnDate,
                    returnNote: returnNote.trim() || undefined,
                  });
                  onUpdated(updated);
                  pushToast("Return arrangement saved.", "success");
                  router.refresh();
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to arrange return.", "error");
                } finally {
                  setSaving(false);
                }
              }}
              className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Mark Return Arranged"}
            </button>
          </div>
        ) : null}

        {status === "RETURN_ARRANGED" || status === "RETURN_IN_TRANSIT" ? (
          <div className="space-y-3 border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-700">
              {status === "RETURN_ARRANGED"
                ? "Return has been arranged. Update transit when the package starts moving, then confirm receipt here."
                : "Original item is in transit. Confirm receipt once it reaches your team."}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Return courier
                <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={returnCourier} onChange={(event) => setReturnCourier(event.target.value)}>
                  <option value="">Select courier</option>
                  {REGISTERED_COURIERS.map((courier) => (
                    <option key={courier} value={courier}>
                      {courier}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Return tracking number
                <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Courier tracking number" value={returnTrackingNumber} onChange={(event) => setReturnTrackingNumber(event.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {status === "RETURN_ARRANGED" ? (
                <button
                  type="button"
                  disabled={saving || !returnTrackingNumber.trim()}
                  onClick={async () => {
                    setSaving(true);
                  try {
                      const updated = await updateBrandReturnLogistics(request.id, {
                        status: "RETURN_IN_TRANSIT",
                        returnCourier: returnCourier.trim() || undefined,
                        returnTrackingNumber: returnTrackingNumber.trim(),
                        returnInstructions: returnInstructions.trim() || undefined,
                        expectedReturnDate: expectedReturnDate || undefined,
                        returnNote: returnNote.trim() || undefined,
                      });
                      onUpdated(updated);
                      pushToast("Return marked in transit.", "success");
                      router.refresh();
                    } catch (error) {
                      pushToast(error instanceof Error ? error.message : "Unable to update return transit.", "error");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Mark Return In Transit"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setReceiptModalOpen(true)}
                className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Confirm Receipt
              </button>
            </div>
          </div>
        ) : null}

        {status === "REFUND_INITIATED" && requestType === "RETURN" ? (
          <div className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Original item condition was accepted during receipt confirmation. The refund request has been initiated and moved to admin review.
          </div>
        ) : null}

        {showReplacementShipmentSection ? (
          <div className="space-y-4 border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Replacement Processing</p>
              <h3 className="mt-1 font-heading text-2xl uppercase">Ship Replacement</h3>
            </div>
            <p className="text-sm text-zinc-700">
              Update the replacement flow stage. Shipment details are required only when you ship the replacement.
            </p>

            {request.replacementFailureReason || request.replacementNextAttemptDate ? (
              <div className="space-y-1 border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                {request.replacementFailureReason ? <p>Failure reason: {request.replacementFailureReason.replaceAll("_", " ")}</p> : null}
                {request.replacementNextAttemptDate ? <p>Next attempt: {request.replacementNextAttemptDate.slice(0, 16).replace("T", " ")}</p> : null}
              </div>
            ) : null}

            {availableReplacementStageOptions.length ? (
              <>
                <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Next replacement status
                  <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={selectedReplacementStage || ""} onChange={(event) => setReplacementStage(event.target.value as typeof replacementStage)}>
                    {availableReplacementStageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedReplacementStage === "REPLACEMENT_SHIPPED" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Replacement courier
                      <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={replacementCourier} onChange={(event) => setReplacementCourier(event.target.value)}>
                        <option value="">Select courier</option>
                        {REGISTERED_COURIERS.map((courier) => (
                          <option key={courier} value={courier}>
                            {courier}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Replacement tracking number
                      <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Courier tracking number" value={replacementTrackingNo} onChange={(event) => setReplacementTrackingNo(event.target.value)} />
                    </label>
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Replacement dispatch date
                      <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" type="date" value={replacementDispatchDate} onChange={(event) => setReplacementDispatchDate(event.target.value)} />
                    </label>
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Estimated delivery date
                      <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" type="date" value={replacementEstimatedDelivery} onChange={(event) => setReplacementEstimatedDelivery(event.target.value)} />
                    </label>
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 md:col-span-2">
                      Replacement shipment note
                      <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm text-zinc-900" placeholder="Dispatch note for the replacement shipment" value={replacementShipmentNote} onChange={(event) => setReplacementShipmentNote(event.target.value)} />
                    </label>
                  </div>
                ) : selectedReplacementStage === "REPLACEMENT_DELIVERY_FAILED" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Failure reason
                      <select className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" value={replacementFailureReason} onChange={(event) => setReplacementFailureReason(event.target.value)}>
                        {replacementFailureReasonOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {replacementFailureReason === "OTHER" ? (
                      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Custom failure detail
                        <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Describe the failure" value={replacementFailureReasonMessage} onChange={(event) => setReplacementFailureReasonMessage(event.target.value)} />
                      </label>
                    ) : null}
                    <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 md:col-span-2">
                      Failure note
                      <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm text-zinc-900" placeholder={replacementFailureReason === "INCORRECT_ADDRESS" ? "Explain the address issue so redelivery can be coordinated" : "Optional courier or support note"} value={replacementShipmentNote} onChange={(event) => setReplacementShipmentNote(event.target.value)} />
                    </label>
                  </div>
                ) : (
                  <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Progress note
                    <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm text-zinc-900" placeholder="Optional note for this stage" value={replacementShipmentNote} onChange={(event) => setReplacementShipmentNote(event.target.value)} />
                  </label>
                )}

                <button
                  type="button"
                  disabled={
                    saving ||
                    (
                      selectedReplacementStage === "REPLACEMENT_SHIPPED" &&
                      (
                        !replacementCourier.trim() ||
                        !replacementTrackingNo.trim() ||
                        !replacementDispatchDate ||
                        !replacementEstimatedDelivery ||
                        !replacementShipmentNote.trim()
                      )
                    ) ||
                    (
                      selectedReplacementStage === "REPLACEMENT_DELIVERY_FAILED" &&
                      (
                        !replacementFailureReason.trim() ||
                        (replacementFailureReason === "OTHER" && !replacementFailureReasonMessage.trim()) ||
                        (replacementFailureReason === "INCORRECT_ADDRESS" && !replacementShipmentNote.trim())
                      )
                    )
                  }
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const updated = await updateBrandReplacementShipment(request.id, {
                        status: selectedReplacementStage!,
                        replacementCourier: replacementCourier.trim() || undefined,
                        replacementTrackingNo: replacementTrackingNo.trim() || undefined,
                        replacementDispatchDate: replacementDispatchDate || undefined,
                        replacementEstimatedDelivery: replacementEstimatedDelivery || undefined,
                        replacementShipmentNote: replacementShipmentNote.trim() || undefined,
                        replacementFailureReason:
                          selectedReplacementStage === "REPLACEMENT_DELIVERY_FAILED"
                            ? replacementFailureReason
                            : undefined,
                        replacementFailureReasonMessage:
                          selectedReplacementStage === "REPLACEMENT_DELIVERY_FAILED"
                            ? replacementFailureReasonMessage.trim() || undefined
                            : undefined,
                      });
                      onUpdated(updated);
                      pushToast("Replacement stage updated.", "success");
                      router.refresh();
                    } catch (error) {
                      pushToast(error instanceof Error ? error.message : "Unable to update replacement shipment.", "error");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : selectedReplacementStage === "REPLACEMENT_SHIPPED" ? "Mark Replacement Shipped" : selectedReplacementStage === "REPLACEMENT_DELIVERY_FAILED" ? "Report Delivery Failure" : selectedReplacementStage === "REPLACEMENT_DELIVERED" ? "Mark Replacement Delivered" : "Save Next Status"}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1 text-sm text-zinc-700">
                  <p>Replacement courier: {request.replacementCourier || replacementCourier || "Not provided"}</p>
                  <p>Replacement tracking number: {request.replacementTrackingNo || replacementTrackingNo || "Not provided"}</p>
                  <p>Dispatch date: {request.replacementDispatchDate?.slice(0, 10) || replacementDispatchDate || "Not provided"}</p>
                  <p>Estimated delivery date: {request.replacementEstimatedDelivery?.slice(0, 10) || replacementEstimatedDelivery || "Not provided"}</p>
                </div>
                {status === "REPLACEMENT_SHIPPED" || status === "REPLACEMENT_OUT_FOR_DELIVERY" ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const updated = await markBrandReplacementDelivered(request.id);
                        onUpdated(updated);
                        pushToast("Replacement marked as delivered.", "success");
                        router.refresh();
                      } catch (error) {
                        pushToast(error instanceof Error ? error.message : "Unable to mark replacement delivered.", "error");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Mark Replacement Delivered"}
                  </button>
                ) : status === "REPLACEMENT_SHIPMENT_RETURNED" ? (
                  <div className="border border-zinc-300 bg-white p-3 text-sm text-zinc-700">
                    No further brand shipment actions are available. This replacement shipment has been returned after delivery issues.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {status === "BRAND_REJECTED" || status === "RETURN_CONDITION_DISPUTED" || status === "ADMIN_REJECTED" ? (
          <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {status === "ADMIN_REJECTED"
              ? `Rejected by Broady. ${request.adminDecisionNote || request.adminRejectedReason || "No further brand actions are available."}`
              : availabilityRejected
                ? `Exchange rejected. ${request.replacementUnavailableReason || request.brandRecommendationNote || "Replacement is unavailable."}`
                : "This request is waiting for Broady admin review."}
          </div>
        ) : null}

        {status === "COMPLETED" || status === "EXCHANGE_COMPLETED" ? (
          <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            This workflow is complete. Current final state: {formatReturnStatus(status)}.
          </div>
        ) : null}
      </section>

      {receiptModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setReceiptModalOpen(false)}>
          <div className="w-full max-w-2xl border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Receipt Confirmation</p>
              <h3 className="font-heading text-3xl uppercase">Confirm Returned Item Receipt</h3>
              <p className="text-sm text-zinc-600">
                Capture receipt and condition in one step. If you dispute the item condition, Broady admin will review the case.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={receiptOutcome === "APPROVED"} onChange={() => setReceiptOutcome("APPROVED")} />
                  Condition accepted
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={receiptOutcome === "DISPUTED"} onChange={() => setReceiptOutcome("DISPUTED")} />
                  Condition disputed
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Receipt date
                  <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" type="date" value={receiptReceivedAt} onChange={(event) => setReceiptReceivedAt(event.target.value)} />
                </label>
                <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Condition note
                  <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Describe the condition on receipt" value={receiptConditionNote} onChange={(event) => setReceiptConditionNote(event.target.value)} />
                </label>
              </div>

              {receiptOutcome === "DISPUTED" ? (
                <>
                  <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Dispute reason
                    <input className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900" placeholder="Why is the returned item condition disputed?" value={receiptDisputeReason} onChange={(event) => setReceiptDisputeReason(event.target.value)} />
                  </label>
                  <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Damage or issue note
                    <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm text-zinc-900" placeholder="Describe the issue found on receipt" value={receiptDamageNote} onChange={(event) => setReceiptDamageNote(event.target.value)} />
                  </label>
                  <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Evidence URLs
                    <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm text-zinc-900" placeholder="One evidence URL per line" value={receiptEvidenceUrls} onChange={(event) => setReceiptEvidenceUrls(event.target.value)} />
                  </label>
                </>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]" onClick={() => setReceiptModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  !receiptConditionNote.trim() ||
                  !receiptReceivedAt ||
                  (requiresReceiptEvidence &&
                    (!receiptDisputeReason.trim() || !receiptEvidenceUrls.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean).length))
                }
                onClick={async () => {
                  setSaving(true);
                  try {
                    const updated = await confirmBrandReturnReceipt(request.id, {
                      outcome: receiptOutcome,
                      conditionNote: receiptConditionNote.trim(),
                      damageNote: receiptDamageNote.trim() || undefined,
                      disputeReason: receiptOutcome === "DISPUTED" ? receiptDisputeReason.trim() : undefined,
                      evidenceUrls:
                        receiptOutcome === "DISPUTED"
                          ? receiptEvidenceUrls.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean)
                          : undefined,
                      receivedAt: receiptReceivedAt,
                    });
                    onUpdated(updated);
                    pushToast("Receipt confirmation saved.", "success");
                    setReceiptModalOpen(false);
                    router.refresh();
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : "Unable to confirm receipt.", "error");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Receipt"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
