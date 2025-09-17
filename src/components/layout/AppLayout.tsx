import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Settings, 
  BarChart3, 
  FileText, 
  Users, 
  LogOut,
  Factory,
  Target,
  Package,
  TrendingUp
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: BarChart3, 
      roles: ['operario', 'admin'] 
    },
    { 
      name: 'Registro Producción', 
      href: '/registro', 
      icon: FileText, 
      roles: ['operario', 'admin'] 
    },
    { 
      name: 'Métricas', 
      href: '/metricas', 
      icon: TrendingUp, 
      roles: ['admin'] 
    },
    { 
      name: 'Admin Máquinas y Productos', 
      href: '/admin/maquinas-productos', 
      icon: Settings, 
      roles: ['admin'] 
    },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.tipo_usuario || 'operario')
  );

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background"> 
      {/* Header */}
      <header className="bg-card border-b border-border shadow-[var(--shadow-card)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Factory className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold text-foreground">FabriLog Pro</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{user?.nombre}</span>
                <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium capitalize">
                  {user?.tipo_usuario}
                </span>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="btn-touch text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout*/ }
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar Navigation*/ }
        <nav className="w-64 bg-card border-r border-border shadow-[var(--shadow-card)] flex-shrink-0">
          <div className="p-4 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.name} to={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full justify-start btn-touch ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-[var(--shadow-button)]' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  ); 
}