import { create } from "zustand";
import { supabase } from "@/services/supabase";

export interface Room {
  id: string;
  code: string;
  status: "lobby" | "voting" | "matched" | "closed";
  language: string;
  region: string | null;
  max_members: number;
  current_idx: number;
  current_movie_id: number | null;
  created_at: string;
}

export interface RoomState {
  room: Room | null;
  isLoading: boolean;
  error: string | null;
  preferences: { genres: number[] } | null;
  
  createRoom: (language: string, region?: string) => Promise<Room>;
  joinRoom: (code: string) => Promise<Room>;
  setPreferences: (roomId: string, genres: number[]) => Promise<void>;
  subscribeToRoom: (roomId: string) => () => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  isLoading: false,
  error: null,
  preferences: null,

  createRoom: async (language: string, region?: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-room`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language, region }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create room");
      }

      const room = await response.json();
      set({ room, isLoading: false });
      return room;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create room";
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  joinRoom: async (code: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-room`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to join room");
      }

      const { room_id, status } = await response.json();

      // Fetch full room details
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", room_id).single();

      if (!roomData) throw new Error("Room not found");

      set({ room: roomData, isLoading: false });
      return roomData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to join room";
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  setPreferences: async (roomId: string, genres: number[]) => {
    try {
      set({ isLoading: true, error: null });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/set-preferences`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room_id: roomId, preferences: { genres } }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to set preferences");
      }

      const result = await response.json();

      set({ preferences: { genres }, isLoading: false });

      // Update room if seeding happened
      if (result.seeded) {
        const { data: updatedRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        if (updatedRoom) {
          set({ room: updatedRoom });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to set preferences";
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  subscribeToRoom: (roomId: string) => {
    const subscription = supabase
      .from(`rooms:id=eq.${roomId}`)
      .on("*", (payload) => {
        if (payload.new) {
          set({ room: payload.new as Room });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  clearRoom: () => {
    set({ room: null, preferences: null, error: null });
  },
}));
