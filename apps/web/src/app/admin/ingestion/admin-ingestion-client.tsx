"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductEditorForm } from "@/components/dashboard/product-editor-form";
import {
  approveProduct,
  createAdminImportJob,
  deleteAdminImportJob,
  fixAdminIngestionProduct,
  getBrands,
  getAdminBrands,
  getAdminImportFailedProducts,
  getAdminImportJob,
  getAdminImportJobs,
  getAdminIngestionPendingProducts,
  getAdminIngestionQueueMetrics,
  rejectProduct,
  retryAdminImportJob,
  triggerAdminInventorySync,
} from "@/lib/api";
import { productToFormValues } from "@/lib/product-form";
import { useToastStore } from "@/stores/toast-store";
import type { Brand, ImportJobRecord, ImportLogRecord, ImportSourceType, IngestionQueueMetrics, Product } from "@/types/marketplace";

type ImportFormState = {
  brandId: string;
  sourceType: ImportSourceType;
  sourceLabel: string;
  sourceLocation: string;
  rawText: string;
  rawJson: string;
  file: File | null;
};

type FixDraft = {
  name: string;
  topCategory: string;
  subCategory: string;
  color: string;
  pricePkr: string;
  stock: string;
};

const defaultImportForm: ImportFormState = {
  brandId: "",
  sourceType: "CUSTOM_JSON",
  sourceLabel: "",
  sourceLocation: "",
  rawText: "",
  rawJson: "",
  file: null,
};

function toFixDraft(product: Product): FixDraft {
  return {
    name: product.name,
    topCategory: product.topCategory,
    subCategory: product.subCategory,
    color: product.color || "",
    pricePkr: String(product.pricePkr),
    stock: String(product.stock),
  };
}

