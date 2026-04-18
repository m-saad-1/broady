"use client";

import { useEffect, useState } from "react";
import { getAdminReviewReports, moderateReview, resolveAdminReviewReport } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { AdminReviewReportRecord, ReviewReportStatus } from "@/types/marketplace";

const moderationActions = ["HIDE", "UNHIDE", "FLAG", "REMOVE"] as const;

export function AdminReviewsClient() {
  const [reports, setReports] = useState<AdminReviewReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReviewReportStatus>("OPEN");
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const pushToast = useToastStore((state) => state.pushToast);

  const load = async (status: ReviewReportStatus) => {
    setLoading(true);
    try {
      const data = await getAdminReviewReports({ status, limit: 100, skip: 0 });
      setReports(data);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to load reports", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(statusFilter);
  }, [statusFilter]);

  const handleResolve = async (reportId: string, status: ReviewReportStatus) => {
    setWorkingKey(`resolve-${reportId}`);
    try {
      await resolveAdminReviewReport(reportId, {
        status,
        resolutionNote: status === "RESOLVED" ? "Moderation action applied" : "Report dismissed",
      });
      pushToast("Report updated", "success");
      await load(statusFilter);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to resolve report", "error");
    } finally {
      setWorkingKey(null);
    }
  };

  const handleModerate = async (reviewId: string, action: "HIDE" | "UNHIDE" | "FLAG" | "REMOVE") => {
    setWorkingKey(`moderate-${reviewId}-${action}`);
    try {
      await moderateReview(reviewId, {
        action,
        reason: `Admin moderation: ${action.toLowerCase()}`,
      });
      pushToast(`Review set to ${action.toLowerCase()}`, "success");
      await load(statusFilter);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to moderate review", "error");
    } finally {
      setWorkingKey(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["OPEN", "RESOLVED", "DISMISSED"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`h-9 border px-3 text-xs font-semibold uppercase tracking-[0.12em] ${
              statusFilter === status ? "border-black bg-black text-white" : "border-zinc-300"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-zinc-700">Loading moderation queue...</p> : null}

      {!loading && !reports.length ? (
        <section className="border border-zinc-300 p-6">
          <p className="text-sm text-zinc-700">No reports found for this filter.</p>
        </section>
      ) : null}

      {!loading && reports.length ? (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="border border-zinc-300 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  {report.reason} • {report.status} • {report.review.product.name}
                </p>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Reported by {report.reportedByUser.fullName}</p>
              </div>

              <p className="mt-2 text-sm leading-7 text-zinc-700">{report.review.content}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {moderationActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => void handleModerate(report.review.id, action)}
                    disabled={workingKey === `moderate-${report.review.id}-${action}`}
                    className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                  >
                    {workingKey === `moderate-${report.review.id}-${action}` ? "Working..." : action}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleResolve(report.id, "RESOLVED")}
                  disabled={workingKey === `resolve-${report.id}`}
                  className="h-9 border border-emerald-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 disabled:opacity-50"
                >
                  Mark Resolved
                </button>
                <button
                  type="button"
                  onClick={() => void handleResolve(report.id, "DISMISSED")}
                  disabled={workingKey === `resolve-${report.id}`}
                  className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                >
                  Dismiss Report
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
