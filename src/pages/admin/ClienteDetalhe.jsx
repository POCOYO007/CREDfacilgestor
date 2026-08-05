import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { formatCurrency, formatDate, formatCPF, formatPhone } from '../../utils/formatters';
import { HandCoins, Phone, MessageCircle, MapPin, Calendar, ArrowLeft, Plus, ChevronRight, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { calcularParcela, calcularStatus } from '../../utils/calculosEmprestimo';
import { gerarContratoPDF } from '../../services/pdfService';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clientes, emprestimos, cobradores, adicionarEmprestimo, removerCliente, config } = useAppStore();
  
  const cliente = clientes.find(c => c.id === id);
  const clienteEmprestimos = emprestimos.filter(e => e.clienteId === id).map(e => ({
    ...e,
    status: calcularStatus(e)
  }));
  const ativos = clienteEmprestimos.filter(e => e.status !== 'pago');
  const quitados = clienteEmprestimos.filter(e => e.status === 'pago');

  const [isEmprestimoModalOpen, setIsEmprestimoModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newEmprestimo, setNewEmprestimo] = useState({
    modalidade: 'tradicional', // 'tradicional' ou 'parcelado'
    valorPrincipal: '',
    taxaJuros: config.taxaPadrao || 10,
    frequencia: config.frequenciaPadrao || 'semanal',
    totalParcelas: '10',
    cobradorId: cobradores[0]?.id || '',
    dataInicio: new Date().toISOString().split('T')[0],
    carenciaDias: config.carenciaPadrao || 3,
    multaFixa: '0',
    multaDiaria: '0',
    multaPercentual: config.multaPercentualPadrao ?? '2',
    valorParcela: '',
    diaVencimento: '10'
  });

  // Atualiza os padrões quando o modal abre para garantir que pegue as configs mais recentes
  React.useEffect(() => {
    if (isEmprestimoModalOpen) {
      setNewEmprestimo(prev => ({
        ...prev,
        taxaJuros: config.taxaPadrao ?? prev.taxaJuros,
        frequencia: config.frequenciaPadrao ?? prev.frequencia,
        carenciaDias: config.carenciaPadrao ?? prev.carenciaDias,
        multaPercentual: config.multaPercentualPadrao ?? prev.multaPercentual,
        cobradorId: prev.cobradorId || cobradores[0]?.id || ''
      }));
    }
  }, [isEmprestimoModalOpen, config, cobradores]);

  if (!cliente) return <div>Cliente não encontrado.</div>;

  const handleCreateEmprestimo = (e) => {
    e.preventDefault();
    const principal = parseFloat(newEmprestimo.valorPrincipal);
    const taxa = parseFloat(newEmprestimo.taxaJuros) || 0;
    const parcelas = parseInt(newEmprestimo.totalParcelas);
    const carencia = parseInt(newEmprestimo.carenciaDias) || 0;
    const mFixa = parseFloat(newEmprestimo.multaFixa) || 0;
    const mDiaria = parseFloat(newEmprestimo.multaDiaria) || 0;
    const mPerc = parseFloat(newEmprestimo.multaPercentual) || 0;

    if (isNaN(principal) || principal <= 0) {
      toast.error('Informe um valor principal válido.');
      return;
    }
    if (isNaN(parcelas) || parcelas <= 0) {
      toast.error('Informe o número de parcelas.');
      return;
    }

    if (newEmprestimo.modalidade === 'tradicional' && isNaN(taxa)) {
      toast.error('Informe a taxa de juros.');
      return;
    }
    
    let valorParcelaObj = 0;
    let sDevedor = principal;
    if (newEmprestimo.modalidade === 'parcelado') {
      const vParc = parseFloat(newEmprestimo.valorParcela);
      if (isNaN(vParc) || vParc <= 0) {
        toast.error('Informe o valor de cada parcela.');
        return;
      }
      valorParcelaObj = vParc;
      // Saldo Devedor é o total das parcelas para começarmos a diminuir com as amortizações
      sDevedor = parcelas * vParc;
    } else {
      valorParcelaObj = calcularParcela(principal, taxa, parcelas);
    }
    
    const dataVencimento = new Date(newEmprestimo.dataInicio);
    if (newEmprestimo.frequencia === 'dia_especifico') {
      const diaVenc = parseInt(newEmprestimo.diaVencimento) || 10;
      dataVencimento.setMonth(dataVencimento.getMonth() + 1);
      const maxDias = new Date(dataVencimento.getFullYear(), dataVencimento.getMonth() + 1, 0).getDate();
      dataVencimento.setDate(Math.min(diaVenc, maxDias));
    } else {
      const freqDays = { diario: 1, semanal: 7, quinzenal: 15, mensal: 30 };
      dataVencimento.setDate(dataVencimento.getDate() + (freqDays[newEmprestimo.frequencia] || 7));
    }

    const dataCriacao = new Date().toISOString();

    const emprestimoFinal = {
      ...newEmprestimo,
      clienteId: cliente.id,
      valorPrincipal: sDevedor, // se parcelado, o principal de monitoramento é o saldo total de parcelas
      valorPrincipalInicial: principal, // O valor real emprestado permanece fixo aqui
      taxaJuros: taxa,
      totalParcelas: parcelas,
      parcelasPagas: 0,
      valorParcela: valorParcelaObj,
      saldoDevedor: sDevedor,
      status: 'ativo',
      dataVencimento: dataVencimento.toISOString(),
      carenciaDias: carencia,
      multaFixa: mFixa,
      multaDiaria: mDiaria,
      multaPercentual: mPerc,
      criadoEm: dataCriacao
    };

    adicionarEmprestimo(emprestimoFinal);

    toast.success('Empréstimo criado com sucesso!');
    setIsEmprestimoModalOpen(false);

    if (window.confirm('Deseja gerar o contrato PDF agora?')) {
      gerarContratoPDF(emprestimoFinal, cliente, config);
    }
  };

  const handleDeleteCliente = () => {
    removerCliente(cliente.id);
    toast.success('Cliente excluído com sucesso.');
    navigate('/app/clientes');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/app/clientes')} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{cliente.nome}</h2>
            <p className="text-sm text-text-secondary truncate">Detalhes e histórico do cliente.</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="p-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors w-full sm:w-auto flex items-center justify-center gap-2 text-sm sm:text-base"
          title="Excluir Cliente"
        >
          <Trash2 size={18} />
          <span className="sm:hidden">Excluir Cliente</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Informações do Cliente */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-surface-2 border-2 border-brand-primary flex items-center justify-center font-bold text-brand-primary text-3xl sm:text-4xl mb-4 shrink-0">
                {cliente.nome.charAt(0)}
              </div>
              <h3 className="text-lg sm:text-xl font-bold truncate max-w-full">{cliente.nome}</h3>
              <Badge variant="primary" className="mt-2 font-mono">{formatCPF(cliente.cpfCnpj)}</Badge>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 min-w-0">
                <Phone className="text-brand-primary shrink-0" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold">Telefone</p>
                  <p className="text-xs sm:text-sm font-medium truncate">{formatPhone(cliente.telefone)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 min-w-0">
                <MessageCircle className="text-success shrink-0" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold">WhatsApp</p>
                  <p className="text-xs sm:text-sm font-medium truncate">{cliente.whatsapp || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 min-w-0">
                <MapPin className="text-danger shrink-0 mt-0.5" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold">Endereço</p>
                  <p className="text-xs sm:text-sm font-medium leading-relaxed">
                    {cliente.endereco.rua}, {cliente.endereco.numero}<br />
                    {cliente.endereco.bairro} - {cliente.endereco.cidade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 min-w-0">
                <Calendar className="text-text-secondary shrink-0" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold">Cliente desde</p>
                  <p className="text-xs sm:text-sm font-medium truncate">{formatDate(cliente.criadoEm)}</p>
                </div>
              </div>
            </div>

            <Button className="w-full mt-6 gap-2 text-xs sm:text-sm" variant="outline" onClick={() => window.open(`https://wa.me/55${cliente.whatsapp}`, '_blank')}>
              <MessageCircle size={18} />
              Enviar Mensagem
            </Button>
          </Card>
        </div>

        {/* Empréstimos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <h3 className="text-lg sm:text-xl font-bold">Empréstimos Ativos</h3>
            <Button size="sm" className="gap-2 w-full sm:w-auto justify-center" onClick={() => setIsEmprestimoModalOpen(true)}>
              <Plus size={16} />
              Novo Empréstimo
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {ativos.map(emp => (
              <Card key={emp.id} className="p-0 overflow-hidden hover:border-brand-primary/30 transition-all cursor-pointer" onClick={() => navigate(`/app/emprestimos/${emp.id}`)}>
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                      <HandCoins size={22} className="sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-text-muted uppercase font-bold">Valor Principal</p>
                      <p className="text-lg sm:text-xl font-bold font-mono truncate">{formatCurrency(emp.valorPrincipal)}</p>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-2 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 shrink-0">
                    <p className="text-[11px] sm:text-xs text-text-muted order-last sm:order-first">Vence em {formatDate(emp.dataVencimento)}</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          gerarContratoPDF(emp, cliente, config);
                        }}
                        className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                        title="Baixar Contrato PDF"
                      >
                        <Download size={15} />
                      </button>
                      <Badge variant={emp.status === 'atrasado' ? 'danger' : 'success'} className="text-[10px]">
                        {emp.status === 'atrasado' ? 'EM ATRASO' : 'REGULAR'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="px-4 sm:px-6 py-3 bg-brand-surface-2 border-t border-border-subtle flex justify-between items-center gap-2">
                  <div className="flex gap-4 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] text-text-muted uppercase">Parcelas</p>
                      <p className="text-xs sm:text-sm font-bold truncate">{emp.parcelasPagas}/{emp.totalParcelas}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] text-text-muted uppercase">Saldo</p>
                      <p className="text-xs sm:text-sm font-bold text-brand-primary truncate">{formatCurrency(emp.saldoDevedor)}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-text-muted shrink-0" />
                </div>
              </Card>
            ))}
            {ativos.length === 0 && (
              <div className="p-12 glass rounded-2xl border-dashed border-2 border-border-subtle flex flex-col items-center justify-center text-text-muted">
                <HandCoins size={48} className="mb-4 opacity-20" />
                <p>Nenhum empréstimo ativo para este cliente.</p>
              </div>
            )}
          </div>

          {quitados.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold mt-8">Histórico de Quitados</h3>
              <div className="grid grid-cols-1 gap-4">
                {quitados.map(emp => (
                  <div key={emp.id} className="p-4 glass rounded-xl flex justify-between items-center opacity-60">
                    <div className="flex items-center gap-4">
                      <HandCoins size={20} className="text-text-muted" />
                      <div>
                        <p className="text-sm font-bold">{formatCurrency(emp.valorPrincipal)}</p>
                        <p className="text-xs text-text-muted">Finalizado em {formatDate(emp.dataVencimento)}</p>
                      </div>
                    </div>
                    <Badge variant="neutral">QUITADO</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEmprestimoModalOpen}
        onClose={() => setIsEmprestimoModalOpen(false)}
        title="Novo Empréstimo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEmprestimoModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateEmprestimo}>Confirmar Empréstimo</Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary ml-1">Modalidade</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                  newEmprestimo.modalidade === 'tradicional'
                    ? "bg-brand-primary text-white border-brand-primary font-black"
                    : "bg-brand-surface-2 hover:bg-white/5 border-border-subtle text-text-secondary"
                }`}
                onClick={() => setNewEmprestimo({ ...newEmprestimo, modalidade: 'tradicional' })}
              >
                Tradicional (Taxa %)
              </button>
              <button
                type="button"
                className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                  newEmprestimo.modalidade === 'parcelado'
                    ? "bg-brand-primary text-white border-brand-primary font-black"
                    : "bg-brand-surface-2 hover:bg-white/5 border-border-subtle text-text-secondary"
                }`}
                onClick={() => setNewEmprestimo({ ...newEmprestimo, modalidade: 'parcelado' })}
              >
                Parcelado (Fixo R$)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={newEmprestimo.modalidade === 'parcelado' ? "Valor Emprestado (R$)" : "Valor Principal (R$)"}
              type="number"
              placeholder="1000.00"
              value={newEmprestimo.valorPrincipal}
              onChange={e => setNewEmprestimo({ ...newEmprestimo, valorPrincipal: e.target.value })}
              required
            />

            {newEmprestimo.modalidade === 'parcelado' ? (
              <Input
                label="Valor de Cada Parcela"
                type="number"
                placeholder="100.00"
                value={newEmprestimo.valorParcela}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, valorParcela: e.target.value })}
                required
              />
            ) : (
              <Input
                label="Taxa de Juros (%)"
                type="number"
                value={newEmprestimo.taxaJuros}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, taxaJuros: e.target.value })}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary ml-1">Frequência</label>
              <select 
                className="input-field"
                value={newEmprestimo.frequencia}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, frequencia: e.target.value })}
              >
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="dia_especifico">Dia Específico do Mês</option>
              </select>
            </div>

            {newEmprestimo.frequencia === 'dia_especifico' ? (
              <Input
                label="Dia de Vencimento"
                type="number"
                min="1"
                max="31"
                placeholder="10"
                value={newEmprestimo.diaVencimento}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, diaVencimento: e.target.value })}
                required
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary ml-1">Cobrador</label>
                <select 
                  className="input-field"
                  value={newEmprestimo.cobradorId}
                  onChange={e => setNewEmprestimo({ ...newEmprestimo, cobradorId: e.target.value })}
                >
                  {cobradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total de Parcelas"
              type="number"
              value={newEmprestimo.totalParcelas}
              onChange={e => setNewEmprestimo({ ...newEmprestimo, totalParcelas: e.target.value })}
              required
            />
            {newEmprestimo.frequencia === 'dia_especifico' ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary ml-1">Cobrador</label>
                <select 
                  className="input-field"
                  value={newEmprestimo.cobradorId}
                  onChange={e => setNewEmprestimo({ ...newEmprestimo, cobradorId: e.target.value })}
                >
                  {cobradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            ) : (
              <Input
                label="Data de Início"
                type="date"
                value={newEmprestimo.dataInicio}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, dataInicio: e.target.value })}
                required
              />
            )}
          </div>

          {newEmprestimo.frequencia === 'dia_especifico' && (
            <Input
              label="Data de Início"
              type="date"
              value={newEmprestimo.dataInicio}
              onChange={e => setNewEmprestimo({ ...newEmprestimo, dataInicio: e.target.value })}
              required
            />
          )}
          
          <div className="pt-4 border-t border-border-subtle">
            <p className="text-sm font-bold mb-3">Regras de Atraso</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input
                label="Carência (dias)"
                type="number"
                value={newEmprestimo.carenciaDias}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, carenciaDias: e.target.value })}
              />
              <Input
                label="Multa Fixa (R$)"
                type="number"
                value={newEmprestimo.multaFixa}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, multaFixa: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Multa Diária (R$)"
                type="number"
                value={newEmprestimo.multaDiaria}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, multaDiaria: e.target.value })}
              />
              <Input
                label="Multa (%)"
                type="number"
                value={newEmprestimo.multaPercentual}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, multaPercentual: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Excluir Cliente"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteCliente}>Confirmar Exclusão</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3">
            <Trash2 className="text-danger shrink-0" size={24} />
            <div>
              <p className="text-sm font-bold text-danger uppercase">Atenção: Ação Irreversível</p>
              <p className="text-sm text-text-secondary mt-1">
                Você está prestes a excluir o cliente <strong>{cliente.nome}</strong>. 
                Esta ação removerá permanentemente o cliente e <strong>TODOS</strong> os seus empréstimos e histórico de pagamentos.
              </p>
            </div>
          </div>
          <p className="text-sm text-text-secondary px-1">
            Deseja realmente prosseguir com a exclusão?
          </p>
        </div>
      </Modal>
    </div>
  );
}
