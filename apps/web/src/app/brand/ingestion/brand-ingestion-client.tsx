"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBrandImportJob,
  deleteBrandImportJob,
  fixBrandIngestionProduct,
  getBrandImportJob,
  getBrandImportJobs,
  getBrandPendingFixProducts,
  retryBrandImportJob,
} from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { ImportJobRecord, ImportSourceType, Product } from "@/types/marketplace";

type ImportFormState = {
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

export function BrandIngestionClient() {
  const pushToast = useToastStore((state) => state.pushToast);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<ImportJobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<ImportJobRecord | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isDeletingJobId, setIsDeletingJobId] = useState<string | null>(null);
  const [pendingFixes, setPendingFixes] = useState<Product[]>([]);
  const [importForm, setImportForm] = useState<ImportFormState>(defaultImportForm);
  const [fixDrafts, setFixDrafts] = useState<Record<string, FixDraft>>({});

  const hydrateFixDrafts = useCallback((products: Product[]) => {
    setFixDrafts((current) => {
      const next = { ...current };
      for (const product of products) {
        if (!next[product.id]) {
          next[product.id] = toFixDraft(product);
        }
      }
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextJobs, nextPending] = await Promise.all([getBrandImportJobs(), getBrandPendingFixProducts()]);
      setJobs(nextJobs);
      setPendingFixes(nextPending);
      hydrateFixDrafts(nextPending);
      if (!selectedJobId && nextJobs[0]?.id) {
        setSelectedJobId(nextJobs[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load ingestion data";
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [hydrateFixDrafts, pushToast, selectedJobId]);

  const loadSelectedJob = useCallback(
    async (importJobId: string) => {
      try {
        const job = await getBrandImportJob(importJobId);
        setSelectedJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load import details";
        pushToast(message, "error");
      }
    },
    [pushToast],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedJobId) return;
    void loadSelectedJob(selectedJobId);
  }, [loadSelectedJob, selectedJobId]);

  useEffect(() => {
    const hasInFlight = jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING");
    if (!hasInFlight) return;

    const interval = setInterval(() => {
      void loadData();
      if (selectedJobId) {
        void loadSelectedJob(selectedJobId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs, loadData, loadSelectedJob, selectedJobId]);

  const totals = useMemo(() => {
    const failedJobs = jobs.filter((item) => item.status === "FAILED" || item.status === "PARTIAL_SUCCESS").length;
    const pendingJobs = jobs.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length;
    return {
      jobs: jobs.length,
      failedJobs,
      pendingJobs,
      needsFixes: pendingFixes.length,
    };
  }, [jobs, pendingFixes.length]);

  const selectedRetryPayload = useMemo(() => {
    if (!selectedJob?.metadata || typeof selectedJob.metadata !== "object") return null;
    const candidate = (selectedJob.metadata as Record<string, unknown>).retryPayload;
    if (!candidate || typeof candidate !== "object") return null;
    return candidate as Record<string, unknown>;
  }, [selectedJob]);

  const handleSubmitImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        sourceType: importForm.sourceType,
        sourceLabel: importForm.sourceLabel.trim() || undefined,
        sourceLocation: importForm.sourceLocation.trim() || undefined,
        rawText: importForm.rawText.trim() || undefined,
        rawJson: importForm.rawJson.trim() ? JSON.parse(importForm.rawJson) : undefined,
        file: importForm.file || undefined,
      };
      const job = await createBrandImportJob(payload);
      pushToast("Brand import queued", "success");
      setImportForm(defaultImportForm);
      await loadData();
      setSelectedJobId(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to queue import";
      pushToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async (importJobId: string) => {
    try {
      await retryBrandImportJob(importJobId);
      pushToast("Retry queued", "success");
      await loadData();
      setSelectedJobId(importJobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to retry import";
      pushToast(message, "error");
    }
  };

  const handleOpenJob = (importJobId: string) => {
    setSelectedJob(null);
    setSelectedJobId(importJobId);
    setIsJobModalOpen(true);
  };

  const handleDeleteJob = async (importJobId: string) => {
    const confirmDelete = window.confirm("Delete this import from history? This will remove logs and raw payload records.");
    if (!confirmDelete) return;

    setIsDeletingJobId(importJobId);
    try {
      await deleteBrandImportJob(importJobId);
      pushToast("Import deleted", "success");
      if (selectedJobId === importJobId) {
        setSelectedJobId(null);
        setSelectedJob(null);
        setIsJobModalOpen(false);
      }
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete import";
      pushToast(message, "error");
    } finally {
      setIsDeletingJobId(null);
    }
  };

  const handleFix = async (productId: string) => {
    const draft = fixDrafts[productId];
    if (!draft) return;

    try {
      await fixBrandIngestionProduct(productId, {
        name: draft.name,
        topCategory: draft.topCategory as Product["topCategory"],
        subCategory: draft.subCategory,
        color: draft.color,
        pricePkr: Number(draft.pricePkr),
        stock: Number(draft.stock),
      });
      pushToast("Fix saved and resubmitted for review", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save fix";
      pushToast(message, "error");
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Import Jobs</p>
          <p className="mt-3 font-heading text-4xl">{totals.jobs}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">In Progress</p>
          <p className="mt-3 font-heading text-4xl">{totals.pendingJobs}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Failed/Partial</p>
          <p className="mt-3 font-heading text-4xl">{totals.failedJobs}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Needs Fix</p>
          <p className="mt-3 font-heading text-4xl">{totals.needsFixes}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form className="space-y-3 border border-zinc-300 p-4" onSubmit={handleSubmitImport}>
          <h2 className="font-heading text-3xl uppercase">New Import</h2>

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
            placeholder="Source URL (REST API mode)"
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
            onChange={(event) => setImportForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {isSubmitting ? "Queueing..." : "Start Import"}
          </button>
        </form>

        <section className="space-y-3 border border-zinc-300 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-3xl uppercase">Import History</h2>
            <button
              type="button"
              onClick={() => void loadData()}
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
                        onClick={() => void handleRetry(job.id)}
                        className="h-8 border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteJob(job.id)}
                      disabled={isDeletingJobId === job.id || job.status === "PROCESSING"}
                      className="h-8 border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {isDeletingJobId === job.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-zinc-700 sm:grid-cols-2">
                  <p><span className="font-semibold">Source Label:</span> {job.sourceLabel || "-"}</p>
                  <p><span className="font-semibold">Source Type:</span> {job.sourceType}</p>
                  <p><span className="font-semibold">Status:</span> {job.status}</p>
                  <p><span className="font-semibold">Brand:</span> {job.brand?.name || "Current Brand"}</p>
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

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Selected Import Details</h2>
          {selectedJob ? (
            <>
              <p className="text-xs text-zinc-600">
                {selectedJob.id} | {selectedJob.sourceType} | {selectedJob.status}
              </p>
              <p className="text-xs text-zinc-600">
                Processed {selectedJob.processedRecords}/{selectedJob.totalRecords} | Success {selectedJob.successfulRecords} | Failed {selectedJob.failedRecords}
              </p>
              <div className="space-y-2">
                {(selectedJob.logs || []).map((log) => (
                  <article key={log.id} className="border border-zinc-200 p-2 text-xs">
                    <p className="font-semibold uppercase tracking-[0.08em]">{log.level}</p>
                    <p>{log.message}</p>
                    {log.details ? <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(log.details, null, 2)}</pre> : null}
                  </article>
                ))}
                {!selectedJob.logs?.length ? <p className="text-sm text-zinc-600">No logs available.</p> : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-600">Select an import job to inspect logs.</p>
          )}
        </article>

        <article className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Fix & Resubmit</h2>
          <div className="space-y-3">
            {pendingFixes.map((product) => {
              const draft = fixDrafts[product.id] ?? toFixDraft(product);
              return (
                <div key={product.id} className="space-y-2 border border-zinc-200 p-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">{product.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-600">{product.approvalStatus}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="h-9 border border-zinc-300 px-2 text-xs"
                      value={draft.name}
                      onChange={(event) => setFixDrafts((current) => ({ ...current, [product.id]: { ...draft, name: event.target.value } }))}
                    />
                    <input
                      className="h-9 border border-zinc-300 px-2 text-xs"
                      value={draft.color}
                      onChange={(event) => setFixDrafts((current) => ({ ...current, [product.id]: { ...draft, color: event.target.value } }))}
                    />
                    <input
                      className="h-9 border border-zinc-300 px-2 text-xs"
                      value={draft.topCategory}
                      onChange={(event) => setFixDrafts((current) => ({ ...current, [product.id]: { ...draft, topCategory: event.target.value } }))}
                    />
                    <input
                      className="h-9 border border-zinc-300 px-2 text-xs"
                      value={draft.subCategory}
                      onChange={(event) => setFixDrafts((current) => ({ ...current, [product.id]: { ...draft, subCategory: event.target.value } }))}
                    />
                    <input
                      className="h-9 border border-zinc-300 px-2 text-xs"
                      value={draft.pricePkr}
                      onChange={(event) => setFixDrafts((current) => ({ ...current, [product.id]: { ...draft, pricePkr: event.target.value } }))}
                    />
                    <input
                      className="h-9 border border-zinc-300 px-2 text-xs"
                      value={draft.stock}
                      onChange={(event) => setFixDrafts((current) => ({ ...current, [product.id]: { ...draft, stock: event.target.value } }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFix(product.id)}
                    className="h-8 border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    Save Fix
                  </button>
                  <Link
                    href={`/brand/ingestion/pending-products/${product.id}`}
                    className="inline-flex h-8 items-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  >
                    View Details
                  </Link>
                </div>
              );
            })}
            {!pendingFixes.length ? <p className="text-sm text-zinc-600">No products need fixes.</p> : null}
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
              <p><span className="font-semibold">Brand:</span> {selectedJob.brand?.name || "Current Brand"}</p>
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
    </div>
  );
}
