import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

export interface MachineReportData {
  fecha: string; // dd/mm/yyyy (texto, sin new Date)
  turno: string;
  operario: string;
  asistente: string;
  maquina: string;
  producto: string;
  producido: number;
  porcentajeCumplimiento: number;
  porcentajeSuma: number; // compatibilidad con UI; NO se exporta
}

export interface MachineReportByCategory {
  categoria: string;
  registros: MachineReportData[];
}

export class MachineReportService {
  async generateMachineReport(fechaInicio: Date, fechaFin: Date): Promise<MachineReportByCategory[]> {
    // NO usar toISOString(): se conserva la fecha local (date-only)
    const startDate = this.toYMD(fechaInicio);
    const endDate   = this.toYMD(fechaFin);

    const { data: operarios } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .eq("activo", true);
    if (!operarios) return [];

    const { data: maquinas } = await supabase
      .from("maquinas")
      .select("id, nombre, categoria")
      .eq("activa", true);
    if (!maquinas) return [];

    const { data: registros, error } = await supabase
      .from("registros_produccion")
      .select(
        `
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
            nombre,
            tipo_producto,
            tope,
            tope_jornada_10h,
            tope_jornada_8h
          )
        )
      `,
      )
      .gte("fecha", startDate)
      .lte("fecha", endDate)
      .order("fecha", { ascending: true })
      .order("turno", { ascending: true });

    if (error) throw new Error(`Error fetching production data: ${error.message}`);

    // Promedios por operario basados SOLO en días trabajados reales
    const porcentajesSumaOperarios = await this.calcularPorcentajesSuma(registros || [], fechaInicio, fechaFin);

    // Asistentes por registro
    const asistentesMap = await this.obtenerAsistentes(registros ? registros.map((r: any) => r.id) : []);

    // Contenedor por categoría existente
    const categorias = new Map<string, MachineReportData[]>();
    for (const maquina of maquinas) {
      const categoria = (maquina as any).categoria || "Sin Categoría";
      if (!categorias.has(categoria)) categorias.set(categoria, []);
    }

    // Solo iteramos por REGISTROS reales (no generamos filas por días vacíos)
    for (const operario of operarios) {
      const registrosOperario =
        (registros || []).filter((r: any) => r.operario_id === (operario as any).id && !r.es_asistente) || [];

      if (registrosOperario.length === 0) continue;

      for (const registro of registrosOperario) {
        const categoria = registro.maquinas?.categoria || "Sin Categoría";
        const maquinaNombre = registro.maquinas?.nombre || "N/A";
        const asistentes = asistentesMap.get(registro.id) || [];
        const asistenteNombres = asistentes.length > 0 ? asistentes.join(", ") : "Sin asistente";
        const porcentajeSuma = porcentajesSumaOperarios.get(registro.operario_id) || 0;

        const categoriaDatos = categorias.get(categoria)!;

        if (registro.detalle_produccion && registro.detalle_produccion.length > 0) {
          for (const detalle of registro.detalle_produccion) {
            const producido = Number(detalle?.produccion_real ?? 0);
            const tipo = detalle?.productos?.tipo_producto || null;

            // Amarradora: usa % guardado (ya viene ajustado)
            let porcentajeCumplimiento: number;
            if (tipo === "arbol_amarradora") {
              porcentajeCumplimiento = Number(detalle?.porcentaje_cumplimiento ?? 0);
            } else {
              const topeAjustado = this.getTopeAjustadoPorTurno(registro.turno, {
                tope: detalle?.productos?.tope,
                tope10: detalle?.productos?.tope_jornada_10h,
                tope8: detalle?.productos?.tope_jornada_8h,
                tipo_producto: tipo,
              });
              const recalculado = topeAjustado > 0 ? (producido / topeAjustado) * 100 : 0;
              porcentajeCumplimiento =
                topeAjustado > 0 ? recalculado : Number(detalle?.porcentaje_cumplimiento ?? 0);
            }

            categoriaDatos.push({
              fecha: this.formatDate(registro.fecha), // SIN new Date
              turno: this.formatTurno(registro.turno),
              operario: (operario as any).nombre,
              asistente: asistenteNombres,
              maquina: maquinaNombre,
              producto: detalle?.productos?.nombre || "N/A",
              producido,
              porcentajeCumplimiento,
              porcentajeSuma: porcentajeSuma,
            });
          }
        } else {
          // Registro real pero SIN detalle
          categoriaDatos.push({
            fecha: this.formatDate(registro.fecha),
            turno: this.formatTurno(registro.turno),
            operario: (operario as any).nombre,
            asistente: asistenteNombres,
            maquina: maquinaNombre,
            producto: "Sin producto",
            producido: 0,
            porcentajeCumplimiento: 0,
            porcentajeSuma: porcentajeSuma,
          });
        }
      }
    }

    // Ordenamos por fecha (dd/mm/yyyy) sin usar Date (evita desfases)
    return Array.from(categorias.entries())
      .filter(([_, registros]) => registros.length > 0)
      .map(([categoria, registros]) => ({
        categoria,
        registros: registros.sort((a, b) => {
          const [da, ma, ya] = a.fecha.split("/").map(n => parseInt(n, 10));
          const [db, mb, yb] = b.fecha.split("/").map(n => parseInt(n, 10));
          if (ya !== yb) return ya - yb;
          if (ma !== mb) return ma - mb;
          if (da !== db) return da - db;
          return a.operario.localeCompare(b.operario);
        }),
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));
  }

  /** Ajusta meta (tope) según el turno (no se usa para amarradora) */
  private getTopeAjustadoPorTurno(
    turno: string,
    topes: { tope?: number | null; tope10?: number | null; tope8?: number | null; tipo_producto?: string | null },
  ): number {
    const t = (turno || "").trim();
    const tope8 = Number(topes.tope8 ?? 0);
    const tope10 = Number(topes.tope10 ?? 0);

    if (topes.tipo_producto === "arbol_amarradora") {
      return 0;
    }
    if (t === "7:00am - 5:00pm") return tope10; // jornada 10h
    return tope8; // por defecto 8h
  }

  // Helper: convierte Date a 'YYYY-MM-DD' con componentes locales (sin UTC)
  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Formatea una fecha 'YYYY-MM-DD' (o 'YYYY-MM-DDTHH:mm:ss...') a 'dd/mm/yyyy' sin usar new Date
  private formatDate(dbDate: string): string {
    const ymd = dbDate.split("T")[0];
    const [y, m, d] = ymd.split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  private async calcularPorcentajesSuma(
    registros: any[],
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<Map<string, number>> {
    const operarioIds = [...new Set(registros.map((r: any) => r.operario_id))];
    const porcentajesSuma = new Map<string, number>();

    for (const operarioId of operarioIds) {
      const diasTrabajados = await this.obtenerDiasTrabajados(operarioId, fechaInicio, fechaFin);
      if (diasTrabajados.length > 0) {
        const sumaTotal = diasTrabajados.reduce((sum, dia) => sum + dia.porcentajeTotal, 0);
        const promedio = sumaTotal / diasTrabajados.length;
        porcentajesSuma.set(operarioId, promedio);
      }
    }
    return porcentajesSuma;
  }

  private async obtenerDiasTrabajados(
    operarioId: string,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<{ fecha: string; porcentajeTotal: number }[]> {
    const startDate = this.toYMD(fechaInicio);
    const endDate   = this.toYMD(fechaFin);

    const { data: registros } = await supabase
      .from("registros_produccion")
      .select(
        `
        fecha,
        detalle_produccion!fk_detalle_produccion_registro(
          porcentaje_cumplimiento
        )
      `,
      )
      .eq("operario_id", operarioId)
      .eq("es_asistente", false)
      .gte("fecha", startDate)
      .lte("fecha", endDate);

    if (!registros) return [];

    const diasMap = new Map<string, number>();
    for (const registro of registros) {
      const ymd = (registro as any).fecha.split("T")[0]; // asegura date-only
      if (!diasMap.has(ymd)) diasMap.set(ymd, 0);
      if ((registro as any).detalle_produccion) {
        const porcentajeTotal = (registro as any).detalle_produccion.reduce(
          (sum: number, d: any) => sum + (d.porcentaje_cumplimiento || 0),
          0,
        );
        diasMap.set(ymd, (diasMap.get(ymd) || 0) + porcentajeTotal);
      }
    }
    // devolvemos fecha ya formateada dd/mm/yyyy
    return Array.from(diasMap.entries()).map(([ymd, porcentajeTotal]) => ({
      fecha: this.formatDate(ymd),
      porcentajeTotal,
    }));
  }

  private async obtenerAsistentes(registroIds: string[]): Promise<Map<string, string[]>> {
    if (!registroIds || registroIds.length === 0) return new Map();

    const { data: asistentes } = await supabase
      .from("registro_asistentes")
      .select(
        `
        registro_id,
        usuarios!fk_registro_asistentes_asistente(nombre)
      `,
      )
      .in("registro_id", registroIds);

    const asistentesMap = new Map<string, string[]>();
    if (asistentes) {
      for (const asistente of asistentes) {
        const registroId = (asistente as any).registro_id;
        const nombreAsistente = (asistente as any).usuarios?.nombre || "N/A";
        if (!asistentesMap.has(registroId)) asistentesMap.set(registroId, []);
        asistentesMap.get(registroId)!.push(nombreAsistente);
      }
    }
    return asistentesMap;
  }

  async exportToExcel(fechaInicio: Date, fechaFin: Date, reportData: MachineReportByCategory[]): Promise<void> {
    const workbook = XLSX.utils.book_new();

    for (const categoria of reportData) {
      if (categoria.registros.length === 0) continue;

      const headers = ["Fecha", "Turno", "Operario", "Asistente", "Máquina", "Producto", "Producido", "% Cumplimiento"];

      const sheetData = [
        headers,
        ...categoria.registros.map((registro) => [
          registro.fecha, // texto dd/mm/yyyy (evita desfases)
          registro.turno,
          registro.operario,
          registro.asistente,
          registro.maquina,
          registro.producto,
          registro.producido,
          `${registro.porcentajeCumplimiento.toFixed(1)}%`,
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      this.applyWorksheetStyles(worksheet);
      const sheetName = categoria.categoria.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const filename = this.generateFilename(fechaInicio, fechaFin);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, filename);
  }

  private applyWorksheetStyles(worksheet: XLSX.WorkSheet): void {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:H1");
    worksheet["!cols"] = [
      { width: 12 },
      { width: 15 },
      { width: 20 },
      { width: 25 },
      { width: 20 },
      { width: 25 },
      { width: 12 },
      { width: 15 },
    ];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      (worksheet as any)[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
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

  private formatTurno(turno: string): string {
    switch (turno) {
      case "manana":
        return "2:00 a 10:00";
      case "tarde":
        return "10:00 a 6:00";
      case "noche":
        return "6:00 a 2:00";
      default:
        return turno;
    }
  }

  private generateFilename(fechaInicio: Date, fechaFin: Date): string {
    const inicio = this.toYMD(fechaInicio);
    const fin = this.toYMD(fechaFin);
    return `reporte_produccion_maquinas_${inicio}_${fin}.xlsx`;
  }
}

export const machineReportService = new MachineReportService();
