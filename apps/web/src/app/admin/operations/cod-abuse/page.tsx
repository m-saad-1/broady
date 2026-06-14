"use client";

import { useEffect, useState } from "react";
import { getCodAbuseUsers, updateCodAbuseUser } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { CodAbuseUserRecord } from "@/types/marketplace";

export default function AdminCodAbusePage() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [users, setUsers] = useState<CodAbuseUserRecord[]>([]);
  const [noteByUser, setNoteByUser] = useState<Record<string, string>>({});

  const load = () => getCodAbuseUsers().then(setUsers).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Operations</p>
        <h1 className="font-heading text-5xl uppercase">COD Abuse Dashboard</h1>
      </header>
      <section className="space-y-3">
        {users.map((user) => (
          <article key={user.id} className="border border-zinc-300 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <p className="text-sm font-semibold">{user.fullName}</p>
                <p className="text-sm text-zinc-600">{user.email}</p>
              </div>
              <div>
                <p className="text-sm">Refusals: {user.codRefusalCount}</p>
                <p className="text-sm">Status: {user.codReviewStatus}</p>
              </div>
              <div>
                <p className="text-sm">Last refusal: {user.lastCodRefusalAt ? new Date(user.lastCodRefusalAt).toLocaleString() : "N/A"}</p>
                <p className="text-sm">Prepayment required: {user.codPrepaymentRequired ? "Yes" : "No"}</p>
              </div>
              <div className="flex flex-col gap-2">
                {(["UNDER_REVIEW", "RESTRICT_COD", "BLOCK_COD", "REQUIRE_PREPAYMENT", "CLEAR_FLAG"] as const).map((action) => (
                  <button key={action} type="button" onClick={async () => {
                    try {
                      await updateCodAbuseUser(user.id, { action, note: noteByUser[user.id] || `${action} applied by admin.` });
                      pushToast("COD review updated.", "success");
                      load();
                    } catch (error) {
                      pushToast(error instanceof Error ? error.message : "Unable to update COD review.", "error");
                    }
                  }} className="h-8 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">{action.replaceAll("_", " ")}</button>
                ))}
              </div>
            </div>
            <textarea className="mt-3 min-h-20 w-full border border-zinc-300 p-3 text-sm" placeholder="Admin note" value={noteByUser[user.id] || ""} onChange={(event) => setNoteByUser((current) => ({ ...current, [user.id]: event.target.value }))} />
          </article>
        ))}
      </section>
    </main>
  );
}
