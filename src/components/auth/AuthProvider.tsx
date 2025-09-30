import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Usuario {
  id: string;
  nombre: string;
  cedula: string;
  tipo_usuario: 'operario' | 'admin' | 'escribano';
  activo: boolean;
}

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  signIn: (cedula: string, password: string) => Promise<{ error: any }>;
  signUp: (nombre: string, cedula: string, password: string, tipo_usuario?: 'operario' | 'admin' | 'escribano') => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem('fabrilog_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (error) {
        localStorage.removeItem('fabrilog_user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (cedula: string, password: string) => {
    try {
      setLoading(true);
      
      // Call secure Edge Function for authentication
      const { data: responseData, error: functionError } = await supabase.functions.invoke('auth-login', {
        body: { cedula, password }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        return { error: { message: 'Error al iniciar sesión' } };
      }

      if (responseData?.error) {
        return { error: { message: responseData.error } };
      }

      if (!responseData?.user) {
        return { error: { message: 'Respuesta inválida del servidor' } };
      }

      // Store user session
      const userSession = responseData.user;
      
      localStorage.setItem('fabrilog_user', JSON.stringify(userSession));
      setUser(userSession);
      
      toast({
        title: "Bienvenido",
        description: `Hola ${userSession.nombre}!`,
      });
      
      // Redirigir según el tipo de usuario
      if (userSession.tipo_usuario === 'escribano') {
        setTimeout(() => window.location.href = '/registro', 100);
      }
      
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: { message: 'Error al iniciar sesión' } };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (nombre: string, cedula: string, password: string, tipo_usuario: 'operario' | 'admin' | 'escribano' = 'operario') => {
    try {
      setLoading(true);
      
      // Call secure Edge Function for user registration
      const { data: responseData, error: functionError } = await supabase.functions.invoke('auth-signup', {
        body: { nombre, cedula, password, tipo_usuario }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        return { error: { message: 'Error al registrar usuario' } };
      }

      if (responseData?.error) {
        return { error: { message: responseData.error } };
      }
      
      toast({
        title: "Registro exitoso",
        description: "Usuario creado correctamente. Ya puedes iniciar sesión.",
      });
      
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: { message: 'Error al registrar usuario' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('fabrilog_user');
    setUser(null);
    return { error: null };
  };

  const isAdmin = user?.tipo_usuario === 'admin';

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}