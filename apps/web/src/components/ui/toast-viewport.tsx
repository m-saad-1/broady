"use client";

import { useToastStore } from "@/stores/toast-store";

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[95] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`pointer-events-auto border px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] shadow-sm ${
            toast.tone === "success"
              ? "border-emerald-700 bg-emerald-600 text-white"
              : toast.tone === "error"
                ? "border-red-700 bg-red-600 text-white"
                : "border-zinc-800 bg-zinc-900 text-white"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p>{toast.message}</p>
            <button
              type="button"
              className="border border-white/60 px-2 py-0.5 text-[10px]"
              onClick={() => removeToast(toast.id)}
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}