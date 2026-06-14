import Link from "next/link";
import { getBrandSession } from "../_lib/brand-session";
import { BrandOperationsClient } from "./brand-operations-client";

export const metadata = {
  title: "Brand Operations | BROADY",
  description: "Respond to cancellation and return requests for your assigned brand.",
};

type BrandOperationsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

const tabLinkClass = "inline-flex h-10 items-center border px-4 text-xs font-semibold uppercase tracking-[0.12em]";

export default async function BrandOperationsPage({ searchParams }: BrandOperationsPageProps) {
  await getBrandSession();
  const params = (await searchParams) || {};
  const activeTab = params.tab === "cancellations" || params.tab === "returns" || params.tab === "refunds" ? params.tab : "overview";

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-5xl uppercase">Requests</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Use the tabs to move between cancellation queues, return/exchange audits, and refund tracking.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/brand/dashboard" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to Dashboard
          </Link>
          <Link href="/brand/orders" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            View Orders
          </Link>
          <Link
            href="/brand/operations"
            aria-current={activeTab === "overview" ? "page" : undefined}
            className={`${tabLinkClass} ${activeTab === "overview" ? "border-black bg-black text-white" : "border-zinc-300"}`}
          >
            Overview
          </Link>
          <Link
            href="/brand/operations?tab=cancellations"
            aria-current={activeTab === "cancellations" ? "page" : undefined}
            className={`${tabLinkClass} ${activeTab === "cancellations" ? "border-black bg-black text-white" : "border-zinc-300"}`}
          >
            Cancellation Requests
          </Link>
          <Link
            href="/brand/operations?tab=returns"
            aria-current={activeTab === "returns" ? "page" : undefined}
            className={`${tabLinkClass} ${activeTab === "returns" ? "border-black bg-black text-white" : "border-zinc-300"}`}
          >
            Return / Exchange Requests
          </Link>
          <Link
            href="/brand/operations?tab=refunds"
            aria-current={activeTab === "refunds" ? "page" : undefined}
            className={`${tabLinkClass} ${activeTab === "refunds" ? "border-black bg-black text-white" : "border-zinc-300"}`}
          >
            Refund Requests
          </Link>
        </div>
      </header>

      <BrandOperationsClient activeTab={activeTab} />
    </main>
  );
}
