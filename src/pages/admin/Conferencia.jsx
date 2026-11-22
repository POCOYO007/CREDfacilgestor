import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Check, X, ClipboardCheck } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { conferenciaDoDia, dataDoRecebimento, dataDaDespesa } from '../../domain/conferencia';
import { composicaoDoRecebimento, TIPOS_PAGAMENTO } from '../../domain/pagamento';
import { hojeISO, parseData } from '../../domain/emprestimo';
import { PageHeader, Card, Row, Badge, Empty, SectionTitle, IconButton, Input } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';

const ROTULOS = [['juros', 'Juros'], ['capital', 'Capital'], ['parcela', 'Parcelas (contratos antigos)'], ['multa', 'Multa']];
const hora = (iso) => { const d = parseData(iso); return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };

export default function Conferencia() {
  const recebimentos = useAppStore((s) => s.recebimentos);
  const despesas = useAppStore((s) => s.despesas);
  const cobradores = useAppStore((s) => s.cobradores);
  const clientes = useAppStore((s) => s.clientes);
  const editarDespesa = useAppStore((s) => s.editarDespesa);
  const [dia, setDia] = useState(hojeISO());
  const location = useLocation();

  const conf = useMemo(() => conferenciaDoDia(parseData(dia), { recebimentos, despesas, cobradores }), [dia, recebimentos, despesas, cobradores]);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, conf.grupos.length]);

  const mudarDia = (delta) => {
    const d = parseData(dia); d.setDate(d.getDate() + delta); setDia(hojeISO(d));
  };
  const nomeCliente = (r) => clientes.find((c) => c.id === r.clienteId)?.nome || r.clienteNome || 'Cliente';
  const decidir = async (d, aprovada) => {
    try { await editarDespesa(d.id, { aprovada }); toast.success(aprovada ? 'Despesa aprovada' : 'Despesa rejeitada'); } catch (e) { toast.error(e.message); }
  };
  const ehHoje = dia === hojeISO();

  return (
    <div>
      <PageHeader title="Conferência" subtitle="O que cada cobrador recebeu e deve entregar" />

      <div className="flex items-center gap-2 mb-4">
        <IconButton label="Dia anterior" className="bg-brand-surface border border-border-subtle" onClick={() => mudarDia(-1)}><ChevronLeft className="w-5 h-5" /></IconButton>
        <Input type="date" value={dia} max={hojeISO()} onChange={(e) => e.target.value && setDia(e.target.value)} inputClassName="text-center font-semibold bg-brand-surface border-border-subtle" />
        <IconButton label="Próximo dia" className="bg-brand-surface border border-border-subtle" disabled={ehHoje} onClick={() => mudarDia(1)}><ChevronRight className="w-5 h-5" /></IconButton>
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold text-text-secondary">{ehHoje ? 'Total de hoje' : `Total de ${formatDate(dia)}`}</p>
        <p className="text-3xl font-extrabold tabular-nums mt-0.5">{formatCurrency(conf.geral.total)}</p>
        <div className="mt-2">
          {ROTULOS.map(([k, label]) => conf.geral.totais[k] > 0 && <Row key={k} label={label} value={formatCurrency(conf.geral.totais[k])} />)}
          <Row label="Despesas" value={`−${formatCurrency(conf.geral.totalDespesas)}`} tone="danger" />
          <div className="border-t border-border-subtle my-1" />
          <Row label="Líquido a entregar" value={formatCurrency(conf.geral.liquido)} strong />
        </div>
      </Card>

      {conf.grupos.length === 0 && (
        <Card className="mt-4"><Empty icon={<ClipboardCheck className="w-6 h-6" />} title="Nenhum movimento neste dia" /></Card>
      )}

      {conf.grupos.map((g) => (
        <section key={g.id} id={g.id} className="scroll-mt-20">
          <SectionTitle action={g.cobrador && <Link to={`/app/equipe/${g.cobrador.id}/acerto`} className="text-[13px] font-semibold text-brand-primary">Acerto</Link>}>
            {g.nome}
          </SectionTitle>
          <Card className="px-4 py-2">
            {ROTULOS.map(([k, label]) => g.totais[k] > 0 && <Row key={k} label={label} value={formatCurrency(g.totais[k])} />)}
            <Row label={`Recebido (${g.recebimentos.length})`} value={formatCurrency(g.total)} />
            <Row label={`Despesas (${g.despesas.filter((d) => d.aprovada !== false).length})`} value={`−${formatCurrency(g.totalDespesas)}`} tone="danger" />
            <div className="border-t border-border-subtle my-1" />
            <Row label="Líquido a entregar" value={formatCurrency(g.liquido)} strong tone={g.liquido >= 0 ? 'default' : 'danger'} />
            {g.cobrador?.comissao > 0 && (
              <p className="text-[12px] text-text-muted pb-1.5">Comissão de {g.cobrador.comissao}% ({formatCurrency(g.total * g.cobrador.comissao / 100)}) é acertada na tela de Acerto.</p>
            )}
          </Card>

          {g.recebimentos.length > 0 && (
            <Card className="mt-2 divide-y divide-border-subtle">
              {g.recebimentos.map((r) => {
                const comp = composicaoDoRecebimento(r);
                return (
                  <Link key={r.id} to={`/app/emprestimos/${r.emprestimoId}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-brand-surface-2">
                    <span className="text-[12px] font-semibold text-text-muted w-10 shrink-0 tabular-nums">{hora(dataDoRecebimento(r))}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{nomeCliente(r)}</p>
                      <p className="text-[12px] text-text-secondary truncate">
                        {TIPOS_PAGAMENTO[r.tipo] || r.tipo} · {Object.entries(comp).map(([k, v]) => `${k} ${formatCurrency(v)}`).join(' + ')}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums">{formatCurrency(r.valor)}</span>
                  </Link>
                );
              })}
            </Card>
          )}

          {g.despesas.length > 0 && (
            <Card className="mt-2 divide-y divide-border-subtle">
              {g.despesas.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{d.descricao || d.tipo}</p>
                    <p className="text-[12px] text-text-secondary">Despesa · {formatDate(dataDaDespesa(d))}</p>
                  </div>
                  <span className="font-bold tabular-nums text-danger">−{formatCurrency(d.valor)}</span>
                  {d.aprovada == null ? (
                    <div className="flex gap-1">
                      <button aria-label="Rejeitar" onClick={() => decidir(d, false)} className="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center"><X className="w-4 h-4" /></button>
                      <button aria-label="Aprovar" onClick={() => decidir(d, true)} className="w-8 h-8 rounded-lg bg-success/12 text-success flex items-center justify-center"><Check className="w-4 h-4" /></button>
                    </div>
                  ) : <Badge variant={d.aprovada ? 'success' : 'danger'}>{d.aprovada ? 'Ok' : 'Rejeitada'}</Badge>}
                </div>
              ))}
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}
