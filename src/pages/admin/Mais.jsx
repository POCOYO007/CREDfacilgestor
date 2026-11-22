import React from 'react';
import { Link } from 'react-router-dom';
import { UsersRound, Settings, ClipboardCheck, ChevronRight, Sun, Moon, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader, Card } from '../../components/ui';

export default function Mais() {
  const tema = useAppStore((s) => s.tema);
  const toggleTema = useAppStore((s) => s.toggleTema);
  const logout = useAppStore((s) => s.logout);
  const usuario = useAppStore((s) => s.usuarioAtual);
  const cobradores = useAppStore((s) => s.cobradores);

  const itens = [
    { to: '/app/equipe', icon: UsersRound, label: 'Equipe', hint: `${cobradores.length} cobrador(es) · acessos e acerto` },
    { to: '/app/conferencia', icon: ClipboardCheck, label: 'Conferência', hint: 'Recebido e despesas por dia' },
    { to: '/app/configuracoes', icon: Settings, label: 'Configurações', hint: 'Empresa, padrões e mensagens' },
  ];

  return (
    <div>
      <PageHeader title="Mais" subtitle={usuario?.email} />
      <Card className="divide-y divide-border-subtle">
        {itens.map((i) => (
          <Link key={i.to} to={i.to} className="flex items-center gap-3 px-4 py-3.5 active:bg-brand-surface-2">
            <div className="w-10 h-10 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary"><i.icon className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0"><p className="font-semibold">{i.label}</p><p className="text-[12px] text-text-secondary truncate">{i.hint}</p></div>
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </Link>
        ))}
      </Card>
      <Card className="divide-y divide-border-subtle mt-4">
        <button onClick={toggleTema} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <div className="w-10 h-10 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary">{tema === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</div>
          <span className="font-semibold">{tema === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-danger">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center"><LogOut className="w-5 h-5" /></div>
          <span className="font-semibold">Sair</span>
        </button>
      </Card>
    </div>
  );
}
