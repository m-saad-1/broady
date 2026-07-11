import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminOperationsClient } from "./admin-operations-client";

export const metadata = {
  title: "Admin Operations | BROADY",
  description: "Review cancellations, returns, refunds, failed deliveries, and shipment escalations.",
};

type AdminOperationsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

const tabLinkClass = "inline-flex h-10 items-center border px-4 text-xs font-semibold uppercase tracking-[0.12em]";

export default async function AdminOperationsPage({ searchParams }: AdminOperationsPageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin/operations");
  const params = (await searchParams) || {};
  const activeTab = params.tab === "cancellations" || params.tab === "returns" || params.tab === "refunds" ? params.tab : "overview";

  let response: Response;
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
      headers: { Cookie: `broady_token=${token}` },
      cache: "no-store",
    });
  } catch {
    redirect("/login?next=/admin/operations");
  }

  if (!response.ok) redirect("/login?next=/admin/operations");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") redirect("/account?forbidden=admin");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Operations</p>
        <h1 className="font-heading text-5xl uppercase">Disputes and Refunds</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Resolve cancellation reviews, return requests, refund processing, failed deliveries, and stuck shipments from one queue.</p>
        <Link href="/admin" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
          Back to Admin
        </Link>
      </header>

      <AdminOperationsClient activeTab={activeTab} />
    </main>
  );
}
