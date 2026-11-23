import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Plus, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useContratos, ordenarContratos, ORDENS_CONTRATO } from '../../hooks/useCarteira';
import { PageHeader, SearchInput, Chips, Card, Empty, Button, Select } from '../../components/ui';
import ContratoCard from '../../components/ContratoCard';
import AluguelForm from '../../components/AluguelForm';
import { num, linkContrato, TIPOS_ITEM_ALUGUEL } from '../../domain/emprestimo';
import { buscarContrato } from './Emprestimos';
import { formatCurrency } from '../../utils/formatters';

const FILTROS = {
  cobrar: (c) => c.status === 'atrasado' || c.venceHoje,
  atrasados: (c) => c.status === 'atrasado',
  ativos: (c) => c.status !== 'pago',
  encerrados: (c) => c.status === 'pago',
  todos: () => true,
};

export default function Alugueis() {
  const navigate = useNavigate();
  const config = useAppStore((s) => s.config);
  const contratos = useContratos();
  const [params, setParams] = useSearchParams();
  const filtro = FILTROS[params.get('f')] ? params.get('f') : 'ativos';
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const cobradores = useAppStore((s) => s.cobradores);
  const [abrirFiltros, setAbrirFiltros] = useState(false);
  const ordem = params.get('o') || (filtro === 'encerrados' || filtro === 'todos' ? 'recentes' : 'cobranca');
  const item = params.get('i') || '';
  const cobrador = params.get('c') || '';
  const mudar = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const filtrosAtivos = [params.get('o'), item, cobrador].filter(Boolean).length;

  const alugueis = useMemo(() => contratos.filter((c) => c.modalidade === 'aluguel'), [contratos]);
  const base = useMemo(() => alugueis.filter((c) => {
    if (item && (c.itemTipo || 'outro') !== item) return false;
    if (cobrador === '_gestor' ? !!c.cobrador : cobrador && c.cobrador?.id !== cobrador) return false;
    return buscarContrato(c, busca);
  }), [alugueis, busca, item, cobrador]);

  const lista = useMemo(() => ordenarContratos(base.filter(FILTROS[filtro]), ordem), [base, filtro, ordem]);

  const n = (f) => base.filter(FILTROS[f]).length;
  const ativos = alugueis.filter((c) => c.status !== 'pago');
  const emAberto = ativos.reduce((s, c) => s + c.devido.total, 0);
  const porMes = ativos.reduce((s, c) => {
    const fator = { diario: 30, semanal: 30 / 7, quinzenal: 2, mensal: 1, dia_especifico: 1 }[c.frequencia] || 1;
    return s + num(c.valorParcela) * fator;
  }, 0);

  return (
    <div>
      <PageHeader
        title="Aluguéis"
        subtitle={`${ativos.length} ativo(s) · ~${formatCurrency(porMes)}/mês`}
        actions={<Button size="sm" onClick={() => setNovo(true)}><Plus className="w-4 h-4" /> Novo</Button>}
      />
      {emAberto > 0 && (
        <p className="text-sm text-text-secondary -mt-2 mb-3">Em aberto agora: <b className="text-danger">{formatCurrency(emAberto)}</b></p>
      )}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <SearchInput value={busca} onChange={setBusca} placeholder="Cliente, carro, moto, placa…" className="flex-1" />
          <Button variant={filtrosAtivos ? 'primary' : 'outline'} className="h-11 px-3 shrink-0" onClick={() => setAbrirFiltros((v) => !v)} aria-label="Filtros">
            <SlidersHorizontal className="w-5 h-5" />{filtrosAtivos ? <span className="text-sm">{filtrosAtivos}</span> : null}
          </Button>
        </div>
        <Chips
          value={filtro}
          onChange={(f) => mudar('f', f)}
          options={[
            { value: 'ativos', label: 'Ativos', count: n('ativos') },
            { value: 'cobrar', label: 'A cobrar', count: n('cobrar'), alert: true },
            { value: 'atrasados', label: 'Atrasados', count: n('atrasados'), alert: true },
            { value: 'encerrados', label: 'Encerrados', count: n('encerrados') },
            { value: 'todos', label: 'Todos', count: n('todos') },
          ]}
        />
        {abrirFiltros && (
          <Card className="p-3.5 space-y-3">
            <Select label="Ordenar por" value={ordem} onChange={(e) => mudar('o', e.target.value)} options={ORDENS_CONTRATO} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Item" value={item} onChange={(e) => mudar('i', e.target.value)}>
                <option value="">Todos</option>
                {TIPOS_ITEM_ALUGUEL.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              <Select label="Cobrador" value={cobrador} onChange={(e) => mudar('c', e.target.value)}>
                <option value="">Todos</option>
                <option value="_gestor">Gestor</option>
                {cobradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </div>
            {filtrosAtivos > 0 && (
              <Button variant="ghost" size="sm" block onClick={() => { const p = new URLSearchParams(params); ['o', 'i', 'c'].forEach((k) => p.delete(k)); setParams(p, { replace: true }); }}>Limpar filtros</Button>
            )}
          </Card>
        )}
      </div>

      {lista.length === 0 ? (
        <Card>
          <Empty
            icon={<KeyRound className="w-6 h-6" />}
            title={alugueis.length ? 'Nenhum aluguel neste filtro' : 'Nenhum aluguel ainda'}
            text={alugueis.length ? undefined : 'Cadastre aluguel de carro, moto, casa ou o que quiser.'}
            action={<Button onClick={() => setNovo(true)}>Novo aluguel</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((c) => <ContratoCard key={c.id} contrato={c} to={linkContrato(c)} config={config} />)}
        </div>
      )}

      <AluguelForm isOpen={novo} onClose={() => setNovo(false)} onCriado={(e) => e.id && navigate(linkContrato(e))} />
    </div>
  );
}
