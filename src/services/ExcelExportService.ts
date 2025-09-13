import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import { ProductionData, ExportConfig, AreaData, DatabaseRecord, AREAS_CONFIG, AreaName } from '@/types/ExportTypes';
import { ExcelFormatter } from '@/utils/ExcelFormatter';

export class ExcelExportService {
  private async fetchProductionData(config: ExportConfig): Promise<DatabaseRecord[]> {
    const { fechaInicio, fechaFin } = config;
    
    const startDate = fechaInicio.toISOString().split('T')[0];
    const endDate = fechaFin.toISOString().split('T')[0];
    
    const { data, error } = await supabase
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

    return data as DatabaseRecord[] || [];
  }

  private transformToProductionData(records: DatabaseRecord[]): ProductionData[] {
    const productionData: ProductionData[] = [];

    records.forEach(record => {
      if (!record.detalle_produccion || record.detalle_produccion.length === 0) {
        // Create a row even if no production details
        productionData.push({
          fecha: this.formatDate(record.fecha),
          turno: record.turno,
          operario: record.usuarios?.nombre || 'N/A',
          seccionadorCortadorPeinador: record.es_asistente ? 'Asistente' : 'Operario Principal',
          maquina: record.maquinas?.nombre || 'N/A',
          referencia: 'Sin productos',
          cantidad: 0,
          cantidadEnFestones: 0,
          metaEnFestones: 0,
          porcentajeCumplimiento: 0,
          sumaPorcentajeCumplimiento: 0,
          pesoAlambreKg: 0,
          desperdicioAlambreKg: 0,
          calibreAlambre: 'N/A',
          desperdicioPvcRipio: 0,
          pesoCinta: 0,
          observaciones: 'Sin detalles de producción'
        });
        return;
      }

      record.detalle_produccion.forEach(detalle => {
        productionData.push({
          fecha: this.formatDate(record.fecha),
          turno: record.turno,
          operario: record.usuarios?.nombre || 'N/A',
          seccionadorCortadorPeinador: record.es_asistente ? 'Asistente' : 'Operario Principal',
          maquina: record.maquinas?.nombre || 'N/A',
          referencia: detalle.productos?.nombre || 'N/A',
          cantidad: detalle.produccion_real || 0,
          cantidadEnFestones: detalle.produccion_real || 0, // Assuming same as cantidad for now
          metaEnFestones: 0, // Will be calculated if meta data is available
          porcentajeCumplimiento: detalle.porcentaje_cumplimiento || 0,
          sumaPorcentajeCumplimiento: detalle.porcentaje_cumplimiento || 0,
          pesoAlambreKg: 0, // Not available in current schema
          desperdicioAlambreKg: 0, // Not available in current schema
          calibreAlambre: 'N/A', // Not available in current schema
          desperdicioPvcRipio: 0, // Not available in current schema
          pesoCinta: 0, // Not available in current schema
          observaciones: ''
        });
      });
    });

    return productionData;
  }

  private groupDataByArea(data: ProductionData[]): AreaData[] {
    const areaMap = new Map<string, ProductionData[]>();
    
    // Initialize areas
    AREAS_CONFIG.forEach(area => {
      areaMap.set(area, []);
    });

    data.forEach(record => {
      // Map machine categories to areas (this mapping can be adjusted based on business logic)
      let area: AreaName = 'MONTERREY'; // Default area
      
      const maquina = record.maquina.toLowerCase();
      if (maquina.includes('4') || maquina.includes('cabeza')) {
        area = '4 CABEZAS';
      } else if (maquina.includes('amarr')) {
        area = 'AMARRADORAS';
      }
      
      const areaData = areaMap.get(area) || [];
      areaData.push(record);
      areaMap.set(area, areaData);
    });

    return Array.from(areaMap.entries()).map(([name, data]) => ({
      name,
      data
    }));
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }

