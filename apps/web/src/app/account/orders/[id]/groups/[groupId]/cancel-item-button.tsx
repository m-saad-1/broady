"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelUserSubOrder, type CancelReasonCode } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";

type Props = {
  orderId: string;
  subOrderId: string;
  itemId: string;
  brandName: string;
  cancellationRequiresReview: boolean;
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

export function CancelItemButton({ orderId, subOrderId, itemId, brandName, cancellationRequiresReview }: Props) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonCode, setReasonCode] = useState<CancelReasonCode>("CHANGED_MIND");
  const [customReason, setCustomReason] = useState("");

  const doCancel = async () => {
    if (reasonCode === "OTHER" && !customReason.trim()) return;

    setBusy(true);
    try {
      await cancelUserSubOrder(orderId, subOrderId, {
        reasonCode,
        customReason: reasonCode === "OTHER" ? customReason.trim() : undefined,
        note: `Canceled item in ${brandName} vendor order by customer`,
        orderItemIds: [itemId],
      });
      setOpen(false);
      setReasonCode("CHANGED_MIND");
      setCustomReason("");
      pushToast(
        cancellationRequiresReview
          ? "Cancellation request submitted successfully."
          : "Item cancelled successfully.",
        "success"
      );
      router.refresh();
    } catch (error: any) {
      pushToast(error?.message || "Failed to cancel item", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] border-zinc-300 text-red-600 hover:border-red-600"
        onClick={() => setOpen(true)}
      >
        {cancellationRequiresReview ? "Cancel Request" : "Cancel"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-6">
            <h2 className="font-heading text-2xl uppercase">
              {cancellationRequiresReview ? "Request Item Cancellation" : "Cancel Item"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">Select a reason for cancelling this item.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Reason</label>
                <select
                  className="mt-2 w-full border border-zinc-300 p-2 text-sm"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as CancelReasonCode)}
                  disabled={busy}
                >
                  {CANCEL_REASON_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {reasonCode === "OTHER" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Please specify</label>
                  <input
                    type="text"
                    maxLength={240}
                    className="mt-2 w-full border border-zinc-300 p-2 text-sm"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    disabled={busy}
                  />
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Back
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                onClick={doCancel}
                disabled={busy || (reasonCode === "OTHER" && !customReason.trim())}
              >
                {busy
                  ? cancellationRequiresReview
                    ? "Submitting..."
                    : "Cancelling..."
                  : cancellationRequiresReview
                    ? "Submit Request"
                    : "Cancel Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
