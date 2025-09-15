import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  FileSpreadsheet, 
  Calendar,
  Download,
  Loader2,
  Factory,
  Users,
  TrendingUp
} from 'lucide-react';
import { machineReportService, MachineReportByCategory } from '@/services/MachineReportService';

export function MachineProductionReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [reportData, setReportData] = useState<MachineReportByCategory[]>([]);

  React.useEffect(() => {
    // Establecer fecha por defecto (último mes)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    setFechaInicio(inicioMes.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  }, []);

  const generateReport = async () => {
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

    setLoading(true);
    try {
      const data = await machineReportService.generateMachineReport(inicio, fin);
      
      if (data.length === 0) {
        toast({
          title: "Sin datos",
          description: "No se encontraron registros en el rango de fechas seleccionado",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reporte generado",
          description: `Se encontraron datos para ${data.length} categorías de máquinas`,
        });
      }
      
      setReportData(data);
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Error al generar el reporte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (reportData.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos para exportar. Genera el reporte primero.",
        variant: "destructive",
      });
      return;
    }

    setExportLoading(true);
    try {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      
      await machineReportService.exportToExcel(inicio, fin, reportData);
      
      toast({
        title: "Exportación exitosa",
        description: "El archivo Excel se ha descargado correctamente",
      });
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Error al exportar el archivo Excel",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const getCumplimientoColor = (porcentaje: number) => {
    if (porcentaje >= 80) return 'bg-success text-success-foreground';
    if (porcentaje >= 50) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Factory className="h-5 w-5 text-primary" />
            <span>Reporte de Producción por Máquina</span>
          </CardTitle>
          <CardDescription>
            Genera reportes detallados de producción organizados por categoría de máquina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            {/* Botones */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={generateReport} 
                disabled={loading || !fechaInicio || !fechaFin}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={exportToExcel}
                disabled={exportLoading || reportData.length === 0}
                variant="outline"
                className="w-full"
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              <span>Reporte por Categorías de Máquina</span>
            </CardTitle>
            <CardDescription>
              Datos de producción organizados por categoría. Cada tabla representa una categoría diferente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={reportData[0]?.categoria} className="w-full">
              <TabsList className="grid w-full grid-cols-auto">
                {reportData.map((categoria) => (
                  <TabsTrigger 
                    key={categoria.categoria} 
                    value={categoria.categoria}
                    className="flex items-center space-x-2"
                  >
                    <Factory className="h-4 w-4" />
                    <span>{categoria.categoria}</span>
                    <Badge variant="secondary" className="ml-1">
                      {categoria.registros.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {reportData.map((categoria) => (
                <TabsContent key={categoria.categoria} value={categoria.categoria}>
                  <div className="space-y-4">
                    {/* Resumen de la categoría */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-primary/5 border border-primary/10 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {categoria.registros.length}
                        </div>
                        <p className="text-sm text-muted-foreground">Total Registros</p>
                      </div>
                      
                      <div className="text-center p-4 bg-accent/5 border border-accent/10 rounded-lg">
                        <div className="text-2xl font-bold text-accent">
                          {[...new Set(categoria.registros.map(r => r.operario))].length}
                        </div>
                        <p className="text-sm text-muted-foreground">Operarios</p>
                      </div>
                      
                      <div className="text-center p-4 bg-success/5 border border-success/10 rounded-lg">
                        <div className="text-2xl font-bold text-success">
                          {(categoria.registros.reduce((sum, r) => sum + r.porcentajeCumplimiento, 0) / categoria.registros.length || 0).toFixed(1)}%
                        </div>
                        <p className="text-sm text-muted-foreground">Promedio Cumplimiento</p>
                      </div>
                    </div>

                    {/* Tabla de datos */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Turno</TableHead>
                            <TableHead>Operario</TableHead>
                            <TableHead>Asistente</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-center">Producido</TableHead>
                            <TableHead className="text-center">% Cumplimiento</TableHead>
                            <TableHead className="text-center">% Suma</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoria.registros.map((registro, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{registro.fecha}</span>
                                </div>
                              </TableCell>
                              <TableCell>{registro.turno}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{registro.operario}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {registro.asistente}
                              </TableCell>
                              <TableCell className="font-medium">
                                {registro.producto}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="font-semibold">
                                  {registro.producido.toLocaleString()}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={getCumplimientoColor(registro.porcentajeCumplimiento)}>
                                  {registro.porcentajeCumplimiento.toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <TrendingUp className="h-4 w-4 text-primary" />
                                  <span className="font-semibold text-primary">
                                    {registro.porcentajeSuma.toFixed(1)}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}