// import React, { useEffect, useState, useCallback, useRef } from 'react';
// import { Button } from '@/components/ui/button';
// import { useAuth } from '@/components/auth/AuthProvider';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import { supabase } from '@/integrations/supabase/client';
// import { Progress } from '@/components/ui/progress';
// import { TrendingUp, Target, Users, Clock, BarChart3, AlertTriangle, CheckCircle, RefreshCw, CalendarIcon, Trash2 } from 'lucide-react';

// import { OperarioMetricsCard } from '@/components/operario/OperarioMetricsCard';

// import { Calendar } from '@/components/ui/calendar';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// import { format } from 'date-fns';
// import { cn } from '@/lib/utils';



// // Helper para obtener rango del día en horario local
// const getTodayRangeISO = () => {
//   const start = new Date();
//   start.setHours(0, 0, 0, 0);
//   const end = new Date();
//   end.setHours(23, 59, 59, 999);
//   return {
//     startISO: start.toISOString(),
//     endISO: end.toISOString()
//   };
// };

// // Normalizar porcentajes (0-1 → 0-100)
// const toPct100 = (v: number) => v > 0 && v <= 1 ? v * 100 : v;
// interface DashboardMetrics {
//   totalRegistros: number;
//   cumplimientoPromedio: number;
//   maquinasActivas: number;
//   operariosActivos: number;
//   registrosHoy: number;
//   produccionHoy: number;
// }
// interface DateRange {
//   from: Date | undefined;
//   to: Date | undefined;
// }
// interface RegistroConDetalles {
//   id: string;
//   fecha?: string;
//   turno?: string;
//   es_asistente?: boolean;
//   fecha_registro: string;
//   maquinas: {
//     nombre: string;
//   } | null;
//   usuarios: {
//     nombre: string;
//   } | null;
//   detalle_produccion: {
//     produccion_real: number;
//     porcentaje_cumplimiento: number;
//     productos: {
//       nombre: string;
//     } | null;
//   }[];
// }
// // Cuenta días laborales (Lun–Sáb) entre 2 fechas (incluye ambos extremos). Excluye domingos.
// const countWorkingDaysMonSat = (from?: Date, to?: Date) => {
//   if (!from || !to) return 0;
//   const start = new Date(from); start.setHours(0,0,0,0);
//   const end = new Date(to);     end.setHours(23,59,59,999);
//   let days = 0; 
//   for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
//     const w = d.getDay(); // 0 dom, 1 lun, ... 6 sab
//     if (w !== 0) days++;   // cuenta lun–sab
//   }
//   return days;
// };

// // Obtiene clave YYYY-MM-DD desde un ISO
// const toDayKey = (iso: string) => (iso ?? '').slice(0, 10);


// export default function Dashboard() {
//   const {
//     user,
//     isAdmin
//   } = useAuth();
//   const [metrics, setMetrics] = useState<DashboardMetrics>({
//     totalRegistros: 0,
//     cumplimientoPromedio: 0,
//     maquinasActivas: 0,
//     operariosActivos: 0,
//     registrosHoy: 0,
//     produccionHoy: 0
//   });
//   const [recentRecords, setRecentRecords] = useState<RegistroConDetalles[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [showMoreRecent, setShowMoreRecent] = useState(false); // si ya lo tienes, no lo dupliques
// const [deletingId, setDeletingId] = useState<string | null>(null);
 

//   // Declarar el rango de fechas para el cumplimiento promedio
//   const [dateRange, setDateRange] = useState<DateRange>({
//     from: undefined,
//     to: undefined
//   });
  
//   // Guard para evitar llamadas concurrentes
//   const loadingRef = useRef(false);
  

//   // Registros visibles: 3 por defecto; 18 al expandir
// const recentVisible = showMoreRecent
//   ? recentRecords.slice(0, 18)
//   : recentRecords.slice(0, 3);


//   const loadDashboardData = useCallback(async () => {
//     // Evitar llamadas duplicadas
//     if (loadingRef.current) return;
//     try {
//       loadingRef.current = true;
//       setLoading(true);
//       const {
//         startISO,
//         endISO
//       } = getTodayRangeISO();

//       // Construir consultas según el rol del usuario
//       let registrosQuery = supabase.from('registros_produccion').select('*', {
//         count: 'exact',
//         head: true
//       });
//       let registrosHoyQuery = supabase.from('registros_produccion').select(`
//           id,
//           fecha_registro,
//           detalle_produccion!fk_detalle_produccion_registro(
//             produccion_real,
//             porcentaje_cumplimiento
//           )
//         `).gte('fecha_registro', startISO).lte('fecha_registro', endISO);

