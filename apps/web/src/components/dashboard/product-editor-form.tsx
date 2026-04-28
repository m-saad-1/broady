"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  createProduct,
  createProductContentTemplate,
  getAdminBrands,
  getProductContentTemplates,
  submitBrandProduct,
  updateBrandDashboardProduct,
  updateProduct,
  uploadBrandProductImages,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import {
  adminProductFormSchema,
  buildAdminProductPayload,
  buildBrandProductPayload,
  createDefaultProductFormValues,
  productTopCategories,
  productFormSchema,
  type ProductFormValues,
} from "@/lib/product-form";
import { useToastStore } from "@/stores/toast-store";
import type {
  Brand,
  ProductContentTemplate,
  ProductDeliveriesReturns,
  ProductFabricCare,
  ProductShippingDelivery,
  ProductSizeGuide,
  ProductTemplateType,
} from "@/types/marketplace";
import { CheckboxField, SelectField, TextareaField, TextField } from "@/components/forms/form-controls";

type TemplateLibraryState = {
  SIZE_GUIDE: ProductContentTemplate[];
  DELIVERIES_RETURNS: ProductContentTemplate[];
  SHIPPING_DELIVERY: ProductContentTemplate[];
  FABRIC_CARE: ProductContentTemplate[];
};

type ProductEditorFormProps = {
  scope: "admin" | "brand";
  mode?: "create" | "edit";
  productId?: string;
  initialValues?: Partial<ProductFormValues>;
  cancelHref: string;
  onCompleted?: () => void;
};

const emptyTemplateLibrary: TemplateLibraryState = {
  SIZE_GUIDE: [],
  DELIVERIES_RETURNS: [],
  SHIPPING_DELIVERY: [],
  FABRIC_CARE: [],
};

