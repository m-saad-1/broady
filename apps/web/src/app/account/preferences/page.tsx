"use client";

import { FormEvent, useEffect, useState } from "react";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";
import type { NotificationPreference } from "@/types/marketplace";

export default function PreferencesPage() {
  const [notificationPrefs, setNotificationPrefs] = useState<Omit<NotificationPreference, "id" | "userId">>({
    orderUpdates: true,
    promoEmails: false,
    securityAlerts: true,
    wishlistAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const notificationSubmission = useFormSubmission();

  useEffect(() => {
    let active = true;
    getNotificationPreferences().then((preferences) => {
      if (active) {
        setNotificationPrefs({
          orderUpdates: preferences.orderUpdates,
          promoEmails: preferences.promoEmails,
          securityAlerts: preferences.securityAlerts,
          wishlistAlerts: preferences.wishlistAlerts,
        });
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

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
        successMessage: "Preferences saved successfully.",
      }
    );
  };

  const togglePref = (key: keyof typeof notificationPrefs) => {
    setNotificationPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full mb-4" />
        <p className="text-sm text-zinc-500 uppercase tracking-widest">Loading preferences...</p>
      </div>
    );
  }

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Preferences</p>
        <h1 className="font-heading text-4xl uppercase">Account Preferences</h1>
        <p className="text-sm text-zinc-600">Control how we communicate with you and manage your experience.</p>
      </header>

      <section className="max-w-2xl">
        <form onSubmit={onSaveNotifications} className="space-y-8">
          <div className="space-y-6">
            <h2 className="font-heading text-2xl uppercase tracking-tight">Email Notifications</h2>
            
            <div className="grid gap-4">
              {[
                { id: 'orderUpdates', title: 'Order Updates', desc: 'Get real-time updates on your order status and shipping.' },
                { id: 'promoEmails', title: 'Promotions & News', desc: 'Receive updates on new collections and exclusive offers.' },
                { id: 'securityAlerts', title: 'Security Alerts', desc: 'Get notified about important account security changes.' },
                { id: 'wishlistAlerts', title: 'Wishlist Alerts', desc: 'Notifications when your saved items are on sale or restocked.' }
              ].map((pref) => (
                <div 
                  key={pref.id}
                  onClick={() => togglePref(pref.id as keyof typeof notificationPrefs)}
                  className="group flex items-start justify-between p-4 border border-zinc-200 hover:border-black cursor-pointer transition-all bg-white shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-sm uppercase tracking-wider">{pref.title}</p>
                    <p className="text-xs text-zinc-500">{pref.desc}</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full relative transition-colors ${notificationPrefs[pref.id as keyof typeof notificationPrefs] ? 'bg-black' : 'bg-zinc-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notificationPrefs[pref.id as keyof typeof notificationPrefs] ? 'left-7' : 'left-1'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-zinc-200">
            <h2 className="font-heading text-2xl uppercase tracking-tight">Display Preferences</h2>
            <div className="p-4 border border-zinc-200 bg-zinc-50/50">
              <p className="text-sm font-semibold uppercase tracking-wider mb-2">Language</p>
              <select className="h-11 w-full max-w-xs border border-zinc-300 bg-white px-3 text-sm focus:border-black outline-none" defaultValue="en">
                <option value="en">English (US)</option>
                <option value="uk">English (UK)</option>
                <option value="ur">Urdu (Coming Soon)</option>
              </select>
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4">
            <button 
              type="submit" 
              disabled={notificationSubmission.isSubmitting}
              className="h-12 w-full md:w-auto px-12 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {notificationSubmission.isSubmitting ? "Saving..." : "Save All Preferences"}
            </button>
            {notificationSubmission.feedback && (
              <p className={`text-sm font-medium ${notificationSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>
                {notificationSubmission.feedback}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
