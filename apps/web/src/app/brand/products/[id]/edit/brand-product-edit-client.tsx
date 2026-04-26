"use client";

import { useRouter } from "next/navigation";
import { ProductEditorForm } from "@/components/dashboard/product-editor-form";
import { productToFormValues } from "@/lib/product-form";
import type { Product } from "@/types/marketplace";

type BrandProductEditClientProps = {
  product: Product;
};

export function BrandProductEditClient({ product }: BrandProductEditClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <section className="border border-zinc-300 p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Edit Product</p>
        <h2 className="mt-2 font-heading text-4xl uppercase">Update Product</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">Modify product details and save changes with validated structured form inputs.</p>
      </section>

      <ProductEditorForm
        scope="brand"
        mode="edit"
        productId={product.id}
        initialValues={productToFormValues(product)}
        cancelHref="/brand/products"
        onCompleted={() => {
          router.push("/brand/products");
        }}
      />
    </div>
  );
}
