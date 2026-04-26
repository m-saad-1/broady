import { getBrandSession } from "../../../_lib/brand-session";
import { BrandProductEditRouteClient } from "./route-client";

export const metadata = {
  title: "Edit Product | Brand Dashboard | BROADY",
};

export default async function BrandProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 lg:px-10">
      <BrandProductEditRouteClient productId={id} />
    </main>
  );
}
