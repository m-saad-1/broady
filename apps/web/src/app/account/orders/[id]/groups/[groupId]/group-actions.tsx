"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelUserSubOrder, reorderUserSubOrder, type CancelReasonCode } from "@/lib/api";

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
  const [busy, setBusy] = useState<"cancel" | "reorder" | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [reasonCode, setReasonCode] = useState<CancelReasonCode>("CHANGED_MIND");
  const [customReason, setCustomReason] = useState("");

  const doReorder = async () => {
    setBusy("reorder");
    try {
      await reorderUserSubOrder(orderId, subOrderId);
      router.push("/cart");
      router.refresh();
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
        note: `Canceled ${brandName} vendor group by customer`,
      });
      setOpenCancel(false);
      setReasonCode("CHANGED_MIND");
      setCustomReason("");
      router.refresh();
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
            className="inline-flex h-10 items-center justify-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
          >
            {busy === "cancel" ? "Canceling..." : "Cancel Group"}
          </button>
        ) : null}
        {canReorder ? (
          <button
            type="button"
            onClick={() => void doReorder()}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
          >
            {busy === "reorder" ? "Reordering..." : "Reorder"}
          </button>
        ) : null}
      </div>

      {openCancel ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenCancel(false)}>
          <div className="w-full max-w-md space-y-4 border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <h3 className="font-heading text-2xl uppercase">Cancel Vendor Group</h3>
            <p className="text-sm text-zinc-600">Select why you want to cancel this vendor group.</p>

            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
              Reason
              <select
                className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900"
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
              <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                Custom Reason
                <textarea
                  className="min-h-20 w-full border border-zinc-300 p-2 text-sm text-zinc-900"
                  placeholder="Tell us why you are canceling"
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                />
              </label>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button type="button" className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]" onClick={() => setOpenCancel(false)}>
                Keep
              </button>
              <button
                type="button"
                className="h-10 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
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
