"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { getBrandReturnRequest, markBrandReplacementDelivered, updateBrandReplacementShipment } from "@/lib/api";
import { REGISTERED_COURIERS } from "@/lib/couriers";
import { getDisplayReturnStatus, getNextReplacementStatuses } from "@/lib/return-workflow";
import { useToastStore } from "@/stores/toast-store";
import type { ReturnRequestRecord } from "@/types/marketplace";

type ReplacementStageState =
  | "REPLACEMENT_PROCESSING"
  | "REPLACEMENT_PACKED"
  | "REPLACEMENT_READY_FOR_PICKUP"
  | "REPLACEMENT_SHIPPED"
  | "REPLACEMENT_OUT_FOR_DELIVERY"
  | "REPLACEMENT_DELIVERY_FAILED"
  | "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
  | "REPLACEMENT_READY_FOR_REDELIVERY"
  | "REPLACEMENT_SHIPMENT_RETURNED"
  | "REPLACEMENT_DELIVERED";

const REPLACEMENT_FAILURE_REASONS = [
  { code: "CUSTOMER_NOT_AVAILABLE", label: "Customer not available" },
  { code: "INCORRECT_ADDRESS", label: "Incorrect address" },
  { code: "PHONE_UNREACHABLE", label: "Phone unreachable" },
  { code: "REFUSED_DELIVERY", label: "Refused delivery" },
  { code: "AREA_NOT_SERVICEABLE", label: "Area not serviceable" },
  { code: "COURIER_ISSUE", label: "Courier issue" },
  { code: "OTHER", label: "Other" },
] as const;

