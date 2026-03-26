import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/marketplace";

type WishlistState = {
  items: Product[];
  setItems: (items: Product[]) => void;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
  clear: () => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      setItems: (items) => set({ items }),
      addItem: (product) =>
        set((state) => {
          if (state.items.some((item) => item.id === product.id)) {
            return state;
          }
          return { items: [...state.items, product] };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
        })),
      toggleWishlist: (product) =>
        set((state) => {
          const exists = state.items.some((item) => item.id === product.id);
          return {
            items: exists
              ? state.items.filter((item) => item.id !== product.id)
              : [...state.items, product],
          };
        }),
      isInWishlist: (productId) => get().items.some((item) => item.id === productId),
      clear: () => set({ items: [] }),
    }),
    { name: "broady-wishlist" },
  ),
);
