import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

// ================== Tipos del reporte ==================
export interface EmployeeData {
  id: string;
  nombre: string;
  diasXLaborar: number;
  diasRealLaborados: number; // se calculará en Excel
  observacion: string;
  bonoTotal: number; // se calculará en Excel
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
  observaciones: string;
  maquinas: MachineData[];
}

export interface MachineData {
  nombre: string;
  porcentaje: number;
  dias: number;
  observaciones: string;
}

// ================== Tipos para consultas Supabase ==================
type DetalleRow = {
  produccion_real: number;
  porcentaje_cumplimiento: number;
  observaciones?: string | null;
  productos?: {
    nombre: string;
    tipo_producto: string;
    tope: number | null;
    tope_jornada_8h?: number | null;
    tope_jornada_10h?: number | null;
  } | null;
};

// ==== Prefetch: traemos TODO el rango y unimos asistentes por lotes ====
type PrefetchedRegistro = {
  id: string;
  fecha: string; // YYYY-MM-DD
  turno: string;
  operario_id: string;
  maquinas: { nombre: string; categoria: string | null } | null;
  registro_asistentes: { asistente_id: string }[] | null;
  detalle_produccion: DetalleRow[] | null;
};

// ===== util batching para .in() grandes =====
const IN_CHUNK_SIZE = 1000;
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ================== Servicio ==================
export class SummaryExcelService {
  async generateSummaryReport(fechaInicio: Date, fechaFin: Date): Promise<void> {
    const employeeData = await this.getEmployeeData(fechaInicio, fechaFin);
    await this.exportToExcel(employeeData, fechaInicio, fechaFin);
  }

  // =============== Prefetch con batching de asistentes (SIN embed) ===============
  private async fetchRegistrosRange(fechaInicio: Date, fechaFin: Date): Promise<PrefetchedRegistro[]> {
    const startDate = fechaInicio.toISOString().split("T")[0];
    const endDate = fechaFin.toISOString().split("T")[0];

    // 1) Registros con máquina y detalle (sin registro_asistentes)
    const { data: regs, error: regsErr } = await supabase
      .from("registros_produccion")
      .select(`
        id,
        fecha,
        turno,
        operario_id,
        maquinas:maquinas!registros_produccion_maquina_id_fkey ( nombre, categoria ),
        detalle_produccion:detalle_produccion!detalle_produccion_registro_id_fkey (
          produccion_real,
          porcentaje_cumplimiento,
          observaciones,
          productos:productos!detalle_produccion_producto_id_fkey (
            nombre,
            tipo_producto,
            tope,
            tope_jornada_8h,
            tope_jornada_10h
          )
        )
      `)
      .gte("fecha", startDate)
      .lte("fecha", endDate)
      .order("fecha", { ascending: true })
      .limit(50000);

    if (regsErr) throw regsErr;

    const registros = (regs as unknown as PrefetchedRegistro[]) ?? [];
    if (registros.length === 0) return [];

    // 2) Asistentes por lotes
    const ids = registros.map((r) => r.id);
    const chunks = chunkArray(ids, IN_CHUNK_SIZE);

    const asistentesAcumulados: { registro_id: string; asistente_id: string }[] = [];
    for (const idsChunk of chunks) {
      const { data: asistentes, error: asisErr } = await supabase
        .from("registro_asistentes")
        .select("registro_id, asistente_id")
        .in("registro_id", idsChunk);
      if (asisErr) throw asisErr;
      if (asistentes?.length) asistentesAcumulados.push(...asistentes);
    }

    // 3) Indexar y adjuntar
    const asistByReg = new Map<string, { asistente_id: string }[]>();
    for (const a of asistentesAcumulados) {
      if (!asistByReg.has(a.registro_id)) asistByReg.set(a.registro_id, []);
      asistByReg.get(a.registro_id)!.push({ asistente_id: a.asistente_id });
    }
    for (const r of registros) {
      r.registro_asistentes = asistByReg.get(r.id) ?? [];
    }

    return registros;
  }

