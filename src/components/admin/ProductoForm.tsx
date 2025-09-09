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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tables } from '@/integrations/supabase/types';

type Producto = Tables<'productos'>;
type Maquina = Tables<'maquinas'>;

const formSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  maquina_id: z.string().min(1, 'La máquina es requerida'),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductoFormProps {
  producto: Producto | null;
  maquinas: Maquina[];
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export function ProductoForm({ producto, maquinas, onSubmit, onCancel }: ProductoFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: producto?.nombre || '',
      maquina_id: producto?.maquina_id || '',
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
              name="maquina_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máquina</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una máquina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {maquinasActivas.map((maquina) => (
                        <SelectItem key={maquina.id} value={maquina.id}>
                          {maquina.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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