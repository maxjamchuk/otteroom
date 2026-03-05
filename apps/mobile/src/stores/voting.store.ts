import { create } from "zustand";
import { supabase } from "@/services/supabase";

export interface Match {
  room_id: string;
  movie_id: number;
  created_at: string;
}

export interface VotingState {
  currentMovie: { id: number; title: string; overview: string; posterPath: string } | null;
  isVoting: boolean;
  isLoading: boolean;
  error: string | null;
  match: Match | null;

  castVote: (roomId: string, movieId: number, vote: 1 | -1) => Promise<void>;
  subscribeToMatch: (roomId: string) => () => void;
  clearVoting: () => void;
}

export const useVotingStore = create<VotingState>((set) => ({
  currentMovie: null,
  isVoting: false,
  isLoading: false,
  error: null,
  match: null,

  castVote: async (roomId: string, movieId: number, vote: 1 | -1) => {
    try {
      set({ isVoting: true, error: null });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/vote`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room_id: roomId, movie_id: movieId, vote }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cast vote");
      }

      const result = await response.json();

      if (result.match) {
        set({ match: result.match, isVoting: false });
      } else {
        set({ isVoting: false });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to cast vote";
      set({ error: errorMsg, isVoting: false });
      throw error;
    }
  },

  subscribeToMatch: (roomId: string) => {
    const subscription = supabase
      .from(`matches:room_id=eq.${roomId}`)
      .on("*", (payload) => {
        if (payload.new) {
          set({ match: payload.new as Match });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  clearVoting: () => {
    set({ currentMovie: null, match: null, error: null });
  },
}));
