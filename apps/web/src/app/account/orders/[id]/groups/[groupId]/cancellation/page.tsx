import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatPkr } from "@/lib/utils";
import type { CancellationRequestRecord, RefundRequestRecord } from "@/types/marketplace";

type PageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

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

function countdownLabel(target?: string | null) {
  if (!target) return "N/A";
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m remaining`;
}

export default async function CancellationTrackerPage({ params }: PageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account/orders");
  const { id, groupId } = await params;

  const [requests, refunds] = await Promise.all([
    fetchJson<CancellationRequestRecord[]>(`/orders/me/${id}/sub-orders/${groupId}/cancellation-requests`, token),
    fetchJson<RefundRequestRecord[]>(`/orders/me/${id}/sub-orders/${groupId}/refund-requests`, token),
  ]);

  const request = requests[0];
  const refund = refunds[0];
  if (!request) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 lg:px-10">
        <p className="border border-zinc-300 p-5 text-sm text-zinc-700">No cancellation request was found for this vendor group.</p>
        <Link href={`/account/orders/${id}/groups/${groupId}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">Back to Order</Link>
      </main>
    );
  }

  const timeline = [
    { label: "Submitted", at: request.createdAt },
    { label: "Brand Notified", at: request.createdAt },
    { label: "Brand Responded", at: request.respondedAt || request.history?.find((entry) => entry.action === "BRAND_RESPONDED")?.createdAt },
    { label: "Admin Review", at: request.respondedAt || request.status === "EXPIRED" ? request.updatedAt : null },
    { label: request.status === "APPROVED" ? "Approved" : request.status === "REJECTED" ? "Rejected" : request.history?.some((entry) => entry.action === "AUTO_APPROVED") ? "Auto-Approved" : "Decision Pending", at: request.decidedAt || request.history?.find((entry) => ["APPROVED", "REJECTED", "AUTO_APPROVED"].includes(entry.action))?.createdAt },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Cancellation Tracker</p>
        <h1 className="font-heading text-4xl uppercase">Request Status</h1>
        <p className="text-sm text-zinc-600">Follow the review pipeline for your packed or pickup-ready cancellation request.</p>
      </header>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request</p>
          <p className="text-sm text-zinc-700">Reference: {request.id}</p>
          <p className="text-sm text-zinc-700">Status: {request.history?.some((entry) => entry.action === "AUTO_APPROVED") ? "Auto-Approved" : request.status}</p>
          <p className="text-sm text-zinc-700">Submitted: {formatDateTime(request.createdAt)}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Response Windows</p>
          <p className="text-sm text-zinc-700">Brand response: {countdownLabel(request.expiresAt)}</p>
          <p className="text-sm text-zinc-700">Auto-approval window: {countdownLabel(request.autoApproveAt)}</p>
          {request.decisionNote ? <p className="text-sm text-zinc-700">Decision note: {request.decisionNote}</p> : null}
        </div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Item Summary</p>
          <p className="mt-2 text-sm text-zinc-700">
            {(request.subOrder?.items || []).map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ") || "No items listed"}
          </p>
          <p className="mt-2 text-sm text-zinc-700">Customer reason: {request.reasonText || request.reasonCode}</p>
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Timeline</h2>
        <div className="space-y-3">
          {timeline.map((step) => (
            <article key={step.label} className="border border-zinc-200 p-3 text-sm">
              <p className="font-semibold uppercase tracking-[0.08em]">{step.label}</p>
              <p className="text-zinc-600">{formatDateTime(step.at)}</p>
            </article>
          ))}
        </div>
      </section>

      {request.status === "REJECTED" ? (
        <section className="border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p className="font-semibold">Request rejected</p>
          <p className="mt-2">{request.decisionNote || request.brandResponseNote || "Broady reviewed the request and did not approve the cancellation."}</p>
        </section>
      ) : null}

      {request.status === "APPROVED" || request.history?.some((entry) => entry.action === "AUTO_APPROVED") ? (
        <section className="border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          <p className="font-semibold">Cancellation approved</p>
          <p className="mt-2">
            {refund ? `Refund amount: ${formatPkr(refund.adjustedAmountPkr || refund.amountPkr)} | Method: ${refund.method || "Pending"}` : "Refund details will appear once the refund request is created."}
          </p>
          {refund ? (
            <Link href={`/account/orders/${id}/groups/${groupId}/refund`} className="mt-4 inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              Open Refund Tracking
            </Link>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href={`/account/orders/${id}/groups/${groupId}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">Back to Order</Link>
        <Link href="/account/support" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">Contact Support</Link>
      </div>
    </main>
  );
}