  private async getEmployeeData(fechaInicio: Date, fechaFin: Date): Promise<EmployeeData[]> {
    // Empleados activos
    const { data: empleados, error: errUsers } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (errUsers) throw errUsers;
    if (!empleados) return [];

    // Prefetch único
    const registros = await this.fetchRegistrosRange(fechaInicio, fechaFin);

    // Días a laborar (B)
    const diasXLaborar = this.calculateWorkingDays(fechaInicio, fechaFin);

    // Categorías únicas desde los registros
    const categoriasUnicas = Array.from(
      new Set(registros.map((r) => r.maquinas?.categoria).filter((c): c is string => !!c))
    ).sort();

    // Armar data (dejamos bonoTotal y diasRealLaborados a 0; Excel los calculará)
    return empleados.map((empleado) => {
      const regsOp = registros.filter((r) => r.operario_id === empleado.id);
      const regsAyu = registros.filter((r) => (r.registro_asistentes ?? []).some((a) => a.asistente_id === empleado.id));

      const bloques: CategoryBlock[] = categoriasUnicas
        .map((categoria) => {
          const regsOpCat = regsOp.filter((r) => r.maquinas?.categoria === categoria);
          const regsAyuCat = regsAyu.filter((r) => r.maquinas?.categoria === categoria);
          return {
            categoria,
            operario: this.generateBlockDataSync(regsOpCat, false),
            ayudante: this.generateBlockDataSync(regsAyuCat, true),
          };
        })
        .filter((b) => b.operario.dias > 0 || b.ayudante.dias > 0);

      return {
        id: empleado.id,
        nombre: empleado.nombre,
        diasXLaborar,
        diasRealLaborados: 0, // lo sobreescribimos en Excel
        observacion: "",
        bonoTotal: 0, // lo sobreescribimos en Excel
        bloques,
      };
    });
  }

