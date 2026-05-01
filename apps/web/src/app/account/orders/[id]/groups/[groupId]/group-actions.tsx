"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelUserSubOrder, reorderUserSubOrder, type CancelReasonCode } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";

type GroupActionsProps = {
  orderId: string;
  subOrderId: string;
  brandName: string;
  canCancel: boolean;
  canReorder: boolean;
};

const CANCEL_REASON_OPTIONS: Array<{ code: CancelReasonCode; label: string }> = [
  { code: "CHANGED_MIND", label: "Changed my mind" },
  { code: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { code: "FOUND_BETTER_PRICE", label: "Found a better price" },
  { code: "DELIVERY_TOO_SLOW", label: "Delivery is taking too long" },
  { code: "PAYMENT_ISSUE", label: "Payment issue" },
  { code: "OTHER", label: "Other" },
];

export function GroupActions({ orderId, subOrderId, brandName, canCancel, canReorder }: GroupActionsProps) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const [busy, setBusy] = useState<"cancel" | "reorder" | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [reasonCode, setReasonCode] = useState<CancelReasonCode>("CHANGED_MIND");
  const [customReason, setCustomReason] = useState("");

  const doReorder = async () => {
    setBusy("reorder");
    try {
      await reorderUserSubOrder(orderId, subOrderId);
      pushToast("Order reordered successfully.", "success");
      router.push("/cart");
      router.refresh();
    } catch (error: any) {
      pushToast(error.message || "Failed to reorder", "error");
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
      pushToast("Order has been canceled successfully.", "success");
      router.refresh();
    } catch (error: any) {
      pushToast(error.message || "Failed to cancel order", "error");
    } finally {
      setBusy(null);
    }
  };

  if (!canCancel && !canReorder) {
    return null;
  }

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
            {busy === "cancel" ? "Canceling..." : "Cancel Order"}
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
      </div>

      {openCancel ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenCancel(false)}>
          <div className="w-full max-w-md space-y-5 border border-zinc-300 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="font-heading text-2xl uppercase">Cancel Order</h3>
              <p className="text-sm text-zinc-600">Select why you want to cancel this order.</p>
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
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
