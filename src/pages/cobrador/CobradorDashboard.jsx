import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Card, Button, Badge } from '../../components/ui';
import { 
  formatCurrency, 
  formatPhone, 
  isTodayDate, 
  buildWhatsAppUrl, 
  buildJurosVencendoHojeMessage 
} from '../../utils/formatters';
import { calcularStatus } from '../../utils/calculosEmprestimo';
import { 
  HandCoins, 
  MapPin, 
  Fuel, 
  Plus, 
  ChevronRight, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Calendar,
  Navigation,
  Calculator,
  Users,
  Coins,
  Wallet,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../components/ui';
import { motion } from 'motion/react';

export default function CobradorDashboard() {
  const { usuarioAtual, recebimentos, emprestimos, clientes, config, cobradores } = useAppStore();
  const navigate = useNavigate();

  const cid = usuarioAtual.cobradorId || usuarioAtual.id;

  // Obter cobrador para a taxa de comissão
  const cobradorEncontrado = (cobradores || []).find(c => 
    c.id === cid || 
    c.id === usuarioAtual.id || 
    c.id === usuarioAtual.cobradorId ||
    (usuarioAtual.email && c.email === usuarioAtual.email) ||
    (usuarioAtual.username && c.username === usuarioAtual.username)
  );

  const percentualComissao = cobradorEncontrado ? (parseFloat(cobradorEncontrado.comissao) || 0) : (parseFloat(usuarioAtual.comissao) || 5);

  const isPertenceAoCobrador = (cobId, empId) => {
    if (cobId) {
      const matchId = String(cobId).trim().toLowerCase();
      const cidStr = String(cid).trim().toLowerCase();
      const userIdStr = usuarioAtual?.id ? String(usuarioAtual.id).trim().toLowerCase() : '';
      const cobIdUserStr = usuarioAtual?.cobradorId ? String(usuarioAtual.cobradorId).trim().toLowerCase() : '';
      const nomeStr = usuarioAtual?.nome ? String(usuarioAtual.nome).trim().toLowerCase() : '';
      const emailStr = usuarioAtual?.email ? String(usuarioAtual.email).trim().toLowerCase() : '';
      const emailPrefix = emailStr ? emailStr.split('@')[0] : '';

      if (
        matchId === cidStr || 
        matchId === userIdStr || 
        matchId === cobIdUserStr || 
        (nomeStr && matchId === nomeStr) ||
        (emailStr && matchId === emailStr) ||
        (emailPrefix && matchId === emailPrefix)
      ) {
        return true;
      }
    }
    if (empId) {
      const e = emprestimos.find(emp => emp.id === empId);
      if (e && e.cobradorId) {
        const matchEmpCob = String(e.cobradorId).trim().toLowerCase();
        const cidStr = String(cid).trim().toLowerCase();
        const userIdStr = usuarioAtual?.id ? String(usuarioAtual.id).trim().toLowerCase() : '';
        const cobIdUserStr = usuarioAtual?.cobradorId ? String(usuarioAtual.cobradorId).trim().toLowerCase() : '';
        if (matchEmpCob === cidStr || matchEmpCob === userIdStr || matchEmpCob === cobIdUserStr) {
          return true;
        }
      }
    }
    return false;
  };

  const meusRecebimentosHoje = useMemo(() => recebimentos.filter(r =>
    isPertenceAoCobrador(r.cobradorId, r.emprestimoId) &&
    (isTodayDate(r.dataRecebimento) || isTodayDate(r.criadoEm))
  ), [recebimentos, emprestimos, cid, usuarioAtual]);

  // Filtro de período (Hoje/Semana/Mês/Personalizado) pros ganhos exibidos no
  // card de resumo — separado de meusRecebimentosHoje, que continua sendo
  // usado pro progresso da rota (esse é sempre "hoje", não segue o filtro).
  const [periodo, setPeriodo] = useState('hoje');
  const [customInicio, setCustomInicio] = useState(new Date().toISOString().split('T')[0]);
  const [customFim, setCustomFim] = useState(new Date().toISOString().split('T')[0]);

  const { inicio, fim } = useMemo(() => {
    const ini = new Date();
    const f = new Date();
    f.setHours(23, 59, 59, 999);

    if (periodo === 'hoje') {
      ini.setHours(0, 0, 0, 0);
    } else if (periodo === 'semana') {
      ini.setDate(ini.getDate() - 7);
      ini.setHours(0, 0, 0, 0);
    } else if (periodo === 'mes') {
      ini.setDate(1);
      ini.setHours(0, 0, 0, 0);
    } else if (periodo === 'personalizado') {
      return {
        inicio: new Date(customInicio + 'T00:00:00'),
        fim: new Date(customFim + 'T23:59:59')
      };
    }
    return { inicio: ini, fim: f };
  }, [periodo, customInicio, customFim]);

  const meusRecebimentosPeriodo = useMemo(() => recebimentos.filter(r => {
    if (!isPertenceAoCobrador(r.cobradorId, r.emprestimoId)) return false;
    const d = new Date(r.dataRecebimento || r.criadoEm);
    return d >= inicio && d <= fim;
  }).sort((a, b) => new Date(b.dataRecebimento || b.criadoEm) - new Date(a.dataRecebimento || a.criadoEm)),
  [recebimentos, emprestimos, cid, usuarioAtual, inicio, fim]);

  const totalColetadoPeriodo = meusRecebimentosPeriodo.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const multasColetadasPeriodo = meusRecebimentosPeriodo.filter(r => r.tipo === 'multa').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);

  const comissaoPeriodo = totalColetadoPeriodo * (percentualComissao / 100);

  const labelPeriodo = {
    hoje: 'Hoje',
    semana: 'Nesta Semana',
    mes: 'Neste Mês',
    personalizado: 'no Período'
  }[periodo];

  const dataHojeObj = new Date();
  const meusRecebimentosMes = useMemo(() => recebimentos.filter(r => {
    if (!isPertenceAoCobrador(r.cobradorId, r.emprestimoId)) return false;
    const d = new Date(r.dataRecebimento || r.criadoEm);
    return d.getMonth() === dataHojeObj.getMonth() && d.getFullYear() === dataHojeObj.getFullYear();
  }), [recebimentos, emprestimos, cid, usuarioAtual]);
  const totalColetadoMes = meusRecebimentosMes.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const comissaoMes = totalColetadoMes * (percentualComissao / 100);

  const minhaRota = useMemo(() => emprestimos.filter(e =>
    isPertenceAoCobrador(e.cobradorId, e.id) &&
    calcularStatus(e) !== 'pago'
  ), [emprestimos, cid, usuarioAtual]);

  const visitadosHoje = meusRecebimentosHoje.length;
  const totalNaRota = minhaRota.length;
  const totalEfetivo = visitadosHoje + totalNaRota;
  const progressoRota = totalEfetivo > 0 ? Math.round((visitadosHoje / totalEfetivo) * 100) : 0;

  const emAtraso = minhaRota.filter(e => calcularStatus(e) === 'atrasado').length;

  const saudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const dataFormatada = new Intl.DateTimeFormat('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  }).format(new Date());

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      {/* Cabeçalho Dinâmico */}
      <div className="flex justify-between items-center px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] mb-1">{saudacao()}</span>
          <h2 className="text-2xl font-black tracking-tight">{usuarioAtual.nome.split(' ')[0]}</h2>
          <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-medium uppercase tracking-wider mt-0.5">
            <Calendar size={12} className="text-brand-primary" />
            <span>{dataFormatada}</span>
          </div>
        </div>
        <motion.div 
          whileTap={{ scale: 0.9 }}
          className="w-12 h-12 rounded-2xl bg-brand-surface border border-border-subtle flex items-center justify-center text-brand-primary shadow-xs"
        >
          <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </motion.div>
      </div>

      {/* Filtro de Período dos Ganhos */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {[
            { id: 'hoje', label: 'Hoje' },
            { id: 'semana', label: 'Semana' },
            { id: 'mes', label: 'Mês' },
            { id: 'personalizado', label: 'Data' },
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border shrink-0",
                periodo === p.id
                  ? "bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/30"
                  : "bg-brand-surface border-border-subtle text-text-muted hover:text-text-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'personalizado' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customInicio}
              onChange={e => setCustomInicio(e.target.value)}
              className="flex-1 bg-brand-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-hidden focus:border-brand-primary"
            />
            <span className="text-text-muted text-[10px] shrink-0">até</span>
            <input
              type="date"
              value={customFim}
              onChange={e => setCustomFim(e.target.value)}
              className="flex-1 bg-brand-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-hidden focus:border-brand-primary"
            />
          </div>
        )}
      </div>

      {/* Card de Resumo do Dia */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="relative overflow-hidden bg-linear-to-br from-brand-accent to-brand-primary border border-white/10 text-white p-6 shadow-2xl shadow-brand-primary/30 ring-1 ring-white/10">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/50 mb-1">Total Coletado {labelPeriodo}</p>
                {periodo === 'hoje' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[10px] font-bold text-success capitalize">Tempo Real</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-text-muted">{meusRecebimentosPeriodo.length} pagamento(s)</span>
                )}
              </div>
              <Badge className="bg-white/5 border-white/10 text-white/80 backdrop-blur-md px-3 py-1 font-mono text-[10px]">META: R$ 500</Badge>
            </div>

            <h3 className="text-3xl font-black font-mono tracking-tighter mb-4 bg-linear-to-b from-white to-white/70 bg-clip-text text-transparent">
              {formatCurrency(totalColetadoPeriodo)}
            </h3>

            {/* Bloco Destaque: Minha Comissão */}
            <div className="mb-6 p-4 rounded-2xl bg-linear-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 flex items-center justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Coins size={15} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Minha Comissão {labelPeriodo} ({percentualComissao}%)
                  </span>
                  {periodo === 'hoje' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
                </div>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                  {formatCurrency(comissaoPeriodo)}
                </span>
              </div>
              <div className="text-right border-l border-white/10 pl-4 shrink-0">
                <span className="text-[9px] font-black uppercase text-white/50 block tracking-wider">Acumulado Mês</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-white/90">{formatCurrency(comissaoMes)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span className="text-[8px] uppercase font-black text-white/40 tracking-[0.2em] block mb-1">Apenas Multas</span>
                <span className="text-lg font-bold font-mono text-warning">{formatCurrency(multasColetadasPeriodo)}</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-right">
                <span className="text-[8px] uppercase font-black text-white/40 tracking-[0.2em] block mb-1">Capital/Juros</span>
                <span className="text-lg font-bold font-mono text-success">{formatCurrency(totalColetadoPeriodo - multasColetadasPeriodo)}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/10">
                    <Navigation size={12} className="text-brand-primary rotate-45" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Progresso da Rota</span>
                </div>
                <span className="text-xs font-black font-mono text-brand-primary">{progressoRota}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressoRota}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                />
              </div>
              <div className="flex items-center justify-center gap-2 py-1 bg-white/5 border border-white/5 rounded-xl">
                <HandCoins size={12} className="text-brand-primary" />
                <span className="text-[9px] uppercase font-black tracking-[0.15em] text-white/50">{meusRecebimentosHoje.length} PAGAMENTOS HOJE</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => navigate('/cobrador/rota')}>
            <Card className="p-3 sm:p-4 bg-brand-surface border-border-subtle group transition-all h-full flex flex-col justify-between overflow-hidden relative">
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary">
                  <MapPin size={16} />
                </div>
                <Badge variant="neutral" className="text-[8px] bg-brand-surface-2 px-1.5 py-0.5">ROTA</Badge>
              </div>
              <div className="relative z-10">
                <h4 className="text-2xl sm:text-3xl font-black tracking-tight">{minhaRota.length}</h4>
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider truncate">Pendentes</p>
              </div>
            </Card>
          </motion.div>
          
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => navigate('/cobrador/rota')}>
            <Card className={cn(
              "p-3 sm:p-4 border-l-4 group transition-all h-full flex flex-col justify-between overflow-hidden relative",
              emAtraso > 0 ? "border-danger bg-danger/5" : "border-border-subtle bg-brand-surface"
            )}>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className={cn("p-2 rounded-xl", emAtraso > 0 ? "bg-danger/10 text-danger" : "bg-text-muted/10 text-text-muted")}>
                  <AlertCircle size={16} />
                </div>
                <Badge variant={emAtraso > 0 ? "danger" : "neutral"} className="text-[8px] px-1.5 py-0.5">ALERTA</Badge>
              </div>
              <div className="relative z-10">
                <h4 className={cn("text-2xl sm:text-3xl font-black tracking-tight uppercase", emAtraso > 0 ? "text-danger" : "text-text-primary")}>{emAtraso}</h4>
                <p className={cn("text-[9px] font-bold uppercase tracking-wider truncate", emAtraso > 0 ? "text-danger/60" : "text-text-muted")}>Atrasados</p>
              </div>
            </Card>
          </motion.div>

          <Card className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 group transition-all h-full flex flex-col justify-between overflow-hidden relative">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Coins size={16} />
              </div>
              <Badge variant="success" className="text-[8px] font-bold px-1.5 py-0.5">{periodo === 'hoje' ? 'AO VIVO' : labelPeriodo.toUpperCase()}</Badge>
            </div>
            <div className="relative z-10">
              <h4 className="text-base sm:text-2xl font-black font-mono text-emerald-400 tracking-tight truncate">{formatCurrency(comissaoPeriodo)}</h4>
              <p className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider truncate">Comissão ({percentualComissao}%)</p>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Ações Rápidas - App Bar Style */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-sm uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-brand-primary rounded-full" />
            Menu Rápido
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Rota', icon: MapPin, color: 'bg-brand-primary', path: '/cobrador/rota' },
            { label: 'Custos', icon: Fuel, color: 'bg-warning', path: '/cobrador/despesas' },
            { label: 'Calc', icon: Calculator, color: 'bg-success', path: '/cobrador/calculadora' },
            { label: 'Clientes', icon: Users, color: 'bg-text-secondary', path: '/cobrador/clientes' },
          ].map((item, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all",
                item.color, "text-white group-hover:scale-105"
              )}>
                <item.icon size={24} />
              </div>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tight">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Juros Vencendo Hoje */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-sm uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-warning rounded-full" />
            Juros Vencendo Hoje
          </h3>
          <Badge variant="warning" className="text-[9px] font-black">{minhaRota.filter(e => isTodayDate(e.dataVencimento)).length}</Badge>
        </div>
        
        <div className="space-y-2">
          {minhaRota.filter(e => isTodayDate(e.dataVencimento)).map((e, idx) => {
            const cliente = clientes.find(c => c.id === e.clienteId);
            const message = cliente ? buildJurosVencendoHojeMessage(cliente, e, config) : '';
            const whatsappUrl = cliente?.telefone ? buildWhatsAppUrl(cliente.telefone, message) : null;
            return (
              <motion.div 
                key={e.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className="p-3 bg-brand-surface border border-border-subtle rounded-2xl flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/5 border border-warning/10 flex items-center justify-center text-warning shrink-0">
                      <Clock size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-text-primary capitalize truncate max-w-[140px]">{cliente?.nome || 'N/A'}</p>
                      <p className="text-[10px] text-text-muted font-mono">{cliente?.telefone ? formatPhone(cliente.telefone) : 'Sem Telefone'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-400 text-sm font-mono tracking-tighter">{formatCurrency(e.valorParcela)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-text-primary/5 text-[10px]">
                  {cliente?.telefone ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition-all text-[10px] uppercase tracking-wider"
                    >
                      <MessageCircle size={14} />
                      Cobrar no WhatsApp
                    </a>
                  ) : (
                    <span className="text-[10px] text-danger italic font-bold">Sem telefone</span>
                  )}
                </div>
              </motion.div>
            );
          })}
          {minhaRota.filter(e => isTodayDate(e.dataVencimento)).length === 0 && (
            <div className="py-8 flex flex-col items-center justify-center text-text-muted/30 bg-brand-surface/30 rounded-3xl border border-dashed border-border-subtle">
              <CheckCircle2 size={32} className="mb-2 text-success" />
              <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum vencimento hoje</p>
            </div>
          )}
        </div>
      </div>

      {/* Clientes Coletados no Período */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-sm uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-emerald-500 rounded-full" />
            Clientes Coletados {labelPeriodo} ({meusRecebimentosPeriodo.length})
          </h3>
          {meusRecebimentosPeriodo.length > 0 && (
            <Badge variant="success" className="text-[10px] font-mono font-black">
              Total: {formatCurrency(totalColetadoPeriodo)}
            </Badge>
          )}
        </div>

        <div className="space-y-2.5">
          {meusRecebimentosPeriodo.map((r, idx) => {
            let cliente = clientes.find(c => c.id === r.clienteId);
            if (!cliente && r.emprestimoId) {
              const emp = emprestimos.find(e => e.id === r.emprestimoId);
              if (emp) cliente = clientes.find(c => c.id === emp.clienteId);
            }
            const nomeCliente = cliente?.nome || r.clienteNome || 'Cliente Não Identificado';
            const dataRec = new Date(r.dataRecebimento || r.criadoEm);
            const hora = periodo === 'hoje'
              ? dataRec.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : dataRec.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + dataRec.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <motion.div 
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + idx * 0.03 }}
                className="p-3.5 bg-brand-surface border border-border-subtle hover:border-emerald-500/40 rounded-2xl flex justify-between items-center transition-all shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-text-primary capitalize truncate">{nomeCliente}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-black bg-brand-surface-2 px-1.5 py-0.5 rounded text-text-muted uppercase tracking-tight">
                        {r.tipo === 'multa' ? 'MULTA' : r.tipo === 'quitação' ? 'QUITAÇÃO' : r.tipo === 'somente_juros' ? 'JUROS' : 'PARCELA'}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {hora}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-emerald-400 text-base font-mono tracking-tight">{formatCurrency(r.valor)}</p>
                  <span className="text-[9px] text-emerald-500/80 font-bold uppercase">Coletado</span>
                </div>
              </motion.div>
            );
          })}
          {meusRecebimentosPeriodo.length === 0 && (
            <div className="py-10 flex flex-col items-center justify-center text-text-muted/40 bg-brand-surface/30 rounded-3xl border border-dashed border-border-subtle">
              <HandCoins size={36} className="mb-2 text-text-muted/40" />
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Nenhuma coleta {labelPeriodo.toLowerCase()}</p>
              <p className="text-[10px] text-text-muted/60 mt-0.5">Os recebimentos baixados na rota aparecerão aqui.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dica Flutuante */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-brand-primary/10 border border-brand-primary/20 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden ring-1 ring-brand-primary/30"
      >
        <div className="absolute right-0 top-0 opacity-10">
          <MessageCircle size={80} />
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-primary/30">
          <MessageCircle size={20} />
        </div>
        <div className="relative z-10">
          <p className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Dica Segura</p>
          <p className="text-[10px] text-text-secondary leading-relaxed font-bold">
            Sempre valide o valor com o cliente antes de confirmar o recebimento no app.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
