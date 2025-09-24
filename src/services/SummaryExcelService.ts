import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';

// ================== Tipos del reporte ==================
export interface EmployeeData {
  id: string;
  nombre: string;
  diasXLaborar: number;
  diasRealLaborados: number;
  observacion: string;
  bonoTotal: number;
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

// ================== Tipos para consultas Supabase ==================
// FKs duplicadas obligan a "pistar" relaciones con !<constraint_name>
type DetalleRow = {
  produccion_real: number;
  productos?: { nombre: string; tope: number | null } | null;
};

type RegistroProduccionRow = {
  id: string;
  fecha: string;               // date (YYYY-MM-DD)
  turno: string;
  maquinas?: { nombre: string; categoria: string | null } | null;
  detalle_produccion?: DetalleRow[] | null;
};

type PartAyudanteRow = {
  registros_produccion: RegistroProduccionRow | null;
};

// ================== Servicio ==================
export class SummaryExcelService {
  /**
   * Genera el reporte resumen según el formato especificado
   */
  async generateSummaryReport(fechaInicio: Date, fechaFin: Date): Promise<void> {
    // 1) Obtener datos por empleado
    const employeeData = await this.getEmployeeData(fechaInicio, fechaFin);

    // 2) Exportar a Excel
    await this.exportToExcel(employeeData, fechaInicio, fechaFin);
  }

  /**
   * Obtiene y procesa los datos de todos los empleados para el período
   */
  private async getEmployeeData(fechaInicio: Date, fechaFin: Date): Promise<EmployeeData[]> {
    // Empleados activos
    const { data: empleados, error: errUsers } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (errUsers) throw errUsers;
    if (!empleados) return [];

    // Días laborables del rango
    const diasXLaborar = this.calculateWorkingDays(fechaInicio, fechaFin);

    // Categorías (únicas) de máquinas activas
    const { data: categoriasRows, error: errCats } = await supabase
      .from('maquinas')
      .select('categoria')
      .eq('activa', true);

    if (errCats) throw errCats;

    const categoriasUnicas = [
      ...new Set((categoriasRows ?? []).map((c: any) => c.categoria).filter(Boolean)),
    ] as string[];

    // Armar data por empleado
    const employeeDataPromises = empleados.map(async (empleado) => {
      const diasRealLaborados = await this.getRealWorkedDays(empleado.id, fechaInicio, fechaFin);

      const bloques = await Promise.all(
        categoriasUnicas.map((categoria) =>
          this.generateCategoryBlock(empleado.id, categoria, fechaInicio, fechaFin)
        )
      );

      const bloquesFiltered = (bloques.filter(Boolean) as CategoryBlock[]) ?? [];
      
      // Calcular bono total: suma de porcentajes operario de todas las máquinas / días del rango
      const bonoTotal = this.calculateBonoTotal(bloquesFiltered, diasXLaborar);

      return {
        id: empleado.id,
        nombre: empleado.nombre,
        diasXLaborar,
        diasRealLaborados,
        observacion: '',
        bonoTotal,
        bloques: bloquesFiltered,
      };
    });

    return await Promise.all(employeeDataPromises);
  }

  /**
   * Calcula los días laborales del período (excluye sábados y domingos)
   */
  private calculateWorkingDays(fechaInicio: Date, fechaFin: Date): number {
    let count = 0;
    const current = new Date(
      Date.UTC(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate())
    );
    const end = new Date(
      Date.UTC(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate())
    );

   while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0 dom, 6 sáb
    // Incluir lunes a sábado
    if (dayOfWeek !== 0) count++;
    current.setUTCDate(current.getUTCDate() + 1);
  }
    return count;
  }

  /**
   * Calcula el bono total del empleado
   */
  private calculateBonoTotal(bloques: CategoryBlock[], diasDelRango: number): number {
    if (diasDelRango === 0) return 0;
    
    // Sumar todos los porcentajes del operario de todas las categorías/máquinas
    let sumaPorcentajes = 0;
    
    for (const bloque of bloques) {
      // Solo tomar porcentajes cuando el operario trabajó en esa categoría
      if (bloque.operario.dias > 0) {
        sumaPorcentajes += bloque.operario.porcentaje;
      }
    }
    
    // Dividir por el número de días del rango
    const bonoTotal = sumaPorcentajes / diasDelRango;
    return Math.round(bonoTotal * 10) / 10; // Redondear a 1 decimal
  }