  private createWorkbook(): XLSX.WorkBook {
    return XLSX.utils.book_new();
  }

  private addAreaSheet(workbook: XLSX.WorkBook, areaName: string, data: ProductionData[]): void {
    const headers = ExcelFormatter.COLUMN_HEADERS;
    
    const sheetData = ExcelFormatter.createArrayFromData(
      data,
      headers,
      (item: ProductionData) => [
        item.fecha,
        item.turno,
        item.operario,
        item.seccionadorCortadorPeinador,
        item.maquina,
        item.referencia,
        item.cantidad,
        item.cantidadEnFestones,
        item.metaEnFestones,
        item.porcentajeCumplimiento,
        item.sumaPorcentajeCumplimiento,
        item.pesoAlambreKg,
        item.desperdicioAlambreKg,
        item.calibreAlambre,
        item.desperdicioPvcRipio,
        item.pesoCinta,
        item.observaciones
      ]
    );

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    ExcelFormatter.applyWorksheetStyles(worksheet);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, areaName);
  }

  private addDataSheet(workbook: XLSX.WorkBook, allData: ProductionData[]): void {
    const headers = ExcelFormatter.COLUMN_HEADERS;
    
    const sheetData = ExcelFormatter.createArrayFromData(
      allData,
      headers,
      (item: ProductionData) => [
        item.fecha,
        item.turno,
        item.operario,
        item.seccionadorCortadorPeinador,
        item.maquina,
        item.referencia,
        item.cantidad,
        item.cantidadEnFestones,
        item.metaEnFestones,
        item.porcentajeCumplimiento,
        item.sumaPorcentajeCumplimiento,
        item.pesoAlambreKg,
        item.desperdicioAlambreKg,
        item.calibreAlambre,
        item.desperdicioPvcRipio,
        item.pesoCinta,
        item.observaciones
      ]
    );

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    ExcelFormatter.applyWorksheetStyles(worksheet);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DATA');
  }

  private downloadFile(workbook: XLSX.WorkBook, filename: string): void {
    try {
      ExcelFormatter.configureWorkbookForPrint(workbook);
      
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'array',
        bookSST: true,
        cellStyles: true
      });
      
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error generating Excel file:', error);
      throw new Error('Error al generar el archivo Excel');
    }
  }

  async generateProductionReport(fechaInicio: Date, fechaFin: Date, areas?: string[]): Promise<void> {
    try {
      // Validate inputs
      ExcelFormatter.validateDateRange(fechaInicio, fechaFin);
      
      const config: ExportConfig = { fechaInicio, fechaFin, areas };
      
      // Fetch data
      const records = await this.fetchProductionData(config);
      
      if (records.length === 0) {
        throw new Error('No se encontraron registros en el rango de fechas seleccionado');
      }
      
      // Transform and group data
      const productionData = this.transformToProductionData(records);
      const groupedData = this.groupDataByArea(productionData);
      
      // Create workbook
      const workbook = this.createWorkbook();
      
      // Add area sheets
      groupedData.forEach(areaData => {
        if (!areas || areas.includes(areaData.name)) {
          this.addAreaSheet(workbook, areaData.name, areaData.data);
        }
      });
      
      // Add consolidated DATA sheet
      this.addDataSheet(workbook, productionData);
      
      // Generate filename and download
      const filename = ExcelFormatter.generateFilename(fechaInicio, fechaFin);
      this.downloadFile(workbook, filename);
      
    } catch (error) {
      console.error('Error in generateProductionReport:', error);
      throw error;
    }
  }

  async validateExportPermissions(): Promise<void> {
    // This can be extended based on your authentication system
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Additional permission checks can be added here
    // For example, checking user roles in your usuarios table
    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('tipo_usuario')
      .eq('id', user.id)
      .single();

    if (userProfile?.tipo_usuario !== 'admin') {
      throw new Error('No tienes permisos para exportar reportes');
    }
  }
}