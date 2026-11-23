import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { linkContrato } from '../../domain/emprestimo';
import { useContratos, ordemDeCobranca } from '../../hooks/useCarteira';
import { PageHeader, SearchInput, Chips, Card, Empty, Button } from '../../components/ui';
import ContratoCard from '../../components/ContratoCard';
import AluguelForm from '../../components/AluguelForm';
import { parseData, num } from '../../domain/emprestimo';
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

  const alugueis = useMemo(() => contratos.filter((c) => c.modalidade === 'aluguel'), [contratos]);
  const base = useMemo(() => {
    if (!busca) return alugueis;
    const t = busca.toLowerCase();
    return alugueis.filter((c) => c.cliente?.nome?.toLowerCase().includes(t) || (c.itemDescricao || '').toLowerCase().includes(t));
  }, [alugueis, busca]);

  const lista = useMemo(() => {
    const l = base.filter(FILTROS[filtro]);
    if (filtro === 'encerrados' || filtro === 'todos') return l.sort((a, b) => (parseData(b.criadoEm) || 0) - (parseData(a.criadoEm) || 0));
    return l.sort(ordemDeCobranca);
  }, [base, filtro]);

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
        <SearchInput value={busca} onChange={setBusca} placeholder="Cliente, carro, moto, placa…" />
        <Chips
          value={filtro}
          onChange={(f) => setParams({ f }, { replace: true })}
          options={[
            { value: 'ativos', label: 'Ativos', count: n('ativos') },
            { value: 'cobrar', label: 'A cobrar', count: n('cobrar'), alert: true },
            { value: 'atrasados', label: 'Atrasados', count: n('atrasados'), alert: true },
            { value: 'encerrados', label: 'Encerrados', count: n('encerrados') },
            { value: 'todos', label: 'Todos' },
          ]}
        />
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
