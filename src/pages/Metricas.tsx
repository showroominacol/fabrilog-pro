import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  Factory, 
  User,
  Users,
  BarChart3,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ExcelExportService } from '@/services/ExcelExportService';
import { summaryExcelService } from '@/services/SummaryExcelService';
import { AdminMetricsReport } from '@/components/admin/AdminMetricsReport';
import { MachineProductionReport } from '@/components/admin/MachineProductionReport';

type Usuario = Tables<'usuarios'>;
type Maquina = Tables<'maquinas'>;

interface MetricaProduccionDiaria {
  fecha: string;
  porcentaje_avance: number;
  productos_detalles: {
    nombre: string;
    produccion_real: number;
    meta: number;
    porcentaje: number;
  }[];
  es_operario: boolean;
}

interface ReporteMensual {
  operario: Usuario;
  dias_operario: number;
  dias_asistente: number;
  cumplimiento_mensual: number;
  maquinas_utilizadas: string[];
  fechas_operario: string[];
  fechas_asistente: string[];
  metricas_diarias: MetricaProduccionDiaria[];
}

export default function Metricas() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>('');
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [busquedaOperario, setBusquedaOperario] = useState<string>('');
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [summaryExportLoading, setSummaryExportLoading] = useState(false);
  const [fechaInicioExport, setFechaInicioExport] = useState<string>('');
  const [fechaFinExport, setFechaFinExport] = useState<string>('');
  const [fechaInicioSummary, setFechaInicioSummary] = useState<string>('');
  const [fechaFinSummary, setFechaFinSummary] = useState<string>('');

  useEffect(() => {
    loadUsuarios();
    // Establecer mes actual por defecto
    const fechaActual = new Date();
    setMesSeleccionado(`${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}`);
    
    // Si no es admin, seleccionar usuario actual
    if (!isAdmin && user) {
      setUsuarioSeleccionado(user.id);
    }
  }, [user, isAdmin]);

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
        .order('nombre');
      
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error loading usuarios:', error);
    }
  };

  const calcularMetricasDiarias = async (operarioId: string, mes: string): Promise<MetricaProduccionDiaria[]> => {
    const [año, mesNum] = mes.split('-');
    const fechaInicio = `${año}-${mesNum}-01`;
    const fechaFin = new Date(parseInt(año), parseInt(mesNum), 0).toISOString().split('T')[0];

    // Obtener registros del mes
    const { data: registros } = await supabase
      .from('registros_produccion')
      .select(`
        *,
        detalle_produccion!fk_detalle_produccion_registro(
          *,
          productos!fk_detalle_produccion_producto(
            nombre, 
            tope,
            productos_maquinas!fk_productos_maquinas_producto(maquina_id)
          )
        )
      `)
      .eq('operario_id', operarioId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha');

    if (!registros) return [];

    // Agrupar por fecha
    const registrosPorFecha = registros.reduce((acc, registro) => {
      const fecha = registro.fecha;
      if (!acc[fecha]) {
        acc[fecha] = [];
      }
      acc[fecha].push(registro);
      return acc;
    }, {} as Record<string, typeof registros>);

    const metricas: MetricaProduccionDiaria[] = [];

    for (const [fecha, registrosDia] of Object.entries(registrosPorFecha)) {
      let porcentajeAvanceTotal = 0;
      const productosDetalles: MetricaProduccionDiaria['productos_detalles'] = [];
      const esOperario = registrosDia.some(r => !r.es_asistente);

      for (const registro of registrosDia) {
        if (registro.detalle_produccion) {
          for (const detalle of registro.detalle_produccion) {
            if (detalle.productos) {
              // Usar el tope del producto como meta
              const metaProducto = (detalle.productos as any).tope || 0;
              const porcentajeProducto = metaProducto > 0 ? (detalle.produccion_real / metaProducto) * 100 : 0;
              
              porcentajeAvanceTotal += porcentajeProducto;

              productosDetalles.push({
                nombre: (detalle.productos as any).nombre,
                produccion_real: detalle.produccion_real,
                meta: metaProducto,
                porcentaje: porcentajeProducto
              });
            }
          }
        }
      }

      metricas.push({
        fecha,
        porcentaje_avance: porcentajeAvanceTotal,
        productos_detalles: productosDetalles,
        es_operario: esOperario
      });
    }

    return metricas;
  };

  const generateReporte = async () => {
    if (!usuarioSeleccionado || !mesSeleccionado) {
      toast({
        title: "Error",
        description: "Selecciona un operario y un mes",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Obtener datos del usuario
      const { data: operario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioSeleccionado)
        .single();

      if (!operario) {
        throw new Error('Usuario no encontrado');
      }

      // Calcular métricas diarias
      const metricasDiarias = await calcularMetricasDiarias(usuarioSeleccionado, mesSeleccionado);

      // Separar días como operario y asistente
      const diasOperario = metricasDiarias.filter(m => m.es_operario);
      const diasAsistente = metricasDiarias.filter(m => !m.es_operario);

      // Calcular cumplimiento mensual (promedio sobre 24 días)
      const sumaPorcentajes = diasOperario.reduce((sum, dia) => sum + dia.porcentaje_avance, 0);
      const cumplimientoMensual = sumaPorcentajes / 24; // Siempre dividir entre 24

      // Obtener máquinas utilizadas
      const [año, mesNum] = mesSeleccionado.split('-');
      const fechaInicio = `${año}-${mesNum}-01`;
      const fechaFin = new Date(parseInt(año), parseInt(mesNum), 0).toISOString().split('T')[0];

      const { data: maquinasUsadas } = await supabase
        .from('registros_produccion')
        .select(`
          maquinas!fk_registros_produccion_maquina(nombre)
        `)
        .eq('operario_id', usuarioSeleccionado)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

      const maquinasUnicas = [...new Set(
        maquinasUsadas?.map(m => m.maquinas?.nombre).filter(Boolean) || []
      )];

      const reporteData: ReporteMensual = {
        operario,
        dias_operario: diasOperario.length,
        dias_asistente: diasAsistente.length,
        cumplimiento_mensual: cumplimientoMensual,
        maquinas_utilizadas: maquinasUnicas,
        fechas_operario: diasOperario.map(d => d.fecha),
        fechas_asistente: diasAsistente.map(d => d.fecha),
        metricas_diarias: metricasDiarias
      };

      setReporte(reporteData);

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

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-success text-success-foreground';
    if (percentage >= 80) return 'bg-primary text-primary-foreground';
    if (percentage >= 60) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 100) return <CheckCircle className="h-4 w-4" />;
    if (percentage >= 80) return <TrendingUp className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const generateMonthOptions = () => {
    const options = [];
    const fechaActual = new Date();
    
    // Generar los últimos 12 meses
    for (let i = 0; i < 12; i++) {
      const fecha = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - i, 1);
      const valor = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const texto = fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
      options.push({ valor, texto });
    }
    
    return options;
  };

  const handleExportExcel = async () => {
    if (!fechaInicioExport || !fechaFinExport) {
      toast({
        title: "Error",
        description: "Selecciona las fechas de inicio y fin para la exportación",
        variant: "destructive",
      });
      return;
    }

    setExportLoading(true);
    try {
      const exportService = new ExcelExportService();
      
      // Validate permissions first
      await exportService.validateExportPermissions();
      
      const startDate = new Date(fechaInicioExport);
      const endDate = new Date(fechaFinExport);
      
      await exportService.generateProductionReport(startDate, endDate);
      
      toast({
        title: "¡Exportación Exitosa!",
        description: "El archivo Excel se ha descargado correctamente",
      });
      
    } catch (error: any) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "Error en Exportación",
        description: error.message || "No se pudo exportar el archivo Excel",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

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

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Generar Reporte</span>
          </CardTitle>
          <CardDescription>
            Selecciona un operario y mes para generar el reporte de métricas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Búsqueda de operario (solo para admin) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="busqueda">Buscar Operario</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    value={busquedaOperario}
                    onChange={(e) => setBusquedaOperario(e.target.value)}
                  />
                  
                  {/* Lista de resultados */}
                  {busquedaOperario.trim() && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
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
                              setUsuarioSeleccionado(usuario.id);
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
                  {usuarioSeleccionado && !busquedaOperario && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded border">
                      <span className="text-sm">
                        {usuarios.find(u => u.id === usuarioSeleccionado)?.nombre} 
                        ({usuarios.find(u => u.id === usuarioSeleccionado)?.cedula})
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setUsuarioSeleccionado('');
                          setBusquedaOperario('');
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selector de mes */}
            <div className="space-y-2">
              <Label htmlFor="mes">Mes</Label>
              <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {generateMonthOptions().map((opcion) => (
                    <SelectItem key={opcion.valor} value={opcion.valor}>
                      {opcion.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botón generar */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={generateReporte} 
                disabled={loading || !usuarioSeleccionado || !mesSeleccionado}
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

      {/* Admin Metrics Report */}
      {isAdmin && <AdminMetricsReport />}

      {/* Machine Production Report */}
      {isAdmin && <MachineProductionReport />}

      {/* Export to Excel */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5 text-success" />
              <span>Exportar a Excel</span>
            </CardTitle>
            <CardDescription>
              Genera un reporte completo de producción en formato Excel con múltiples hojas por área
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={fechaInicioExport}
                  onChange={(e) => setFechaInicioExport(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fechaFin">Fecha Fin</Label>
                <Input
                  id="fechaFin"
                  type="date"
                  value={fechaFinExport}
                  onChange={(e) => setFechaFinExport(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button 
                  onClick={handleExportExcel} 
                  disabled={exportLoading || !fechaInicioExport || !fechaFinExport}
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
            
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Características del archivo exportado:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Múltiples hojas: MONTERREY, 4 CABEZAS, AMARRADORAS, DATA</li>
                <li>• AutoFilter activado para fácil filtrado de datos</li>
                <li>• Encabezados fijos para navegación</li>
                <li>• Formato optimizado para impresión horizontal</li>
                <li>• Formatos numéricos y porcentuales aplicados</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Report Export */}
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

      {/* Reporte */}
      {reporte && (
        <div className="space-y-6">
          {/* Resumen del Operario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-primary" />
                <span>Resumen del Operario</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-semibold text-foreground">{reporte.operario.nombre}</p>
                  <p className="text-xs text-muted-foreground">Cédula: {reporte.operario.cedula}</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Días como Operario</p>
                  <p className="text-2xl font-bold text-primary">{reporte.dias_operario}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Días como Asistente</p>
                  <p className="text-2xl font-bold text-muted-foreground">{reporte.dias_asistente}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Cumplimiento Mensual</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-2xl font-bold text-foreground">
                      {reporte.cumplimiento_mensual.toFixed(1)}%
                    </p>
                    <Badge className={getPerformanceColor(reporte.cumplimiento_mensual)}>
                      {getPerformanceIcon(reporte.cumplimiento_mensual)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Máquinas utilizadas */}
              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">Máquinas Utilizadas</p>
                <div className="flex flex-wrap gap-2">
                  {reporte.maquinas_utilizadas.map((maquina, idx) => (
                    <Badge key={idx} variant="outline">
                      <Factory className="mr-1 h-3 w-3" />
                      {maquina}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Métricas Diarias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Métricas Diarias</span>
              </CardTitle>
              <CardDescription>
                Desglose de producción por día (Solo días como operario cuentan para el cumplimiento)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reporte.metricas_diarias.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay registros para este mes</p>
                  </div>
                ) : (
                  reporte.metricas_diarias.map((metrica, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant={metrica.es_operario ? "default" : "secondary"}>
                            {metrica.es_operario ? 'Operario' : 'Asistente'}
                          </Badge>
                          <p className="font-medium text-foreground">
                            {new Date(metrica.fecha).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        
                        {metrica.es_operario && (
                          <Badge className={getPerformanceColor(metrica.porcentaje_avance)}>
                            {getPerformanceIcon(metrica.porcentaje_avance)}
                            <span className="ml-1">{metrica.porcentaje_avance.toFixed(1)}%</span>
                          </Badge>
                        )}
                      </div>

                      {/* Detalles por producto */}
                      <div className="space-y-2">
                        {metrica.productos_detalles.map((producto, prodIdx) => (
                          <div key={prodIdx} className="flex items-center justify-between bg-muted/50 rounded p-3">
                            <div>
                              <p className="font-medium text-foreground">{producto.nombre}</p>
                              <p className="text-sm text-muted-foreground">
                                Producido: {producto.produccion_real} / Meta: {producto.meta}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {producto.porcentaje.toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}