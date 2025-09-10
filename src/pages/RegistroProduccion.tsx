import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Package,
  Users,
  Plus,
  Minus,
  X
} from 'lucide-react';
import { Tables, Enums } from '@/integrations/supabase/types';

type Maquina = Tables<'maquinas'>;
type Producto = Tables<'productos'>;
type MetaProduccion = Tables<'metas_produccion'>;
type Usuario = Tables<'usuarios'>;
type DisenoArbol = Tables<'disenos_arboles'>;
type NivelRama = Tables<'niveles_ramas'>;

interface NivelDetalle {
  nivel: number;
  cantidad_ramas: number;
  festones_por_rama: number;
}

interface ProductoDetalle {
  producto_id: string;
  produccion_real: number;
  niveles?: NivelDetalle[];
}

interface FormData {
  fecha: string;
  turno: Enums<'turno_produccion'> | '';
  maquina_id: string;
  productos: ProductoDetalle[];
  asistentes: string[];
}

export default function RegistroProduccion() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<FormData>({
    fecha: new Date().toISOString().split('T')[0],
    turno: '',
    maquina_id: '',
    productos: [],
    asistentes: [],
  });
  
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metas, setMetas] = useState<MetaProduccion[]>([]);
  const [disenosArboles, setDisenosArboles] = useState<DisenoArbol[]>([]);
  const [nivelesRamas, setNivelesRamas] = useState<NivelRama[]>([]);
  const [porcentajeCumplimiento, setPorcentajeCumplimiento] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const turnos: Enums<'turno_produccion'>[] = [
    "6:00am - 2:00pm", 
    "2:00pm - 10:00pm", 
    "10:00pm - 6:00am",
    "7:00am - 5:00pm",
    "7:00am - 3:00pm",
    "7:00am - 3:30pm"
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.maquina_id) {
      const filtered = productos.filter(p => p.maquina_id === formData.maquina_id);
      setFilteredProductos(filtered);
      
      // Reset productos selection if current selections don't match machine
      const validProductos = formData.productos.filter(p => 
        filtered.find(fp => fp.id === p.producto_id)
      );
      if (validProductos.length !== formData.productos.length) {
        setFormData(prev => ({ ...prev, productos: validProductos }));
      }
    } else {
      setFilteredProductos([]);
      setFormData(prev => ({ ...prev, productos: [] }));
    }
  }, [formData.maquina_id, productos]);

  useEffect(() => {
    loadMetas();
  }, [formData.maquina_id]);

  useEffect(() => {
    calculatePerformance();
  }, [formData.productos, metas, formData.turno]);

  const loadInitialData = async () => {
    try {
      setDataLoading(true);
      
      const [maquinasResult, productosResult, usuariosResult, disenosResult, nivelesResult] = await Promise.all([
        supabase.from('maquinas').select('*').eq('activa', true).order('nombre'),
        supabase.from('productos').select('*').eq('activo', true).order('nombre'),
        supabase.from('usuarios').select('*').eq('activo', true).neq('id', user?.id || '').order('nombre'),
        supabase.from('disenos_arboles').select('*').eq('activo', true).order('nombre'),
        supabase.from('niveles_ramas').select('*').eq('activo', true).order('nivel')
      ]);

      if (maquinasResult.error) throw maquinasResult.error;
      if (productosResult.error) throw productosResult.error;
      if (usuariosResult.error) throw usuariosResult.error;
      if (disenosResult.error) throw disenosResult.error;
      if (nivelesResult.error) throw nivelesResult.error;

      setMaquinas(maquinasResult.data || []);
      setProductos(productosResult.data || []);
      setUsuarios(usuariosResult.data || []);
      setDisenosArboles(disenosResult.data || []);
      setNivelesRamas(nivelesResult.data || []);
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

  const loadMetas = async () => {
    if (!formData.maquina_id) {
      setMetas([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('metas_produccion')
        .select('*')
        .eq('maquina_id', formData.maquina_id);

      if (error) throw error;
      setMetas(data || []);
    } catch (error) {
      console.error('Error loading metas:', error);
    }
  };

  const calculatePerformance = () => {
    if (!formData.productos.length || !metas.length || !formData.turno) {
      setPorcentajeCumplimiento(0);
      return;
    }

    let totalProduccionReal = 0;
    let totalMetaTurno = 0;

    formData.productos.forEach(producto => {
      const meta = metas.find(m => m.producto_id === producto.producto_id);
      if (meta) {
        totalProduccionReal += producto.produccion_real;
        
        // Determinar meta según duración del turno
        if (formData.turno.includes("8h") || formData.turno === "6:00am - 2:00pm" || 
            formData.turno === "2:00pm - 10:00pm" || formData.turno === "7:00am - 3:00pm" || 
            formData.turno === "7:00am - 3:30pm") {
          totalMetaTurno += meta.turno_8h;
        } else {
          totalMetaTurno += meta.turno_10h;
        }
      }
    });

    if (totalMetaTurno > 0) {
      const porcentaje = (totalProduccionReal / totalMetaTurno) * 100;
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

  const handleInputChange = (field: 'fecha' | 'turno' | 'maquina_id', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addProducto = () => {
    if (filteredProductos.length > 0) {
      const firstProduct = filteredProductos[0];
      const newProducto: ProductoDetalle = {
        producto_id: firstProduct.id,
        produccion_real: 0,
        niveles: firstProduct.tipo_producto === 'arbol_navideno' ? initializeNiveles(firstProduct.diseno_id!) : undefined
      };
      setFormData(prev => ({
        ...prev,
        productos: [...prev.productos, newProducto]
      }));
    }
  };

  const initializeNiveles = (disenoId: string): NivelDetalle[] => {
    const niveles = nivelesRamas.filter(n => n.diseno_id === disenoId);
    return niveles.map(nivel => ({
      nivel: nivel.nivel,
      cantidad_ramas: 0,
      festones_por_rama: nivel.festones_por_rama
    }));
  };

  const calculateFestones = (niveles: NivelDetalle[]): number => {
    return niveles.reduce((total, nivel) => total + (nivel.cantidad_ramas * nivel.festones_por_rama), 0);
  };

  const updateProductoNivel = (productoIndex: number, nivelIndex: number, cantidadRamas: number) => {
    setFormData(prev => ({
      ...prev,
      productos: prev.productos.map((producto, i) => {
        if (i === productoIndex && producto.niveles) {
          const updatedNiveles = producto.niveles.map((nivel, j) => 
            j === nivelIndex ? { ...nivel, cantidad_ramas: cantidadRamas } : nivel
          );
          const totalFestones = calculateFestones(updatedNiveles);
          return {
            ...producto,
            niveles: updatedNiveles,
            produccion_real: totalFestones
          };
        }
        return producto;
      })
    }));
  };

  const removeProducto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      productos: prev.productos.filter((_, i) => i !== index)
    }));
  };

  const updateProducto = (index: number, field: 'producto_id' | 'produccion_real', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      productos: prev.productos.map((producto, i) => {
        if (i === index) {
          if (field === 'producto_id') {
            const selectedProduct = filteredProductos.find(p => p.id === value as string);
            if (selectedProduct?.tipo_producto === 'arbol_navideno') {
              return { 
                producto_id: value as string,
                niveles: initializeNiveles(selectedProduct.diseno_id!),
                produccion_real: 0
              };
            } else {
              return { 
                producto_id: value as string,
                produccion_real: producto.produccion_real
              };
            }
          } else {
            return { ...producto, [field]: value as number };
          }
        }
        return producto;
      })
    }));
  };

  const toggleAsistente = (asistenteId: string) => {
    setFormData(prev => ({
      ...prev,
      asistentes: prev.asistentes.includes(asistenteId)
        ? prev.asistentes.filter(id => id !== asistenteId)
        : [...prev.asistentes, asistenteId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "No se encontró información del usuario",
        variant: "destructive",
      });
      return;
    }

    if (!formData.turno || !formData.maquina_id || !formData.productos.length) {
      toast({
        title: "Campos Requeridos",
        description: "Por favor completa todos los campos del formulario y agrega al menos un producto",
        variant: "destructive",
      });
      return;
    }

    // Validar que todos los productos tengan cantidad mayor a 0
    const invalidProducts = formData.productos.filter(p => p.produccion_real <= 0);
    if (invalidProducts.length > 0) {
      toast({
        title: "Cantidades Inválidas",
        description: "Todos los productos deben tener una cantidad mayor a 0",
        variant: "destructive",
      });
      return;
    }

    // Validar que los productos de árbol tengan al menos un nivel con ramas
    const invalidTreeProducts = formData.productos.filter(producto => {
      const selectedProduct = filteredProductos.find(p => p.id === producto.producto_id);
      if (selectedProduct?.tipo_producto === 'arbol_navideno' && producto.niveles) {
        const totalRamas = producto.niveles.reduce((sum, nivel) => sum + nivel.cantidad_ramas, 0);
        return totalRamas === 0;
      }
      return false;
    });
    
    if (invalidTreeProducts.length > 0) {
      toast({
        title: "Niveles Requeridos",
        description: "Los productos de árbol deben tener al menos un nivel con ramas",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const fechaAjustada = adjustDateForNightShift(formData.fecha, formData.turno);
      
      // 1. Crear registro principal
      const { data: registro, error: registroError } = await supabase
        .from('registros_produccion')
        .insert({
          fecha: fechaAjustada,
          turno: formData.turno,
          operario_id: user.id,
          maquina_id: formData.maquina_id,
          es_asistente: false
        })
        .select()
        .single();

      if (registroError) throw registroError;

      // 2. Crear detalles de productos
      const detallesPromises = formData.productos.map(producto => {
        const meta = metas.find(m => m.producto_id === producto.producto_id);
        let metaTurno = 0;
        
        if (meta) {
          if (formData.turno.includes("8h") || formData.turno === "6:00am - 2:00pm" || 
              formData.turno === "2:00pm - 10:00pm" || formData.turno === "7:00am - 3:00pm" || 
              formData.turno === "7:00am - 3:30pm") {
            metaTurno = meta.turno_8h;
          } else {
            metaTurno = meta.turno_10h;
          }
        }

        const porcentajeProducto = metaTurno > 0 ? (producto.produccion_real / metaTurno) * 100 : 0;

        return supabase.from('detalle_produccion').insert({
          registro_id: registro.id,
          producto_id: producto.producto_id,
          produccion_real: producto.produccion_real,
          porcentaje_cumplimiento: porcentajeProducto
        });
      });

      const detallesResults = await Promise.all(detallesPromises);
      const detallesErrors = detallesResults.filter(result => result.error);
      if (detallesErrors.length > 0) {
        throw detallesErrors[0].error;
      }

      // 3. Crear registros de asistentes
      if (formData.asistentes.length > 0) {
        const asistentesPromises = formData.asistentes.map(asistenteId =>
          supabase.from('registro_asistentes').insert({
            registro_id: registro.id,
            asistente_id: asistenteId
          })
        );

        const asistentesResults = await Promise.all(asistentesPromises);
        const asistentesErrors = asistentesResults.filter(result => result.error);
        if (asistentesErrors.length > 0) {
          throw asistentesErrors[0].error;
        }
      }

      toast({
        title: "¡Registro Guardado!",
        description: `Producción registrada exitosamente con ${porcentajeCumplimiento.toFixed(1)}% de cumplimiento`,
      });

      // Reset form
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        turno: '',
        maquina_id: '',
        productos: [],
        asistentes: [],
      });
      setMetas([]);
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
                <SelectContent className="bg-background z-50">
                  {maquinas.map((maquina) => (
                    <SelectItem key={maquina.id} value={maquina.id}>
                      {maquina.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Productos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center space-x-2">
                  <Package className="h-4 w-4" />
                  <span>Productos Fabricados</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProducto}
                  disabled={!formData.maquina_id || filteredProductos.length === 0}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agregar Producto</span>
                </Button>
              </div>

              {formData.productos.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {formData.maquina_id 
                      ? "Agrega los productos fabricados en este turno"
                      : "Primero selecciona una máquina"
                    }
                  </p>
                </div>
              )}

              {formData.productos.map((producto, index) => {
                const selectedProduct = filteredProductos.find(p => p.id === producto.producto_id);
                const isTreeProduct = selectedProduct?.tipo_producto === 'arbol_navideno';
                
                return (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      {/* Product Selection and Remove Button */}
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Producto</Label>
                          <Select
                            value={producto.producto_id}
                            onValueChange={(value) => updateProducto(index, 'producto_id', value)}
                          >
                            <SelectTrigger className="input-touch">
                              <SelectValue placeholder="Selecciona el producto" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {filteredProductos.map((prod) => (
                                <SelectItem key={prod.id} value={prod.id}>
                                  {prod.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeProducto(index)}
                          className="mt-6 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Tree Levels Input or Regular Quantity */}
                      {isTreeProduct && producto.niveles ? (
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-primary">Niveles de Ramas</Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                            {producto.niveles.map((nivel, nivelIndex) => (
                              <div key={nivel.nivel} className="p-3 border rounded-lg bg-muted/30">
                                <Label className="text-xs font-medium text-muted-foreground">
                                  Nivel {nivel.nivel} ({nivel.festones_por_rama} festones/rama)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={nivel.cantidad_ramas}
                                  onChange={(e) => updateProductoNivel(index, nivelIndex, parseInt(e.target.value) || 0)}
                                  placeholder="Ramas"
                                  className="input-touch mt-1"
                                  inputMode="numeric"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                            <span className="text-sm font-medium">Total de Festones:</span>
                            <Badge variant="secondary" className="text-lg font-bold">
                              {producto.produccion_real.toLocaleString()}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Cantidad Producida</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={producto.produccion_real}
                            onChange={(e) => updateProducto(index, 'produccion_real', parseInt(e.target.value) || 0)}
                            placeholder="Unidades"
                            className="input-touch"
                            inputMode="numeric"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Operarios Asistentes */}
            <div className="space-y-4">
              <Label className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Operarios Asistentes</span>
              </Label>
              
              {usuarios.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No hay otros operarios disponibles
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                  {usuarios.map((usuario) => (
                    <div key={usuario.id} className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-muted/50">
                      <Checkbox
                        id={`asistente-${usuario.id}`}
                        checked={formData.asistentes.includes(usuario.id)}
                        onCheckedChange={() => toggleAsistente(usuario.id)}
                      />
                      <Label 
                        htmlFor={`asistente-${usuario.id}`}
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        {usuario.nombre}
                        <span className="text-xs text-muted-foreground block">
                          {usuario.cedula}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {formData.asistentes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.asistentes.map((asistenteId) => {
                    const asistente = usuarios.find(u => u.id === asistenteId);
                    return asistente ? (
                      <Badge key={asistenteId} variant="secondary" className="flex items-center space-x-1">
                        <span>{asistente.nombre}</span>
                        <button
                          type="button"
                          onClick={() => toggleAsistente(asistenteId)}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Meta y Cumplimiento */}
            {formData.productos.length > 0 && formData.turno && (
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Target className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Resumen de Producción</p>
                        <div className="space-y-1">
                          {formData.productos.map((producto) => {
                            const productoInfo = productos.find(p => p.id === producto.producto_id);
                            const meta = metas.find(m => m.producto_id === producto.producto_id);
                            
                            if (!productoInfo) return null;
                            
                            let metaTurno = 0;
                            if (meta) {
                              if (formData.turno.includes("8h") || formData.turno === "6:00am - 2:00pm" || 
                                  formData.turno === "2:00pm - 10:00pm" || formData.turno === "7:00am - 3:00pm" || 
                                  formData.turno === "7:00am - 3:30pm") {
                                metaTurno = meta.turno_8h;
                              } else {
                                metaTurno = meta.turno_10h;
                              }
                            }

                            return (
                              <div key={producto.producto_id} className="text-sm text-muted-foreground">
                                <span className="font-medium">{productoInfo.nombre}:</span> {producto.produccion_real} / {metaTurno} unidades
                              </div>
                            );
                          })}
                        </div>
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
              disabled={loading || !formData.turno || !formData.maquina_id || !formData.productos.length}
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