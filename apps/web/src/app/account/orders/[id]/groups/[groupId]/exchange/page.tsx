import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReturnEvidenceUploadForm } from "@/components/returns/return-evidence-upload-form";
import { formatReturnReasonLabel, formatReturnStatus, getDisplayReturnStatus, getFinalRequestLabel, getReturnRequestItems, getReturnStatusMessage, getWorkflowTimeline } from "@/lib/return-workflow";
import type { ReturnRequestRecord } from "@/types/marketplace";

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

export default async function ExchangeTrackerPage({ params }: PageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account/orders");
  const { id, groupId } = await params;
  const requests = await fetchJson<ReturnRequestRecord[]>(`/orders/me/${id}/sub-orders/${groupId}/return-requests`, token);
  const request = requests.find((entry) => entry.preferredResolution?.startsWith("EXCHANGE")) || requests[0];

  if (!request) {
    return <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><p className="border border-zinc-300 p-5 text-sm text-zinc-700">No exchange request found for this vendor group.</p></main>;
  }

  const displayStatus = getDisplayReturnStatus(request);
  const timeline = getWorkflowTimeline(request);
  const finalLabel = getFinalRequestLabel(request);
  const convertedToRefund = Boolean(request.convertedToRefund || request.replacementUnavailable);
  const replacementStatusLabel = formatReturnStatus(displayStatus);
  const requestItems = getReturnRequestItems(request);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Exchange Tracker</p>
        <h1 className="font-heading text-4xl uppercase">Exchange Status</h1>
      </header>
      {convertedToRefund ? (
        <section className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your replacement item is out of stock. Your exchange has been converted to a refund.
          <div className="mt-3">
            <Link href={`/account/orders/${id}/groups/${groupId}/refund`} className="inline-flex h-10 items-center border border-amber-700 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
              Open Refund Tracking
            </Link>
          </div>
        </section>
      ) : null}
      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Reference</p>
          <p className="mt-2 text-sm font-semibold">{request.id}</p>
          <p className="mt-2 inline-flex border border-zinc-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">{finalLabel}</p>
          <p className="mt-2 text-sm text-zinc-700">Current status: {replacementStatusLabel}</p>
          <p className="mt-2 text-sm text-zinc-700">Updated: {formatDateTime(request.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Requested replacement</p>
          <p className="mt-2 text-sm font-semibold">{request.requestedVariantSummary || request.preferredResolution || "Exchange request"}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
            Original item: {requestItems.map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ") || "Not available"}
          </p>
          <p className="mt-2 text-sm">
            {request.replacementTrackingNo && request.replacementCourier
              ? `Tracking: ${request.replacementTrackingNo} via ${request.replacementCourier}`
              : "Tracking will appear after the replacement is shipped."}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Reason</p>
          <p className="mt-2 text-sm text-zinc-700">{formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
          <p className="mt-2 text-sm text-zinc-700">Sub-order: {request.subOrderId}</p>
        </div>
      </section>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Item Details</p>
          <p className="mt-2 text-sm text-zinc-700">{requestItems.map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ")}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">Requested replacement: {request.preferredResolution === "EXCHANGE_COLOR" ? "Color variant" : "Size variant"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Audit</p>
          <p className="mt-2 text-sm text-zinc-700">Evidence images: {(request.evidenceImageUrls || []).length}</p>
          <p className="mt-2 text-sm text-zinc-700">Brand decision: {request.brandRecommendation || "Pending"}</p>
          {request.adminDecision ? <p className="mt-2 text-sm text-zinc-700">Decision: {request.adminDecision}</p> : null}
          {request.adminRejectedReason || request.adminDecisionNote ? <p className="mt-2 text-sm text-zinc-700">Admin reason: {request.adminRejectedReason || request.adminDecisionNote}</p> : null}
          <p className="mt-2 text-sm text-zinc-700">Replacement status: {replacementStatusLabel}</p>
        </div>
      </section>
      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Timeline</h2>
        <div className="space-y-3">
          {timeline.map((status) => {
            const matchedLog = request.statusLogs?.find((entry) => entry.status === status);
            return (
              <article key={status} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold uppercase tracking-[0.08em]">{formatReturnStatus(status)}</p>
                <p className="text-zinc-600">{formatDateTime(matchedLog?.createdAt || request.updatedAt)}</p>
                {matchedLog?.note ? <p className="mt-1 text-zinc-700">{matchedLog.note}</p> : null}
              </article>
            );
          })}
        </div>
      </section>
      <section className="border border-zinc-300 p-5 text-sm text-zinc-700">
        {getReturnStatusMessage(request)}
      </section>
      {displayStatus === "NEED_MORE_EVIDENCE" ? (
        <ReturnEvidenceUploadForm orderId={id} subOrderId={groupId} returnRequestId={request.id} />
      ) : null}
      {(displayStatus === "BRAND_REJECTED" || displayStatus === "ADMIN_REJECTED" || displayStatus === "RETURN_CONDITION_DISPUTED") ? <section className="border border-red-200 bg-red-50 p-5 text-sm text-red-800">Rejection reason: {request.adminRejectedReason || request.adminDecisionNote || request.reviewNote || request.brandRecommendationNote || "Broady could not approve this exchange request."}</section> : null}
      {displayStatus === "EXCHANGE_COMPLETED" ? (
        <section className="border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          <p className="font-semibold">{finalLabel}</p>
          <p className="mt-2">The replacement or swap journey is considered complete here.</p>
        </section>
      ) : null}
      <section className="border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Need a full audit trail?</p>
        <p className="mt-1">Open the return detail page for this request to review the full timeline, evidence, and refund progress in one place.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/account/orders/${id}/groups/${groupId}/return/${request.id}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Open Full Details
          </Link>
          <Link href="/account/wallet" className="inline-flex h-10 items-center border border-emerald-700 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
            Check Wallet
          </Link>
        </div>
      </section>
      <div className="flex gap-3">
        <Link href={`/account/orders/${id}/groups/${groupId}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">Back to Order</Link>
        <Link href="/account/support" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">Contact Support</Link>
      </div>
    </main>
  );
}
