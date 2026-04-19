import { getBrandSession } from "../../../_lib/brand-session";
import { getBrandDashboardProducts } from "@/lib/api";
import { notFound } from "next/navigation";
import { BrandProductEditClient } from "./brand-product-edit-client";

export const metadata = {
  title: "Edit Product | Brand Dashboard | BROADY",
};

export default async function BrandProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getBrandSession();

  if (!session) {
    return notFound();
  }

  const products = await getBrandDashboardProducts();
  const product = products.find((p) => p.id === id);

  if (!product) {
    return notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 lg:px-10">
      <BrandProductEditClient product={product} />
    </main>
  );
}
