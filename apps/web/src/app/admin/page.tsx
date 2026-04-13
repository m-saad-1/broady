import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPanelClient } from "./admin-panel-client";

export const metadata = {
  title: "Admin Panel | BROADY",
  description: "Manage brands, products, and orders from the BROADY admin dashboard.",
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
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Operations</p>
        <h1 className="font-heading text-5xl uppercase">Admin Panel</h1>
        <Link
          href="/admin/brand-dashboard"
          className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
        >
          Open Admin Brand Dashboard
        </Link>
      </header>

      <AdminPanelClient />
    </main>
  );
}
