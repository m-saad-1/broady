import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminIngestionClient } from "./admin-ingestion-client";
import type { Brand } from "@/types/marketplace";

export const metadata = {
  title: "Admin Ingestion | BROADY",
  description: "Review imports, failures, approvals, fixes, retries, and queue health.",
};

export default async function AdminIngestionPage() {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin/ingestion");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login?next=/admin/ingestion");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") redirect("/account?forbidden=admin");

  let initialBrands: Brand[] = [];
  try {
    const brandsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/brands`, {
      headers: { Cookie: `broady_token=${token}` },
      cache: "no-store",
    });
    if (brandsResponse.ok) {
      const payload = (await brandsResponse.json()) as { data?: Brand[] };
      initialBrands = Array.isArray(payload.data) ? payload.data : [];
    }
  } catch {
    // Keep page functional even if brand prefetch fails.
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Ingestion</p>
        <h1 className="font-heading text-5xl uppercase">Ingestion Control</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Manage source imports, failed products, approval fixes, retries, and queue operations from one place.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Products
          </Link>
          <Link href="/admin/brands" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Brands
          </Link>
          <Link href="/admin" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Admin Home
          </Link>
        </div>
      </header>

      <AdminIngestionClient initialBrands={initialBrands} />
    </main>
  );
}
