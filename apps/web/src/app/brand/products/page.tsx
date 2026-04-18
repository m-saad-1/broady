import Link from "next/link";
import { getBrandSession } from "../_lib/brand-session";
import { BrandProductsListClient } from "./brand-products-list-client";

export const metadata = {
  title: "Brand Products | BROADY",
  description: "Create and manage products for your brand account.",
};

export default async function BrandProductsPage() {
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Products</p>
        <h1 className="font-heading text-5xl uppercase">Products</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Add new products, update existing listings, and keep catalog quality aligned with the admin product workflow.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/brand/dashboard" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to Dashboard
          </Link>
          <Link href="/brand/products/new" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Add Product
          </Link>
          <Link href="/brand/orders" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            View Orders
          </Link>
        </div>
      </header>

      <BrandProductsListClient />
    </main>
  );
}
