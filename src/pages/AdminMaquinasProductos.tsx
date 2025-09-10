import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MaquinasTable } from '@/components/admin/MaquinasTable';
import { ProductosTable } from '@/components/admin/ProductosTable';
import { MaquinaForm } from '@/components/admin/MaquinaForm';
import { ProductoForm } from '@/components/admin/ProductoForm';
import { Tables } from '@/integrations/supabase/types';

type Maquina = Tables<'maquinas'>;
type Producto = Tables<'productos'> & { 
  maquinas?: { nombre: string }[];
  productos_maquinas?: { maquina_id: string }[];
};

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
  const [editingProductoMaquinas, setEditingProductoMaquinas] = useState<string[] | null>(null);

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
        supabase.from('maquinas').select('*').order('nombre'),
        supabase.from('productos').select(`
          *,
          productos_maquinas!fk_productos_maquinas_producto(
            maquina_id,
            maquinas!fk_productos_maquinas_maquina(nombre)
          )
        `).order('nombre')
      ]);

      if (maquinasResult.error) throw maquinasResult.error;
      if (productosResult.error) throw productosResult.error;

      // Transform the data to match expected structure
      const productosWithMaquinas = productosResult.data?.map(producto => ({
        ...producto,
        maquinas: (producto as any).productos_maquinas?.map((pm: any) => ({ nombre: pm.maquinas.nombre })) || []
      })) || [];

      setMaquinas(maquinasResult.data || []);
      setProductos(productosWithMaquinas);
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

  const handleMaquinaSubmit = async (data: { nombre: string; descripcion?: string }) => {
    try {
      if (editingMaquina) {
        const { error } = await supabase
          .from('maquinas')
          .update(data)
          .eq('id', editingMaquina.id);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Máquina actualizada correctamente",
        });
      } else {
        const { error } = await supabase
          .from('maquinas')
          .insert([data]);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Máquina creada correctamente",
        });
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

  const handleProductoSubmit = async (data: { nombre: string; tope?: number; maquinas_ids: string[] }) => {
    try {
      let productoId: string;
      
      if (editingProducto) {
        // Update existing product
        const { error: updateError } = await supabase
          .from('productos')
          .update({ nombre: data.nombre, tope: data.tope })
          .eq('id', editingProducto.id);
        
        if (updateError) throw updateError;
        productoId = editingProducto.id;
        
        // Delete existing machine relationships
        const { error: deleteError } = await supabase
          .from('productos_maquinas')
          .delete()
          .eq('producto_id', productoId);
        
        if (deleteError) throw deleteError;
      } else {
        // Create new product
        const { data: newProducto, error: insertError } = await supabase
          .from('productos')
          .insert([{ nombre: data.nombre, tope: data.tope }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        productoId = newProducto.id;
      }
      
      // Insert new machine relationships
      if (data.maquinas_ids.length > 0) {
        const relationships = data.maquinas_ids.map(maquinaId => ({
          producto_id: productoId,
          maquina_id: maquinaId
        }));
        
        const { error: relationError } = await supabase
          .from('productos_maquinas')
          .insert(relationships);
        
        if (relationError) throw relationError;
      }
      
      toast({
        title: "Éxito",
        description: editingProducto ? "Producto actualizado correctamente" : "Producto creado correctamente",
      });
      
      setShowProductoForm(false);
      setEditingProducto(null);
      setEditingProductoMaquinas(null);
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
      const { error } = await supabase
        .from('maquinas')
        .update({ activa: false })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Máquina desactivada correctamente",
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deactivating maquina:', error);
      toast({
        title: "Error",
        description: "Error al desactivar la máquina",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProducto = async (id: string) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Producto desactivado correctamente",
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deactivating producto:', error);
      toast({
        title: "Error",
        description: "Error al desactivar el producto",
        variant: "destructive",
      });
    }
  };

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
              <div className="flex justify-between items-center">
                <CardTitle>Máquinas</CardTitle>
                <Button onClick={() => setShowMaquinaForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Máquina
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <MaquinasTable
                maquinas={maquinas}
                onEdit={(maquina) => {
                  setEditingMaquina(maquina);
                  setShowMaquinaForm(true);
                }}
                onDelete={handleDeleteMaquina}
              />
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
            <CardContent>
              <ProductosTable
                productos={productos}
                onEdit={(producto, maquinasIds) => {
                  setEditingProducto(producto);
                  setEditingProductoMaquinas(maquinasIds);
                  setShowProductoForm(true);
                }}
                onDelete={handleDeleteProducto}
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
          productoMaquinas={editingProductoMaquinas}
          maquinas={maquinas}
          onSubmit={handleProductoSubmit}
          onCancel={() => {
            setShowProductoForm(false);
            setEditingProducto(null);
            setEditingProductoMaquinas(null);
          }}
        />
      )}
    </div>
  );
}