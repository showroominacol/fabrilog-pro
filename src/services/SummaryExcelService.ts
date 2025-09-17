import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';

export interface EmployeeData {
  id: string;
  nombre: string;
  diasXLaborar: number;
  diasRealLaborados: number;
  observacion: string;
  bloques: CategoryBlock[];
}

export interface CategoryBlock {
  categoria: string;
  operario: BlockData;
  ayudante: BlockData;
}

export interface BlockData {
  porcentaje: number;
  dias: number;
  horas: string;
  maquinas: MachineData[];
}

export interface MachineData {
  nombre: string;
  porcentaje: number;
  dias: number;
  horas: string;
}

export interface RegistroProduccion {
  id: string;
  fecha: string;
  turno: string;
  es_asistente: boolean;
  maquinas?: {
    nombre?: string;
    categoria?: string;
  };
  detalle_produccion?: {
    produccion_real: number;
    productos?: {
      nombre?: string;
      tope?: number;
    };
  }[];
}

export class SummaryExcelService {

  /**
   * Genera el reporte resumen según el formato especificado
   */
  async generateSummaryReport(fechaInicio: Date, fechaFin: Date): Promise<void> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    // Obtener datos de empleados
    const employeeData = await this.getEmployeeData(fechaInicio, fechaFin);
    
