"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBrand,
  createBrandAccountInvite,
  deleteBrand,
  getAdminBrands,
  updateBrand,
} from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";
import { useToastStore } from "@/stores/toast-store";
import type { Brand } from "@/types/marketplace";

type BrandFormState = {
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  verified: boolean;
  contactEmail: string;
  whatsappNumber: string;
};

const defaultBrandForm: BrandFormState = {
  name: "",
  slug: "",
  logoUrl: "",
  description: "",
  verified: true,
  contactEmail: "",
  whatsappNumber: "",
};

function toBrandFormState(brand: Brand): BrandFormState {
  return {
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl || "",
    description: brand.description || "",
    verified: brand.verified,
    contactEmail: brand.contactEmail || "",
    whatsappNumber: brand.whatsappNumber || "",
  };
}

function getInviteStorageKey(brandId: string) {
  return `broady-admin-brand-invite:${brandId}`;
}

export function BrandsAdminClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const brandSubmission = useFormSubmission();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState<BrandFormState>(defaultBrandForm);
  const [inviteUrlByBrandId, setInviteUrlByBrandId] = useState<Record<string, string>>({});
  const [invitingBrandId, setInvitingBrandId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextBrands = await getAdminBrands();
      setBrands(nextBrands);

      const invites: Record<string, string> = {};
      for (const brand of nextBrands) {
        const stored = window.localStorage.getItem(getInviteStorageKey(brand.id));
        if (stored) {
          invites[brand.id] = stored;
        }
      }
      setInviteUrlByBrandId(invites);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load brands";
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(
    () => ({
      brands: brands.length,
      verified: brands.filter((item) => item.verified).length,
      withContacts: brands.filter((item) => item.contactEmail || item.whatsappNumber).length,
    }),
    [brands],
  );

  const handleBrandSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await brandSubmission.execute(async () => {
      const payload = {
        name: brandForm.name.trim(),
        slug: brandForm.slug.trim(),
        logoUrl: brandForm.logoUrl.trim() || undefined,
        description: brandForm.description.trim() || undefined,
        verified: brandForm.verified,
        contactEmail: brandForm.contactEmail.trim() || undefined,
        whatsappNumber: brandForm.whatsappNumber.trim() || undefined,
      };

      if (editingBrandId) {
        await updateBrand(editingBrandId, payload);
        pushToast("Brand updated", "success");
      } else {
        const result = await createBrand(payload);
        const createdBrandId = result.brand.id;
        if (result.inviteUrl) {
          window.localStorage.setItem(getInviteStorageKey(createdBrandId), result.inviteUrl);
          setInviteUrlByBrandId((current) => ({ ...current, [createdBrandId]: result.inviteUrl }));
        }
        pushToast("Brand created", "success");
      }

      setEditingBrandId(null);
      setBrandForm(defaultBrandForm);
      await loadData();
    }, {
      errorMessage: "Unable to save brand",
      onError: (_error, message) => {
        pushToast(message, "error");
      },
    });
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!window.confirm(`Delete brand ${brand.name}?`)) return;

    try {
      await deleteBrand(brand.id);
      window.localStorage.removeItem(getInviteStorageKey(brand.id));
      setInviteUrlByBrandId((current) => {
        const next = { ...current };
        delete next[brand.id];
        return next;
      });
      pushToast("Brand deleted", "success");
      if (editingBrandId === brand.id) {
        setEditingBrandId(null);
        setBrandForm(defaultBrandForm);
      }
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete brand";
      pushToast(message, "error");
    }
  };

  const handleGenerateInvite = async (brand: Brand) => {
    setInvitingBrandId(brand.id);
    try {
      const result = await createBrandAccountInvite(brand.id, {
        contactEmail: brand.contactEmail || undefined,
      });
      window.localStorage.setItem(getInviteStorageKey(brand.id), result.inviteUrl);
      setInviteUrlByBrandId((current) => ({ ...current, [brand.id]: result.inviteUrl }));
      pushToast("Invite link generated", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate invite link";
      pushToast(message, "error");
    } finally {
      setInvitingBrandId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brands</p>
          <p className="mt-3 font-heading text-4xl">{totals.brands}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Verified</p>
          <p className="mt-3 font-heading text-4xl">{totals.verified}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">With Notification Contacts</p>
          <p className="mt-3 font-heading text-4xl">{totals.withContacts}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form className="space-y-3 border border-zinc-300 p-4" onSubmit={handleBrandSubmit}>
          <h2 className="font-heading text-3xl uppercase">{editingBrandId ? "Edit Brand" : "Create Brand"}</h2>
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Brand name"
            value={brandForm.name}
            onChange={(event) => setBrandForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Slug"
            value={brandForm.slug}
            onChange={(event) => setBrandForm((current) => ({ ...current, slug: event.target.value }))}
            required
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Logo URL"
            value={brandForm.logoUrl}
            onChange={(event) => setBrandForm((current) => ({ ...current, logoUrl: event.target.value }))}
          />
          <textarea
            className="min-h-20 w-full border border-zinc-300 p-3"
            placeholder="Description"
            value={brandForm.description}
            onChange={(event) => setBrandForm((current) => ({ ...current, description: event.target.value }))}
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Order notification email"
            type="email"
            value={brandForm.contactEmail}
            onChange={(event) => setBrandForm((current) => ({ ...current, contactEmail: event.target.value }))}
          />
          <input
            className="h-10 w-full border border-zinc-300 px-3"
            placeholder="Order notification WhatsApp"
            value={brandForm.whatsappNumber}
            onChange={(event) => setBrandForm((current) => ({ ...current, whatsappNumber: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={brandForm.verified}
              onChange={(event) => setBrandForm((current) => ({ ...current, verified: event.target.checked }))}
            />
            Verified brand
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={brandSubmission.isSubmitting} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
              {brandSubmission.isSubmitting ? "Saving" : editingBrandId ? "Update Brand" : "Create Brand"}
            </button>
            {editingBrandId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingBrandId(null);
                  setBrandForm(defaultBrandForm);
                }}
                className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Brands</h2>
          {isLoading ? <p className="text-sm text-zinc-600">Loading brands...</p> : null}
          <div className="space-y-3">
            {brands.map((brand) => {
              const inviteUrl = inviteUrlByBrandId[brand.id];
              return (
                <article key={brand.id} className="space-y-3 border border-zinc-200 p-3">
                  <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-center">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em]">{brand.name}</p>
                      <p className="text-xs text-zinc-600">{brand.slug}</p>
                      <p className="mt-1 text-xs text-zinc-600">{brand.description || "No description provided"}</p>
                    </div>
                    <div className="space-y-1 text-xs text-zinc-700">
                      <p>Verified: {brand.verified ? "Yes" : "No"}</p>
                      <p>Email: {brand.contactEmail || "-"}</p>
                      <p>WhatsApp: {brand.whatsappNumber || "-"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBrandId(brand.id);
                          setBrandForm(toBrandFormState(brand));
                        }}
                        className="border border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.12em]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBrand(brand)}
                        className="border border-black bg-black px-3 py-1 text-xs uppercase tracking-[0.12em] text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-zinc-200 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateInvite(brand)}
                        disabled={invitingBrandId === brand.id}
                        className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        {invitingBrandId === brand.id ? "Generating" : "Generate Invite Link"}
                      </button>
                      {inviteUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(inviteUrl);
                            pushToast("Invite link copied", "success");
                          }}
                          className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
                        >
                          Copy Link
                        </button>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Stored invite link</p>
                    <p className="break-all text-xs text-zinc-700">{inviteUrl || "No invite link stored yet"}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
