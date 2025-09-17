import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { OperarioMetricsCard } from '@/components/operario/OperarioMetricsCard';
import { Progress } from '@/components/ui/progress';

// Helper para obtener rango del día en horario local
const getTodayRangeISO = () => {
  const start = new Date(); 
  start.setHours(0, 0, 0, 0);
  const end = new Date(); 
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

// Normalizar porcentajes (0-1 → 0-100)
const toPct100 = (v: number) => (v > 0 && v <= 1 ? v * 100 : v);

interface DashboardMetrics {
  totalRegistros: number;
  cumplimientoPromedio: number;
  maquinasActivas: number;
  operariosActivos: number;
  registrosHoy: number;
  produccionHoy: number;
}

interface RegistroConDetalles {
  id: string;
  fecha?: string;
  turno?: string;
  es_asistente?: boolean;
  fecha_registro: string;
  maquinas: { nombre: string } | null;
  usuarios: { nombre: string } | null;
  detalle_produccion: {
    produccion_real: number;
    porcentaje_cumplimiento: number;
    productos: { nombre: string } | null;
  }[];
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRegistros: 0,
    cumplimientoPromedio: 0,
    maquinasActivas: 0,
    operariosActivos: 0,
    registrosHoy: 0,
    produccionHoy: 0,
  });
  const [recentRecords, setRecentRecords] = useState<RegistroConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMoreRecent, setShowMoreRecent] = useState(false);

  
  // Guard para evitar llamadas concurrentes
  const loadingRef = useRef(false);
  const recentVisible = isAdmin 
  ? recentRecords 
  : (showMoreRecent ? recentRecords.slice(0, 18) : recentRecords.slice(0, 3));


  const loadDashboardData = useCallback(async () => {
    // Evitar llamadas duplicadas
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);

      const { startISO, endISO } = getTodayRangeISO();

      // Construir consultas según el rol del usuario
      let registrosQuery = supabase.from('registros_produccion').select('*', { count: 'exact', head: true });
      let registrosHoyQuery = supabase
        .from('registros_produccion')
        .select(`
          id,
          fecha_registro,
          detalle_produccion!fk_detalle_produccion_registro(
            produccion_real,
            porcentaje_cumplimiento
          )
        `)
        .gte('fecha_registro', startISO)
        .lte('fecha_registro', endISO);

      // Filtrar por operario si no es admin
      if (!isAdmin && user?.id) {
        registrosQuery = registrosQuery.eq('operario_id', user.id);
        registrosHoyQuery = registrosHoyQuery.eq('operario_id', user.id);
      }

      // Consultas optimizadas usando aliases específicos de FK
      const [
        { count: totalRegistros },
        { count: maquinasActivas },
        { count: operariosActivos },
        { data: registrosHoyData }
      ] = await Promise.all([
        registrosQuery,
        supabase.from('maquinas').select('*', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true),
        registrosHoyQuery
      ]);

      // Calcular métricas de producción del día con suma de porcentajes
      let produccionTotal = 0;
      let cumplimientoTotal = 0;

      registrosHoyData?.forEach(registro => {
        registro.detalle_produccion?.forEach(detalle => {
          produccionTotal += detalle.produccion_real || 0;
          // Normalizar porcentaje antes de sumar
          const pctNormalizado = toPct100(detalle.porcentaje_cumplimiento || 0);
          cumplimientoTotal += pctNormalizado;
        });
      });

      // El cumplimiento es la suma total de porcentajes del día
      const cumplimientoPromedio = Math.max(0, cumplimientoTotal);

      setMetrics({
        totalRegistros: totalRegistros || 0,
        cumplimientoPromedio,
        maquinasActivas: maquinasActivas || 0,
        operariosActivos: operariosActivos || 0,
        registrosHoy: registrosHoyData?.length || 0,
        produccionHoy: produccionTotal,
      });

      // Obtener registros recientes con aliases específicos
      let recentQuery = supabase
        .from('registros_produccion')
        .select(`
          *,
          maquinas!fk_registros_produccion_maquina(nombre),
          usuarios!fk_registros_produccion_operario(nombre),
          detalle_produccion!fk_detalle_produccion_registro(
            produccion_real,
            porcentaje_cumplimiento,
            productos!fk_detalle_produccion_producto(nombre)
          )
        `)
        .order('fecha_registro', { ascending: false })
        .limit(isAdmin ? 10 : 18);

      // Filtrar por operario si no es admin
      if (!isAdmin && user?.id) {
        recentQuery = recentQuery.eq('operario_id', user.id);
      }

      const { data: recentData } = await recentQuery;

      setRecentRecords(recentData as RegistroConDetalles[] || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDashboardData();

    // Auto-actualización robusta con Realtime en 4 tablas
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_produccion' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detalle_produccion' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinas' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, loadDashboardData)
      .subscribe();

    // Polling de respaldo cada 60s
    const pollInterval = setInterval(loadDashboardData, 60000);

    // Refresh al volver al tab
    const handleFocus = () => loadDashboardData();
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadDashboardData]);

  const getPerformanceColor = (percentage: number) => {
    // Normalizar antes de evaluar
    const normalizedPct = toPct100(percentage);
    if (normalizedPct >= 100) return 'bg-success text-success-foreground';
    if (normalizedPct >= 80) return 'bg-primary text-primary-foreground';
    if (normalizedPct >= 60) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getPerformanceIcon = (percentage: number) => {
    // Normalizar antes de evaluar
    const normalizedPct = toPct100(percentage);
    if (normalizedPct >= 100) return <CheckCircle className="h-4 w-4" />;
    if (normalizedPct >= 80) return <TrendingUp className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <div className="animate-pulse bg-muted h-8 w-32 rounded"></div>
        </div>
        <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
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
            Bienvenido, <span className="font-semibold text-foreground">{user?.nombre}</span>
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>
          <button 
            onClick={loadDashboardData}
            className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
        <Card className={`metric-card ${!isAdmin ? 'col-span-full w-full' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cumplimiento Mensual
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

        
        {isAdmin && (
          <Card className={`metric-card ${!isAdmin ? 'col-span-full w-full' : ''}`}>
           <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="font-semibold">Rendimiento mensual</span>
              </CardTitle>
             </CardHeader>
            <CardContent>
            <div className="text-4xl font-bold text-foreground mb-2">
            {metrics.cumplimientoPromedio.toFixed(1)}%
            </div>
            <Progress 
             value={Math.min(metrics.cumplimientoPromedio, 100)} 
             className="w-full mb-2" 
               />
             <Badge className={`mt-1 ${getPerformanceColor(metrics.cumplimientoPromedio)}`}>
             {getPerformanceIcon(metrics.cumplimientoPromedio)}
             <span className="ml-1">
            {metrics.cumplimientoPromedio >= 100 ? 'Excelente' : 
             metrics.cumplimientoPromedio >= 80 ? 'Bueno' :
            metrics.cumplimientoPromedio >= 60 ? 'Regular' : 'Crítico'}
            </span>
            </Badge>
           </CardContent>
          </Card>
        )}

        {isAdmin && (
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
        )}

        {isAdmin && (
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
        )}
      </div>

      {/* Métricas del Operario */}
      {!isAdmin && user && (
        <>
          <OperarioMetricsCard />
        </>
      )}

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
              {recentVisible.map((record) => (
                <div 
                  key={record.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant={record.es_asistente ? "secondary" : "default"}>
                        {record.es_asistente ? 'Asistente' : 'Operario'}
                      </Badge>
                      <div>
                        <p className="font-medium text-foreground">
                          {record.maquinas?.nombre}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.usuarios?.nombre} • {record.turno}
                        </p>
                      </div>
                    </div>
                    
                    {/* Mostrar productos */}
                    <div className="space-y-1">
                      {record.detalle_produccion?.map((detalle, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {detalle.productos?.nombre}: {detalle.produccion_real} unidades
                          </span>
                           <Badge className={getPerformanceColor(detalle.porcentaje_cumplimiento)}>
                             {toPct100(detalle.porcentaje_cumplimiento).toFixed(1)}%
                           </Badge>
                        </div>
                      )) || []}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.fecha).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isAdmin && recentRecords.length > 3 && (
            <div className="flex justify-center mt-4">
             <Button variant="outline" onClick={() => setShowMoreRecent(v => !v)}>
             {showMoreRecent ? 'Mostrar menos' : 'Mostrar más'}
             </Button>
           </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
