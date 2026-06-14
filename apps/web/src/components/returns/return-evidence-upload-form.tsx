"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadUserReturnRequestEvidence } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";

type ReturnEvidenceUploadFormProps = {
  orderId: string;
  subOrderId: string;
  returnRequestId: string;
};

export function ReturnEvidenceUploadForm({
  orderId,
  subOrderId,
  returnRequestId,
}: ReturnEvidenceUploadFormProps) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const [customerNote, setCustomerNote] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState("");
  const [saving, setSaving] = useState(false);

  const parsedEvidenceUrls = evidenceUrls
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <section className="space-y-3 border border-amber-200 bg-amber-50 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-amber-700">More Evidence Required</p>
        <h2 className="mt-1 font-heading text-3xl uppercase text-amber-950">Upload additional proof</h2>
        <p className="mt-2 text-sm text-amber-900">
          Add the extra photos or details requested by the brand so your return or exchange can move back into review.
        </p>
      </div>
      <textarea
        className="min-h-24 w-full border border-amber-300 bg-white p-3 text-sm text-zinc-900"
        placeholder="Add any extra detail for the reviewer"
        value={customerNote}
        maxLength={500}
        onChange={(event) => setCustomerNote(event.target.value)}
      />
      <textarea
        className="min-h-24 w-full border border-amber-300 bg-white p-3 text-sm text-zinc-900"
        placeholder="Paste image URLs, one per line"
        value={evidenceUrls}
        onChange={(event) => setEvidenceUrls(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.12em] text-amber-700">{parsedEvidenceUrls.length}/5 evidence URLs</p>
        <button
          type="button"
          disabled={saving || !parsedEvidenceUrls.length || parsedEvidenceUrls.length > 5}
          onClick={async () => {
            setSaving(true);
            try {
              await uploadUserReturnRequestEvidence(orderId, subOrderId, returnRequestId, {
                evidenceImageUrls: parsedEvidenceUrls,
                customerNote: customerNote.trim() || undefined,
              });
              pushToast("Additional evidence submitted for brand review.", "success");
              router.refresh();
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Unable to upload additional evidence.", "error");
            } finally {
              setSaving(false);
            }
          }}
          className="h-10 border border-amber-900 bg-amber-900 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {saving ? "Uploading..." : "Submit Evidence"}
        </button>
      </div>
    </section>
  );
}
