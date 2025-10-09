import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3,
  FileText,
  Loader2,
} from 'lucide-react';
import { summaryExcelService } from '@/services/SummaryExcelService';
import { MachineProductionReport } from '@/components/admin/MachineProductionReport';

export default function Metricas() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [summaryExportLoading, setSummaryExportLoading] = useState(false);
  const [fechaInicioSummary, setFechaInicioSummary] = useState<string>('');
  const [fechaFinSummary, setFechaFinSummary] = useState<string>('');

  const handleSummaryExport = async () => {
    if (!fechaInicioSummary || !fechaFinSummary) {
      toast({
        title: "Error",
        description: "Selecciona las fechas de inicio y fin para el reporte resumen",
        variant: "destructive",
      });
      return;
    }

    setSummaryExportLoading(true);
    try {
      const startDate = new Date(fechaInicioSummary);
      const endDate = new Date(fechaFinSummary);
      await summaryExcelService.generateSummaryReport(startDate, endDate);
      toast({
        title: "¡Reporte Resumen Generado!",
        description: "El archivo Excel con formato resumen se ha descargado correctamente",
      });
    } catch (error: any) {
      console.error('Error generating summary report:', error);
      toast({
        title: "Error en Reporte Resumen",
        description: error.message || "No se pudo generar el reporte resumen",
        variant: "destructive",
      });
    } finally {
      setSummaryExportLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Métricas de Producción</h1>
          <p className="text-muted-foreground">
            Análisis de cumplimiento y productividad mensual
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>Sistema de Métricas</span>
        </div>
      </div>

      {/* Reporte de Producción por Máquina */}
      {isAdmin && <MachineProductionReport />}

      {/* Reporte Resumen */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Reporte Resumen</span>
            </CardTitle>
            <CardDescription>
              Genera el reporte resumen con formato específico: encabezados combinados y bloques por categoría (% | DÍAS | HORAS)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicioSummary">Fecha Inicio</Label>
                <Input
                  id="fechaInicioSummary"
                  type="date"
                  value={fechaInicioSummary}
                  onChange={(e) => setFechaInicioSummary(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fechaFinSummary">Fecha Fin</Label>
                <Input
                  id="fechaFinSummary"
                  type="date"
                  value={fechaFinSummary}
                  onChange={(e) => setFechaFinSummary(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button 
                  onClick={handleSummaryExport}
                  disabled={summaryExportLoading || !fechaInicioSummary || !fechaFinSummary}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {summaryExportLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generar Resumen
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Características del reporte resumen:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Formato único con encabezados combinados por categoría</li>
                <li>• Bloques OP y AYU con métricas: % | DÍAS | HORAS</li>
                <li>• Cálculo de % como promedio de sumas diarias por producto</li>
                <li>• Incluye empleados sin actividad (valores en 0)</li>
                <li>• Archivo: RESUMEN_YYYYMMDD_YYYYMMDD.xlsx</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
