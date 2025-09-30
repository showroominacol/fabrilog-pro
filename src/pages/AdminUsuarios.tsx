import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UsuariosTable } from '@/components/admin/UsuariosTable';
import { UsuarioForm } from '@/components/admin/UsuarioForm';
import { Tables } from '@/integrations/supabase/types';

type Usuario = Tables<'usuarios'>;

export default function AdminUsuarios() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUsuarioForm, setShowUsuarioForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [searchUsuario, setSearchUsuario] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a esta página",
        variant: "destructive",
      });
      return;
    }
    fetchUsuarios();
  }, [isAdmin, toast]);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('activo', { ascending: false })
        .order('nombre');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
      toast({
        title: "Error",
        description: "Error al cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsuarioSubmit = async (data: { 
    nombre: string; 
    cedula: string; 
    password?: string;
    tipo_usuario: 'operario' | 'admin' | 'escribano';
  }) => {
    try {
      if (editingUsuario) {
        const updateData: any = {
          nombre: data.nombre,
          cedula: data.cedula,
          tipo_usuario: data.tipo_usuario,
        };
        
        if (data.password && data.password.trim() !== '') {
          updateData.password_hash = data.password;
        }

        const { error } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editingUsuario.id);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Usuario actualizado correctamente",
        });
      } else {
        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id')
          .eq('cedula', data.cedula)
          .single();

        if (existingUser) {
          toast({
            title: "Error",
            description: "Ya existe un usuario con esta cédula",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from('usuarios')
          .insert([{
            nombre: data.nombre,
            cedula: data.cedula,
            password_hash: data.password || '1234',
            tipo_usuario: data.tipo_usuario,
            activo: true,
          }]);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Usuario creado correctamente",
        });
      }
      
      setShowUsuarioForm(false);
      setEditingUsuario(null);
      fetchUsuarios();
    } catch (error) {
      console.error('Error saving usuario:', error);
      toast({
        title: "Error",
        description: "Error al guardar el usuario",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUsuario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: false })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Usuario desactivado correctamente",
      });
      
      fetchUsuarios();
    } catch (error) {
      console.error('Error deactivating usuario:', error);
      toast({
        title: "Error",
        description: "Error al desactivar el usuario",
        variant: "destructive",
      });
    }
  };

  const handleReactivateUsuario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: true })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Usuario reactivado correctamente",
      });

      fetchUsuarios();
    } catch (error) {
      console.error('Error reactivating usuario:', error);
      toast({
        title: "Error",
        description: "Error al reactivar el usuario",
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

  const filteredUsuarios = usuarios.filter(usuario => 
    usuario.nombre.toLowerCase().includes(searchUsuario.toLowerCase()) ||
    usuario.cedula.includes(searchUsuario) ||
    usuario.tipo_usuario.toLowerCase().includes(searchUsuario.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra usuarios y sus roles</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Usuarios</CardTitle>
            <Button onClick={() => setShowUsuarioForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, cédula o rol..."
              value={searchUsuario}
              onChange={(e) => setSearchUsuario(e.target.value)}
              className="pl-10"
            />
          </div>
          <UsuariosTable
            usuarios={filteredUsuarios}
            onEdit={(usuario) => {
              setEditingUsuario(usuario);
              setShowUsuarioForm(true);
            }}
            onDelete={handleDeleteUsuario}
            onReactivate={handleReactivateUsuario}
          />
        </CardContent>
      </Card>

      {showUsuarioForm && (
        <UsuarioForm
          usuario={editingUsuario}
          onSubmit={handleUsuarioSubmit}
          onCancel={() => {
            setShowUsuarioForm(false);
            setEditingUsuario(null);
          }}
        />
      )}
    </div>
  );
}