export default function BrandReplacementShipmentPage({ params }: { params: Promise<{ returnRequestId: string }> }) {
  const resolvedParams = use(params);
  const pushToast = useToastStore((state) => state.pushToast);
  const [request, setRequest] = useState<ReturnRequestRecord | null>(null);
  const [status, setStatus] = useState<ReplacementStageState>("REPLACEMENT_PROCESSING");
  const [replacementTrackingNo, setReplacementTrackingNo] = useState("");
  const [replacementCourier, setReplacementCourier] = useState("");
  const [replacementDispatchDate, setReplacementDispatchDate] = useState("");
  const [replacementEstimatedDelivery, setReplacementEstimatedDelivery] = useState("");
  const [replacementShipmentNote, setReplacementShipmentNote] = useState("");
  const [replacementFailureReason, setReplacementFailureReason] = useState<(typeof REPLACEMENT_FAILURE_REASONS)[number]["code"]>("CUSTOMER_NOT_AVAILABLE");
  const [replacementFailureReasonMessage, setReplacementFailureReasonMessage] = useState("");

  useEffect(() => {
    getBrandReturnRequest(resolvedParams.returnRequestId).then((nextRequest) => {
      setRequest(nextRequest);
      const nextStatus = getNextReplacementStatuses(getDisplayReturnStatus(nextRequest))[0];
      if (nextStatus) setStatus(nextStatus as ReplacementStageState);
      setReplacementTrackingNo(nextRequest?.replacementTrackingNo || "");
      setReplacementCourier(nextRequest?.replacementCourier || "");
      setReplacementDispatchDate(nextRequest?.replacementDispatchDate?.slice(0, 10) || "");
      setReplacementEstimatedDelivery(nextRequest?.replacementEstimatedDelivery?.slice(0, 10) || "");
      setReplacementShipmentNote(nextRequest?.replacementShipmentNote || "");
      setReplacementFailureReason((nextRequest?.replacementFailureReason as (typeof REPLACEMENT_FAILURE_REASONS)[number]["code"] | undefined) || "CUSTOMER_NOT_AVAILABLE");
      setReplacementFailureReasonMessage(nextRequest?.replacementFailureReasonMessage || "");
    }).catch(() => setRequest(null));
  }, [resolvedParams.returnRequestId]);

  if (!request) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10">
        <p className="border border-zinc-300 p-5 text-sm text-zinc-700">Exchange request not found.</p>
      </main>
    );
  }

  const displayStatus = getDisplayReturnStatus(request);
  const nextStatuses = getNextReplacementStatuses(displayStatus);
  const availableNextStatus = nextStatuses[0];
  const selectedNextStatus = nextStatuses.includes(status) ? status : availableNextStatus;
  const needsShipmentFields = selectedNextStatus === "REPLACEMENT_SHIPPED";
  const isReplacementComplete = displayStatus === "REPLACEMENT_DELIVERED" || displayStatus === "EXCHANGE_COMPLETED";
  const isFailureFlow = selectedNextStatus === "REPLACEMENT_DELIVERY_FAILED";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-4xl uppercase">Replacement Shipment Update</h1>
      </header>

      <section className="space-y-3 border border-zinc-300 p-5">
        <p className="text-sm">Request: {request.id}</p>
        <p className="text-sm">Replacement status: {request.replacementStatus || request.status || "Not started"}</p>
        <p className="text-sm">Requested replacement: {request.requestedVariantSummary || "Exchange request"}</p>
      </section>

      <section className="space-y-4 border border-zinc-300 p-5">
        {isReplacementComplete ? (
          <div className="space-y-3 border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900">Replacement shipment is in progress</p>
            <p className="text-sm text-green-900">Tracking Number: <span className="font-mono">{request.replacementTrackingNo}</span></p>
            <p className="text-sm text-green-900">Courier: <span className="font-semibold">{request.replacementCourier}</span></p>
            {displayStatus === "REPLACEMENT_DELIVERED" ? <p className="text-sm font-bold text-green-700">Replacement has been delivered.</p> : null}
            {displayStatus === "EXCHANGE_COMPLETED" ? <p className="text-sm font-bold text-green-700">Exchange process is complete.</p> : null}
          </div>
        ) : (
          <>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Next replacement status
              <select className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" value={selectedNextStatus || ""} onChange={(event) => setStatus(event.target.value as ReplacementStageState)} disabled={!nextStatuses.length}>
                {nextStatuses.length ? nextStatuses.map((nextStatus) => (
                  <option key={nextStatus} value={nextStatus}>
                    {nextStatus.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                  </option>
                )) : <option value="">No further status available</option>}
              </select>
            </label>

            {request.replacementFailureReason || request.replacementNextAttemptDate ? (
              <div className="space-y-1 border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                {request.replacementFailureReason ? <p>Failure reason: {request.replacementFailureReason.replaceAll("_", " ")}</p> : null}
                {request.replacementNextAttemptDate ? <p>Next attempt: {request.replacementNextAttemptDate.slice(0, 16).replace("T", " ")}</p> : null}
              </div>
            ) : null}

            {needsShipmentFields ? (
              <>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Replacement courier
                  <select className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" value={replacementCourier} onChange={(event) => setReplacementCourier(event.target.value)}>
                    <option value="">Select courier</option>
                    {REGISTERED_COURIERS.map((courier) => (
                      <option key={courier} value={courier}>
                        {courier}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Replacement tracking number
                  <input className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" value={replacementTrackingNo} onChange={(event) => setReplacementTrackingNo(event.target.value)} placeholder="Courier tracking number" />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Replacement dispatch date
                  <input className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" type="date" value={replacementDispatchDate} onChange={(event) => setReplacementDispatchDate(event.target.value)} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Estimated delivery date
                  <input className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" type="date" value={replacementEstimatedDelivery} onChange={(event) => setReplacementEstimatedDelivery(event.target.value)} />
                </label>
              </>
            ) : isFailureFlow ? (
              <>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Failure reason
                  <select className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" value={replacementFailureReason} onChange={(event) => setReplacementFailureReason(event.target.value as (typeof REPLACEMENT_FAILURE_REASONS)[number]["code"])}>
                    {REPLACEMENT_FAILURE_REASONS.map((reason) => (
                      <option key={reason.code} value={reason.code}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
                {replacementFailureReason === "OTHER" ? (
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Custom failure detail
                    <input className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm" value={replacementFailureReasonMessage} onChange={(event) => setReplacementFailureReasonMessage(event.target.value)} placeholder="Describe the failure" />
                  </label>
                ) : null}
              </>
            ) : null}

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Replacement shipment note
              <textarea className="mt-2 min-h-24 w-full border border-zinc-300 p-3 text-sm" value={replacementShipmentNote} onChange={(event) => setReplacementShipmentNote(event.target.value)} placeholder={needsShipmentFields ? "Dispatch note for the shipment" : isFailureFlow && replacementFailureReason === "INCORRECT_ADDRESS" ? "Explain the address issue for the next action" : "Optional stage note"} />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  (needsShipmentFields &&
                  (!replacementTrackingNo.trim() || !replacementCourier.trim() || !replacementDispatchDate || !replacementEstimatedDelivery || !replacementShipmentNote.trim())) ||
                  (isFailureFlow &&
                  (!replacementFailureReason.trim() || (replacementFailureReason === "OTHER" && !replacementFailureReasonMessage.trim()) || (replacementFailureReason === "INCORRECT_ADDRESS" && !replacementShipmentNote.trim())))
                }
                onClick={async () => {
                  try {
                    if (selectedNextStatus === "REPLACEMENT_DELIVERED") {
                      const updated = await markBrandReplacementDelivered(request.id);
                      setRequest(updated);
                      pushToast("Replacement marked as delivered.", "success");
                      return;
                    }

                    const updated = await updateBrandReplacementShipment(request.id, {
                      status: (selectedNextStatus || status) as ReplacementStageState,
                      replacementTrackingNo: replacementTrackingNo.trim() || undefined,
                      replacementCourier: replacementCourier.trim() || undefined,
                      replacementDispatchDate: replacementDispatchDate || undefined,
                      replacementEstimatedDelivery: replacementEstimatedDelivery || undefined,
                      replacementShipmentNote: replacementShipmentNote.trim() || undefined,
                      replacementFailureReason: isFailureFlow ? replacementFailureReason : undefined,
                      replacementFailureReasonMessage: isFailureFlow ? replacementFailureReasonMessage.trim() || undefined : undefined,
                    });
                    setRequest(updated);
                    pushToast("Replacement shipment updated.", "success");
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : "Unable to update replacement shipment.", "error");
                  }
                }}
                className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {selectedNextStatus === "REPLACEMENT_SHIPPED"
                  ? "Mark Replacement Shipped"
                  : selectedNextStatus === "REPLACEMENT_DELIVERY_FAILED"
                    ? "Report Delivery Failure"
                  : selectedNextStatus === "REPLACEMENT_DELIVERED"
                    ? "Mark Replacement Delivered"
                    : "Save Next Status"}
              </button>
              <Link href={`/brand/operations/returns/${request.id}`} className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
                Back to Detail
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
