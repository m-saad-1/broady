import { BrandDashboardClient } from "../../brand-dashboard/brand-dashboard-client";
import { getBrandSession } from "../_lib/brand-session";

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
      </header>

      <BrandDashboardClient mode="dashboard" />
    </main>
  );
}