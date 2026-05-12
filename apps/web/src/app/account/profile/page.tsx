"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { updateUserProfile } from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const profileSubmission = useFormSubmission();

  useEffect(() => {
    setMounted(true);
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await profileSubmission.execute(
      async () => {
        const updatedUser = await updateUserProfile({ fullName, email });
        setUser(updatedUser);
      },
      {
        successMessage: "Profile updated successfully.",
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Profile</p>
        <h1 className="font-heading text-4xl uppercase">Profile Information</h1>
        <p className="text-sm text-zinc-600">View and update your personal details.</p>
      </header>

      {mounted && user ? (
        <section className="space-y-6 border border-zinc-300 p-8 max-w-2xl bg-white shadow-sm">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Full Name</label>
                  <input 
                    className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none transition-colors" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Email Address</label>
                  <input 
                    type="email"
                    className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none transition-colors" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4 border-t border-zinc-100">
                <button 
                  type="submit" 
                  disabled={profileSubmission.isSubmitting}
                  className="h-12 flex-1 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {profileSubmission.isSubmitting ? "Saving..." : "Save Changes"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)}
                  className="h-12 flex-1 border border-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {profileSubmission.feedback && (
                <p className={`text-xs ${profileSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>
                  {profileSubmission.feedback}
                </p>
              )}
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Full Name</p>
                  <p className="text-lg font-medium mt-1">{user.fullName}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Email Address</p>
                  <p className="text-lg font-medium mt-1">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Account Role</p>
                  <p className="text-lg font-medium mt-1 uppercase text-zinc-600">{user.role}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Member Since</p>
                  <p className="text-lg font-medium mt-1">October 2023</p>
                </div>
              </div>
              
              <div className="pt-6 border-t border-zinc-100">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="h-12 px-10 border border-black bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                >
                  Edit Profile
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="py-20 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full mb-4" />
          <p className="text-sm text-zinc-500 uppercase tracking-widest">Loading profile...</p>
        </div>
      )}
    </main>
  );
}
