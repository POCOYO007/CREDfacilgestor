import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Users, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useContratos } from '../../hooks/useCarteira';
import { PageHeader, SearchInput, Card, Empty, Button, Badge, Chips } from '../../components/ui';
import ClienteForm from '../../components/ClienteForm';
import { formatCurrency } from '../../utils/formatters';

/** Resumo por cliente: contratos ativos, devido, atraso. */
export function useResumoClientes() {
  const clientes = useAppStore((s) => s.clientes);
  const contratos = useContratos();
  return useMemo(() => clientes.map((cl) => {
    const meus = contratos.filter((c) => c.clienteId === cl.id);
    const ativos = meus.filter((c) => c.status !== 'pago');
    return {
      ...cl,
      ativos: ativos.length,
      atrasado: ativos.some((c) => c.status === 'atrasado'),
      devido: ativos.reduce((s, c) => s + c.devido.total, 0),
      saldo: ativos.reduce((s, c) => s + c.saldo, 0),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })), [clientes, contratos]);
}

export const filtrarClientes = (lista, busca) => {
  if (!busca) return lista;
  const t = busca.toLowerCase();
  const nums = busca.replace(/\D/g, '');
  return lista.filter((c) => (c.nome || '').toLowerCase().includes(t)
    || (nums && ((c.cpfCnpj || '').replace(/\D/g, '').includes(nums) || (c.telefone || '').replace(/\D/g, '').includes(nums)))
    || (c.endereco?.bairro || '').toLowerCase().includes(t));
};

export default function Clientes() {
  const navigate = useNavigate();
  const resumo = useResumoClientes();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [novo, setNovo] = useState(false);

  const lista = filtrarClientes(resumo, busca).filter((c) => (filtro === 'ativos' ? c.ativos > 0 : filtro === 'atrasados' ? c.atrasado : true));

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${resumo.length} cadastrado(s)`} actions={<Button size="sm" onClick={() => setNovo(true)}><UserPlus className="w-4 h-4" /> Novo</Button>} />
      <div className="space-y-3 mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Nome, CPF, telefone ou bairro" />
        <Chips value={filtro} onChange={setFiltro} options={[
          { value: 'todos', label: 'Todos', count: resumo.length },
          { value: 'ativos', label: 'Com contrato ativo', count: resumo.filter((c) => c.ativos > 0).length },
          { value: 'atrasados', label: 'Em atraso', count: resumo.filter((c) => c.atrasado).length, alert: true },
        ]} />
      </div>

      {lista.length === 0 ? (
        <Card><Empty icon={<Users className="w-6 h-6" />} title={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'} action={<Button onClick={() => setNovo(true)}>Cadastrar cliente</Button>} /></Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {lista.map((c) => (
            <Link key={c.id} to={`/app/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-brand-surface-2">
              <div className="w-10 h-10 rounded-full bg-brand-surface-2 flex items-center justify-center font-bold text-text-secondary shrink-0">{c.nome?.charAt(0)?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.nome}</p>
                <p className="text-[12px] text-text-secondary truncate">{[c.telefone, c.endereco?.bairro].filter(Boolean).join(' · ') || 'Sem contato'}</p>
              </div>
              <div className="text-right shrink-0">
                {c.ativos > 0 ? (
                  <>
                    <p className="font-bold tabular-nums text-sm">{formatCurrency(c.saldo)}</p>
                    {c.atrasado ? <Badge variant="danger">Atraso</Badge> : <p className="text-[12px] text-text-muted">{c.ativos} ativo(s)</p>}
                  </>
                ) : <p className="text-[12px] text-text-muted">sem contrato</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted -mr-1" />
            </Link>
          ))}
        </Card>
      )}

      <ClienteForm isOpen={novo} onClose={() => setNovo(false)} onSalvo={(id) => id && navigate(`/app/clientes/${id}`)} />
    </div>
  );
}
