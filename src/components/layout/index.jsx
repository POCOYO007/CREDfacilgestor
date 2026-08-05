import React, { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  LayoutDashboard, 
  Users, 
  HandCoins, 
  UsersRound, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '../ui';

export function ProtectedRoute({ children, role }) {
  const usuarioAtual = useAppStore(state => state.usuarioAtual);
  
  if (!usuarioAtual) return <Navigate to="/login" />;
  if (role && usuarioAtual.role !== role) {
    if (usuarioAtual.role === 'master') return <Navigate to="/master" />;
    if (usuarioAtual.role === 'admin') return <Navigate to="/app" />;
    if (usuarioAtual.role === 'cobrador') return <Navigate to="/cobrador" />;
  }
  
  return children;
}

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const logout = useAppStore(state => state.logout);
  const tema = useAppStore(state => state.tema);
  const toggleTema = useAppStore(state => state.toggleTema);
  const usuarioAtual = useAppStore(state => state.usuarioAtual);
  const config = useAppStore(state => state.config);
  const navigate = useNavigate();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app' },
    { icon: Users, label: 'Clientes', path: '/app/clientes' },
    { icon: HandCoins, label: 'Empréstimos', path: '/app/emprestimos' },
    { icon: UsersRound, label: 'Equipe', path: '/app/equipe' },
    { icon: Settings, label: 'Configurações', path: '/app/configuracoes' },
  ];

  return (
    <div className="min-h-screen flex bg-brand-secondary">
      {/* Sidebar */}
      <aside className={cn(
        "glass border-r border-border-subtle transition-all duration-300 flex flex-col z-40 fixed inset-y-0 left-0 lg:relative",
        isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none"
      )}>
        <div className="p-6 flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-linear-to-br from-brand-primary to-[#FF8C42] flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <HandCoins className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">{config.nomeEmpresa}</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group whitespace-nowrap",
                window.location.pathname === item.path 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                  : "text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border-subtle space-y-2">
          <button 
            onClick={toggleTema}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary transition-all whitespace-nowrap"
          >
            {tema === 'dark' ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            <span className="font-medium">{tema === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
          </button>

          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger hover:bg-danger/10 transition-all whitespace-nowrap"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 glass border-b border-border-subtle flex items-center justify-between px-4 lg:px-8 z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-brand-surface-2 transition-colors text-text-secondary hover:text-text-primary"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{usuarioAtual?.nome}</p>
              <p className="text-xs text-text-muted capitalize">{usuarioAtual?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-border-subtle flex items-center justify-center font-bold text-brand-primary">
              {usuarioAtual?.nome?.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function CobradorLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const logout = useAppStore(state => state.logout);
  const tema = useAppStore(state => state.tema);
  const toggleTema = useAppStore(state => state.toggleTema);
  const usuarioAtual = useAppStore(state => state.usuarioAtual);
  const navigate = useNavigate();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Início', path: '/cobrador' },
    { icon: ChevronRight, label: 'Minha Rota', path: '/cobrador/rota', rotate: true },
    { icon: Users, label: 'Clientes', path: '/cobrador/clientes' },
    { icon: HandCoins, label: 'Despesas', path: '/cobrador/despesas' },
  ];

  return (
    <div className="min-h-screen flex bg-brand-secondary">
      {/* Sidebar for Cobrador */}
      <aside className={cn(
        "glass border-r border-border-subtle transition-all duration-300 flex flex-col z-40 fixed inset-y-0 left-0 lg:relative",
        isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none"
      )}>
        <div className="p-6 flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-linear-to-br from-brand-primary to-[#FF8C42] flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <HandCoins className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">CredFácil</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group whitespace-nowrap",
                window.location.pathname === item.path 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                  : "text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", item.rotate && "rotate-90")} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border-subtle space-y-2">
          <button 
            onClick={toggleTema}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary transition-all whitespace-nowrap"
          >
            {tema === 'dark' ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            <span className="font-medium">{tema === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
          </button>

          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger hover:bg-danger/10 transition-all whitespace-nowrap"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 glass border-b border-border-subtle flex items-center justify-between px-4 lg:px-8 z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-brand-surface-2 transition-colors text-text-secondary hover:text-text-primary"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{usuarioAtual?.nome}</p>
              <p className="text-xs text-text-muted capitalize">{usuarioAtual?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-border-subtle flex items-center justify-center font-bold text-brand-primary">
              {usuarioAtual?.nome?.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