  /**
   * Días realmente laborados por empleado (cuenta OPERARIO + AYUDANTE)
   */
private async getRealWorkedDays(
  empleadoId: string,
  fechaInicio: Date,
  fechaFin: Date
): Promise<number> {
  const startDate = fechaInicio.toISOString().split('T')[0];
  const endDate   = fechaFin.toISOString().split('T')[0];

  // Como OPERARIO (directo)
  const { data: regsOp, error: errOp } = await supabase
    .from('registros_produccion')
    .select('fecha')
    .eq('operario_id', empleadoId)
    .gte('fecha', startDate)
    .lte('fecha', endDate);
  if (errOp) throw errOp;

  // Como AYUDANTE (2 pasos: pivote -> ids -> registros_produccion)
  const { data: ayuLinks, error: errLinks } = await supabase
    .from('registro_asistentes')
    .select('registro_id')
    .eq('asistente_id', empleadoId);
  if (errLinks) throw errLinks;

  let regsAyu: { fecha: string }[] = [];
  const ids = (ayuLinks ?? []).map(l => l.registro_id).filter(Boolean);
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('registros_produccion')
      .select('fecha')
      .in('id', ids)
      .gte('fecha', startDate)
      .lte('fecha', endDate);
    if (error) throw error;
    regsAyu = data ?? [];
  }

  const fechas = new Set<string>();
  (regsOp ?? []).forEach(r => r?.fecha && fechas.add(r.fecha));
  (regsAyu ?? []).forEach(r => r?.fecha && fechas.add(r.fecha));

  return fechas.size;
}

  /**
   * Genera el bloque de datos por categoría (separa Operario / Ayudante)
   */
