import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useContratos, ordemDeCobranca } from '../../hooks/useCarteira';
import { PageHeader, SearchInput, Chips, Select, Card, Empty } from '../../components/ui';
import ContratoCard from '../../components/ContratoCard';
import { parseData } from '../../domain/emprestimo';
import { formatCurrency } from '../../utils/formatters';

const FILTROS = {
  cobrar: (c) => c.status === 'atrasado' || c.venceHoje,
  atrasados: (c) => c.status === 'atrasado',
  hoje: (c) => c.venceHoje && c.status !== 'atrasado',
  emdia: (c) => c.status === 'ativo' && !c.venceHoje,
  quitados: (c) => c.status === 'pago',
  todos: () => true,
};

export default function Emprestimos() {
  const config = useAppStore((s) => s.config);
  const cobradores = useAppStore((s) => s.cobradores);
  const contratos = useContratos();
  const [params, setParams] = useSearchParams();
  const filtro = FILTROS[params.get('f')] ? params.get('f') : 'cobrar';
  const [busca, setBusca] = useState('');
  const [cobrador, setCobrador] = useState('');

  const base = useMemo(() => contratos.filter((c) => {
    if (cobrador === '_gestor' ? !!c.cobrador : cobrador && c.cobrador?.id !== cobrador) return false;
    if (!busca) return true;
    const t = busca.toLowerCase();
    return c.cliente?.nome?.toLowerCase().includes(t)
      || (c.cliente?.cpfCnpj || '').includes(busca)
      || c.cliente?.endereco?.bairro?.toLowerCase().includes(t)
      || c.id.toLowerCase().startsWith(t);
  }), [contratos, busca, cobrador]);

  const lista = useMemo(() => {
    const l = base.filter(FILTROS[filtro]);
    if (filtro === 'quitados' || filtro === 'todos') return l.sort((a, b) => (parseData(b.criadoEm) || 0) - (parseData(a.criadoEm) || 0));
    return l.sort(ordemDeCobranca);
  }, [base, filtro]);

  const n = (f) => base.filter(FILTROS[f]).length;
  const totalLista = lista.reduce((s, c) => s + (c.status === 'pago' ? 0 : c.devido.total), 0);

  return (
    <div>
      <PageHeader title="Contratos" subtitle={`${lista.length} contrato(s)${filtro !== 'quitados' ? ` · ${formatCurrency(totalLista)} a cobrar` : ''}`} />
      <div className="space-y-3 mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Cliente, CPF, bairro ou nº" />
        <Chips
          value={filtro}
          onChange={(f) => setParams({ f }, { replace: true })}
          options={[
            { value: 'cobrar', label: 'A cobrar', count: n('cobrar'), alert: true },
            { value: 'atrasados', label: 'Atrasados', count: n('atrasados'), alert: true },
            { value: 'hoje', label: 'Vencem hoje', count: n('hoje') },
            { value: 'emdia', label: 'Em dia', count: n('emdia') },
            { value: 'quitados', label: 'Quitados', count: n('quitados') },
            { value: 'todos', label: 'Todos' },
          ]}
        />
        {cobradores.length > 0 && (
          <Select value={cobrador} onChange={(e) => setCobrador(e.target.value)}>
            <option value="">Todos os cobradores</option>
            <option value="_gestor">Sem cobrador (gestor)</option>
            {cobradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        )}
      </div>

      {lista.length === 0 ? (
        <Card><Empty icon={<FileText className="w-6 h-6" />} title="Nenhum contrato aqui" text={filtro === 'cobrar' ? 'Nada atrasado ou vencendo hoje.' : 'Tente outro filtro.'} /></Card>
      ) : (
        <div className="space-y-2">
          {lista.map((c) => <ContratoCard key={c.id} contrato={c} to={`/app/emprestimos/${c.id}`} config={config} mostrarCobrador />)}
        </div>
      )}
    </div>
  );
}
