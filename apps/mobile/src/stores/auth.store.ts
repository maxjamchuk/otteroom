import { create } from "zustand";
import { supabase } from "@/services/supabase";

export interface AuthState {
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Check if session exists
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        set({ userId: session.user.id, isLoading: false });
      } else {
        // Sign in anonymously
        const { data: { user }, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;

        set({ userId: user?.id || null, isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Authentication failed",
        isLoading: false,
      });
    }
  },

  signInAnonymously: async () => {
    try {
      set({ isLoading: true, error: null });

      const { data: { user }, error } = await supabase.auth.signInAnonymously();

      if (error) throw error;

      set({ userId: user?.id || null, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Sign in failed",
        isLoading: false,
      });
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({ userId: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Sign out failed",
      });
    }
  },
}));