  // ======= utilidades de cálculo (sin fetch) =======
  private calculateWorkingDays(fechaInicio: Date, fechaFin: Date): number {
    let count = 0;
    const current = new Date(Date.UTC(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate()));
    const end = new Date(Date.UTC(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate()));
    while (current <= end) {
      const dayOfWeek = current.getUTCDay(); // 0=dom
      if (dayOfWeek !== 0) count++; // lun-sáb
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  }

  private generateBlockDataSync(registros: PrefetchedRegistro[], esAsistente: boolean): BlockData {
    if (!registros?.length) return { porcentaje: 0, dias: 0, observaciones: "", maquinas: [] };

    const diasUnicos = new Set<string>();
    const observacionesSet = new Set<string>();

    let porcentajePromedio = 0;

    if (esAsistente) {
      // Para asistentes: sumar porcentajes de cada día, dividir por número de máquinas del día, luego promediar
      const sumasPorDia = new Map<string, number>();
      const maquinasPorDia = new Map<string, Set<string>>();

      for (const registro of registros) {
        if (!registro.detalle_produccion?.length) continue;
        diasUnicos.add(registro.fecha);

        if (!sumasPorDia.has(registro.fecha)) {
          sumasPorDia.set(registro.fecha, 0);
          maquinasPorDia.set(registro.fecha, new Set<string>());
        }

        // Registrar la máquina del día
        const nombreMaquina = registro.maquinas?.nombre || "Sin máquina";
        maquinasPorDia.get(registro.fecha)!.add(nombreMaquina);

        for (const detalle of registro.detalle_produccion) {
          let pct = 0;
          if (detalle.productos?.tipo_producto === "arbol_amarradora") {
            pct = Number(detalle.porcentaje_cumplimiento) || 0;
          } else {
            let jornadaTope: number | null = null;
            const turnoTexto = this.formatTurno(registro.turno);
            if (turnoTexto === "7:00am - 5:00pm") jornadaTope = detalle.productos?.tope_jornada_10h ?? null;
            else jornadaTope = detalle.productos?.tope_jornada_8h ?? null;
            const tope = jornadaTope ?? detalle.productos?.tope ?? 0;
            if (tope > 0) {
              pct = (Number(detalle.produccion_real) / Number(tope)) * 100;
            }
          }
          sumasPorDia.set(registro.fecha, sumasPorDia.get(registro.fecha)! + pct);

          if (detalle.observaciones?.trim()) observacionesSet.add(detalle.observaciones.trim());
        }
      }

      // Promediar cada día por número de máquinas, luego sumar y dividir por días
      let sumaTotalPromediosDiarios = 0;
      for (const [fecha, sumaDia] of sumasPorDia.entries()) {
        const numMaquinas = maquinasPorDia.get(fecha)?.size || 1;
        const promedioDia = sumaDia / numMaquinas;
        sumaTotalPromediosDiarios += promedioDia;
      }
      
      const numeroDeDias = sumasPorDia.size;
      porcentajePromedio = numeroDeDias > 0 ? sumaTotalPromediosDiarios / numeroDeDias : 0;
    } else {
      // Para operarios: sumar porcentajes de cada día, luego dividir entre número de días
      const sumasPorDia = new Map<string, number>();

      for (const registro of registros) {
        if (!registro.detalle_produccion?.length) continue;
        diasUnicos.add(registro.fecha);

        if (!sumasPorDia.has(registro.fecha)) {
          sumasPorDia.set(registro.fecha, 0);
        }

        for (const detalle of registro.detalle_produccion) {
          let pct = 0;
          if (detalle.productos?.tipo_producto === "arbol_amarradora") {
            pct = Number(detalle.porcentaje_cumplimiento) || 0;
          } else {
            let jornadaTope: number | null = null;
            const turnoTexto = this.formatTurno(registro.turno);
            if (turnoTexto === "7:00am - 5:00pm") jornadaTope = detalle.productos?.tope_jornada_10h ?? null;
            else jornadaTope = detalle.productos?.tope_jornada_8h ?? null;
            const tope = jornadaTope ?? detalle.productos?.tope ?? 0;
            if (tope > 0) {
              pct = (Number(detalle.produccion_real) / Number(tope)) * 100;
            }
          }
          sumasPorDia.set(registro.fecha, sumasPorDia.get(registro.fecha)! + pct);

          if (detalle.observaciones?.trim()) observacionesSet.add(detalle.observaciones.trim());
        }
      }

      // Sumar todas las sumas diarias y dividir entre el número de días
      const sumaTotalDeSumasDiarias = Array.from(sumasPorDia.values()).reduce((a, b) => a + b, 0);
      const numeroDeDias = sumasPorDia.size;
      porcentajePromedio = numeroDeDias > 0 ? sumaTotalDeSumasDiarias / numeroDeDias : 0;
    }

    const maquinasData = this.generateMachineDataSync(registros, esAsistente);

    return {
      porcentaje: Math.round(porcentajePromedio * 10) / 10,
      dias: diasUnicos.size,
      observaciones: Array.from(observacionesSet).join(" | "),
      maquinas: maquinasData,
    };
  }

  private generateMachineDataSync(registros: PrefetchedRegistro[], esAsistente: boolean): MachineData[] {
    if (esAsistente) {
      // Para asistentes: por máquina, sumar porcentajes de cada día, dividir por días trabajados en esa máquina
      const maquinasMap = new Map<string, { 
        sumasPorDia: Map<string, number>;
        dias: Set<string>; 
        observaciones: Set<string> 
      }>();

      for (const registro of registros) {
        if (!registro.detalle_produccion?.length) continue;

        const nombre = registro.maquinas?.nombre || "Sin máquina";
        if (!maquinasMap.has(nombre)) {
          maquinasMap.set(nombre, { 
            sumasPorDia: new Map<string, number>(),
            dias: new Set<string>(), 
            observaciones: new Set<string>() 
          });
        }
        const agg = maquinasMap.get(nombre)!;
        agg.dias.add(registro.fecha);

        if (!agg.sumasPorDia.has(registro.fecha)) {
          agg.sumasPorDia.set(registro.fecha, 0);
        }

        for (const d of registro.detalle_produccion) {
          let pct = 0;
          if (d.productos?.tipo_producto === "arbol_amarradora") {
            pct = Number(d.porcentaje_cumplimiento) || 0;
          } else {
            let jornadaTope: number | null = null;
            const turnoTexto = this.formatTurno(registro.turno);
            if (turnoTexto === "7:00am - 5:00pm") jornadaTope = d.productos?.tope_jornada_10h ?? null;
            else jornadaTope = d.productos?.tope_jornada_8h ?? null;
            const tope = jornadaTope ?? d.productos?.tope ?? 0;
            if (tope > 0) {
              pct = (Number(d.produccion_real) / Number(tope)) * 100;
            }
          }
          agg.sumasPorDia.set(registro.fecha, agg.sumasPorDia.get(registro.fecha)! + pct);
          if (d.observaciones?.trim()) agg.observaciones.add(d.observaciones.trim());
        }
      }

      return Array.from(maquinasMap.entries())
        .map(([nombre, data]) => {
          const sumaTotalDeSumasDiarias = Array.from(data.sumasPorDia.values()).reduce((a, b) => a + b, 0);
          const numeroDeDias = data.sumasPorDia.size;
          const promedio = numeroDeDias > 0 ? sumaTotalDeSumasDiarias / numeroDeDias : 0;

          return {
            nombre,
            porcentaje: Math.round(promedio * 10) / 10,
            dias: data.dias.size,
            observaciones: Array.from(data.observaciones).join(" | "),
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else {
      // Para operarios: sumar porcentajes de cada día, luego dividir entre número de días
      const maquinasMap = new Map<string, { 
        sumasPorDia: Map<string, number>;
        dias: Set<string>; 
        observaciones: Set<string> 
      }>();

      for (const registro of registros) {
        if (!registro.detalle_produccion?.length) continue;

        const nombre = registro.maquinas?.nombre || "Sin máquina";
        if (!maquinasMap.has(nombre)) {
          maquinasMap.set(nombre, { 
            sumasPorDia: new Map<string, number>(),
            dias: new Set<string>(), 
            observaciones: new Set<string>() 
          });
        }
        const agg = maquinasMap.get(nombre)!;
        agg.dias.add(registro.fecha);

        if (!agg.sumasPorDia.has(registro.fecha)) {
          agg.sumasPorDia.set(registro.fecha, 0);
        }

        for (const d of registro.detalle_produccion) {
          let pct = 0;
          if (d.productos?.tipo_producto === "arbol_amarradora") {
            pct = Number(d.porcentaje_cumplimiento) || 0;
          } else {
            let jornadaTope: number | null = null;
            const turnoTexto = this.formatTurno(registro.turno);
            if (turnoTexto === "7:00am - 5:00pm") jornadaTope = d.productos?.tope_jornada_10h ?? null;
            else jornadaTope = d.productos?.tope_jornada_8h ?? null;
            const tope = jornadaTope ?? d.productos?.tope ?? 0;
            if (tope > 0) {
              pct = (Number(d.produccion_real) / Number(tope)) * 100;
            }
          }
          agg.sumasPorDia.set(registro.fecha, agg.sumasPorDia.get(registro.fecha)! + pct);
          if (d.observaciones?.trim()) agg.observaciones.add(d.observaciones.trim());
        }
      }

      return Array.from(maquinasMap.entries())
        .map(([nombre, data]) => {
          const sumaTotalDeSumasDiarias = Array.from(data.sumasPorDia.values()).reduce((a, b) => a + b, 0);
          const numeroDeDias = data.sumasPorDia.size;
          const promedio = numeroDeDias > 0 ? sumaTotalDeSumasDiarias / numeroDeDias : 0;

          return {
            nombre,
            porcentaje: Math.round(promedio * 10) / 10,
            dias: data.dias.size,
            observaciones: Array.from(data.observaciones).join(" | "),
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  }

  private formatTurno(turno: string): string {
    switch (turno) {
      case "manana":
        return "7:00am - 3:30pm";
      case "tarde":
        return "3:30pm - 11:30pm";
      case "noche":
        return "11:30pm - 7:00am";
      default:
        return turno;
    }
  }

  // ================== Export a Excel ==================
  private async exportToExcel(employeeData: EmployeeData[], fechaInicio: Date, fechaFin: Date): Promise<void> {
    const workbook = XLSX.utils.book_new();

    const todasCategorias = [...new Set(employeeData.flatMap((e) => e.bloques.map((b) => b.categoria)))].sort();

    const headers = this.createHeaders(todasCategorias);
    const rows = this.createDataRows(employeeData, todasCategorias);
    const sheetData = [...headers, ...rows];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // === Fórmula dinámica en C: DIAS REAL LABORADOS =========
    // C{fila} = SUM(N(<todas las celdas DÍAS OP/AYU>))
    {
      const startRow = 3; // después de 2 filas de encabezado
      for (let i = 0; i < employeeData.length; i++) {
        const rowIndex = startRow + i;

        const diasCells: string[] = [];
        for (let k = 0; k < todasCategorias.length; k++) {
          const opDiasCol = (5 + 6 * k) + 1;  // F, L, R, ...
          const ayuDiasCol = (8 + 6 * k) + 1; // I, O, U, ...

          const opDiasAddr = `${this.columnLetter(opDiasCol)}${rowIndex}`;
          const ayuDiasAddr = `${this.columnLetter(ayuDiasCol)}${rowIndex}`;
          diasCells.push(opDiasAddr, ayuDiasAddr);
        }

        const sumaDias = diasCells.length
          ? `SUM(${diasCells.map(addr => `N(${addr})`).join(",")})`
          : "0";

        worksheet[`C${rowIndex}`] = { f: sumaDias };
        (worksheet[`C${rowIndex}`] as any).z = "0";
      }
    }

    // === Fórmula dinámica en D: BONO TOTAL ==================
    // D{fila} = IF(N(B{fila})>0, (Σ(OP_%*OP_DÍAS)+Σ(AYU_%*AYU_DÍAS))/N(B{fila})/100, 0)
    {
      const startRow = 3; // después de 2 filas de encabezado
      for (let i = 0; i < employeeData.length; i++) {
        const rowIndex = startRow + i;
        const diasXLaborarCell = `B${rowIndex}`;

        const terminos: string[] = [];
        for (let k = 0; k < todasCategorias.length; k++) {
          const opPctCol   = 5 + 6 * k;
          const opDiasCol  = opPctCol + 1;
          const ayuPctCol  = 8 + 6 * k;
          const ayuDiasCol = ayuPctCol + 1;

          const opPct   = `${this.columnLetter(opPctCol)}${rowIndex}`;
          const opDias  = `${this.columnLetter(opDiasCol)}${rowIndex}`;
          const ayuPct  = `${this.columnLetter(ayuPctCol)}${rowIndex}`;
          const ayuDias = `${this.columnLetter(ayuDiasCol)}${rowIndex}`;

          terminos.push(`N(${opPct})*N(${opDias})`, `N(${ayuPct})*N(${ayuDias})`);
        }

        const numerador = terminos.length ? `(${terminos.join("+")})` : "0";
        worksheet[`D${rowIndex}`] = {
          f: `IF(N(${diasXLaborarCell})>0, ${numerador}/N(${diasXLaborarCell})/100, 0)`,
        };
        (worksheet[`D${rowIndex}`] as any).z = "0.0%";
      }
    }

    this.applyWorksheetStyles(worksheet, todasCategorias, employeeData.length);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen Producción");

    const filename = this.generateFilename(fechaInicio, fechaFin);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  }

  private columnLetter(colIndex: number): string {
    let letter = "";
    while (colIndex > 0) {
      const mod = (colIndex - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      colIndex = Math.floor((colIndex - mod) / 26);
    }
    return letter;
  }

  private createHeaders(categorias: string[]): (string | number)[][] {
    const h1: (string | number)[] = ["NOMBRE", "DIAS X LABORAR", "DIAS REAL LABORADOS", "BONO TOTAL"];
    const h2: (string | number)[] = ["", "", "", ""];
    for (const categoria of categorias) {
      h1.push(`OP. ${categoria.toUpperCase()}`, "", "");
      h2.push("%", "DÍAS", "OBSERVACIONES");
      h1.push(`AYU. ${categoria.toUpperCase()}`, "", "");
      h2.push("%", "DÍAS", "OBSERVACIONES");
    }
    return [h1, h2];
  }

  private createDataRows(employeeData: EmployeeData[], categorias: string[]): (string | number)[][] {
    const rows: (string | number)[][] = [];
    for (const empleado of employeeData) {
      const row: (string | number)[] = [
        empleado.nombre,
        empleado.diasXLaborar,
        0, // C se calculará con fórmula
        0, // D se calculará con fórmula
      ];
      for (const categoria of categorias) {
        const b = empleado.bloques.find((x) => x.categoria === categoria);
        if (b) {
          // Si hay bloque, usa números (0 en vacío) para ser Excel-friendly
          row.push(
            Number(b.operario.porcentaje) || 0,
            Number(b.operario.dias) || 0,
            b.operario.observaciones || ""
          );
          row.push(
            Number(b.ayudante.porcentaje) || 0,
            Number(b.ayudante.dias) || 0,
            b.ayudante.observaciones || ""
          );
        } else {
          // Categoría no presente para el empleado: 0 en % y DÍAS
          row.push(0, 0, "", 0, 0, "");
        }
      }
      rows.push(row);
    }
    return rows;
  }

  private applyWorksheetStyles(worksheet: XLSX.WorkSheet, categorias: string[], numEmployees: number): void {
    const rangeRef = worksheet["!ref"] || "A1:A1";
    const range = XLSX.utils.decode_range(rangeRef);

    const colWidths = [
      { width: 25 }, // NOMBRE
      { width: 15 }, // DIAS X LABORAR
      { width: 18 }, // DIAS REAL LABORADOS
      { width: 12 }, // BONO TOTAL
    ];
    for (let i = 0; i < categorias.length; i++) {
      colWidths.push(
        { width: 8 },  // OP %
        { width: 8 },  // OP DÍAS
        { width: 30 }, // OP OBS
        { width: 8 },  // AYU %
        { width: 8 },  // AYU DÍAS
        { width: 30 }  // AYU OBS
      );
    }
    (worksheet as any)["!cols"] = colWidths;

    const totalRows = numEmployees + 2;
    for (let r = 0; r < totalRows; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[addr]) worksheet[addr] = { v: "", t: "s" } as any;
        (worksheet[addr] as any).s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }
    }
  }

  private generateFilename(fechaInicio: Date, fechaFin: Date): string {
    const inicio = fechaInicio.toISOString().split("T")[0].replace(/-/g, "");
    const fin = fechaFin.toISOString().split("T")[0].replace(/-/g, "");
    return `RESUMEN_${inicio}_${fin}.xlsx`;
  }
}

export const summaryExcelService = new SummaryExcelService();