private async generateCategoryBlock(
  empleadoId: string,
  categoria: string,
  fechaInicio: Date,
  fechaFin: Date
): Promise<CategoryBlock | null> {
  const startDate = fechaInicio.toISOString().split('T')[0];
  const endDate   = fechaFin.toISOString().split('T')[0];

  // === Registros donde el empleado fue OPERARIO ===
  const { data: regsOperarioRaw, error: errOp } = await supabase
    .from('registros_produccion')
    .select(`
      id,
      fecha,
      turno,
      maquinas:maquinas!registros_produccion_maquina_id_fkey ( nombre, categoria ),
      detalle_produccion:detalle_produccion!detalle_produccion_registro_id_fkey (
        produccion_real,
        productos:productos!detalle_produccion_producto_id_fkey ( nombre, tope )
      )
    `)
    .eq('operario_id', empleadoId)
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  if (errOp) throw errOp;

  const regsOperario = (regsOperarioRaw ?? []).filter(
    (r: RegistroProduccionRow) => r?.maquinas?.categoria === categoria
  ) as RegistroProduccionRow[];

  // === Registros donde el empleado fue AYUDANTE (pivote en 2 pasos) ===
  // Paso 1: obtener enlaces en la pivote
  const { data: ayuLinks, error: errLinks } = await supabase
    .from('registro_asistentes')
    .select('registro_id')
    .eq('asistente_id', empleadoId);

  if (errLinks) throw errLinks;

  // Paso 2: con esos IDs, traer los registros_produccion completos
  let regsAyudante: RegistroProduccionRow[] = [];
  const idsAyu = (ayuLinks ?? []).map(l => l.registro_id).filter(Boolean);

  if (idsAyu.length > 0) {
    const { data: regsAyuRaw, error: errAyuRegs } = await supabase
      .from('registros_produccion')
      .select(`
        id,
        fecha,
        turno,
        maquinas:maquinas!registros_produccion_maquina_id_fkey ( nombre, categoria ),
        detalle_produccion:detalle_produccion!detalle_produccion_registro_id_fkey (
          produccion_real,
          productos:productos!detalle_produccion_producto_id_fkey ( nombre, tope )
        )
      `)
      .in('id', idsAyu)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (errAyuRegs) throw errAyuRegs;

    regsAyudante = (regsAyuRaw ?? []).filter(
      (r: RegistroProduccionRow) => r?.maquinas?.categoria === categoria
    ) as RegistroProduccionRow[];
  }

  // Evitar duplicados por seguridad (mismo registro_id)
  const uniqById = (arr: RegistroProduccionRow[]) => {
    const m = new Map<string, RegistroProduccionRow>();
    for (const r of arr) if (r?.id && !m.has(r.id)) m.set(r.id, r);
    return Array.from(m.values());
  };

  const registrosOperario = uniqById(regsOperario);
  const registrosAyudante = uniqById(regsAyudante);

  if (registrosOperario.length === 0 && registrosAyudante.length === 0) return null;

  const [operarioData, ayudanteData] = await Promise.all([
    this.generateBlockData(registrosOperario, fechaInicio, fechaFin),
    this.generateBlockData(registrosAyudante, fechaInicio, fechaFin),
  ]);

  return {
    categoria,
    operario: operarioData,
    ayudante: ayudanteData,
  };
}


  /**
   * Genera los datos de un bloque (operario o ayudante)
   */
  private async generateBlockData(
    registros: RegistroProduccionRow[],
    _fechaInicio: Date,
    _fechaFin: Date
  ): Promise<BlockData> {
    if (!registros || registros.length === 0) {
      return { porcentaje: 0, dias: 0, horas: '', maquinas: [] };
    }

    // % promedio por día, días y horas (turnos únicos)
    const porcentajesPorDia = new Map<string, number>();
    const turnosPorDia = new Map<string, string>();

    for (const registro of registros) {
      const fecha = registro.fecha;
      if (!porcentajesPorDia.has(fecha)) {
        porcentajesPorDia.set(fecha, 0);
        turnosPorDia.set(fecha, this.formatTurno(registro.turno));
      }

      if (registro.detalle_produccion?.length) {
        let sumaPorcentajeDia = porcentajesPorDia.get(fecha) ?? 0;

        for (const detalle of registro.detalle_produccion) {
          const tope = detalle.productos?.tope ?? 0;
          const pct = tope > 0 ? (detalle.produccion_real / Number(tope)) * 100 : 0;
          sumaPorcentajeDia += pct;
        }
        porcentajesPorDia.set(fecha, sumaPorcentajeDia);
      }
    }

    const porcentajes = Array.from(porcentajesPorDia.values());
    const porcentajePromedio =
      porcentajes.length > 0
        ? porcentajes.reduce((sum, p) => sum + p, 0) / porcentajes.length
        : 0;

    const dias = porcentajesPorDia.size;
    const horas = [...new Set(Array.from(turnosPorDia.values()))].join(', ');

    // Por máquina
    const maquinasData = await this.generateMachineData(registros);

    return {
      porcentaje: Math.round(porcentajePromedio * 10) / 10,
      dias,
      horas,
      maquinas: maquinasData,
    };
  }

  /**
   * Genera los datos específicos por máquina
   */
  private async generateMachineData(registros: RegistroProduccionRow[]): Promise<MachineData[]> {
    const maquinasMap = new Map<
      string,
      { porcentajes: number[]; dias: Set<string>; turnos: Set<string> }
    >();

    for (const registro of registros) {
      const maquinaNombre = registro.maquinas?.nombre || 'Sin máquina';
      if (!maquinasMap.has(maquinaNombre)) {
        maquinasMap.set(maquinaNombre, {
          porcentajes: [],
          dias: new Set<string>(),
          turnos: new Set<string>(),
        });
      }

      const agg = maquinasMap.get(maquinaNombre)!;
      agg.dias.add(registro.fecha);
      agg.turnos.add(this.formatTurno(registro.turno));

      let pctRegistro = 0;
      if (registro.detalle_produccion?.length) {
        for (const d of registro.detalle_produccion) {
          const tope = d.productos?.tope ?? 0;
          pctRegistro += tope > 0 ? (d.produccion_real / Number(tope)) * 100 : 0;
        }
      }
      agg.porcentajes.push(pctRegistro);
    }

    return Array.from(maquinasMap.entries())
      .map(([nombre, data]) => {
        const promedio =
          data.porcentajes.length > 0
            ? data.porcentajes.reduce((s, v) => s + v, 0) / data.porcentajes.length
            : 0;
        return {
          nombre,
          porcentaje: Math.round(promedio * 10) / 10,
          dias: data.dias.size,
          horas: Array.from(data.turnos).join(', '),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
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
   * Exporta a Excel con encabezados combinados y bloques por categoría
   */
  private async exportToExcel(employeeData: EmployeeData[], fechaInicio: Date, fechaFin: Date): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Categorías presentes
    const todasCategorias = [...new Set(employeeData.flatMap((e) => e.bloques.map((b) => b.categoria)))].sort();

    // Encabezados (2 filas) + datos
    const headers = this.createHeaders(todasCategorias);
    const rows = this.createDataRows(employeeData, todasCategorias);
    const sheetData = [...headers, ...rows];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Estilos/bordes (nota: estilos requieren SheetJS Pro; si no, se ignoran)
    this.applyWorksheetStyles(worksheet, todasCategorias, employeeData.length);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen Producción');

    const filename = this.generateFilename(fechaInicio, fechaFin);
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, filename);
  }

  /**
   * Crea los encabezados del Excel (dos filas)
   */
  private createHeaders(categorias: string[]): string[][] {
    const header1 = ['NOMBRE', 'DIAS X LABORAR', 'DIAS REAL LABORADOS', 'OBSERVACIÓN', 'BONO TOTAL'];
    const header2 = ['', '', '', '', ''];

    for (const categoria of categorias) {
      // OP
      header1.push(`OP. ${categoria.toUpperCase()}`, '', '');
      header2.push('%', 'DÍAS', 'HORAS');
      // AYU
      header1.push(`AYU. ${categoria.toUpperCase()}`, '', '');
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
      const row: string[] = [
        empleado.nombre,
        String(empleado.diasXLaborar),
        String(empleado.diasRealLaborados),
        empleado.observacion ?? '',
        String(empleado.bonoTotal),
      ];

      for (const categoria of categorias) {
        const bloque = empleado.bloques.find((b) => b.categoria === categoria);

        if (bloque) {
          // OP
          if (bloque.operario.dias > 0) {
            row.push(`${bloque.operario.porcentaje}%`, String(bloque.operario.dias), bloque.operario.horas);
          } else {
            row.push('', '', '');
          }
          // AYU
          if (bloque.ayudante.dias > 0) {
            row.push(`${bloque.ayudante.porcentaje}%`, String(bloque.ayudante.dias), bloque.ayudante.horas);
          } else {
            row.push('', '', '');
          }
        } else {
          // Sin datos en la categoría
          row.push('', '', '', '', '', '');
        }
      }

      rows.push(row);
    }

    return rows;
  }

  /**
   * Aplica estilos a la hoja
   */
  private applyWorksheetStyles(worksheet: XLSX.WorkSheet, categorias: string[], numEmployees: number): void {
    const rangeRef = worksheet['!ref'] || 'A1:A1';
    const range = XLSX.utils.decode_range(rangeRef);

    // Anchos de columnas base
    const colWidths = [
      { width: 25 }, // NOMBRE
      { width: 15 }, // DIAS X LABORAR
      { width: 18 }, // DIAS REAL LABORADOS
      { width: 18 }, // OBSERVACIÓN
      { width: 12 }, // BONO TOTAL
    ];

    // Por cada categoría: OP(3) + AYU(3)
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
    (worksheet as any)['!cols'] = colWidths;

    // Bordes y alineación básica para todas las celdas existentes
    const totalRows = numEmployees + 2; // 2 filas de encabezado
    for (let r = 0; r < totalRows; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[addr]) worksheet[addr] = { v: '', t: 's' } as any;
        (worksheet[addr] as any).s = {
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          },
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
