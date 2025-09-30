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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';

type Usuario = Tables<'usuarios'>;

const formSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  cedula: z.string().min(1, 'La cédula es requerida'),
  password: z.string().optional(),
  tipo_usuario: z.enum(['operario', 'admin', 'escribano'], {
    required_error: 'Debes seleccionar un rol',
  }),
});

interface UsuarioFormProps {
  usuario: Usuario | null;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  onCancel: () => void;
}

export function UsuarioForm({ usuario, onSubmit, onCancel }: UsuarioFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: usuario?.nombre || '',
      cedula: usuario?.cedula || '',
      password: '',
      tipo_usuario: usuario?.tipo_usuario || 'operario',
    },
  });

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {usuario ? 'Editar Usuario' : 'Nuevo Usuario'}
          </DialogTitle>
          <DialogDescription>
            {usuario 
              ? 'Actualiza la información del usuario. Deja la contraseña vacía para mantener la actual.'
              : 'Completa los datos del nuevo usuario. La contraseña predeterminada es "1234" si no especificas una.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cedula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cédula</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Número de cédula" 
                      {...field}
                      disabled={!!usuario}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {usuario ? 'Nueva Contraseña (opcional)' : 'Contraseña (opcional)'}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={usuario ? "Dejar vacío para mantener actual" : "Por defecto: 1234"}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo_usuario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="operario">Operario</SelectItem>
                      <SelectItem value="escribano">Escribano</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit">
                {usuario ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