    // Generar Excel
    await this.exportToExcel(employeeData, fechaInicio, fechaFin);
  }

  /**
   * Obtiene y procesa los datos de todos los empleados para el período
   */
  private async getEmployeeData(fechaInicio: Date, fechaFin: Date): Promise<EmployeeData[]> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    // Obtener todos los empleados activos
    const { data: empleados } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');

    if (!empleados) return [];

    // Calcular días totales del período
    const diasXLaborar = this.calculateWorkingDays(fechaInicio, fechaFin);

    // Obtener todas las categorías de máquinas
    const { data: categorias } = await supabase
      .from('maquinas')
      .select('categoria')
      .eq('activa', true);

    const categoriasUnicas = [...new Set(categorias?.map(c => c.categoria).filter(Boolean))];

    const employeeDataPromises = empleados.map(async (empleado) => {
      // Obtener días realmente laborados
      const diasRealLaborados = await this.getRealWorkedDays(empleado.id, fechaInicio, fechaFin);

      // Generar bloques por categoría
      const bloques = await Promise.all(
        categoriasUnicas.map(categoria => this.generateCategoryBlock(empleado.id, categoria!, fechaInicio, fechaFin))
      );

      return {
        id: empleado.id,
        nombre: empleado.nombre,
        diasXLaborar,
        diasRealLaborados,
        observacion: '', // Siempre vacía según requerimientos
        bloques: bloques.filter(bloque => bloque !== null) as CategoryBlock[]
      };
    });

    return await Promise.all(employeeDataPromises);
  }

  /**
   * Calcula los días laborales del período (excluyendo fines de semana)
   */
  private calculateWorkingDays(fechaInicio: Date, fechaFin: Date): number {
    let count = 0;
    const currentDate = new Date(fechaInicio);
    
    while (currentDate <= fechaFin) {
      const dayOfWeek = currentDate.getDay();
      // Excluir domingos (0) y sábados (6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Obtiene los días realmente laborados por un empleado
   */
  private async getRealWorkedDays(empleadoId: string, fechaInicio: Date, fechaFin: Date): Promise<number> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    const { data: registros } = await supabase
      .from('registros_produccion')
      .select('fecha')
      .eq('operario_id', empleadoId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (!registros) return 0;

    // Contar fechas únicas
    const fechasUnicas = new Set(registros.map(r => r.fecha));
    return fechasUnicas.size;
  }

  /**
   * Genera el bloque de datos para una categoría específica
   */
  private async generateCategoryBlock(
    empleadoId: string,
    categoria: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<CategoryBlock | null> {
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];

    // Obtener registros del empleado en esta categoría
    const { data: registros } = await supabase
      .from('registros_produccion')
      .select(`
        id,
        fecha,
        turno,
        es_asistente,
        maquinas!fk_registros_produccion_maquina(
          nombre,
          categoria
        ),
        detalle_produccion!fk_detalle_produccion_registro(
          produccion_real,
          productos!fk_detalle_produccion_producto(
            nombre,
            tope
          )
        )
      `)
      .eq('operario_id', empleadoId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (!registros) return null;

    // Filtrar por categoría
    const registrosCategoria = registros.filter(r => 
      r.maquinas?.categoria === categoria
    );

    if (registrosCategoria.length === 0) return null;

    // Separar operario y ayudante
    const registrosOperario = registrosCategoria.filter(r => !r.es_asistente);
    const registrosAyudante = registrosCategoria.filter(r => r.es_asistente);

    const operarioData = await this.generateBlockData(registrosOperario, fechaInicio, fechaFin);
    const ayudanteData = await this.generateBlockData(registrosAyudante, fechaInicio, fechaFin);

    return {
      categoria,
      operario: operarioData,
      ayudante: ayudanteData
    };
  }

  /**
   * Genera los datos de un bloque (operario o ayudante)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateBlockData(registros: any[], fechaInicio: Date, fechaFin: Date): Promise<BlockData> {
    if (registros.length === 0) {
      return {
        porcentaje: 0,
        dias: 0,
        horas: '',
        maquinas: []
      };
    }

    // Calcular porcentajes diarios
    const porcentajesPorDia = new Map<string, number>();
    const turnosPorDia = new Map<string, string>();
    const maquinasPorDia = new Map<string, Set<string>>();

    for (const registro of registros) {
      const fecha = registro.fecha;
      
      if (!porcentajesPorDia.has(fecha)) {
        porcentajesPorDia.set(fecha, 0);
        turnosPorDia.set(fecha, this.formatTurno(registro.turno));
        maquinasPorDia.set(fecha, new Set());
      }

      // Agregar máquina
      if (registro.maquinas?.nombre) {
        maquinasPorDia.get(fecha)!.add(registro.maquinas.nombre);
      }

      // Calcular porcentaje del día
      if (registro.detalle_produccion) {
        for (const detalle of registro.detalle_produccion) {
          const tope = detalle.productos?.tope || 0;
          const porcentajeProducto = tope > 0 ? (detalle.produccion_real / tope) * 100 : 0;
          porcentajesPorDia.set(fecha, porcentajesPorDia.get(fecha)! + porcentajeProducto);
        }
      }
    }

    // Calcular promedio de porcentajes
    const porcentajes = Array.from(porcentajesPorDia.values());
    const porcentajePromedio = porcentajes.length > 0 ? 
      porcentajes.reduce((sum, p) => sum + p, 0) / porcentajes.length : 0;

    // Obtener días y turnos
    const dias = porcentajesPorDia.size;
    const turnosUnicos = [...new Set(Array.from(turnosPorDia.values()))];
    const horas = turnosUnicos.join(', ');

    // Generar datos por máquina
    const maquinasData = await this.generateMachineData(registros);

    return {
      porcentaje: Math.round(porcentajePromedio * 10) / 10, // Redondear a 1 decimal
      dias,
      horas,
      maquinas: maquinasData
    };
  }

  /**
   * Genera los datos específicos por máquina
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateMachineData(registros: any[]): Promise<MachineData[]> {
    const maquinasMap = new Map<string, {
      porcentajes: number[];
      dias: Set<string>;
      turnos: Set<string>;
    }>();

    for (const registro of registros) {
      const maquinaNombre = registro.maquinas?.nombre || 'Sin máquina';
      
      if (!maquinasMap.has(maquinaNombre)) {
        maquinasMap.set(maquinaNombre, {
          porcentajes: [],
          dias: new Set(),
          turnos: new Set()
        });
      }

      const maquinaData = maquinasMap.get(maquinaNombre)!;
      maquinaData.dias.add(registro.fecha);
      maquinaData.turnos.add(this.formatTurno(registro.turno));

      // Calcular porcentaje del registro
      let porcentajeRegistro = 0;
      if (registro.detalle_produccion) {
        for (const detalle of registro.detalle_produccion) {
          const tope = detalle.productos?.tope || 0;
          const porcentajeProducto = tope > 0 ? (detalle.produccion_real / tope) * 100 : 0;
          porcentajeRegistro += porcentajeProducto;
        }
      }
      maquinaData.porcentajes.push(porcentajeRegistro);
    }

    return Array.from(maquinasMap.entries()).map(([nombre, data]) => {
      const porcentajePromedio = data.porcentajes.length > 0 ?
        data.porcentajes.reduce((sum, p) => sum + p, 0) / data.porcentajes.length : 0;

      return {
        nombre,
        porcentaje: Math.round(porcentajePromedio * 10) / 10,
        dias: data.dias.size,
        horas: Array.from(data.turnos).join(', ')
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Formatea el turno para mostrar
   */
  private formatTurno(turno: string): string {
    switch (turno) {
      case 'manana':
        return '7:00am - 3:30pm';
      case 'tarde':
        return '3:30pm - 11:30pm';
      case 'noche':
        return '11:30pm - 7:00am';
      default:
        return turno;
    }
  }

  /**
   * Genera y descarga el archivo Excel con el formato específico
   */
  private async exportToExcel(employeeData: EmployeeData[], fechaInicio: Date, fechaFin: Date): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Obtener todas las categorías únicas
    const todasCategorias = [...new Set(
      employeeData.flatMap(emp => emp.bloques.map(bloque => bloque.categoria))
    )].sort();

    // Crear encabezados dinámicos
    const headers = this.createHeaders(todasCategorias);
    
    // Crear datos de filas
    const rows = this.createDataRows(employeeData, todasCategorias);

    // Combinar encabezados y datos
    const sheetData = [...headers, ...rows];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Aplicar estilos y formato
    this.applyWorksheetStyles(worksheet, todasCategorias, employeeData.length);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen Producción');

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
   * Crea los encabezados del Excel
   */
  private createHeaders(categorias: string[]): string[][] {
    const header1 = ['NOMBRE', 'DIAS X LABORAR', 'DIAS REAL LABORADOS', 'OBSERVACIÓN'];
    const header2 = ['', '', '', ''];

    // Agregar categorías dinámicamente
    for (const categoria of categorias) {
      // OP. CATEGORÍA
      header1.push(`OP. ${categoria.toUpperCase()}`);
      header1.push('', ''); // Para completar las 3 columnas (%, DÍAS, HORAS)
      header2.push('%', 'DÍAS', 'HORAS');

      // AYU. CATEGORÍA  
      header1.push(`AYU. ${categoria.toUpperCase()}`);
      header1.push('', ''); // Para completar las 3 columnas (%, DÍAS, HORAS)
      header2.push('%', 'DÍAS', 'HORAS');
    }

    return [header1, header2];
  }

  /**
   * Crea las filas de datos del Excel
   */
  private createDataRows(employeeData: EmployeeData[], categorias: string[]): string[][] {
    const rows: string[][] = [];

    for (const empleado of employeeData) {
      const row = [
        empleado.nombre,
        empleado.diasXLaborar.toString(),
        empleado.diasRealLaborados.toString(),
        empleado.observacion
      ];

      // Agregar datos por categoría
      for (const categoria of categorias) {
        const bloque = empleado.bloques.find(b => b.categoria === categoria);
        
        if (bloque) {
          // OP data - mostrar vacío si no trabajó como operario
          if (bloque.operario.dias > 0) {
            row.push(
              `${bloque.operario.porcentaje}%`,
              bloque.operario.dias.toString(),
              bloque.operario.horas
            );
          } else {
            row.push('', '', '');
          }

          // AYU data - mostrar vacío si no trabajó como asistente
          if (bloque.ayudante.dias > 0) {
            row.push(
              `${bloque.ayudante.porcentaje}%`,
              bloque.ayudante.dias.toString(),
              bloque.ayudante.horas
            );
          } else {
            row.push('', '', '');
          }
        } else {
          // Sin datos para esta categoría - ambos campos vacíos
          row.push('', '', '', '', '', '');
        }
      }

      rows.push(row);

      // Agregar filas de máquinas si hay detalles
      const bloqueConMaquinas = empleado.bloques.find(b => 
        b.operario.maquinas.length > 0 || b.ayudante.maquinas.length > 0
      );

      if (bloqueConMaquinas) {
        // Por ahora, solo mostramos el resumen. Las máquinas se pueden agregar como subfilas si se requiere
      }
    }

    return rows;
  }

  /**
   * Aplica estilos a la hoja de cálculo
   */
  private applyWorksheetStyles(worksheet: XLSX.WorkSheet, categorias: string[], numEmployees: number): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1');
    
    // Configurar anchos de columna
    const colWidths = [
      { width: 25 }, // NOMBRE
      { width: 15 }, // DIAS X LABORAR
      { width: 18 }, // DIAS REAL LABORADOS
      { width: 15 }  // OBSERVACIÓN
    ];

    // Agregar anchos para categorías dinámicas
    for (let i = 0; i < categorias.length; i++) {
      colWidths.push(
        { width: 8 },  // OP %
        { width: 8 },  // OP DÍAS
        { width: 15 }, // OP HORAS
        { width: 8 },  // AYU %
        { width: 8 },  // AYU DÍAS
        { width: 15 }  // AYU HORAS
      );
    }

    worksheet['!cols'] = colWidths;

    // Aplicar formato a los encabezados
    for (let col = range.s.c; col <= range.e.c; col++) {
      // Primera fila de encabezados
      const cellAddress1 = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[cellAddress1]) {
        worksheet[cellAddress1].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4CAF50' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      }

      // Segunda fila de encabezados
      const cellAddress2 = XLSX.utils.encode_cell({ r: 1, c: col });
      if (worksheet[cellAddress2]) {
        worksheet[cellAddress2].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '66BB6A' } },
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

    // Aplicar bordes a todas las celdas de datos
    for (let row = 2; row <= numEmployees + 1; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { v: '', t: 's' };
        }
        
        worksheet[cellAddress].s = {
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }
  }

  /**
   * Genera el nombre del archivo
   */
  private generateFilename(fechaInicio: Date, fechaFin: Date): string {
    const inicio = fechaInicio.toISOString().split('T')[0].replace(/-/g, '');
    const fin = fechaFin.toISOString().split('T')[0].replace(/-/g, '');
    return `RESUMEN_${inicio}_${fin}.xlsx`;
  }
}

export const summaryExcelService = new SummaryExcelService();