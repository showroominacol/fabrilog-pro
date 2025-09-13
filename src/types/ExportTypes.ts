export interface ProductionData {
  fecha: string;
  turno: string;
  operario: string;
  seccionadorCortadorPeinador: string;
  maquina: string;
  referencia: string;
  cantidad: number;
  cantidadEnFestones: number;
  metaEnFestones: number;
  porcentajeCumplimiento: number;
  sumaPorcentajeCumplimiento: number;
  pesoAlambreKg: number;
  desperdicioAlambreKg: number;
  calibreAlambre: string;
  desperdicioPvcRipio: number;
  pesoCinta: number;
  observaciones: string;
}

export interface ExportConfig {
  fechaInicio: Date;
  fechaFin: Date;
  areas?: string[];
}

export interface AreaData {
  name: string;
  data: ProductionData[];
}

export interface DatabaseRecord {
  id: string;
  fecha: string;
  turno: string;
  es_asistente: boolean;
  maquinas: { nombre: string; categoria: string } | null;
  usuarios: { nombre: string } | null;
  detalle_produccion: {
    produccion_real: number;
    porcentaje_cumplimiento: number;
    productos: { nombre: string } | null;
  }[];
}

export const AREAS_CONFIG = [
  'MONTERREY',
  '4 CABEZAS', 
  'AMARRADORAS'
] as const;

export type AreaName = typeof AREAS_CONFIG[number];