"use client";

import { create } from "zustand";
import type { User } from "@/types/marketplace";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (value: boolean) => void;
  setInitialized: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  setUser: (user) => set({ user }),
  setLoading: (value) => set({ isLoading: value }),
  setInitialized: (value) => set({ isInitialized: value }),
}));
