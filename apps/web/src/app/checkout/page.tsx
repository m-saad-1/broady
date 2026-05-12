"use client";

import Link from "next/link";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, createOrder } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SuccessModal } from "@/components/ui/success-modal";
import { formatPkr } from "@/lib/utils";

const paymentMethods = ["COD", "JAZZCASH", "EASYPAISA"] as const;

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("COD");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const items = useCartStore((state) => state.items);
  const removeByKeys = useCartStore((state) => state.removeByKeys);
  const clearCart = useCartStore((state) => state.clearCart);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selectedKeys = useMemo(() => {
    const raw = searchParams.get("items") || "";
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [searchParams]);

  const checkoutItems = useMemo(() => {
    if (!selectedKeys.length) return [];
    const keySet = new Set(selectedKeys);
    return items.filter((item) => keySet.has(`${item.product.id}:${item.selectedSize || ""}:${item.selectedColor || ""}`));
  }, [items, selectedKeys]);
  
  const totalPrice = useMemo(() => {
    return checkoutItems.reduce((total, item) => total + item.product.pricePkr * item.quantity, 0);
  }, [checkoutItems]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!user) {
      setMessage("Please login first to place an order.");
      return;
    }

    if (!selectedKeys.length) {
      setMessage("Please select specific cart items before checkout.");
      return;
    }

    if (!checkoutItems.length) {
      setMessage("Selected items are no longer available in cart. Please select again.");
      return;
    }

    if (address.trim().length < 10) {
      setMessage("Please provide a complete delivery address (minimum 10 characters).");
      return;
    }

    setShowConfirmModal(true);
  };

  const placeOrder = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setMessage("");

    try {
      const orderPayload = {
        paymentMethod,
        deliveryAddress: address.trim(),
        items: checkoutItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
        })),
      };

      const response = await createOrder(orderPayload);

      if (!selectedKeys.length) {
        clearCart();
      } else {
        removeByKeys(selectedKeys);
      }

      if (response.paymentRedirect) {
        window.location.href = response.paymentRedirect;
      } else {
        if (response.data?.id) {
          setLastOrderId(response.data.id);
        }
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) {
          setMessage("Your session has expired. Please log in again to place this order.");
          return;
        }
        if (err.status === 409) {
          setMessage(err.message || "Some cart items changed in stock. Review your cart and try again.");
          return;
        }
        setMessage(err.message || "Order creation failed. Please try again.");
        return;
      }
      setMessage("Order creation failed due to a network issue. Please retry in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Finalize</p>
        <h1 className="font-heading text-5xl uppercase">Checkout</h1>
      </header>

      {!mounted || !user ? (
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>You must be logged in to place an order backed by the database.</p>
          <Link href="/login" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Go to Login
          </Link>
        </section>
      ) : null}

      {mounted && !selectedKeys.length ? (
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Select one or more specific items in your cart before continuing to checkout.</p>
          <Link href="/cart" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Return to cart
          </Link>
        </section>
      ) : null}

      <form className="space-y-4 border border-zinc-300 p-6" onSubmit={handleSubmit}>
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">
          Ordering {checkoutItems.length} {checkoutItems.length === 1 ? "item" : "items"} | Total: {formatPkr(totalPrice)}
        </p>
        <label className="block text-xs uppercase tracking-[0.12em] text-zinc-600">
          Delivery Address
          <textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 h-28 w-full border border-zinc-300 p-3 text-sm focus:border-black focus:outline-none" required />
        </label>
        <label className="block text-xs uppercase tracking-[0.12em] text-zinc-600">
          Payment Method
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as (typeof paymentMethods)[number])}
            className="mt-2 h-11 w-full border border-zinc-300 px-3 text-sm focus:border-black focus:outline-none"
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={isSubmitting || !selectedKeys.length} className="w-full h-12 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-all hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? "Processing..." : "Confirm & Place Order"}
        </button>
      </form>

      <ConfirmModal
        open={showConfirmModal}
        title="Confirm Order"
        description={`You are about to place an order for ${formatPkr(totalPrice)} to be delivered to "${address.trim()}". Continue?`}
        confirmText="Confirm Order"
        onConfirm={placeOrder}
        onCancel={() => setShowConfirmModal(false)}
      />

      <SuccessModal
        open={showSuccessModal}
        orderId={lastOrderId}
        onClose={() => setShowSuccessModal(false)}
      />

      {message && <p className="border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</p>}
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl px-4 py-10 lg:px-10" />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
