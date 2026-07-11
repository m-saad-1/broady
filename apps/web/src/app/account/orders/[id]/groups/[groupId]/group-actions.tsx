"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelUserSubOrder,
  createUserSubOrderReturnRequest,
  getUserReturnRequests,
  reorderUserSubOrder,
  retryUserOrderPayment,
  updateUserOrderAddress,
  type CancelReasonCode,
  type ReturnReasonCode,
  type ReturnRequestPayload,
} from "@/lib/api";
import {
  formatReturnReasonLabel,
  getExchangeResolutionForReason,
  getFinalRequestLabel,
} from "@/lib/return-workflow";
import { useToastStore } from "@/stores/toast-store";
import type { ReturnRequestRecord } from "@/types/marketplace";

type GroupActionsProps = {
  orderId: string;
  subOrderId: string;
  brandName: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    selectedColor?: string;
    selectedSize?: string;
    availableColors: string[];
    availableSizes: string[];
  }>;
  canCancel: boolean;
  cancellationRequiresReview: boolean;
  canReturn: boolean;
  canReorder: boolean;
  canAddressCorrection: boolean;
  canRetryPayment?: boolean;
  currentDeliveryAddress: string;
};

const CANCEL_REASON_OPTIONS: Array<{ code: CancelReasonCode; label: string }> = [
  { code: "CHANGED_MIND", label: "Changed my mind" },
  { code: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { code: "WRONG_SIZE_SELECTED", label: "Wrong size selected" },
  { code: "WRONG_COLOR_SELECTED", label: "Wrong color selected" },
  { code: "FOUND_BETTER_PRICE", label: "Found a better price" },
  { code: "DELIVERY_TOO_SLOW", label: "Delivery is taking too long" },
  { code: "PAYMENT_ISSUE", label: "Payment issue" },
  { code: "OTHER", label: "Other" },
];

const RETURN_REASON_OPTIONS: Array<{ code: ReturnReasonCode; label: string }> = [
  { code: "DAMAGED_ITEM", label: "Damaged item" },
  { code: "DEFECTIVE_PRODUCT", label: "Defective product" },
  { code: "WRONG_ITEM", label: "Wrong item received" },
  { code: "WRONG_SIZE", label: "Wrong size" },
  { code: "WRONG_COLOR", label: "Wrong color" },
  { code: "DIFFERENT_FROM_IMAGES", label: "Different from images shown" },
  { code: "QUALITY_ISSUE", label: "Quality issue" },
  { code: "CHANGED_MIND", label: "Changed my mind" },
  { code: "OTHER", label: "Other" },
];

const evidenceRequiredReasons = new Set<ReturnReasonCode>(["DAMAGED_ITEM", "DEFECTIVE_PRODUCT", "WRONG_ITEM", "WRONG_SIZE", "WRONG_COLOR"]);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function GroupActions({
  orderId,
  subOrderId,
  brandName,
  canCancel,
  cancellationRequiresReview,
  canReturn,
  canReorder,
  canAddressCorrection,
  canRetryPayment = false,
  currentDeliveryAddress,
  items,
}: GroupActionsProps) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const [busy, setBusy] = useState<"cancel" | "reorder" | "address" | "return" | "retry-payment" | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [openAddress, setOpenAddress] = useState(false);
  const [openReturn, setOpenReturn] = useState(false);
  const [reasonCode, setReasonCode] = useState<CancelReasonCode>("CHANGED_MIND");
  const [customReason, setCustomReason] = useState("");
  const [returnReasonCode, setReturnReasonCode] = useState<ReturnReasonCode>("DAMAGED_ITEM");
  const [returnReasonText, setReturnReasonText] = useState("");
  const [returnMode, setReturnMode] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [preferredResolution, setPreferredResolution] = useState<NonNullable<ReturnRequestPayload["preferredResolution"]>>("REFUND");
  const [customerRefundPreference, setCustomerRefundPreference] = useState("ORIGINAL_SOURCE");
  const [evidenceUrls, setEvidenceUrls] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [exchangeVariantByItemId, setExchangeVariantByItemId] = useState<Record<string, string>>({});
  const [deliveryAddress, setDeliveryAddress] = useState(currentDeliveryAddress || "");
  const [currentReturnRequest, setCurrentReturnRequest] = useState<ReturnRequestRecord | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<{
    id: string;
    typeLabel: "Return" | "Exchange";
    requestLabel: string;
    itemSummary: string;
    reasonLabel: string;
    route: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    void getUserReturnRequests(orderId, subOrderId)
      .then((requests) => {
        if (mounted) {
          setCurrentReturnRequest(requests[0] || null);
        }
      })
      .catch(() => {
        if (mounted) {
          setCurrentReturnRequest(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [orderId, subOrderId]);

  const parsedEvidenceUrls = evidenceUrls
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  const isExchangeRequest = returnMode === "EXCHANGE";
  const requiresVariantSelection = preferredResolution === "EXCHANGE_SIZE" || preferredResolution === "EXCHANGE_COLOR";
  const returnSubmitLabel = isExchangeRequest ? "Submit Exchange Request" : "Submit Return Request";
  const selectedReasonLabel = formatReturnReasonLabel(returnReasonCode, returnReasonText);
  const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));

  function getCurrentVariantLabel(item: GroupActionsProps["items"][number]) {
    return preferredResolution === "EXCHANGE_COLOR" ? item.selectedColor || "" : item.selectedSize || "";
  }

  function getExchangeOptions(item: GroupActionsProps["items"][number]) {
    const currentVariant = getCurrentVariantLabel(item);
    const baseOptions = preferredResolution === "EXCHANGE_COLOR" ? item.availableColors : item.availableSizes;
    return Array.from(
      new Set(
        baseOptions
          .map((option) => option.trim())
          .filter(Boolean),
      ),
    ).filter((option) => option !== currentVariant);
  }

  const unavailableExchangeItems =
    requiresVariantSelection
      ? selectedItems.filter((item) => {
          const options = getExchangeOptions(item);
          const nextVariant = exchangeVariantByItemId[item.id];
          return options.length === 0 || !nextVariant || !options.includes(nextVariant);
        })
      : [];

  const submitDisabled =
    busy !== null ||
    selectedItemIds.length === 0 ||
    returnReasonText.length > 500 ||
    (!parsedEvidenceUrls.length && evidenceRequiredReasons.has(returnReasonCode)) ||
    (returnReasonCode === "OTHER" && !returnReasonText.trim()) ||
    parsedEvidenceUrls.length > 5 ||
    unavailableExchangeItems.length > 0;

  const startReturnRequest = (mode: "RETURN" | "EXCHANGE") => {
    setReturnMode(mode);
    setPreferredResolution(mode === "EXCHANGE" ? getExchangeResolutionForReason(returnReasonCode) : "REFUND");
    setOpenReturn(true);
  };

  useEffect(() => {
    if (returnMode === "EXCHANGE") {
      setPreferredResolution(getExchangeResolutionForReason(returnReasonCode));
    }
  }, [returnMode, returnReasonCode]);

  useEffect(() => {
    if (!openReturn) return;
    setSelectedItemIds((current) => (current.length ? current : items.map((item) => item.id)));
  }, [items, openReturn]);

  useEffect(() => {
    setExchangeVariantByItemId((current) => {
      const next: Record<string, string> = {};
      for (const item of selectedItems) {
        const options = getExchangeOptions(item);
        next[item.id] = current[item.id] && options.includes(current[item.id]) ? current[item.id] : options[0] || "";
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredResolution, selectedItemIds]);

  const doReorder = async () => {
    setBusy("reorder");
    try {
      await reorderUserSubOrder(orderId, subOrderId);
      pushToast("Order reordered successfully.", "success");
      router.push("/cart");
      router.refresh();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, "Failed to reorder"), "error");
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    if (reasonCode === "OTHER" && !customReason.trim()) return;

    setBusy("cancel");
    try {
      await cancelUserSubOrder(orderId, subOrderId, {
        reasonCode,
        customReason: reasonCode === "OTHER" ? customReason.trim() : undefined,
        note: `Canceled ${brandName} vendor order by customer`,
      });
      setOpenCancel(false);
      setReasonCode("CHANGED_MIND");
      setCustomReason("");
      pushToast(cancellationRequiresReview ? "Cancellation request submitted for Broady review." : "Order has been canceled successfully.", "success");
      router.push(cancellationRequiresReview ? `/account/orders/${orderId}/groups/${subOrderId}/cancellation` : `/account/orders/${orderId}/groups/${subOrderId}/refund`);
      router.refresh();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, "Failed to cancel order"), "error");
    } finally {
      setBusy(null);
    }
  };

  const doAddressUpdate = async () => {
    const nextAddress = deliveryAddress.trim();
    if (!nextAddress) {
      pushToast("Delivery address is required.", "error");
      return;
    }

    setBusy("address");
    try {
      await updateUserOrderAddress(orderId, nextAddress);
      setOpenAddress(false);
      pushToast("Address updated. Delivery will be re-attempted.", "success");
      router.refresh();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, "Failed to update address"), "error");
    } finally {
      setBusy(null);
    }
  };

  const doReturnRequest = async () => {
    if (returnReasonText.length > 500) {
      pushToast("Comment cannot exceed 500 characters.", "error");
      return;
    }
    if (evidenceRequiredReasons.has(returnReasonCode) && !parsedEvidenceUrls.length) {
      pushToast("Evidence image URLs are required for this return reason.", "error");
      return;
    }
    if (parsedEvidenceUrls.length > 5) {
      pushToast("You can attach up to 5 evidence image URLs.", "error");
      return;
    }
    if (returnReasonCode === "OTHER" && !returnReasonText.trim()) {
      pushToast("A return comment is required when choosing Other.", "error");
      return;
    }
    if (!selectedItemIds.length) {
      pushToast("Select at least one product to continue.", "error");
      return;
    }
    if (unavailableExchangeItems.length > 0) {
      pushToast("This variant is not available.", "error");
      return;
    }

    setBusy("return");
    try {
      const requestedVariantSummary = requiresVariantSelection
        ? selectedItems
            .map((item) => {
              const label = preferredResolution === "EXCHANGE_COLOR" ? "Color" : "Size";
              const value = exchangeVariantByItemId[item.id] || getCurrentVariantLabel(item);
              return `${item.name}: ${label} ${value}`;
            })
            .join(", ")
        : isExchangeRequest
          ? `${selectedItems.map((item) => item.name).join(", ")}: ${preferredResolution.replaceAll("_", " ").toLowerCase()}`
        : undefined;
      const nextRequest = await createUserSubOrderReturnRequest(orderId, subOrderId, {
        reasonCode: returnReasonCode,
        reasonText: returnReasonText.trim() || undefined,
        customerNote: returnReasonText.trim() || undefined,
        preferredResolution,
        evidenceImageUrls: parsedEvidenceUrls.length ? parsedEvidenceUrls : undefined,
        orderItemIds: selectedItemIds,
        requestedVariantSummary,
        requestedExchangeType:
          preferredResolution === "EXCHANGE_COLOR"
            ? "COLOR"
            : preferredResolution === "EXCHANGE_DAMAGED_REPLACEMENT"
              ? "DAMAGED_REPLACEMENT"
              : preferredResolution === "EXCHANGE_WRONG_ITEM_REPLACEMENT"
                ? "WRONG_ITEM_REPLACEMENT"
                : preferredResolution === "EXCHANGE_OTHER"
                  ? "OTHER"
                  : isExchangeRequest
                    ? "SIZE"
                    : undefined,
        requestedReplacementColor:
          preferredResolution === "EXCHANGE_COLOR" ? selectedItems.map((item) => exchangeVariantByItemId[item.id]).filter(Boolean)[0] : undefined,
        requestedReplacementSize:
          preferredResolution === "EXCHANGE_SIZE" ? selectedItems.map((item) => exchangeVariantByItemId[item.id]).filter(Boolean)[0] : undefined,
        requestType: isExchangeRequest ? "EXCHANGE" : "RETURN",
        customerRefundPreference: isExchangeRequest ? undefined : customerRefundPreference,
      });
      setCurrentReturnRequest(nextRequest);
      setOpenReturn(false);
      setReturnReasonCode("DAMAGED_ITEM");
      setReturnReasonText("");
      setReturnMode("RETURN");
      setPreferredResolution("REFUND");
      setCustomerRefundPreference("ORIGINAL_SOURCE");
      setEvidenceUrls("");
      setSelectedItemIds([]);
      setExchangeVariantByItemId({});
      pushToast(isExchangeRequest ? "Exchange request submitted for brand review." : "Return request submitted for brand review.", "success");
      setSubmittedRequest({
        id: nextRequest.id,
        typeLabel: isExchangeRequest ? "Exchange" : "Return",
        requestLabel: isExchangeRequest ? "Exchange request submitted" : "Return request submitted",
        itemSummary: selectedItems.map((item) => `${item.name} x${item.quantity}`).join(", "),
        reasonLabel: selectedReasonLabel,
        route:
          !isExchangeRequest && (preferredResolution === "REFUND" || preferredResolution === "STORE_CREDIT")
            ? `/account/orders/${orderId}/groups/${subOrderId}/return`
            : `/account/orders/${orderId}/groups/${subOrderId}/exchange`,
      });
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, "Failed to submit return request"), "error");
    } finally {
      setBusy(null);
    }
  };

  const doRetryPayment = async () => {
    setBusy("retry-payment");
    try {
      const result = await retryUserOrderPayment(orderId);
      pushToast("Payment session prepared. Redirecting to demo gateway.", "success");
      window.location.href = result.redirectUrl;
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, "Failed to retry payment"), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!canCancel && !canReorder && !canAddressCorrection && !canReturn && !canRetryPayment) {
    return null;
  }

  const returnFlowLabel = currentReturnRequest
    ? getFinalRequestLabel(currentReturnRequest)
    : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canCancel ? (
          <button
            type="button"
            onClick={() => setOpenCancel(true)}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 hover:bg-zinc-100"
          >
            {busy === "cancel" ? "Submitting..." : cancellationRequiresReview ? "Request Cancellation" : "Cancel Order"}
          </button>
        ) : null}
        {canReorder ? (
          <button
            type="button"
            onClick={() => void doReorder()}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60 hover:bg-zinc-800"
          >
            {busy === "reorder" ? "Reordering..." : "Reorder"}
          </button>
        ) : null}
        {canRetryPayment ? (
          <button
            type="button"
            onClick={() => void doRetryPayment()}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60 hover:bg-zinc-800"
          >
            {busy === "retry-payment" ? "Redirecting..." : "Retry Payment"}
          </button>
        ) : null}
        {canReturn ? (
          currentReturnRequest ? (
            <Link
              href={
                currentReturnRequest.preferredResolution?.startsWith("EXCHANGE")
                  ? `/account/orders/${orderId}/groups/${subOrderId}/exchange`
                  : `/account/orders/${orderId}/groups/${subOrderId}/return`
              }
              className={`inline-flex h-10 items-center justify-center border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              currentReturnRequest.status === "COMPLETED" || currentReturnRequest.status === "EXCHANGE_COMPLETED"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : ["BRAND_REJECTED", "ADMIN_REJECTED", "RETURN_CONDITION_DISPUTED", "REJECTED"].includes(currentReturnRequest.status)
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-zinc-300 bg-zinc-50 text-zinc-700"
            }`}
            >
              {returnFlowLabel}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startReturnRequest("RETURN")}
                disabled={busy !== null}
                className="inline-flex h-10 items-center justify-center border border-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 hover:bg-zinc-100"
              >
                {busy === "return" ? "Submitting..." : "Return"}
              </button>
              <button
                type="button"
                onClick={() => startReturnRequest("EXCHANGE")}
                disabled={busy !== null}
                className="inline-flex h-10 items-center justify-center border border-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 hover:bg-zinc-100"
              >
                Exchange
              </button>
            </>
          )
        ) : null}
        {canAddressCorrection ? (
          <button
            type="button"
            onClick={() => {
              setDeliveryAddress(currentDeliveryAddress || "");
              setOpenAddress(true);
            }}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center border border-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 hover:bg-zinc-100"
          >
            {busy === "address" ? "Updating..." : "Update Address"}
          </button>
        ) : null}
      </div>

      {openCancel ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenCancel(false)}>
          <div className="w-full max-w-md max-h-[95vh] overflow-y-auto space-y-5 border border-zinc-300 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="font-heading text-2xl uppercase">{cancellationRequiresReview ? "Request Cancellation" : "Cancel Order"}</h3>
              <p className="text-sm text-zinc-600">
                {cancellationRequiresReview
                  ? "This item may already be packed or ready for courier pickup. Your cancellation request will be reviewed within 4 hours."
                  : "Select why you want to cancel this order."}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Reason
                <select
                  className="h-11 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value as CancelReasonCode)}
                >
                  {CANCEL_REASON_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {reasonCode === "OTHER" ? (
                <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Custom Reason
                  <textarea
                    className="min-h-24 w-full border border-zinc-300 p-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                    placeholder="Tell us why you are canceling..."
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button 
                type="button" 
                className="h-10 px-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 hover:text-black" 
                onClick={() => setOpenCancel(false)}
              >
                Keep
              </button>
              <button
                type="button"
                className="h-10 border-2 border-black bg-black px-6 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-zinc-800 hover:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={reasonCode === "OTHER" && !customReason.trim()}
                onClick={() => void doCancel()}
              >
                {cancellationRequiresReview ? "Submit Request" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openReturn ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenReturn(false)}>
          <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto space-y-5 border border-zinc-300 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="font-heading text-2xl uppercase">{isExchangeRequest ? "Exchange Request" : "Return Request"}</h3>
              <p className="text-sm text-zinc-600">Submit your request with the evidence and details the brand needs to review it quickly.</p>
            </div>

            <section className="space-y-3 border border-zinc-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Select product(s)</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">{selectedItemIds.length} selected</p>
              </div>
              <div className="space-y-2">
                {items.map((item) => {
                  const checked = selectedItemIds.includes(item.id);
                  return (
                    <label key={item.id} className={`flex cursor-pointer items-start gap-3 border px-3 py-3 ${checked ? "border-black bg-zinc-50" : "border-zinc-200"}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-black"
                        checked={checked}
                        onChange={() => {
                          setSelectedItemIds((current) =>
                            current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id],
                          );
                        }}
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-zinc-900">{item.name}</span>
                        <span className="mt-1 block text-xs text-zinc-500">
                          Qty {item.quantity}
                          {item.selectedSize ? ` · Size ${item.selectedSize}` : ""}
                          {item.selectedColor ? ` · Color ${item.selectedColor}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Reason
                <select
                  className="h-11 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                  value={returnReasonCode}
                  onChange={(event) => setReturnReasonCode(event.target.value as ReturnReasonCode)}
                >
                  {RETURN_REASON_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {isExchangeRequest ? "Exchange Resolution" : "Resolution"}
                {isExchangeRequest ? (
                  <div className="flex h-11 items-center border border-zinc-300 px-3 text-sm font-normal text-zinc-900">
                    {preferredResolution.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                  </div>
                ) : (
                  <select
                    className="h-11 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                    value={preferredResolution}
                    onChange={(event) => setPreferredResolution(event.target.value as NonNullable<ReturnRequestPayload["preferredResolution"]>)}
                  >
                    <option value="REFUND">Refund</option>
                    <option value="STORE_CREDIT">Store credit</option>
                  </select>
                )}
              </label>
            </div>

            {!isExchangeRequest ? (
              <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Preferred refund method
                <select
                  className="h-11 w-full border border-zinc-300 px-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                  value={customerRefundPreference}
                  onChange={(event) => setCustomerRefundPreference(event.target.value)}
                >
                  <option value="ORIGINAL_SOURCE">Original source</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="WALLET_CREDIT">Wallet credit</option>
                </select>
              </label>
            ) : null}

            {requiresVariantSelection ? (
              <section className="space-y-3 border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Exchange detail selector
                </p>
                <div className="space-y-3">
                  {selectedItems.map((item) => {
                    const options = getExchangeOptions(item);
                    const originalVariant = getCurrentVariantLabel(item);
                    const selectedVariant = exchangeVariantByItemId[item.id] || "";
                    const isUnavailable = options.length === 0 || !selectedVariant || !options.includes(selectedVariant);
                    return (
                      <div key={item.id} className="border border-zinc-200 p-3">
                        <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                          Original: {originalVariant || "Not specified"}
                        </p>
                        <select
                          className="mt-3 h-11 w-full border border-zinc-300 px-3 text-sm text-zinc-900 focus:border-black focus:outline-none"
                          value={selectedVariant}
                          onChange={(event) =>
                            setExchangeVariantByItemId((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                          disabled={!options.length}
                        >
                          <option value="" disabled>
                            {options.length
                              ? `Choose a new ${preferredResolution === "EXCHANGE_COLOR" ? "color" : "size"}`
                              : `No ${preferredResolution === "EXCHANGE_COLOR" ? "color" : "size"} variants available`}
                          </option>
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {isUnavailable ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-700">This variant is not available.</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Comment
              <textarea
                className="min-h-20 w-full border border-zinc-300 p-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                placeholder="Add details for Broady and the brand"
                value={returnReasonText}
                maxLength={500}
                onChange={(event) => setReturnReasonText(event.target.value)}
              />
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">{returnReasonText.length}/500 characters</p>
            </label>

            <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Evidence Image URLs
              <textarea
                className="min-h-20 w-full border border-zinc-300 p-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                placeholder="Paste image URLs, one per line"
                value={evidenceUrls}
                onChange={(event) => setEvidenceUrls(event.target.value)}
              />
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">Up to 5 image URLs. {parsedEvidenceUrls.length}/5 added.</p>
            </label>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 px-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 hover:text-black"
                onClick={() => setOpenReturn(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="h-10 border-2 border-black bg-black px-6 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-zinc-800 hover:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitDisabled}
                onClick={() => void doReturnRequest()}
              >
                {busy === "return" ? "Submitting..." : returnSubmitLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {submittedRequest ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 p-4" onClick={() => setSubmittedRequest(null)}>
          <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto space-y-5 border border-zinc-300 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Submitted</p>
              <h3 className="font-heading text-3xl uppercase">{submittedRequest.requestLabel}</h3>
              <p className="text-sm text-zinc-600">Broady has received your request and it is now ready to be tracked.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Type</p>
                <p className="mt-2 text-sm font-semibold">{submittedRequest.typeLabel}</p>
              </div>
              <div className="border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Item(s)</p>
                <p className="mt-2 text-sm text-zinc-700">{submittedRequest.itemSummary}</p>
              </div>
              <div className="border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Reason</p>
                <p className="mt-2 text-sm text-zinc-700">{submittedRequest.reasonLabel}</p>
              </div>
            </div>

            <div className="border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Timeline preview</p>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700 md:grid-cols-2">
                {(submittedRequest.typeLabel === "Exchange"
                  ? ["Submitted", "Under review", "Approved", "Pickup", "Replacement shipped", "Done"]
                  : ["Submitted", "Under review", "Approved", "Pickup", "Refund"]
                ).map((step, index) => (
                  <p key={step} className="border border-zinc-200 bg-white px-3 py-2">
                    <span className="font-semibold">{index + 1}.</span> {step}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSubmittedRequest(null)}
                className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(submittedRequest.route);
                  router.refresh();
                }}
                className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              >
                Track my request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openAddress ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenAddress(false)}>
          <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto space-y-5 border border-zinc-300 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="font-heading text-2xl uppercase">Address Correction</h3>
              <p className="text-sm text-zinc-600">Update your delivery address so this order can be re-attempted.</p>
            </div>

            <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              New Delivery Address
              <textarea
                className="min-h-28 w-full border border-zinc-300 p-3 text-sm font-normal text-zinc-900 focus:border-black focus:outline-none"
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="House/Flat, street, area, city"
              />
            </label>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 px-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 hover:text-black"
                onClick={() => setOpenAddress(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 border-2 border-black bg-black px-6 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-zinc-800 hover:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void doAddressUpdate()}
                disabled={!deliveryAddress.trim() || busy === "address"}
              >
                {busy === "address" ? "Saving..." : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
