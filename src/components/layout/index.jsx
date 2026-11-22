import React, { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home, FileText, Users, ClipboardCheck, Menu, Route as RouteIcon, Wallet, BarChart3, LogOut, Sun, Moon,
  Scale, Loader2, ShieldAlert, UsersRound, Settings,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn, Button } from '../ui';

const MENU_ADMIN = [
  { to: '/app', label: 'Hoje', icon: Home, end: true },
  { to: '/app/emprestimos', label: 'Contratos', icon: FileText },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/conferencia', label: 'Conferência', icon: ClipboardCheck },
  { to: '/app/mais', label: 'Mais', icon: Menu, desktopHidden: true },
];
const MENU_ADMIN_DESKTOP_EXTRA = [
  { to: '/app/equipe', label: 'Equipe', icon: UsersRound },
  { to: '/app/configuracoes', label: 'Configurações', icon: Settings },
];

const MENU_COBRADOR = [
  { to: '/cobrador', label: 'Rota', icon: RouteIcon, end: true },
  { to: '/cobrador/clientes', label: 'Clientes', icon: Users },
  { to: '/cobrador/despesas', label: 'Despesas', icon: Wallet },
  { to: '/cobrador/dia', label: 'Meu dia', icon: BarChart3 },
];

export function ProtectedRoute({ children, role }) {
  const usuario = useAppStore((s) => s.usuarioAtual);
  if (!usuario) return <Navigate to="/login" replace />;
  if (role && usuario.role !== role) {
    const destino = { master: '/master', admin: '/app', cobrador: '/cobrador' }[usuario.role];
    return <Navigate to={destino || '/login'} replace />;
  }
  return children;
}

export function TelaCarregando() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-brand-secondary">
      <div className="w-14 h-14 rounded-2xl bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/30">
        <Scale className="text-white w-7 h-7" />
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
    </div>
  );
}

export function SemAcesso({ bloqueado, email }) {
  const logout = useAppStore((s) => s.logout);
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-brand-secondary">
      <div className="surface-card p-6 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold">{bloqueado ? 'Acesso bloqueado' : 'Sem acesso'}</h1>
        <p className="text-sm text-text-secondary mt-2">
          {bloqueado
            ? 'Seu acesso foi bloqueado pelo gestor. Fale com ele para liberar.'
            : <>O login <b>{email}</b> não está cadastrado em nenhuma empresa. Peça ao gestor para cadastrar você na Equipe.</>}
        </p>
        <Button className="mt-5" block variant="secondary" onClick={logout}>Sair e entrar com outra conta</Button>
      </div>
    </div>
  );
}

function AvisoSync() {
  const erro = useAppStore((s) => s.erroSync);
  if (!erro) return null;
  return (
    <div className="mb-4 rounded-xl bg-danger/10 text-danger text-sm font-medium px-4 py-3">
      {erro === 'sem-permissao'
        ? 'Seu login não tem permissão para ver os dados desta empresa. Saia e entre de novo; se continuar, fale com o gestor.'
        : 'Não foi possível sincronizar os dados. Verifique a internet.'}
    </div>
  );
}

function ItemLateral({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn(
        'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-semibold transition-colors',
        isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary',
      )}
    >
      <item.icon className="w-5 h-5" />
      {item.label}
    </NavLink>
  );
}

function Shell({ menu, menuDesktop = menu }) {
  const usuario = useAppStore((s) => s.usuarioAtual);
  const config = useAppStore((s) => s.config);
  const tema = useAppStore((s) => s.tema);
  const toggleTema = useAppStore((s) => s.toggleTema);
  const logout = useAppStore((s) => s.logout);
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); setMenuAberto(false); }, [location.pathname]);

  const nomeEmpresa = config?.nomeEmpresa || usuario?.tenantNome || 'Meu Jurista';

  return (
    <div className="min-h-dvh bg-brand-secondary lg:flex">
      {/* Lateral (computador) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-dvh sticky top-0 border-r border-border-subtle bg-brand-surface p-4">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center"><Scale className="text-white w-5 h-5" /></div>
          <span className="font-extrabold truncate">{nomeEmpresa}</span>
        </div>
        <nav className="flex-1 space-y-1">
          {menuDesktop.filter((i) => !i.desktopHidden).map((item) => <ItemLateral key={item.to} item={item} />)}
        </nav>
        <div className="border-t border-border-subtle pt-3 space-y-1">
          <div className="px-3 pb-2">
            <p className="text-sm font-bold truncate">{usuario?.nome}</p>
            <p className="text-xs text-text-muted capitalize">{usuario?.role === 'admin' ? 'Gestor' : usuario?.role}</p>
          </div>
          <button onClick={toggleTema} className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-brand-surface-2">
            {tema === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button onClick={logout} className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-semibold text-danger hover:bg-danger/10">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Topo (celular) */}
        <header className="lg:hidden sticky top-0 z-30 bg-brand-surface/90 backdrop-blur border-b border-border-subtle pt-[env(safe-area-inset-top)]">
          <div className="h-14 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center shrink-0"><Scale className="text-white w-4 h-4" /></div>
              <span className="font-extrabold truncate">{nomeEmpresa}</span>
            </div>
            <button
              onClick={() => setMenuAberto((v) => !v)}
              className="w-9 h-9 rounded-full bg-brand-surface-2 font-bold text-brand-primary flex items-center justify-center"
              aria-label="Conta"
            >
              {usuario?.nome?.charAt(0)?.toUpperCase()}
            </button>
          </div>
          {menuAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
              <div className="absolute right-3 top-14 z-20 w-56 surface-card shadow-xl p-1.5">
                <div className="px-3 py-2">
                  <p className="text-sm font-bold truncate">{usuario?.nome}</p>
                  <p className="text-xs text-text-muted truncate">{usuario?.email}</p>
                </div>
                <button onClick={toggleTema} className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold hover:bg-brand-surface-2">
                  {tema === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
                </button>
                <button onClick={logout} className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold text-danger hover:bg-danger/10">
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </div>
            </>
          )}
        </header>

        <main className="max-w-3xl mx-auto px-4 pt-4 pb-28 lg:pb-10 lg:pt-8">
          <AvisoSync />
          <Outlet />
        </main>

        {/* Barra inferior (celular) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-brand-surface/95 backdrop-blur border-t border-border-subtle pb-safe">
          <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${menu.length}, minmax(0, 1fr))` }}>
            {menu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-brand-primary' : 'text-text-muted',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('h-7 w-12 rounded-full flex items-center justify-center transition-colors', isActive && 'bg-brand-primary/12')}>
                      <item.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const cobradores = useAppStore((s) => s.cobradores);
  const limparSenhasLegadas = useAppStore((s) => s.limparSenhasLegadas);
  // Remove os hashes de senha antigos guardados no documento do cobrador.
  useEffect(() => {
    if (cobradores.some((c) => c.senha)) limparSenhasLegadas();
  }, [cobradores, limparSenhasLegadas]);

  return <Shell menu={MENU_ADMIN} menuDesktop={[...MENU_ADMIN, ...MENU_ADMIN_DESKTOP_EXTRA]} />;
}

export function CobradorLayout() {
  return <Shell menu={MENU_COBRADOR} />;
}
