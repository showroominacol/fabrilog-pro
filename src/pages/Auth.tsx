import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Factory, Loader2, AlertCircle, User, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const cedula = formData.get('cedula') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(cedula, password);

    if (error) {
      setError(error.message);
      toast({
        title: "Error de Autenticación",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const nombre = formData.get('nombre') as string;
    const cedula = formData.get('cedula') as string;
    const password = formData.get('password') as string;
    const tipo_usuario = formData.get('tipo_usuario') as 'operario' | 'admin';

    if (!nombre.trim()) {
      setError('El nombre es requerido');
      setIsLoading(false);
      return;
    }

    if (!cedula.trim()) {
      setError('La cédula es requerida');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(nombre.trim(), cedula.trim(), password, tipo_usuario);

    if (error) {
      setError(error.message);
      toast({
        title: "Error de Registro",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo y título */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
            <Factory className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-foreground">FabriLog Pro</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sistema de Gestión de Producción Industrial
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-[var(--shadow-elevated)]">
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">OPERARIO</TabsTrigger>
                <TabsTrigger value="signin-admin">ADMINISTRADOR</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="signin" className="space-y-4">
                <CardDescription>
                  Acceso para operarios de producción
                </CardDescription>
                
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-nombre">Nombre</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-nombre"
                        name="nombre"
                        type="text"
                        required
                        placeholder="Juan Pérez"
                        className="input-touch pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-cedula">Cédula</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-cedula"
                        name="cedula"
                        type="text"
                        required
                        placeholder="12345678"
                        className="input-touch pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Contraseña</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="input-touch"
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full btn-touch font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      'INICIAR COMO OPERARIO'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin-admin" className="space-y-4">
                <CardDescription>
                  Acceso para administradores del sistema
                </CardDescription>
                
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-nombre">Nombre</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-nombre"
                        name="nombre"
                        type="text"
                        required
                        placeholder="Administrador"
                        className="input-touch pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="admin-cedula">Cédula</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-cedula"
                        name="cedula"
                        type="text"
                        required
                        placeholder="12345678"
                        className="input-touch pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Contraseña</Label>
                    <Input
                      id="admin-password"
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="input-touch"
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full btn-touch font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      'INICIAR COMO ADMINISTRADOR'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Opción para registro (solo para admins crear nuevos usuarios) */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg">¿Nuevo usuario?</CardTitle>
            <CardDescription className="text-center">
              Solo administradores pueden crear nuevas cuentas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signup" className="w-full">
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-nombre">Nombre Completo</Label>
                    <Input
                      id="signup-nombre"
                      name="nombre"
                      type="text"
                      required
                      placeholder="Juan Pérez"
                      className="input-touch"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-cedula">Cédula</Label>
                    <Input
                      id="signup-cedula"
                      name="cedula"
                      type="text"
                      required
                      placeholder="12345678"
                      className="input-touch"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="input-touch"
                      minLength={6}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-tipo">Tipo de Usuario</Label>
                    <Select name="tipo_usuario" defaultValue="operario">
                      <SelectTrigger className="input-touch">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operario">Operario</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full btn-touch font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      'Crear Nuevo Usuario'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>© 2024 FabriLog Pro. Sistema optimizado para tablets.</p>
        </div>
      </div>
    </div>
  );
}