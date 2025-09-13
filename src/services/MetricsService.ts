import { supabase } from '@/integrations/supabase/client';

export interface DailyMetrics {
  fecha: string;
  porcentajeCumplimiento: number;
  produccionReal: number;
  metaTotal: number;
  tipoBono: 'positivo' | 'neutro' | 'negativo';
  esOperario: boolean;
  productos: {
    nombre: string;
    produccionReal: number;
    meta: number;
    porcentaje: number;
  }[];
}

export interface BonusClassification {
  diasBonoPositivo: number;
  diasNeutros: number;
  diasPenalizacion: number;
}

export interface OperatorMetrics {
  operarioId: string;
  operarioNombre: string;
  promedioMensual: number;
  diasLaborales: number;
  diasConProduccion: number;
  clasificacionBonos: BonusClassification;
  metricasDiarias: DailyMetrics[];
}

export class MetricsService {
  
  /**
   * Calcula si una fecha es domingo
   */
  private isDomingo(fecha: Date): boolean {
    return fecha.getDay() === 0;
  }

  /**
   * Obtiene fechas laborales (excluyendo domingos) en un rango
   */
  private getFechasLaborales(fechaInicio: Date, fechaFin: Date): Date[] {
    const fechas: Date[] = [];
    const current = new Date(fechaInicio);
    
    while (current <= fechaFin) {
      if (!this.isDomingo(current)) {
        fechas.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    return fechas;
  }

  /**
   * Clasifica el tipo de bono basado en el porcentaje
   */
  private clasificarBono(porcentaje: number): 'positivo' | 'neutro' | 'negativo' {
    if (porcentaje >= 80) return 'positivo';
    if (porcentaje >= 50) return 'neutro';
    return 'negativo';
  }

  /**
   * Calcula las métricas diarias de un operario en un rango de fechas
   */
  async calcularMetricasDiarias(
    operarioId: string, 
    fechaInicio: Date, 
    fechaFin: Date
  ): Promise<DailyMetrics[]> {
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
    const fechaFinStr = fechaFin.toISOString().split('T')[0];

    // Obtener registros del operario en el rango de fechas
    const { data: registros } = await supabase
      .from('registros_produccion')
      .select(`
        *,
        maquinas!fk_registros_produccion_maquina(id, nombre, categoria),
        detalle_produccion!fk_detalle_produccion_registro(
          *,
          productos!fk_detalle_produccion_producto(nombre, categoria)
        )
      `)
      .eq('operario_id', operarioId)
      .gte('fecha', fechaInicioStr)
      .lte('fecha', fechaFinStr)
      .order('fecha');

    if (!registros) return [];

    // Agrupar registros por fecha
    const registrosPorFecha = registros.reduce((acc, registro) => {
      const fecha = registro.fecha;
      if (!acc[fecha]) {
        acc[fecha] = [];
      }
      acc[fecha].push(registro);
      return acc;
    }, {} as Record<string, typeof registros>);

    const metricas: DailyMetrics[] = [];

    for (const [fecha, registrosDia] of Object.entries(registrosPorFecha)) {
      // Solo procesar si no es domingo
      const fechaObj = new Date(fecha);
      if (this.isDomingo(fechaObj)) continue;

      let produccionTotalDia = 0;
      let metaTotalDia = 0;
      const productosDetalle: DailyMetrics['productos'] = [];
      
      // Verificar si actuó como operario principal (no asistente)
      const esOperario = registrosDia.some(r => !r.es_asistente);

      for (const registro of registrosDia) {
        // Solo contar producción cuando es operario principal para el cálculo de bonos
        if (!registro.es_asistente && registro.detalle_produccion) {
          for (const detalle of registro.detalle_produccion) {
            const maquina = (registro as any).maquinas;
            
            // Obtener meta del producto para esta máquina
            const { data: metaData } = await supabase
              .from('metas_produccion')
              .select('turno_8h, turno_10h')
              .eq('maquina_id', maquina?.id)
              .eq('producto_id', detalle.producto_id)
              .single();

            // Usar meta según el turno (por simplicidad usamos turno_8h por defecto)
            const meta = metaData?.turno_8h || 0;
            
            produccionTotalDia += detalle.produccion_real;
            metaTotalDia += meta;

            if (detalle.productos) {
              const porcentajeProducto = meta > 0 ? (detalle.produccion_real / meta) * 100 : 0;
              
              productosDetalle.push({
                nombre: (detalle.productos as any).nombre,
                produccionReal: detalle.produccion_real,
                meta: meta,
                porcentaje: porcentajeProducto
              });
            }
          }
        }
      }

      // Calcular porcentaje de cumplimiento diario
      const porcentajeCumplimiento = metaTotalDia > 0 ? (produccionTotalDia / metaTotalDia) * 100 : 0;
      const tipoBono = this.clasificarBono(porcentajeCumplimiento);

      metricas.push({
        fecha,
        porcentajeCumplimiento,
        produccionReal: produccionTotalDia,
        metaTotal: metaTotalDia,
        tipoBono,
        esOperario,
        productos: productosDetalle
      });
    }

    return metricas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }

  /**
   * Obtiene métricas del operario para los últimos 7 días laborales
   */
  async getOperarioWeeklyMetrics(operarioId: string): Promise<DailyMetrics[]> {
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaFin.getDate() - 14); // Ir más atrás para asegurar 7 días laborales

    const todasLasMetricas = await this.calcularMetricasDiarias(operarioId, fechaInicio, fechaFin);
    
    // Filtrar solo días laborales donde actuó como operario y tomar los últimos 7
    const metricasOperario = todasLasMetricas
      .filter(m => m.esOperario)
      .slice(-7);

    return metricasOperario;
  }

  /**
   * Calcula las métricas completas de un operario para un período
   */
  async calcularMetricasOperario(
    operarioId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<OperatorMetrics | null> {
    // Obtener información del operario
    const { data: operario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', operarioId)
      .single();

    if (!operario) return null;

    // Calcular métricas diarias
    const metricasDiarias = await this.calcularMetricasDiarias(operarioId, fechaInicio, fechaFin);
    
    // Filtrar solo días donde actuó como operario principal
    const metricasOperario = metricasDiarias.filter(m => m.esOperario);
    
    // Obtener fechas laborales en el período
    const fechasLaborales = this.getFechasLaborales(fechaInicio, fechaFin);
    
    // Calcular promedio de cumplimiento
    const sumaPorcentajes = metricasOperario.reduce((sum, m) => sum + m.porcentajeCumplimiento, 0);
    const promedioMensual = metricasOperario.length > 0 ? sumaPorcentajes / metricasOperario.length : 0;

    // Clasificar bonos
    const clasificacion = metricasOperario.reduce((acc, m) => {
      switch (m.tipoBono) {
        case 'positivo':
          acc.diasBonoPositivo++;
          break;
        case 'neutro':
          acc.diasNeutros++;
          break;
        case 'negativo':
          acc.diasPenalizacion++;
          break;
      }
      return acc;
    }, { diasBonoPositivo: 0, diasNeutros: 0, diasPenalizacion: 0 });

    return {
      operarioId,
      operarioNombre: operario.nombre,
      promedioMensual,
      diasLaborales: fechasLaborales.length,
      diasConProduccion: metricasOperario.length,
      clasificacionBonos: clasificacion,
      metricasDiarias
    };
  }

  /**
   * Obtiene métricas de cumplimiento diario del operario actual
   */
  async getOperarioDailyMetrics(operarioId: string): Promise<DailyMetrics | null> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const metricas = await this.calcularMetricasDiarias(operarioId, hoy, hoy);
    
    return metricas.length > 0 ? metricas[0] : null;
  }

  /**
   * Genera reporte consolidado para administradores
   */
  async generarReporteConsolidado(
    fechaInicio: Date,
    fechaFin: Date,
    operarioIds?: string[]
  ): Promise<OperatorMetrics[]> {
    let operarios: string[] = [];

    if (operarioIds) {
      operarios = operarioIds;
    } else {
      // Obtener todos los operarios activos
      const { data: todosOperarios } = await supabase
        .from('usuarios')
        .select('id')
        .eq('activo', true)
        .eq('tipo_usuario', 'operario');
      
      operarios = todosOperarios?.map(u => u.id) || [];
    }

    const reportes: OperatorMetrics[] = [];

    for (const operarioId of operarios) {
      const metricas = await this.calcularMetricasOperario(operarioId, fechaInicio, fechaFin);
      if (metricas && metricas.diasConProduccion > 0) {
        reportes.push(metricas);
      }
    }

    // Ordenar por promedio de cumplimiento descendente
    return reportes.sort((a, b) => b.promedioMensual - a.promedioMensual);
  }
}

export const metricsService = new MetricsService();