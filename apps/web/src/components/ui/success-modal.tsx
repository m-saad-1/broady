"use client";

import Link from "next/link";

type SuccessModalProps = {
  open: boolean;
  orderId: string;
  onClose: () => void;
};

export function SuccessModal({ open, orderId, onClose }: SuccessModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg border border-zinc-300 bg-white p-8 shadow-2xl transition-all animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-200">
            <svg
              className="h-10 w-10 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="font-heading text-4xl uppercase tracking-tight text-zinc-900">Order Placed!</h3>
            <p className="text-sm text-zinc-500 uppercase tracking-widest font-medium">Thank you for your purchase.</p>
          </div>

          <div className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-1">Order ID</p>
            <p className="font-mono text-sm font-semibold text-zinc-800 break-all">{orderId}</p>
          </div>

          <div className="flex flex-col w-full gap-3">
            <Link
              href={`/account/orders?orderId=${orderId}`}
              className="flex h-12 items-center justify-center border border-black bg-black px-8 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
              onClick={onClose}
            >
              View Order Details
            </Link>
            <Link
              href="/catalog"
              className="flex h-12 items-center justify-center border border-zinc-300 bg-white px-8 text-xs font-bold uppercase tracking-[0.2em] text-zinc-900 transition-all hover:bg-zinc-50 hover:border-black"
              onClick={onClose}
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
