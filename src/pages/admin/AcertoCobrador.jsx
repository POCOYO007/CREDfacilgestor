import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button, Card, Badge, Input, cn } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ArrowLeft, Wallet, HandCoins, Fuel, Utensils, MoreHorizontal, CheckCircle2, XCircle, Calendar, DollarSign, User, Search, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui';

const parseToLocalDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  
  // Se for Firebase Timestamp
  if (typeof dateVal === 'object' && dateVal !== null && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  
  if (typeof dateVal === 'string') {
    // Se for formato apenas YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0); // Usa 12h local para evitar problemas de fuso
    }
    
    // Se for formato ISO completo (e.g. "2026-06-23T00:00:00.000Z")
    const isoMatch = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      const hours = parseInt(isoMatch[4], 10);
      const minutes = parseInt(isoMatch[5], 10);
      
      if (hours === 0 && minutes === 0) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
      }
      return new Date(year, month - 1, day, hours, minutes, parseInt(isoMatch[6], 10), 0);
    }
  }
  
  const parsed = new Date(dateVal);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

export default function AcertoCobrador() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cobradores, recebimentos, despesas, clientes, emprestimos, editarDespesa, pagamentosCobradores, adicionarPagamentoCobrador } = useAppStore();

  const cobrador = cobradores.find(c => c.id === id);
  const [periodo, setPeriodo] = useState('semana'); // hoje, semana, mes, personalizado
  const [customInicio, setCustomInicio] = useState(new Date().toISOString().split('T')[0]);
  const [customFim, setCustomFim] = useState(new Date().toISOString().split('T')[0]);
  const [searchClient, setSearchClient] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentObs, setPaymentObs] = useState('');

  const getClienteInfo = (r) => {
    let cli = null;
    if (r.clienteId) {
      cli = clientes.find(c => c.id === r.clienteId);
    }
    if (!cli && r.emprestimoId) {
      const emp = emprestimos.find(e => e.id === r.emprestimoId);
      if (emp) {
        cli = clientes.find(c => c.id === emp.clienteId);
      }
    }
    return {
      nome: cli?.nome || r.clienteNome || 'Cliente Não Identificado',
      telefone: cli?.telefone || '',
      cpfCnpj: cli?.cpfCnpj || ''
    };
  };

  const getPeriodoDates = () => {
    const inicio = new Date();
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);

    if (periodo === 'hoje') {
      inicio.setHours(0, 0, 0, 0);
    } else if (periodo === 'semana') {
      inicio.setDate(inicio.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
    } else if (periodo === 'mes') {
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
    } else if (periodo === 'personalizado') {
      const dInicio = parseToLocalDate(customInicio);
      dInicio.setHours(0, 0, 0, 0);
      const dFim = parseToLocalDate(customFim);
      dFim.setHours(23, 59, 59, 999);
      return { inicio: dInicio, fim: dFim };
    }
    return { inicio, fim };
  };

  const { inicio, fim } = getPeriodoDates();

  const isPertenceAoCobrador = (recordId) => {
    if (!recordId) return false;
    const matchId = String(recordId).toLowerCase();
    const targetId = String(id).toLowerCase();
    const username = cobrador?.username ? String(cobrador.username).toLowerCase() : '';
    const nome = cobrador?.nome ? String(cobrador.nome).toLowerCase() : '';
    const email = cobrador?.email ? String(cobrador.email).toLowerCase() : '';
    const emailPrefix = email.split('@')[0];

    return matchId === targetId || 
           (username && matchId === username) || 
           (nome && matchId === nome) ||
           (email && matchId === email) ||
           (emailPrefix && matchId === emailPrefix);
  };

  const recs = useMemo(() => recebimentos.filter(r =>
    isPertenceAoCobrador(r.cobradorId) &&
    parseToLocalDate(r.dataRecebimento) >= inicio &&
    parseToLocalDate(r.dataRecebimento) <= fim
  ), [recebimentos, cobrador, id, inicio, fim]);

  // Mostra as despesas do período OU qualquer despesa PENDENTE (aprovada === null ou undefined) para que o admin possa aprovar/rejeitar
  const desps = useMemo(() => despesas.filter(d =>
    isPertenceAoCobrador(d.cobradorId) && (
      (parseToLocalDate(d.data) >= inicio && parseToLocalDate(d.data) <= fim) ||
      d.aprovada === undefined || d.aprovada === null
    )
  ), [despesas, cobrador, id, inicio, fim]);

  const todosRecsCobrador = useMemo(
    () => recebimentos.filter(r => isPertenceAoCobrador(r.cobradorId)),
    [recebimentos, cobrador, id]
  );
  const recsForaDoFiltro = useMemo(() => todosRecsCobrador.filter(r => {
    const data = parseToLocalDate(r.dataRecebimento);
    return data < inicio || data > fim;
  }), [todosRecsCobrador, inicio, fim]);

  const todasDespsCobrador = useMemo(
    () => despesas.filter(d => isPertenceAoCobrador(d.cobradorId)),
    [despesas, cobrador, id]
  );
  const despsForaDoFiltro = useMemo(() => todasDespsCobrador.filter(d => {
    const data = parseToLocalDate(d.data);
    // Para contar como fora do filtro, não pode estar pendente (pois pendentes são exibidas no painel sempre) e a data precisa estar de fora
    return d.aprovada !== undefined && d.aprovada !== null && (data < inicio || data > fim);
  }), [todasDespsCobrador, inicio, fim]);

  const totalColetado = recs.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const multasColetadas = recs.filter(r => r.tipo === 'multa').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);

  // O valor total de despesas aprovadas deduzido no acerto deve conter apenas as despesas APROVADAS do PERÍODO selecionado
  const totalDespesas = useMemo(() => todasDespsCobrador.filter(d =>
    d.aprovada &&
    parseToLocalDate(d.data) >= inicio &&
    parseToLocalDate(d.data) <= fim
  ).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0), [todasDespsCobrador, inicio, fim]);

  const comissaoValor = totalColetado * ((parseFloat(cobrador?.comissao) || 0) / 100);

  const pagamentosEfetuados = useMemo(() => pagamentosCobradores.filter(p =>
    isPertenceAoCobrador(p.cobradorId) &&
    parseToLocalDate(p.criadoEm) >= inicio &&
    parseToLocalDate(p.criadoEm) <= fim
  ).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0), [pagamentosCobradores, cobrador, id, inicio, fim]);

  const aEntregar = (totalColetado - comissaoValor - totalDespesas) + pagamentosEfetuados;

  const handleAprovarDespesa = async (despId, aprovada) => {
    try {
      await editarDespesa(despId, { aprovada });
      toast.success(`Despesa ${aprovada ? 'aprovada' : 'rejeitada'}!`);
    } catch (e) {
      toast.error('Erro ao editar despesa');
    }
  };

  // Precisa vir depois de todos os hooks acima (useMemo) — um return
  // condicional antes deles quebraria a ordem dos hooks entre renders.
  if (!cobrador) return <div>Cobrador não encontrado.</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Acerto: {cobrador.nome}</h2>
            <p className="text-xs sm:text-sm text-text-secondary truncate">Conferência de valores coletados e despesas.</p>
          </div>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full xl:w-auto">
          <div className="flex glass p-1 rounded-xl overflow-x-auto scrollbar-none w-full sm:w-auto">
            {['hoje', 'semana', 'mes', 'personalizado'].map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={cn(
                  "flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap",
                  periodo === p ? "bg-brand-primary text-white shadow-lg" : "text-text-muted hover:text-white"
                )}
              >
                {p === 'personalizado' ? 'Data' : p}
              </button>
            ))}
          </div>
          {periodo === 'personalizado' && (
            <div className="flex items-center justify-between sm:justify-end gap-2 animate-in fade-in slide-in-from-top-2 duration-200 w-full sm:w-auto">
              <input 
                type="date" 
                className="bg-brand-surface-2 border border-border-subtle rounded-lg px-2 sm:px-3 py-1 text-xs focus:outline-hidden focus:border-brand-primary text-text-primary w-full sm:w-auto"
                value={customInicio}
                onChange={e => setCustomInicio(e.target.value)}
              />
              <span className="text-text-muted text-xs">até</span>
              <input 
                type="date" 
                className="bg-brand-surface-2 border border-border-subtle rounded-lg px-2 sm:px-3 py-1 text-xs focus:outline-hidden focus:border-brand-primary text-text-primary w-full sm:w-auto"
                value={customFim}
                onChange={e => setCustomFim(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-5 border-l-4 border-success flex flex-col justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Total Coletado</p>
            <h3 className="text-xl sm:text-2xl font-bold font-mono text-success">{formatCurrency(totalColetado)}</h3>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5 flex justify-between gap-2 min-w-0 animate-pulse">
            <span className="text-[10px] text-text-muted uppercase truncate">Multas</span>
            <span className="text-[10px] font-bold text-success truncate">{formatCurrency(multasColetadas)}</span>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 border-l-4 border-brand-primary">
          <p className="text-xs text-text-muted uppercase font-bold mb-1">Comissão ({cobrador.comissao}%)</p>
          <h3 className="text-xl sm:text-2xl font-bold font-mono text-brand-primary">{formatCurrency(comissaoValor)}</h3>
        </Card>
        <Card className="p-4 sm:p-5 border-l-4 border-danger">
          <p className="text-xs text-text-muted uppercase font-bold mb-1">Despesas Aprovadas</p>
          <h3 className="text-xl sm:text-2xl font-bold font-mono text-danger">{formatCurrency(totalDespesas)}</h3>
        </Card>
        <Card className="p-4 sm:p-5 bg-linear-to-br from-brand-surface to-brand-surface-2 border-brand-primary/30 relative group">
          <p className="text-xs text-text-muted uppercase font-bold mb-1">Líquido a Entregar</p>
          <h3 className="text-xl sm:text-2xl font-bold font-mono text-white mb-4">{formatCurrency(aEntregar)}</h3>
          {Math.abs(aEntregar) > 0.01 && (
            <Button 
              size="sm" 
              className={cn("w-full gap-2 text-xs py-2", aEntregar < 0 ? "bg-brand-primary" : "bg-success")}
              onClick={() => {
                setPaymentValue(Math.abs(aEntregar).toFixed(2));
                setIsPaymentModalOpen(true);
              }}
            >
              <DollarSign size={15} />
              {aEntregar < 0 ? "Pagar Cobrador" : "Receber do Cobrador"}
            </Button>
          )}
          {Math.abs(aEntregar) <= 0.01 && (
            <div className="flex items-center justify-center gap-2 py-2 text-success font-bold text-xs sm:text-sm">
              <CheckCircle2 size={16} />
              ACERTO REALIZADO
            </div>
          )}
        </Card>
      </div>

      {(recsForaDoFiltro.length > 0 || despsForaDoFiltro.length > 0) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <Calendar className="text-amber-400 shrink-0" size={18} />
            <div>
              <p className="font-bold text-white">Lançamentos fora do filtro de {periodo === 'hoje' ? 'Hoje' : periodo === 'semana' ? 'Semana' : periodo === 'mes' ? 'Mês' : 'Data'}</p>
              <p className="text-amber-200/70 mt-0.5">
                Existem {despsForaDoFiltro.length} despesa(s) e {recsForaDoFiltro.length} recebimento(s) deste cobrador fora do período selecionado.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {periodo !== 'semana' && (
              <button 
                onClick={() => setPeriodo('semana')} 
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg text-xs font-bold transition-colors uppercase cursor-pointer"
              >
                Ver Semana
              </button>
            )}
            {periodo !== 'mes' && (
              <button 
                onClick={() => setPeriodo('mes')} 
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-colors uppercase cursor-pointer"
              >
                Ver Mês
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card className="p-0 overflow-hidden border border-border-subtle shadow-md">
          <div className="px-4 sm:px-6 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-surface-2/30">
            <div className="flex items-center gap-2">
              <HandCoins size={18} className="text-brand-primary shrink-0" />
              <h4 className="font-bold text-sm sm:text-base text-white">Recebimentos do Período ({recs.length})</h4>
            </div>
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                className="w-full bg-brand-surface border border-border-subtle rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary focus:outline-hidden focus:border-brand-primary"
                value={searchClient}
                onChange={e => setSearchClient(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-border-subtle">
            {recs
              .filter(r => {
                if (!searchClient) return true;
                const info = getClienteInfo(r);
                return info.nome.toLowerCase().includes(searchClient.toLowerCase()) ||
                       info.cpfCnpj.includes(searchClient);
              })
              .map(r => {
                const info = getClienteInfo(r);
                return (
                  <div key={r.id} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-brand-primary shrink-0" />
                        <p className="text-sm font-black text-white truncate">{info.nome}</p>
                      </div>
                      <p className="text-xs text-text-muted truncate mt-0.5 flex items-center gap-2">
                        <span>{formatDate(r.dataRecebimento)}</span>
                        <span>•</span>
                        <span className="uppercase font-bold text-[10px] bg-brand-surface-2 px-1.5 py-0.5 rounded text-text-secondary">
                          {r.tipo === 'multa' ? 'MULTA' : r.tipo === 'quitação' ? 'QUITAÇÃO' : r.tipo === 'somente_juros' ? 'SOMENTE JUROS' : 'PARCELA'}
                        </span>
                        {r.observacao && <span className="italic text-text-muted/80 truncate max-w-[150px]">"{r.observacao}"</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black font-mono text-success">{formatCurrency(r.valor)}</p>
                      <Badge variant="success" className="text-[9px] uppercase tracking-wider py-0 px-1.5 mt-0.5">OK</Badge>
                    </div>
                  </div>
                );
              })}
            {recs.length === 0 && (
              <div className="p-12 text-center text-text-muted opacity-50 font-medium">Nenhum recebimento neste período.</div>
            )}
            {recs.length > 0 && recs.filter(r => {
              if (!searchClient) return true;
              const info = getClienteInfo(r);
              return info.nome.toLowerCase().includes(searchClient.toLowerCase());
            }).length === 0 && (
              <div className="p-8 text-center text-text-muted opacity-60 text-xs">Nenhum cliente encontrado para "{searchClient}".</div>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border-subtle flex justify-between items-center">
            <h4 className="font-bold text-sm sm:text-base">Despesas Lançadas</h4>
            <Fuel size={18} className="text-text-muted" />
          </div>
          <div className="max-h-[350px] overflow-y-auto divide-y divide-border-subtle">
            {desps.map(d => (
              <div key={d.id} className="px-4 sm:px-6 py-3.5 flex justify-between items-center gap-2">
                <div className="flex gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-muted shrink-0">
                    {d.tipo === 'combustivel' ? <Fuel size={18} /> : d.tipo === 'alimentacao' ? <Utensils size={18} /> : d.tipo === 'mecanica' ? <Wrench size={18} /> : <MoreHorizontal size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold font-mono text-white">{formatCurrency(d.valor)}</p>
                    <p className="text-xs text-text-muted truncate">{d.descricao} • {formatDate(d.data)}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {(d.aprovada === undefined || d.aprovada === null) ? (
                    <>
                      <button onClick={() => handleAprovarDespesa(d.id, true)} className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors"><CheckCircle2 size={18} /></button>
                      <button onClick={() => handleAprovarDespesa(d.id, false)} className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors"><XCircle size={18} /></button>
                    </>
                  ) : (
                    <Badge variant={d.aprovada ? "success" : "danger"} className="text-[10px]">
                      {d.aprovada ? "APROVADA" : "REJEITADA"}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {desps.length === 0 && <div className="p-12 text-center text-text-muted opacity-50">Nenhuma despesa.</div>}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold">Histórico de Pagamentos ao Cobrador</h3>
        <Card className="p-0 overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border-subtle">
            {pagamentosCobradores.filter(p => isPertenceAoCobrador(p.cobradorId)).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)).map(p => (
              <div key={p.id} className="px-6 py-4 flex justify-between items-center">
                <div>
                  <p className={cn("text-sm font-bold", p.valor > 0 ? "text-brand-primary" : "text-success")}>
                    {p.valor > 0 ? `PAGAMENTO: ${formatCurrency(p.valor)}` : `RECEBIMENTO: ${formatCurrency(Math.abs(p.valor))}`}
                  </p>
                  <p className="text-xs text-text-muted">{p.periodo} • {formatDate(p.criadoEm)}</p>
                  {p.observacao && <p className="text-xs text-text-secondary mt-1 italic">"{p.observacao}"</p>}
                </div>
                <Badge variant={p.valor > 0 ? "primary" : "success"}>
                  {p.valor > 0 ? "SAÍDA" : "ENTRADA"}
                </Badge>
              </div>
            ))}
            {pagamentosCobradores.filter(p => isPertenceAoCobrador(p.cobradorId)).length === 0 && (
              <div className="p-12 text-center text-text-muted opacity-50">Nenhum pagamento registrado ainda.</div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Registrar Pagamento ao Cobrador"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              const valor = parseFloat(paymentValue);
              if (isNaN(valor) || valor <= 0) {
                toast.error('Valor inválido');
                return;
              }
              try {
                await adicionarPagamentoCobrador({
                  cobradorId: id,
                  valor: aEntregar < 0 ? valor : -valor,
                  periodo: `${formatDate(inicio)} - ${formatDate(fim)}`,
                  observacao: paymentObs
                });
                toast.success('Pagamento registrado com sucesso!');
                setIsPaymentModalOpen(false);
                setPaymentObs('');
              } catch (e) {
                toast.error('Erro ao registrar pagamento');
              }
            }}>Confirmar Pagamento</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Cobrador</p>
            <p className="font-bold">{cobrador.nome}</p>
          </div>
          <Input
            label="Valor do Repasse (R$)"
            type="number"
            value={paymentValue}
            onChange={e => setPaymentValue(e.target.value)}
          />

          {recs.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-text-muted tracking-wider block">
                Conferência Bancária - Clientes Coletados ({recs.length})
              </label>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border-subtle divide-y divide-border-subtle bg-brand-surface p-1">
                {recs.map(r => {
                  const info = getClienteInfo(r);
                  return (
                    <div key={r.id} className="p-2.5 flex justify-between items-center text-xs hover:bg-white/5 transition-colors rounded-lg">
                      <div className="min-w-0 flex items-center gap-2">
                        <User size={14} className="text-brand-primary shrink-0" />
                        <span className="font-bold text-white truncate">{info.nome}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">{formatCurrency(r.valor)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary ml-1">Observação</label>
            <textarea
              className="input-field min-h-[80px] py-2"
              placeholder="Ex: Pagamento referente ao acerto semanal..."
              value={paymentObs}
              onChange={e => setPaymentObs(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
