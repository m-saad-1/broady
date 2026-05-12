"use client";

import { FormEvent, useEffect, useState } from "react";
import { addUserAddress, getUserAddresses, removeUserAddress, updateUserAddress } from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";
import type { UserAddress } from "@/types/marketplace";

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [isDefault, setIsDefault] = useState(false);

  const addressSubmission = useFormSubmission();

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const data = await getUserAddresses();
      setAddresses(data || []);
    } catch (error) {
      console.error("Failed to load addresses", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const resetForm = () => {
    setLabel("");
    setFullName("");
    setPhone("");
    setAddressLine1("");
    setCity("");
    setCountry("Pakistan");
    setIsDefault(false);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (address: UserAddress) => {
    setEditingId(address.id);
    setLabel(address.label);
    setFullName(address.fullName);
    setPhone(address.phone);
    setAddressLine1(address.addressLine1);
    setCity(address.city);
    setCountry(address.country);
    setIsDefault(address.isDefault);
    setIsAdding(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await addressSubmission.execute(
      async () => {
        const payload = { label, fullName, phone, addressLine1, city, country, isDefault };
        if (editingId) {
          await updateUserAddress(editingId, payload);
        } else {
          await addUserAddress(payload);
        }
      },
      {
        successMessage: editingId ? "Address updated." : "Address added.",
        onSuccess: () => {
          resetForm();
          void loadAddresses();
        },
      }
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await removeUserAddress(id);
      void loadAddresses();
    } catch (error) {
      console.error("Failed to delete address", error);
    }
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Addresses</p>
        <h1 className="font-heading text-4xl uppercase">Saved Addresses</h1>
        <p className="text-sm text-zinc-600">Manage your shipping addresses for a faster checkout experience.</p>
      </header>

      {isAdding ? (
        <section className="space-y-4 border border-zinc-300 p-6 max-w-2xl bg-zinc-50">
          <h2 className="font-heading text-2xl uppercase">{editingId ? "Edit Address" : "Add New Address"}</h2>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Address Label (e.g., Home, Office)</label>
              <input className="h-11 w-full border border-zinc-300 px-3 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
              <input className="h-11 w-full border border-zinc-300 px-3 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Phone Number</label>
              <input className="h-11 w-full border border-zinc-300 px-3 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Street Address</label>
              <input className="h-11 w-full border border-zinc-300 px-3 text-sm" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">City</label>
              <input className="h-11 w-full border border-zinc-300 px-3 text-sm" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Country</label>
              <input className="h-11 w-full border border-zinc-300 px-3 text-sm bg-zinc-100" value={country} readOnly />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default address
            </label>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={addressSubmission.isSubmitting} className="h-11 flex-1 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
                {addressSubmission.isSubmitting ? "Saving..." : editingId ? "Update Address" : "Save Address"}
              </button>
              <button type="button" onClick={resetForm} className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] border border-zinc-300">
                Cancel
              </button>
            </div>
          </form>
          {addressSubmission.feedback && (
            <p className={`text-xs mt-2 ${addressSubmission.feedbackTone === "error" ? "text-red-600" : "text-emerald-700"}`}>
              {addressSubmission.feedback}
            </p>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <button onClick={() => setIsAdding(true)} className="h-11 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Add New Address
          </button>

          {loading ? (
            <div className="py-10 text-center text-zinc-500">Loading addresses...</div>
          ) : !addresses || addresses.length === 0 ? (
            <div className="border border-zinc-300 p-12 text-center bg-zinc-50">
              <p className="text-sm text-zinc-600">You have not saved any addresses yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {addresses.map((address) => (
                <div key={address.id} className={`border p-6 space-y-3 relative ${address.isDefault ? "border-black bg-zinc-50" : "border-zinc-300"}`}>
                  {address.isDefault && (
                    <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-200">Default</span>
                  )}
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{address.label}</p>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{address.fullName}</p>
                    <p className="text-sm text-zinc-600">{address.addressLine1}</p>
                    <p className="text-sm text-zinc-600">{address.city}, {address.country}</p>
                    <p className="text-sm text-zinc-600">{address.phone}</p>
                  </div>
                  <div className="flex gap-4 pt-2 border-t border-zinc-200">
                    <button onClick={() => handleEdit(address)} className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-black transition-colors">Edit</button>
                    <button onClick={() => void handleDelete(address.id)} className="text-[11px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors">Delete</button>
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
