import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription, 
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type Producto = Tables<'productos'>;
type Maquina = Tables<'maquinas'>;
type DisenoArbol = Tables<'disenos_arboles'>;
type NivelRama = Tables<'niveles_ramas'>;
type RamaAmarradora = {
  numero_rama: number;
  tope_rama: number;
};

const formSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  categoria: z.string().min(1, 'Debe seleccionar una categoría'),
  tipo_producto: z.enum(['general', 'arbol_navideno', 'producido_molino', 'arbol_amarradora']),
  // Topes por jornada - 8h obligatorio, 10h opcional
  tope_jornada_8h: z.number().min(0, 'El tope debe ser mayor o igual a 0'),
  tope_jornada_10h: z.number().min(0, 'El tope debe ser mayor o igual a 0').optional(),
  diseno_id: z.string().optional(),
  // Para crear nuevo diseño
  diseno_nombre: z.string().optional(),
  diseno_descripcion: z.string().optional(),
  niveles_ramas: z.array(z.object({
    nivel: z.number(),
    festones_por_rama: z.number()
  })).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductoFormProps {
  producto: Producto | null;
  maquinas: Maquina[];
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export function ProductoForm({ producto, maquinas, onSubmit, onCancel }: ProductoFormProps) {
  const [disenosArboles, setDisenosArboles] = useState<DisenoArbol[]>([]);
  const [nivelesRamas, setNivelesRamas] = useState<{ nivel: number; festones_por_rama: number }[]>([]);
  const [ramasAmarradora, setRamasAmarradora] = useState<RamaAmarradora[]>([]);
  const [creandoNuevoDiseno, setCreandoNuevoDiseno] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: producto?.nombre || '',
      categoria: producto?.categoria || '',
      tipo_producto: (producto?.tipo_producto as 'general' | 'arbol_navideno' | 'producido_molino' | 'arbol_amarradora' | undefined) || 'general',
      tope_jornada_8h: producto?.tope_jornada_8h ? Number(producto.tope_jornada_8h) : 0,
      tope_jornada_10h: producto?.tope_jornada_10h ? Number(producto.tope_jornada_10h) : undefined,
      diseno_id: producto?.diseno_id || undefined,
      diseno_nombre: '',
      diseno_descripcion: '',
      niveles_ramas: [],
    },
  });

  const tipoProducto = form.watch('tipo_producto');
  const disenoId = form.watch('diseno_id');

  useEffect(() => {
    if (tipoProducto === 'arbol_navideno' || tipoProducto === 'arbol_amarradora') {
      fetchDisenosArboles();
    }
  }, [tipoProducto]);

  useEffect(() => {
    if (disenoId && !creandoNuevoDiseno) {
      fetchNivelesRamas(disenoId);
    }
  }, [disenoId, creandoNuevoDiseno]);

  const fetchDisenosArboles = async () => {
    const { data } = await supabase
      .from('disenos_arboles')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    
    if (data) {
      setDisenosArboles(data);
    }
  };

  const fetchNivelesRamas = async (disenoId: string) => {
    const { data } = await supabase
      .from('niveles_ramas')
      .select('*')
      .eq('diseno_id', disenoId)
      .eq('activo', true)
      .order('nivel');
    
    if (data) {
      setNivelesRamas(data.map(n => ({ nivel: n.nivel, festones_por_rama: n.festones_por_rama })));
    }
  };

  const handleSubmit = (data: FormValues) => {
    // Agregar ramas_amarradora si existen
    const submitData = {
      ...data,
      niveles_ramas: tipoProducto === 'arbol_navideno' && creandoNuevoDiseno ? nivelesRamas : undefined,
      ramas_amarradora: tipoProducto === 'arbol_amarradora' && creandoNuevoDiseno ? ramasAmarradora : undefined
    };
    onSubmit(submitData);
  };

  const agregarNivel = () => {
    const nuevoNivel = nivelesRamas.length + 1;
    setNivelesRamas([...nivelesRamas, { nivel: nuevoNivel, festones_por_rama: 0 }]);
  };

  const eliminarNivel = (index: number) => {
    setNivelesRamas(nivelesRamas.filter((_, i) => i !== index));
  };

  const actualizarNivel = (index: number, field: 'nivel' | 'festones_por_rama', value: number) => {
    const nuevosNiveles = [...nivelesRamas];
    nuevosNiveles[index][field] = value;
    setNivelesRamas(nuevosNiveles);
    form.setValue('niveles_ramas', nuevosNiveles);
  };

  const agregarRamaAmarradora = () => {
    const nuevaRama = ramasAmarradora.length + 1;
    setRamasAmarradora([...ramasAmarradora, { numero_rama: nuevaRama, tope_rama: 0 }]);
  };

  const eliminarRamaAmarradora = (index: number) => {
    setRamasAmarradora(ramasAmarradora.filter((_, i) => i !== index));
  };

  const actualizarRamaAmarradora = (index: number, field: 'numero_rama' | 'tope_rama', value: number) => {
    const nuevasRamas = [...ramasAmarradora];
    nuevasRamas[index][field] = value;
    setRamasAmarradora(nuevasRamas);
  };

  // Obtener categorías únicas de máquinas activas
  const categoriasUnicas = Array.from(new Set(
    maquinas
      .filter(m => m.activa && m.categoria)
      .map(m => m.categoria)
  )).filter(Boolean);

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {producto ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
          <DialogDescription>
            {producto
              ? 'Modifica los datos del producto'
              : 'Ingresa los datos del nuevo producto'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del producto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="tope_jornada_8h"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tope de Producción 8 Horas *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Tope para jornadas de 8 horas" 
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tope_jornada_10h"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tope de Producción 10 Horas (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Tope para jornadas de 10 horas" 
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo_producto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Producto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de producto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="arbol_navideno">Árbol Navideño</SelectItem>
                      <SelectItem value="producido_molino">Producido Molino</SelectItem>
                      <SelectItem value="arbol_amarradora">Árbol Amarradora</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipoProducto === 'arbol_navideno' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuración de Árbol Navideño</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant={creandoNuevoDiseno ? "default" : "outline"}
                      onClick={() => {
                        setCreandoNuevoDiseno(true);
                        form.setValue('diseno_id', undefined);
                        setNivelesRamas([]);
                      }}
                      size="sm"
                    >
                      Crear Nuevo Diseño
                    </Button>
                    {disenosArboles.length > 0 && (
                      <Button
                        type="button"
                        variant={!creandoNuevoDiseno ? "default" : "outline"}
                        onClick={() => {
                          setCreandoNuevoDiseno(false);
                          form.setValue('diseno_nombre', '');
                          form.setValue('diseno_descripcion', '');
                          setNivelesRamas([]);
                        }}
                        size="sm"
                      >
                        Usar Diseño Existente
                      </Button>
                    )}
                  </div>

                  {creandoNuevoDiseno ? (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="diseno_nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Diseño</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre del diseño" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="diseno_descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Descripción del diseño" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <FormLabel>Configuración de Ramas</FormLabel>
                          <Button type="button" onClick={agregarNivel} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Nivel
                          </Button>
                        </div>
                        
                        {nivelesRamas.map((nivel, index) => (
                          <div key={index} className="flex items-center space-x-2 p-3 border rounded">
                            <div className="flex-1">
                              <label className="text-sm font-medium">Nivel</label>
                              <Input
                                type="number"
                                value={nivel.nivel}
                                onChange={(e) => actualizarNivel(index, 'nivel', Number(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-sm font-medium">Festones por Rama</label>
                              <Input
                                type="number"
                                value={nivel.festones_por_rama}
                                onChange={(e) => actualizarNivel(index, 'festones_por_rama', Number(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarNivel(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="diseno_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diseño Existente</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un diseño" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {disenosArboles.map((diseno) => (
                                <SelectItem key={diseno.id} value={diseno.id}>
                                  {diseno.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {!creandoNuevoDiseno && disenoId && nivelesRamas.length > 0 && (
                    <div className="space-y-2">
                      <FormLabel>Configuración de Ramas</FormLabel>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="font-medium">Nivel</div>
                        <div className="font-medium">Festones por Rama</div>
                        {nivelesRamas.map((nivel, index) => (
                          <React.Fragment key={index}>
                            <div>{nivel.nivel}</div>
                            <div>{nivel.festones_por_rama}</div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {tipoProducto === 'arbol_amarradora' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuración de Árbol Amarradora</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant={creandoNuevoDiseno ? "default" : "outline"}
                      onClick={() => {
                        setCreandoNuevoDiseno(true);
                        form.setValue('diseno_id', undefined);
                        setRamasAmarradora([]);
                      }}
                      size="sm"
                    >
                      Crear Nuevo Diseño
                    </Button>
                    {disenosArboles.length > 0 && (
                      <Button
                        type="button"
                        variant={!creandoNuevoDiseno ? "default" : "outline"}
                        onClick={() => {
                          setCreandoNuevoDiseno(false);
                          form.setValue('diseno_nombre', '');
                          form.setValue('diseno_descripcion', '');
                          setRamasAmarradora([]);
                        }}
                        size="sm"
                      >
                        Usar Diseño Existente
                      </Button>
                    )}
                  </div>

                  {creandoNuevoDiseno ? (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="diseno_nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Diseño</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre del diseño" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="diseno_descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Descripción del diseño" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <FormLabel>Configuración de Ramas</FormLabel>
                          <Button type="button" onClick={agregarRamaAmarradora} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Rama
                          </Button>
                        </div>
                        
                        {ramasAmarradora.map((rama, index) => (
                          <div key={index} className="flex items-center space-x-2 p-3 border rounded">
                            <div className="flex-1">
                              <label className="text-sm font-medium">Número de Rama</label>
                              <Input
                                type="number"
                                value={rama.numero_rama}
                                onChange={(e) => actualizarRamaAmarradora(index, 'numero_rama', Number(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-sm font-medium">Tope de Rama</label>
                              <Input
                                type="number"
                                value={rama.tope_rama}
                                onChange={(e) => actualizarRamaAmarradora(index, 'tope_rama', Number(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarRamaAmarradora(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="diseno_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diseño Existente</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un diseño" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {disenosArboles.map((diseno) => (
                                <SelectItem key={diseno.id} value={diseno.id}>
                                  {diseno.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría de Máquinas</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoriasUnicas.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {categoria}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit">
                {producto ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}