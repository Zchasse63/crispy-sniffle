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
      staff_members: {
        Row: { user_id: string; role: string; created_at: string }
        Insert: { user_id: string; role?: string; created_at?: string }
        Update: { user_id?: string; role?: string; created_at?: string }
        Relationships: []
      }
      admin_audit_log: {
        Row: { id: string; actor: string | null; action: string; target_table: string | null; target_id: string | null; detail: Json | null; created_at: string }
        Insert: { id?: string; actor?: string | null; action: string; target_table?: string | null; target_id?: string | null; detail?: Json | null; created_at?: string }
        Update: { id?: string; actor?: string | null; action?: string; target_table?: string | null; target_id?: string | null; detail?: Json | null; created_at?: string }
        Relationships: []
      }
      app_config: {
        Row: { key: string; value: Json; updated_by: string | null; updated_at: string }
        Insert: { key: string; value: Json; updated_by?: string | null; updated_at?: string }
        Update: { key?: string; value?: Json; updated_by?: string | null; updated_at?: string }
        Relationships: []
      }
      gym_edit_log: {
        Row: { id: string; gym_id: string | null; actor: string | null; action: string; field: string | null; old_value: Json | null; new_value: Json | null; source: string | null; confidence: number | null; created_at: string }
        Insert: { id?: string; gym_id?: string | null; actor?: string | null; action: string; field?: string | null; old_value?: Json | null; new_value?: Json | null; source?: string | null; confidence?: number | null; created_at?: string }
        Update: { id?: string; gym_id?: string | null; actor?: string | null; action?: string; field?: string | null; old_value?: Json | null; new_value?: Json | null; source?: string | null; confidence?: number | null; created_at?: string }
        Relationships: []
      }
      owner_invites: {
        Row: { id: string; gym_id: string; token_hash: string; email: string | null; status: string; created_by: string | null; created_at: string; expires_at: string | null; used_at: string | null; submission_id: string | null }
        Insert: { id?: string; gym_id: string; token_hash: string; email?: string | null; status?: string; created_by?: string | null; created_at?: string; expires_at?: string | null; used_at?: string | null; submission_id?: string | null }
        Update: { id?: string; gym_id?: string; token_hash?: string; email?: string | null; status?: string; created_by?: string | null; created_at?: string; expires_at?: string | null; used_at?: string | null; submission_id?: string | null }
        Relationships: []
      }
      owner_submissions: {
        Row: { id: string; gym_id: string; invite_id: string | null; contact_name: string | null; contact_email: string | null; contact_role: string | null; raw_answers: Json; touched: Json; parsed_facts: Json; status: string; conflict_count: number; fact_count: number; note: string | null; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null; submitter_ip_hash: string | null; revision: number; needs_info_at: string | null; created_at: string }
        Insert: { id?: string; gym_id: string; invite_id?: string | null; contact_name?: string | null; contact_email?: string | null; contact_role?: string | null; raw_answers: Json; touched?: Json; parsed_facts?: Json; status?: string; conflict_count?: number; fact_count?: number; note?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; submitter_ip_hash?: string | null; revision?: number; needs_info_at?: string | null; created_at?: string }
        Update: { id?: string; gym_id?: string; invite_id?: string | null; contact_name?: string | null; contact_email?: string | null; contact_role?: string | null; raw_answers?: Json; touched?: Json; parsed_facts?: Json; status?: string; conflict_count?: number; fact_count?: number; note?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; submitter_ip_hash?: string | null; revision?: number; needs_info_at?: string | null; created_at?: string }
        Relationships: []
      }
      owner_fact_log: {
        Row: { id: string; submission_id: string | null; gym_id: string | null; field: string | null; old_value: Json | null; new_value: Json | null; decision: string; actor: string | null; created_at: string }
        Insert: { id?: string; submission_id?: string | null; gym_id?: string | null; field?: string | null; old_value?: Json | null; new_value?: Json | null; decision: string; actor?: string | null; created_at?: string }
        Update: { id?: string; submission_id?: string | null; gym_id?: string | null; field?: string | null; old_value?: Json | null; new_value?: Json | null; decision?: string; actor?: string | null; created_at?: string }
        Relationships: []
      }
      owner_drafts: {
        Row: { invite_id: string; gym_id: string; version: number; answers: Json; completed_sections: Json; touched: Json; contact_name: string | null; contact_role: string | null; updated_at: string }
        Insert: { invite_id: string; gym_id: string; version: number; answers: Json; completed_sections?: Json; touched?: Json; contact_name?: string | null; contact_role?: string | null; updated_at?: string }
        Update: { invite_id?: string; gym_id?: string; version?: number; answers?: Json; completed_sections?: Json; touched?: Json; contact_name?: string | null; contact_role?: string | null; updated_at?: string }
        Relationships: []
      }
      user_moderation: {
        Row: { user_id: string; status: string; reason: string | null; moderated_by: string | null; created_at: string; updated_at: string }
        Insert: { user_id: string; status?: string; reason?: string | null; moderated_by?: string | null; created_at?: string; updated_at?: string }
        Update: { user_id?: string; status?: string; reason?: string | null; moderated_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
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
      cloud_trips: {
        Row: { city_name: string; city_slug: string; created_at: string; end_date: string; id: string; lodging: Json | null; start_date: string; user_id: string }
        Insert: { city_name: string; city_slug: string; created_at?: string; end_date: string; id?: string; lodging?: Json | null; start_date: string; user_id: string }
        Update: { city_name?: string; city_slug?: string; created_at?: string; end_date?: string; id?: string; lodging?: Json | null; start_date?: string; user_id?: string }
        Relationships: []
      }
      community_links: {
        Row: { created_at: string; gym_slug: string; id: string; platform: string; title: string; topic_note: string | null; url: string; year: number | null }
        Insert: { created_at?: string; gym_slug: string; id?: string; platform?: string; title: string; topic_note?: string | null; url: string; year?: number | null }
        Update: { created_at?: string; gym_slug?: string; id?: string; platform?: string; title?: string; topic_note?: string | null; url?: string; year?: number | null }
        Relationships: []
      }
      email_subscribers: {
        Row: { created_at: string; email: string; id: string; interests: string[] }
        Insert: { created_at?: string; email: string; id?: string; interests?: string[] }
        Update: { created_at?: string; email?: string; id?: string; interests?: string[] }
        Relationships: []
      }
      fact_confirmations: {
        Row: { corrected_value: string | null; created_at: string; fact_key: string; fact_type: string; gym_id: string; id: string; note: string | null; user_id: string; verdict: string }
        Insert: { corrected_value?: string | null; created_at?: string; fact_key: string; fact_type: string; gym_id: string; id?: string; note?: string | null; user_id: string; verdict: string }
        Update: { corrected_value?: string | null; created_at?: string; fact_key?: string; fact_type?: string; gym_id?: string; id?: string; note?: string | null; user_id?: string; verdict?: string }
        Relationships: []
      }
      followed_gyms: {
        Row: { alert_email: boolean; created_at: string; gym_id: string; user_id: string }
        Insert: { alert_email?: boolean; created_at?: string; gym_id: string; user_id: string }
        Update: { alert_email?: boolean; created_at?: string; gym_id?: string; user_id?: string }
        Relationships: []
      }
      gym_reviews: {
        Row: { comment: string | null; created_at: string; gym_id: string; hidden: boolean; id: string; rating: number; report_count: number; updated_at: string; user_id: string; visit_context: string | null; moderated_by: string | null; moderated_at: string | null; moderation_reason: string | null }
        Insert: { comment?: string | null; created_at?: string; gym_id: string; hidden?: boolean; id?: string; rating: number; report_count?: number; updated_at?: string; user_id: string; visit_context?: string | null; moderated_by?: string | null; moderated_at?: string | null; moderation_reason?: string | null }
        Update: { comment?: string | null; created_at?: string; gym_id?: string; hidden?: boolean; id?: string; rating?: number; report_count?: number; updated_at?: string; user_id?: string; visit_context?: string | null; moderated_by?: string | null; moderated_at?: string | null; moderation_reason?: string | null }
        Relationships: []
      }
      gym_visits: {
        Row: { created_at: string; gym_id: string; id: string; note: string | null; user_id: string; visited_on: string }
        Insert: { created_at?: string; gym_id: string; id?: string; note?: string | null; user_id: string; visited_on: string }
        Update: { created_at?: string; gym_id?: string; id?: string; note?: string | null; user_id?: string; visited_on?: string }
        Relationships: []
      }
      profiles: {
        Row: { created_at: string; display_name: string | null; id: string; training_prefs: Json; updated_at: string }
        Insert: { created_at?: string; display_name?: string | null; id: string; training_prefs?: Json; updated_at?: string }
        Update: { created_at?: string; display_name?: string | null; id?: string; training_prefs?: Json; updated_at?: string }
        Relationships: []
      }
      search_logs: {
        Row: { created_at: string; id: string; parsed_via: string; query: string; result_count: number | null; top_score: number | null }
        Insert: { created_at?: string; id?: string; parsed_via: string; query: string; result_count?: number | null; top_score?: number | null }
        Update: { created_at?: string; id?: string; parsed_via?: string; query?: string; result_count?: number | null; top_score?: number | null }
        Relationships: []
      }
      review_photos: {
        Row: { created_at: string; id: string; review_id: string; storage_path: string; user_id: string }
        Insert: { created_at?: string; id?: string; review_id: string; storage_path: string; user_id: string }
        Update: { created_at?: string; id?: string; review_id?: string; storage_path?: string; user_id?: string }
        Relationships: []
      }
      review_reports: {
        Row: { review_id: string; reporter_id: string; created_at: string }
        Insert: { review_id: string; reporter_id: string; created_at?: string }
        Update: { review_id?: string; reporter_id?: string; created_at?: string }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_live: boolean
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
          is_live?: boolean
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
          is_live?: boolean
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
      // HAND-ADDED to match the live gym_parking migration — if this file is
      // regenerated via `supabase gen types`, this block is reproduced
      // automatically; until then, keep it in sync with the migration.
      gym_photos: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          source: string
          storage_path: string | null
          subject: string | null
          url: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          source?: string
          storage_path?: string | null
          subject?: string | null
          url: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          source?: string
          storage_path?: string | null
          subject?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_photos_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_parking: {
        Row: {
          access: string
          capacity: number | null
          confidence: number
          created_at: string
          detail: string | null
          distance_m: number | null
          fee_detail: string | null
          gym_id: string
          id: string
          is_primary: boolean
          kind: string
          lat: number | null
          lng: number | null
          name: string | null
          source: string
          updated_at: string
        }
        Insert: {
          access?: string
          capacity?: number | null
          confidence?: number
          created_at?: string
          detail?: string | null
          distance_m?: number | null
          fee_detail?: string | null
          gym_id: string
          id?: string
          is_primary?: boolean
          kind: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          access?: string
          capacity?: number | null
          confidence?: number
          created_at?: string
          detail?: string | null
          distance_m?: number | null
          fee_detail?: string | null
          gym_id?: string
          id?: string
          is_primary?: boolean
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_parking_gym_id_fkey"
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
      gym_transit: {
        Row: {
          confidence: number
          created_at: string
          detail: string | null
          distance_m: number | null
          gym_id: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          name: string | null
          source: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          detail?: string | null
          distance_m?: number | null
          gym_id: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          source?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          detail?: string | null
          distance_m?: number | null
          gym_id?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_transit_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          status: Database["public"]["Enums"]["gym_status"]
          status_note: string | null
          status_changed_at: string | null
          last_fetched_at: string | null
          last_extracted_at: string | null
          owner_listed: boolean
          instagram: string | null
          address: string | null
          annual_fee: number | null
          annual_fee_label: string | null
          app_required_entry: boolean | null
          cancellation_notice_days: number | null
          city_id: string
          class_packs: Json | null
          corporate_discount: boolean | null
          created_at: string
          day_pass_price: number | null
          description: string | null
          drop_in_note: string | null
          drop_in_policy: string | null
          early_termination: Json | null
          enrollment_fee: number | null
          family_plans: boolean | null
          freeze_policy: string | null
          guest_policy_model: string | null
          hours: Json | null
          id: string
          intro_offer: string | null
          lat: number | null
          lng: number | null
          location: unknown
          members_guest_note: string | null
          membership_plans: Json | null
          military_discount: boolean | null
          min_commitment_months: number | null
          monthly_from: number | null
          monthly_note: string | null
          name: string
          neighborhood: string | null
          no_contract_option: boolean | null
          phone: string | null
          photo_url: string | null
          photo_storage_path: string | null
          pricing_notes: string | null
          rating: number | null
          rating_count: number
          rating_is_seed: boolean
          seed_rating: number | null
          seed_rating_count: number | null
          segment: Database["public"]["Enums"]["gym_segment"] | null
          senior_discount: boolean | null
          single_class_price: number | null
          slug: string
          student_discount: boolean | null
          updated_at: string
          verified: boolean
          vibe_source: string
          vibe_tags: string[]
          waitlist: boolean | null
          website: string | null
          week_pass_price: number | null
        }
        Insert: {
          status?: Database["public"]["Enums"]["gym_status"]
          status_note?: string | null
          status_changed_at?: string | null
          last_fetched_at?: string | null
          last_extracted_at?: string | null
          owner_listed?: boolean
          instagram?: string | null
          address?: string | null
          annual_fee?: number | null
          annual_fee_label?: string | null
          app_required_entry?: boolean | null
          cancellation_notice_days?: number | null
          city_id: string
          class_packs?: Json | null
          corporate_discount?: boolean | null
          created_at?: string
          day_pass_price?: number | null
          description?: string | null
          drop_in_note?: string | null
          drop_in_policy?: string | null
          early_termination?: Json | null
          enrollment_fee?: number | null
          family_plans?: boolean | null
          freeze_policy?: string | null
          guest_policy_model?: string | null
          hours?: Json | null
          id?: string
          intro_offer?: string | null
          lat?: number | null
          lng?: number | null
          location?: unknown
          members_guest_note?: string | null
          membership_plans?: Json | null
          military_discount?: boolean | null
          min_commitment_months?: number | null
          monthly_from?: number | null
          monthly_note?: string | null
          name: string
          neighborhood?: string | null
          no_contract_option?: boolean | null
          phone?: string | null
          photo_url?: string | null
          photo_storage_path?: string | null
          pricing_notes?: string | null
          rating?: number | null
          rating_count?: number
          rating_is_seed?: boolean
          seed_rating?: number | null
          seed_rating_count?: number | null
          segment?: Database["public"]["Enums"]["gym_segment"] | null
          senior_discount?: boolean | null
          single_class_price?: number | null
          slug: string
          student_discount?: boolean | null
          updated_at?: string
          verified?: boolean
          vibe_source?: string
          vibe_tags?: string[]
          waitlist?: boolean | null
          website?: string | null
          week_pass_price?: number | null
        }
        Update: {
          status?: Database["public"]["Enums"]["gym_status"]
          status_note?: string | null
          status_changed_at?: string | null
          last_fetched_at?: string | null
          last_extracted_at?: string | null
          owner_listed?: boolean
          instagram?: string | null
          address?: string | null
          annual_fee?: number | null
          annual_fee_label?: string | null
          app_required_entry?: boolean | null
          cancellation_notice_days?: number | null
          city_id?: string
          class_packs?: Json | null
          corporate_discount?: boolean | null
          created_at?: string
          day_pass_price?: number | null
          description?: string | null
          drop_in_note?: string | null
          drop_in_policy?: string | null
          early_termination?: Json | null
          enrollment_fee?: number | null
          family_plans?: boolean | null
          freeze_policy?: string | null
          guest_policy_model?: string | null
          hours?: Json | null
          id?: string
          intro_offer?: string | null
          lat?: number | null
          lng?: number | null
          location?: unknown
          members_guest_note?: string | null
          membership_plans?: Json | null
          military_discount?: boolean | null
          min_commitment_months?: number | null
          monthly_from?: number | null
          monthly_note?: string | null
          name?: string
          neighborhood?: string | null
          no_contract_option?: boolean | null
          phone?: string | null
          photo_url?: string | null
          photo_storage_path?: string | null
          pricing_notes?: string | null
          rating?: number | null
          rating_count?: number
          rating_is_seed?: boolean
          seed_rating?: number | null
          seed_rating_count?: number | null
          segment?: Database["public"]["Enums"]["gym_segment"] | null
          senior_discount?: boolean | null
          single_class_price?: number | null
          slug?: string
          student_discount?: boolean | null
          updated_at?: string
          verified?: boolean
          vibe_source?: string
          vibe_tags?: string[]
          waitlist?: boolean | null
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
      confirmation_counts: {
        Args: { gym: string }
        Returns: { fact_type: string; fact_key: string; confirms: number; corrects: number }[]
      }
      get_secret: { Args: { secret_name: string }; Returns: string }
      refresh_gym_rating: { Args: { gym_uuid: string }; Returns: undefined }
      report_review: { Args: { review_uuid: string }; Returns: undefined }
      my_staff_role: { Args: Record<string, never>; Returns: string | null }
      is_staff: { Args: Record<string, never>; Returns: boolean }
      has_min_role: { Args: { min_role: string }; Returns: boolean }
      log_admin_action: {
        Args: { p_action: string; p_target_table?: string; p_target_id?: string; p_detail?: Json }
        Returns: undefined
      }
      is_banned: { Args: { uid: string }; Returns: boolean }
      admin_user_lookup: { Args: { uid: string }; Returns: string }
      admin_find_user_by_email: { Args: { p_email: string }; Returns: string | null }
      resolve_owner_invite: { Args: { p_token_hash: string }; Returns: string | null }
      resolve_owner_invite_context: {
        Args: { p_token_hash: string }
        Returns: { gym_id: string; submission_id: string | null; review_note: string | null; prior_answers: Json; prior_touched: Json }[]
      }
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
        | "hip_thrust"
        | "leg_extension"
        | "leg_curl"
        | "abductor_adductor"
        | "calf_machine"
        | "stepmill"
        | "specialty_bars"
        | "nordic_bench"
        | "treadmill"
        | "elliptical"
        | "upright_bike"
        | "recumbent_bike"
        | "stair_climber"
        | "reformer"
        | "pilates_tower"
        | "cadillac"
        | "pilates_chair"
        | "pilates_barrel"
        | "aerial_rig"
        | "heavy_bag"
        | "boxing_ring"
        | "mma_cage"
        | "mats"
        | "spin_bike"
        | "curved_treadmill"
        | "versaclimber"
        | "jacobs_ladder"
        | "arc_trainer"
        | "incline_trainer"
        | "water_rower"
        | "recumbent_stepper"
        | "upper_body_ergometer"
        | "chest_press_machine"
        | "shoulder_press_machine"
        | "lat_pulldown_machine"
        | "seated_row_machine"
        | "pec_deck"
        | "rear_delt_machine"
        | "lateral_raise_machine"
        | "preacher_curl_machine"
        | "tricep_extension_machine"
        | "tricep_pushdown_machine"
        | "assisted_pull_up_dip_machine"
        | "ab_crunch_machine"
        | "back_extension_machine"
        | "torso_rotation_machine"
        | "glute_machine"
        | "lat_pullover_machine"
        | "cable_crossover"
        | "iso_lateral_chest_press"
        | "iso_lateral_incline_press"
        | "iso_lateral_shoulder_press"
        | "iso_lateral_row"
        | "iso_lateral_pulldown"
        | "t_bar_row_machine"
        | "pendulum_squat"
        | "v_squat"
        | "linear_leg_press"
        | "seated_dip_machine"
        | "landmine_station"
        | "adjustable_bench"
        | "flat_bench"
        | "incline_bench"
        | "decline_bench"
        | "preacher_bench"
        | "adjustable_dumbbells"
        | "bumper_plates"
        | "weight_plates"
        | "change_plates"
        | "trap_bar"
        | "ez_curl_bar"
        | "safety_squat_bar"
        | "swiss_bar"
        | "fat_grip_bar"
        | "half_rack"
        | "wall_mounted_rack"
        | "deadlift_jack"
        | "resistance_bands"
        | "jerk_blocks"
        | "battle_ropes"
        | "plyo_boxes"
        | "medicine_balls"
        | "slam_balls"
        | "wall_balls"
        | "suspension_trainer"
        | "gymnastic_rings"
        | "parallettes"
        | "climbing_rope"
        | "jump_ropes"
        | "agility_ladder"
        | "ab_wheel"
        | "weighted_vest"
        | "sandbags"
        | "tires"
        | "atlas_stones"
        | "yoke"
        | "farmers_handles"
        | "log_bar"
        | "balance_trainer"
        | "stability_ball"
        | "vibration_plate"
        | "ballet_barre"
        | "spring_wall"
        | "magic_circle"
        | "spine_corrector"
        | "jump_board"
        | "yoga_blocks"
        | "yoga_straps"
        | "yoga_bolsters"
        | "yoga_wheel"
        | "yoga_swing"
        | "pilates_mat"
        | "toning_balls"
        | "balance_pad"
        | "balance_board"
        | "ankle_weights"
        | "foam_roller"
        | "speed_bag"
        | "double_end_bag"
        | "muay_thai_bag"
        | "uppercut_bag"
        | "free_standing_bag"
        | "body_opponent_bag"
        | "reflex_bag"
        | "aqua_bag"
        | "grappling_dummy"
        | "wing_chun_dummy"
        | "focus_mitts_area"
        | "normatec_boots"
        | "massage_gun"
        | "stretching_station"
        | "inversion_table"
      gym_segment:
        | "strength"
        | "crossfit"
        | "big_box"
        | "boutique"
        | "climbing"
        | "yoga_pilates"
        | "mma"
        | "recovery"
        | "luxury"
        | "cycling"
        | "barre"
      gym_status:
        | "active"
        | "suspect"
        | "closed"
        | "moved"
        | "duplicate"
        | "unverified_new"
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
        "hip_thrust",
        "leg_extension",
        "leg_curl",
        "abductor_adductor",
        "calf_machine",
        "stepmill",
        "specialty_bars",
        "nordic_bench",
        "treadmill",
        "elliptical",
        "upright_bike",
        "recumbent_bike",
        "stair_climber",
        "reformer",
        "pilates_tower",
        "cadillac",
        "pilates_chair",
        "pilates_barrel",
        "aerial_rig",
        "heavy_bag",
        "boxing_ring",
        "mma_cage",
        "mats",
        "spin_bike",
        "curved_treadmill",
        "versaclimber",
        "jacobs_ladder",
        "arc_trainer",
        "incline_trainer",
        "water_rower",
        "recumbent_stepper",
        "upper_body_ergometer",
        "chest_press_machine",
        "shoulder_press_machine",
        "lat_pulldown_machine",
        "seated_row_machine",
        "pec_deck",
        "rear_delt_machine",
        "lateral_raise_machine",
        "preacher_curl_machine",
        "tricep_extension_machine",
        "tricep_pushdown_machine",
        "assisted_pull_up_dip_machine",
        "ab_crunch_machine",
        "back_extension_machine",
        "torso_rotation_machine",
        "glute_machine",
        "lat_pullover_machine",
        "cable_crossover",
        "iso_lateral_chest_press",
        "iso_lateral_incline_press",
        "iso_lateral_shoulder_press",
        "iso_lateral_row",
        "iso_lateral_pulldown",
        "t_bar_row_machine",
        "pendulum_squat",
        "v_squat",
        "linear_leg_press",
        "seated_dip_machine",
        "landmine_station",
        "adjustable_bench",
        "flat_bench",
        "incline_bench",
        "decline_bench",
        "preacher_bench",
        "adjustable_dumbbells",
        "bumper_plates",
        "weight_plates",
        "change_plates",
        "trap_bar",
        "ez_curl_bar",
        "safety_squat_bar",
        "swiss_bar",
        "fat_grip_bar",
        "half_rack",
        "wall_mounted_rack",
        "deadlift_jack",
        "resistance_bands",
        "jerk_blocks",
        "battle_ropes",
        "plyo_boxes",
        "medicine_balls",
        "slam_balls",
        "wall_balls",
        "suspension_trainer",
        "gymnastic_rings",
        "parallettes",
        "climbing_rope",
        "jump_ropes",
        "agility_ladder",
        "ab_wheel",
        "weighted_vest",
        "sandbags",
        "tires",
        "atlas_stones",
        "yoke",
        "farmers_handles",
        "log_bar",
        "balance_trainer",
        "stability_ball",
        "vibration_plate",
        "ballet_barre",
        "spring_wall",
        "magic_circle",
        "spine_corrector",
        "jump_board",
        "yoga_blocks",
        "yoga_straps",
        "yoga_bolsters",
        "yoga_wheel",
        "yoga_swing",
        "pilates_mat",
        "toning_balls",
        "balance_pad",
        "balance_board",
        "ankle_weights",
        "foam_roller",
        "speed_bag",
        "double_end_bag",
        "muay_thai_bag",
        "uppercut_bag",
        "free_standing_bag",
        "body_opponent_bag",
        "reflex_bag",
        "aqua_bag",
        "grappling_dummy",
        "wing_chun_dummy",
        "focus_mitts_area",
        "normatec_boots",
        "massage_gun",
        "stretching_station",
        "inversion_table",
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
        "luxury",
        "cycling",
        "barre",
      ],
      gym_status: ["active", "suspect", "closed", "moved", "duplicate", "unverified_new"],
    },
  },
} as const
