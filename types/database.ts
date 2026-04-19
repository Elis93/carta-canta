// ============================================================
// CARTA CANTA — Database Types
// Generati dallo schema in supabase/migrations/001_initial_schema.sql
//
// Per rigenerare dopo modifiche allo schema remoto:
//   npx supabase gen types typescript --linked > types/database.ts
// ============================================================

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
          search_vector: unknown | null
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
          }
        ]
      }
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
          }
        ]
      }
      document_views: {
        Row: {
          country: string | null
          document_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          country?: string | null
          document_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          country?: string | null
          document_id?: string
          id?: string
          ip_address?: string | null
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
          }
        ]
      }
      document_items: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean | null
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
          }
        ]
      }
      documents: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          accepted_ua: string | null
          ai_confidence: number | null
          ai_generated: boolean | null
          bollo_amount: number
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
          payment_terms: string | null
          pdf_url: string | null
          public_token: string | null
          ritenuta_pct: number | null
          search_vector: unknown | null
          sent_at: string | null
          signer_name: string | null
          status: Database["public"]["Enums"]["doc_status"]
          subtotal: number
          tax_amount: number
          template_snapshot: Json | null
          title: string | null
          total: number
          updated_at: string | null
          validity_days: number | null
          vat_rate_default: number | null
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_ua?: string | null
          ai_confidence?: number | null
          ai_generated?: boolean | null
          bollo_amount?: number
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          discount_fixed?: number | null
          discount_pct?: number | null
          doc_number?: string | null
          doc_type?: string
          document_language?: string
          exchange_rate?: number
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          public_token?: string | null
          ritenuta_pct?: number | null
          sent_at?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          template_snapshot?: Json | null
          title?: string | null
          total?: number
          updated_at?: string | null
          validity_days?: number | null
          vat_rate_default?: number | null
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_ua?: string | null
          ai_confidence?: number | null
          ai_generated?: boolean | null
          bollo_amount?: number
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          discount_fixed?: number | null
          discount_pct?: number | null
          doc_number?: string | null
          doc_type?: string
          document_language?: string
          exchange_rate?: number
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          public_token?: string | null
          ritenuta_pct?: number | null
          sent_at?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          template_snapshot?: Json | null
          title?: string | null
          total?: number
          updated_at?: string | null
          validity_days?: number | null
          vat_rate_default?: number | null
          workspace_id?: string
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
          }
        ]
      }
      invoice_sequences: {
        Row: {
          last_number: number
          workspace_id: string
          year: number
        }
        Insert: {
          last_number?: number
          workspace_id: string
          year: number
        }
        Update: {
          last_number?: number
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
          }
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
          name: string
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
          name: string
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
          name?: string
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
          }
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
          }
        ]
      }
      workspaces: {
        Row: {
          ateco_code: string | null
          bollo_auto: boolean
          cap: string | null
          citta: string | null
          created_at: string | null
          default_currency: Database["public"]["Enums"]["currency_code"]
          fiscal_regime: Database["public"]["Enums"]["fiscal_regime"]
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
          ritenuta_auto: boolean
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          ui_language: string
          updated_at: string | null
        }
        Insert: {
          ateco_code?: string | null
          bollo_auto?: boolean
          cap?: string | null
          citta?: string | null
          created_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency_code"]
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"]
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
          ritenuta_auto?: boolean
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          ui_language?: string
          updated_at?: string | null
        }
        Update: {
          ateco_code?: string | null
          bollo_auto?: boolean
          cap?: string | null
          citta?: string | null
          created_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency_code"]
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"]
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
          ritenuta_auto?: boolean
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          ui_language?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      next_invoice_number: {
        Args: { p_workspace: string; p_year: number }
        Returns: number
      }
      expire_overdue_documents: {
        Args: Record<string, never>
        Returns: number
      }
      convert_preventivo_to_fattura: {
        Args: { p_doc_id: string }
        Returns: string
      }
    }
    Enums: {
      currency_code: "EUR" | "GBP" | "CHF" | "PLN" | "USD"
      doc_status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired"
      fiscal_regime: "forfettario" | "ordinario" | "minimi"
      plan_type: "free" | "pro" | "team" | "lifetime"
      user_role: "admin" | "operator" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never
