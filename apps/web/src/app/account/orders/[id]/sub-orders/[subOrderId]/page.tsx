import { redirect } from "next/navigation";

type LegacySubOrderRouteProps = {
  params: Promise<{ id: string; subOrderId: string }>;
};

export default async function LegacySubOrderRoute({ params }: LegacySubOrderRouteProps) {
  const { id, subOrderId } = await params;
  redirect(`/account/orders/${id}/groups/${subOrderId}`);
}
