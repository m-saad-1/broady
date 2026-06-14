"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { confirmBrandReturnReceipt, getBrandReturnRequests } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { ReturnRequestRecord } from "@/types/marketplace";

export default function BrandReturnReceiptPage({ params }: { params: Promise<{ returnRequestId: string }> }) {
  const pushToast = useToastStore((state) => state.pushToast);
  const resolvedParams = use(params);
  const [request, setRequest] = useState<ReturnRequestRecord | null>(null);
  const [outcome, setOutcome] = useState<"APPROVED" | "DISPUTED">("APPROVED");
  const [conditionNote, setConditionNote] = useState("");
  const [damageNote, setDamageNote] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState("");

  useEffect(() => {
    getBrandReturnRequests().then((items) => setRequest(items.find((item) => item.id === resolvedParams.returnRequestId) || null));
  }, [resolvedParams.returnRequestId]);

  if (!request) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10">
        <p className="border border-zinc-300 p-5 text-sm text-zinc-700">Return request not found.</p>
      </main>
    );
  }

  const isExchange = request.preferredResolution?.startsWith("EXCHANGE");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-4xl uppercase">Return Receipt Confirmation</h1>
      </header>

      <section className="space-y-3 border border-zinc-300 p-5">
        <p className="text-sm">Type: {isExchange ? "EXCHANGE" : "RETURN"}</p>
        <p className="text-sm">Return reference: {request.id}</p>
        <p className="text-sm">Sub-order: {request.subOrderId}</p>
        <p className="text-sm">Item: {(request.subOrder?.items || []).map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ")}</p>
        <p className="text-sm">Original reason: {request.reasonText || request.reasonCode}</p>
      </section>

      <section className="space-y-4 border border-zinc-300 p-5">
        <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={outcome === "APPROVED"} onChange={() => setOutcome("APPROVED")} />
            Condition accepted
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={outcome === "DISPUTED"} onChange={() => setOutcome("DISPUTED")} />
            Condition disputed
          </label>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Condition note
          <input
            className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm"
            value={conditionNote}
            onChange={(event) => setConditionNote(event.target.value)}
            placeholder="Describe the received item condition"
          />
        </label>

        {outcome === "DISPUTED" ? (
          <>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Dispute reason
              <input
                className="mt-2 h-10 w-full border border-zinc-300 px-3 text-sm"
                value={disputeReason}
                onChange={(event) => setDisputeReason(event.target.value)}
                placeholder="Reason for the dispute"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Damage or issue note
              <textarea className="mt-2 min-h-24 w-full border border-zinc-300 p-3 text-sm" value={damageNote} onChange={(event) => setDamageNote(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Evidence URLs
              <textarea className="mt-2 min-h-24 w-full border border-zinc-300 p-3 text-sm" value={evidenceUrls} onChange={(event) => setEvidenceUrls(event.target.value)} placeholder="One URL per line" />
            </label>
          </>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              !conditionNote.trim() ||
              (outcome === "DISPUTED" &&
                (!disputeReason.trim() || !evidenceUrls.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean).length))
            }
            onClick={async () => {
              try {
                const updated = await confirmBrandReturnReceipt(request.id, {
                  outcome,
                  conditionNote: conditionNote.trim(),
                  damageNote: damageNote.trim() || undefined,
                  disputeReason: outcome === "DISPUTED" ? disputeReason.trim() : undefined,
                  evidenceUrls:
                    outcome === "DISPUTED"
                      ? evidenceUrls.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean)
                      : undefined,
                });
                setRequest(updated);
                pushToast("Return receipt recorded.", "success");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to confirm receipt.", "error");
              }
            }}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            Confirm receipt
          </button>
          <Link href={`/brand/operations/returns/${request.id}`} className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to Detail
          </Link>
        </div>
      </section>
    </main>
  );
}
