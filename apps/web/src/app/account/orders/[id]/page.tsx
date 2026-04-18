import { redirect } from "next/navigation";

type LegacyOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyOrderDetailPage({ params }: LegacyOrderDetailPageProps) {
  const { id } = await params;
  redirect(`/account/orders?orderId=${encodeURIComponent(id)}`);
}