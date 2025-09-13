import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Calendar, 
  Target,
  Award,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
  Loader2
} from 'lucide-react';
import { metricsService, OperatorMetrics } from '@/services/MetricsService';
import { Tables } from '@/integrations/supabase/types';

type Usuario = Tables<'usuarios'>;

export function AdminMetricsReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [operarioSeleccionado, setOperarioSeleccionado] = useState<string>('');
  const [reportes, setReportes] = useState<OperatorMetrics[]>([]);
  const [busquedaOperario, setBusquedaOperario] = useState<string>('');
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);

  useEffect(() => {
    loadUsuarios();
    // Establecer fecha por defecto (último mes)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    setFechaInicio(inicioMes.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  }, []);

  // Filtrar usuarios basado en la búsqueda
  useEffect(() => {
    if (!busquedaOperario.trim()) {
      setUsuariosFiltrados([]);
      return;
    }
    
    const filtrados = usuarios.filter(usuario => 
      usuario.nombre.toLowerCase().includes(busquedaOperario.toLowerCase()) ||
      usuario.cedula.toLowerCase().includes(busquedaOperario.toLowerCase())
    );
    setUsuariosFiltrados(filtrados);
  }, [busquedaOperario, usuarios]);

  const loadUsuarios = async () => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('activo', true)
        .eq('tipo_usuario', 'operario')
        .order('nombre');
      
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error loading usuarios:', error);
    }
  };

  const generateReporte = async () => {
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
      let operarios: string[] = [];
      
      if (operarioSeleccionado) {
        operarios = [operarioSeleccionado];
      }

      const reportesData = await metricsService.generarReporteConsolidado(inicio, fin, operarios);
      
      if (reportesData.length === 0) {
        toast({
          title: "Sin datos",
          description: "No se encontraron registros en el rango de fechas seleccionado",
          variant: "destructive",
        });
      }
      
      setReportes(reportesData);
      
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

  const getBonusColor = (promedio: number) => {
    if (promedio >= 80) return 'bg-success text-success-foreground';
    if (promedio >= 50) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getBonusIcon = (promedio: number) => {
    if (promedio >= 80) return <Award className="h-4 w-4" />;
    if (promedio >= 50) return <Clock className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Reporte de Métricas y Bonos</span>
          </CardTitle>
          <CardDescription>
            Análisis de cumplimiento y bonificaciones por operario (excluyendo domingos)
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

            {/* Búsqueda de operario */}
            <div className="space-y-2">
              <Label htmlFor="operario">Operario (Opcional)</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Buscar por nombre o cédula..."
                  value={busquedaOperario}
                  onChange={(e) => setBusquedaOperario(e.target.value)}
                />
                
                {/* Lista de resultados */}
                {busquedaOperario.trim() && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {usuariosFiltrados.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No se encontraron operarios
                      </div>
                    ) : (
                      usuariosFiltrados.map((usuario) => (
                        <button
                          key={usuario.id}
                          className="w-full text-left p-2 hover:bg-muted transition-colors border-b last:border-b-0"
                          onClick={() => {
                            setOperarioSeleccionado(usuario.id);
                            setBusquedaOperario(usuario.nombre);
                            setUsuariosFiltrados([]);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{usuario.nombre}</span>
                            <span className="text-sm text-muted-foreground">({usuario.cedula})</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                
                {/* Operario seleccionado */}
                {operarioSeleccionado && !busquedaOperario && (
                  <div className="flex items-center justify-between p-2 bg-muted rounded border">
                    <span className="text-sm">
                      {usuarios.find(u => u.id === operarioSeleccionado)?.nombre}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setOperarioSeleccionado('');
                        setBusquedaOperario('');
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Botón generar */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={generateReporte} 
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
                    <FileText className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {reportes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-accent" />
              <span>Resultados del Reporte</span>
            </CardTitle>
            <CardDescription>
              Métricas de cumplimiento y bonificación por operario (días laborales solamente)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operario</TableHead>
                    <TableHead className="text-center">Promedio</TableHead>
                    <TableHead className="text-center">Días Lab.</TableHead>
                    <TableHead className="text-center">Días Prod.</TableHead>
                    <TableHead className="text-center">Bono+</TableHead>
                    <TableHead className="text-center">Neutro</TableHead>
                    <TableHead className="text-center">Penaliz.</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportes.map((reporte) => (
                    <TableRow key={reporte.operarioId}>
                      <TableCell>
                        <div className="font-medium">{reporte.operarioNombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {usuarios.find(u => u.id === reporte.operarioId)?.cedula}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-semibold text-lg">
                          {reporte.promedioMensual.toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {reporte.diasLaborales}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium">{reporte.diasConProduccion}</div>
                        {reporte.diasConProduccion < reporte.diasLaborales && (
                          <div className="text-xs text-muted-foreground">
                            ({reporte.diasLaborales - reporte.diasConProduccion} sin reg.)
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success">
                          {reporte.clasificacionBonos.diasBonoPositivo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-warning/10 text-warning">
                          {reporte.clasificacionBonos.diasNeutros}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-destructive/10 text-destructive">
                          {reporte.clasificacionBonos.diasPenalizacion}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getBonusColor(reporte.promedioMensual)}>
                          {getBonusIcon(reporte.promedioMensual)}
                          <span className="ml-1">
                            {reporte.promedioMensual >= 80 ? 'Bono +' : 
                             reporte.promedioMensual >= 50 ? 'Neutro' : 'Penaliz.'}
                          </span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Resumen consolidado */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-success/5 border border-success/10 rounded-lg">
                <div className="text-2xl font-bold text-success">
                  {reportes.filter(r => r.promedioMensual >= 80).length}
                </div>
                <p className="text-sm text-muted-foreground">Operarios con Bono</p>
              </div>
              
              <div className="text-center p-4 bg-warning/5 border border-warning/10 rounded-lg">
                <div className="text-2xl font-bold text-warning">
                  {reportes.filter(r => r.promedioMensual >= 50 && r.promedioMensual < 80).length}
                </div>
                <p className="text-sm text-muted-foreground">Operarios Neutros</p>
              </div>
              
              <div className="text-center p-4 bg-destructive/5 border border-destructive/10 rounded-lg">
                <div className="text-2xl font-bold text-destructive">
                  {reportes.filter(r => r.promedioMensual < 50).length}
                </div>
                <p className="text-sm text-muted-foreground">Operarios con Penaliz.</p>
              </div>
              
              <div className="text-center p-4 bg-primary/5 border border-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {reportes.reduce((acc, r) => acc + r.promedioMensual, 0) / reportes.length || 0}%
                </div>
                <p className="text-sm text-muted-foreground">Promedio General</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}