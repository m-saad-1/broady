import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandsAdminClient } from "./brands-admin-client";

export const metadata = {
  title: "Admin Brands | BROADY",
  description: "Manage brand records, invite links, and notification channels.",
};

export default async function AdminBrandsPage() {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin/brands");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login?next=/admin/brands");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") redirect("/account?forbidden=admin");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Panel</p>
        <h1 className="font-heading text-5xl uppercase">Brands</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Go to Products
          </Link>
          <Link href="/admin/brand-dashboard" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Open Brand Dashboard
          </Link>
        </div>
      </header>

      <BrandsAdminClient />
    </main>
  );
}
