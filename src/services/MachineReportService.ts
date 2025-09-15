import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';

export interface MachineReportData {
  fecha: string;
  turno: string;
  operario: string;
  asistente: string;
  maquina: string;
  producto: string;
  producido: number;
  porcentajeCumplimiento: number;
  porcentajeSuma: number;
}

export interface MachineReportByCategory {
  categoria: string;
  registros: MachineReportData[];
}

export class MachineReportService {

  /**
   * Obtiene los datos de producción por categoría de máquina
   */
  async generateMachineReport(fechaInicio: Date, fechaFin: Date): Promise<MachineReportByCategory[]> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    // Obtener todos los operarios que trabajaron en el período
    const { data: operarios } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('activo', true);

    if (!operarios) return [];

    // Obtener todas las máquinas activas
    const { data: maquinas } = await supabase
      .from('maquinas')
      .select('id, nombre, categoria')
      .eq('activa', true);

    if (!maquinas) return [];

    // Obtener todos los registros de producción en el rango de fechas
    const { data: registros, error } = await supabase
      .from('registros_produccion')
      .select(`
        id,
        fecha,
        turno,
        es_asistente,
        operario_id,
        maquina_id,
        maquinas!fk_registros_produccion_maquina(
          nombre,
          categoria
        ),
        usuarios!fk_registros_produccion_operario(
          nombre
        ),
        detalle_produccion!fk_detalle_produccion_registro(
          produccion_real,
          porcentaje_cumplimiento,
          productos!fk_detalle_produccion_producto(
            nombre
          )
        )
      `)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: true })
      .order('turno', { ascending: true });

    if (error) {
      throw new Error(`Error fetching production data: ${error.message}`);
    }

    // Calcular porcentajes de suma por operario en el período
    const porcentajesSumaOperarios = await this.calcularPorcentajesSuma(
      registros || [],
      fechaInicio,
      fechaFin
    );

    // Obtener asistentes por registro
    const asistentesMap = await this.obtenerAsistentes(
      registros ? registros.map(r => r.id) : []
    );

    // Generar todos los días del rango
    const allDates = this.generateDateRange(fechaInicio, fechaFin);

    // Agrupar datos por categoría de máquina
    const categorias = new Map<string, MachineReportData[]>();

    // Inicializar categorías
    for (const maquina of maquinas) {
      const categoria = maquina.categoria || 'Sin Categoría';
      if (!categorias.has(categoria)) {
        categorias.set(categoria, []);
      }
    }

    // Generar registros completos para cada operario y cada día
    for (const operario of operarios) {
      for (const fecha of allDates) {
        const fechaStr = fecha.toISOString().split('T')[0];
        
        // Buscar registros del operario en esta fecha
        const registrosDelDia = registros?.filter(r => 
          r.operario_id === operario.id && 
          r.fecha === fechaStr &&
          !r.es_asistente
        ) || [];

        if (registrosDelDia.length > 0) {
          // Procesar registros existentes
          for (const registro of registrosDelDia) {
            const categoria = registro.maquinas?.categoria || 'Sin Categoría';
            const maquinaNombre = registro.maquinas?.nombre || 'N/A';
            const asistentes = asistentesMap.get(registro.id) || [];
            const asistenteNombres = asistentes.length > 0 
              ? asistentes.join(', ') 
              : 'Sin asistente';

            const categoriaDatos = categorias.get(categoria)!;

            // Procesar cada detalle de producción
            if (registro.detalle_produccion && registro.detalle_produccion.length > 0) {
              for (const detalle of registro.detalle_produccion) {
                const porcentajeSuma = porcentajesSumaOperarios.get(registro.operario_id) || 0;

                categoriaDatos.push({
                  fecha: this.formatDate(registro.fecha),
                  turno: this.formatTurno(registro.turno),
                  operario: operario.nombre,
                  asistente: asistenteNombres,
                  maquina: maquinaNombre,
                  producto: detalle.productos?.nombre || 'N/A',
                  producido: detalle.produccion_real || 0,
                  porcentajeCumplimiento: detalle.porcentaje_cumplimiento || 0,
                  porcentajeSuma: porcentajeSuma
                });
              }
            } else {
              // Registro sin detalles de producción
              const porcentajeSuma = porcentajesSumaOperarios.get(registro.operario_id) || 0;

              categoriaDatos.push({
                fecha: this.formatDate(registro.fecha),
                turno: this.formatTurno(registro.turno),
                operario: operario.nombre,
                asistente: asistenteNombres,
                maquina: maquinaNombre,
                producto: 'Sin producto',
                producido: 0,
                porcentajeCumplimiento: 0,
                porcentajeSuma: porcentajeSuma
              });
            }
          }
        } else {
          // Día sin registros - crear entrada vacía para cada categoría donde el operario ha trabajado
          const categoriasOperario = await this.getOperatorCategories(operario.id, fechaInicio, fechaFin);
          
          for (const categoria of categoriasOperario) {
            const categoriaDatos = categorias.get(categoria);
            if (categoriaDatos) {
              const porcentajeSuma = porcentajesSumaOperarios.get(operario.id) || 0;
              
              categoriaDatos.push({
                fecha: this.formatDate(fechaStr),
                turno: 'Sin turno',
                operario: operario.nombre,
                asistente: 'Sin asistente',
                maquina: 'Sin máquina',
                producto: 'Sin producto',
                producido: 0,
                porcentajeCumplimiento: 0,
                porcentajeSuma: porcentajeSuma
              });
            }
          }
        }
      }
    }

    // Convertir Map a array y ordenar
    return Array.from(categorias.entries())
      .filter(([_, registros]) => registros.length > 0) // Solo categorías con datos
      .map(([categoria, registros]) => ({
        categoria,
        registros: registros.sort((a, b) => {
          const dateA = new Date(a.fecha.split('/').reverse().join('-'));
          const dateB = new Date(b.fecha.split('/').reverse().join('-'));
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          return a.operario.localeCompare(b.operario);
        })
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));
  }

  /**
   * Genera un rango de fechas entre dos fechas
   */
  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Obtiene las categorías donde ha trabajado un operario en el período
   */
  private async getOperatorCategories(operarioId: string, fechaInicio: Date, fechaFin: Date): Promise<string[]> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    const { data: registros } = await supabase
      .from('registros_produccion')
      .select(`
        maquinas!fk_registros_produccion_maquina(categoria)
      `)
      .eq('operario_id', operarioId)
      .eq('es_asistente', false)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (!registros) return [];

    const categorias = new Set<string>();
    for (const registro of registros) {
      if (registro.maquinas?.categoria) {
        categorias.add(registro.maquinas.categoria);
      }
    }

    // Si no ha trabajado en ninguna categoría, incluir en una categoría por defecto
    if (categorias.size === 0) {
      return ['General'];
    }

    return Array.from(categorias);
  }

  /**
   * Calcula los porcentajes suma (promedio) por operario en el período
   */
  private async calcularPorcentajesSuma(
    registros: any[],
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<Map<string, number>> {
    const operarioIds = [...new Set(registros.map(r => r.operario_id))];
    const porcentajesSuma = new Map<string, number>();

    for (const operarioId of operarioIds) {
      // Obtener todos los días trabajados del operario en el período
      const diasTrabajados = await this.obtenerDiasTrabajados(operarioId, fechaInicio, fechaFin);
      
      if (diasTrabajados.length > 0) {
        const sumaTotal = diasTrabajados.reduce((sum, dia) => sum + dia.porcentajeTotal, 0);
        const promedio = sumaTotal / diasTrabajados.length;
        porcentajesSuma.set(operarioId, promedio);
      }
    }

    return porcentajesSuma;
  }

  /**
   * Obtiene los días trabajados de un operario con sus porcentajes totales
   */
  private async obtenerDiasTrabajados(
    operarioId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<{ fecha: string; porcentajeTotal: number }[]> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    const { data: registros } = await supabase
      .from('registros_produccion')
      .select(`
        fecha,
        detalle_produccion!fk_detalle_produccion_registro(
          porcentaje_cumplimiento
        )
      `)
      .eq('operario_id', operarioId)
      .eq('es_asistente', false) // Solo como operario principal
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (!registros) return [];

    // Agrupar por fecha y sumar porcentajes
    const diasMap = new Map<string, number>();

    for (const registro of registros) {
      const fecha = registro.fecha;
      
      if (!diasMap.has(fecha)) {
        diasMap.set(fecha, 0);
      }

      if (registro.detalle_produccion) {
        const porcentajeTotal = registro.detalle_produccion.reduce(
          (sum, detalle) => sum + (detalle.porcentaje_cumplimiento || 0),
          0
        );
        diasMap.set(fecha, diasMap.get(fecha)! + porcentajeTotal);
      }
    }

    return Array.from(diasMap.entries()).map(([fecha, porcentajeTotal]) => ({
      fecha,
      porcentajeTotal
    }));
  }

  /**
   * Obtiene los asistentes de cada registro
   */
  private async obtenerAsistentes(registroIds: string[]): Promise<Map<string, string[]>> {
    const { data: asistentes } = await supabase
      .from('registro_asistentes')
      .select(`
        registro_id,
        usuarios!fk_registro_asistentes_asistente(nombre)
      `)
      .in('registro_id', registroIds);

    const asistentesMap = new Map<string, string[]>();

    if (asistentes) {
      for (const asistente of asistentes) {
        const registroId = asistente.registro_id;
        const nombreAsistente = asistente.usuarios?.nombre || 'N/A';

        if (!asistentesMap.has(registroId)) {
          asistentesMap.set(registroId, []);
        }

        asistentesMap.get(registroId)!.push(nombreAsistente);
      }
    }

    return asistentesMap;
  }

  /**
   * Genera y descarga el archivo Excel con las tablas por categoría
   */
  async exportToExcel(
    fechaInicio: Date,
    fechaFin: Date,
    reportData: MachineReportByCategory[]
  ): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Crear una hoja por cada categoría
    for (const categoria of reportData) {
      if (categoria.registros.length === 0) continue;

      const headers = [
        'Fecha',
        'Turno',
        'Operario',
        'Asistente',
        'Máquina',
        'Producto',
        'Producido',
        '% Cumplimiento',
        '% Suma'
      ];

      const sheetData = [
        headers,
        ...categoria.registros.map(registro => [
          registro.fecha,
          registro.turno,
          registro.operario,
          registro.asistente,
          registro.maquina,
          registro.producto,
          registro.producido,
          `${registro.porcentajeCumplimiento.toFixed(1)}%`,
          `${registro.porcentajeSuma.toFixed(1)}%`
        ])
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Aplicar estilos
      this.applyWorksheetStyles(worksheet);
      
      // Usar nombre corto para la hoja (máximo 31 caracteres)
      const sheetName = categoria.categoria.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // Generar nombre de archivo
    const filename = this.generateFilename(fechaInicio, fechaFin);
    
    // Descargar archivo
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, filename);
  }

  /**
   * Aplica estilos a la hoja de cálculo
   */
  private applyWorksheetStyles(worksheet: XLSX.WorkSheet): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:H1');
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { width: 12 }, // Fecha
      { width: 15 }, // Turno
      { width: 20 }, // Operario
      { width: 25 }, // Asistente
      { width: 20 }, // Máquina
      { width: 25 }, // Producto
      { width: 12 }, // Producido
      { width: 15 }, // % Cumplimiento
      { width: 12 }  // % Suma
    ];

    // Aplicar formato a los encabezados
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '366092' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }
  }

  /**
   * Formatea la fecha para mostrar
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Formatea el turno para mostrar
   */
  private formatTurno(turno: string): string {
    // Convertir el turno del enum a formato legible
    switch (turno) {
      case 'manana':
        return '2:00 a 10:00';
      case 'tarde':
        return '10:00 a 6:00';
      case 'noche':
        return '6:00 a 2:00';
      default:
        return turno;
    }
  }

  /**
   * Genera el nombre del archivo
   */
  private generateFilename(fechaInicio: Date, fechaFin: Date): string {
    const inicio = fechaInicio.toISOString().split('T')[0];
    const fin = fechaFin.toISOString().split('T')[0];
    return `reporte_produccion_maquinas_${inicio}_${fin}.xlsx`;
  }
}

export const machineReportService = new MachineReportService();