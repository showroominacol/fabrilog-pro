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
          observaciones: string | null
          porcentaje_cumplimiento: number
          produccion_real: number
          producto_id: string
          registro_id: string
        }
        Insert: {
          fecha_creacion?: string
          id?: string
          observaciones?: string | null
          porcentaje_cumplimiento?: number
          produccion_real?: number
          producto_id: string
          registro_id: string
        }
        Update: {
          fecha_creacion?: string
          id?: string
          observaciones?: string | null
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
          {
            foreignKeyName: "fk_detalle_produccion_producto"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_detalle_produccion_registro"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_ramas_amarradora: {
        Row: {
          cantidad_producida: number
          detalle_produccion_id: string
          fecha_creacion: string
          id: string
          numero_rama: number
          tope_rama: number
        }
        Insert: {
          cantidad_producida?: number
          detalle_produccion_id: string
          fecha_creacion?: string
          id?: string
          numero_rama: number
          tope_rama?: number
        }
        Update: {
          cantidad_producida?: number
          detalle_produccion_id?: string
          fecha_creacion?: string
          id?: string
          numero_rama?: number
          tope_rama?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_ramas_amarradora_detalle_produccion_id_fkey"
            columns: ["detalle_produccion_id"]
            isOneToOne: false
            referencedRelation: "detalle_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      disenos_arboles: {
        Row: {
          activo: boolean
          descripcion: string | null
          fecha_creacion: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          fecha_creacion?: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          fecha_creacion?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      maquinas: {
        Row: {
          activa: boolean
          categoria: string | null
          descripcion: string | null
          fecha_creacion: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          categoria?: string | null
          descripcion?: string | null
          fecha_creacion?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          categoria?: string | null
          descripcion?: string | null
          fecha_creacion?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      niveles_ramas: {
        Row: {
          activo: boolean
          diseno_id: string
          fecha_creacion: string
          festones_por_rama: number
          id: string
          nivel: number
        }
        Insert: {
          activo?: boolean
          diseno_id: string
          fecha_creacion?: string
          festones_por_rama: number
          id?: string
          nivel: number
        }
        Update: {
          activo?: boolean
          diseno_id?: string
          fecha_creacion?: string
          festones_por_rama?: number
          id?: string
          nivel?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_niveles_ramas_diseno"
            columns: ["diseno_id"]
            isOneToOne: false
            referencedRelation: "disenos_arboles"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria: string | null
          diseno_id: string | null
          fecha_creacion: string
          id: string
          nombre: string
          tipo_producto: string
          tope: number | null
          tope_jornada_10h: number | null
          tope_jornada_8h: number | null
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          diseno_id?: string | null
          fecha_creacion?: string
          id?: string
          nombre: string
          tipo_producto?: string
          tope?: number | null
          tope_jornada_10h?: number | null
          tope_jornada_8h?: number | null
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          diseno_id?: string | null
          fecha_creacion?: string
          id?: string
          nombre?: string
          tipo_producto?: string
          tope?: number | null
          tope_jornada_10h?: number | null
          tope_jornada_8h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_productos_diseno"
            columns: ["diseno_id"]
            isOneToOne: false
            referencedRelation: "disenos_arboles"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_maquinas: {
        Row: {
          fecha_creacion: string
          id: string
          maquina_id: string
          producto_id: string
        }
        Insert: {
          fecha_creacion?: string
          id?: string
          maquina_id: string
          producto_id: string
        }
        Update: {
          fecha_creacion?: string
          id?: string
          maquina_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_productos_maquinas_maquina"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_productos_maquinas_producto"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ramas_amarradora: {
        Row: {
          activo: boolean
          diseno_id: string
          fecha_creacion: string
          id: string
          numero_rama: number
          tope_rama: number
        }
        Insert: {
          activo?: boolean
          diseno_id: string
          fecha_creacion?: string
          id?: string
          numero_rama: number
          tope_rama?: number
        }
        Update: {
          activo?: boolean
          diseno_id?: string
          fecha_creacion?: string
          id?: string
          numero_rama?: number
          tope_rama?: number
        }
        Relationships: [
          {
            foreignKeyName: "ramas_amarradora_diseno_id_fkey"
            columns: ["diseno_id"]
            isOneToOne: false
            referencedRelation: "disenos_arboles"
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
            foreignKeyName: "fk_registro_asistentes_asistente"
            columns: ["asistente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_registro_asistentes_registro"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_produccion"
            referencedColumns: ["id"]
          },
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
          id_consecutivo: string | null
          maquina_id: string
          operario_id: string
          turno: Database["public"]["Enums"]["turno_produccion"]
        }
        Insert: {
          es_asistente?: boolean
          fecha: string
          fecha_registro?: string
          id?: string
          id_consecutivo?: string | null
          maquina_id: string
          operario_id: string
          turno: Database["public"]["Enums"]["turno_produccion"]
        }
        Update: {
          es_asistente?: boolean
          fecha?: string
          fecha_registro?: string
          id?: string
          id_consecutivo?: string | null
          maquina_id?: string
          operario_id?: string
          turno?: Database["public"]["Enums"]["turno_produccion"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_registros_produccion_maquina"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_registros_produccion_operario"
            columns: ["operario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
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
      consultar_cumplimiento_operario: {
        Args: {
          cedula_operario: string
          fecha_fin: string
          fecha_inicio: string
        }
        Returns: Record<string, unknown>[]
      }
      generar_id_consecutivo: {
        Args: { p_maquina_id: string }
        Returns: string
      }
      get_user_for_auth: {
        Args: { p_cedula: string }
        Returns: {
          activo: boolean
          cedula: string
          id: string
          nombre: string
          password_hash: string
          tipo_usuario: Database["public"]["Enums"]["user_type"]
        }[]
      }
      get_usuario_by_cedula: {
        Args: { p_cedula: string }
        Returns: {
          activo: boolean
          cedula: string
          id: string
          nombre: string
          tipo_usuario: Database["public"]["Enums"]["user_type"]
        }[]
      }
      get_usuarios_list: {
        Args: never
        Returns: {
          activo: boolean
          cedula: string
          fecha_creacion: string
          id: string
          nombre: string
          tipo_usuario: Database["public"]["Enums"]["user_type"]
        }[]
      }
    }
    Enums: {
      turno_produccion:
        | "6:00am - 2:00pm"
        | "2:00pm - 10:00pm"
        | "10:00pm - 6:00am"
        | "7:00am - 5:00pm"
        | "7:00am - 3:00pm"
        | "7:00am - 3:30pm"
        | "12:00pm - 6:00pm"
        | "2:00pm - 5:00pm"
      turno_tipo: "6:00am - 2:00pm" | "2:00pm - 10:00pm" | "10:00pm - 6:00am"
      user_type: "operario" | "admin" | "escribano"
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
        "12:00pm - 6:00pm",
        "2:00pm - 5:00pm",
      ],
      turno_tipo: ["6:00am - 2:00pm", "2:00pm - 10:00pm", "10:00pm - 6:00am"],
      user_type: ["operario", "admin", "escribano"],
    },
  },
} as const
