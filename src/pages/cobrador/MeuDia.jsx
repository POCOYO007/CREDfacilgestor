import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Wallet, ChevronRight, Receipt } from 'lucide-react';
import { useMeuCobrador } from '../../hooks/useMeuCobrador';
import { conferenciaDoPeriodo, dataDoRecebimento } from '../../domain/conferencia';
import PeriodoFiltro, { usePeriodo } from '../../components/PeriodoFiltro';
import { TIPOS_PAGAMENTO } from '../../domain/pagamento';
import { parseData, num } from '../../domain/emprestimo';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader, Card, Row, SectionTitle, Empty } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';

const ROTULOS = [['juros', 'Juros'], ['capital', 'Capital'], ['parcela', 'Parcelas'], ['multa', 'Multa']];

export default function MeuDia() {
  const { eu, recebimentos, despesas } = useMeuCobrador();
  const clientes = useAppStore((s) => s.clientes);
  const per = usePeriodo();
  const conf = useMemo(() => conferenciaDoPeriodo(per.inicio, per.fim, { recebimentos, despesas, cobradores: [eu] }), [per.inicio, per.fim, recebimentos, despesas, eu]);
  const g = conf.geral;
  const recsHoje = conf.grupos.flatMap((x) => x.recebimentos);
  const comissao = num(eu.comissao) > 0 ? g.total * num(eu.comissao) / 100 : 0;

  return (
    <div>
      <PageHeader title="Meu resumo" subtitle="Para conferir com o gestor" />
      <PeriodoFiltro estado={per} className="mb-4" />

      <Card className="p-4">
        <p className="text-sm font-semibold text-text-secondary">Recebido {per.rotulo}</p>
        <p className="text-4xl font-extrabold tabular-nums mt-0.5">{formatCurrency(g.total)}</p>
        <div className="mt-2">
          {ROTULOS.map(([k, label]) => g.totais[k] > 0 && <Row key={k} label={label} value={formatCurrency(g.totais[k])} />)}
          <Row label="Despesas lançadas" value={`−${formatCurrency(g.totalDespesas)}`} tone="danger" />
          <div className="border-t border-border-subtle my-1" />
          <Row label="Entregar ao gestor" value={formatCurrency(g.liquido)} strong />
          {comissao > 0 && <p className="text-[12px] text-text-muted pb-1">Sua comissão estimada {per.ehHoje ? 'hoje' : 'no período'}: {formatCurrency(comissao)} ({eu.comissao}%) — acertada com o gestor.</p>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Link to="/cobrador/despesas" className="surface-card p-3.5 flex items-center gap-2 font-semibold active:bg-brand-surface-2"><Wallet className="w-5 h-5 text-brand-primary" /> Lançar despesa</Link>
        <Link to="/cobrador/calculadora" className="surface-card p-3.5 flex items-center gap-2 font-semibold active:bg-brand-surface-2"><Calculator className="w-5 h-5 text-brand-primary" /> Calculadora</Link>
      </div>

      <SectionTitle>Recebimentos ({recsHoje.length})</SectionTitle>
      {recsHoje.length === 0 ? (
        <Card><Empty icon={<Receipt className="w-6 h-6" />} title="Nenhum recebimento no período" /></Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {recsHoje.map((r) => (
            <Link key={r.id} to={`/cobrador/contrato/${r.emprestimoId}`} className="flex items-center gap-3 px-4 py-3 active:bg-brand-surface-2">
              <span className="text-[12px] font-semibold text-text-muted w-10 tabular-nums">{per.ehHoje
                  ? parseData(dataDoRecebimento(r))?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : parseData(dataDoRecebimento(r))?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{clientes.find((c) => c.id === r.clienteId)?.nome || 'Cliente'}</p>
                <p className="text-[12px] text-text-secondary">{TIPOS_PAGAMENTO[r.tipo] || r.tipo}</p>
              </div>
              <span className="font-bold tabular-nums">{formatCurrency(r.valor)}</span>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
