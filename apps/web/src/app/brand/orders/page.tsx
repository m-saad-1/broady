import { BrandDashboardClient } from "../../brand-dashboard/brand-dashboard-client";
import { getBrandSession } from "../_lib/brand-session";

export const metadata = {
  title: "Brand Orders | BROADY",
  description: "View and update orders for your assigned brand account.",
};

export default async function BrandOrdersPage() {
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Orders</p>
        <h1 className="font-heading text-5xl uppercase">Orders</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Use this view to scan orders quickly and jump into a specific order record for details.</p>
      </header>

      <BrandDashboardClient mode="orders" />
    </main>
  );
}