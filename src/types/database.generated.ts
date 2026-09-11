export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      movie_candidates: {
        Row: {
          id: string
          poster_key: string
          release_year: number
          sort_order: number
          title: string
        }
        Insert: {
          id: string
          poster_key: string
          release_year: number
          sort_order: number
          title: string
        }
        Update: {
          id?: string
          poster_key?: string
          release_year?: number
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      participant_filters: {
        Row: {
          genres: Database["public"]["Enums"]["participant_genre"][]
          release_year_from: number
          release_year_to: number
          room_member_id: string
        }
        Insert: {
          genres?: Database["public"]["Enums"]["participant_genre"][]
          release_year_from: number
          release_year_to: number
          room_member_id: string
        }
        Update: {
          genres?: Database["public"]["Enums"]["participant_genre"][]
          release_year_from?: number
          release_year_to?: number
          room_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_filters_room_member_id_fkey"
            columns: ["room_member_id"]
            isOneToOne: true
            referencedRelation: "room_members"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          is_voter: boolean
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_voter: boolean
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_voter?: boolean
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          creation_request_id: string
          creator_user_id: string
          filter_completed_count: number
          filter_resolution_status: Database["public"]["Enums"]["filter_resolution_status"]
          id: string
          movie_candidate_id: string | null
          required_voter_count: number
          state: string
          updated_at: string
          voter_count: number
        }
        Insert: {
          code: string
          created_at?: string
          creation_request_id: string
          creator_user_id: string
          filter_completed_count?: number
          filter_resolution_status?: Database["public"]["Enums"]["filter_resolution_status"]
          id?: string
          movie_candidate_id?: string | null
          required_voter_count?: number
          state?: string
          updated_at?: string
          voter_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          creation_request_id?: string
          creator_user_id?: string
          filter_completed_count?: number
          filter_resolution_status?: Database["public"]["Enums"]["filter_resolution_status"]
          id?: string
          movie_candidate_id?: string | null
          required_voter_count?: number
          state?: string
          updated_at?: string
          voter_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_movie_candidate_id_fkey"
            columns: ["movie_candidate_id"]
            isOneToOne: false
            referencedRelation: "movie_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_room: {
        Args: {
          p_creation_request_id: string
          p_creator_is_voter: boolean
          p_required_voter_count: number
        }
        Returns: {
          filter_completed_count: number
          filter_resolution_status: Database["public"]["Enums"]["filter_resolution_status"]
          is_creator: boolean
          is_voter: boolean
          outcome: string
          required_voter_count: number
          room_code: string
          room_id: string
          room_state: string
          voter_count: number
        }[]
      }
      ensure_room_candidate: {
        Args: { p_room_id: string }
        Returns: {
          candidate_id: string
          outcome: string
          poster_key: string
          release_year: number
          title: string
        }[]
      }
      get_my_participant_filter: {
        Args: { p_room_id: string }
        Returns: {
          allowed_release_year_max: number
          filter_completed_count: number
          genres: Database["public"]["Enums"]["participant_genre"][]
          outcome: string
          release_year_from: number
          release_year_to: number
          required_voter_count: number
        }[]
      }
      join_room: {
        Args: { p_room_code: string }
        Returns: {
          filter_completed_count: number
          filter_resolution_status: Database["public"]["Enums"]["filter_resolution_status"]
          is_creator: boolean
          is_voter: boolean
          outcome: string
          required_voter_count: number
          room_code: string
          room_id: string
          room_state: string
          voter_count: number
        }[]
      }
      resolve_common_filters: {
        Args: { p_room_id: string }
        Returns: {
          filter_resolution_status: Database["public"]["Enums"]["filter_resolution_status"]
          outcome: string
        }[]
      }
      submit_my_participant_filter: {
        Args: {
          p_genres: Database["public"]["Enums"]["participant_genre"][]
          p_release_year_from: number
          p_release_year_to: number
          p_room_id: string
        }
        Returns: {
          allowed_release_year_max: number
          filter_completed_count: number
          genres: Database["public"]["Enums"]["participant_genre"][]
          outcome: string
          release_year_from: number
          release_year_to: number
          required_voter_count: number
        }[]
      }
    }
    Enums: {
      filter_resolution_status: "pending" | "compatible" | "incompatible"
      participant_genre:
        | "action"
        | "adventure"
        | "animation"
        | "comedy"
        | "crime"
        | "documentary"
        | "drama"
        | "family"
        | "fantasy"
        | "history"
        | "horror"
        | "music"
        | "mystery"
        | "romance"
        | "science_fiction"
        | "tv_movie"
        | "thriller"
        | "war"
        | "western"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      filter_resolution_status: ["pending", "compatible", "incompatible"],
      participant_genre: [
        "action",
        "adventure",
        "animation",
        "comedy",
        "crime",
        "documentary",
        "drama",
        "family",
        "fantasy",
        "history",
        "horror",
        "music",
        "mystery",
        "romance",
        "science_fiction",
        "tv_movie",
        "thriller",
        "war",
        "western",
      ],
    },
  },
} as const

