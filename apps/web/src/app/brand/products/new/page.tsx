import { getBrandSession } from "../../_lib/brand-session";
import { ProductCreateFormPage } from "@/components/dashboard/product-create-form-page";

export const metadata = {
  title: "Add Brand Product | BROADY",
  description: "Create a new product for your brand account with the shared product form.",
};

export default async function BrandProductCreatePage() {
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Products</p>
        <h1 className="font-heading text-5xl uppercase">Add Product</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Create a new product from a dedicated page so product browsing stays separate from product creation.</p>
      </header>

      <ProductCreateFormPage scope="brand" />
    </main>
  );
}
