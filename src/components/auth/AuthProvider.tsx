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
      
      // Query user by cedula
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('cedula', cedula)
        .eq('activo', true)
        .single();
      
      if (userError || !userData) {
        return { error: { message: 'Usuario no encontrado o inactivo' } };
      }
      
      // Verificar que solo admin y escribano pueden acceder
      if (userData.tipo_usuario === 'operario') {
        await signOut(); // Cerrar sesión inmediatamente
        return { error: { message: 'Acceso solo para administradores y escribanos' } };
      }
      
      // For now, we'll use a simple password check
      // In production, you should use proper password hashing
      if (userData.password_hash !== password) {
        return { error: { message: 'Contraseña incorrecta' } };
      }
      
      // Store user session
      const userSession = {
        id: userData.id,
        nombre: userData.nombre,
        cedula: userData.cedula,
        tipo_usuario: userData.tipo_usuario,
        activo: userData.activo
      };
      
      localStorage.setItem('fabrilog_user', JSON.stringify(userSession));
      setUser(userSession);
      
      toast({
        title: "Bienvenido",
        description: `Hola ${userData.nombre}!`,
      });
      
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
      
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id')
        .eq('cedula', cedula)
        .single();
      
      if (existingUser) {
        return { error: { message: 'Ya existe un usuario con esta cédula' } };
      }
      
      // Create new user
      const { data: newUser, error } = await supabase
        .from('usuarios')
        .insert({
          nombre,
          cedula,
          password_hash: password, // In production, hash this properly
          tipo_usuario,
          activo: true
        })
        .select()
        .single();
      
      if (error) {
        return { error };
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