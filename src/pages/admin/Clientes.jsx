import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Users, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useContratos, ordenarClientes, ORDENS_CLIENTE } from '../../hooks/useCarteira';
import { PageHeader, SearchInput, Card, Empty, Button, Badge, Chips, Select } from '../../components/ui';
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
    || (c.endereco?.bairro || '').toLowerCase().includes(t)
    || (c.endereco?.rua || '').toLowerCase().includes(t));
};

export default function Clientes() {
  const navigate = useNavigate();
  const resumo = useResumoClientes();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [novo, setNovo] = useState(false);
  const [abrirFiltros, setAbrirFiltros] = useState(false);
  const [ordem, setOrdem] = useState('az');
  const [bairro, setBairro] = useState('');
  const [letra, setLetra] = useState('');

  const bairros = useMemo(() => [...new Set(resumo.map((c) => (c.endereco?.bairro || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), [resumo]);
  const letras = useMemo(() => [...new Set(resumo.map((c) => (c.nome || '').trim().charAt(0).toUpperCase()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [resumo]);

  const lista = ordenarClientes(
    filtrarClientes(resumo, busca)
      .filter((c) => (filtro === 'ativos' ? c.ativos > 0 : filtro === 'semContrato' ? c.ativos === 0 : filtro === 'atrasados' ? c.atrasado : true))
      .filter((c) => !bairro || (c.endereco?.bairro || '').trim() === bairro)
      .filter((c) => !letra || (c.nome || '').trim().charAt(0).toUpperCase() === letra),
    ordem,
  );
  const filtrosAtivos = [ordem !== 'az', bairro].filter(Boolean).length;

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${resumo.length} cadastrado(s)`} actions={<Button size="sm" onClick={() => setNovo(true)}><UserPlus className="w-4 h-4" /> Novo</Button>} />
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <SearchInput value={busca} onChange={setBusca} placeholder="Nome, CPF, telefone, rua ou bairro" className="flex-1" />
          <Button variant={filtrosAtivos ? 'primary' : 'outline'} className="h-11 px-3 shrink-0" onClick={() => setAbrirFiltros((v) => !v)} aria-label="Filtros">
            <SlidersHorizontal className="w-5 h-5" />{filtrosAtivos ? <span className="text-sm">{filtrosAtivos}</span> : null}
          </Button>
        </div>
        <Chips value={filtro} onChange={setFiltro} options={[
          { value: 'todos', label: 'Todos', count: resumo.length },
          { value: 'ativos', label: 'Com contrato ativo', count: resumo.filter((c) => c.ativos > 0).length },
          { value: 'atrasados', label: 'Em atraso', count: resumo.filter((c) => c.atrasado).length, alert: true },
          { value: 'semContrato', label: 'Sem contrato', count: resumo.filter((c) => c.ativos === 0).length },
        ]} />
        {abrirFiltros && (
          <Card className="p-3.5 space-y-3">
            <Select label="Ordenar por" value={ordem} onChange={(e) => setOrdem(e.target.value)} options={ORDENS_CLIENTE} />
            {bairros.length > 0 && (
              <Select label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)}>
                <option value="">Todos os bairros</option>
                {bairros.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            )}
            {filtrosAtivos > 0 && <Button variant="ghost" size="sm" block onClick={() => { setOrdem('az'); setBairro(''); }}>Limpar filtros</Button>}
          </Card>
        )}
        {letras.length > 3 && (
          <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4">
            {letras.map((l) => (
              <button key={l} type="button" onClick={() => setLetra((x) => (x === l ? '' : l))}
                className={`shrink-0 w-8 h-8 rounded-lg text-[13px] font-bold ${letra === l ? 'bg-text-primary text-brand-surface' : 'bg-brand-surface border border-border-subtle text-text-secondary'}`}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {lista.length === 0 ? (
        <Card><Empty icon={<Users className="w-6 h-6" />} title={resumo.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'} action={<Button onClick={() => setNovo(true)}>Cadastrar cliente</Button>} /></Card>
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
