import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Factory,
  Download,
  Loader2,
} from 'lucide-react';
import { machineReportService } from '@/services/MachineReportService';

export function MachineProductionReport() {
  const { toast } = useToast();
  const [exportLoading, setExportLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  React.useEffect(() => {
    // Establecer fecha por defecto (último mes)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    setFechaInicio(inicioMes.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  }, []);

  const handleGenerateExcel = async () => {
    if (!fechaInicio || !fechaFin) {
      toast({
        title: "Error",
        description: "Selecciona el rango de fechas",
        variant: "destructive",
      });
      return;
    }

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Validar que el rango no sea mayor a 3 meses
    const diferenciaMeses = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (diferenciaMeses > 3) {
      toast({
        title: "Error",
        description: "El rango de fechas no puede ser mayor a 3 meses",
        variant: "destructive",
      });
      return;
    }

    setExportLoading(true);
    try {
      // 1) Obtener datos
      const data = await machineReportService.generateMachineReport(inicio, fin);

      if (!data || data.length === 0) {
        toast({
          title: "Sin datos",
          description: "No se encontraron registros en el rango de fechas seleccionado",
          variant: "destructive",
        });
        return;
      }

      // 2) Exportar directamente el Excel
      await machineReportService.exportToExcel(inicio, fin, data);

      toast({
        title: "Exportación exitosa",
        description: "El archivo Excel se ha descargado correctamente",
      });
    } catch (error) {
      console.error('Error al generar/exportar Excel:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el archivo Excel",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Factory className="h-5 w-5 text-primary" />
            <span>Reporte de Producción por Máquina</span>
          </CardTitle>
          <CardDescription>
            Descarga directamente el Excel por rango de fechas (sin vista previa en pantalla)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rango de fechas */}
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">Fecha Inicio</Label>
              <Input
                id="fechaInicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaFin">Fecha Fin</Label>
              <Input
                id="fechaFin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>

            {/* Botón único: Generar Excel */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={handleGenerateExcel}
                disabled={exportLoading || !fechaInicio || !fechaFin}
                className="w-full"
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando Excel...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Generar y Descargar Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
