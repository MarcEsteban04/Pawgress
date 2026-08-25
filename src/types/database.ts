/**
 * Generated database types — DO NOT EDIT BY HAND.
 *
 * Regenerate after every migration:
 *   npm run db:types:remote   # from the linked hosted project
 *   npm run db:types          # from the local stack (needs Docker)
 *
 * Committed rather than gitignored on purpose: a typecheck must not depend on
 * a database being reachable.
 */
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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          earned_at: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          code: string
          earned_at?: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          code?: string
          earned_at?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          last_seen_at: string | null
          reviewer_id: string | null
          source_material_id: string | null
          source_page: number | null
          subject_id: string
          times_known: number
          times_seen: number
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          last_seen_at?: string | null
          reviewer_id?: string | null
          source_material_id?: string | null
          source_page?: number | null
          subject_id: string
          times_known?: number
          times_seen?: number
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          last_seen_at?: string | null
          reviewer_id?: string | null
          source_material_id?: string | null
          source_page?: number | null
          subject_id?: string
          times_known?: number
          times_seen?: number
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_reviewer_fkey"
            columns: ["reviewer_id", "user_id"]
            isOneToOne: false
            referencedRelation: "reviewers"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "flashcards_source_material_fkey"
            columns: ["source_material_id", "user_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "flashcards_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "flashcards_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      material_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          material_id: string
          page_from: number | null
          page_to: number | null
          token_count: number | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          material_id: string
          page_from?: number | null
          page_to?: number | null
          token_count?: number | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          material_id?: string
          page_from?: number | null
          page_to?: number | null
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_chunks_material_fkey"
            columns: ["material_id", "user_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      materials: {
        Row: {
          byte_size: number | null
          content_hash: string | null
          created_at: string
          extracted_text: string | null
          failure_message: string | null
          failure_next_step: string | null
          id: string
          kind: Database["public"]["Enums"]["material_kind"]
          page_count: number | null
          processed_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          storage_path: string | null
          subject_id: string
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          extracted_text?: string | null
          failure_message?: string | null
          failure_next_step?: string | null
          id?: string
          kind: Database["public"]["Enums"]["material_kind"]
          page_count?: number | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string | null
          subject_id: string
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          extracted_text?: string | null
          failure_message?: string | null
          failure_next_step?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["material_kind"]
          page_count?: number | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string | null
          subject_id?: string
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "materials_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      planner_events: {
        Row: {
          completed_at: string | null
          created_at: string
          due_on: string
          due_time: string | null
          id: string
          kind: Database["public"]["Enums"]["planner_event_kind"]
          notes: string | null
          subject_id: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_on: string
          due_time?: string | null
          id?: string
          kind: Database["public"]["Enums"]["planner_event_kind"]
          notes?: string | null
          subject_id?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_on?: string
          due_time?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["planner_event_kind"]
          notes?: string | null
          subject_id?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_events_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "planner_events_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          preferred_session_minutes: number
          school: string | null
          timezone: string
          updated_at: string
          year_level: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          preferred_session_minutes?: number
          school?: string | null
          timezone?: string
          updated_at?: string
          year_level?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          preferred_session_minutes?: number
          school?: string | null
          timezone?: string
          updated_at?: string
          year_level?: string | null
        }
        Relationships: []
      }
      progress: {
        Row: {
          id: string
          last_practised_at: string | null
          mastery: number
          questions_answered: number
          questions_correct: number
          subject_id: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_practised_at?: string | null
          mastery?: number
          questions_answered?: number
          questions_correct?: number
          subject_id: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_practised_at?: string | null
          mastery?: number
          questions_answered?: number
          questions_correct?: number
          subject_id?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "progress_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          given_answer: string | null
          graded_by_ai: boolean
          id: string
          is_correct: boolean | null
          question_id: string
          student_override: boolean | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          given_answer?: string | null
          graded_by_ai?: boolean
          id?: string
          is_correct?: boolean | null
          question_id: string
          student_override?: boolean | null
          user_id: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          given_answer?: string | null
          graded_by_ai?: boolean
          id?: string
          is_correct?: boolean | null
          question_id?: string
          student_override?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_fkey"
            columns: ["attempt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quiz_answers_question_fkey"
            columns: ["question_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          duration_seconds: number | null
          id: string
          quiz_id: string
          score_correct: number | null
          score_total: number | null
          started_at: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          id?: string
          quiz_id: string
          score_correct?: number | null
          score_total?: number | null
          started_at?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          id?: string
          quiz_id?: string
          score_correct?: number | null
          score_total?: number | null
          started_at?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_fkey"
            columns: ["quiz_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          choices: Json
          correct_answer: string
          created_at: string
          explanation: string | null
          id: string
          position: number
          prompt: string
          quiz_id: string
          source_material_id: string | null
          source_page: number | null
          topic_id: string | null
          type: Database["public"]["Enums"]["question_type"]
          user_id: string
        }
        Insert: {
          choices?: Json
          correct_answer: string
          created_at?: string
          explanation?: string | null
          id?: string
          position: number
          prompt: string
          quiz_id: string
          source_material_id?: string | null
          source_page?: number | null
          topic_id?: string | null
          type: Database["public"]["Enums"]["question_type"]
          user_id: string
        }
        Update: {
          choices?: Json
          correct_answer?: string
          created_at?: string
          explanation?: string | null
          id?: string
          position?: number
          prompt?: string
          quiz_id?: string
          source_material_id?: string | null
          source_page?: number | null
          topic_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_fkey"
            columns: ["quiz_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quiz_questions_source_material_fkey"
            columns: ["source_material_id", "user_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quiz_questions_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          is_mock_exam: boolean
          question_count: number
          source_material_ids: string[]
          status: Database["public"]["Enums"]["job_status"]
          subject_id: string
          time_limit_seconds: number | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          id?: string
          is_mock_exam?: boolean
          question_count?: number
          source_material_ids?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          subject_id: string
          time_limit_seconds?: number | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          is_mock_exam?: boolean
          question_count?: number
          source_material_ids?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          subject_id?: string
          time_limit_seconds?: number | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quizzes_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      reviewers: {
        Row: {
          content: Json
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["reviewer_kind"]
          source_material_ids: string[]
          status: Database["public"]["Enums"]["job_status"]
          subject_id: string
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reviewer_kind"]
          source_material_ids?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          subject_id: string
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reviewer_kind"]
          source_material_ids?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          subject_id?: string
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewers_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "reviewers_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      study_plan_items: {
        Row: {
          activity: Database["public"]["Enums"]["plan_activity"]
          completed_at: string | null
          id: string
          minutes: number
          plan_id: string
          position: number
          reason: string | null
          subject_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          activity: Database["public"]["Enums"]["plan_activity"]
          completed_at?: string | null
          id?: string
          minutes: number
          plan_id: string
          position: number
          reason?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          activity?: Database["public"]["Enums"]["plan_activity"]
          completed_at?: string | null
          id?: string
          minutes?: number
          plan_id?: string
          position?: number
          reason?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_items_plan_fkey"
            columns: ["plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "study_plan_items_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "study_plan_items_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      study_plans: {
        Row: {
          generated_at: string
          id: string
          plan_date: string
          rationale: Json
          total_minutes: number
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          plan_date: string
          rationale?: Json
          total_minutes?: number
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          plan_date?: string
          rationale?: Json
          total_minutes?: number
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          activity: Database["public"]["Enums"]["study_activity"]
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          subject_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          activity: Database["public"]["Enums"]["study_activity"]
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          activity?: Database["public"]["Enums"]["study_activity"]
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "study_sessions_topic_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subjects: {
        Row: {
          academic_year: number | null
          archived_at: string | null
          color_slot: number
          created_at: string
          icon: string | null
          id: string
          name: string
          semester: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year?: number | null
          archived_at?: string | null
          color_slot?: number
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          semester?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: number | null
          archived_at?: string | null
          color_slot?: number
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          semester?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
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
      job_status:
        | "queued"
        | "uploading"
        | "extracting"
        | "embedding"
        | "generating"
        | "ready"
        | "failed"
        | "cancelled"
        | "over_quota"
      material_kind: "pdf" | "pptx" | "docx" | "image" | "note"
      plan_activity: "review" | "practice" | "quiz" | "flashcards"
      planner_event_kind:
        | "exam"
        | "quiz"
        | "assignment"
        | "project"
        | "presentation"
        | "study_session"
      question_type: "mcq" | "true_false" | "identification" | "short_answer"
      reviewer_kind: "summary" | "key_terms" | "concepts" | "practice"
      study_activity: "review" | "practice" | "quiz" | "flashcards" | "reading"
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
      job_status: [
        "queued",
        "uploading",
        "extracting",
        "embedding",
        "generating",
        "ready",
        "failed",
        "cancelled",
        "over_quota",
      ],
      material_kind: ["pdf", "pptx", "docx", "image", "note"],
      plan_activity: ["review", "practice", "quiz", "flashcards"],
      planner_event_kind: [
        "exam",
        "quiz",
        "assignment",
        "project",
        "presentation",
        "study_session",
      ],
      question_type: ["mcq", "true_false", "identification", "short_answer"],
      reviewer_kind: ["summary", "key_terms", "concepts", "practice"],
      study_activity: ["review", "practice", "quiz", "flashcards", "reading"],
    },
  },
} as const
