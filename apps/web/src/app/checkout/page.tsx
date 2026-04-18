"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, createOrder } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

const paymentMethods = ["COD", "JAZZCASH", "EASYPAISA"] as const;

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("COD");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const items = useCartStore((state) => state.items);
  const removeByKeys = useCartStore((state) => state.removeByKeys);
  const clearCart = useCartStore((state) => state.clearCart);

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

  const placeOrder = async (event: React.FormEvent) => {
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

    setIsSubmitting(true);
    try {
      const response = await createOrder({
        paymentMethod,
        deliveryAddress: address.trim(),
        items: checkoutItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      if (!selectedKeys.length) {
        clearCart();
      } else {
        removeByKeys(selectedKeys);
      }
      if (response.paymentRedirect) {
        setMessage(`Order placed. Continue payment: ${response.paymentRedirect}`);
      } else {
        setMessage(`Order placed successfully. Order ID: ${response.data.id}`);
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          setMessage("Your session has expired. Please log in again to place this order.");
          return;
        }

        if (error.status === 409) {
          setMessage(error.message || "Some cart items changed in stock. Review your cart and try again.");
          return;
        }

        setMessage(error.message || "Order creation failed. Please try again.");
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

      {!user ? (
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>You must be logged in to place an order backed by the database.</p>
          <Link href="/login" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Go to Login
          </Link>
        </section>
      ) : null}

      {!selectedKeys.length ? (
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Select one or more specific items in your cart before continuing to checkout.</p>
          <Link href="/cart" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Return to cart
          </Link>
        </section>
      ) : null}

      <form className="space-y-4 border border-zinc-300 p-6" onSubmit={placeOrder}>
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">
          Ordering {checkoutItems.length} {checkoutItems.length === 1 ? "item" : "items"}
        </p>
        <label className="block text-xs uppercase tracking-[0.12em] text-zinc-600">
          Delivery Address
          <textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 h-28 w-full border border-zinc-300 p-3 text-sm" required />
        </label>
        <label className="block text-xs uppercase tracking-[0.12em] text-zinc-600">
          Payment Method
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as (typeof paymentMethods)[number])}
            className="mt-2 h-11 w-full border border-zinc-300 px-3 text-sm"
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={isSubmitting || !selectedKeys.length} className="h-11 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? "Placing Order..." : "Place Order"}
        </button>
      </form>

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
