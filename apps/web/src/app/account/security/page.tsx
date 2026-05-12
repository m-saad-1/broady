"use client";

import { FormEvent, useState } from "react";
import { updatePassword } from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const passwordSubmission = useFormSubmission();

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    passwordSubmission.clearFeedback();

    if (newPassword !== confirmPassword) {
      passwordSubmission.setErrorFeedback("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      passwordSubmission.setErrorFeedback("Password must be at least 8 characters.");
      return;
    }

    await passwordSubmission.execute(
      async () => {
        await updatePassword({ currentPassword, newPassword });
      },
      {
        successMessage: "Password updated successfully.",
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      }
    );
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Security</p>
        <h1 className="font-heading text-4xl uppercase">Account Security</h1>
        <p className="text-sm text-zinc-600">Manage your password and protect your account.</p>
      </header>

      <section className="border border-zinc-300 p-8 max-w-xl bg-white shadow-sm">
        <h2 className="font-heading text-2xl uppercase mb-6">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Current Password</label>
            <input 
              type="password"
              className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">New Password</label>
              <input 
                type="password"
                className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Confirm New Password</label>
              <input 
                type="password"
                className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>
          </div>
          
          <div className="pt-4 flex flex-col gap-4">
            <button 
              type="submit" 
              disabled={passwordSubmission.isSubmitting}
              className="h-12 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {passwordSubmission.isSubmitting ? "Updating Password..." : "Update Password"}
            </button>
            {passwordSubmission.feedback && (
              <p className={`text-sm font-medium ${passwordSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>
                {passwordSubmission.feedback}
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="border border-red-100 p-8 max-w-xl bg-red-50/30">
        <h2 className="font-heading text-2xl uppercase text-red-900 mb-2">Delete Account</h2>
        <p className="text-sm text-red-700 mb-6">Permanently delete your account and all your data. This action cannot be undone.</p>
        <button className="h-11 px-8 border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
          Request Account Deletion
        </button>
      </section>
    </main>
  );
}
