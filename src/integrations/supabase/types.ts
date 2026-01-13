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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          branch_id: string
          cloture: string | null
          code: string | null
          created_at: string
          forme_juridique: Database["public"]["Enums"]["forme_juridique"] | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          nom: string
          notes: string | null
          regime_fiscal: Database["public"]["Enums"]["regime_fiscal"] | null
          siren: string | null
          tva_mode: Database["public"]["Enums"]["tva_mode"] | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          cloture?: string | null
          code?: string | null
          created_at?: string
          forme_juridique?:
            | Database["public"]["Enums"]["forme_juridique"]
            | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          nom: string
          notes?: string | null
          regime_fiscal?: Database["public"]["Enums"]["regime_fiscal"] | null
          siren?: string | null
          tva_mode?: Database["public"]["Enums"]["tva_mode"] | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cloture?: string | null
          code?: string | null
          created_at?: string
          forme_juridique?:
            | Database["public"]["Enums"]["forme_juridique"]
            | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          nom?: string
          notes?: string | null
          regime_fiscal?: Database["public"]["Enums"]["regime_fiscal"] | null
          siren?: string | null
          tva_mode?: Database["public"]["Enums"]["tva_mode"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          profile_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          profile_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          profile_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      taches_fiscales: {
        Row: {
          commentaire: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          date_echeance: string
          dossier_id: string
          id: string
          montant: number | null
          statut: Database["public"]["Enums"]["tache_statut"] | null
          type: Database["public"]["Enums"]["tache_type"]
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          date_echeance: string
          dossier_id: string
          id?: string
          montant?: number | null
          statut?: Database["public"]["Enums"]["tache_statut"] | null
          type?: Database["public"]["Enums"]["tache_type"]
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          date_echeance?: string
          dossier_id?: string
          id?: string
          montant?: number | null
          statut?: Database["public"]["Enums"]["tache_statut"] | null
          type?: Database["public"]["Enums"]["tache_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taches_fiscales_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taches_fiscales_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_organization_id: { Args: { user_uuid: string }; Returns: string }
      has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["app_role"]
          user_uuid: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "collaborator"
      forme_juridique:
        | "SAS"
        | "SARL"
        | "EURL"
        | "SA"
        | "SCI"
        | "EI"
        | "SASU"
        | "SNC"
        | "AUTRE"
      regime_fiscal: "IS" | "IR" | "MICRO" | "REEL_SIMPLIFIE" | "REEL_NORMAL"
      tache_statut: "a_faire" | "fait" | "retard" | "credit" | "neant"
      tache_type: "TVA" | "IS" | "CVAE" | "CFE" | "LIASSE" | "AUTRE"
      tva_mode: "mensuel" | "trimestriel"
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
      app_role: ["admin", "manager", "collaborator"],
      forme_juridique: [
        "SAS",
        "SARL",
        "EURL",
        "SA",
        "SCI",
        "EI",
        "SASU",
        "SNC",
        "AUTRE",
      ],
      regime_fiscal: ["IS", "IR", "MICRO", "REEL_SIMPLIFIE", "REEL_NORMAL"],
      tache_statut: ["a_faire", "fait", "retard", "credit", "neant"],
      tache_type: ["TVA", "IS", "CVAE", "CFE", "LIASSE", "AUTRE"],
      tva_mode: ["mensuel", "trimestriel"],
    },
  },
} as const
