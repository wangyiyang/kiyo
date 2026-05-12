export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      album_songs: {
        Row: {
          album_id: string
          created_at: string | null
          order_index: number
          song_id: string
        }
        Insert: {
          album_id: string
          created_at?: string | null
          order_index?: number
          song_id: string
        }
        Update: {
          album_id?: string
          created_at?: string | null
          order_index?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_songs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          cover_file_path: string | null
          cover_status: string
          cover_url: string | null
          created_at: string | null
          description: string | null
          genre: string | null
          id: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_file_path?: string | null
          cover_status?: string
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_file_path?: string | null
          cover_status?: string
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          contact: string | null
          created_at: string | null
          description: string
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string | null
          description: string
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string | null
          description?: string
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      generation_tasks: {
        Row: {
          album_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number
          payload: Json
          result: Json | null
          retry_count: number
          song_id: string | null
          started_at: string | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          album_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          payload?: Json
          result?: Json | null
          retry_count?: number
          song_id?: string | null
          started_at?: string | null
          status?: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          album_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          payload?: Json
          result?: Json | null
          retry_count?: number
          song_id?: string | null
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_tasks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_tasks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      lyrics: {
        Row: {
          ai_prompt: string | null
          content: string
          created_at: string | null
          id: string
          language: string | null
          mood: string | null
          source: string
          status: string
          style: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_prompt?: string | null
          content: string
          created_at?: string | null
          id?: string
          language?: string | null
          mood?: string | null
          source?: string
          status?: string
          style?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_prompt?: string | null
          content?: string
          created_at?: string | null
          id?: string
          language?: string | null
          mood?: string | null
          source?: string
          status?: string
          style?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          album_id: string | null
          created_at: string | null
          id: string
          is_read: boolean
          song_id: string | null
          subtype: string
          target_url: string | null
          template_key: string
          template_params: Json
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          album_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          song_id?: string | null
          subtype: string
          target_url?: string | null
          template_key: string
          template_params?: Json
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          album_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          song_id?: string | null
          subtype?: string
          target_url?: string | null
          template_key?: string
          template_params?: Json
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string | null
          id: string
          key: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          key: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          ai_prompt: string | null
          audio_url: string | null
          cover_file_path: string | null
          cover_status: string
          cover_url: string | null
          created_at: string | null
          duration: number | null
          file_path: string | null
          genre: string | null
          id: string
          is_featured: boolean | null
          lyric_id: string | null
          mood: string | null
          original_song_id: string | null
          source: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
          voice_style: string | null
        }
        Insert: {
          ai_prompt?: string | null
          audio_url?: string | null
          cover_file_path?: string | null
          cover_status?: string
          cover_url?: string | null
          created_at?: string | null
          duration?: number | null
          file_path?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean | null
          lyric_id?: string | null
          mood?: string | null
          original_song_id?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
          voice_style?: string | null
        }
        Update: {
          ai_prompt?: string | null
          audio_url?: string | null
          cover_file_path?: string | null
          cover_status?: string
          cover_url?: string | null
          created_at?: string | null
          duration?: number | null
          file_path?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean | null
          lyric_id?: string | null
          mood?: string | null
          original_song_id?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          voice_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_lyric_id_fkey"
            columns: ["lyric_id"]
            isOneToOne: false
            referencedRelation: "lyrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_original_song_id_fkey"
            columns: ["original_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_pending_task: {
        Args: { task_type: string }
        Returns: {
          album_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number
          payload: Json
          result: Json | null
          retry_count: number
          song_id: string | null
          started_at: string | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "generation_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_user_data: { Args: { target_user_id: string }; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

