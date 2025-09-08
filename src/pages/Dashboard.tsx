import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  Target, 
  Users, 
  Factory, 
  Clock, 
  BarChart3,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type RegistroProduccion = Tables<'registros_produccion'>;
type Maquina = Tables<'maquinas'>;
type Usuario = Tables<'usuarios'>;

interface DashboardMetrics {
  totalRegistros: number;
  cumplimientoPromedio: number;
  maquinasActivas: number;
  operariosActivos: number;
  registrosHoy: number;
  produccionHoy: number;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRegistros: 0,
    cumplimientoPromedio: 0,
    maquinasActivas: 0,
    operariosActivos: 0,
    registrosHoy: 0,
    produccionHoy: 0,
  });
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Obtener métricas generales
      const [
        { count: totalRegistros },
        { data: registros },
        { count: maquinasActivas },
        { count: operariosActivos },
      ] = await Promise.all([
        supabase.from('registros_produccion').select('*', { count: 'exact', head: true }),
        supabase.from('registros_produccion').select('porcentaje_cumplimiento, produccion_real, fecha').gte('fecha', new Date().toISOString().split('T')[0]),
        supabase.from('maquinas').select('*', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true),
      ]);

      // Calcular métricas de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const registrosHoy = registros?.filter(r => r.fecha === hoy) || [];
      
      const cumplimientoPromedio = registros && registros.length > 0
        ? registros.reduce((acc, r) => acc + r.porcentaje_cumplimiento, 0) / registros.length
        : 0;

      const produccionHoy = registrosHoy.reduce((acc, r) => acc + r.produccion_real, 0);

      setMetrics({
        totalRegistros: totalRegistros || 0,
        cumplimientoPromedio,
        maquinasActivas: maquinasActivas || 0,
        operariosActivos: operariosActivos || 0,
        registrosHoy: registrosHoy.length,
        produccionHoy,
      });

      // Obtener registros recientes con información relacionada
      const { data: recentData } = await supabase
        .from('registros_produccion')
        .select(`
          *,
          maquinas (nombre),
          productos (nombre),
          usuarios (nombre)
        `)
        .order('fecha_registro', { ascending: false })
        .limit(isAdmin ? 10 : 5);

      setRecentRecords(recentData || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <div className="animate-pulse bg-muted h-8 w-32 rounded"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido, <span className="font-semibold text-foreground">{profile?.nombre}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cumplimiento Promedio
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.cumplimientoPromedio.toFixed(1)}%
            </div>
            <Badge className={`mt-2 ${getPerformanceColor(metrics.cumplimientoPromedio)}`}>
              {getPerformanceIcon(metrics.cumplimientoPromedio)}
              <span className="ml-1">
                {metrics.cumplimientoPromedio >= 100 ? 'Excelente' : 
                 metrics.cumplimientoPromedio >= 80 ? 'Bueno' :
                 metrics.cumplimientoPromedio >= 60 ? 'Regular' : 'Crítico'}
              </span>
            </Badge>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Producción Hoy
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.produccionHoy.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.registrosHoy} registros hoy
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Máquinas Activas
            </CardTitle>
            <Factory className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.maquinasActivas}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              En producción
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Operarios Activos
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.operariosActivos}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Usuarios registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Records */}
      <Card className="metric-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Registros Recientes</span>
          </CardTitle>
          <CardDescription>
            Últimos registros de producción {isAdmin ? 'del sistema' : 'de tus turnos'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRecords.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay registros recientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentRecords.map((record, index) => (
                <div 
                  key={record.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Badge className={getPerformanceColor(record.porcentaje_cumplimiento)}>
                        {record.porcentaje_cumplimiento.toFixed(1)}%
                      </Badge>
                      <div>
                        <p className="font-medium text-foreground">
                          {record.maquinas?.nombre} - {record.productos?.nombre}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.usuarios?.nombre} • {record.turno}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {record.produccion_real.toLocaleString()} unidades
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.fecha).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}