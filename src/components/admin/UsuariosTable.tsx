import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Usuario = Tables<'usuarios'>;

interface UsuariosTableProps {
  usuarios: Usuario[];
  onEdit: (usuario: Usuario) => void;
  onDelete: (id: string) => void;
  onReactivate: (id: string) => void;
}

const roleLabels: Record<string, string> = {
  operario: 'Operario',
  admin: 'Administrador',
  escribano: 'Escribano',
};

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case 'admin':
      return 'default';
    case 'escribano':
      return 'secondary';
    case 'operario':
      return 'outline';
    default:
      return 'outline';
  }
};

export function UsuariosTable({ usuarios, onEdit, onDelete, onReactivate }: UsuariosTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No hay usuarios registrados
              </TableCell>
            </TableRow>
          ) : (
            usuarios.map((usuario) => (
              <TableRow key={usuario.id}>
                <TableCell className="font-medium">{usuario.nombre}</TableCell>
                <TableCell>{usuario.cedula}</TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(usuario.tipo_usuario)}>
                    {roleLabels[usuario.tipo_usuario] || usuario.tipo_usuario}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={usuario.activo ? 'default' : 'secondary'}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(usuario)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {usuario.activo ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(usuario.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onReactivate(usuario.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