//       // Consulta para rango de fechas personalizado (cumplimiento promedio)
//       let registrosRangeQuery = supabase.from('registros_produccion').select(`
//           id,
//           fecha_registro,
//           detalle_produccion!fk_detalle_produccion_registro(
//             produccion_real,
//             porcentaje_cumplimiento
//           )
//         `);
//       if (dateRange.from && dateRange.to) {
//         const rangeStart = new Date(dateRange.from);
//         rangeStart.setHours(0, 0, 0, 0);
//         const rangeEnd = new Date(dateRange.to);
//         rangeEnd.setHours(23, 59, 59, 999);
//         registrosRangeQuery = registrosRangeQuery.gte('fecha_registro', rangeStart.toISOString()).lte('fecha_registro', rangeEnd.toISOString());
//       }

//       // Filtrar por operario si no es admin
//       if (!isAdmin && user?.id) {
//         registrosQuery = registrosQuery.eq('operario_id', user.id);
//         registrosHoyQuery = registrosHoyQuery.eq('operario_id', user.id);
//         registrosRangeQuery = registrosRangeQuery.eq('operario_id', user.id);
//       }

//       // Consultas optimizadas usando aliases específicos de FK
//       const [{
//         count: totalRegistros
//       }, {
//         count: maquinasActivas
//       }, {
//         count: operariosActivos
//       }, {
//         data: registrosHoyData
//       }, {
//         data: registrosRangeData
//       }] = await Promise.all([registrosQuery, supabase.from('maquinas').select('*', {
//         count: 'exact',
//         head: true
//       }).eq('activa', true), supabase.from('usuarios').select('*', {
//         count: 'exact',
//         head: true
//       }).eq('activo', true), registrosHoyQuery, registrosRangeQuery]);

//       // Calcular métricas de producción del día con suma de porcentajes
//       let produccionTotal = 0;
//       let cumplimientoHoy = 0;
//       registrosHoyData?.forEach(registro => {
//         registro.detalle_produccion?.forEach(detalle => {
//           produccionTotal += detalle.produccion_real || 0;
//           // Normalizar porcentaje antes de sumar
//           const pctNormalizado = toPct100(detalle.porcentaje_cumplimiento || 0);
//           cumplimientoHoy += pctNormalizado;
//         });
//       });

//       // Calcular cumplimiento promedio para el rango de fechas personalizado
//       // 1) Promedio por día (no por detalle)
// const byDay: Record<string, { sumPct: number; count: number }> = {};
// registrosRangeData?.forEach(registro => {
//   const dayKey = toDayKey(registro.fecha_registro as string);
//   registro.detalle_produccion?.forEach(detalle => {
//     const pct = toPct100(detalle.porcentaje_cumplimiento || 0);
//     if (!byDay[dayKey]) byDay[dayKey] = { sumPct: 0, count: 0 };
//     byDay[dayKey].sumPct += pct;
//     byDay[dayKey].count += 1;
//   });
// });

// // 2) Suma de promedios diarios
// let sumDailyAverages = 0;
// Object.values(byDay).forEach(d => {
//   sumDailyAverages += d.count > 0 ? (d.sumPct / d.count) : 0;
// });

// // 3) Si hay rango definido: normalizar por días laborales esperados (Lun–Sáb). Si no, dejar promedio por detalle (comportamiento anterior).
// let cumplimientoPromedioCalc = 0;
// if (dateRange.from || dateRange.to) {
//   const expectedDays = countWorkingDaysMonSat(dateRange.from, dateRange.to);
//   cumplimientoPromedioCalc = expectedDays > 0 ? (sumDailyAverages / expectedDays) : 0;
// } else {
//   const totalPct = Object.values(byDay).reduce((acc, d) => acc + d.sumPct, 0);
//   const totalCount = Object.values(byDay).reduce((acc, d) => acc + d.count, 0);
//   cumplimientoPromedioCalc = totalCount > 0 ? (totalPct / totalCount) : 0;
// }

// setMetrics({
//   totalRegistros: totalRegistros || 0,
//   cumplimientoPromedio: cumplimientoPromedioCalc,
//   maquinasActivas: maquinasActivas || 0,
//   operariosActivos: operariosActivos || 0,
//   registrosHoy: registrosHoyData?.length || 0,
//   produccionHoy: produccionTotal
// });


