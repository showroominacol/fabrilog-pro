import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  TrendingUp, 
  Calendar, 
  User,
  BarChart3,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface CumplimientoData {
  nombre: string;
  cedula: string;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  porcentaje_cumplimiento: number;
  dias_laborales: number;
  dias_con_produccion: number;
}

export default function ConsultaCumplimiento() {
  const { toast } = useToast();
  
  const [cedula, setCedula] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<CumplimientoData | null>(null);
  const [error, setError] = useState<string>('');

  const handleConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cedula.trim()) {
      setError('La cédula es obligatoria');
      return;
    }
    
    setLoading(true);
    setError('');
    setResultado(null);

    try {
      // Convertir el mes seleccionado a fechas de inicio y fin
      const [year, month] = mesSeleccionado.split('-');
      const fechaInicio = `${year}-${month}-01`;
      const fechaFin = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const { data, error: rpcError } = await supabase.rpc('consultar_cumplimiento_operario', {
        cedula_operario: cedula.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });

      if (rpcError) {
        console.error('Error RPC:', rpcError);
        setError('Error al consultar los datos');
        return;
      }

      if (!data || data.length === 0) {
        setError('No se encontró ningún operario con esa cédula');
        return;
      }

      setResultado(data[0] as unknown as CumplimientoData);
      
      toast({
        title: "Consulta exitosa",
        description: `Datos encontrados para ${data[0].nombre}`,
      });

    } catch (error) {
      console.error('Error en consulta:', error);
      setError('Error al realizar la consulta');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeVariant = (porcentaje: number) => {
    if (porcentaje >= 100) return 'default';
    if (porcentaje >= 85) return 'secondary';
    return 'destructive';
  };

  const getBadgeText = (porcentaje: number) => {
    if (porcentaje >= 100) return 'Excelente';
    if (porcentaje >= 85) return 'Bueno';
    return 'Necesita Mejorar';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BarChart3 className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              FabriLog <span className="text-primary">Pro</span>
            </h1>
          </div>
          <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
            Consulta de Cumplimiento
          </h2>
          <p className="text-muted-foreground">
            Consulta tu porcentaje de cumplimiento ingresando tu cédula
          </p>
        </div>

        {/* Formulario de consulta */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Consultar Cumplimiento
            </CardTitle>
            <CardDescription>
              Ingresa tu cédula y selecciona el período para consultar tu desempeño
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConsulta} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cedula">Cédula *</Label>
                  <Input
                    id="cedula"
                    type="text"
                    placeholder="Ej: 12345678"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="mes">Mes de Consulta</Label>
                  <Input
                    id="mes"
                    type="month"
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(e.target.value)}
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full md:w-auto" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Consultar
                  </>
                )}
              </Button>
            </form>

            {error && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        {resultado && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Resultado de Consulta
                </div>
                <Badge variant={getBadgeVariant(Number(resultado.porcentaje_cumplimiento))}>
                  {getBadgeText(Number(resultado.porcentaje_cumplimiento))}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Información del operario */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Operario</Label>
                    <p className="text-xl font-semibold">{resultado.nombre}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Cédula</Label>
                    <p className="text-xl font-semibold">{resultado.cedula}</p>
                  </div>
                </div>

                {/* Período consultado */}
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Período: {new Date(resultado.fecha_inicio_periodo).toLocaleDateString()} - {new Date(resultado.fecha_fin_periodo).toLocaleDateString()}
                  </span>
                </div>

                {/* Porcentaje principal */}
                <div className="text-center space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Porcentaje de Cumplimiento</Label>
                    <div className="text-6xl font-bold text-primary mb-2">
                      {Number(resultado.porcentaje_cumplimiento).toFixed(1)}%
                    </div>
                  </div>
                  
                  <Progress 
                    value={Math.min(Number(resultado.porcentaje_cumplimiento), 100)} 
                    className="h-4 w-full"
                  />
                </div>

                {/* Estadísticas adicionales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {resultado.dias_laborales}
                    </div>
                    <Label className="text-sm text-muted-foreground">Días Laborales</Label>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {resultado.dias_con_produccion}
                    </div>
                    <Label className="text-sm text-muted-foreground">Días con Producción</Label>
                  </div>
                </div>

                {/* Mensaje motivacional */}
                <div className="text-center p-4 border rounded-lg">
                  {Number(resultado.porcentaje_cumplimiento) >= 100 ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">¡Excelente trabajo! Has superado las metas establecidas.</span>
                    </div>
                  ) : Number(resultado.porcentaje_cumplimiento) >= 85 ? (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-medium">¡Buen desempeño! Estás muy cerca de la meta.</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Hay oportunidades de mejora para alcanzar las metas.</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
              <div>
                <a 
                  href="/auth"
                  className="block text-center text-primary hover:text-primary/90 underline"
                >
                  Inicia sesión
                </a>
              </div>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>© 2024 FabriLog Pro - Sistema de Gestión de Producción</p>
        </div>
      </div>
    </div>
  );
}