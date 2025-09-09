import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Producto = Tables<'productos'>;
type Maquina = Tables<'maquinas'>;

interface ProductosTableProps {
  productos: Producto[];
  maquinas: Maquina[];
  onEdit: (producto: Producto) => void;
  onDelete: (id: string) => void;
}

export function ProductosTable({ productos, maquinas, onEdit, onDelete }: ProductosTableProps) {
  const getMaquinaNombre = (maquinaId: string) => {
    const maquina = maquinas.find(m => m.id === maquinaId);
    return maquina?.nombre || 'Máquina no encontrada';
  };

  if (productos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay productos registrados</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Máquina</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha Creación</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {productos.map((producto) => (
          <TableRow key={producto.id}>
            <TableCell className="font-medium">{producto.nombre}</TableCell>
            <TableCell>{getMaquinaNombre(producto.maquina_id)}</TableCell>
            <TableCell>
              <Badge variant={producto.activo ? 'default' : 'secondary'}>
                {producto.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(producto.fecha_creacion).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(producto)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {producto.activo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(producto.id)}
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