//       // Obtener registros recientes con aliases específicos
//       let recentQuery = supabase.from('registros_produccion').select(`
//           *,
//           maquinas!fk_registros_produccion_maquina(nombre),
//           usuarios!fk_registros_produccion_operario(nombre),
//           detalle_produccion!fk_detalle_produccion_registro(
//             produccion_real,
//             porcentaje_cumplimiento,
//             productos!fk_detalle_produccion_producto(nombre)
//           )
//         `)
//         .order('fecha_registro', { ascending: false })
//         .limit(18);

//       // Filtrar por operario si no es admin
//       if (!isAdmin && user?.id) {
//         recentQuery = recentQuery.eq('operario_id', user.id);
//       }
//       const {
//         data: recentData
//       } = await recentQuery;
//       setRecentRecords(recentData as RegistroConDetalles[] || []);
//     } catch (error) {
//       console.error('Error loading dashboard data:', error);
//     } finally {
//       setLoading(false);
//       loadingRef.current = false;
//     }
//   }, [dateRange.from, dateRange.to, isAdmin, user.id]);
//   const handleDeleteRecord = useCallback(async (registroId: string) => {
//   if (!registroId) return;
//   const ok = window.confirm('¿Eliminar este registro y sus detalles?');
//   if (!ok) return;

//   try {
//     setDeletingId(registroId);

//     // 1) Borrar detalles (si tu FK ya tiene ON DELETE CASCADE, este paso puede omitirse)
//     await supabase.from('detalle_produccion').delete().eq('registro_id', registroId);
//     // Si tu columna se llama distinto (p.ej. registro_produccion_id), usa esa:
//     // await supabase.from('detalle_produccion').delete().eq('registro_produccion_id', registroId);

//     // 2) Borrar registro principal
//     await supabase.from('registros_produccion').delete().eq('id', registroId);

//     // 3) Refrescar UI rápido
//     setRecentRecords(prev => prev.filter(r => r.id !== registroId));
//     await loadDashboardData();
//   } catch (err) {
//     console.error('Error eliminando registro:', err);
//     alert('No se pudo eliminar el registro. Revisa permisos RLS en Supabase.');
//   } finally {
//     setDeletingId(null);
//   }
// }, [loadDashboardData]);

//   useEffect(() => {
//     loadDashboardData();

//     // Auto-actualización robusta con Realtime en 4 tablas
//     const channel = supabase.channel('dashboard-updates').on('postgres_changes', {
//       event: '*',
//       schema: 'public',
//       table: 'registros_produccion'
//     }, loadDashboardData).on('postgres_changes', {
//       event: '*',
//       schema: 'public',
//       table: 'detalle_produccion'
//     }, loadDashboardData).on('postgres_changes', {
//       event: '*',
//       schema: 'public',
//       table: 'maquinas'
//     }, loadDashboardData).on('postgres_changes', {
//       event: '*',
//       schema: 'public',
//       table: 'usuarios'
//     }, loadDashboardData).subscribe();

//     // Polling de respaldo cada 60s
//     const pollInterval = setInterval(loadDashboardData, 60000);

//     // Refresh al volver al tab
//     const handleFocus = () => loadDashboardData();
//     window.addEventListener('focus', handleFocus);
//     return () => {
//       supabase.removeChannel(channel);
//       clearInterval(pollInterval);
//       window.removeEventListener('focus', handleFocus);
//     };
//   }, [loadDashboardData]);
//   const getPerformanceColor = (percentage: number) => {
//     // Normalizar antes de evaluar
//     const normalizedPct = toPct100(percentage);
//     if (normalizedPct >= 100) return 'bg-success text-success-foreground';
//     if (normalizedPct >= 80) return 'bg-primary text-primary-foreground';
//     if (normalizedPct >= 60) return 'bg-warning text-warning-foreground';
//     return 'bg-destructive text-destructive-foreground';
//   };
//   const getPerformanceIcon = (percentage: number) => {
//     // Normalizar antes de evaluar
//     const normalizedPct = toPct100(percentage);
//     if (normalizedPct >= 100) return <CheckCircle className="h-4 w-4" />;
//     if (normalizedPct >= 80) return <TrendingUp className="h-4 w-4" />;
//     return <AlertTriangle className="h-4 w-4" />;
//   };
//   // Color dinámico para la barra de progreso (sincronizado con el Badge)
// const getProgressBarClass = (percentage: number) => {
//   const p = toPct100(percentage);
//   if (p >= 100) return '[&>div]:bg-success';       // verde (Excelente)
//   if (p >= 80)  return '[&>div]:bg-primary';       // primario (Bueno)
//   if (p >= 60)  return '[&>div]:bg-warning';       // amarillo (Regular)
//   return '[&>div]:bg-destructive';                 // rojo (Crítico)
// };

