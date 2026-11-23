import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { linkContrato } from '../../domain/emprestimo';
import { useContratos, ordenarContratos, ORDENS_CONTRATO } from '../../hooks/useCarteira';
import { PageHeader, SearchInput, Chips, Select, Card, Empty, Button } from '../../components/ui';
import ContratoCard from '../../components/ContratoCard';
import { formatCurrency } from '../../utils/formatters';

const FILTROS = {
  cobrar: (c) => c.status === 'atrasado' || c.venceHoje,
  atrasados: (c) => c.status === 'atrasado',
  hoje: (c) => c.venceHoje && c.status !== 'atrasado',
  emdia: (c) => c.status === 'ativo' && !c.venceHoje,
  quitados: (c) => c.status === 'pago',
  todos: () => true,
};

const FAIXAS_ATRASO = {
  '': () => true,
  '1-7': (c) => c.status === 'atrasado' && c.diasAtraso <= 7,
  '8-30': (c) => c.status === 'atrasado' && c.diasAtraso > 7 && c.diasAtraso <= 30,
  '31-90': (c) => c.status === 'atrasado' && c.diasAtraso > 30 && c.diasAtraso <= 90,
  '90+': (c) => c.status === 'atrasado' && c.diasAtraso > 90,
};

/** Busca que entende nome, CPF, telefone, bairro, rua, nº do contrato e item do aluguel. */
export const buscarContrato = (c, busca) => {
  if (!busca) return true;
  const t = busca.toLowerCase().trim();
  const nums = busca.replace(/\D/g, '');
  const cl = c.cliente || {};
  return (cl.nome || '').toLowerCase().includes(t)
    || (nums.length >= 3 && ((cl.cpfCnpj || '').replace(/\D/g, '').includes(nums) || (cl.telefone || '').replace(/\D/g, '').includes(nums)))
    || (cl.endereco?.bairro || '').toLowerCase().includes(t)
    || (cl.endereco?.rua || '').toLowerCase().includes(t)
    || (c.itemDescricao || '').toLowerCase().includes(t)
    || c.id.toLowerCase().startsWith(t);
};

export default function Emprestimos() {
  const config = useAppStore((s) => s.config);
  const cobradores = useAppStore((s) => s.cobradores);
  const contratos = useContratos();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [abrirFiltros, setAbrirFiltros] = useState(false);

  const filtro = FILTROS[params.get('f')] ? params.get('f') : 'cobrar';
  const ordem = params.get('o') || (filtro === 'quitados' || filtro === 'todos' ? 'recentes' : 'cobranca');
  const tipo = params.get('m') || '';
  const cobrador = params.get('c') || '';
  const atraso = FAIXAS_ATRASO[params.get('a')] ? params.get('a') : '';
  const mudar = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const filtrosAtivos = [params.get('o'), tipo, cobrador, atraso].filter(Boolean).length;

  const base = useMemo(() => contratos.filter((c) => {
    if (c.modalidade === 'aluguel') return false; // aluguéis têm aba própria
    if (tipo && (tipo === 'parcelado' ? c.modalidade !== 'parcelado' : c.modalidade === 'parcelado')) return false;
    if (cobrador === '_gestor' ? !!c.cobrador : cobrador && c.cobrador?.id !== cobrador) return false;
    if (!FAIXAS_ATRASO[atraso](c)) return false;
    return buscarContrato(c, busca);
  }), [contratos, busca, cobrador, tipo, atraso]);

  const lista = useMemo(() => ordenarContratos(base.filter(FILTROS[filtro]), ordem), [base, filtro, ordem]);
  const n = (f) => base.filter(FILTROS[f]).length;
  const totalLista = lista.reduce((s, c) => s + (c.status === 'pago' ? 0 : c.devido.total), 0);

  return (
    <div>
      <PageHeader title="Contratos" subtitle={`${lista.length} contrato(s)${filtro !== 'quitados' ? ` · ${formatCurrency(totalLista)} a cobrar` : ''}`} />
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <SearchInput value={busca} onChange={setBusca} placeholder="Nome, CPF, telefone, rua, bairro…" className="flex-1" />
          <Button variant={filtrosAtivos ? 'primary' : 'outline'} className="h-11 px-3 shrink-0" onClick={() => setAbrirFiltros((v) => !v)} aria-label="Filtros">
            <SlidersHorizontal className="w-5 h-5" />{filtrosAtivos ? <span className="text-sm">{filtrosAtivos}</span> : null}
          </Button>
        </div>
        <Chips
          value={filtro}
          onChange={(f) => mudar('f', f)}
          options={[
            { value: 'cobrar', label: 'A cobrar', count: n('cobrar'), alert: true },
            { value: 'atrasados', label: 'Atrasados', count: n('atrasados'), alert: true },
            { value: 'hoje', label: 'Vencem hoje', count: n('hoje') },
            { value: 'emdia', label: 'Em dia', count: n('emdia') },
            { value: 'quitados', label: 'Quitados', count: n('quitados') },
            { value: 'todos', label: 'Todos', count: n('todos') },
          ]}
        />
        {abrirFiltros && (
          <Card className="p-3.5 space-y-3">
            <Select label="Ordenar por" value={ordem} onChange={(e) => mudar('o', e.target.value)} options={ORDENS_CONTRATO} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tipo" value={tipo} onChange={(e) => mudar('m', e.target.value)}>
                <option value="">Todos</option>
                <option value="parcelado">Parcelado</option>
                <option value="tradicional">Juros</option>
              </Select>
              <Select label="Atraso" value={atraso} onChange={(e) => mudar('a', e.target.value)}>
                <option value="">Qualquer</option>
                <option value="1-7">Até 7 dias</option>
                <option value="8-30">8 a 30 dias</option>
                <option value="31-90">31 a 90 dias</option>
                <option value="90+">Mais de 90 dias</option>
              </Select>
            </div>
            {cobradores.length > 0 && (
              <Select label="Cobrador" value={cobrador} onChange={(e) => mudar('c', e.target.value)}>
                <option value="">Todos os cobradores</option>
                <option value="_gestor">Sem cobrador (gestor)</option>
                {cobradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            )}
            {filtrosAtivos > 0 && (
              <Button variant="ghost" size="sm" block onClick={() => {
                const p = new URLSearchParams(params); ['o', 'm', 'c', 'a'].forEach((k) => p.delete(k)); setParams(p, { replace: true });
              }}>Limpar filtros</Button>
            )}
          </Card>
        )}
      </div>

      {lista.length === 0 ? (
        <Card><Empty icon={<FileText className="w-6 h-6" />} title="Nenhum contrato aqui" text={filtro === 'cobrar' && !filtrosAtivos && !busca ? 'Nada atrasado ou vencendo hoje.' : 'Tente outro filtro ou busca.'} /></Card>
      ) : (
        <div className="space-y-2">
          {lista.map((c) => <ContratoCard key={c.id} contrato={c} to={linkContrato(c)} config={config} mostrarCobrador />)}
        </div>
      )}
    </div>
  );
}
