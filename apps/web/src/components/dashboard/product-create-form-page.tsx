"use client";

import { ProductEditorForm } from "@/components/dashboard/product-editor-form";

type ProductCreateFormPageProps = {
  scope: "admin" | "brand";
};

export function ProductCreateFormPage({ scope }: ProductCreateFormPageProps) {
  const cancelHref = scope === "admin" ? "/admin/products" : "/brand/products";

  return <ProductEditorForm scope={scope} mode="create" cancelHref={cancelHref} />;
}