export function ProductEditorForm({
  scope,
  mode = "create",
  productId,
  initialValues,
  cancelHref,
  onCompleted,
}: ProductEditorFormProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [templates, setTemplates] = useState<TemplateLibraryState>(emptyTemplateLibrary);
  const [isLoadingReferenceData, setIsLoadingReferenceData] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [showShippingCharges, setShowShippingCharges] = useState(Boolean(initialValues?.shippingCharges?.trim()));
  const [showSizeGuideImage, setShowSizeGuideImage] = useState(Boolean(initialValues?.sizeGuideImageUrl?.trim()));
  const [submitFeedback, setSubmitFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const defaultValues = useMemo<ProductFormValues>(() => {
    const base = createDefaultProductFormValues(scope, initialValues?.brandId);
    return {
      ...base,
      ...initialValues,
      sizeGuideRows: initialValues?.sizeGuideRows?.length
        ? initialValues.sizeGuideRows
        : base.sizeGuideRows,
    };
  }, [initialValues, scope]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(scope === "admin" ? adminProductFormSchema : productFormSchema) as any,
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const { fields: sizeGuideFields, append: appendSizeGuideRow, remove: removeSizeGuideRow, replace: replaceSizeGuideRows } = useFieldArray({
    control,
    name: "sizeGuideRows",
  });

  const selectedImageUrl = useWatch({ control, name: "imageUrl" });
  const shippingChargesValue = useWatch({ control, name: "shippingCharges" });
  const sizeGuideTemplateId = useWatch({ control, name: "sizeGuideTemplateId" });
  const deliveriesTemplateId = useWatch({ control, name: "deliveriesReturnsTemplateId" });
  const shippingTemplateId = useWatch({ control, name: "shippingDeliveryTemplateId" });
  const fabricTemplateId = useWatch({ control, name: "fabricCareTemplateId" });
  const brandIdValue = useWatch({ control, name: "brandId" });

  const submitLabel =
    mode === "edit"
      ? "Save Changes"
      : scope === "admin"
        ? "Create Product"
        : "Submit for Approval";

  const pendingLabel = mode === "edit" ? "Saving..." : scope === "admin" ? "Creating..." : "Submitting...";

  const loadReferenceData = useCallback(async () => {
    setIsLoadingReferenceData(true);
    try {
      const [sizeGuides, deliveriesReturns, shippingDelivery, fabricCare, nextBrands] = await Promise.all([
        getProductContentTemplates("SIZE_GUIDE"),
        getProductContentTemplates("DELIVERIES_RETURNS"),
        getProductContentTemplates("SHIPPING_DELIVERY"),
        getProductContentTemplates("FABRIC_CARE"),
        scope === "admin" ? getAdminBrands() : Promise.resolve([] as Brand[]),
      ]);

      setTemplates({
        SIZE_GUIDE: sizeGuides,
        DELIVERIES_RETURNS: deliveriesReturns,
        SHIPPING_DELIVERY: shippingDelivery,
        FABRIC_CARE: fabricCare,
      });
      setBrands(nextBrands);

      if (scope === "admin") {
        const currentBrandId = getValues("brandId");
        if (!currentBrandId && nextBrands[0]?.id) {
          setValue("brandId", nextBrands[0].id, { shouldDirty: false });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load product form references";
      pushToast(message, "error");
    } finally {
      setIsLoadingReferenceData(false);
    }
  }, [getValues, pushToast, scope, setValue]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    reset(defaultValues);
    setUploadedImageUrls(defaultValues.imageUrl ? [defaultValues.imageUrl] : []);
    setShowShippingCharges(Boolean(defaultValues.shippingCharges?.trim()));
    setShowSizeGuideImage(Boolean(defaultValues.sizeGuideImageUrl?.trim()));
    setSubmitFeedback(null);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (shippingChargesValue?.trim()) {
      setShowShippingCharges(true);
    }
  }, [shippingChargesValue]);

  const applyTemplate = (type: ProductTemplateType, templateId: string) => {
    const template = templates[type].find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    if (type === "SIZE_GUIDE") {
      const content = template.content as ProductSizeGuide;
      setValue("sizeGuideTemplateId", template.id, { shouldDirty: true });
      setValue("sizeGuideImageUrl", content.imageUrl || "", { shouldDirty: true });
      replaceSizeGuideRows(content.entries.length ? content.entries : [{ size: "S", cm: "", inches: "" }]);
      setShowSizeGuideImage(Boolean(content.imageUrl));
      return;
    }

    if (type === "DELIVERIES_RETURNS") {
      const content = template.content as ProductDeliveriesReturns;
      setValue("deliveriesReturnsTemplateId", template.id, { shouldDirty: true });
      setValue("deliveryTime", content.deliveryTime, { shouldDirty: true });
      setValue("returnPolicy", content.returnPolicy, { shouldDirty: true });
      setValue("refundConditions", content.refundConditions, { shouldDirty: true });
      return;
    }

    if (type === "SHIPPING_DELIVERY") {
      const content = template.content as ProductShippingDelivery;
      setValue("shippingDeliveryTemplateId", template.id, { shouldDirty: true });
      setValue("shippingRegions", content.regions.join("\n"), { shouldDirty: true });
      setValue("shippingEstimatedDeliveryTime", content.estimatedDeliveryTime, { shouldDirty: true });
      setValue("shippingCharges", content.charges || "", { shouldDirty: true });
      setShowShippingCharges(Boolean(content.charges));
      return;
    }

    const content = template.content as ProductFabricCare;
    setValue("fabricCareTemplateId", template.id, { shouldDirty: true });
    setValue("fabricType", content.fabricType, { shouldDirty: true });
    setValue("careInstructions", content.careInstructions.join("\n"), { shouldDirty: true });
  };

  const saveTemplate = async (type: ProductTemplateType) => {
    const name = window.prompt("Template name");
    if (!name?.trim()) {
      return;
    }

    const values = getValues();
    const content = (() => {
      if (type === "SIZE_GUIDE") {
        return {
          imageUrl: values.sizeGuideImageUrl || undefined,
          entries: values.sizeGuideRows,
        };
      }

      if (type === "DELIVERIES_RETURNS") {
        return {
          deliveryTime: values.deliveryTime,
          returnPolicy: values.returnPolicy,
          refundConditions: values.refundConditions,
        };
      }

      if (type === "SHIPPING_DELIVERY") {
        return {
          regions: values.shippingRegions
            .split(/\r?\n|,/) 
            .map((item) => item.trim())
            .filter(Boolean),
          estimatedDeliveryTime: values.shippingEstimatedDeliveryTime,
          charges: values.shippingCharges || undefined,
        };
      }

      return {
        fabricType: values.fabricType,
        careInstructions: values.careInstructions
          .split(/\r?\n|,/) 
          .map((item) => item.trim())
          .filter(Boolean),
      };
    })();

    try {
      const created = await createProductContentTemplate({ type, name: name.trim(), content });
      setTemplates((current) => ({
        ...current,
        [type]: [...current[type], created].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      pushToast("Template saved", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save template";
      pushToast(message, "error");
    }
  };

  const handleProductImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.currentTarget.value = "";

    if (!selectedFiles.length) {
      return;
    }

    setUploadingImages(true);
    try {
      const uploadedUrls = await uploadBrandProductImages(selectedFiles);
      setUploadedImageUrls((current) => Array.from(new Set([...current, ...uploadedUrls])));

      const currentImage = getValues("imageUrl");
      if (!currentImage && uploadedUrls[0]) {
        setValue("imageUrl", uploadedUrls[0], { shouldDirty: true, shouldValidate: true });
      }

      pushToast("Image uploaded", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload image";
      pushToast(message, "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitFeedback(null);

    try {
      if (scope === "admin") {
        const payload = buildAdminProductPayload(values);

        if (mode === "edit") {
          if (!productId) {
            throw new Error("Missing product id for edit mode");
          }
          await updateProduct(productId, payload);
          pushToast("Product updated", "success");
          setSubmitFeedback({ type: "success", message: "Product updated successfully." });
        } else {
          await createProduct(payload);
          pushToast("Product created", "success");
          setSubmitFeedback({ type: "success", message: "Product created successfully." });
        }
      } else {
        const payload = buildBrandProductPayload(values);

        if (mode === "edit") {
          if (!productId) {
            throw new Error("Missing product id for edit mode");
          }
          await updateBrandDashboardProduct(productId, payload);
          pushToast("Product updated", "success");
          setSubmitFeedback({ type: "success", message: "Product updated successfully." });
        } else {
          await submitBrandProduct(payload);
          pushToast("Product submitted for approval", "success");
          setSubmitFeedback({ type: "success", message: "Product submitted for approval." });
        }
      }

      if (mode === "create") {
        const currentBrandId = getValues("brandId");
        const nextValues = createDefaultProductFormValues(scope, currentBrandId);
        reset(nextValues);
        setUploadedImageUrls([]);
        setShowShippingCharges(false);
        setShowSizeGuideImage(false);
      }

      onCompleted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save product";
      pushToast(message, "error");
      setSubmitFeedback({ type: "error", message });
    }
  });

  const resetToInitial = () => {
    reset(defaultValues);
    setUploadedImageUrls(defaultValues.imageUrl ? [defaultValues.imageUrl] : []);
    setShowShippingCharges(Boolean(defaultValues.shippingCharges?.trim()));
    setShowSizeGuideImage(Boolean(defaultValues.sizeGuideImageUrl?.trim()));
    setSubmitFeedback(null);
  };

  return (
    <section className="space-y-5 border border-zinc-300 p-5">
      {isLoadingReferenceData ? <p className="text-sm text-zinc-600">Loading form data...</p> : null}
      {submitFeedback ? (
        <p
          role="status"
          className={submitFeedback.type === "success" ? "border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" : "border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"}
        >
          {submitFeedback.message}
        </p>
      ) : null}

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {scope === "admin" ? (
          <SelectField<ProductFormValues>
            name="brandId"
            label="Brand"
            required
            register={register}
            errors={errors}
            disabled={isLoadingReferenceData || isSubmitting}
            options={[
              { label: "Select brand", value: "", disabled: true },
              ...brands.map((brand) => ({ label: brand.name, value: brand.id })),
            ]}
          />
        ) : null}

        <section className="space-y-3 border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Basic Information</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField<ProductFormValues>
              name="name"
              label="Product Name"
              required
              placeholder="Summer Kurta"
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
            <TextField<ProductFormValues>
              name="slug"
              label="Slug"
              required
              placeholder="summer-kurta"
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
            <TextareaField<ProductFormValues>
              className="md:col-span-2"
              name="description"
              label="Description"
              required
              placeholder="Describe product details, quality, and styling notes"
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
            <TextField<ProductFormValues>
              name="pricePkr"
              label="Price (PKR)"
              required
              type="number"
              min={1}
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
            <TextField<ProductFormValues>
              name="stock"
              label="Stock"
              required
              type="number"
              min={0}
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
            <SelectField<ProductFormValues>
              name="topCategory"
              label="Top Category"
              required
              register={register}
              errors={errors}
              disabled={isSubmitting}
              options={productTopCategories.map((category) => ({ label: category, value: category }))}
            />
            <TextField<ProductFormValues>
              name="subCategory"
              label="Sub Category"
              required
              placeholder="Kurta"
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
            <TextField<ProductFormValues>
              className="md:col-span-2"
              name="imageUrl"
              label="Primary Image URL"
              required
              placeholder="https://... or /uploads/..."
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]">
              {uploadingImages ? "Uploading images..." : "Upload Product Images"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void handleProductImageSelection(event)}
                disabled={uploadingImages || isSubmitting}
              />
            </label>

            {selectedImageUrl ? (
              <div className="rounded border border-zinc-200 p-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Selected image preview</p>
                <div className="relative h-40 w-full overflow-hidden border border-zinc-200">
                  <Image src={resolveMediaUrl(selectedImageUrl)} alt="Selected product" fill className="object-cover" unoptimized />
                </div>
              </div>
            ) : null}

            {uploadedImageUrls.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {uploadedImageUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setValue("imageUrl", url, { shouldDirty: true, shouldValidate: true })}
                    className={`border p-2 text-left text-xs ${selectedImageUrl === url ? "border-black bg-zinc-50" : "border-zinc-300"}`}
                  >
                    <div className="relative h-24 w-full overflow-hidden border border-zinc-200">
                      <Image src={resolveMediaUrl(url)} alt="Uploaded product" fill className="object-cover" unoptimized />
                    </div>
                    <span className="mt-2 block truncate uppercase tracking-[0.08em]">Use this image</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Size Guide</h3>
            <button
              type="button"
              className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              onClick={() => void saveTemplate("SIZE_GUIDE")}
            >
              Save as template
            </button>
          </div>
          <SelectField<ProductFormValues>
            name="sizeGuideTemplateId"
            label="Size Guide Template"
            register={register}
            errors={errors}
            disabled={isSubmitting}
            options={[
              { label: "Select template", value: "" },
              ...templates.SIZE_GUIDE.map((template) => ({ label: template.name, value: template.id })),
            ]}
          />
          <button
            type="button"
            className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => {
              if (showSizeGuideImage) {
                setValue("sizeGuideImageUrl", "", { shouldDirty: true });
              }
              setShowSizeGuideImage((current) => !current);
            }}
          >
            {showSizeGuideImage ? "Hide size guide image" : "Add size guide image"}
          </button>
          {showSizeGuideImage ? (
            <TextField<ProductFormValues>
              name="sizeGuideImageUrl"
              label="Size Guide Image URL"
              placeholder="https://..."
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
          ) : null}

          <TextField<ProductFormValues>
            name="sizes"
            label="Available Sizes"
            required
            description="Comma-separated values, for example: S, M, L"
            placeholder="S, M, L"
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Size Guide Rows</p>
            {sizeGuideFields.map((field, index) => (
              <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <TextField<ProductFormValues>
                  name={`sizeGuideRows.${index}.size` as const}
                  label="Size"
                  register={register}
                  errors={errors}
                  disabled={isSubmitting}
                />
                <TextField<ProductFormValues>
                  name={`sizeGuideRows.${index}.cm` as const}
                  label="CM"
                  register={register}
                  errors={errors}
                  disabled={isSubmitting}
                />
                <TextField<ProductFormValues>
                  name={`sizeGuideRows.${index}.inches` as const}
                  label="Inches"
                  register={register}
                  errors={errors}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => removeSizeGuideRow(index)}
                  disabled={sizeGuideFields.length <= 1 || isSubmitting}
                  className="h-10 self-end border border-zinc-300 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => appendSizeGuideRow({ size: "", cm: "", inches: "" })}
              disabled={isSubmitting}
              className="h-10 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            >
              Add row
            </button>
          </div>

          <button
            type="button"
            className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => applyTemplate("SIZE_GUIDE", sizeGuideTemplateId || "")}
            disabled={!sizeGuideTemplateId || isSubmitting}
          >
            Apply selected size guide template
          </button>
        </section>

        <section className="space-y-3 border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Deliveries and Returns</h3>
            <button
              type="button"
              className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              onClick={() => void saveTemplate("DELIVERIES_RETURNS")}
            >
              Save as template
            </button>
          </div>
          <SelectField<ProductFormValues>
            name="deliveriesReturnsTemplateId"
            label="Deliveries and Returns Template"
            register={register}
            errors={errors}
            disabled={isSubmitting}
            options={[
              { label: "Select template", value: "" },
              ...templates.DELIVERIES_RETURNS.map((template) => ({ label: template.name, value: template.id })),
            ]}
          />
          <button
            type="button"
            className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => applyTemplate("DELIVERIES_RETURNS", deliveriesTemplateId || "")}
            disabled={!deliveriesTemplateId || isSubmitting}
          >
            Apply selected deliveries template
          </button>
          <TextField<ProductFormValues>
            name="deliveryTime"
            label="Delivery Time"
            required
            placeholder="3-5 business days"
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
          <TextareaField<ProductFormValues>
            name="returnPolicy"
            label="Return Policy"
            required
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
          <TextareaField<ProductFormValues>
            name="refundConditions"
            label="Refund Conditions"
            required
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
        </section>

        <section className="space-y-3 border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Shipping and Delivery</h3>
            <button
              type="button"
              className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              onClick={() => void saveTemplate("SHIPPING_DELIVERY")}
            >
              Save as template
            </button>
          </div>
          <SelectField<ProductFormValues>
            name="shippingDeliveryTemplateId"
            label="Shipping Template"
            register={register}
            errors={errors}
            disabled={isSubmitting}
            options={[
              { label: "Select template", value: "" },
              ...templates.SHIPPING_DELIVERY.map((template) => ({ label: template.name, value: template.id })),
            ]}
          />
          <button
            type="button"
            className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => applyTemplate("SHIPPING_DELIVERY", shippingTemplateId || "")}
            disabled={!shippingTemplateId || isSubmitting}
          >
            Apply selected shipping template
          </button>
          <TextareaField<ProductFormValues>
            name="shippingRegions"
            label="Shipping Regions"
            required
            description="Enter one region per line or comma-separated values"
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
          <TextField<ProductFormValues>
            name="shippingEstimatedDeliveryTime"
            label="Estimated Delivery Time"
            required
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
          <button
            type="button"
            className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => {
              if (showShippingCharges) {
                setValue("shippingCharges", "", { shouldDirty: true });
              }
              setShowShippingCharges((current) => !current);
            }}
            disabled={isSubmitting}
          >
            {showShippingCharges ? "Remove shipping charges" : "Add shipping charges"}
          </button>
          {showShippingCharges ? (
            <TextField<ProductFormValues>
              name="shippingCharges"
              label="Shipping Charges"
              placeholder="Calculated at checkout"
              register={register}
              errors={errors}
              disabled={isSubmitting}
            />
          ) : null}
        </section>

        <section className="space-y-3 border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Fabric and Care</h3>
            <button
              type="button"
              className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              onClick={() => void saveTemplate("FABRIC_CARE")}
            >
              Save as template
            </button>
          </div>
          <SelectField<ProductFormValues>
            name="fabricCareTemplateId"
            label="Fabric and Care Template"
            register={register}
            errors={errors}
            disabled={isSubmitting}
            options={[
              { label: "Select template", value: "" },
              ...templates.FABRIC_CARE.map((template) => ({ label: template.name, value: template.id })),
            ]}
          />
          <button
            type="button"
            className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => applyTemplate("FABRIC_CARE", fabricTemplateId || "")}
            disabled={!fabricTemplateId || isSubmitting}
          >
            Apply selected fabric template
          </button>
          <TextField<ProductFormValues>
            name="fabricType"
            label="Fabric Type"
            required
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
          <TextareaField<ProductFormValues>
            name="careInstructions"
            label="Care Instructions"
            required
            description="Enter one instruction per line or comma-separated values"
            register={register}
            errors={errors}
            disabled={isSubmitting}
          />
        </section>

        <div className="rounded border border-zinc-200 p-4">
          <CheckboxField<ProductFormValues>
            name="isActive"
            label="Product is active"
            description="Inactive products remain hidden from customer storefront listings."
            control={control}
            errors={errors}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting || (scope === "admin" && !brandIdValue)}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {isSubmitting ? pendingLabel : submitLabel}
          </button>
          <button
            type="button"
            onClick={resetToInitial}
            disabled={isSubmitting}
            className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
          >
            Reset
          </button>
          <Link href={cancelHref} className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to Products
          </Link>
        </div>
      </form>
    </section>
  );
}
