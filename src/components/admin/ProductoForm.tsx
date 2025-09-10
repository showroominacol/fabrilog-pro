import React from 'react';
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
import { Tables } from '@/integrations/supabase/types';

type Producto = Tables<'productos'>;
type Maquina = Tables<'maquinas'>;

const formSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tope: z.number().min(0, 'El tope debe ser mayor o igual a 0').optional(),
  maquinas_ids: z.array(z.string()).min(1, 'Debe seleccionar al menos una máquina'),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductoFormProps {
  producto: Producto | null;
  productoMaquinas: string[] | null;
  maquinas: Maquina[];
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export function ProductoForm({ producto, productoMaquinas, maquinas, onSubmit, onCancel }: ProductoFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: producto?.nombre || '',
      tope: producto?.tope ? Number(producto.tope) : undefined,
      maquinas_ids: productoMaquinas || [],
    },
  });

  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
  };

  const maquinasActivas = maquinas.filter(m => m.activa);

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
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
              name="tope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tope de Producción</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Tope de producción" 
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maquinas_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máquinas</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {maquinasActivas.map((maquina) => (
                      <div key={maquina.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={maquina.id}
                          checked={field.value.includes(maquina.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, maquina.id]);
                            } else {
                              field.onChange(field.value.filter((id) => id !== maquina.id));
                            }
                          }}
                        />
                        <label htmlFor={maquina.id} className="text-sm cursor-pointer">
                          {maquina.nombre}
                        </label>
                      </div>
                    ))}
                  </div>
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