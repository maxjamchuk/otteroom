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
      candidate_decisions: {
        Row: {
          accepted_at: string
          candidate_occurrence_id: string
          decision: Database["public"]["Enums"]["candidate_decision_value"]
          room_id: string
          room_member_id: string
        }
        Insert: {
          accepted_at?: string
          candidate_occurrence_id: string
          decision: Database["public"]["Enums"]["candidate_decision_value"]
          room_id: string
          room_member_id: string
        }
        Update: {
          accepted_at?: string
          candidate_occurrence_id?: string
          decision?: Database["public"]["Enums"]["candidate_decision_value"]
          room_id?: string
          room_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_decisions_occurrence_same_room_fkey"
            columns: ["room_id", "candidate_occurrence_id"]
            isOneToOne: false
            referencedRelation: "room_candidate_occurrences"
            referencedColumns: ["room_id", "id"]
          },
          {
            foreignKeyName: "candidate_decisions_room_member_same_room_fkey"
            columns: ["room_id", "room_member_id"]
            isOneToOne: false
            referencedRelation: "room_members"
            referencedColumns: ["room_id", "id"]
          },
        ]
      }
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
      room_candidate_occurrences: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          room_id: string
          sequence: number
          status: Database["public"]["Enums"]["candidate_occurrence_status"]
          tmdb_movie_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          room_id: string
          sequence: number
          status?: Database["public"]["Enums"]["candidate_occurrence_status"]
          tmdb_movie_id: number
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          room_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["candidate_occurrence_status"]
          tmdb_movie_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_candidate_occurrences_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
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
          candidate_acquisition_status: Database["public"]["Enums"]["candidate_acquisition_status"]
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          code: string
          created_at: string
          creation_request_id: string
          creator_user_id: string
          decision_completed_count: number
          filter_completed_count: number
          filter_resolution_status: Database["public"]["Enums"]["filter_resolution_status"]
          id: string
          movie_candidate_id: string | null
          required_voter_count: number
          state: string
          tmdb_movie_id: number | null
          updated_at: string
          voter_count: number
        }
        Insert: {
          candidate_acquisition_status?: Database["public"]["Enums"]["candidate_acquisition_status"]
          candidate_progression_status?: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence?: number
          code: string
          created_at?: string
          creation_request_id: string
          creator_user_id: string
          decision_completed_count?: number
          filter_completed_count?: number
          filter_resolution_status?: Database["public"]["Enums"]["filter_resolution_status"]
          id?: string
          movie_candidate_id?: string | null
          required_voter_count?: number
          state?: string
          tmdb_movie_id?: number | null
          updated_at?: string
          voter_count?: number
        }
        Update: {
          candidate_acquisition_status?: Database["public"]["Enums"]["candidate_acquisition_status"]
          candidate_progression_status?: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence?: number
          code?: string
          created_at?: string
          creation_request_id?: string
          creator_user_id?: string
          decision_completed_count?: number
          filter_completed_count?: number
          filter_resolution_status?: Database["public"]["Enums"]["filter_resolution_status"]
          id?: string
          movie_candidate_id?: string | null
          required_voter_count?: number
          state?: string
          tmdb_movie_id?: number | null
          updated_at?: string
          voter_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_current_candidate_occurrence_fkey"
            columns: ["id", "candidate_sequence", "tmdb_movie_id"]
            isOneToOne: false
            referencedRelation: "room_candidate_occurrences"
            referencedColumns: ["room_id", "sequence", "tmdb_movie_id"]
          },
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
      commit_room_tmdb_candidate: {
        Args: {
          p_actor_user_id: string
          p_adult: boolean
          p_expected_candidate_sequence: number
          p_release_year: number
          p_room_id: string
          p_tmdb_genre_ids: number[]
          p_tmdb_movie_id: number
          p_vote_average: number
          p_vote_count: number
        }
        Returns: {
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          outcome: string
          tmdb_movie_id: number
        }[]
      }
      commit_room_tmdb_no_candidates: {
        Args: {
          p_actor_user_id: string
          p_expected_candidate_sequence: number
          p_room_id: string
        }
        Returns: {
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          outcome: string
          tmdb_movie_id: number
        }[]
      }
      create_room_with_selection_rules: {
        Args: {
          p_actor_user_id: string
          p_agreement_denominator: number
          p_agreement_numerator: number
          p_candidate_ordering: string
          p_creation_request_id: string
          p_creator_is_voter: boolean
          p_genre_mode: string
          p_metadata_language: string
          p_minimum_average_rating: number
          p_minimum_vote_count: number
          p_required_voter_count: number
          p_rule_set_kind: string
        }
        Returns: {
          candidate_acquisition_status: Database["public"]["Enums"]["candidate_acquisition_status"]
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          decision_completed_count: number
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
      get_room_candidate_decision: {
        Args: {
          p_expected_candidate_sequence: number
          p_expected_tmdb_movie_id: number
          p_room_id: string
        }
        Returns: {
          agreement_threshold: number
          candidate_outcome: Database["public"]["Enums"]["candidate_occurrence_status"]
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          decision_completed_count: number
          decision_set_complete: boolean
          my_decision: Database["public"]["Enums"]["candidate_decision_value"]
          outcome: string
          required_voter_count: number
        }[]
      }
      join_room: {
        Args: { p_room_code: string }
        Returns: {
          candidate_acquisition_status: Database["public"]["Enums"]["candidate_acquisition_status"]
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          decision_completed_count: number
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
      prepare_room_tmdb_candidate: {
        Args: { p_actor_user_id: string; p_room_id: string }
        Returns: {
          candidate_ordering: string
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          excluded_tmdb_movie_ids: Json
          genre_clauses_tmdb_ids: Json
          genre_mode: string
          metadata_language: string
          minimum_average_rating: number
          minimum_vote_count: number
          outcome: string
          release_year_from: number
          release_year_to: number
          rule_set_kind: string
          tmdb_movie_id: number
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
      submit_room_candidate_decision: {
        Args: {
          p_decision: Database["public"]["Enums"]["candidate_decision_value"]
          p_expected_candidate_sequence: number
          p_expected_tmdb_movie_id: number
          p_room_id: string
        }
        Returns: {
          agreement_threshold: number
          candidate_outcome: Database["public"]["Enums"]["candidate_occurrence_status"]
          candidate_progression_status: Database["public"]["Enums"]["candidate_progression_status"]
          candidate_sequence: number
          decision_completed_count: number
          decision_set_complete: boolean
          my_decision: Database["public"]["Enums"]["candidate_decision_value"]
          outcome: string
          required_voter_count: number
        }[]
      }
    }
    Enums: {
      candidate_acquisition_status: "pending" | "assigned" | "no_candidates"
      candidate_decision_value: "yes" | "no"
      candidate_occurrence_status: "collecting" | "rejected" | "agreed"
      candidate_progression_status:
        | "inactive"
        | "collecting"
        | "advancing"
        | "agreed"
        | "exhausted"
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
      candidate_acquisition_status: ["pending", "assigned", "no_candidates"],
      candidate_decision_value: ["yes", "no"],
      candidate_occurrence_status: ["collecting", "rejected", "agreed"],
      candidate_progression_status: [
        "inactive",
        "collecting",
        "advancing",
        "agreed",
        "exhausted",
      ],
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

