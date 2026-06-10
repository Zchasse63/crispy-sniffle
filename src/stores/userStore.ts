"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

interface UserState {
  user: User | null;
  /** True until the first onAuthStateChange fires (avoids signed-out flash). */
  isLoading: boolean;
  /** Merge-on-signin must run once per session, not per tab focus. */
  dataMerged: boolean;
  setUser: (u: User | null) => void;
  setLoading: (v: boolean) => void;
  setDataMerged: (v: boolean) => void;
}

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  isLoading: true,
  dataMerged: false,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setDataMerged: (dataMerged) => set({ dataMerged }),
}));
