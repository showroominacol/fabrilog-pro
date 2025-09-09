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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      detalle_produccion: {
        Row: {
          fecha_creacion: string
          id: string
          porcentaje_cumplimiento: number
          produccion_real: number
          producto_id: string
          registro_id: string
        }
        Insert: {
          fecha_creacion?: string
          id?: string
          porcentaje_cumplimiento?: number
          produccion_real?: number
          producto_id: string
          registro_id: string
        }
        Update: {
          fecha_creacion?: string
          id?: string
          porcentaje_cumplimiento?: number
          produccion_real?: number
          producto_id?: string
          registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_produccion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_produccion_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas: {
        Row: {
          activa: boolean
          descripcion: string | null
          fecha_creacion: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          descripcion?: string | null
          fecha_creacion?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          descripcion?: string | null
          fecha_creacion?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      metas_produccion: {
        Row: {
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          maquina_id: string
          producto_id: string
          turno_10h: number
          turno_8h: number
        }
        Insert: {
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          maquina_id: string
          producto_id: string
          turno_10h?: number
          turno_8h?: number
        }
        Update: {
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          maquina_id?: string
          producto_id?: string
          turno_10h?: number
          turno_8h?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_produccion_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_produccion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          fecha_creacion: string
          id: string
          maquina_id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_creacion?: string
          id?: string
          maquina_id: string
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_creacion?: string
          id?: string
          maquina_id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_asistentes: {
        Row: {
          asistente_id: string
          fecha_creacion: string
          id: string
          registro_id: string
        }
        Insert: {
          asistente_id: string
          fecha_creacion?: string
          id?: string
          registro_id: string
        }
        Update: {
          asistente_id?: string
          fecha_creacion?: string
          id?: string
          registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registro_asistentes_asistente_id_fkey"
            columns: ["asistente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_asistentes_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_produccion: {
        Row: {
          es_asistente: boolean
          fecha: string
          fecha_registro: string
          id: string
          maquina_id: string
          operario_id: string
          turno: Database["public"]["Enums"]["turno_produccion"]
        }
        Insert: {
          es_asistente?: boolean
          fecha: string
          fecha_registro?: string
          id?: string
          maquina_id: string
          operario_id: string
          turno: Database["public"]["Enums"]["turno_produccion"]
        }
        Update: {
          es_asistente?: boolean
          fecha?: string
          fecha_registro?: string
          id?: string
          maquina_id?: string
          operario_id?: string
          turno?: Database["public"]["Enums"]["turno_produccion"]
        }
        Relationships: [
          {
            foreignKeyName: "registros_produccion_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_produccion_operario_id_fkey"
            columns: ["operario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          cedula: string
          fecha_creacion: string
          id: string
          nombre: string
          password_hash: string
          tipo_usuario: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          activo?: boolean
          cedula: string
          fecha_creacion?: string
          id?: string
          nombre: string
          password_hash: string
          tipo_usuario?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          activo?: boolean
          cedula?: string
          fecha_creacion?: string
          id?: string
          nombre?: string
          password_hash?: string
          tipo_usuario?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      turno_produccion:
        | "6:00am - 2:00pm"
        | "2:00pm - 10:00pm"
        | "10:00pm - 6:00am"
        | "7:00am - 5:00pm"
        | "7:00am - 3:00pm"
        | "7:00am - 3:30pm"
      turno_tipo: "6:00am - 2:00pm" | "2:00pm - 10:00pm" | "10:00pm - 6:00am"
      user_type: "operario" | "admin"
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
      turno_produccion: [
        "6:00am - 2:00pm",
        "2:00pm - 10:00pm",
        "10:00pm - 6:00am",
        "7:00am - 5:00pm",
        "7:00am - 3:00pm",
        "7:00am - 3:30pm",
      ],
      turno_tipo: ["6:00am - 2:00pm", "2:00pm - 10:00pm", "10:00pm - 6:00am"],
      user_type: ["operario", "admin"],
    },
  },
} as const
