import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  Calendar,
  Award,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { metricsService, DailyMetrics } from '@/services/MetricsService';
import { useAuth } from '@/components/auth/AuthProvider';

export function OperarioMetricsCard() {
  const { user } = useAuth();
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [user]);

  const loadMetrics = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Solo métricas del día actual
      const today = await metricsService.getOperarioDailyMetrics(user.id);
      setDailyMetrics(today);
    } catch (error) {
      console.error('Error loading operario metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBonusColor = (tipoBono: string) => {
    switch (tipoBono) {
      case 'positivo':
        return 'bg-success text-success-foreground';
      case 'neutro':
        return 'bg-warning text-warning-foreground';
      case 'negativo':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getBonusIcon = (tipoBono: string) => {
    switch (tipoBono) {
      case 'positivo':
        return <Award className="h-4 w-4" />;
      case 'neutro':
        return <Clock className="h-4 w-4" />;
      case 'negativo':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const getBonusText = (tipoBono: string) => {
    switch (tipoBono) {
      case 'positivo':
        return 'Bono Positivo';
      case 'neutro':
        return 'Sin Bono';
      case 'negativo':
        return 'Penalización';
      default:
        return 'Sin Datos';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Métricas del día actual */}
      <Card className="metric-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Mi Rendimiento de Hoy</span>
          </CardTitle>
          <CardDescription>
            Cumplimiento y estado de bonificación del día actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyMetrics ? (
            <div className="space-y-4">
              {/* Indicador principal de cumplimiento */}
              <div className="text-center">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {dailyMetrics.porcentajeCumplimiento.toFixed(1)}%
                </div>
                <Progress 
                  value={Math.min(dailyMetrics.porcentajeCumplimiento, 100)} 
                  className="w-full mb-2" 
                />
                <Badge className={getBonusColor(dailyMetrics.tipoBono)}>
                  {getBonusIcon(dailyMetrics.tipoBono)}
                  <span className="ml-1">{getBonusText(dailyMetrics.tipoBono)}</span>
                </Badge>
              </div>

              {/* Detalles de producción */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-primary">
                    {dailyMetrics.produccionReal}
                  </div>
                  <p className="text-sm text-muted-foreground">Producción Real</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-accent">
                    {dailyMetrics.metaTotal}
                  </div>
                  <p className="text-sm text-muted-foreground">Meta del Día</p>
                </div>
              </div>

              {/* Productos producidos */}
              {dailyMetrics.productos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Productos de Hoy:</h4>
                  {dailyMetrics.productos.map((producto, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm font-medium">{producto.nombre}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          {producto.produccionReal}/{producto.meta}
                        </span>
                        <Badge variant={producto.porcentaje >= 80 ? 'default' : 'secondary'}>
                          {producto.porcentaje.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!dailyMetrics.esOperario && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <div className="flex items-center space-x-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Hoy trabajaste como asistente - No aplica para bonificación
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay registros de producción para hoy</p>
              <p className="text-sm text-muted-foreground mt-2">
                Registra tu primera producción para ver tus métricas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
