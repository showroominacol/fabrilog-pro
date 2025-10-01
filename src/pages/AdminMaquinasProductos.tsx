import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Plus, Settings, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MaquinasTable } from '@/components/admin/MaquinasTable';
import { ProductosTable } from '@/components/admin/ProductosTable';
import { MaquinaForm } from '@/components/admin/MaquinaForm';
import { ProductoForm } from '@/components/admin/ProductoForm';
import { Tables } from '@/integrations/supabase/types';

type Maquina = Tables<'maquinas'>;
type Producto = Tables<'productos'>;

export default function AdminMaquinasProductos() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMaquinaForm, setShowMaquinaForm] = useState(false);
  const [showProductoForm, setShowProductoForm] = useState(false);
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);

  // Buscar productos (ya existía)
  const [searchProducto, setSearchProducto] = useState('');

  // NUEVO: buscador y paginación para máquinas
  const [searchMaquina, setSearchMaquina] = useState('');
  const [pageMaquina, setPageMaquina] = useState(1);
  const [pageSizeMaquina, setPageSizeMaquina] = useState(10);

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a esta página",
        variant: "destructive",
      });
      return;
    }
    fetchData();
  }, [isAdmin, toast]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [maquinasResult, productosResult] = await Promise.all([
        supabase.from('maquinas').select('*').order('activa', { ascending: false }).order('nombre'),
        supabase.from('productos').select('*').order('activo', { ascending: false }).order('nombre')
      ]);

      if (maquinasResult.error) throw maquinasResult.error;
      if (productosResult.error) throw productosResult.error;

      setMaquinas(maquinasResult.data || []);
      setProductos(productosResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaquinaSubmit = async (data: { nombre: string; descripcion?: string; categoria?: string }) => {
    try {
      if (editingMaquina) {
        const { error } = await supabase
          .from('maquinas')
          .update(data)
          .eq('id', editingMaquina.id);
        
        if (error) throw error;
        
        toast({ title: "Éxito", description: "Máquina actualizada correctamente" });
      } else {
        const { error } = await supabase.from('maquinas').insert([data]);
        if (error) throw error;
        toast({ title: "Éxito", description: "Máquina creada correctamente" });
      }
      
      setShowMaquinaForm(false);
      setEditingMaquina(null);
      fetchData();
    } catch (error) {
      console.error('Error saving maquina:', error);
      toast({
        title: "Error",
        description: "Error al guardar la máquina",
        variant: "destructive",
      });
    }
  };

  const handleProductoSubmit = async (data: { 
    nombre: string; 
    tope?: number; 
    categoria: string;
    tipo_producto: 'general' | 'arbol_navideno' | 'producido_molino';
    diseno_id?: string;
    diseno_nombre?: string;
    diseno_descripcion?: string;
    niveles_ramas?: { nivel: number; festones_por_rama: number }[];
    tope_jornada_8h?: number;
    tope_jornada_10h?: number;
  }) => {
    try {
      let productoId: string;
      let disenoId = data.diseno_id;

      if (data.tipo_producto === 'arbol_navideno' && data.diseno_nombre && data.niveles_ramas) {
        const { data: nuevoDiseno, error: disenoError } = await supabase
          .from('disenos_arboles')
          .insert([{ nombre: data.diseno_nombre, descripcion: data.diseno_descripcion || null }])
          .select()
          .single();

        if (disenoError) throw disenoError;
        disenoId = nuevoDiseno.id;

        const nivelesRamas = data.niveles_ramas.map(nivel => ({
          diseno_id: disenoId!,
          nivel: nivel.nivel,
          festones_por_rama: nivel.festones_por_rama
        }));

        const { error: nivelesError } = await supabase
          .from('niveles_ramas')
          .insert(nivelesRamas);

        if (nivelesError) throw nivelesError;
      }
      
      if (editingProducto) {
        const { error: updateError } = await supabase
          .from('productos')
          .update({ 
            nombre: data.nombre, 
            tope: data.tope,
            categoria: data.categoria,
            tipo_producto: data.tipo_producto,
            diseno_id: disenoId,
            tope_jornada_8h: data.tipo_producto === 'producido_molino' ? data.tope_jornada_8h : null,
            tope_jornada_10h: data.tipo_producto === 'producido_molino' ? data.tope_jornada_10h : null
          })
          .eq('id', editingProducto!.id);
        
        if (updateError) throw updateError;
        productoId = editingProducto!.id;
      } else {
        const { data: newProducto, error: insertError } = await supabase
          .from('productos')
          .insert([{ 
            nombre: data.nombre, 
            tope: data.tope,
            categoria: data.categoria,
            tipo_producto: data.tipo_producto,
            diseno_id: disenoId,
            tope_jornada_8h: data.tipo_producto === 'producido_molino' ? data.tope_jornada_8h : null,
            tope_jornada_10h: data.tipo_producto === 'producido_molino' ? data.tope_jornada_10h : null
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        productoId = newProducto.id;
      }
      
      toast({
        title: "Éxito",
        description: editingProducto ? "Producto actualizado correctamente" : "Producto creado correctamente",
      });
      
      setShowProductoForm(false);
      setEditingProducto(null);
      fetchData();
    } catch (error) {
      console.error('Error saving producto:', error);
      toast({
        title: "Error",
        description: "Error al guardar el producto",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMaquina = async (id: string) => {
    try {
      const { error } = await supabase.from('maquinas').update({ activa: false }).eq('id', id);
      if (error) throw error;
      toast({ title: "Éxito", description: "Máquina desactivada correctamente" });
      fetchData();
    } catch (error) {
      console.error('Error deactivating maquina:', error);
      toast({ title: "Error", description: "Error al desactivar la máquina", variant: "destructive" });
    }
  };

  const handleReactivateMaquina = async (id: string) => {
    try {
      const { error } = await supabase.from('maquinas').update({ activa: true }).eq('id', id);
      if (error) throw error;
      toast({ title: "Éxito", description: "Máquina reactivada correctamente" });
      fetchData();
    } catch (error) {
      console.error('Error reactivating maquina:', error);
      toast({ title: "Error", description: "Error al reactivar la máquina", variant: "destructive" });
    }
  };

  const handleDeleteProducto = async (id: string) => {
    try {
      const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id);
      if (error) throw error;
      toast({ title: "Éxito", description: "Producto desactivado correctamente" });
      fetchData();
    } catch (error) {
      console.error('Error deactivating producto:', error);
      toast({ title: "Error", description: "Error al desactivar el producto", variant: "destructive" });
    }
  };

  const handleReactivateProducto = async (id: string) => {
    try {
      const { error } = await supabase.from('productos').update({ activo: true }).eq('id', id);
      if (error) throw error;
      toast({ title: "Éxito", description: "Producto reactivado correctamente" });
      fetchData();
    } catch (error) {
      console.error('Error reactivating producto:', error);
      toast({ title: "Error", description: "Error al reactivar el producto", variant: "destructive" });
    }
  };

  // ----------- FILTRO + PAGINACIÓN DE MÁQUINAS (cliente) -----------
  const filteredMaquinas = useMemo(() => {
    const q = searchMaquina.trim().toLowerCase();
    const arr = !q
      ? maquinas
      : maquinas.filter(m =>
          (m.nombre ?? '').toLowerCase().includes(q) ||
          (m.categoria ?? '').toLowerCase().includes(q) ||
          (m.descripcion ?? '').toLowerCase().includes(q)
        );
    // Si la búsqueda reduce resultados, vuelvo a la primera página
    if (pageMaquina !== 1 && (pageMaquina - 1) * pageSizeMaquina >= arr.length) {
      setPageMaquina(1);
    }
    return arr;
  }, [maquinas, searchMaquina, pageMaquina, pageSizeMaquina]);

  const totalPagesMaquina = Math.max(1, Math.ceil(filteredMaquinas.length / pageSizeMaquina));

  const paginatedMaquinas = useMemo(() => {
    const start = (pageMaquina - 1) * pageSizeMaquina;
    return filteredMaquinas.slice(start, start + pageSizeMaquina);
  }, [filteredMaquinas, pageMaquina, pageSizeMaquina]);

  // Resetear página cuando cambia el pageSize o el término de búsqueda
  useEffect(() => {
    setPageMaquina(1);
  }, [searchMaquina, pageSizeMaquina]);

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Acceso Restringido</h3>
              <p className="text-muted-foreground">
                Solo los administradores pueden acceder a esta página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Administración</h1>
          <p className="text-muted-foreground">Gestiona máquinas y productos</p>
        </div>
      </div>

      <Tabs defaultValue="maquinas" className="w-full">
        <TabsList>
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="maquinas" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle>Máquinas</CardTitle>
                <div className="flex flex-1 gap-3 md:max-w-xl md:ml-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar máquina por nombre, categoría o descripción..."
                      value={searchMaquina}
                      onChange={(e) => setSearchMaquina(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="pageSizeMaquina" className="text-sm text-muted-foreground whitespace-nowrap">Por página</label>
                    <select
                      id="pageSizeMaquina"
                      className="border rounded-md px-2 py-2 text-sm"
                      value={pageSizeMaquina}
                      onChange={(e) => setPageSizeMaquina(Number(e.target.value))}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <Button onClick={() => setShowMaquinaForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Máquina
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <MaquinasTable
                maquinas={paginatedMaquinas}
                onEdit={(maquina) => {
                  setEditingMaquina(maquina);
                  setShowMaquinaForm(true);
                }}
                onDelete={handleDeleteMaquina}
                onReactivate={handleReactivateMaquina}
              />

              {/* Controles de paginación */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Mostrando{' '}
                  <span className="font-medium">
                    {filteredMaquinas.length === 0 ? 0 : (pageMaquina - 1) * pageSizeMaquina + 1}
                  </span>{' '}
                  –{' '}
                  <span className="font-medium">
                    {Math.min(pageMaquina * pageSizeMaquina, filteredMaquinas.length)}
                  </span>{' '}
                  de <span className="font-medium">{filteredMaquinas.length}</span> máquinas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMaquina(p => Math.max(1, p - 1))}
                    disabled={pageMaquina <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página <strong>{pageMaquina}</strong> de <strong>{totalPagesMaquina}</strong>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMaquina(p => Math.min(totalPagesMaquina, p + 1))}
                    disabled={pageMaquina >= totalPagesMaquina}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="productos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Productos</CardTitle>
                <Button onClick={() => setShowProductoForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Producto
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar producto por nombre, tipo o categoría..."
                  value={searchProducto}
                  onChange={(e) => setSearchProducto(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ProductosTable
                productos={productos.filter(producto => 
                  producto.nombre.toLowerCase().includes(searchProducto.toLowerCase()) ||
                  (producto.tipo_producto && producto.tipo_producto.toLowerCase().includes(searchProducto.toLowerCase())) ||
                  (producto.categoria && producto.categoria.toLowerCase().includes(searchProducto.toLowerCase()))
                )}
                onEdit={(producto) => {
                  setEditingProducto(producto);
                  setShowProductoForm(true);
                }}
                onDelete={handleDeleteProducto}
                onReactivate={handleReactivateProducto}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showMaquinaForm && (
        <MaquinaForm
          maquina={editingMaquina}
          onSubmit={handleMaquinaSubmit}
          onCancel={() => {
            setShowMaquinaForm(false);
            setEditingMaquina(null);
          }}
        />
      )}

      {showProductoForm && (
        <ProductoForm
          producto={editingProducto}
          maquinas={maquinas}
          onSubmit={handleProductoSubmit}
          onCancel={() => {
            setShowProductoForm(false);
            setEditingProducto(null);
          }}
        />
      )}
    </div>
  );
}
