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
      daily_meals: {
        Row: {
          calcium: number | null
          calories: number
          carbs: number | null
          fat: number | null
          fiber: number | null
          id: string
          iron: number | null
          logged_at: string
          logged_date: string
          magnesium: number | null
          meal_time: string | null
          name: string
          potassium: number | null
          protein: number | null
          sodium: number | null
          updated_at: string
          user_id: string
          vitamin_b12: number | null
          vitamin_c: number | null
          vitamin_d: number | null
          zinc: number | null
        }
        Insert: {
          calcium?: number | null
          calories: number
          carbs?: number | null
          fat?: number | null
          fiber?: number | null
          id?: string
          iron?: number | null
          logged_at?: string
          logged_date?: string
          magnesium?: number | null
          meal_time?: string | null
          name: string
          potassium?: number | null
          protein?: number | null
          sodium?: number | null
          updated_at?: string
          user_id: string
          vitamin_b12?: number | null
          vitamin_c?: number | null
          vitamin_d?: number | null
          zinc?: number | null
        }
        Update: {
          calcium?: number | null
          calories?: number
          carbs?: number | null
          fat?: number | null
          fiber?: number | null
          id?: string
          iron?: number | null
          logged_at?: string
          logged_date?: string
          magnesium?: number | null
          meal_time?: string | null
          name?: string
          potassium?: number | null
          protein?: number | null
          sodium?: number | null
          updated_at?: string
          user_id?: string
          vitamin_b12?: number | null
          vitamin_c?: number | null
          vitamin_d?: number | null
          zinc?: number | null
        }
        Relationships: []
      }
      food_aliases: {
        Row: {
          alias: string
          food_id: string
          id: string
        }
        Insert: {
          alias: string
          food_id: string
          id?: string
        }
        Update: {
          alias?: string
          food_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_aliases_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "indian_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      indian_foods: {
        Row: {
          calories: number
          carbs: number
          category: string
          created_at: string
          fat: number
          fiber: number
          id: string
          image_url: string | null
          is_verified: boolean
          name: string
          protein: number
          serving_size: number
          serving_unit: string
          user_id: string | null
        }
        Insert: {
          calories: number
          carbs: number
          category: string
          created_at?: string
          fat: number
          fiber?: number
          id?: string
          image_url?: string | null
          is_verified?: boolean
          name: string
          protein: number
          serving_size?: number
          serving_unit?: string
          user_id?: string | null
        }
        Update: {
          calories?: number
          carbs?: number
          category?: string
          created_at?: string
          fat?: number
          fiber?: number
          id?: string
          image_url?: string | null
          is_verified?: boolean
          name?: string
          protein?: number
          serving_size?: number
          serving_unit?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string
          height: number | null
          id: string
          name: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          height?: number | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          height?: number | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      saved_meals: {
        Row: {
          calcium: number | null
          calories: number
          carbs: number | null
          created_at: string
          fat: number | null
          fiber: number | null
          id: string
          iron: number | null
          magnesium: number | null
          name: string
          notes: string | null
          potassium: number | null
          protein: number | null
          sodium: number | null
          tags: string[] | null
          updated_at: string
          user_id: string
          vitamin_b12: number | null
          vitamin_c: number | null
          vitamin_d: number | null
          zinc: number | null
        }
        Insert: {
          calcium?: number | null
          calories: number
          carbs?: number | null
          created_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          iron?: number | null
          magnesium?: number | null
          name: string
          notes?: string | null
          potassium?: number | null
          protein?: number | null
          sodium?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          vitamin_b12?: number | null
          vitamin_c?: number | null
          vitamin_d?: number | null
          zinc?: number | null
        }
        Update: {
          calcium?: number | null
          calories?: number
          carbs?: number | null
          created_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          iron?: number | null
          magnesium?: number | null
          name?: string
          notes?: string | null
          potassium?: number | null
          protein?: number | null
          sodium?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          vitamin_b12?: number | null
          vitamin_c?: number | null
          vitamin_d?: number | null
          zinc?: number | null
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          glasses: number
          id: string
          logged_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          glasses?: number
          id?: string
          logged_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          glasses?: number
          id?: string
          logged_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_foods: {
        Args: { search_query: string }
        Returns: {
          calories: number
          carbs: number
          category: string
          created_at: string
          fat: number
          fiber: number
          id: string
          image_url: string | null
          is_verified: boolean
          name: string
          protein: number
          serving_size: number
          serving_unit: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "indian_foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
