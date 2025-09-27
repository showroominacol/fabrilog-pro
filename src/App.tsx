import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RegistroProduccion from "./pages/RegistroProduccion";
import AdminMaquinasProductos from "./pages/AdminMaquinasProductos";
import Metricas from "./pages/Metricas";
import ConsultaCumplimiento from "./pages/ConsultaCumplimiento";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/auth" 
        element={user ? <Navigate to="/dashboard" replace /> : <Auth />} 
      />
      <Route 
        path="/" 
        element={user ? (
          user.tipo_usuario === 'escribano' ? <Navigate to="/registro" replace /> : <Navigate to="/dashboard" replace />
        ) : <Navigate to="/consulta-cumplimiento" replace />} 
      />
      <Route 
        path="/consulta-cumplimiento" 
        element={<ConsultaCumplimiento />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {user?.tipo_usuario === 'escribano' ? <Navigate to="/registro" replace /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/registro" 
        element={
          <ProtectedRoute>
            <RegistroProduccion />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/maquinas-productos" 
        element={
          <ProtectedRoute>
            <AdminMaquinasProductos />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/metricas" 
        element={
          <ProtectedRoute>
            <Metricas />
          </ProtectedRoute>
        } 
      />
      {/* TODO: Add admin routes */}
      {/*
      <Route 
        path="/metas" 
        element={
          <ProtectedRoute>
            <Metas />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/maquinas" 
        element={
          <ProtectedRoute>
            <Maquinas />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/productos" 
        element={
          <ProtectedRoute>
            <Productos />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/usuarios" 
        element={
          <ProtectedRoute>
            <Usuarios />
          </ProtectedRoute>
        } 
      />
      */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;