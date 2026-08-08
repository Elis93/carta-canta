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
      catalog_items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          unit: string
          unit_price: number
          updated_at: string | null
          vat_rate: number | null
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          unit?: string
          unit_price?: number
          updated_at?: string | null
          vat_rate?: number | null
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          unit?: string
          unit_price?: number
          updated_at?: string | null
          vat_rate?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          created_at: string | null
          email: string | null
          id: string
          indirizzo: string | null
          name: string
          notes: string | null
          paese: string
          phone: string | null
          piva: string | null
          provincia: string | null
          search_vector: unknown
          surname: string | null
          tags: string[] | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          name: string
          notes?: string | null
          paese?: string
          phone?: string | null
          piva?: string | null
          provincia?: string | null
          search_vector?: unknown
          surname?: string | null
          tags?: string[] | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          name?: string
          notes?: string | null
          paese?: string
          phone?: string | null
          piva?: string | null
          provincia?: string | null
          search_vector?: unknown
          surname?: string | null
          tags?: string[] | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean | null
          bonus_tipo: string | null
          description: string
          discount_pct: number | null
          document_id: string
          id: string
          quantity: number
          sort_order: number
          total: number
          unit: string | null
          unit_price: number
          vat_rate: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          bonus_tipo?: string | null
          description: string
          discount_pct?: number | null
          document_id: string
          id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          bonus_tipo?: string | null
          description?: string
          discount_pct?: number | null
          document_id?: string
          id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_views: {
        Row: {
          country: string | null
          document_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          country?: string | null
          document_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          country?: string | null
          document_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_views_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          accepted_at: string | null
          accepted_ip: unknown
          accepted_ua: string | null
          ai_confidence: number | null
          ai_generated: boolean | null
          bollo_amount: number
          bonus_edilizio: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          discount_fixed: number | null
          discount_pct: number | null
          doc_number: string | null
          doc_seq: number | null
          doc_type: string
          doc_year: number | null
          document_language: string
          exchange_rate: number
          expires_at: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          last_reminder_at: string | null
          deleted_at: string | null
          origin_document_id: string | null
          payment_terms: string | null
          pdf_downloaded_at: string | null
          pdf_url: string | null
          public_token: string | null
          rejection_reason: string | null
          ritenuta_pct: number | null
          search_vector: unknown
          sent_at: string | null
          sent_snapshot: Json | null
          signature_image: string | null
          snooze_until: string | null
          archived_at: string | null
          reminders_off_at: string | null
          signer_name: string | null
          status: Database["public"]["Enums"]["doc_status"]
          subtotal: number
          tax_amount: number
          template_snapshot: Json | null
          title: string | null
          total: number
          updated_after_send_at: string | null
          updated_at: string | null
          validity_days: number | null
          vat_rate_default: number | null
          workspace_id: string
          document_log: Json
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: unknown
          accepted_ua?: string | null
          ai_confidence?: number | null
          ai_generated?: boolean | null
          bollo_amount?: number
          bonus_edilizio?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          discount_fixed?: number | null
          discount_pct?: number | null
          doc_number?: string | null
          doc_seq?: number | null
          doc_type?: string
          doc_year?: number | null
          document_language?: string
          exchange_rate?: number
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          last_reminder_at?: string | null
          deleted_at?: string | null
          notes?: string | null
          origin_document_id?: string | null
          payment_terms?: string | null
          pdf_downloaded_at?: string | null
          pdf_url?: string | null
          public_token?: string | null
          rejection_reason?: string | null
          ritenuta_pct?: number | null
          search_vector?: unknown
          sent_at?: string | null
          sent_snapshot?: Json | null
          signature_image?: string | null
          snooze_until?: string | null
          archived_at?: string | null
          reminders_off_at?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          template_snapshot?: Json | null
          title?: string | null
          total?: number
          updated_after_send_at?: string | null
          updated_at?: string | null
          validity_days?: number | null
          vat_rate_default?: number | null
          workspace_id: string
          document_log?: Json
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: unknown
          accepted_ua?: string | null
          ai_confidence?: number | null
          ai_generated?: boolean | null
          bollo_amount?: number
          bonus_edilizio?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          discount_fixed?: number | null
          discount_pct?: number | null
          doc_number?: string | null
          doc_seq?: number | null
          doc_type?: string
          doc_year?: number | null
          document_language?: string
          exchange_rate?: number
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          last_reminder_at?: string | null
          deleted_at?: string | null
          notes?: string | null
          origin_document_id?: string | null
          payment_terms?: string | null
          pdf_downloaded_at?: string | null
          pdf_url?: string | null
          public_token?: string | null
          rejection_reason?: string | null
          ritenuta_pct?: number | null
          search_vector?: unknown
          sent_at?: string | null
          sent_snapshot?: Json | null
          signature_image?: string | null
          snooze_until?: string | null
          archived_at?: string | null
          reminders_off_at?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          template_snapshot?: Json | null
          title?: string | null
          total?: number
          updated_after_send_at?: string | null
          updated_at?: string | null
          validity_days?: number | null
          vat_rate_default?: number | null
          workspace_id?: string
          document_log?: Json
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          doc_type: string
          last_number: number
          seq_type: string
          workspace_id: string
          year: number
        }
        Insert: {
          doc_type?: string
          last_number?: number
          seq_type?: string
          workspace_id: string
          year: number
        }
        Update: {
          doc_type?: string
          last_number?: number
          seq_type?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          applied_at: string | null
          created_at: string
          credit_amount_cents: number
          free_months: number
          id: string
          referee_workspace_id: string
          reward_month: string
          stripe_balance_transaction_id: string | null
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          credit_amount_cents?: number
          free_months?: number
          id?: string
          referee_workspace_id: string
          reward_month: string
          stripe_balance_transaction_id?: string | null
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          credit_amount_cents?: number
          free_months?: number
          id?: string
          referee_workspace_id?: string
          reward_month?: string
          stripe_balance_transaction_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referee_workspace_id_fkey"
            columns: ["referee_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_uses: {
        Row: {
          code: string
          id: string
          referee_workspace_id: string
          referrer_workspace_id: string
          used_at: string
        }
        Insert: {
          code: string
          id?: string
          referee_workspace_id: string
          referrer_workspace_id: string
          used_at?: string
        }
        Update: {
          code?: string
          id?: string
          referee_workspace_id?: string
          referrer_workspace_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_uses_referee_workspace_id_fkey"
            columns: ["referee_workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_uses_referrer_workspace_id_fkey"
            columns: ["referrer_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          color_primary: string | null
          created_at: string | null
          description: string | null
          font_family: string | null
          footer_html: string | null
          header_html: string | null
          id: string
          is_default: boolean | null
          legal_notice: string | null
          logo_position: string | null
          name: string
          number_format: string | null
          preset_key: string | null
          show_logo: boolean | null
          show_watermark: boolean | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          color_primary?: string | null
          created_at?: string | null
          description?: string | null
          font_family?: string | null
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_default?: boolean | null
          legal_notice?: string | null
          logo_position?: string | null
          name: string
          number_format?: string | null
          preset_key?: string | null
          show_logo?: boolean | null
          show_watermark?: boolean | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          color_primary?: string | null
          created_at?: string | null
          description?: string | null
          font_family?: string | null
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_default?: boolean | null
          legal_notice?: string | null
          logo_position?: string | null
          name?: string
          number_format?: string | null
          preset_key?: string | null
          show_logo?: boolean | null
          show_watermark?: boolean | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_usage: {
        Row: {
          id: string
          period: string
          seconds_used: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          period: string
          seconds_used?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          period?: string
          seconds_used?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          invited_at: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ateco_code: string | null
          ateco_codes: string[]
          billing_interval: string | null
          bollo_auto: boolean
          cap: string | null
          citta: string | null
          created_at: string | null
          default_currency: Database["public"]["Enums"]["currency_code"]
          fiscal_regime: Database["public"]["Enums"]["fiscal_regime"]
          free_trial_expires_at: string | null
          id: string
          indirizzo: string | null
          invoice_counter: number
          invoice_prefix: string
          logo_url: string | null
          name: string
          notification_prefs: Json
          owner_id: string
          piva: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          provincia: string | null
          ragione_sociale: string | null
          phone: string | null
          ritenuta_auto: boolean
          sent_quota_used: number
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          ui_language: string
          updated_at: string | null
          validity_days: number
          scadenza_alert_days: number
        }
        Insert: {
          ateco_code?: string | null
          ateco_codes?: string[]
          billing_interval?: string | null
          bollo_auto?: boolean
          cap?: string | null
          citta?: string | null
          created_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency_code"]
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"]
          free_trial_expires_at?: string | null
          id?: string
          indirizzo?: string | null
          invoice_counter?: number
          invoice_prefix?: string
          logo_url?: string | null
          name: string
          notification_prefs?: Json
          owner_id: string
          piva?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          provincia?: string | null
          ragione_sociale?: string | null
          phone?: string | null
          ritenuta_auto?: boolean
          sent_quota_used?: number
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          ui_language?: string
          updated_at?: string | null
          validity_days?: number
          scadenza_alert_days?: number
        }
        Update: {
          ateco_code?: string | null
          ateco_codes?: string[]
          billing_interval?: string | null
          bollo_auto?: boolean
          cap?: string | null
          citta?: string | null
          created_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency_code"]
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"]
          free_trial_expires_at?: string | null
          id?: string
          indirizzo?: string | null
          invoice_counter?: number
          invoice_prefix?: string
          logo_url?: string | null
          name?: string
          notification_prefs?: Json
          owner_id?: string
          piva?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          provincia?: string | null
          ragione_sociale?: string | null
          phone?: string | null
          ritenuta_auto?: boolean
          sent_quota_used?: number
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          ui_language?: string
          updated_at?: string | null
          validity_days?: number
          scadenza_alert_days?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_preventivo_to_fattura: {
        Args: { p_doc_id: string }
        Returns: string
      }
      expire_overdue_documents: { Args: never; Returns: number }
      generate_referral_code: { Args: never; Returns: string }
      get_or_create_referral_code: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      my_workspace_ids: { Args: never; Returns: string[] }
      next_invoice_number: {
        Args: { p_doc_type: string; p_workspace: string; p_year: number }
        Returns: number
      }
    }
    Enums: {
      currency_code: "EUR" | "GBP" | "CHF" | "PLN" | "USD"
      doc_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      fiscal_regime: "forfettario" | "ordinario" | "minimi"
      plan_type: "free" | "pro" | "team" | "lifetime"
      user_role: "admin" | "operator" | "viewer"
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
      currency_code: ["EUR", "GBP", "CHF", "PLN", "USD"],
      doc_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
      fiscal_regime: ["forfettario", "ordinario", "minimi"],
      plan_type: ["free", "pro", "team", "lifetime"],
      user_role: ["admin", "operator", "viewer"],
    },
  },
} as const
