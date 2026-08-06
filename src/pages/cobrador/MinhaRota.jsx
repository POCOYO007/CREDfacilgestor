import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Card, Button, Badge, Input, Modal, cn } from '../../components/ui';
import { formatCurrency, formatPhone, formatDate, substituirVariaveis, gerarTextoExtrato } from '../../utils/formatters';
import { Search, MapPin, MessageCircle, Phone, HandCoins, ChevronRight, Clock, SortAsc, FileText, Send, MoreHorizontal, FolderOpen, Compass, SlidersHorizontal, ArrowUpDown, Filter, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { proximoVencimento, calcularPayoff, calcularStatus, getDiasAtraso, calcularJurosAcumulados, getJuroPorPeriodo, calcularMulta } from '../../utils/calculosEmprestimo';
import { gerarExtratoPagamentos } from '../../services/pdfService';
import { motion, AnimatePresence } from 'motion/react';

export default function MinhaRota() {
  const { usuarioAtual, emprestimos, clientes, recebimentos, adicionarRecebimento, editarEmprestimo, config } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos' | 'atrasado' | 'em_dia'
  const [sortBy, setSortBy] = useState('vencimento'); // 'vencimento' | 'nome' | 'atrasado' | 'bairro'
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [payValue, setPayValue] = useState('');
  const [payType, setPayType] = useState('regular');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payObs, setPayObs] = useState('');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [selectedFolderCliente, setSelectedFolderCliente] = useState(null);

  const cid = usuarioAtual.cobradorId || usuarioAtual.id;

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

  const baseRota = useMemo(() => emprestimos.filter(e =>
    isPertenceAoCobrador(e.cobradorId, e.id)
  ).map(e => ({
    ...e,
    status: calcularStatus(e)
  })).filter(e => e.status !== 'pago'), [emprestimos, cid, usuarioAtual]);

  const countTodos = baseRota.length;
  const countAtrasados = baseRota.filter(e => e.status === 'atrasado').length;
  const countEmDia = baseRota.filter(e => e.status === 'ativo').length;

  const rota = useMemo(() => baseRota.filter(e => {
    const cliente = clientes.find(c => c.id === e.clienteId);
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      cliente?.nome?.toLowerCase().includes(term) ||
      cliente?.endereco?.bairro?.toLowerCase().includes(term) ||
      cliente?.cpfCnpj?.includes(term);

    const matchesStatus =
      statusFilter === 'todos' ? true :
      statusFilter === 'atrasado' ? e.status === 'atrasado' :
      statusFilter === 'em_dia' ? e.status === 'ativo' : true;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'nome') {
      const nomeA = clientes.find(c => c.id === a.clienteId)?.nome || '';
      const nomeB = clientes.find(c => c.id === b.clienteId)?.nome || '';
      return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
    }
    if (sortBy === 'atrasado') {
      const atrasoA = getDiasAtraso(a.dataVencimento);
      const atrasoB = getDiasAtraso(b.dataVencimento);
      return atrasoB - atrasoA;
    }
    if (sortBy === 'bairro') {
      const bA = clientes.find(c => c.id === a.clienteId)?.endereco?.bairro || '';
      const bB = clientes.find(c => c.id === b.clienteId)?.endereco?.bairro || '';
      return bA.localeCompare(bB, 'pt-BR');
    }
    // Default: 'vencimento'
    return new Date(a.dataVencimento) - new Date(b.dataVencimento);
  }), [baseRota, clientes, searchTerm, statusFilter, sortBy]);

  const handleOpenPay = (emp, type = 'regular') => {
    setSelectedEmp(emp);
    setPayType(type);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayObs('Recebido via app cobrador');

    const jurosAcumulados = calcularJurosAcumulados(emp);
    
    if (type === 'regular') {
      if (emp.modalidade === 'parcelado') {
        // Para parcelado fixo, sugere o valor de uma parcela + qualquer multa por atraso acumulada
        const multa = calcularMulta(emp);
        setPayValue((parseFloat(emp.valorParcela || 0) + multa).toFixed(2));
      } else {
        // Sugere juros acumulados + uma pequena amortização se possível, ou apenas a parcela padrão
        setPayValue((jurosAcumulados + (emp.valorPrincipal / (emp.totalParcelas || 10))).toFixed(2));
      }
    } else if (type === 'quitacao') {
      setPayValue(calcularPayoff(emp).toFixed(2));
    } else if (type === 'multa') {
      setPayValue(calcularMulta(emp).toFixed(2));
    } else {
      setPayValue(jurosAcumulados.toFixed(2));
    }
    setIsPayModalOpen(true);
  };

  const handleConfirmPay = () => {
    const valor = parseFloat(payValue);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Valor inválido.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let dataRecebimentoIso;
    if (!payDate || payDate === todayStr) {
      dataRecebimentoIso = new Date().toISOString();
    } else {
      dataRecebimentoIso = new Date(payDate + 'T12:00:00').toISOString();
    }

    const novoRec = {
      emprestimoId: selectedEmp.id,
      clienteId: selectedEmp.clienteId,
      tipo: payType,
      valor: valor,
      cobradorId: cid,
      dataRecebimento: dataRecebimentoIso,
      observacao: payObs
    };

    adicionarRecebimento(novoRec);

    let novosDados = { ...selectedEmp };
    const juroPorPeriodo = getJuroPorPeriodo(selectedEmp);

    // Se estiver atrasado e for pagar juros/regular, a multa dinâmica atual "congela" na multaAcumulada
    const diasAtraso = getDiasAtraso(selectedEmp.dataVencimento);
    if (diasAtraso > (parseInt(selectedEmp.carenciaDias) || 0) && (payType === 'regular' || payType === 'somente_juros')) {
      const multaDinamica = calcularMulta({ ...selectedEmp, multaAcumulada: 0 });
      novosDados.multaAcumulada = (parseFloat(selectedEmp.multaAcumulada) || 0) + multaDinamica;
    }

    if (payType === 'regular') {
      if (selectedEmp.modalidade === 'parcelado') {
        const valP = parseFloat(selectedEmp.valorParcela) || 0;
        const totalP = parseInt(selectedEmp.totalParcelas) || 10;
        const pagasAtuais = parseInt(selectedEmp.parcelasPagas) || 0;
        
        // Identifica automaticamente quantas parcelas este valor cobre (ex: R$ 200 com parcela de R$ 100 = 2 parcelas)
        const numParcelasContadas = valP > 0 ? Math.max(1, Math.round(valor / valP)) : 1;
        const parcelasRestantes = Math.max(0, totalP - pagasAtuais);
        const parcelasQuitadasNestePagamento = Math.min(parcelasRestantes, numParcelasContadas);
        const novasPagas = pagasAtuais + parcelasQuitadasNestePagamento;

        novosDados.parcelasPagas = novasPagas;
        
        // Vencimento avança de acordo com a frequencia e o numero de parcelas quitadas neste pagamento
        novosDados.dataVencimento = proximoVencimento(selectedEmp.dataVencimento, selectedEmp.frequencia, parcelasQuitadasNestePagamento, selectedEmp.diaVencimento);
        
        // Se houver multa, subtraímos do acumulado o excedente pago além das parcelas
        const multaAtual = calcularMulta(selectedEmp);
        if (multaAtual > 0) {
          const valorExcedente = Math.max(0, valor - (valP * parcelasQuitadasNestePagamento));
          const sobraMulta = Math.max(0, multaAtual - valorExcedente);
          novosDados.multaAcumulada = sobraMulta;
        }

        // Calcula o saldo restante baseado nas parcelas restantes
        novosDados.valorPrincipal = Math.max(0, (totalP - novasPagas) * valP);

        if (novosDados.parcelasPagas >= totalP) {
          novosDados.status = 'pago';
          novosDados.valorPrincipal = 0;
        }
      } else {
        const abatimentoAnterior = parseFloat(selectedEmp.abatimentoJuros) || 0;
        const jurosAcumuladosSemAbatimento = calcularJurosAcumulados(selectedEmp) + abatimentoAnterior;
        
        const totalDisponivel = valor + abatimentoAnterior;
        
        // Primeiro quitamos os juros acumulados
        const valorParaJuros = Math.min(totalDisponivel, jurosAcumuladosSemAbatimento);
        const periodosPagos = Math.floor(valorParaJuros / juroPorPeriodo);
        const custoJurosPagos = periodosPagos * juroPorPeriodo;
        
        // O que sobrar do valor destinado a juros mas que não completa um período vira o novo abatimento
        novosDados.abatimentoJuros = valorParaJuros - custoJurosPagos;
        
        // O que sobrar do total após quitar todos os juros acumulados vai para amortização
        const amortizacao = Math.max(0, totalDisponivel - jurosAcumuladosSemAbatimento);

        novosDados.valorPrincipal = Math.max(0, selectedEmp.valorPrincipal - amortizacao);
        novosDados.valorParcela = novosDados.valorPrincipal * (selectedEmp.taxaJuros / 100);
        
        if (periodosPagos > 0) {
          novosDados.dataVencimento = proximoVencimento(selectedEmp.dataVencimento, selectedEmp.frequencia, periodosPagos);
        }
        
        if (novosDados.valorPrincipal <= 0) {
          novosDados.status = 'pago';
          novosDados.valorPrincipal = 0;
        }
      }
    } else if (payType === 'quitacao') {
      novosDados.status = 'pago';
      novosDados.valorPrincipal = 0;
      novosDados.saldoDevedor = 0;
      novosDados.multaAcumulada = 0;
      novosDados.abatimentoJuros = 0;
      if (selectedEmp.modalidade === 'parcelado') {
        novosDados.parcelasPagas = parseInt(selectedEmp.totalParcelas) || 10;
      }
    } else if (payType === 'somente_juros') {
      if (selectedEmp.modalidade === 'parcelado') {
        // Para parcelado, não existe somente_juros, funciona igual pagar juros normais (faz nada ou abate)
        toast.error('Operação não disponível para empréstimo parcelado.');
        return;
      } else {
        const abatimentoAnterior = parseFloat(selectedEmp.abatimentoJuros) || 0;
        const totalDisponivel = valor + abatimentoAnterior;
        
        const periodosPagos = Math.floor(totalDisponivel / juroPorPeriodo);
        const custoJurosPagos = periodosPagos * juroPorPeriodo;
        
        novosDados.abatimentoJuros = totalDisponivel - custoJurosPagos;
        
        if (periodosPagos > 0) {
          novosDados.dataVencimento = proximoVencimento(selectedEmp.dataVencimento, selectedEmp.frequencia, periodosPagos);
        }
      }
    } else if (payType === 'multa') {
      // Pagamento exclusivo de multa. 
      novosDados.multaAcumulada = Math.max(0, (parseFloat(selectedEmp.multaAcumulada) || 0) - valor);
    }

    // Sincroniza saldoDevedor
    novosDados.saldoDevedor = novosDados.valorPrincipal;
    
    // Recalcula o status
    novosDados.status = calcularStatus(novosDados);

    editarEmprestimo(selectedEmp.id, novosDados);
    toast.success('Recebimento registrado!');
    
    const cliente = clientes.find(c => c.id === selectedEmp.clienteId);
    if (window.confirm('Deseja enviar o recibo via WhatsApp?')) {
      const message = substituirVariaveis(config.templateRecibo, {
        cliente: cliente.nome,
        valorPago: novoRec.valor,
        saldoRestante: novosDados.saldoDevedor,
        data: formatDate(novoRec.dataRecebimento)
      });
      window.open(`https://wa.me/55${cliente?.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
    }

    setIsPayModalOpen(false);
  };

  const generateWhatsAppMessage = (emp, cliente) => {
    return substituirVariaveis(config.templateCobranca, {
      cliente: cliente.nome,
      valor: emp.valorParcela,
      dataVencimento: emp.dataVencimento
    });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Minha Rota</h2>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Clientes Pendentes: {rota.length}</p>
      </div>

      <div className="sticky top-0 z-20 space-y-2.5 bg-brand-secondary/95 backdrop-blur-md pb-3 pt-1 -mx-1 px-1">
        <div className="flex items-center gap-2">
          <Card className="flex-1 p-0 overflow-hidden bg-brand-surface border-border-subtle shadow-sm">
            <div className="relative flex items-center">
              <Search className="absolute left-3 text-text-muted/50 shrink-0" size={16} />
              <input
                type="text"
                placeholder="Buscar cliente ou bairro..."
                className="w-full bg-transparent pl-10 pr-8 py-3 text-sm focus:outline-hidden font-bold text-text-primary placeholder:text-text-muted/50"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  type="button" 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 p-1 text-text-muted hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </Card>

          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={cn(
              "h-12 px-3 sm:px-4 rounded-2xl flex items-center gap-2 border font-bold text-xs transition-all shrink-0 shadow-sm cursor-pointer",
              (statusFilter !== 'todos' || sortBy !== 'vencimento')
                ? "bg-brand-primary/20 border-brand-primary text-brand-primary"
                : "bg-brand-surface border-border-subtle text-text-secondary hover:text-text-primary hover:border-brand-primary/40"
            )}
            title="Filtrar e Ordenar"
          >
            <SlidersHorizontal size={18} />
            <span className="hidden sm:inline font-bold">Filtros</span>
            {(statusFilter !== 'todos' || sortBy !== 'vencimento') && (
              <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
            )}
          </button>
        </div>

        {/* Quick Filter Pills & Sort Selector */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 border cursor-pointer",
                statusFilter === 'todos'
                  ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                  : "bg-brand-surface/90 border-border-subtle text-text-muted hover:text-text-primary"
              )}
            >
              <span>Todos</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-md text-[9px]",
                statusFilter === 'todos' ? "bg-black/20 text-white font-mono" : "bg-text-primary/5 text-text-muted font-mono"
              )}>
                {countTodos}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('atrasado')}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 border cursor-pointer",
                statusFilter === 'atrasado'
                  ? "bg-danger text-white border-danger shadow-sm shadow-danger/20"
                  : "bg-brand-surface/90 border-border-subtle text-text-muted hover:text-danger"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-danger shrink-0 animate-pulse" />
              <span>Atrasados</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-md text-[9px]",
                statusFilter === 'atrasado' ? "bg-white/20 text-white font-mono" : "bg-text-primary/5 text-text-muted font-mono"
              )}>
                {countAtrasados}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('em_dia')}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 border cursor-pointer",
                statusFilter === 'em_dia'
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : "bg-brand-surface/90 border-border-subtle text-text-muted hover:text-emerald-400"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>Em Dia</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-md text-[9px]",
                statusFilter === 'em_dia' ? "bg-black/20 text-white font-mono" : "bg-text-primary/5 text-text-muted font-mono"
              )}>
                {countEmDia}
              </span>
            </button>
          </div>

          <div className="shrink-0 flex items-center pl-1">
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-brand-surface-2 text-text-primary border border-border-subtle text-[11px] font-bold rounded-xl pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-brand-primary cursor-pointer appearance-none shadow-sm"
                style={{ backgroundColor: 'var(--brand-surface-2)', color: 'var(--text-primary)' }}
              >
                <option value="vencimento" className="bg-brand-surface-2 text-text-primary">📅 Vencimento</option>
                <option value="nome" className="bg-brand-surface-2 text-text-primary">🔤 Nome (A-Z)</option>
                <option value="atrasado" className="bg-brand-surface-2 text-text-primary">⚠️ Mais Atrasados</option>
                <option value="bairro" className="bg-brand-surface-2 text-text-primary">📍 Bairro</option>
              </select>
              <ArrowUpDown size={12} className="absolute right-2.5 text-brand-primary pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {rota.map((emp, idx) => {
            const cliente = clientes.find(c => c.id === emp.clienteId);
            const juros = calcularJurosAcumulados(emp);
            const multa = calcularMulta(emp);
            const atraso = getDiasAtraso(emp.dataVencimento);
            
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                layout
              >
                <Card className="p-0 overflow-hidden bg-brand-surface border-border-subtle shadow-md shadow-black/10">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-base leading-tight capitalize truncate max-w-[180px]">{cliente?.nome}</h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <MapPin size={10} className="text-brand-primary shrink-0" />
                          <p className="text-[10px] text-text-muted font-bold truncate max-w-[110px] uppercase tracking-tighter">
                            {cliente?.endereco.bairro}
                          </p>
                          {emp.modalidade === 'parcelado' ? (
                            <Badge className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-black px-1.5 py-0 shrink-0">
                              PARCELADO
                            </Badge>
                          ) : (
                            <Badge className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black px-1.5 py-0 shrink-0">
                              TRADICIONAL
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge className={cn(
                          "text-[9px] font-black px-2 py-0.5",
                          emp.status === 'atrasado' ? "bg-danger/10 text-danger border-danger/20" : "bg-success/10 text-success border-success/20"
                        )}>
                          {atraso > 0 ? `${atraso} DIAS ATRASO` : 'EM DIA'}
                        </Badge>
                        <span className="text-[9px] font-mono text-text-muted font-black">
                          Venc. {formatDate(emp.dataVencimento)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-2 rounded-xl bg-brand-surface-2 border border-border-subtle flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em] mb-1">
                          {emp.modalidade === 'parcelado' ? 'Valor Recebido' : 'Vl. Empréstimo'}
                        </span>
                        <span className="text-xs font-black font-mono text-text-primary">
                          {emp.modalidade === 'parcelado' 
                            ? formatCurrency(emp.valorPrincipalInicial) 
                            : formatCurrency(emp.valorPrincipalInicial || emp.valorPrincipal)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-brand-surface-2 border border-border-subtle flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em] mb-1">Saldo Devedor</span>
                        <span className="text-xs font-black font-mono text-brand-primary">{formatCurrency(emp.valorPrincipal)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="p-2 rounded-xl bg-brand-surface-2 border border-border-subtle flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em] mb-1">Juros</span>
                        <span className="text-xs font-black font-mono text-warning">
                          {emp.modalidade === 'parcelado' ? 'ISENTO' : formatCurrency(juros)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-brand-surface-2 border border-border-subtle flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em] mb-1">Multas</span>
                        <span className="text-xs font-black font-mono text-danger">{formatCurrency(multa)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-brand-surface-2 border border-border-subtle flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em] mb-1">Parcela</span>
                        <span className="text-xs font-black font-mono text-emerald-400">
                          {emp.modalidade === 'parcelado' 
                            ? `${formatCurrency(emp.valorParcela)}` 
                            : formatCurrency(emp.valorParcela)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        className="w-full h-12 rounded-xl font-black text-xs shadow-lg shadow-brand-primary/20 bg-linear-to-r from-brand-primary to-brand-primary/80 flex flex-col justify-center items-center py-1.5 gap-0" 
                        onClick={() => handleOpenPay(emp, 'regular')}
                      >
                        <div className="flex items-center gap-1.5 leading-none">
                          <HandCoins size={16} />
                          <span className="uppercase font-black">COBRAR AGORA</span>
                        </div>
                        {emp.modalidade === 'parcelado' && (
                          <span className="text-[9px] font-normal text-white/70 leading-none mt-0.5">
                            Parcela {Math.min(emp.totalParcelas, (emp.parcelasPagas || 0) + 1)} de {emp.totalParcelas}
                          </span>
                        )}
                      </Button>
                      
                      <div className="flex gap-2">
                        {emp.modalidade !== 'parcelado' && (
                          <Button 
                            variant="secondary" 
                            className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-tight bg-brand-surface-2 border-border-subtle flex flex-col gap-0 items-center justify-center pt-1" 
                            onClick={() => handleOpenPay(emp, 'somente_juros')}
                          >
                            <span className="opacity-50 text-[8px]">ACERTO</span>
                            SÓ JUROS
                          </Button>
                        )}
                        <Button 
                          variant="secondary" 
                          className={`flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-tight bg-danger/5 border-danger/10 text-danger flex flex-col gap-0 items-center justify-center pt-1`} 
                          onClick={() => handleOpenPay(emp, 'multa')}
                        >
                          <span className="opacity-50 text-[8px]">REAJUSTE</span>
                          SÓ MULTA
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-tight bg-brand-surface-2 border-border-subtle flex flex-col gap-0 items-center justify-center pt-1" 
                          onClick={() => handleOpenPay(emp, 'quitacao')}
                        >
                          <span className="opacity-50 text-[8px]">FINAL</span>
                          QUITAÇÃO
                        </Button>
                      </div>

                    <div className="flex gap-2 pt-1 border-t border-border-subtle mt-2">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        className="flex-1 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center gap-2 font-black text-[10px] uppercase"
                        onClick={() => {
                          const message = generateWhatsAppMessage(emp, cliente);
                          window.open(`https://wa.me/55${cliente?.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                      >
                        <MessageCircle size={16} />
                        WhatsApp
                      </motion.button>
                      
                      <div className="flex gap-1 shrink-0">
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          className="w-10 h-10 rounded-xl bg-brand-surface-2 border border-border-subtle flex items-center justify-center text-indigo-400 font-bold hover:bg-text-primary/5"
                          title="Pasta do Cliente"
                          onClick={() => {
                            setSelectedFolderCliente(cliente);
                            setIsFolderModalOpen(true);
                          }}
                        >
                          <FolderOpen size={18} />
                        </motion.button>

                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          className="w-10 h-10 rounded-xl bg-brand-surface-2 border border-border-subtle flex items-center justify-center text-text-secondary"
                          onClick={() => {
                            const recs = recebimentos.filter(r => r.emprestimoId === emp.id);
                            gerarExtratoPagamentos(emp, cliente, recs, config);
                            toast.success('Extrato PDF gerado!');
                          }}
                        >
                          <FileText size={18} />
                        </motion.button>
                        
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          className="w-10 h-10 rounded-xl bg-brand-surface-2 border border-border-subtle flex items-center justify-center text-brand-primary"
                          onClick={() => window.open(`tel:${cliente?.telefone}`, '_blank')}
                        >
                          <Phone size={18} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {rota.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center space-y-4"
          >
            <div className="w-20 h-20 rounded-full bg-brand-surface-2 border-2 border-dashed border-border-subtle flex items-center justify-center mx-auto text-text-muted/30">
              <MapPin size={40} />
            </div>
            <div>
              <p className="font-black text-text-secondary text-sm uppercase tracking-widest">Rota Finalizada</p>
              <p className="text-[10px] text-text-muted mt-1">Ótimo trabalho! Todos os clientes foram visitados.</p>
            </div>
          </motion.div>
        )}
      </div>

      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Confirmar Recebimento</span>
            <span className="text-sm font-black truncate">{clientes.find(c => c.id === selectedEmp?.clienteId)?.nome}</span>
          </div>
        }
        footer={
          <div className="flex gap-3 w-full p-2">
            <Button variant="ghost" className="flex-1 font-black" onClick={() => setIsPayModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1 font-black shadow-lg shadow-brand-primary/20" onClick={handleConfirmPay}>Confirmar</Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             <div className="p-3 rounded-2xl bg-brand-surface-2 border border-border-subtle flex items-center justify-between sm:flex-col sm:items-start">
                <span className="text-[8px] font-black uppercase text-text-muted mb-1 block">Tipo Selecionado</span>
                <Badge variant={payType === 'multa' ? 'danger' : 'neutral'} className="text-[9px] font-black">
                  {payType.toUpperCase()}
                </Badge>
             </div>
             <div className="p-3 rounded-2xl bg-brand-surface-2 border border-border-subtle flex items-center justify-between sm:flex-col sm:items-start">
                <span className="text-[8px] font-black uppercase text-text-muted mb-1 block">Saldo Devedor</span>
                <span className="text-xs font-black font-mono">{formatCurrency(selectedEmp?.valorPrincipal)}</span>
             </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Valor Recebido (R$)"
              type="number"
              inputClassName="text-xl font-mono font-black py-4"
              value={payValue}
              onChange={e => setPayValue(e.target.value)}
            />

            {selectedEmp?.modalidade === 'parcelado' && payType === 'regular' && parseFloat(payValue) > 0 && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between">
                <span>Identificado automaticamente:</span>
                <span className="font-bold font-mono text-emerald-300">
                  {Math.max(1, Math.round(parseFloat(payValue) / (parseFloat(selectedEmp.valorParcela) || 1)))} parcela(s) ({formatCurrency(parseFloat(selectedEmp.valorParcela) || 0)} cada)
                </span>
              </div>
            )}

            <Input
              label="Data do Recebimento"
              type="date"
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Observação Interna</label>
              <textarea
                className="input-field min-h-[80px] py-3 text-sm font-medium"
                placeholder="Ex: Dinheiro em mãos..."
                value={payObs}
                onChange={e => setPayObs(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title={
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Pasta do Cliente</span>
            <span className="text-base font-black truncate text-text-primary">{selectedFolderCliente?.nome}</span>
          </div>
        }
        footer={
          <div className="flex w-full p-2">
            <Button className="w-full font-black bg-brand-primary text-white" onClick={() => setIsFolderModalOpen(false)}>Fechar Pasta</Button>
          </div>
        }
      >
        {selectedFolderCliente && (
          <div className="space-y-6 py-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin text-left">
            {/* Informações Pessoais */}
            <div className="p-4 rounded-2xl bg-brand-surface-2 border border-border-subtle space-y-3">
              <h5 className="text-xs font-black text-brand-primary uppercase tracking-wider">Dados Básicos</h5>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-text-muted block text-[10px]">CPF/CNPJ</span>
                  <span className="font-bold font-mono text-text-primary">{selectedFolderCliente.cpfCnpj || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px]">Telefone</span>
                  <a href={`tel:${selectedFolderCliente.telefone}`} className="font-bold text-text-primary underline hover:text-brand-primary flex items-center gap-1">
                    <Phone size={10} /> {selectedFolderCliente.telefone}
                  </a>
                </div>
              </div>
              <div className="pt-2 border-t border-text-primary/5">
                <span className="text-text-muted block text-[10px] mb-1">Endereço</span>
                <p className="text-xs font-bold text-text-primary pb-2 leading-relaxed">
                  {selectedFolderCliente.endereco.rua}, {selectedFolderCliente.endereco.numero} <br />
                  {selectedFolderCliente.endereco.bairro} - {selectedFolderCliente.endereco.cidade}
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full gap-2 text-[10px] font-black uppercase mt-1 text-text-secondary border-text-primary/10 shrink-0"
                  onClick={() => {
                    const { rua, numero, bairro, cidade } = selectedFolderCliente.endereco;
                    const query = `${rua}, ${numero} - ${bairro}, ${cidade}`;
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                  }}
                >
                  <Compass size={14} className="text-brand-primary" />
                  Como Chegar (Maps)
                </Button>
              </div>
            </div>

            {/* Empréstimos */}
            <div className="space-y-3 text-left">
              <h5 className="text-xs font-black text-brand-primary uppercase tracking-wider">Contratos & Empréstimos</h5>
              <div className="space-y-3">
                {emprestimos
                  .filter(e => e.clienteId === selectedFolderCliente.id)
                  .map(e => {
                    const status = calcularStatus(e);
                    const isAtivo = status !== 'pago';
                    return (
                      <div key={e.id} className={cn("p-4 rounded-xl border flex flex-col gap-3 text-left", isAtivo ? "bg-text-primary/5 border-text-primary/10" : "bg-text-primary/[0.02] border-text-primary/5 opacity-60")}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-text-primary text-left">Contrato: <span className="font-mono text-brand-primary">#{e.id.substring(0, 6).toUpperCase()}</span></span>
                          <Badge variant={status === 'atrasado' ? 'danger' : status === 'pago' ? 'neutral' : 'success'} className="text-[9px] font-black uppercase shrink-0">
                            {status === 'atrasado' ? 'EM ATRASO' : status === 'pago' ? 'PAGO / QUITADO' : 'REGULAR'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-left">
                          <div>
                            <span className="text-text-muted block text-[9px] text-left">Valor Original</span>
                            <span className="font-black text-text-primary font-mono">{formatCurrency(e.valorPrincipalInicial || e.valorPrincipal)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted block text-[9px] text-left">Saldo Atual</span>
                            <span className="font-black text-brand-primary font-mono">{formatCurrency(e.valorPrincipal)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted block text-[9px] text-left">Parcela</span>
                            <span className="font-bold text-text-primary font-mono">{formatCurrency(e.valorParcela)} ({e.parcelasPagas || 0}/{e.totalParcelas || 10})</span>
                          </div>
                          <div>
                            <span className="text-text-muted block text-[9px] text-left">Vencimento</span>
                            <span className="font-bold text-text-primary font-mono">{formatDate(e.dataVencimento)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {emprestimos.filter(e => e.clienteId === selectedFolderCliente.id).length === 0 && (
                  <p className="text-xs text-text-muted text-center py-4 bg-text-primary/5 rounded-xl border border-dashed border-text-primary/10">Nenhum contrato encontrado.</p>
                )}
              </div>
            </div>

            {/* Histórico de Recebimentos */}
            <div className="space-y-3 text-left">
              <h5 className="text-xs font-black text-brand-primary uppercase tracking-wider">Histórico de Pagamentos</h5>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {recebimentos
                  .filter(r => r.clienteId === selectedFolderCliente.id)
                  .sort((a, b) => new Date(b.dataRecebimento).getTime() - new Date(a.dataRecebimento).getTime())
                  .map(r => (
                    <div key={r.id} className="p-3 rounded-xl bg-text-primary/5 border border-text-primary/5 flex flex-col gap-1 text-xs text-left">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-text-primary font-mono">{formatCurrency(r.valor)}</span>
                        <Badge className="text-[8px] px-1.5 py-0.5 uppercase tracking-tighter shrink-0" variant={r.tipo === 'quitacao' ? 'success' : r.tipo === 'multa' ? 'danger' : 'neutral'}>
                          {r.tipo.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-[10px] text-text-muted">
                        <span>{formatDate(r.dataRecebimento)}</span>
                        {r.observacao && <span className="italic max-w-[150px] truncate">{r.observacao}</span>}
                      </div>
                    </div>
                  ))}
                {recebimentos.filter(r => r.clienteId === selectedFolderCliente.id).length === 0 && (
                  <p className="text-xs text-text-muted text-center py-4 bg-text-primary/5 rounded-xl border border-dashed border-text-primary/10">Nenhum pagamento registrado.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Filtro e Ordenação Detalhado */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filtrar e Ordenar Rota"
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button 
              variant="ghost" 
              onClick={() => {
                setStatusFilter('todos');
                setSortBy('vencimento');
                setSearchTerm('');
              }}
            >
              Restaurar
            </Button>
            <Button onClick={() => setIsFilterModalOpen(false)}>
              Aplicar
            </Button>
          </div>
        }
      >
        <div className="space-y-5 text-left">
          {/* Status Filter Section */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-text-muted mb-2.5 block">
              Filtrar por Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('todos')}
                className={cn(
                  "p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                  statusFilter === 'todos' 
                    ? "bg-brand-primary/20 border-brand-primary text-brand-primary" 
                    : "bg-brand-surface border-border-subtle text-text-secondary hover:bg-brand-surface-2"
                )}
              >
                <span>Todos</span>
                <span className="text-[10px] font-mono text-text-muted">({countTodos})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('atrasado')}
                className={cn(
                  "p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                  statusFilter === 'atrasado' 
                    ? "bg-danger/20 border-danger text-danger" 
                    : "bg-brand-surface border-border-subtle text-text-secondary hover:bg-brand-surface-2"
                )}
              >
                <span>Atrasados</span>
                <span className="text-[10px] font-mono text-text-muted">({countAtrasados})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('em_dia')}
                className={cn(
                  "p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                  statusFilter === 'em_dia' 
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                    : "bg-brand-surface border-border-subtle text-text-secondary hover:bg-brand-surface-2"
                )}
              >
                <span>Em Dia</span>
                <span className="text-[10px] font-mono text-text-muted">({countEmDia})</span>
              </button>
            </div>
          </div>

          {/* Sort By Section */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-text-muted mb-2.5 block">
              Ordenar Lista por
            </label>
            <div className="space-y-2">
              {[
                { id: 'vencimento', label: 'Data de Vencimento (Mais próximos)', icon: Clock },
                { id: 'nome', label: 'Ordem Alfabética (A-Z)', icon: SortAsc },
                { id: 'atrasado', label: 'Mais Atrasados Primeiro', icon: SlidersHorizontal },
                { id: 'bairro', label: 'Bairro do Cliente', icon: MapPin },
              ].map(item => {
                const ItemIcon = item.icon;
                const isSelected = sortBy === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSortBy(item.id)}
                    className={cn(
                      "w-full p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                      isSelected 
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary" 
                        : "bg-brand-surface border-border-subtle text-text-secondary hover:bg-brand-surface-2"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <ItemIcon size={16} />
                      <span>{item.label}</span>
                    </div>
                    {isSelected && <Check size={16} className="text-brand-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
