import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { UserOrder } from "@/types/marketplace";
import { AdminOrderDetailClient } from "./admin-order-detail-client";

type AdminOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin/orders");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login?next=/admin/orders");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
    redirect("/account?forbidden=admin");
  }

  const { id } = await params;

  try {
    const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/admin/orders/${id}`, {
      headers: { Cookie: `broady_token=${token}` },
      cache: "no-store",
    });

    if (orderResponse.status === 404) {
      notFound();
    }

    if (!orderResponse.ok) {
      throw new Error(`Failed to load order (${orderResponse.status})`);
    }

    const orderJson = (await orderResponse.json()) as { data: UserOrder };
    const order = orderJson.data;
    return (
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
        <header className="space-y-3 border-b border-zinc-300 pb-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Order Detail</p>
          <h1 className="font-heading text-5xl uppercase">Order {order.id.slice(0, 10)}...</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/brand-dashboard" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
              Back to Brand Dashboard
            </Link>
            <Link href="/admin/products" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
              View Products
            </Link>
          </div>
        </header>

        <AdminOrderDetailClient initialOrder={order} />
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("404") || message.toLowerCase().includes("not found")) {
      notFound();
    }

    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-amber-700">Admin Order Detail</p>
          <h1 className="font-heading text-4xl uppercase">Unable to load order</h1>
          <p className="text-sm text-amber-900">Please go back and try opening the order again.</p>
          <Link href="/admin/brand-dashboard" className="inline-flex h-11 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }
}
