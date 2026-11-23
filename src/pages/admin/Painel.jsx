import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarClock, Wallet, TrendingUp, ChevronRight, Check, X, FileText, Receipt } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { linkContrato } from '../../domain/emprestimo';
import { useContratos, ordemDeCobranca } from '../../hooks/useCarteira';
import { conferenciaDoPeriodo, dataDaDespesa } from '../../domain/conferencia';
import PeriodoFiltro, { usePeriodo } from '../../components/PeriodoFiltro';
import { parseData, num, round2, pertenceAoCobrador } from '../../domain/emprestimo';
import { Card, Stat, SectionTitle, Badge, Empty, Button, cn } from '../../components/ui';
import ContratoCard from '../../components/ContratoCard';
import { formatCurrency, formatDate } from '../../utils/formatters';

const hojeExtenso = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export default function Painel() {
  const recebimentos = useAppStore((s) => s.recebimentos);
  const despesas = useAppStore((s) => s.despesas);
  const cobradores = useAppStore((s) => s.cobradores);
  const pagamentosCobradores = useAppStore((s) => s.pagamentosCobradores);
  const editarDespesa = useAppStore((s) => s.editarDespesa);
  const config = useAppStore((s) => s.config);
  const contratos = useContratos();

  const per = usePeriodo();
  const { inicio, fim } = per;
  const noPeriodo = (v) => { const d = parseData(v); return !!d && d >= inicio && d <= fim; };
  const conf = useMemo(() => conferenciaDoPeriodo(inicio, fim, { recebimentos, despesas, cobradores }), [inicio, fim, recebimentos, despesas, cobradores]);

  const abertos = contratos.filter((c) => c.status !== 'pago');
  const atrasados = abertos.filter((c) => c.status === 'atrasado').sort(ordemDeCobranca);
  const vencemHoje = abertos.filter((c) => c.venceHoje && c.status !== 'atrasado');
  const naRua = round2(abertos.reduce((s, c) => s + c.saldo, 0));
  const valorAtrasado = round2(atrasados.reduce((s, c) => s + c.devido.total, 0));
  const valorHoje = round2(vencemHoje.reduce((s, c) => s + c.devido.total, 0));

  const despesasRecentes = useMemo(() => despesas
    .filter((d) => d.aprovada == null || noPeriodo(dataDaDespesa(d)))
    .sort((a, b) => {
      const pa = a.aprovada == null ? 0 : 1; const pb = b.aprovada == null ? 0 : 1;
      if (pa !== pb) return pa - pb; // pendentes primeiro
      return (parseData(b.criadoEm || dataDaDespesa(b)) || 0) - (parseData(a.criadoEm || dataDaDespesa(a)) || 0);
    })
    .slice(0, 8), [despesas, inicio, fim]); // eslint-disable-line

  const novosNoPeriodo = useMemo(() => contratos
    .filter((c) => noPeriodo(c.criadoEm))
    .sort((a, b) => (parseData(b.criadoEm) || 0) - (parseData(a.criadoEm) || 0)), [contratos, inicio, fim]); // eslint-disable-line
  const novosContratos = novosNoPeriodo.slice(0, 8);

  const mes = useMemo(() => {
    const noMes = noPeriodo;
    const recebido = recebimentos.filter((r) => noMes(r.dataRecebimento || r.criadoEm)).reduce((s, r) => s + num(r.valor), 0);
    const gastos = despesas.filter((d) => d.aprovada === true && noMes(dataDaDespesa(d))).reduce((s, d) => s + num(d.valor), 0);
    const repasses = pagamentosCobradores.filter((p) => noMes(p.criadoEm)).reduce((s, p) => s + Math.abs(num(p.valor)), 0);
    const emprestado = contratos.filter((c) => noMes(c.criadoEm)).reduce((s, c) => s + num(c.valorPrincipalInicial || c.valorPrincipal), 0);
    return { recebido, gastos, repasses, emprestado, resultado: recebido - gastos - repasses };
  }, [recebimentos, despesas, pagamentosCobradores, contratos, inicio, fim]); // eslint-disable-line

  const decidirDespesa = async (d, aprovada) => {
    try {
      await editarDespesa(d.id, { aprovada });
      toast.success(aprovada ? 'Despesa aprovada' : 'Despesa rejeitada');
    } catch (e) { toast.error(e.message); }
  };

  const nomeCobrador = (id) => cobradores.find((c) => pertenceAoCobrador(id, c))?.nome?.split(' ')[0] || 'Gestor';

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-semibold text-text-muted first-letter:uppercase">{hojeExtenso()}</p>
        <h1 className="text-[26px] font-extrabold tracking-tight leading-tight">Painel</h1>
      </div>

      <PeriodoFiltro estado={per} className="mb-4" />

      <div className="grid grid-cols-2 gap-3">
        <Link to={`/app/conferencia${per.query}`} className="col-span-2">
          <Card className="p-4 bg-text-primary text-brand-surface border-transparent active:scale-[0.99] transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold opacity-70">Recebido {per.rotulo}</span>
              <span className="text-[12px] font-semibold opacity-70 flex items-center">Conferir <ChevronRight className="w-4 h-4" /></span>
            </div>
            <p className="text-4xl font-extrabold tabular-nums mt-1">{formatCurrency(conf.geral.total)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] opacity-80">
              <span>{conf.geral.qtd} pagamento(s)</span>
              {conf.geral.totais.juros > 0 && <span>Juros {formatCurrency(conf.geral.totais.juros)}</span>}
              {conf.geral.totais.capital > 0 && <span>Capital {formatCurrency(conf.geral.totais.capital)}</span>}
              {conf.geral.totais.aluguel > 0 && <span>Aluguéis {formatCurrency(conf.geral.totais.aluguel)}</span>}
              {conf.geral.totais.multa > 0 && <span>Multa {formatCurrency(conf.geral.totais.multa)}</span>}
            </div>
          </Card>
        </Link>
        <Link to="/app/emprestimos?f=atrasados">
          <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Em atraso" value={formatCurrency(valorAtrasado)} hint={`${atrasados.length} contrato(s)`} tone={atrasados.length ? 'danger' : 'default'} />
        </Link>
        <Link to="/app/emprestimos?f=hoje">
          <Stat icon={<CalendarClock className="w-4 h-4" />} label="Vencem hoje" value={formatCurrency(valorHoje)} hint={`${vencemHoje.length} contrato(s)`} tone={vencemHoje.length ? 'warning' : 'default'} />
        </Link>
        <Stat icon={<Wallet className="w-4 h-4" />} label="Na rua (saldo)" value={formatCurrency(naRua)} hint={`${abertos.length} ativos`} />
        <Stat icon={<Receipt className="w-4 h-4" />} label="Despesas" value={formatCurrency(conf.geral.totalDespesas)} hint={`Líquido ${formatCurrency(conf.geral.liquido)}`} />
      </div>

      <SectionTitle action={<Link to={`/app/conferencia${per.query}`} className="text-[13px] font-semibold text-brand-primary">Detalhar</Link>}>
        Coletado por cobrador
      </SectionTitle>
      {conf.grupos.length === 0 ? (
        <Card><Empty title={per.ehHoje ? 'Nada recebido ainda hoje' : 'Nada recebido no período'} text="Os pagamentos registrados aparecem aqui." /></Card>
      ) : (
        <div className="space-y-2">
          {conf.grupos.map((g) => (
            <Link key={g.id} to={`/app/conferencia${per.query}#${g.id}`} className="block">
              <Card className="p-3.5 active:bg-brand-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold truncate">{g.nome}</p>
                  <p className="font-extrabold tabular-nums">{formatCurrency(g.total)}</p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-text-secondary mt-1">
                  {g.totais.juros > 0 && <span>Juros {formatCurrency(g.totais.juros)}</span>}
                  {g.totais.capital > 0 && <span>Capital {formatCurrency(g.totais.capital)}</span>}
                  {g.totais.parcela > 0 && <span>Parcelas {formatCurrency(g.totais.parcela)}</span>}
                  {g.totais.aluguel > 0 && <span>Aluguéis {formatCurrency(g.totais.aluguel)}</span>}
                  {g.totais.multa > 0 && <span>Multa {formatCurrency(g.totais.multa)}</span>}
                  {g.totalDespesas > 0 && <span className="text-danger">Despesas −{formatCurrency(g.totalDespesas)}</span>}
                  <span className="font-bold text-text-primary">Líquido {formatCurrency(g.liquido)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <SectionTitle action={atrasados.length > 3 && <Link to="/app/emprestimos?f=atrasados" className="text-[13px] font-semibold text-brand-primary">Ver todos ({atrasados.length})</Link>}>
        Atrasados
      </SectionTitle>
      {atrasados.length === 0 ? (
        <Card><Empty title="Nenhum contrato atrasado 🎉" /></Card>
      ) : (
        <div className="space-y-2">
          {atrasados.slice(0, 3).map((c) => <ContratoCard key={c.id} contrato={c} to={linkContrato(c)} config={config} mostrarCobrador />)}
        </div>
      )}

      <SectionTitle>Despesas {per.ehHoje ? 'de hoje e pendentes' : 'do período e pendentes'}</SectionTitle>
      {despesasRecentes.length === 0 ? (
        <Card><Empty title="Nenhuma despesa no período" /></Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {despesasRecentes.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{d.descricao || d.tipo}</p>
                <p className="text-[12px] text-text-secondary">{nomeCobrador(d.cobradorId)} · {formatDate(dataDaDespesa(d))}</p>
              </div>
              <p className="font-bold tabular-nums">{formatCurrency(d.valor)}</p>
              {d.aprovada == null ? (
                <div className="flex gap-1">
                  <button aria-label="Rejeitar" onClick={() => decidirDespesa(d, false)} className="w-9 h-9 rounded-lg bg-danger/10 text-danger flex items-center justify-center"><X className="w-4 h-4" /></button>
                  <button aria-label="Aprovar" onClick={() => decidirDespesa(d, true)} className="w-9 h-9 rounded-lg bg-success/12 text-success flex items-center justify-center"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <Badge variant={d.aprovada ? 'success' : 'danger'}>{d.aprovada ? 'Aprovada' : 'Rejeitada'}</Badge>
              )}
            </div>
          ))}
        </Card>
      )}

      <SectionTitle action={<Link to="/app/emprestimos" className="text-[13px] font-semibold text-brand-primary">Todos</Link>}>Novos contratos ({novosNoPeriodo.length})</SectionTitle>
      {novosContratos.length === 0 ? (
        <Card><Empty icon={<FileText className="w-6 h-6" />} title="Nenhum contrato novo no período" action={<Link to="/app/clientes"><Button>Novo empréstimo</Button></Link>} /></Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {novosContratos.map((c) => (
            <Link key={c.id} to={linkContrato(c)} className="flex items-center gap-3 px-4 py-3 active:bg-brand-surface-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.cliente?.nome || '—'}</p>
                <p className="text-[12px] text-text-secondary">{formatDate(c.criadoEm)} · {c.cobrador?.nome?.split(' ')[0] || 'Gestor'}</p>
              </div>
              <p className={cn('font-bold tabular-nums', c.status === 'atrasado' && 'text-danger')}>{formatCurrency(c.valorPrincipalInicial || c.valorPrincipal)}</p>
            </Link>
          ))}
        </Card>
      )}

      <SectionTitle>Resultado {per.rotulo}</SectionTitle>
      <Card className="px-4 py-2">
        <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-text-secondary">Recebido</span><span className="font-semibold tabular-nums text-success">{formatCurrency(mes.recebido)}</span></div>
        <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-text-secondary">Despesas aprovadas</span><span className="font-semibold tabular-nums text-danger">−{formatCurrency(mes.gastos)}</span></div>
        <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-text-secondary">Repasses a cobradores</span><span className="font-semibold tabular-nums text-danger">−{formatCurrency(mes.repasses)}</span></div>
        <div className="flex items-center justify-between py-2 border-t border-border-subtle mt-1"><span className="font-bold flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Caixa do período</span><span className={cn('font-extrabold tabular-nums', mes.resultado >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(mes.resultado)}</span></div>
        <div className="flex items-center justify-between py-1.5 text-[13px]"><span className="text-text-muted">Emprestado no período</span><span className="tabular-nums text-text-secondary">{formatCurrency(mes.emprestado)}</span></div>
      </Card>
    </div>
  );
}
