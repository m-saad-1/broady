"use client";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Remove",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <h3 className="font-heading text-3xl uppercase">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-zinc-700">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
