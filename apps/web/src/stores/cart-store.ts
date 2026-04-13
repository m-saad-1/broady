import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/marketplace";

type CartState = {
  items: { product: Product; quantity: number; selectedColor?: string; selectedSize?: string }[];
  setItems: (items: { product: Product; quantity: number; selectedColor?: string; selectedSize?: string }[]) => void;
  addToCart: (product: Product, options?: { selectedColor?: string; selectedSize?: string }) => void;
  removeFromCart: (productId: string, options?: { selectedColor?: string; selectedSize?: string }) => void;
  removeByKeys: (keys: string[]) => void;
  updateQuantity: (productId: string, quantity: number, options?: { selectedColor?: string; selectedSize?: string }) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      setItems: (items) => set({ items }),
      addToCart: (product, options) =>
        set((state) => {
          const existing = state.items.find(
            (item) =>
              item.product.id === product.id &&
              item.selectedColor === options?.selectedColor &&
              item.selectedSize === options?.selectedSize,
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id &&
                item.selectedColor === options?.selectedColor &&
                item.selectedSize === options?.selectedSize
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                product,
                quantity: 1,
                selectedColor: options?.selectedColor,
                selectedSize: options?.selectedSize,
              },
            ],
          };
        }),
      removeFromCart: (productId, options) =>
        set((state) => ({
          items: state.items.filter(
            (item) =>
              !(
                item.product.id === productId &&
                (options?.selectedColor ? item.selectedColor === options.selectedColor : true) &&
                (options?.selectedSize ? item.selectedSize === options.selectedSize : true)
              ),
          ),
        })),
      removeByKeys: (keys) =>
        set((state) => ({
          items: state.items.filter(
            (item) => !keys.includes(`${item.product.id}:${item.selectedSize || ""}:${item.selectedColor || ""}`),
          ),
        })),
      updateQuantity: (productId, quantity, options) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId &&
            (options?.selectedColor ? item.selectedColor === options.selectedColor : true) &&
            (options?.selectedSize ? item.selectedSize === options.selectedSize : true)
              ? { ...item, quantity: Math.max(1, quantity) }
              : item,
          ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    { name: "broady-cart" },
  ),
);