//   if (loading) {
//     return <div className="space-y-6 animate-fade-in">
//         <div className="flex items-center justify-between">
//           <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
//           <div className="animate-pulse bg-muted h-8 w-32 rounded"></div>
//         </div>
//         <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-4' : 'grid-cols-1'}`}>
//           {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse">
//               <CardHeader className="pb-2">
//                 <div className="h-4 bg-muted rounded w-3/4"></div>
//                 <div className="h-8 bg-muted rounded w-1/2"></div>
//               </CardHeader>
//             </Card>)}
//         </div>
//       </div>;
//   }
//   return <div className="space-y-6 animate-fade-in">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
//           <p className="text-muted-foreground">
//             Bienvenido, <span className="font-semibold text-foreground">{user?.nombre}</span>
//           </p>
//         </div>
//         <div className="flex items-center space-x-4">
//           <div className="flex items-center space-x-2 text-sm text-muted-foreground">
//             <Clock className="h-4 w-4" />
//             <span>{new Date().toLocaleDateString('es-ES', {
//               weekday: 'long',
//               year: 'numeric',
//               month: 'long',
//               day: 'numeric'
//             })}</span>
//           </div>
//           <button onClick={loadDashboardData} className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground transition-colors" disabled={loading}>
//             <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
//             <span>Actualizar</span>
//           </button>
//         </div>
//       </div>

//       {/* Metrics Cards */}
//       <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
//         <Card className={`metric-card ${isAdmin ? 'md:col-span-3' : 'col-span-full w-full'}`}>
//           <CardHeader className="pb-2">
//   {/* Título con icono azul a la izquierda (igual a Mi rendimiento hoy) */}
//   <CardTitle className="flex items-center gap-2 text-foreground font-semibold text-xl">
//     <Target className="h-5 w-5 text-primary" />
//     <span>Cumplimiento promedio</span>
//   </CardTitle>

//   {/* Botones de fechas debajo del título */}
//   <div className="mt-2 flex items-center gap-2">
//     <Popover>
//       <PopoverTrigger asChild>
//         <Button
//           variant="outline"
//           size="sm"
//           className={cn(
//             "justify-start text-left font-normal text-xs min-w-[200px]",
//             !dateRange.from && "text-muted-foreground"
//           )}
//         >
//           <CalendarIcon className="h-3 w-3 mr-2" />
//           {dateRange.from ? (
//             dateRange.to ? (
//               <span className="flex items-center gap-2">
//                 <span className="text-muted-foreground">Desde:</span>
//                 <span className="font-medium">{format(dateRange.from, "dd/MM/yyyy")}</span>
//                 <span className="text-muted-foreground">Hasta:</span>
//                 <span className="font-medium">{format(dateRange.to, "dd/MM/yyyy")}</span>
//               </span>
//             ) : (
//               <span className="flex items-center gap-2">
//                 <span className="text-muted-foreground">Desde:</span>
//                 <span className="font-medium">{format(dateRange.from, "dd/MM/yyyy")}</span>
//                 <span className="text-muted-foreground">- Seleccionar fin</span>
//               </span>
//             )
//           ) : (
//             <span>Seleccionar rango de fechas</span>
//           )}
//         </Button>
//       </PopoverTrigger>

//       <PopoverContent
//         align="start"
//         className="w-auto p-0 z-50 bg-background border border-border shadow-xl backdrop-blur-0"
//       >
//         <div className="p-4 bg-background rounded-md">
//           <div className="text-sm font-medium text-foreground mb-3">
//             Seleccionar período para el cumplimiento promedio
//           </div>
//           <Calendar
//             initialFocus
//             mode="range"
//             defaultMonth={dateRange.from}
//             selected={dateRange}
//             onSelect={(range) =>
//               setDateRange({
//                 from: range?.from,
//                 to: range?.to,
//               })
//             }
//             numberOfMonths={1}
//             className="pointer-events-auto bg-background"
//           />
//           {dateRange.from && dateRange.to && (
//             <div className="mt-3 p-2 bg-muted/50 rounded-md text-sm">
//               <div className="text-muted-foreground mb-1">Rango seleccionado:</div>
//               <div className="font-medium">
//                 {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
//               </div>
//             </div>
//           )}
//         </div>
//       </PopoverContent>
//     </Popover>
//   </div>
// </CardHeader>

