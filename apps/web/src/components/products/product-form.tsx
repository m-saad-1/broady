"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  productFormSchema,
  ProductFormValues,
  productToFormValues,
  buildAdminProductPayload,
} from "@/lib/product-form";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField, SelectField } from "@/components/forms/form-controls";
import { Product } from "@/types/marketplace";
import {
  GENDER_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
} from "@broady/shared";
import { getTopCategoryLabel } from "@/lib/taxonomy";
import { productTopCategories } from "@/lib/product-form";

type ProductFormProps = {
  product?: Product;
  onSubmit: (data: ProductFormValues) => void;
  isSubmitting: boolean;
};

export function ProductForm({ product, onSubmit, isSubmitting }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as any,
    defaultValues: product ? productToFormValues(product) : {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <TextField name="name" label="Product Name" required register={register} errors={errors} disabled={false} />
        </div>
        
      </div>

      <div>
        <TextareaField name="description" label="Description" required register={register} errors={errors} disabled={false} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <label htmlFor="topCategory" className="mb-2 block text-sm font-medium text-gray-700">
            Top Category
          </label>
          <SelectField
            name="topCategory"
            label="Top Category"
            required
            register={register}
            errors={errors}
            disabled={false}
            options={productTopCategories.map((opt) => ({ label: getTopCategoryLabel(opt), value: opt }))}
          />
          {errors.topCategory && <p className="mt-1 text-sm text-red-600">{errors.topCategory.message}</p>}
        </div>

        <div>
          <TextField name="subCategory" label="Sub Category" required register={register} errors={errors} disabled={false} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <label htmlFor="gender" className="mb-2 block text-sm font-medium text-gray-700">
            Gender
          </label>
          <SelectField name="gender" label="Gender" required register={register} errors={errors} disabled={false} options={GENDER_OPTIONS.map((opt) => ({ label: opt, value: opt }))} />
          {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>}
        </div>
        <div>
          <label htmlFor="productType" className="mb-2 block text-sm font-medium text-gray-700">
            Product Type
          </label>
          <SelectField name="type" label="Type" required register={register} errors={errors} disabled={false} options={PRODUCT_TYPE_OPTIONS.map((opt) => ({ label: opt, value: opt }))} />
          {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>}
        </div>
        <div>
          <TextField name="color" label="Color" required register={register} errors={errors} disabled={false} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <TextField name="actualPrice" label="Actual Price" required type="number" min={0} register={register} errors={errors} disabled={false} />
        </div>
        <div>
          <TextField name="discountPercentage" label="Discount (%)" type="number" min={0} max={100} register={register} errors={errors} disabled={false} />
        </div>
        <div>
          <TextField name="stock" label="Stock" required type="number" min={0} register={register} errors={errors} disabled={false} />
        </div>
      </div>

      <div>
        <TextField name="tags" label="Tags (comma-separated)" register={register} errors={errors} disabled={false} />
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Product"}
        </Button>
      </div>
    </form>
  );
}
