import Link from "next/link";
import { getBrandSession } from "../_lib/brand-session";
import { BrandIngestionClient } from "./brand-ingestion-client";

export const metadata = {
  title: "Brand Ingestion | BROADY",
  description: "Upload/import products and resolve ingestion issues before admin approval.",
};

export default async function BrandIngestionPage() {
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Ingestion</p>
        <h1 className="font-heading text-5xl uppercase">Product Imports</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Import JSON/CSV/API sources, monitor failures, retry jobs, and fix product fields for re-review.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/brand/products" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Brand Products
          </Link>
          <Link href="/brand/dashboard" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Dashboard
          </Link>
          <Link href="/brand/orders" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Orders
          </Link>
        </div>
      </header>

      <BrandIngestionClient />
    </main>
  );
}
