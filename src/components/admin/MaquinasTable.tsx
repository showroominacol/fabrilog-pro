import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Maquina = Tables<'maquinas'>;

interface MaquinasTableProps {
  maquinas: Maquina[];
  onEdit: (maquina: Maquina) => void;
  onDelete: (id: string) => void;
}

export function MaquinasTable({ maquinas, onEdit, onDelete }: MaquinasTableProps) {
  if (maquinas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay máquinas registradas</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha Creación</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {maquinas.map((maquina) => (
          <TableRow key={maquina.id}>
            <TableCell className="font-medium">{maquina.nombre}</TableCell>
            <TableCell>{maquina.descripcion || '-'}</TableCell>
            <TableCell>
              <Badge variant={maquina.activa ? 'default' : 'secondary'}>
                {maquina.activa ? 'Activa' : 'Inactiva'}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(maquina.fecha_creacion).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(maquina)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {maquina.activa && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(maquina.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}