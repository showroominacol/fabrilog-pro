// src/components/admin/MaquinasTable.tsx
import * as React from "react";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tables } from "@/integrations/supabase/types";

export type Maquina = Tables<"maquinas">;

export type MaquinasTableProps = {
  maquinas: Maquina[];
  onEdit: (maquina: Maquina) => void; // Abre el formulario con la máquina seleccionada
  onDelete: (id: string) => void;     // Desactivar (activa=false)
  onReactivate: (id: string) => void; // Reactivar (activa=true)
  loadingId?: string | null;          // Opcional: deshabilita acciones por fila
};

export const MaquinasTable: React.FC<MaquinasTableProps> = ({
  maquinas,
  onEdit,
  onDelete,
  onReactivate,
  loadingId = null,
}) => {
  const isRowLoading = (id: string) => loadingId === id;

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden md:table-cell">Categoría</TableHead>
            <TableHead className="hidden md:table-cell">Descripción</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {maquinas && maquinas.length > 0 ? (
            maquinas.map((maquina) => {
              const activa = Boolean(maquina.activa);
              return (
                <TableRow
                  key={maquina.id}
                  className={!activa ? "opacity-80" : ""}
                >
                  <TableCell className="font-medium">
                    {maquina.nombre ?? "—"}
                  </TableCell>

                  {/* Categoría */}
                  <TableCell className="hidden md:table-cell">
                    {("categoria" in maquina ? (maquina as any).categoria : null) ?? "—"}
                  </TableCell>

                  {/* Descripción */}
                  <TableCell className="hidden md:table-cell max-w-[420px] truncate">
                    {("descripcion" in maquina ? (maquina as any).descripcion : null) ?? "—"}
                  </TableCell>

                  {/* Estado */}
                  <TableCell>
                    <Badge variant={activa ? "default" : "secondary"}>
                      {activa ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Editar: icon-only */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        aria-label="Editar máquina"
                        title="Editar"
                        onClick={() => onEdit(maquina)}
                        disabled={isRowLoading(maquina.id)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>

                      {activa ? (
                        // Desactivar: icon-only
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-9 w-9 p-0"
                          aria-label="Desactivar máquina"
                          title="Desactivar"
                          onClick={() => onDelete(maquina.id)}
                          disabled={isRowLoading(maquina.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Desactivar</span>
                        </Button>
                      ) : (
                        // Reactivar: icon-only
                        <Button
                          variant="default"
                          size="sm"
                          className="h-9 w-9 p-0"
                          aria-label="Reactivar máquina"
                          title="Reactivar"
                          onClick={() => onReactivate(maquina.id)}
                          disabled={isRowLoading(maquina.id)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Reactivar</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-6 text-sm text-muted-foreground"
              >
                No hay máquinas para mostrar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
