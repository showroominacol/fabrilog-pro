import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UsuariosTable } from '@/components/admin/UsuariosTable';
import { UsuarioForm } from '@/components/admin/UsuarioForm';
import { Tables } from '@/integrations/supabase/types';

type Usuario = Tables<'usuarios'>;

export default function AdminUsuarios() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Estado base
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUsuarioForm, setShowUsuarioForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);

  // Búsqueda + paginación
  const [searchUsuario, setSearchUsuario] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Carga de datos
  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: 'Acceso denegado',
        description: 'Solo los administradores pueden acceder a esta página',
        variant: 'destructive',
      });
      return;
    }
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        title: 'Error',
        description: 'Error al cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // --- IMPORTANTE: hooks derivados ANTES de returns condicionales ---
  const filteredUsuarios = useMemo(() => {
    const q = searchUsuario.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => {
      const nombre = (u.nombre ?? '').toLowerCase();
      const cedula = (u.cedula ?? '').toString();
      const rol = (u.tipo_usuario ?? '').toLowerCase();
      return nombre.includes(q) || cedula.includes(searchUsuario.trim()) || rol.includes(q);
    });
  }, [usuarios, searchUsuario]);

  const totalPages = Math.max(1, Math.ceil(filteredUsuarios.length / pageSize));

  const paginatedUsuarios = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsuarios.slice(start, start + pageSize);
  }, [filteredUsuarios, page, pageSize]);

  // Resetear a página 1 al cambiar búsqueda o tamaño
  useEffect(() => {
    setPage(1);
  }, [searchUsuario, pageSize]);
  // --- FIN: hooks derivados ---

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
        const { error } = await supabase.from('usuarios').update(updateData).eq('id', editingUsuario.id);
        if (error) throw error;

        toast({ title: 'Éxito', description: 'Usuario actualizado correctamente' });
      } else {
        const { data: existingUser } = await supabase.from('usuarios').select('id').eq('cedula', data.cedula).single();
        if (existingUser) {
          toast({
            title: 'Error',
            description: 'Ya existe un usuario con esta cédula',
            variant: 'destructive',
          });
          return;
        }
        const { error } = await supabase.from('usuarios').insert([
          {
            nombre: data.nombre,
            cedula: data.cedula,
            password_hash: data.password || '1234',
            tipo_usuario: data.tipo_usuario,
            activo: true,
          },
        ]);
        if (error) throw error;

        toast({ title: 'Éxito', description: 'Usuario creado correctamente' });
      }

      setShowUsuarioForm(false);
      setEditingUsuario(null);
      fetchUsuarios();
    } catch (error) {
      console.error('Error saving usuario:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUsuario = async (id: string) => {
    try {
      const { error } = await supabase.from('usuarios').update({ activo: false }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Usuario desactivado correctamente' });
      fetchUsuarios();
    } catch (error) {
      console.error('Error deactivating usuario:', error);
      toast({ title: 'Error', description: 'Error al desactivar el usuario', variant: 'destructive' });
    }
  };

  const handleReactivateUsuario = async (id: string) => {
    try {
      const { error } = await supabase.from('usuarios').update({ activo: true }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Usuario reactivado correctamente' });
      fetchUsuarios();
    } catch (error) {
      console.error('Error reactivating usuario:', error);
      toast({ title: 'Error', description: 'Error al reactivar el usuario', variant: 'destructive' });
    }
  };

  // Ahora sí, los returns condicionales (después de TODOS los hooks):
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Acceso Restringido</h3>
              <p className="text-muted-foreground">Solo los administradores pueden acceder a esta página.</p>
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
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra usuarios y sus roles</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Usuarios</CardTitle>
            <div className="flex flex-1 gap-3 md:max-w-xl md:ml-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre, cédula o rol..."
                  value={searchUsuario}
                  onChange={(e) => setSearchUsuario(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="pageSize" className="text-sm text-muted-foreground whitespace-nowrap">
                  Por página
                </label>
                <select
                  id="pageSize"
                  className="border rounded-md px-2 py-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <Button onClick={() => setShowUsuarioForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <UsuariosTable
            usuarios={paginatedUsuarios}
            onEdit={(usuario) => {
              setEditingUsuario(usuario);
              setShowUsuarioForm(true);
            }}
            onDelete={handleDeleteUsuario}
            onReactivate={handleReactivateUsuario}
          />

          {/* Paginación */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Mostrando{' '}
              <span className="font-medium">
                {filteredUsuarios.length === 0 ? 0 : (page - 1) * pageSize + 1}
              </span>{' '}
              –{' '}
              <span className="font-medium">{Math.min(page * pageSize, filteredUsuarios.length)}</span>{' '}
              de <span className="font-medium">{filteredUsuarios.length}</span> usuarios
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
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
