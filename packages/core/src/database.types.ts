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
      activities: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          student_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          student_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          activity_id: string
          created_at: string
          hours: number
          id: string
          logged_on: string
          note: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          hours: number
          id?: string
          logged_on?: string
          note?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          hours?: number
          id?: string
          logged_on?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      bell_schedules: {
        Row: {
          created_at: string
          id: string
          name: string
          periods: Json
          rotation_anchor: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          periods: Json
          rotation_anchor?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          periods?: Json
          rotation_anchor?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bell_schedules_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      course_averages: {
        Row: {
          average: number | null
          course_id: string
          course_name: string
          recorded_on: string
          student_id: string
        }
        Insert: {
          average?: number | null
          course_id: string
          course_name: string
          recorded_on?: string
          student_id: string
        }
        Update: {
          average?: number | null
          course_id?: string
          course_name?: string
          recorded_on?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_averages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_snapshots: {
        Row: {
          content_hash: string
          courses: Json
          id: number
          student_id: string
          taken_at: string
        }
        Insert: {
          content_hash: string
          courses: Json
          id?: never
          student_id: string
          taken_at?: string
        }
        Update: {
          content_hash?: string
          courses?: Json
          id?: never
          student_id?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_grades: {
        Row: {
          category: string
          course_id: string
          created_at: string
          id: string
          name: string
          score: number
          student_id: string
          total_points: number
        }
        Insert: {
          category: string
          course_id: string
          created_at?: string
          id?: string
          name: string
          score: number
          student_id: string
          total_points: number
        }
        Update: {
          category?: string
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          score?: number
          student_id?: string
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_tasks: {
        Row: {
          completed_at: string | null
          course_id: string | null
          created_at: string
          due_at: string | null
          estimated_minutes: number | null
          hac_assignment_key: string | null
          id: string
          notes: string | null
          source: string
          student_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          due_at?: string | null
          estimated_minutes?: number | null
          hac_assignment_key?: string | null
          id?: string
          notes?: string | null
          source?: string
          student_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          due_at?: string | null
          estimated_minutes?: number | null
          hac_assignment_key?: string | null
          id?: string
          notes?: string | null
          source?: string
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          premium_until: string | null
          theme_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          premium_until?: string | null
          theme_id?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          premium_until?: string | null
          theme_id?: string
        }
        Relationships: []
      }
      student_accounts: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          gpa_scale: Json | null
          hac_base_url: string
          hac_password_enc: string
          hac_username: string
          id: string
          last_synced_at: string | null
          owner_id: string
          school_name: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          gpa_scale?: Json | null
          hac_base_url: string
          hac_password_enc: string
          hac_username: string
          id?: string
          last_synced_at?: string | null
          owner_id?: string
          school_name?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          gpa_scale?: Json | null
          hac_base_url?: string
          hac_password_enc?: string
          hac_username?: string
          id?: string
          last_synced_at?: string | null
          owner_id?: string
          school_name?: string | null
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          courses: Json
          student_id: string
          updated_at: string
        }
        Insert: {
          courses: Json
          student_id: string
          updated_at?: string
        }
        Update: {
          courses?: Json
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_accounts"
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
