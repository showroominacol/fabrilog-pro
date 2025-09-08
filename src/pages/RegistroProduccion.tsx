import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Calculator, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Target,
  TrendingUp,
  Factory,
  Package
} from 'lucide-react';
import { Tables, Enums } from '@/integrations/supabase/types';

type Maquina = Tables<'maquinas'>;
type Producto = Tables<'productos'>;
type MetaProduccion = Tables<'metas_produccion'>;

interface FormData {
  fecha: string;
  turno: Enums<'turno_tipo'> | '';
  maquina_id: string;
  producto_id: string;
  produccion_real: string;
}

export default function RegistroProduccion() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<FormData>({
    fecha: new Date().toISOString().split('T')[0],
    turno: '',
    maquina_id: '',
    producto_id: '',
    produccion_real: '',
  });
  
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [meta, setMeta] = useState<MetaProduccion | null>(null);
  const [porcentajeCumplimiento, setPorcentajeCumplimiento] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const turnos: Enums<'turno_tipo'>[] = ["6:00am - 2:00pm", "2:00pm - 10:00pm", "10:00pm - 6:00am"];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.maquina_id) {
      const filtered = productos.filter(p => p.maquina_id === formData.maquina_id);
      setFilteredProductos(filtered);
      
      // Reset producto selection if current selection doesn't match machine
      if (formData.producto_id && !filtered.find(p => p.id === formData.producto_id)) {
        setFormData(prev => ({ ...prev, producto_id: '' }));
        setMeta(null);
      }
    } else {
      setFilteredProductos([]);
    }
  }, [formData.maquina_id, productos]);

  useEffect(() => {
    loadMeta();
  }, [formData.maquina_id, formData.producto_id]);

  useEffect(() => {
    calculatePerformance();
  }, [formData.produccion_real, meta, formData.turno]);

  const loadInitialData = async () => {
    try {
      setDataLoading(true);
      
      const [maquinasResult, productosResult] = await Promise.all([
        supabase.from('maquinas').select('*').eq('activa', true).order('nombre'),
        supabase.from('productos').select('*').eq('activo', true).order('nombre')
      ]);

      if (maquinasResult.error) throw maquinasResult.error;
      if (productosResult.error) throw productosResult.error;

      setMaquinas(maquinasResult.data || []);
      setProductos(productosResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos iniciales",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  const loadMeta = async () => {
    if (!formData.maquina_id || !formData.producto_id) {
      setMeta(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('metas_produccion')
        .select('*')
        .eq('maquina_id', formData.maquina_id)
        .eq('producto_id', formData.producto_id)
        .maybeSingle();

      if (error) throw error;
      setMeta(data);
    } catch (error) {
      console.error('Error loading meta:', error);
    }
  };

  const calculatePerformance = () => {
    if (!formData.produccion_real || !meta || !formData.turno) {
      setPorcentajeCumplimiento(0);
      return;
    }

    const produccionReal = parseInt(formData.produccion_real);
    let metaTurno = 0;

    // Determinar meta según duración del turno
    if (formData.turno === "6:00am - 2:00pm" || formData.turno === "2:00pm - 10:00pm") {
      metaTurno = meta.turno_8h;
    } else if (formData.turno === "10:00pm - 6:00am") {
      metaTurno = meta.turno_10h;
    }

    if (metaTurno > 0) {
      const porcentaje = (produccionReal / metaTurno) * 100;
      setPorcentajeCumplimiento(porcentaje);
    } else {
      setPorcentajeCumplimiento(0);
    }
  };

  const adjustDateForNightShift = (fecha: string, turno: string): string => {
    if (turno === "10:00pm - 6:00am") {
      // Para turno nocturno, asignar fecha del día siguiente
      const date = new Date(fecha);
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0];
    }
    return fecha;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      toast({
        title: "Error",
        description: "No se encontró información del usuario",
        variant: "destructive",
      });
      return;
    }

    if (!formData.turno || !formData.maquina_id || !formData.producto_id || !formData.produccion_real) {
      toast({
        title: "Campos Requeridos",
        description: "Por favor completa todos los campos del formulario",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const fechaAjustada = adjustDateForNightShift(formData.fecha, formData.turno);
      
      const { error } = await supabase
        .from('registros_produccion')
        .insert({
          fecha: fechaAjustada,
          turno: formData.turno,
          operario_id: profile.id,
          maquina_id: formData.maquina_id,
          producto_id: formData.producto_id,
          produccion_real: parseInt(formData.produccion_real),
          porcentaje_cumplimiento: porcentajeCumplimiento,
        });

      if (error) throw error;

      toast({
        title: "¡Registro Guardado!",
        description: `Producción registrada exitosamente con ${porcentajeCumplimiento.toFixed(1)}% de cumplimiento`,
      });

      // Reset form
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        turno: '',
        maquina_id: '',
        producto_id: '',
        produccion_real: '',
      });
      setMeta(null);
      setPorcentajeCumplimiento(0);

    } catch (error: any) {
      console.error('Error saving record:', error);
      toast({
        title: "Error al Guardar",
        description: error.message || "No se pudo guardar el registro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 100) return 'text-success';
    if (percentage >= 80) return 'text-primary';
    if (percentage >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 100) return <CheckCircle className="h-5 w-5" />;
    if (percentage >= 80) return <TrendingUp className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  if (dataLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Registro de Producción</h1>
          <p className="text-muted-foreground">Registra la producción de tu turno</p>
        </div>
      </div>

      <Card className="shadow-[var(--shadow-elevated)]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-accent" />
            <span>Formulario de Registro</span>
          </CardTitle>
          <CardDescription>
            Completa todos los campos para registrar la producción
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de Producción</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => handleInputChange('fecha', e.target.value)}
                  className="input-touch"
                  required
                />
              </div>

              {/* Turno */}
              <div className="space-y-2">
                <Label htmlFor="turno">Turno</Label>
                <Select 
                  value={formData.turno} 
                  onValueChange={(value) => handleInputChange('turno', value)}
                >
                  <SelectTrigger className="input-touch">
                    <SelectValue placeholder="Selecciona el turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {turnos.map((turno) => (
                      <SelectItem key={turno} value={turno}>
                        {turno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Máquina */}
              <div className="space-y-2">
                <Label htmlFor="maquina" className="flex items-center space-x-2">
                  <Factory className="h-4 w-4" />
                  <span>Máquina</span>
                </Label>
                <Select 
                  value={formData.maquina_id} 
                  onValueChange={(value) => handleInputChange('maquina_id', value)}
                >
                  <SelectTrigger className="input-touch">
                    <SelectValue placeholder="Selecciona la máquina" />
                  </SelectTrigger>
                  <SelectContent>
                    {maquinas.map((maquina) => (
                      <SelectItem key={maquina.id} value={maquina.id}>
                        {maquina.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Producto */}
              <div className="space-y-2">
                <Label htmlFor="producto" className="flex items-center space-x-2">
                  <Package className="h-4 w-4" />
                  <span>Producto</span>
                </Label>
                <Select 
                  value={formData.producto_id} 
                  onValueChange={(value) => handleInputChange('producto_id', value)}
                  disabled={!formData.maquina_id}
                >
                  <SelectTrigger className="input-touch">
                    <SelectValue placeholder={
                      formData.maquina_id ? "Selecciona el producto" : "Primero selecciona una máquina"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProductos.map((producto) => (
                      <SelectItem key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Producción Real */}
            <div className="space-y-2">
              <Label htmlFor="produccion_real">Producción Real (unidades)</Label>
              <Input
                id="produccion_real"
                type="number"
                min="0"
                step="1"
                value={formData.produccion_real}
                onChange={(e) => handleInputChange('produccion_real', e.target.value)}
                placeholder="Ingresa las unidades producidas"
                className="input-touch text-lg"
                inputMode="numeric"
                required
              />
            </div>

            {/* Meta y Cumplimiento */}
            {meta && formData.turno && (
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Target className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Meta del Turno</p>
                        <p className="text-2xl font-bold text-primary">
                          {formData.turno === "10:00pm - 6:00am" 
                            ? meta.turno_10h.toLocaleString()
                            : meta.turno_8h.toLocaleString()
                          } unidades
                        </p>
                      </div>
                    </div>
                    
                    {porcentajeCumplimiento > 0 && (
                      <div className="text-right">
                        <div className={`flex items-center space-x-2 ${getPerformanceColor(porcentajeCumplimiento)}`}>
                          {getPerformanceIcon(porcentajeCumplimiento)}
                          <span className="text-2xl font-bold">
                            {porcentajeCumplimiento.toFixed(1)}%
                          </span>
                        </div>
                        <Badge className={
                          porcentajeCumplimiento >= 100 ? 'bg-success text-success-foreground' :
                          porcentajeCumplimiento >= 80 ? 'bg-primary text-primary-foreground' :
                          porcentajeCumplimiento >= 60 ? 'bg-warning text-warning-foreground' :
                          'bg-destructive text-destructive-foreground'
                        }>
                          {porcentajeCumplimiento >= 100 ? 'Excelente' :
                           porcentajeCumplimiento >= 80 ? 'Bueno' :
                           porcentajeCumplimiento >= 60 ? 'Regular' : 'Por Mejorar'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning for night shift */}
            {formData.turno === "10:00pm - 6:00am" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  El turno nocturno se registrará para el día siguiente automáticamente.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full btn-touch text-lg font-semibold"
              disabled={loading || !formData.turno || !formData.maquina_id || !formData.producto_id || !formData.produccion_real}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Guardando Registro...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Guardar Producción
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}