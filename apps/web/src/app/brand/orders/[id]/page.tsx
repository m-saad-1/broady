import { getBrandSession } from "../../_lib/brand-session";
import { BrandOrderDetailClient } from "./brand-order-detail-client";

type BrandOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BrandOrderDetailPage({ params }: BrandOrderDetailPageProps) {
  await getBrandSession();
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Order Detail</p>
        <h1 className="font-heading text-5xl uppercase">Order {id.slice(0, 10)}...</h1>
        <p className="text-sm text-zinc-600">Manage status updates and operations from this order details page.</p>
      </header>

      <BrandOrderDetailClient orderId={id} />
    </main>
  );
}