//           <CardContent>
//             <div className="text-2xl font-bold text-foreground">
//               {metrics.cumplimientoPromedio.toFixed(1)}%
//             </div>

//             <div className="mt-2 flex items-center">
//         <Progress
//         value={Math.max(0, Math.min(metrics.cumplimientoPromedio, 100))}
//         className={cn('w-full mb-3', getProgressBarClass(metrics.cumplimientoPromedio))}
//         />
//       </div>




//             <Badge className={`mt-2 ${getPerformanceColor(metrics.cumplimientoPromedio)}`}>
//               {getPerformanceIcon(metrics.cumplimientoPromedio)}
//               <span className="ml-1">
//                 {metrics.cumplimientoPromedio >= 100 ? 'Excelente' : metrics.cumplimientoPromedio >= 80 ? 'Bueno' : metrics.cumplimientoPromedio >= 60 ? 'Regular' : 'Crítico'}
//               </span>
//             </Badge>
//           </CardContent>
//         </Card>

        
        
        

//         {isAdmin && <Card className="metric-card md:col-span-1">

//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium text-muted-foreground">
//                 Operarios Activos
//               </CardTitle>
//               <Users className="h-4 w-4 text-primary" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-foreground">
//                 {metrics.operariosActivos}
//               </div>
//               <p className="text-xs text-muted-foreground mt-2">
//                 Usuarios registrados
//               </p>
//             </CardContent>
//           </Card>}
//       </div>

//       {/* Métricas del Operario */}
//       {!isAdmin && user && <>
//           <OperarioMetricsCard />
//         </>}

//       {/* Recent Records */}
//       <Card className="metric-card">
//         <CardHeader>
//           <CardTitle className="flex items-center space-x-2">
//             <BarChart3 className="h-5 w-5 text-primary" />
//             <span>Registros Recientes</span>
//           </CardTitle>
//           <CardDescription>
//             Últimos registros de producción {isAdmin ? 'del sistema' : 'de tus turnos'}
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           {recentRecords.length === 0 ? (
//             <div className="text-center py-8">
//               <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
//               <p className="text-muted-foreground">No hay registros recientes</p>
//             </div>
//           ) : (
//             <div className="space-y-4">
//               {recentVisible.map((record) => (
//                 <div 
//                   key={record.id}
//                   className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
//                 >
//                   <div className="flex-1">
//                     <div className="flex items-center space-x-3 mb-2">
//                       <Badge variant={record.es_asistente ? "secondary" : "default"}>
//                         {record.es_asistente ? 'Asistente' : 'Operario'}
//                       </Badge>
//                       <div>
//                         <p className="font-medium text-foreground">
//                           {record.maquinas?.nombre}
//                         </p>
//                         <p className="text-sm text-muted-foreground">
//                           {record.usuarios?.nombre} • {record.turno}
//                         </p>
//                       </div>
//                     </div>
                    
//                     {/* Mostrar productos */}
//                     <div className="space-y-1">
//                       {record.detalle_produccion?.map((detalle, idx) => (
//                         <div key={idx} className="flex items-center justify-between text-sm">
//                           <span className="text-muted-foreground">
//                             {detalle.productos?.nombre}: {detalle.produccion_real} unidades
//                           </span>
//                           <Badge className={getPerformanceColor(detalle.porcentaje_cumplimiento)}>
//                             {toPct100(detalle.porcentaje_cumplimiento).toFixed(1)}%
//                           </Badge>
//                         </div>
//                       )) || []}
//                     </div>
//                   </div>
                  
//                     <div className="flex items-center gap-2 ml-4 self-start">
//                     <p className="text-sm text-muted-foreground">
//                       {new Date(record.fecha_registro).toLocaleDateString('es-ES')}
//                     </p>
//                     <Button
//                       variant="ghost"
//                       size="icon"
//                       className="text-destructive hover:text-destructive"
//                       title="Eliminar registro"
//                       onClick={() => handleDeleteRecord(record.id)}
//                       disabled={deletingId === record.id}
//                     >
//                       <Trash2 className="h-4 w-4" />
//                     </Button>
//                     </div>

//                 </div>
//               ))}
//             </div>
            
//           )}
//           {recentRecords.length > 3 && (
//             <div className="flex justify-center mt-4">
//             <Button variant="outline" onClick={() => setShowMoreRecent(v => !v)}>
//               {showMoreRecent ? 'Mostrar menos' : 'Mostrar más'}
//             </Button>
//             </div>
//           )}

//         </CardContent>
//       </Card>
//     </div>;
// }

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Users, Clock, BarChart3, AlertTriangle, CheckCircle, RefreshCw, CalendarIcon, Trash2 } from 'lucide-react';

import { OperarioMetricsCard } from '@/components/operario/OperarioMetricsCard';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Helper para obtener rango del día en horario local
const getTodayRangeISO = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString()
  };
};

