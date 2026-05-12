"use client";

import { useState } from "react";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Support</p>
        <h1 className="font-heading text-4xl uppercase">Customer Support</h1>
        <p className="text-sm text-zinc-600">How can we help you today?</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_350px] items-start">
        <section className="border border-zinc-300 p-8 bg-white shadow-sm">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-2xl uppercase">Message Sent</h2>
              <p className="text-sm text-zinc-600 max-w-xs mx-auto">Thank you for reaching out. Our support team will get back to you via email within 24 hours.</p>
              <button 
                onClick={() => setSubmitted(false)}
                className="mt-6 text-xs font-bold uppercase tracking-widest underline underline-offset-4"
              >
                Send another message
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-2xl uppercase mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Subject</label>
                  <select 
                    className="h-12 w-full border border-zinc-300 px-4 text-sm focus:border-black outline-none"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  >
                    <option value="">Select a topic</option>
                    <option value="order">Order Inquiry</option>
                    <option value="return">Return or Refund</option>
                    <option value="account">Account Access</option>
                    <option value="product">Product Information</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Message</label>
                  <textarea 
                    className="min-h-[160px] w-full border border-zinc-300 p-4 text-sm focus:border-black outline-none resize-none" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Describe your issue in detail..."
                    required 
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="h-12 w-full md:w-auto px-12 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-md active:scale-95"
                  >
                    Send Message
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <aside className="space-y-6">
          <div className="border border-zinc-300 p-6 bg-zinc-50/50">
            <h3 className="font-heading text-lg uppercase mb-4">Direct Contact</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email</p>
                <p className="text-sm font-medium">support@broady.local</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">WhatsApp</p>
                <p className="text-sm font-medium">+92 300 1234567</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Hours</p>
                <p className="text-sm font-medium">Mon - Sat: 10AM - 8PM</p>
              </div>
            </div>
          </div>
          
          <div className="border border-zinc-300 p-6">
            <h3 className="font-heading text-lg uppercase mb-4">FAQ</h3>
            <p className="text-xs text-zinc-600 mb-4">Quick answers to common questions about shipping, returns, and sizing.</p>
            <button className="text-[10px] font-bold uppercase tracking-widest underline underline-offset-4">Visit FAQ Center</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
