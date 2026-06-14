"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminOperations, updateAdminReturnRequestStatus } from "@/lib/api";
import Link from "next/link";
import { useToastStore } from "@/stores/toast-store";
import type { ReturnRequestRecord } from "@/types/marketplace";

export default function AdminReturnDamageDisputesPage() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [requests, setRequests] = useState<ReturnRequestRecord[]>([]);
  const [decisionById, setDecisionById] = useState<Record<string, "CUSTOMER_FAULT" | "COURIER_FAULT" | "BRAND_NOT_SUPPORTED">>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  useEffect(() => {
    getAdminOperations().then((data) => setRequests(data.returnRequests)).catch(() => setRequests([]));
  }, []);

  const disputes = useMemo(() => requests.filter((item) => Boolean(item.damageClaimNote) || Boolean(item.damageEvidenceUrls?.length)), [requests]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Operations</p>
        <h1 className="font-heading text-5xl uppercase">Return Damage Disputes</h1>
      </header>
      <section className="space-y-3">
        {!disputes.length ? <p className="border border-zinc-300 p-5 text-sm text-zinc-700">No damage disputes are waiting for review.</p> : disputes.map((request) => (
          <article key={request.id} className="border border-zinc-300 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{request.id}</p>
                <p className="mt-1 text-sm text-zinc-700">Customer reason: {request.reasonText || request.reasonCode}</p>
                <p className="mt-1 text-sm text-zinc-700">Brand damage claim: {request.damageClaimNote || "Damage evidence uploaded"}</p>
                <p className="mt-1 text-sm text-zinc-700">Evidence images: {(request.evidenceImageUrls || []).length} customer / {(request.damageEvidenceUrls || []).length} brand</p>
              </div>
              <Link href={`/admin/operations/returns/${request.id}`} className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                Open Detail
              </Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_auto]">
              <select className="h-10 border border-zinc-300 px-3 text-sm" value={decisionById[request.id] || "BRAND_NOT_SUPPORTED"} onChange={(event) => setDecisionById((current) => ({ ...current, [request.id]: event.target.value as "CUSTOMER_FAULT" | "COURIER_FAULT" | "BRAND_NOT_SUPPORTED" }))}>
                <option value="CUSTOMER_FAULT">Customer at fault</option>
                <option value="COURIER_FAULT">Courier at fault</option>
                <option value="BRAND_NOT_SUPPORTED">Brand claim not supported</option>
              </select>
              <input className="h-10 border border-zinc-300 px-3 text-sm" placeholder="Mandatory admin note" value={noteById[request.id] || ""} onChange={(event) => setNoteById((current) => ({ ...current, [request.id]: event.target.value }))} />
              <button
                type="button"
                onClick={async () => {
                  const note = noteById[request.id]?.trim();
                  if (!note) {
                    pushToast("Admin note is required.", "error");
                    return;
                  }
                  try {
                    await updateAdminReturnRequestStatus(request.id, {
                      status: decisionById[request.id] === "CUSTOMER_FAULT" ? "REJECTED" : "COMPLETED",
                      note: `${decisionById[request.id] || "BRAND_NOT_SUPPORTED"}: ${note}`,
                    });
                    pushToast("Damage dispute decision saved.", "success");
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : "Unable to save damage dispute decision.", "error");
                  }
                }}
                className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              >
                Confirm Decision
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
