import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatPkr } from "@/lib/utils";
import type { RefundRequestRecord } from "@/types/marketplace";

type PageProps = { params: Promise<{ id: string; groupId: string }> };

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}${path}`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) redirect("/login?next=/account/orders");
  if (!response.ok) throw new Error("REQUEST_FAILED");
  const json = await response.json() as { data: T };
  return json.data;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function RefundTrackerPage({ params }: PageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account/orders");
  const { id, groupId } = await params;
  const refunds = await fetchJson<RefundRequestRecord[]>(`/orders/me/${id}/sub-orders/${groupId}/refund-requests`, token);
  const refund = refunds[0];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Refund Tracking</p>
        <h1 className="font-heading text-4xl uppercase">Refund Status</h1>
      </header>

      {!refund ? (
        <section className="border border-zinc-300 p-5 text-sm text-zinc-700">
          No refund request is active for this vendor group yet. COD cancellations with no collected payment show no refund required.
        </section>
      ) : (
        <>
          <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Refund</p>
              <p className="mt-2 text-sm">Reference: {refund.id}</p>
              <p className="mt-2 text-sm">Status: {refund.status}</p>
              <p className="mt-2 text-sm">Method: {refund.method || "Pending"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Amount</p>
              <p className="mt-2 text-sm">{formatPkr(refund.adjustedAmountPkr || refund.amountPkr)}</p>
              <p className="mt-2 text-sm">Updated: {formatDateTime(refund.updatedAt)}</p>
              {refund.gatewayRefundId ? <p className="mt-2 text-sm">Reference: {refund.gatewayRefundId}</p> : null}
            </div>
          </section>

          <section className="space-y-3 border border-zinc-300 p-5">
            <h2 className="font-heading text-3xl uppercase">Item Breakdown</h2>
            <div className="space-y-3">
              {(refund.items || []).map((item) => (
                <article key={item.id} className="flex items-center justify-between border border-zinc-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold">{item.orderItem?.product?.name || "Order item"}</p>
                    <p className="text-zinc-600">Qty {item.quantity}</p>
                  </div>
                  <p className="font-semibold">{formatPkr(item.refundAmountPkr)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3 border border-zinc-300 p-5">
            <h2 className="font-heading text-3xl uppercase">Refund Timeline</h2>
            <div className="space-y-3">
              {(refund.statusLogs || []).map((log) => (
                <article key={log.id} className="border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold uppercase tracking-[0.08em]">{log.status}</p>
                  <p className="text-zinc-600">{formatDateTime(log.createdAt)}</p>
                  {log.note ? <p className="mt-1 text-zinc-700">{log.note}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="flex gap-3">
        <Link href={`/account/orders/${id}/groups/${groupId}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">Back to Order</Link>
        <Link href="/account/support" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">Contact Support</Link>
      </div>
    </main>
  );
}
