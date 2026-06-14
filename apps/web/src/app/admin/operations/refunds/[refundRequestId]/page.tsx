"use client";

import { use, useEffect, useState } from "react";
import { getAdminRefundRequest, updateAdminRefundRequestStatus } from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";
import type { RefundRequestRecord } from "@/types/marketplace";

export default function AdminRefundOverridePage({ params }: { params: Promise<{ refundRequestId: string }> }) {
  const pushToast = useToastStore((state) => state.pushToast);
  const resolvedParams = use(params);
  const [refund, setRefund] = useState<RefundRequestRecord | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    getAdminRefundRequest(resolvedParams.refundRequestId).then((data) => {
      setRefund(data);
      setNote(data.reviewNote || "");
      setAmounts(Object.fromEntries((data.items || []).map((item) => [item.id, String(item.refundAmountPkr)])));
    }).catch(() => setRefund(null));
  }, [resolvedParams.refundRequestId]);

  if (!refund) return <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><p className="border border-zinc-300 p-5 text-sm text-zinc-700">Refund request not found.</p></main>;

  const runningTotal = (refund.items || []).reduce((sum, item) => sum + Number(amounts[item.id] || 0), 0);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Operations</p>
        <h1 className="font-heading text-5xl uppercase">Refund Amount Override</h1>
      </header>
      <section className="space-y-3 border border-zinc-300 p-5">
        <p className="text-sm">Refund: {refund.id}</p>
        <p className="text-sm">Original amount: {formatPkr(refund.amountPkr)}</p>
        <p className="text-sm">Reason: {refund.reasonText || refund.reasonCode || "Refund"}</p>
      </section>
      <section className="space-y-3 border border-zinc-300 p-5">
        {(refund.items || []).map((item) => (
          <div key={item.id} className="grid gap-3 border-b border-zinc-200 pb-3 md:grid-cols-[1fr_140px] md:items-center">
            <div>
              <p className="text-sm font-semibold">{item.orderItem?.product?.name || "Order item"}</p>
              <p className="text-sm text-zinc-600">Original: {formatPkr(item.refundAmountPkr)}</p>
            </div>
            <input className="h-10 border border-zinc-300 px-3 text-sm" value={amounts[item.id] || ""} onChange={(event) => setAmounts((current) => ({ ...current, [item.id]: event.target.value }))} />
          </div>
        ))}
        <p className="text-sm font-semibold">Running total: {formatPkr(runningTotal)}</p>
        <textarea className="min-h-24 w-full border border-zinc-300 p-3 text-sm" placeholder="Override reason" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="flex gap-3">
          <button type="button" onClick={() => setAmounts(Object.fromEntries((refund.items || []).map((item) => [item.id, String(item.refundAmountPkr)])))} className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">Reset</button>
          <button
            type="button"
            onClick={async () => {
              try {
                await updateAdminRefundRequestStatus(refund.id, {
                  action: "APPROVE_REFUND",
                  adjustedAmountPkr: runningTotal,
                  note,
                  method: refund.method || "ORIGINAL_SOURCE",
                });
                pushToast("Refund override saved.", "success");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to save refund override.", "error");
              }
            }}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Approve With Adjusted Amount
          </button>
        </div>
      </section>
    </main>
  );
}
