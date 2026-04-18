import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin Panel | BROADY",
  description: "Navigate brand, product, and order administration in BROADY.",
};

export default async function AdminPage() {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login?next=/admin");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") redirect("/account?forbidden=admin");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Operations</p>
        <h1 className="font-heading text-5xl uppercase">Admin Panel</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Use dedicated pages for brand and product management, and open read-only dashboard views for brand operations.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/brands" className="border border-zinc-300 p-5 transition hover:border-black hover:bg-zinc-50">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Manage</p>
          <p className="mt-3 font-heading text-3xl uppercase">Brands</p>
          <p className="mt-2 text-sm text-zinc-600">Brand records, invite links, and notification channels.</p>
        </Link>
        <Link href="/admin/products" className="border border-zinc-300 p-5 transition hover:border-black hover:bg-zinc-50">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Manage</p>
          <p className="mt-3 font-heading text-3xl uppercase">Products</p>
          <p className="mt-2 text-sm text-zinc-600">Catalog data, approvals, stock, and product detail routing.</p>
        </Link>
        <Link href="/admin/brand-dashboard" className="border border-zinc-300 p-5 transition hover:border-black hover:bg-zinc-50">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Monitor</p>
          <p className="mt-3 font-heading text-3xl uppercase">Brand Dashboard</p>
          <p className="mt-2 text-sm text-zinc-600">Read-only view of brand orders with links to order and product details.</p>
        </Link>
        <Link href="/admin/reviews" className="border border-zinc-300 p-5 transition hover:border-black hover:bg-zinc-50">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Moderate</p>
          <p className="mt-3 font-heading text-3xl uppercase">Reviews</p>
          <p className="mt-2 text-sm text-zinc-600">Handle reported reviews and enforce marketplace review policy.</p>
        </Link>
      </section>
    </main>
  );
}
