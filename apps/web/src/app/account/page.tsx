"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, logoutUser } from "@/lib/auth-client";
import {
  addPaymentMethod,
  getNotificationPreferences,
  getPaymentMethods,
  removePaymentMethod,
  updateNotificationPreferences,
  updatePassword,
} from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";
import { OrderTrackerClient } from "./order-tracker-client";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { NotificationPreference, UserPaymentMethod, UserPaymentType } from "@/types/marketplace";

const defaultNotifications: Omit<NotificationPreference, "id" | "userId"> = {
  orderUpdates: true,
  promoEmails: false,
  securityAlerts: true,
  wishlistAlerts: true,
};

export default function AccountPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearCart = useCartStore((state) => state.clearCart);
  const clearWishlist = useWishlistStore((state) => state.clear);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [paymentType, setPaymentType] = useState<UserPaymentType>("CARD");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [paymentLast4, setPaymentLast4] = useState("");
  const [paymentExpiryMonth, setPaymentExpiryMonth] = useState("");
  const [paymentExpiryYear, setPaymentExpiryYear] = useState("");
  const [paymentIsDefault, setPaymentIsDefault] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(defaultNotifications);

  const passwordSubmission = useFormSubmission();
  const paymentSubmission = useFormSubmission();
  const notificationSubmission = useFormSubmission();

  useEffect(() => {
    fetchCurrentUser().then(async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) return;

      try {
        const [methods, preferences] = await Promise.all([getPaymentMethods(), getNotificationPreferences()]);
        setPaymentMethods(methods);
        setNotificationPrefs({
          orderUpdates: preferences.orderUpdates,
          promoEmails: preferences.promoEmails,
          securityAlerts: preferences.securityAlerts,
          wishlistAlerts: preferences.wishlistAlerts,
        });
      } catch {
        // Keep UI usable even if API fetch fails temporarily.
      }
    });
  }, [setUser]);

  const onChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newPassword || !confirmPassword) {
      passwordSubmission.setErrorFeedback("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      passwordSubmission.setErrorFeedback("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordSubmission.setErrorFeedback("New password and confirmation do not match.");
      return;
    }

    await passwordSubmission.execute(
      async () => {
        await updatePassword({ currentPassword: currentPassword || undefined, newPassword });
      },
      {
        successMessage: "Password updated successfully.",
        errorMessage: "Unable to update password.",
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      }
    );
  };

  const onAddPaymentMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    paymentSubmission.clearFeedback();

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
        errorMessage: "Unable to save payment method.",
        onSuccess: async () => {
          const methods = await getPaymentMethods();
          setPaymentMethods(methods);
          setPaymentLabel("");
          setPaymentLast4("");
          setPaymentExpiryMonth("");
          setPaymentExpiryYear("");
          setPaymentIsDefault(false);
        },
      }
    );
  };

  const onRemovePaymentMethod = async (methodId: string) => {
    await paymentSubmission.execute(
      async () => {
        await removePaymentMethod(methodId);
      },
      {
        successMessage: "Payment method removed.",
        errorMessage: "Unable to remove payment method.",
        onSuccess: async () => {
          const methods = await getPaymentMethods();
          setPaymentMethods(methods);
        },
      }
    );
  };

  const onSaveNotifications = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await notificationSubmission.execute(
      async () => {
        const updated = await updateNotificationPreferences(notificationPrefs);
        setNotificationPrefs({
          orderUpdates: updated.orderUpdates,
          promoEmails: updated.promoEmails,
          securityAlerts: updated.securityAlerts,
          wishlistAlerts: updated.wishlistAlerts,
        });
      },
      {
        successMessage: "Notification preferences saved.",
        errorMessage: "Unable to save notification preferences.",
      }
    );
  };

  const onLogout = async () => {
    await logoutUser();
    clearCart();
    clearWishlist();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Profile</p>
        <h1 className="font-heading text-5xl uppercase">My Account</h1>
      </header>

      {user ? (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="space-y-4 border border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Name</p>
            <p className="text-lg">{user.fullName}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Email</p>
            <p className="text-lg">{user.email}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Role</p>
            <p className="text-lg">{user.role}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Quick Access</p>
            <div className="mt-2 flex gap-3">
              <Link href="/account/orders" className="border border-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
                Orders
              </Link>
              <Link href="/cart" className="border border-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
                Cart
              </Link>
              <Link href="/wishlist" className="border border-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
                Wishlist
              </Link>
              <Link href="/account/reviews" className="border border-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
                Reviews
              </Link>
            </div>
          </article>

          <article className="space-y-4 border border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Security</p>
            <h2 className="font-heading text-3xl uppercase">Change Password</h2>
            <form className="space-y-2" onSubmit={onChangePassword}>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                className="h-11 w-full border border-zinc-300 px-3 text-sm"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                className="h-11 w-full border border-zinc-300 px-3 text-sm"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                className="h-11 w-full border border-zinc-300 px-3 text-sm"
                required
              />
              <button type="submit" disabled={passwordSubmission.isSubmitting} className="h-11 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
                {passwordSubmission.isSubmitting ? "Updating" : "Update Password"}
              </button>
            </form>
            {passwordSubmission.feedback ? (
              <p className={`text-xs ${passwordSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>{passwordSubmission.feedback}</p>
            ) : null}
          </article>

          <article className="space-y-4 border border-zinc-300 p-6 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payments & Credits</p>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onAddPaymentMethod}>
              <select className="h-11 border border-zinc-300 px-3 text-sm" value={paymentType} onChange={(event) => setPaymentType(event.target.value as UserPaymentType)}>
                <option value="CARD">Card</option>
                <option value="JAZZCASH">JazzCash</option>
                <option value="EASYPAISA">Easypaisa</option>
                <option value="BANK">Bank</option>
              </select>
              <input className="h-11 border border-zinc-300 px-3 text-sm" value={paymentLabel} onChange={(event) => setPaymentLabel(event.target.value)} placeholder="Label (e.g. Personal Visa)" required />
              <input className="h-11 border border-zinc-300 px-3 text-sm" value={paymentLast4} onChange={(event) => setPaymentLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Last 4 digits" required />
              <div className="grid grid-cols-2 gap-3">
                <input className="h-11 border border-zinc-300 px-3 text-sm" value={paymentExpiryMonth} onChange={(event) => setPaymentExpiryMonth(event.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="MM" />
                <input className="h-11 border border-zinc-300 px-3 text-sm" value={paymentExpiryYear} onChange={(event) => setPaymentExpiryYear(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="YYYY" />
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={paymentIsDefault} onChange={(event) => setPaymentIsDefault(event.target.checked)} />
                Set as default payment method
              </label>
              <button type="submit" disabled={paymentSubmission.isSubmitting} className="h-11 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50 md:col-span-2">
                {paymentSubmission.isSubmitting ? "Saving" : "Add Payment Method"}
              </button>
            </form>

            <div className="space-y-2 border border-zinc-200 p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Saved Methods</p>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-zinc-700">No saved methods yet.</p>
              ) : (
                paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between border-b border-zinc-200 py-2 text-sm">
                    <p>
                      {method.label} ({method.type}) •••• {method.last4} {method.isDefault ? "(Default)" : ""}
                    </p>
                    <button type="button" className="border border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.12em]" onClick={() => void onRemovePaymentMethod(method.id)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            {paymentSubmission.feedback ? <p className={`text-xs ${paymentSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>{paymentSubmission.feedback}</p> : null}
          </article>

          <article className="md:col-span-2">
            <OrderTrackerClient compact />
          </article>

          <article className="space-y-3 border border-zinc-300 p-6 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Account Management</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/account/orders" className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Orders</Link>
              <Link href="/cart" className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Cart</Link>
              <Link href="/wishlist" className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Wishlist</Link>
              <Link href="/offers" className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Offers</Link>
              <span className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Notification Preferences</span>
              <button type="button" onClick={() => void onLogout()} className="border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">Logout</button>
            </div>
            <form className="space-y-2 border border-zinc-200 p-4" onSubmit={onSaveNotifications}>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationPrefs.orderUpdates} onChange={(event) => setNotificationPrefs((current) => ({ ...current, orderUpdates: event.target.checked }))} /> Order updates</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationPrefs.promoEmails} onChange={(event) => setNotificationPrefs((current) => ({ ...current, promoEmails: event.target.checked }))} /> Promotional emails</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationPrefs.securityAlerts} onChange={(event) => setNotificationPrefs((current) => ({ ...current, securityAlerts: event.target.checked }))} /> Security alerts</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationPrefs.wishlistAlerts} onChange={(event) => setNotificationPrefs((current) => ({ ...current, wishlistAlerts: event.target.checked }))} /> Wishlist alerts</label>
              <button type="submit" disabled={notificationSubmission.isSubmitting} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
                {notificationSubmission.isSubmitting ? "Saving" : "Save Preferences"}
              </button>
            </form>
            {notificationSubmission.feedback ? <p className={`text-xs ${notificationSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>{notificationSubmission.feedback}</p> : null}
          </article>
        </section>
      ) : (
        <section className="border border-zinc-300 p-6">
          <p className="text-sm text-zinc-700">Unable to load your account session. Please sign in again.</p>
          <Link href="/login" className="mt-4 inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Go to Login
          </Link>
        </section>
      )}
    </main>
  );
}
