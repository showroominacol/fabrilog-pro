import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, RotateCcw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Producto = Tables<'productos'>;

interface ProductosTableProps {
  productos: Producto[];
  onEdit: (producto: Producto) => void;
  onDelete: (id: string) => void;
  onReactivate?: (id: string) => void;
}

export function ProductosTable({ productos, onEdit, onDelete, onReactivate }: ProductosTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentProductos = productos.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.ceil(productos.length / itemsPerPage);

  if (productos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay productos registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Tope (8h)</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha Creación</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentProductos.map((producto) => (
            <TableRow key={producto.id}>
              <TableCell className="font-medium">{producto.nombre}</TableCell>
              <TableCell>
                <Badge variant={producto.tipo_producto === 'arbol_navideno' ? 'default' : 'secondary'}>
                  {producto.tipo_producto === 'arbol_navideno' ? 'Árbol Navideño' : 'General'}
                </Badge>
              </TableCell>
              <TableCell>
                {producto.categoria ? (
                  <Badge variant="outline">{producto.categoria}</Badge>
                ) : (
                  <span className="text-muted-foreground">Sin categoría</span>
                )}
              </TableCell>
              <TableCell>
                {producto.tope_jornada_8h === null || producto.tope_jornada_8h === undefined
                  ? '-'
                  : Number(producto.tope_jornada_8h).toLocaleString('es-CO')}
              </TableCell>
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
                  <Button variant="ghost" size="sm" onClick={() => onEdit(producto)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {producto.activo ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(producto.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    onReactivate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReactivate(producto.id)}
                        className="gap-1"
                        title="Reactivar"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reactivar
                      </Button>
                    )
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        >
          Anterior
        </Button>

        <div className="text-sm">
          Página {currentPage} de {totalPages}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
