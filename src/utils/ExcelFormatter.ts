import * as XLSX from 'xlsx';

export class ExcelFormatter {
  static readonly COLUMN_HEADERS = [
    'FECHA',
    'TURNO',
    'OPERARIO',
    'SECCIONADOR, CORTADOR, PEINADOR',
    'MÁQUINA',
    'REFERENCIA',
    'CANTIDAD',
    'CANTIDAD EN FESTONES',
    'META EN FESTONES',
    '% PORCENTAJE DE CUMPLIMIENTO',
    'SUMA % DE CUMPLIMIENTO',
    'PESO ALAMBRE (KG)',
    'DESPERDICIO ALAMBRE (KG)',
    'CALIBRE DEL ALAMBRE',
    'DESPERDICIO PVC RIPIO',
    'PESO CINTA',
    'OBSERVACIONES'
  ];

  static applyWorksheetStyles(worksheet: XLSX.WorkSheet): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Apply AutoFilter
    worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1' };
    
    // Apply Freeze Panes (freeze first row)
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' };
    
    // Set column widths
    const columnWidths = [
      { wch: 12 }, // FECHA
      { wch: 18 }, // TURNO
      { wch: 20 }, // OPERARIO
      { wch: 25 }, // SECCIONADOR, CORTADOR, PEINADOR
      { wch: 15 }, // MÁQUINA
      { wch: 20 }, // REFERENCIA
      { wch: 12 }, // CANTIDAD
      { wch: 18 }, // CANTIDAD EN FESTONES
      { wch: 18 }, // META EN FESTONES
      { wch: 20 }, // % PORCENTAJE DE CUMPLIMIENTO
      { wch: 22 }, // SUMA % DE CUMPLIMIENTO
      { wch: 18 }, // PESO ALAMBRE (KG)
      { wch: 22 }, // DESPERDICIO ALAMBRE (KG)
      { wch: 20 }, // CALIBRE DEL ALAMBRE
      { wch: 20 }, // DESPERDICIO PVC RIPIO
      { wch: 15 }, // PESO CINTA
      { wch: 20 }  // OBSERVACIONES
    ];
    worksheet['!cols'] = columnWidths;

    // Apply header styles (row 1)
    for (let col = 0; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellRef]) continue;
      
      worksheet[cellRef].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }

    // Apply data formatting to rows
    for (let row = 1; row <= range.e.r; row++) {
      for (let col = 0; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellRef]) continue;

        // Apply borders to all cells
        worksheet[cellRef].s = {
          ...worksheet[cellRef].s,
          border: {
            top: { style: 'thin', color: { rgb: 'D0D0D0' } },
            bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
            left: { style: 'thin', color: { rgb: 'D0D0D0' } },
            right: { style: 'thin', color: { rgb: 'D0D0D0' } }
          }
        };

        // Apply specific formatting based on column
        const columnIndex = col;
        
        // Numeric columns with 2 decimals
        if ([6, 7, 8, 11, 12, 14, 15].includes(columnIndex)) {
          worksheet[cellRef].s = {
            ...worksheet[cellRef].s,
            numFmt: '0.00'
          };
        }
        
        // Percentage columns
        if ([9, 10].includes(columnIndex)) {
          worksheet[cellRef].s = {
            ...worksheet[cellRef].s,
            numFmt: '0.00%'
          };
          // Convert decimal to percentage
          if (typeof worksheet[cellRef].v === 'number') {
            worksheet[cellRef].v = worksheet[cellRef].v / 100;
          }
        }
        
        // Date column
        if (columnIndex === 0) {
          worksheet[cellRef].s = {
            ...worksheet[cellRef].s,
            numFmt: 'dd/mm/yyyy'
          };
        }
      }
    }
  }

  static configureWorkbookForPrint(workbook: XLSX.WorkBook): void {
    // Configure print settings for each worksheet
    Object.keys(workbook.Sheets).forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Print settings
      worksheet['!margins'] = {
        left: 0.25,
        right: 0.25,
        top: 0.25,
        bottom: 0.25,
        header: 0.3,
        footer: 0.3
      };
      
      // Page setup
      worksheet['!pageSetup'] = {
        orientation: 'landscape',
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 1, // Letter size
        scale: 100
      };
      
      // Print titles (repeat headers)
      worksheet['!printTitles'] = {
        rows: '1:1'
      };
    });
  }

  static generateFilename(fechaInicio: Date, fechaFin: Date): string {
    const formatDate = (date: Date): string => {
      return date.toISOString().slice(0, 10).replace(/-/g, '');
    };
    
    const inicio = formatDate(fechaInicio);
    const fin = formatDate(fechaFin);
    
    return `PRODUCCION_${inicio}_${fin}.xlsx`;
  }

  static validateDateRange(fechaInicio: Date, fechaFin: Date): void {
    if (fechaInicio > fechaFin) {
      throw new Error('La fecha de inicio debe ser anterior a la fecha final');
    }
    
    const diffTime = Math.abs(fechaFin.getTime() - fechaInicio.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 90) {
      throw new Error('El rango de fechas no puede ser mayor a 3 meses (90 días)');
    }
  }

  static createArrayFromData<T extends Record<string, any>>(
    data: T[], 
    headers: string[], 
    fieldMapper: (item: T) => any[]
  ): any[][] {
    const result = [headers];
    data.forEach(item => {
      result.push(fieldMapper(item));
    });
    return result;
  }
}