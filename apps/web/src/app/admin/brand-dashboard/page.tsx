import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminBrandDashboardClient } from "./brand-dashboard-client";

export const metadata = {
  title: "Admin Brand Dashboard | BROADY",
  description: "Read-only centralized brand and order monitoring view for Broady admins.",
};

export default async function AdminBrandDashboardPage() {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin/brand-dashboard");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login?next=/admin/brand-dashboard");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
    redirect("/account?forbidden=admin");
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Broady Control Center</p>
        <h1 className="font-heading text-5xl uppercase">Admin Brand Dashboard</h1>
        <p className="max-w-4xl text-sm text-zinc-600">
          Monitor each brand, linked products, and all assigned orders from one centralized admin view. Order updates are handled from dedicated detail pages.
        </p>
      </header>

      <AdminBrandDashboardClient />
    </main>
  );
}
