"use client";

import { useEffect, useState } from "react";
import { forceAdminShipmentReturned, getAdminOperations, sendAdminDeliveryReminder } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { AdminOperationsRecord } from "@/types/marketplace";

function escalationLabel(updatedAt: string) {
  const hours = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (60 * 60 * 1000));
  if (hours >= 72) return "72h overdue";
  if (hours >= 48) return "48h escalated";
  if (hours >= 24) return "24h reminder sent";
  return "Active";
}

export default function AdminDeliveryFailuresPage() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [operations, setOperations] = useState<AdminOperationsRecord | null>(null);

  useEffect(() => {
    getAdminOperations().then(setOperations).catch(() => setOperations(null));
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Operations</p>
        <h1 className="font-heading text-5xl uppercase">Delivery Failure Oversight</h1>
      </header>
      <section className="space-y-3">
        {(operations?.failedDeliveries || []).map((item) => {
          const overdue = escalationLabel(item.updatedAt) === "72h overdue";
          return (
            <article key={item.id} className={`border p-4 ${overdue ? "border-red-300 bg-red-50" : "border-zinc-300"}`}>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <p className="text-sm font-semibold">{item.id}</p>
                  <p className="text-sm text-zinc-600">{item.brand?.name || "Brand"}</p>
                </div>
                <div>
                  <p className="text-sm">Failure reason: {item.failureReason || "Unknown"}</p>
                  <p className="text-sm">Escalation: {escalationLabel(item.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-sm">Retry attempts: {item.deliveryAttempts || 0}</p>
                  <p className="text-sm">Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={async () => {
                    try {
                      await sendAdminDeliveryReminder(item.id);
                      pushToast("Reminder sent.", "success");
                    } catch (error) {
                      pushToast(error instanceof Error ? error.message : "Unable to send reminder.", "error");
                    }
                  }} className="h-9 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">Send Reminder</button>
                  <button type="button" onClick={async () => {
                    try {
                      await forceAdminShipmentReturned(item.id, "Admin forced shipment returned after delivery failure timeout.");
                      pushToast("Shipment moved to returned-to-sender flow.", "success");
                    } catch (error) {
                      pushToast(error instanceof Error ? error.message : "Unable to force shipment returned.", "error");
                    }
                  }} className="h-9 border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Force Returned</button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
