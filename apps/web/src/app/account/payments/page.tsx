"use client";

import { FormEvent, useEffect, useState } from "react";
import { addPaymentMethod, getPaymentMethods, removePaymentMethod } from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";
import type { UserPaymentMethod, UserPaymentType } from "@/types/marketplace";

export default function PaymentsPage() {
  const [paymentMethods, setPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [paymentType, setPaymentType] = useState<UserPaymentType>("CARD");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [paymentLast4, setPaymentLast4] = useState("");
  const [paymentExpiryMonth, setPaymentExpiryMonth] = useState("");
  const [paymentExpiryYear, setPaymentExpiryYear] = useState("");
  const [paymentIsDefault, setPaymentIsDefault] = useState(false);

  const paymentSubmission = useFormSubmission();

  const loadMethods = async () => {
    setLoading(true);
    try {
      const methods = await getPaymentMethods();
      setPaymentMethods(methods || []);
    } catch (error) {
      console.error("Failed to load payment methods", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMethods();
  }, []);

  const resetForm = () => {
    setPaymentLabel("");
    setPaymentLast4("");
    setPaymentExpiryMonth("");
    setPaymentExpiryYear("");
    setPaymentIsDefault(false);
    setIsAdding(false);
  };

  const onAddPaymentMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(paymentLast4.trim())) {
      paymentSubmission.setErrorFeedback("Last 4 digits must be exactly 4 numbers.");
      return;
    }

    await paymentSubmission.execute(
      async () => {
        await addPaymentMethod({
          type: paymentType,
          label: paymentLabel.trim(),
          last4: paymentLast4.trim(),
          expiresMonth: paymentExpiryMonth ? Number(paymentExpiryMonth) : undefined,
          expiresYear: paymentExpiryYear ? Number(paymentExpiryYear) : undefined,
          isDefault: paymentIsDefault,
        });
      },
      {
        successMessage: "Payment method saved.",
        onSuccess: () => {
          resetForm();
          void loadMethods();
        },
      }
    );
  };

  const onRemovePaymentMethod = async (methodId: string) => {
    if (!confirm("Are you sure you want to remove this payment method?")) return;
    try {
      await removePaymentMethod(methodId);
      void loadMethods();
    } catch (error) {
      console.error("Failed to remove payment method", error);
    }
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Payments</p>
        <h1 className="font-heading text-4xl uppercase">Payment Methods</h1>
        <p className="text-sm text-zinc-600">Securely manage your saved payment options for a seamless checkout.</p>
      </header>

      {isAdding ? (
        <section className="space-y-6 border border-zinc-300 p-8 max-w-xl bg-zinc-50 shadow-sm">
          <h2 className="font-heading text-2xl uppercase">Add Payment Method</h2>
          <form className="space-y-4" onSubmit={onAddPaymentMethod}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Method Type</label>
              <select 
                className="h-12 w-full border border-zinc-300 bg-white px-4 text-sm focus:border-black outline-none transition-all" 
                value={paymentType} 
                onChange={(event) => setPaymentType(event.target.value as UserPaymentType)}
              >
                <option value="CARD">Credit/Debit Card</option>
                <option value="JAZZCASH">JazzCash</option>
                <option value="EASYPAISA">Easypaisa</option>
                <option value="BANK">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Method Label (e.g. My Visa Card)</label>
              <input 
                className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
                value={paymentLabel} 
                onChange={(event) => setPaymentLabel(event.target.value)} 
                placeholder="e.g. Personal Card" 
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Last 4 Digits</label>
                <input 
                  className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
                  value={paymentLast4} 
                  onChange={(event) => setPaymentLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} 
                  placeholder="1234" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">MM</label>
                  <input 
                    className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
                    value={paymentExpiryMonth} 
                    onChange={(event) => setPaymentExpiryMonth(event.target.value.replace(/\D/g, "").slice(0, 2))} 
                    placeholder="12" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">YYYY</label>
                  <input 
                    className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
                    value={paymentExpiryYear} 
                    onChange={(event) => setPaymentExpiryYear(event.target.value.replace(/\D/g, "").slice(0, 4))} 
                    placeholder="2028" 
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm cursor-pointer py-2">
              <input type="checkbox" className="w-4 h-4 accent-black" checked={paymentIsDefault} onChange={(event) => setPaymentIsDefault(event.target.checked)} />
              <span className="font-medium text-zinc-700">Set as default payment method</span>
            </label>
            <div className="flex gap-4 pt-4">
              <button type="submit" disabled={paymentSubmission.isSubmitting} className="h-12 flex-1 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-md">
                {paymentSubmission.isSubmitting ? "Saving..." : "Save Method"}
              </button>
              <button type="button" onClick={resetForm} className="h-12 flex-1 border border-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all">
                Cancel
              </button>
            </div>
            {paymentSubmission.feedback && (
              <p className={`text-xs mt-2 ${paymentSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>
                {paymentSubmission.feedback}
              </p>
            )}
          </form>
        </section>
      ) : (
        <section className="space-y-6">
          <button onClick={() => setIsAdding(true)} className="h-12 bg-black text-white px-8 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-md active:scale-95">
            Add Payment Method
          </button>

          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full mb-4" />
              <p className="text-sm text-zinc-500 uppercase tracking-widest">Loading methods...</p>
            </div>
          ) : !paymentMethods || paymentMethods.length === 0 ? (
            <div className="border border-zinc-300 p-16 text-center bg-zinc-50">
              <p className="text-sm text-zinc-500 uppercase tracking-widest">No saved payment methods yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paymentMethods.map((method) => (
                <div key={method.id} className={`group border p-6 flex flex-col justify-between transition-all ${method.isDefault ? "border-black bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"}`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{method.type}</p>
                        {method.isDefault && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 border border-emerald-100">Default</span>
                        )}
                      </div>
                      <p className="text-sm font-bold uppercase tracking-wider">{method.label}</p>
                    </div>
                    <div className="w-10 h-6 bg-zinc-100 rounded border border-zinc-200 flex items-center justify-center">
                      <span className="text-[8px] font-black italic">METHOD</span>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4">
                    <p className="text-sm font-mono tracking-widest">•••• {method.last4}</p>
                    <button 
                      onClick={() => void onRemovePaymentMethod(method.id)} 
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
