import { BrandOrdersClient } from "../orders/orders-client";
import { getBrandSession } from "../_lib/brand-session";
import Link from "next/link";

export const metadata = {
  title: "Brand Dashboard | BROADY",
  description: "Brand-scoped orders, products, notifications, and earnings.",
};

export default async function BrandDashboardPage() {
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-5xl uppercase">Brand Dashboard</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Everything in this workspace is filtered by your brand account. Orders, notifications, and inventory updates stay tenant-scoped.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/brand/products" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            View Products
          </Link>
          <Link href="/brand/orders" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            View All Orders
          </Link>
          <Link href="/brand/dashboard/reviews" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Open Reviews
          </Link>
        </div>
      </header>

      <BrandOrdersClient title="Orders" mode="dashboard" />
    </main>
  );
}