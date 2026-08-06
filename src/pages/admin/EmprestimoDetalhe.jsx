import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button, Card, Badge, Modal, Input, cn } from '../../components/ui';
import { formatCurrency, formatDate, formatCPF, substituirVariaveis, buildExtratoQuitacaoMessage } from '../../utils/formatters';
import { 
  ArrowLeft, 
  HandCoins, 
  Calendar, 
  User, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Printer,
  ChevronRight,
  MessageCircle,
  Trash2,
  Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { proximoVencimento, calcularPayoff, calcularMulta, calcularStatus, calcularJurosAcumulados, getDiasAtraso, getQuantidadePeriodosAcumulados, getJuroPorPeriodo, calcularQuitacaoAtualizada } from '../../utils/calculosEmprestimo';
import { gerarComprovante, gerarContratoPDF, gerarExtratoPagamentos } from '../../services/pdfService';

export default function EmprestimoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { emprestimos, clientes, cobradores, recebimentos, adicionarRecebimento, removerRecebimento, editarEmprestimo, removerEmprestimo, config } = useAppStore();

  const empOriginal = emprestimos.find(e => e.id === id);
  const emp = empOriginal ? { ...empOriginal, status: calcularStatus(empOriginal) } : null;
  const cliente = clientes.find(c => c?.id === emp?.clienteId);
  const cobrador = cobradores.find(c => c?.id === emp?.cobradorId);
  const historico = recebimentos.filter(r => r.emprestimoId === id).sort((a, b) => new Date(b.dataRecebimento) - new Date(a.dataRecebimento));
  const quitacaoInfo = emp ? calcularQuitacaoAtualizada(emp) : null;

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteReceiptModalOpen, setIsDeleteReceiptModalOpen] = useState(false);
  const [isEditCollectorModalOpen, setIsEditCollectorModalOpen] = useState(false);
  const [isEditDueDateModalOpen, setIsEditDueDateModalOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [selectedCobradorId, setSelectedCobradorId] = useState(emp?.cobradorId || '');
  const [paymentType, setPaymentType] = useState('regular');
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentObs, setPaymentObs] = useState('');

  if (!emp || !cliente) return <div>Empréstimo não encontrado.</div>;  const openPaymentModal = (type) => {
    setPaymentType(type);
    const jurosAcumulados = calcularJurosAcumulados(emp);
    if (type === 'regular') {
      if (emp.modalidade === 'parcelado') {
        // Para parcelado fixo, sugere o valor de uma parcela + qualquer multa por atraso acumulada
        const multa = calcularMulta(emp);
        setPaymentValue((parseFloat(emp.valorParcela || 0) + multa).toFixed(2));
      } else {
        // Sugere o juro acumulado + uma parte da amortização se houver parcelas definidas
        const amortizacaoSugerida = emp.totalParcelas > 0 ? (emp.valorPrincipal / emp.totalParcelas) : 0;
        setPaymentValue((jurosAcumulados + amortizacaoSugerida).toFixed(2));
      }
    } else if (type === 'quitacao') {
      setPaymentValue(calcularPayoff(emp).toFixed(2));
    } else if (type === 'multa') {
      setPaymentValue(calcularMulta(emp).toFixed(2));
    } else {
      setPaymentValue(jurosAcumulados.toFixed(2));
    }
    setIsPaymentModalOpen(true);
  };

  const handlePayment = () => {
    const valor = parseFloat(paymentValue);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Valor inválido.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let dataRecebimentoIso;
    if (!paymentDate || paymentDate === todayStr) {
      dataRecebimentoIso = new Date().toISOString();
    } else {
      dataRecebimentoIso = new Date(paymentDate + 'T12:00:00').toISOString();
    }

    const novoRecebimento = {
      emprestimoId: emp.id,
      clienteId: cliente.id,
      tipo: paymentType,
      valor: valor,
      cobradorId: emp.cobradorId,
      dataRecebimento: dataRecebimentoIso,
      observacao: paymentObs
    };

    adicionarRecebimento(novoRecebimento);

    let novosDados = { ...emp };
    const jurosAcumulados = calcularJurosAcumulados(emp);
    const juroPorPeriodo = getJuroPorPeriodo(emp);

    // Se estiver atrasado e for pagar juros/regular, a multa dinâmica atual "congela" na multaAcumulada
    // para que não desapareça quando a data de vencimento avançar.
    const diasAtraso = getDiasAtraso(emp.dataVencimento);
    if (diasAtraso > (parseInt(emp.carenciaDias) || 0) && (paymentType === 'regular' || paymentType === 'somente_juros')) {
      const multaDinamica = calcularMulta({ ...emp, multaAcumulada: 0 });
      novosDados.multaAcumulada = (parseFloat(emp.multaAcumulada) || 0) + multaDinamica;
    }

    if (paymentType === 'regular') {
      if (emp.modalidade === 'parcelado') {
        const valP = parseFloat(emp.valorParcela) || 0;
        const totalP = parseInt(emp.totalParcelas) || 10;
        const pagasAtuais = parseInt(emp.parcelasPagas) || 0;
        
        // Identifica automaticamente quantas parcelas este valor cobre (ex: R$ 200 com parcela de R$ 100 = 2 parcelas)
        const numParcelasContadas = valP > 0 ? Math.max(1, Math.round(valor / valP)) : 1;
        const parcelasRestantes = Math.max(0, totalP - pagasAtuais);
        const parcelasQuitadasNestePagamento = Math.min(parcelasRestantes, numParcelasContadas);
        const novasPagas = pagasAtuais + parcelasQuitadasNestePagamento;

        novosDados.parcelasPagas = novasPagas;
        
        // Vencimento avança de acordo com a frequencia e o numero de parcelas quitadas neste pagamento
        novosDados.dataVencimento = proximoVencimento(emp.dataVencimento, emp.frequencia, parcelasQuitadasNestePagamento, emp.diaVencimento);
        
        // Se houver multa, subtraímos do acumulado o excedente pago além das parcelas
        const multaAtual = calcularMulta(emp);
        if (multaAtual > 0) {
          const valorExcedente = Math.max(0, valor - (valP * parcelasQuitadasNestePagamento));
          const sobraMulta = Math.max(0, multaAtual - valorExcedente);
          novosDados.multaAcumulada = sobraMulta;
        }

        // Saldo devedor restante
        novosDados.valorPrincipal = Math.max(0, (totalP - novasPagas) * valP);

        if (novosDados.parcelasPagas >= totalP) {
          novosDados.status = 'pago';
          novosDados.valorPrincipal = 0;
        }
      } else {
        const juroPorPeriodo = getJuroPorPeriodo(emp);
        const abatimentoAnterior = parseFloat(emp.abatimentoJuros) || 0;
        const jurosAcumuladosSemAbatimento = calcularJurosAcumulados(emp) + abatimentoAnterior;
        
        const totalDisponivel = valor + abatimentoAnterior;
        
        // Primeiro quitamos os juros acumulados
        const valorParaJuros = Math.min(totalDisponivel, jurosAcumuladosSemAbatimento);
        const periodosPagos = Math.floor(valorParaJuros / juroPorPeriodo);
        const custoJurosPagos = periodosPagos * juroPorPeriodo;
        
        // O que sobrar do valor destinado a juros mas que não completa um período vira o novo abatimento
        novosDados.abatimentoJuros = valorParaJuros - custoJurosPagos;
        
        // O que sobrar do total após quitar todos os juros acumulados vai para amortização
        const amortizacao = Math.max(0, totalDisponivel - jurosAcumuladosSemAbatimento);
        
        novosDados.valorPrincipal = Math.max(0, emp.valorPrincipal - amortizacao);
        novosDados.valorParcela = novosDados.valorPrincipal * (emp.taxaJuros / 100);
        
        if (periodosPagos > 0) {
          novosDados.dataVencimento = proximoVencimento(emp.dataVencimento, emp.frequencia, periodosPagos);
        }
        
        if (novosDados.valorPrincipal <= 0) {
          novosDados.status = 'pago';
          novosDados.valorPrincipal = 0;
        }
      }
    } else if (paymentType === 'quitacao') {
      novosDados.status = 'pago';
      novosDados.valorPrincipal = 0;
      novosDados.saldoDevedor = 0;
      novosDados.multaAcumulada = 0;
      novosDados.abatimentoJuros = 0;
      if (emp.modalidade === 'parcelado') {
        novosDados.parcelasPagas = parseInt(emp.totalParcelas) || 10;
      }
    } else if (paymentType === 'somente_juros') {
      if (emp.modalidade === 'parcelado') {
        toast.error('Operação não disponível para empréstimo parcelado.');
        return;
      } else {
        const juroPorPeriodo = getJuroPorPeriodo(emp);
        const abatimentoAnterior = parseFloat(emp.abatimentoJuros) || 0;
        const totalDisponivel = valor + abatimentoAnterior;
        
        const periodosPagos = Math.floor(totalDisponivel / juroPorPeriodo);
        const custoJurosPagos = periodosPagos * juroPorPeriodo;
        
        novosDados.abatimentoJuros = totalDisponivel - custoJurosPagos;
        
        if (periodosPagos > 0) {
          novosDados.dataVencimento = proximoVencimento(emp.dataVencimento, emp.frequencia, periodosPagos);
        }
      }
    } else if (paymentType === 'multa') {
      novosDados.multaAcumulada = Math.max(0, (parseFloat(emp.multaAcumulada) || 0) - valor);
    }

    // Sincroniza saldoDevedor para compatibilidade com outras partes do app
    novosDados.saldoDevedor = novosDados.valorPrincipal;
    
    // Recalcula o status com base nos novos dados (especialmente novo vencimento)
    novosDados.status = calcularStatus(novosDados);

    editarEmprestimo(emp.id, novosDados);
    toast.success('Pagamento registrado!');
    setIsPaymentModalOpen(false);
    
    // Oferece PDF
    if (window.confirm('Deseja gerar o comprovante PDF?')) {
      gerarComprovante(novoRecebimento, novosDados, cliente, cobrador, config);
    }
  };

  const handleDelete = () => {
    removerEmprestimo(emp.id);
    toast.success('Contrato excluído com sucesso.');
    navigate('/app/emprestimos');
  };

  const handleDeleteReceipt = () => {
    if (!receiptToDelete) return;
    removerRecebimento(receiptToDelete.id);
    toast.success('Pagamento removido e saldo do contrato atualizado.');
    setIsDeleteReceiptModalOpen(false);
    setReceiptToDelete(null);
  };

  const handleUpdateCollector = () => {
    if (!selectedCobradorId) {
      toast.error('Selecione um cobrador.');
      return;
    }
    editarEmprestimo(emp.id, { cobradorId: selectedCobradorId });
    toast.success('Cobrador atualizado com sucesso!');
    setIsEditCollectorModalOpen(false);
  };

  const handleOpenEditDueDateModal = () => {
    let dateStr = '';
    if (emp?.dataVencimento) {
      try {
        dateStr = new Date(emp.dataVencimento).toISOString().split('T')[0];
      } catch (e) {
        dateStr = '';
      }
    }
    setNewDueDate(dateStr);
    setIsEditDueDateModalOpen(true);
  };

  const handleSaveDueDate = () => {
    if (!newDueDate) {
      toast.error('Selecione uma data de vencimento válida.');
      return;
    }

    const selectedDate = new Date(newDueDate + 'T12:00:00');
    const isoString = selectedDate.toISOString();
    
    const novosDados = {
      ...emp,
      dataVencimento: isoString
    };
    const novoStatus = calcularStatus(novosDados);

    editarEmprestimo(emp.id, {
      dataVencimento: isoString,
      status: novoStatus
    });

    toast.success('Data de vencimento alterada com sucesso!');
    setIsEditDueDateModalOpen(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl glass hover:bg-text-primary/10 transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Contrato #{emp.id.slice(0, 8).toUpperCase()}</h2>
            <p className="text-sm text-text-secondary truncate">Gestão de pagamentos e detalhes do contrato.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
          <button 
            type="button"
            onClick={handleOpenEditDueDateModal}
            className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 text-xs font-semibold px-3"
            title="Editar Data de Vencimento"
          >
            <Pencil size={16} />
            <span>Editar Vencimento</span>
          </button>
          <button 
            type="button"
            onClick={() => gerarContratoPDF(emp, cliente, config)}
            className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
            title="Baixar Contrato PDF"
          >
            <Download size={20} />
          </button>
          <button 
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
            title="Excluir Contrato"
          >
            <Trash2 size={20} />
          </button>
          <Badge variant={emp.status === 'atrasado' ? 'danger' : emp.status === 'pago' ? 'neutral' : 'success'} className="text-xs sm:text-sm px-3 sm:px-4 py-1">
            {emp.status === 'atrasado' ? 'EM ATRASO' : emp.status === 'pago' ? 'QUITADO' : 'REGULAR'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Coluna Esquerda: Resumo e Ações */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Card className="p-4 sm:p-6 bg-linear-to-br from-brand-surface to-brand-surface-2 border-brand-primary/20">
              <p className="text-[10px] sm:text-xs text-text-muted uppercase font-bold tracking-widest mb-1">Capital em Aberto</p>
              <h3 className="text-3xl sm:text-4xl font-bold font-mono text-brand-primary truncate">{formatCurrency(emp.valorPrincipal)}</h3>
              <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 text-text-secondary min-w-0">
                  <Clock size={14} className="shrink-0" />
                  <span className="text-xs truncate">Venc: <strong className="text-text-primary">{formatDate(emp.dataVencimento)}</strong></span>
                  <button
                    type="button"
                    onClick={handleOpenEditDueDateModal}
                    className="p-1 rounded-md bg-text-primary/5 hover:bg-text-primary/10 text-amber-400 transition-colors shrink-0"
                    title="Editar Data de Vencimento"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-[10px] text-text-muted uppercase truncate">Juros Acumulados</p>
                  <div className="flex items-center gap-2 justify-end">
                    <p className="text-sm font-bold text-warning font-mono whitespace-nowrap">{formatCurrency(calcularJurosAcumulados(emp))}</p>
                    <button 
                      onClick={() => {
                        const juros = calcularJurosAcumulados(emp);
                        const msg = substituirVariaveis(config.templateCobranca, {
                          cliente: cliente.nome,
                          valor: juros,
                          dataVencimento: emp.dataVencimento
                        });
                        window.open(`https://wa.me/55${cliente.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors shrink-0"
                      title="Cobrar Juros no WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <p className="text-[10px] sm:text-xs text-text-muted uppercase font-bold tracking-widest mb-1">Resumo do Contrato</p>
              <div className="space-y-4 mt-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm text-text-secondary truncate">
                    {emp.modalidade === 'parcelado' ? "Valor Emprestado" : "Principal Inicial"}
                  </span>
                  <span className="text-xs sm:text-sm font-bold font-mono whitespace-nowrap">
                    {emp.modalidade === 'parcelado' 
                      ? formatCurrency(emp.valorPrincipalInicial) 
                      : formatCurrency(emp.valorPrincipalInicial || emp.valorPrincipal)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm text-text-secondary truncate">
                    {emp.modalidade === 'parcelado' ? "Valor por Parcela" : "Taxa de Juros"}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-brand-primary whitespace-nowrap">
                    {emp.modalidade === 'parcelado' 
                      ? `${formatCurrency(emp.valorParcela)} (${emp.parcelasPagas || 0}/${emp.totalParcelas} pgas)`
                      : `${emp.taxaJuros}% ao período`}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 text-danger font-bold">
                  <span className="text-xs sm:text-sm truncate">Multa Atual (Atraso)</span>
                  <span className="text-xs sm:text-sm font-mono whitespace-nowrap">{formatCurrency(calcularMulta(emp))}</span>
                </div>
                <div className="w-full h-2 bg-text-primary/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-primary transition-all duration-1000" 
                    style={{ 
                      width: `${Math.min(100, (
                        emp.modalidade === 'parcelado'
                          ? ((emp.parcelasPagas || 0) / (emp.totalParcelas || 10)) * 100
                          : (1 - (emp.valorPrincipal / (emp.valorPrincipalInicial || emp.valorPrincipal))) * 100
                      ))}%` 
                    }} 
                  />
                </div>
                <p className="text-[10px] text-text-muted text-center uppercase">
                  {emp.modalidade === 'parcelado' ? "Progresso das parcelas pagas" : "Dívida quitada em relação ao início"}
                </p>
              </div>
            </Card>
          </div>

          {quitacaoInfo?.estaAtrasado && (
            <Card className="p-4 sm:p-6 border-warning/30 bg-warning/5 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-warning/10 pb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-warning" />
                  <h4 className="font-bold text-sm sm:text-base text-warning uppercase tracking-wider">Resumo para Quitação</h4>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs border-warning/30 text-warning hover:bg-warning/10 bg-transparent"
                    onClick={() => {
                      const msg = buildExtratoQuitacaoMessage(cliente, quitacaoInfo, config);
                      navigator.clipboard.writeText(msg);
                      toast.success('Resumo copiado para a área de transferência!');
                    }}
                  >
                    Copiar Resumo
                  </Button>
                  {cliente?.whatsapp && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-500 hover:text-white flex items-center justify-center gap-1"
                      onClick={() => {
                        const msg = buildExtratoQuitacaoMessage(cliente, quitacaoInfo, config);
                        window.open(`https://wa.me/55${cliente.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                    >
                      <MessageCircle size={14} />
                      Enviar WhatsApp
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-text-secondary">Capital / saldo devedor:</span>
                    <span className="font-bold font-mono text-text-primary">{formatCurrency(quitacaoInfo.saldoDevedor)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-text-secondary">Dias em atraso:</span>
                    <span className="font-bold font-mono text-warning">{quitacaoInfo.diasAtraso} dias</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-text-secondary">Multa fixa:</span>
                    <span className="font-bold font-mono text-text-primary">{formatCurrency(quitacaoInfo.multaFixaAplicada)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-text-secondary">Multa percentual:</span>
                    <span className="font-bold font-mono text-text-primary">{formatCurrency(quitacaoInfo.multaPercentualAplicada)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-text-secondary">Juros por atraso:</span>
                    <span className="font-bold font-mono text-text-primary">{formatCurrency(quitacaoInfo.multaDiariaAplicada)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm border-t border-text-primary/5 pt-2">
                    <span className="text-text-secondary font-bold">Total de encargos:</span>
                    <span className="font-bold font-mono text-danger">{formatCurrency(quitacaoInfo.totalEncargosAtraso)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-warning/20 flex flex-col sm:flex-row justify-between items-center gap-2 bg-warning/5 p-3 rounded-xl">
                <span className="text-sm font-bold text-warning uppercase">Total para Quitação Hoje:</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">{formatCurrency(quitacaoInfo.totalQuitacao)}</span>
              </div>
            </Card>
          )}

          <div className="mt-4"></div>

          {emp.status !== 'pago' && (
            <div className={`grid gap-3 sm:gap-4 font-sans ${emp.modalidade === 'parcelado' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <Button onClick={() => openPaymentModal('regular')} className="h-16 flex-col gap-1 p-2">
                <CheckCircle2 size={18} />
                <span className="text-[10px] sm:text-xs font-bold">
                  {emp.modalidade === 'parcelado' ? 'Pagar Parcela' : 'Pago Regular'}
                </span>
              </Button>
              {emp.modalidade !== 'parcelado' && (
                <Button variant="secondary" onClick={() => openPaymentModal('somente_juros')} className="h-16 flex-col gap-1 p-2">
                  <HandCoins size={18} />
                  <span className="text-[10px] sm:text-xs font-bold">Somente Juros</span>
                </Button>
              )}
              <Button variant="outline" onClick={() => openPaymentModal('multa')} className="h-16 flex-col gap-1 border-danger text-danger hover:bg-danger/10 p-2">
                <AlertCircle size={18} />
                <span className="text-[10px] sm:text-xs font-bold">Quitar Multa</span>
              </Button>
              <Button variant="outline" onClick={() => openPaymentModal('quitacao')} className="h-16 flex-col gap-1 border-brand-primary text-brand-primary hover:bg-brand-primary/10 p-2">
                <HandCoins size={18} />
                <span className="text-[10px] sm:text-xs font-bold">Quitar Contrato</span>
              </Button>
            </div>
          )}

          <Card className="p-0 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-border-subtle flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center bg-text-primary/5">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-brand-primary shrink-0" />
                <h4 className="font-bold text-sm sm:text-base">Historico de Recebimentos</h4>
              </div>
              {historico.length > 0 && (
                <button 
                  onClick={() => gerarExtratoPagamentos(emp, cliente, historico, config)}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                >
                  <Download size={14} />
                  Extrato de Pagamentos
                </button>
              )}
            </div>
            <div className="divide-y divide-border-subtle">
              {historico.map(rec => (
                <div key={rec.id} className="px-4 sm:px-6 py-4 flex justify-between items-center hover:bg-text-primary/5 transition-colors group gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0",
                      rec.tipo === 'quitacao' ? "bg-brand-primary/10 text-brand-primary" : "bg-success/10 text-success"
                    )}>
                      <HandCoins size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold font-mono truncate">{formatCurrency(rec.valor)}</p>
                      <p className="text-[10px] sm:text-xs text-text-muted truncate">{formatDate(rec.dataRecebimento)} • {rec.tipo.toUpperCase()}</p>
                      {rec.observacao && (
                        <p className="text-[10px] text-brand-primary mt-1 italic truncate">"{rec.observacao}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => gerarComprovante(rec, emp, cliente, cobrador, config)}
                      className="p-2 rounded-lg bg-text-primary/5 hover:bg-text-primary/10 text-text-muted hover:text-text-primary transition-colors"
                      title="Baixar Comprovante"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setReceiptToDelete(rec);
                        setIsDeleteReceiptModalOpen(true);
                      }}
                      className="p-2 rounded-lg bg-danger/5 hover:bg-danger/10 text-danger/70 hover:text-danger transition-colors"
                      title="Excluir Pagamento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {historico.length === 0 && (
                <div className="p-12 text-center text-text-muted opacity-50 text-sm">
                  Nenhum pagamento registrado ainda.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Coluna Direita: Detalhes do Contrato */}
        <div className="space-y-6">
          <Card className="p-4 sm:p-6">
            <h4 className="font-bold mb-6 flex items-center gap-2 text-sm sm:text-base">
              <User size={18} className="text-brand-primary shrink-0" />
              Dados do Cliente
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-text-primary/5 cursor-pointer hover:bg-text-primary/10 transition-colors gap-2" onClick={() => navigate(`/app/clientes/${cliente.id}`)}>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold truncate">{cliente.nome}</p>
                  <p className="text-[10px] sm:text-xs text-text-muted font-mono truncate">{formatCPF(cliente.cpfCnpj)}</p>
                </div>
                <ChevronRight size={16} className="text-text-muted shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 rounded-xl bg-text-primary/5 group relative min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-text-muted uppercase font-bold truncate">Cobrador</p>
                  <p className="text-xs sm:text-sm font-medium truncate">{cobrador?.nome || 'N/A'}</p>
                  <button 
                    onClick={() => {
                      setSelectedCobradorId(emp.cobradorId);
                      setIsEditCollectorModalOpen(true);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md bg-brand-primary/10 text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Alterar Cobrador"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-text-primary/5 min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-text-muted uppercase font-bold truncate">Taxa</p>
                  <p className="text-xs sm:text-sm font-medium truncate">{emp.taxaJuros}% ao período</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <h4 className="font-bold mb-6 flex items-center gap-2 text-sm sm:text-base">
              <AlertCircle size={18} className="text-warning shrink-0" />
              Regras de Multa
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center gap-2 text-xs sm:text-sm">
                <span className="text-text-secondary truncate">Dias Atrasados</span>
                <span className={cn("font-bold font-mono whitespace-nowrap", getDiasAtraso(emp.dataVencimento) > 0 ? "text-danger" : "")}>
                  {getDiasAtraso(emp.dataVencimento)} dias
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 text-xs sm:text-sm">
                <span className="text-text-secondary truncate">Multa Fixa</span>
                <span className="font-bold font-mono whitespace-nowrap">{formatCurrency(emp.multaFixa)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-xs sm:text-sm text-right">
                <span className="text-text-secondary truncate text-left block">Multa Diária</span>
                <span className="font-bold font-mono whitespace-nowrap">{formatCurrency(emp.multaDiaria)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-xs sm:text-sm text-right">
                <span className="text-text-secondary truncate text-left block">Multa Percentual</span>
                <span className="font-bold font-mono whitespace-nowrap">{emp.multaPercentual}%</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-xs sm:text-sm text-right">
                <span className="text-text-secondary truncate text-left block">Carência</span>
                <span className="font-bold font-mono whitespace-nowrap">{emp.carenciaDias} dias</span>
              </div>
              <div className="pt-3 border-t border-border-subtle flex justify-between items-center gap-2 text-xs sm:text-sm text-right">
                <span className="text-text-secondary truncate text-left block text-danger font-bold">Multa Atual</span>
                <span className="font-bold text-danger font-mono whitespace-nowrap">{formatCurrency(calcularMulta(emp))}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-danger/5 border-danger/10">
            <h4 className="font-bold text-danger text-xs sm:text-sm mb-2">Atenção</h4>
            <p className="text-[11px] sm:text-xs text-text-secondary leading-relaxed">
              Em caso de atraso superior a {emp.carenciaDias} dias, o sistema aplicará automaticamente as multas configuradas no cálculo de quitação.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Registrar Pagamento: ${paymentType.toUpperCase()}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={handlePayment}>Confirmar Recebimento</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor do Recebimento (R$)"
              type="number"
              value={paymentValue}
              onChange={e => setPaymentValue(e.target.value)}
              required
            />
            <Input
              label="Data do Pagamento"
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {emp.modalidade === 'parcelado' && paymentType === 'regular' && parseFloat(paymentValue) > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between">
              <span>Identificado automaticamente:</span>
              <span className="font-bold font-mono text-emerald-300">
                {Math.max(1, Math.round(parseFloat(paymentValue) / (parseFloat(emp.valorParcela) || 1)))} parcela(s) ({formatCurrency(parseFloat(emp.valorParcela) || 0)} cada)
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary ml-1">Observações</label>
            <textarea 
              className="input-field min-h-[100px] resize-none"
              placeholder="Ex: Pagamento parcial, via PIX..."
              value={paymentObs}
              onChange={e => setPaymentObs(e.target.value)}
            />
          </div>
          
          <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
            <p className="text-xs text-brand-primary font-bold uppercase mb-1">Resumo da Operação</p>
            <p className="text-sm text-text-secondary">
              {paymentType === 'regular' && `Paga os juros acumulados de ${formatCurrency(calcularJurosAcumulados(emp))} e amortiza o restante no capital principal. O vencimento avança para o próximo período.`}
              {paymentType === 'quitacao' && `Finaliza o contrato pagando o capital de ${formatCurrency(emp.valorPrincipal)} + juros acumulados e multas pendentes.`}
              {paymentType === 'somente_juros' && `Paga apenas os juros acumulados de ${formatCurrency(calcularJurosAcumulados(emp))}. O capital de ${formatCurrency(emp.valorPrincipal)} continua em aberto para o próximo período.`}
              {paymentType === 'multa' && `Paga exclusivamente as multas de atraso acumuladas de ${formatCurrency(calcularMulta(emp))}. Não altera o capital principal nem a data de vencimento.`}
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isEditCollectorModalOpen}
        onClose={() => setIsEditCollectorModalOpen(false)}
        title="Alterar Cobrador do Contrato"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditCollectorModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateCollector}>Salvar Alteração</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Selecione o novo cobrador responsável por este contrato.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary ml-1">Cobrador Responsável</label>
            <select 
              className="input-field"
              value={selectedCobradorId}
              onChange={e => setSelectedCobradorId(e.target.value)}
            >
              <option value="">Selecione um cobrador...</option>
              {cobradores.filter(c => c.ativo).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
            <p className="text-xs text-brand-primary font-bold uppercase mb-1">Impacto da Alteração</p>
            <p className="text-xs text-text-secondary">
              Este contrato passará a aparecer na rota do novo cobrador selecionado. O histórico de recebimentos anteriores permanecerá vinculado aos cobradores que realizaram as cobranças na época.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Excluir Contrato"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Confirmar Exclusão</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3">
            <AlertCircle className="text-danger shrink-0" size={24} />
            <div>
              <p className="text-sm font-bold text-danger uppercase">Atenção: Ação Irreversível</p>
              <p className="text-sm text-text-secondary mt-1">
                Você está prestes a excluir o contrato <strong>#{emp.id.slice(0, 8).toUpperCase()}</strong>. 
                Esta ação removerá permanentemente todos os dados deste empréstimo e seu histórico de pagamentos.
              </p>
            </div>
          </div>
          <p className="text-sm text-text-secondary px-1">
            Deseja realmente prosseguir com a exclusão?
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteReceiptModalOpen}
        onClose={() => setIsDeleteReceiptModalOpen(false)}
        title="Excluir Registro de Pagamento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteReceiptModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteReceipt}>Confirmar Exclusão</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3">
            <AlertCircle className="text-danger shrink-0" size={24} />
            <div>
              <p className="text-sm font-bold text-danger uppercase">Atenção</p>
              <p className="text-sm text-text-secondary mt-1">
                Você está prestes a excluir o registro de pagamento no valor de <strong>{receiptToDelete ? formatCurrency(receiptToDelete.valor) : ''}</strong> realizado em {receiptToDelete ? formatDate(receiptToDelete.dataRecebimento) : ''}.
              </p>
              <p className="text-xs text-brand-primary mt-2 font-bold">
                O valor deste pagamento será somado novamente ao saldo devedor do contrato.
              </p>
            </div>
          </div>
          <p className="text-sm text-text-secondary px-1">
            Deseja realmente excluir este registro?
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={isEditDueDateModalOpen}
        onClose={() => setIsEditDueDateModalOpen(false)}
        title="Editar Data de Vencimento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditDueDateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDueDate}>Salvar Nova Data</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Altere a data de vencimento deste contrato. O status do empréstimo (Regular ou Em Atraso) e o cálculo de encargos serão atualizados de acordo.
          </p>
          <Input
            label="Nova Data de Vencimento"
            type="date"
            value={newDueDate}
            onChange={e => setNewDueDate(e.target.value)}
            required
          />
          <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
            <p className="text-xs text-brand-primary font-bold uppercase mb-1">Informação do Contrato</p>
            <p className="text-xs text-text-secondary">
              Vencimento atual registrado: <strong>{formatDate(emp.dataVencimento)}</strong>
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