// Helper: rango del mes actual (fechas y sus ISO)
const getCurrentMonthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to, fromISO: from.toISOString(), toISO: to.toISOString() };
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

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface RegistroConDetalles {
  id: string;
  fecha?: string;
  turno?: string;
  es_asistente?: boolean;
  fecha_registro: string;
  maquinas: {
    nombre: string;
  } | null;
  usuarios: {
    nombre: string;
  } | null;
  detalle_produccion: {
    produccion_real: number;
    porcentaje_cumplimiento: number;
    productos: {
      nombre: string;
    } | null;
  }[];
}

// Cuenta días laborales (Lun–Sáb) entre 2 fechas (incluye ambos extremos). Excluye domingos.
const countWorkingDaysMonSat = (from?: Date, to?: Date) => {
  if (!from || !to) return 0;
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const end = new Date(to);     end.setHours(23, 59, 59, 999);
  let days = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const w = d.getDay(); // 0 dom, 1 lun, ... 6 sab
    if (w !== 0) days++;  // cuenta lun–sab
  }
  return days;
};

// Obtiene clave YYYY-MM-DD desde un ISO
const toDayKey = (iso: string) => (iso ?? '').slice(0, 10);

export default function Dashboard() {
  const { user, isAdmin } = useAuth();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRegistros: 0,
    cumplimientoPromedio: 0,
    maquinasActivas: 0,
    operariosActivos: 0,
    registrosHoy: 0,
    produccionHoy: 0
  });

  const [recentRecords, setRecentRecords] = useState<RegistroConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMoreRecent, setShowMoreRecent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Rango elegido por el usuario (puede estar vacío)
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  // Guard para evitar llamadas concurrentes
  const loadingRef = useRef(false);

  // Mes actual memorizado para mostrarlo en el botón cuando no hay selección
  const currentMonth = useMemo(() => getCurrentMonthRange(), []);

  // Registros visibles: 3 por defecto; 18 al expandir
  const recentVisible = showMoreRecent ? recentRecords.slice(0, 18) : recentRecords.slice(0, 3);

  const loadDashboardData = useCallback(async () => {
    if (loadingRef.current) return;
    try {
      loadingRef.current = true;
      setLoading(true);

      // Rango efectivo: si no hay selección del usuario, usar mes actual
      const month = getCurrentMonthRange();
      const effectiveFrom = dateRange.from ?? month.from;
      const effectiveTo = dateRange.to ?? month.to;

      const { startISO, endISO } = getTodayRangeISO();

      // Construir consultas según el rol del usuario
      let registrosQuery = supabase.from('registros_produccion').select('*', {
        count: 'exact',
        head: true
      });

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

      // Consulta para rango de fechas efectivo (siempre aplica)
      let registrosRangeQuery = supabase
        .from('registros_produccion')
        .select(`
          id,
          fecha_registro,
          detalle_produccion!fk_detalle_produccion_registro(
            produccion_real,
            porcentaje_cumplimiento
          )
        `)
        .gte('fecha_registro', effectiveFrom.toISOString())
        .lte('fecha_registro', effectiveTo.toISOString());

      // Filtrar por operario si no es admin
      if (!isAdmin && user?.id) {
        registrosQuery = registrosQuery.eq('operario_id', user.id);
        registrosHoyQuery = registrosHoyQuery.eq('operario_id', user.id);
        registrosRangeQuery = registrosRangeQuery.eq('operario_id', user.id);
      }

      // Consultas paralelas
      const [
        { count: totalRegistros },
        { count: maquinasActivas },
        { count: operariosActivos },
        { data: registrosHoyData },
        { data: registrosRangeData }
      ] = await Promise.all([
        registrosQuery,
        supabase.from('maquinas').select('*', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true),
        registrosHoyQuery,
        registrosRangeQuery
      ]);

      // Métricas del día
      let produccionTotal = 0;
      registrosHoyData?.forEach((registro) => {
        registro.detalle_produccion?.forEach((detalle) => {
          produccionTotal += detalle.produccion_real || 0;
        });
      });

      // Calcular cumplimiento promedio para el rango efectivo
      // 1) Promedio por día (no por detalle)
      const byDay: Record<string, { sumPct: number; count: number }> = {};
      registrosRangeData?.forEach((registro) => {
        const dayKey = toDayKey(registro.fecha_registro as string);
        registro.detalle_produccion?.forEach((detalle) => {
          const pct = toPct100(detalle.porcentaje_cumplimiento || 0);
          if (!byDay[dayKey]) byDay[dayKey] = { sumPct: 0, count: 0 };
          byDay[dayKey].sumPct += pct;
          byDay[dayKey].count += 1;
        });
      });

      // 2) Suma de promedios diarios
      let sumDailyAverages = 0;
      Object.values(byDay).forEach((d) => {
        sumDailyAverages += d.count > 0 ? d.sumPct / d.count : 0;
      });

      // 3) Normalización SIEMPRE por días laborales del rango efectivo
      const expectedDays = countWorkingDaysMonSat(effectiveFrom, effectiveTo);
      const cumplimientoPromedioCalc =
        expectedDays > 0 ? sumDailyAverages / expectedDays : 0;

      setMetrics({
        totalRegistros: totalRegistros || 0,
        cumplimientoPromedio: cumplimientoPromedioCalc,
        maquinasActivas: maquinasActivas || 0,
        operariosActivos: operariosActivos || 0,
        registrosHoy: registrosHoyData?.length || 0,
        produccionHoy: produccionTotal
      });

      // Registros recientes
      let recentQuery = supabase
        .from('registros_produccion')
        .select(
          `
          *,
          maquinas!fk_registros_produccion_maquina(nombre),
          usuarios!fk_registros_produccion_operario(nombre),
          detalle_produccion!fk_detalle_produccion_registro(
            produccion_real,
            porcentaje_cumplimiento,
            productos!fk_detalle_produccion_producto(nombre)
          )
        `
        )
        .order('fecha_registro', { ascending: false })
        .limit(18);

      if (!isAdmin && user?.id) {
        recentQuery = recentQuery.eq('operario_id', user.id);
      }

      const { data: recentData } = await recentQuery;
      setRecentRecords((recentData as RegistroConDetalles[]) || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [dateRange.from, dateRange.to, isAdmin, user?.id]);

  const handleDeleteRecord = useCallback(
    async (registroId: string) => {
      if (!registroId) return;
      const ok = window.confirm('¿Eliminar este registro y sus detalles?');
      if (!ok) return;

      try {
        setDeletingId(registroId);

        // 1) Borrar detalles (si tu FK ya tiene ON DELETE CASCADE, este paso puede omitirse)
        await supabase.from('detalle_produccion').delete().eq('registro_id', registroId);
        // Si tu columna se llama distinto (p.ej. registro_produccion_id), usa esa:
        // await supabase.from('detalle_produccion').delete().eq('registro_produccion_id', registroId);

        // 2) Borrar registro principal
        await supabase.from('registros_produccion').delete().eq('id', registroId);

        // 3) Refrescar UI rápido
        setRecentRecords((prev) => prev.filter((r) => r.id !== registroId));
        await loadDashboardData();
      } catch (err) {
        console.error('Error eliminando registro:', err);
        alert('No se pudo eliminar el registro. Revisa permisos RLS en Supabase.');
      } finally {
        setDeletingId(null);
      }
    },
    [loadDashboardData]
  );

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
    const p = toPct100(percentage);
    if (p >= 100) return 'bg-success text-success-foreground';
    if (p >= 80) return 'bg-primary text-primary-foreground';
    if (p >= 60) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getPerformanceIcon = (percentage: number) => {
    const p = toPct100(percentage);
    if (p >= 100) return <CheckCircle className="h-4 w-4" />;
    if (p >= 80) return <TrendingUp className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  // Color dinámico para la barra de progreso (sincronizado con el Badge)
  const getProgressBarClass = (percentage: number) => {
    const p = toPct100(percentage);
    if (p >= 100) return '[&>div]:bg-success';       // verde (Excelente)
    if (p >= 80)  return '[&>div]:bg-primary';       // primario (Bueno)
    if (p >= 60)  return '[&>div]:bg-warning';       // amarillo (Regular)
    return '[&>div]:bg-destructive';                 // rojo (Crítico)
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <div className="animate-pulse bg-muted h-8 w-32 rounded"></div>
        </div>
        <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-4' : 'grid-cols-1'}`}>
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
            <span>
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
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
        <Card className={`metric-card ${isAdmin ? 'md:col-span-3' : 'col-span-full w-full'}`}>
          <CardHeader className="pb-2">
            {/* Título con icono (estilo "Mi rendimiento hoy") */}
            <CardTitle className="flex items-center gap-2 text-foreground font-semibold text-xl">
              <Target className="h-5 w-5 text-primary" />
              <span>Cumplimiento promedio</span>
            </CardTitle>

            {/* Botones de fechas debajo del título */}
            <div className="mt-2 flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'justify-start text-left font-normal text-xs min-w-[250px]',
                      !dateRange.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 mr-2" />
                    {dateRange.from && dateRange.to ? (
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">Desde:</span>
                        <span className="font-medium">{format(dateRange.from, 'dd/MM/yyyy')}</span>
                        <span className="text-muted-foreground">Hasta:</span>
                        <span className="font-medium">{format(dateRange.to, 'dd/MM/yyyy')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">Mes actual:</span>
                        <span className="font-medium">
                          {format(currentMonth.from, 'dd/MM/yyyy')} - {format(currentMonth.to, 'dd/MM/yyyy')}
                        </span>
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  className="w-auto p-0 z-50 bg-background border border-border shadow-xl backdrop-blur-0"
                >
                  <div className="p-4 bg-background rounded-md">
                    <div className="text-sm font-medium text-foreground mb-3">
                      Seleccionar período para el cumplimiento promedio
                    </div>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from ?? currentMonth.from}
                      selected={dateRange}
                      onSelect={(range) =>
                        setDateRange({
                          from: range?.from,
                          to: range?.to
                        })
                      }
                      numberOfMonths={1}
                      className="pointer-events-auto bg-background"
                    />
                    {dateRange.from && dateRange.to ? (
                      <div className="mt-3 p-2 bg-muted/50 rounded-md text-sm">
                        <div className="text-muted-foreground mb-1">Rango seleccionado:</div>
                        <div className="font-medium">
                          {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 p-2 bg-muted/50 rounded-md text-sm">
                        <div className="text-muted-foreground mb-1">Usando por defecto:</div>
                        <div className="font-medium">
                          {format(currentMonth.from, 'dd/MM/yyyy')} - {format(currentMonth.to, 'dd/MM/yyyy')}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.cumplimientoPromedio.toFixed(1)}%
            </div>

            <div className="mt-2 flex items-center">
              <Progress
                value={Math.max(0, Math.min(metrics.cumplimientoPromedio, 100))}
                className={cn('w-full mb-3', getProgressBarClass(metrics.cumplimientoPromedio))}
              />
            </div>

            <Badge className={`mt-2 ${getPerformanceColor(metrics.cumplimientoPromedio)}`}>
              {getPerformanceIcon(metrics.cumplimientoPromedio)}
              <span className="ml-1">
                {metrics.cumplimientoPromedio >= 100
                  ? 'Excelente'
                  : metrics.cumplimientoPromedio >= 80
                  ? 'Bueno'
                  : metrics.cumplimientoPromedio >= 60
                  ? 'Regular'
                  : 'Crítico'}
              </span>
            </Badge>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="metric-card md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Operarios Activos</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.operariosActivos}</div>
              <p className="text-xs text-muted-foreground mt-2">Usuarios registrados</p>
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
                      <Badge variant={record.es_asistente ? 'secondary' : 'default'}>
                        {record.es_asistente ? 'Asistente' : 'Operario'}
                      </Badge>
                      <div>
                        <p className="font-medium text-foreground">{record.maquinas?.nombre}</p>
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

                  <div className="flex items-center gap-2 ml-4 self-start">
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.fecha_registro).toLocaleDateString('es-ES')}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Eliminar registro"
                      onClick={() => handleDeleteRecord(record.id)}
                      disabled={deletingId === record.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {recentRecords.length > 3 && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setShowMoreRecent((v) => !v)}>
                {showMoreRecent ? 'Mostrar menos' : 'Mostrar más'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
