// GENERATED from the live Supabase schema (project hblldqsccjpiikbhyknd).
// Regenerate via the Supabase MCP `generate_typescript_types` or:
//   npx supabase gen types typescript --project-id $SUPABASE_PROJECT_REF
// DO NOT HAND-EDIT.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      amenities: {
        Row: {
          category: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          category: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          slug: string
          state: string
          tier: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          slug: string
          state: string
          tier?: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          slug?: string
          state?: string
          tier?: string
        }
        Relationships: []
      }
      gym_amenities: {
        Row: {
          amenity_key: string
          confidence: number
          detail: string | null
          gym_id: string
          present: boolean
          source: string
          updated_at: string
        }
        Insert: {
          amenity_key: string
          confidence?: number
          detail?: string | null
          gym_id: string
          present?: boolean
          source?: string
          updated_at?: string
        }
        Update: {
          amenity_key?: string
          confidence?: number
          detail?: string | null
          gym_id?: string
          present?: boolean
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_amenities_amenity_key_fkey"
            columns: ["amenity_key"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "gym_amenities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_equipment: {
        Row: {
          brand: string | null
          confidence: number
          created_at: string
          detail: string | null
          equipment_key: Database["public"]["Enums"]["equipment_key"]
          gym_id: string
          id: string
          max_weight_lbs: number | null
          quantity: number | null
          source: string
        }
        Insert: {
          brand?: string | null
          confidence?: number
          created_at?: string
          detail?: string | null
          equipment_key: Database["public"]["Enums"]["equipment_key"]
          gym_id: string
          id?: string
          max_weight_lbs?: number | null
          quantity?: number | null
          source?: string
        }
        Update: {
          brand?: string | null
          confidence?: number
          created_at?: string
          detail?: string | null
          equipment_key?: Database["public"]["Enums"]["equipment_key"]
          gym_id?: string
          id?: string
          max_weight_lbs?: number | null
          quantity?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_equipment_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string | null
          city_id: string
          created_at: string
          day_pass_price: number | null
          description: string | null
          hours: Json | null
          id: string
          lat: number | null
          lng: number | null
          location: unknown
          name: string
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          rating: number | null
          rating_count: number
          segment: Database["public"]["Enums"]["gym_segment"] | null
          slug: string
          updated_at: string
          verified: boolean
          website: string | null
          week_pass_price: number | null
        }
        Insert: {
          address?: string | null
          city_id: string
          created_at?: string
          day_pass_price?: number | null
          description?: string | null
          hours?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          name: string
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          rating?: number | null
          rating_count?: number
          segment?: Database["public"]["Enums"]["gym_segment"] | null
          slug: string
          updated_at?: string
          verified?: boolean
          website?: string | null
          week_pass_price?: number | null
        }
        Update: {
          address?: string | null
          city_id?: string
          created_at?: string
          day_pass_price?: number | null
          description?: string | null
          hours?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          name?: string
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          rating?: number | null
          rating_count?: number
          segment?: Database["public"]["Enums"]["gym_segment"] | null
          slug?: string
          updated_at?: string
          verified?: boolean
          website?: string | null
          week_pass_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gyms_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      equipment_key:
        | "squat_rack"
        | "power_rack"
        | "platform"
        | "dumbbells"
        | "barbells"
        | "kettlebells"
        | "ghd"
        | "sled"
        | "ski_erg"
        | "assault_bike"
        | "rower"
        | "reverse_hyper"
        | "belt_squat"
        | "comp_bench"
        | "cable_machine"
        | "leg_press"
        | "smith_machine"
        | "hack_squat"
        | "pull_up_bar"
        | "dip_station"
        | "monolift"
        | "climbing_wall"
      gym_segment:
        | "strength"
        | "crossfit"
        | "big_box"
        | "boutique"
        | "climbing"
        | "yoga_pilates"
        | "mma"
        | "recovery"
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
      equipment_key: [
        "squat_rack",
        "power_rack",
        "platform",
        "dumbbells",
        "barbells",
        "kettlebells",
        "ghd",
        "sled",
        "ski_erg",
        "assault_bike",
        "rower",
        "reverse_hyper",
        "belt_squat",
        "comp_bench",
        "cable_machine",
        "leg_press",
        "smith_machine",
        "hack_squat",
        "pull_up_bar",
        "dip_station",
        "monolift",
        "climbing_wall",
      ],
      gym_segment: [
        "strength",
        "crossfit",
        "big_box",
        "boutique",
        "climbing",
        "yoga_pilates",
        "mma",
        "recovery",
      ],
    },
  },
} as const