function JsonReviewBlock({ title, value }: { title: string; value: unknown }) {
  if (value === undefined || value === null) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">{title}</h4>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AdminIngestionClient({ initialBrands = [] }: { initialBrands?: Brand[] }) {
  const pushToast = useToastStore((state) => state.pushToast);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingImport, setIsCreatingImport] = useState(false);
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [jobs, setJobs] = useState<ImportJobRecord[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<IngestionQueueMetrics>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<ImportJobRecord | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isDeletingJobId, setIsDeletingJobId] = useState<string | null>(null);
  const [failedRows, setFailedRows] = useState<ImportLogRecord[]>([]);
  const [importForm, setImportForm] = useState<ImportFormState>(defaultImportForm);
  const [fixDrafts, setFixDrafts] = useState<Record<string, FixDraft>>({});
  const [selectedProductModal, setSelectedProductModal] = useState<Product | null>(null);
  const [editingProductModal, setEditingProductModal] = useState<Product | null>(null);

  const hydrateFixDrafts = useCallback((products: Product[]) => {
    setFixDrafts((current) => {
      const next = { ...current };
      for (const product of products) {
        next[product.id] = toFixDraft(product);
      }
      return next;
    });
  }, []);

  const loadBrandsWithFallback = useCallback(async () => {
    try {
      const adminBrands = await getAdminBrands();
      if (adminBrands.length > 0) return adminBrands;
    } catch {
      // Fall through to public brands endpoint.
    }
    return getBrands();
  }, []);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    const [brandsResult, jobsResult, pendingResult, queueResult] = await Promise.allSettled([
      loadBrandsWithFallback(),
      getAdminImportJobs(),
      getAdminIngestionPendingProducts(),
      getAdminIngestionQueueMetrics(),
    ]);

    if (brandsResult.status === "fulfilled") {
      if (brandsResult.value.length > 0) {
        setBrands(brandsResult.value);
        setImportForm((current) => ({
          ...current,
          brandId:
            current.brandId && brandsResult.value.some((brand) => brand.id === current.brandId)
              ? current.brandId
              : brandsResult.value[0]?.id || "",
        }));
      } else {
        pushToast("Brands endpoint returned no brands; keeping previous list.", "error");
      }
    } else {
      const message = brandsResult.reason instanceof Error ? brandsResult.reason.message : "Unable to load brands";
      pushToast(message, "error");
    }

    if (jobsResult.status === "fulfilled") {
      setJobs(jobsResult.value);
      if (!selectedJobId && jobsResult.value[0]?.id) {
        setSelectedJobId(jobsResult.value[0].id);
      }
    } else {
      const message = jobsResult.reason instanceof Error ? jobsResult.reason.message : "Unable to load import jobs";
      pushToast(message, "error");
      setJobs([]);
    }

    if (pendingResult.status === "fulfilled") {
      setPendingProducts(pendingResult.value);
      hydrateFixDrafts(pendingResult.value);
    } else {
      const message =
        pendingResult.reason instanceof Error ? pendingResult.reason.message : "Unable to load pending approvals";
      pushToast(message, "error");
      setPendingProducts([]);
    }

    if (queueResult.status === "fulfilled") {
      setQueueMetrics(queueResult.value);
    } else {
      const message = queueResult.reason instanceof Error ? queueResult.reason.message : "Unable to load queue metrics";
      pushToast(message, "error");
      setQueueMetrics({});
    }

    setIsLoading(false);
  }, [hydrateFixDrafts, loadBrandsWithFallback, pushToast, selectedJobId]);

  const loadJobDetails = useCallback(
    async (importJobId: string) => {
      try {
        const [job, failed] = await Promise.all([
          getAdminImportJob(importJobId),
          getAdminImportFailedProducts(importJobId),
        ]);
        setSelectedJob(job);
        setFailedRows(failed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load import details";
        pushToast(message, "error");
      }
    },
    [pushToast],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (initialBrands.length) {
      setImportForm((current) => ({
        ...current,
        brandId: current.brandId || initialBrands[0]?.id || "",
      }));
    }
  }, [initialBrands]);

  useEffect(() => {
    if (!selectedJobId) return;
    void loadJobDetails(selectedJobId);
  }, [loadJobDetails, selectedJobId]);

  useEffect(() => {
    const hasInFlight = jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING");
    if (!hasInFlight) return;

    const interval = setInterval(() => {
      void loadOverview();
      if (selectedJobId) {
        void loadJobDetails(selectedJobId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs, loadJobDetails, loadOverview, selectedJobId]);

  const totals = useMemo(() => {
    const totalJobs = jobs.length;
    const failedJobs = jobs.filter((item) => item.status === "FAILED" || item.status === "PARTIAL_SUCCESS").length;
    const processingJobs = jobs.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length;
    return {
      totalJobs,
      failedJobs,
      processingJobs,
      pendingApprovals: pendingProducts.length,
    };
  }, [jobs, pendingProducts.length]);

  const brandNameById = useMemo(() => {
    const byId: Record<string, string> = {};
    for (const brand of brands) {
      byId[brand.id] = brand.name;
    }
    return byId;
  }, [brands]);

  const selectedRetryPayload = useMemo(() => {
    if (!selectedJob?.metadata || typeof selectedJob.metadata !== "object") return null;
    const candidate = (selectedJob.metadata as Record<string, unknown>).retryPayload;
    if (!candidate || typeof candidate !== "object") return null;
    return candidate as Record<string, unknown>;
  }, [selectedJob]);

  const handleCreateImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importForm.brandId) {
      pushToast("Select a brand first", "error");
      return;
    }

    setIsCreatingImport(true);
    try {
      const payload = {
        brandId: importForm.brandId,
        sourceType: importForm.sourceType,
        sourceLabel: importForm.sourceLabel.trim() || undefined,
        sourceLocation: importForm.sourceLocation.trim() || undefined,
        rawText: importForm.rawText.trim() || undefined,
        rawJson: importForm.rawJson.trim() ? JSON.parse(importForm.rawJson) : undefined,
        file: importForm.file || undefined,
      };

      const job = await createAdminImportJob(payload);
      pushToast("Import queued", "success");
      setImportForm((current) => ({ ...defaultImportForm, brandId: current.brandId }));
      await loadOverview();
      setSelectedJobId(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create import";
      pushToast(message, "error");
    } finally {
      setIsCreatingImport(false);
    }
  };

  const handleRetryImport = async (importJobId: string) => {
    try {
      await retryAdminImportJob(importJobId);
      pushToast("Import retry queued", "success");
      await loadOverview();
      setSelectedJobId(importJobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to retry import";
      pushToast(message, "error");
    }
  };

  const handleOpenJob = (importJobId: string) => {
    setSelectedJob(null);
    setFailedRows([]);
    setSelectedJobId(importJobId);
    setIsJobModalOpen(true);
  };

  const handleDeleteImport = async (importJobId: string) => {
    const confirmDelete = window.confirm("Delete this import from history? This will remove its logs and raw import records.");
    if (!confirmDelete) return;

    setIsDeletingJobId(importJobId);
    try {
      await deleteAdminImportJob(importJobId);
      pushToast("Import deleted", "success");
      if (selectedJobId === importJobId) {
        setSelectedJobId(null);
        setSelectedJob(null);
        setFailedRows([]);
        setIsJobModalOpen(false);
      }
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete import";
      pushToast(message, "error");
    } finally {
      setIsDeletingJobId(null);
    }
  };

  const handleApproveProduct = async (productId: string) => {
    try {
      await approveProduct(productId);
      pushToast("Product approved", "success");
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve product";
      pushToast(message, "error");
    }
  };

  const handleRejectProduct = async (productId: string) => {
    try {
      await rejectProduct(productId, "Rejected during ingestion review");
      pushToast("Product rejected", "success");
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reject product";
      pushToast(message, "error");
    }
  };

  const handleSaveFix = async (productId: string) => {
    const draft = fixDrafts[productId];
    if (!draft) return;

    try {
      await fixAdminIngestionProduct(productId, {
        name: draft.name,
        topCategory: draft.topCategory as Product["topCategory"],
        subCategory: draft.subCategory,
        color: draft.color,
        pricePkr: Number(draft.pricePkr),
        stock: Number(draft.stock),
      });
      pushToast("Fix saved, product returned to pending review", "success");
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save product fix";
      pushToast(message, "error");
    }
  };

  const handleInventorySync = async (productId: string) => {
    try {
      await triggerAdminInventorySync(productId);
      pushToast("Inventory sync queued", "success");
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to queue inventory sync";
      pushToast(message, "error");
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Import Jobs</p>
          <p className="mt-3 font-heading text-4xl">{totals.totalJobs}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Processing</p>
          <p className="mt-3 font-heading text-4xl">{totals.processingJobs}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Needs Retry</p>
          <p className="mt-3 font-heading text-4xl">{totals.failedJobs}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending Approvals</p>
          <p className="mt-3 font-heading text-4xl">{totals.pendingApprovals}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[460px_1fr]">
        <form className="space-y-3 border border-zinc-300 p-4" onSubmit={handleCreateImport}>
          <h2 className="font-heading text-3xl uppercase">Create Import</h2>
          <select
            className="h-10 w-full border border-zinc-300 px-3"
            value={importForm.brandId}
            onChange={(event) => setImportForm((current) => ({ ...current, brandId: event.target.value }))}
            required
          >
            <option value="" disabled>
              Select brand
            </option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>

          <select
            className="h-10 w-full border border-zinc-300 px-3"
            value={importForm.sourceType}
            onChange={(event) => setImportForm((current) => ({ ...current, sourceType: event.target.value as ImportSourceType }))}
          >
            <option value="CUSTOM_JSON">Custom JSON</option>
            <option value="SHOPIFY_JSON">Shopify JSON</option>
            <option value="WOOCOMMERCE_JSON">WooCommerce JSON</option>
            <option value="CSV">CSV</option>
            <option value="REST_API">REST API URL</option>
            <option value="MANUAL_UPLOAD">Manual Upload</option>
          </select>

          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Source label (optional)"
            value={importForm.sourceLabel}
            onChange={(event) => setImportForm((current) => ({ ...current, sourceLabel: event.target.value }))}
          />

          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Source URL (for REST API or traceability)"
            value={importForm.sourceLocation}
            onChange={(event) => setImportForm((current) => ({ ...current, sourceLocation: event.target.value }))}
          />

          <textarea
            className="min-h-24 w-full border border-zinc-300 p-3"
            placeholder="Raw text payload (optional)"
            value={importForm.rawText}
            onChange={(event) => setImportForm((current) => ({ ...current, rawText: event.target.value }))}
          />

          <textarea
            className="min-h-24 w-full border border-zinc-300 p-3"
            placeholder='Raw JSON payload (optional, e.g. [{"id":"x"}])'
            value={importForm.rawJson}
            onChange={(event) => setImportForm((current) => ({ ...current, rawJson: event.target.value }))}
          />

          <input
            type="file"
            accept=".json,.csv,text/csv,application/json"
            className="h-10 w-full border border-zinc-300 px-3 py-2 text-xs"
            onChange={(event) =>
              setImportForm((current) => ({
                ...current,
                file: event.target.files?.[0] || null,
              }))
            }
          />

          <button
            type="submit"
            disabled={isCreatingImport || !importForm.brandId}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {isCreatingImport ? "Queueing..." : "Start Import"}
          </button>
        </form>

        <section className="space-y-3 border border-zinc-300 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-3xl uppercase">Import History</h2>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              Refresh
            </button>
          </div>
          {isLoading ? <p className="text-sm text-zinc-600">Loading imports...</p> : null}
          <div className="space-y-3">
            {jobs.map((job) => (
              <article key={job.id} className="border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenJob(job.id)}
                    className="text-left text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2"
                  >
                    {job.sourceLabel || "Untitled Import"}
                  </button>
                  <div className="flex items-center gap-2">
                    {(job.status === "FAILED" || job.status === "PARTIAL_SUCCESS") && (
                      <button
                        type="button"
                        onClick={() => void handleRetryImport(job.id)}
                        className="h-8 border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteImport(job.id)}
                      disabled={isDeletingJobId === job.id || job.status === "PROCESSING"}
                      className="h-8 border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {isDeletingJobId === job.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-zinc-700 sm:grid-cols-2">
                  <p><span className="font-semibold">Brand:</span> {job.brand?.name || brandNameById[job.brandId] || "Unknown"}</p>
                  <p><span className="font-semibold">Source Type:</span> {job.sourceType}</p>
                  <p><span className="font-semibold">Status:</span> {job.status}</p>
                  <p><span className="font-semibold">Source Label:</span> {job.sourceLabel || "-"}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Total {job.totalRecords} | Processed {job.processedRecords} | Success {job.successfulRecords} | Failed {job.failedRecords}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">{new Date(job.createdAt).toLocaleString()}</p>
              </article>
            ))}
            {!jobs.length ? <p className="text-sm text-zinc-600">No import jobs yet.</p> : null}
          </div>
        </section>
      </section>

      <section className="space-y-3 border border-zinc-300 p-4">
        <h2 className="font-heading text-3xl uppercase">Queue Monitoring</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(queueMetrics).map(([queueName, stats]) => (
            <article key={queueName} className="space-y-1 border border-zinc-200 p-3 text-xs">
              <p className="font-semibold uppercase tracking-[0.12em]">{queueName}</p>
              <p>Waiting: {stats.wait ?? 0}</p>
              <p>Active: {stats.active ?? 0}</p>
              <p>Delayed: {stats.delayed ?? 0}</p>
              <p>Failed: {stats.failed ?? 0}</p>
              <p>Completed: {stats.completed ?? 0}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Failed Records</h2>
          {selectedJob ? (
            <p className="text-xs text-zinc-600">
              Selected job {selectedJob.id} ({selectedJob.sourceType})
            </p>
          ) : (
            <p className="text-xs text-zinc-600">Select an import job to review failures.</p>
          )}

          <div className="space-y-2">
            {failedRows.map((row) => (
              <article key={row.id} className="border border-zinc-200 p-3 text-xs">
                <p className="font-semibold uppercase tracking-[0.08em]">{row.message}</p>
                <p className="mt-1 text-zinc-600">{new Date(row.createdAt).toLocaleString()}</p>
                {row.details ? <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(row.details, null, 2)}</pre> : null}
              </article>
            ))}
            {!failedRows.length ? <p className="text-sm text-zinc-600">No failed records for selected import.</p> : null}
          </div>
        </article>

        <article className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Approval Fix Queue</h2>
          <div className="space-y-3">
            {pendingProducts.map((product) => {
              return (
                <div key={product.id} className="space-y-3 border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProductModal(product)}
                      className="text-left text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2"
                    >
                      {product.name}
                    </button>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-600">{product.approvalStatus}</p>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-700">
                    <p>{product.brand?.name || "Brand"} / {product.topCategory} / {product.subCategory}</p>
                    <p>Price: PKR {product.pricePkr.toLocaleString()} | Stock: {product.stock}</p>
                    <p>Color: {product.color || "-"} | Sizes: {product.sizes.join(", ") || "-"}</p>
                    <p className="line-clamp-2">{product.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="inline-flex h-8 items-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    >
                      View Page
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingProductModal(product)}
                      className="h-8 border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveFix(product.id)}
                      className="h-8 border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Save Fix
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInventorySync(product.id)}
                      className="h-8 border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Sync Inventory
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApproveProduct(product.id)}
                      className="h-8 border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRejectProduct(product.id)}
                      className="h-8 border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
            {!pendingProducts.length ? <p className="text-sm text-zinc-600">No pending products.</p> : null}
          </div>
        </article>
      </section>

      {isJobModalOpen && selectedJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsJobModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-3xl uppercase">Import Details</h3>
                <p className="text-xs text-zinc-600">{selectedJob.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsJobModalOpen(false)}
                className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="font-semibold">Brand:</span> {selectedJob.brand?.name || brandNameById[selectedJob.brandId] || "Unknown"}</p>
              <p><span className="font-semibold">Source Label:</span> {selectedJob.sourceLabel || "-"}</p>
              <p><span className="font-semibold">Source Type:</span> {selectedJob.sourceType}</p>
              <p><span className="font-semibold">Status:</span> {selectedJob.status}</p>
              <p><span className="font-semibold">Source Location:</span> {selectedJob.sourceLocation || "-"}</p>
              <p><span className="font-semibold">Created:</span> {new Date(selectedJob.createdAt).toLocaleString()}</p>
              <p><span className="font-semibold">Started:</span> {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : "-"}</p>
              <p><span className="font-semibold">Completed:</span> {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : "-"}</p>
              <p><span className="font-semibold">Total Records:</span> {selectedJob.totalRecords}</p>
              <p><span className="font-semibold">Processed:</span> {selectedJob.processedRecords}</p>
              <p><span className="font-semibold">Successful:</span> {selectedJob.successfulRecords}</p>
              <p><span className="font-semibold">Failed:</span> {selectedJob.failedRecords}</p>
            </div>

            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Import Payload Fields</h4>
              <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs">
                <p><span className="font-semibold">rawText:</span> {typeof selectedRetryPayload?.rawText === "string" ? "Provided" : "Not provided"}</p>
                <p><span className="font-semibold">rawJson:</span> {selectedRetryPayload?.rawJson !== undefined ? "Provided" : "Not provided"}</p>
                <p><span className="font-semibold">fileBuffer:</span> {typeof selectedRetryPayload?.fileBuffer === "string" ? "Provided" : "Not provided"}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Logs</h4>
              <div className="space-y-2">
                {(selectedJob.logs || []).map((log) => (
                  <article key={log.id} className="border border-zinc-200 p-2 text-xs">
                    <p className="font-semibold uppercase tracking-[0.08em]">{log.level}</p>
                    <p>{log.message}</p>
                    <p className="text-zinc-500">{new Date(log.createdAt).toLocaleString()}</p>
                    {log.details ? <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(log.details, null, 2)}</pre> : null}
                  </article>
                ))}
                {!selectedJob.logs?.length ? <p className="text-sm text-zinc-600">No logs available.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProductModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedProductModal(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-3xl uppercase">Product Details</h3>
                <p className="text-xs text-zinc-600">{selectedProductModal.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductModal(null)}
                className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="font-semibold">Name:</span> {selectedProductModal.name}</p>
              <p><span className="font-semibold">Brand:</span> {selectedProductModal.brand?.name || "Unknown"}</p>
              <p><span className="font-semibold">Status:</span> {selectedProductModal.approvalStatus || "PENDING"}</p>
              <p><span className="font-semibold">Active:</span> {selectedProductModal.isActive ? "Yes" : "No"}</p>
              <p><span className="font-semibold">Top Category:</span> {selectedProductModal.topCategory}</p>
              <p><span className="font-semibold">Sub Category:</span> {selectedProductModal.subCategory}</p>
              <p><span className="font-semibold">Price:</span> PKR {selectedProductModal.pricePkr.toLocaleString()}</p>
              <p><span className="font-semibold">Stock:</span> {selectedProductModal.stock}</p>
              <p><span className="font-semibold">Color:</span> {selectedProductModal.color || "-"}</p>
              <p><span className="font-semibold">Sizes:</span> {selectedProductModal.sizes.join(", ") || "-"}</p>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Description</h4>
              <p className="text-sm text-zinc-700">{selectedProductModal.description || "-"}</p>
            </div>
            {selectedProductModal.detail ? (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Structured Details</h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    ["Fabric", selectedProductModal.detail.fabricComposition],
                    ["Care", selectedProductModal.detail.careGuide],
                    ["Fit", selectedProductModal.detail.fitDetails],
                    ["Model", selectedProductModal.detail.modelDetails],
                    ["Material", selectedProductModal.detail.materialDetails],
                    ["Origin", selectedProductModal.detail.origin],
                    ["Includes", selectedProductModal.detail.packageIncludes],
                    ["Disclaimer", selectedProductModal.detail.disclaimer],
                  ].filter(([, value]) => typeof value === "string" && value.trim()).map(([label, value]) => (
                    <p key={`${label}-${value}`}><span className="font-semibold">{label}:</span> {value}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {selectedProductModal.variants?.length ? (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Variants</h4>
                <div className="space-y-1 text-xs text-zinc-700">
                  {selectedProductModal.variants.map((variant) => (
                    <p key={variant.id}>{variant.sku} | {variant.color || "-"} | {variant.size || "-"} | {variant.stockStatus || "in_stock"} | PKR {variant.pricePkr.toLocaleString()}</p>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <JsonReviewBlock
                title="Raw Source Product"
                value={selectedProductModal.importRawData?.[0]?.payload && typeof selectedProductModal.importRawData[0].payload === "object"
                  ? (selectedProductModal.importRawData[0].payload as Record<string, unknown>).metadata &&
                    typeof (selectedProductModal.importRawData[0].payload as Record<string, unknown>).metadata === "object"
                    ? ((selectedProductModal.importRawData[0].payload as Record<string, unknown>).metadata as Record<string, unknown>).raw
                    : undefined
                  : undefined}
              />
              <JsonReviewBlock title="Normalized Broady Product" value={selectedProductModal.importRawData?.[0]?.payload} />
            </div>
          </div>
        </div>
      ) : null}

      {editingProductModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingProductModal(null)}>
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-3xl uppercase">Edit Product</h3>
                <p className="text-xs text-zinc-600">{editingProductModal.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProductModal(null)}
                className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Close
              </button>
            </div>

            <ProductEditorForm
              scope="admin"
              mode="edit"
              productId={editingProductModal.id}
              initialValues={productToFormValues(editingProductModal)}
              cancelHref="/admin/ingestion"
              onCompleted={() => {
                setEditingProductModal(null);
                void loadOverview();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
