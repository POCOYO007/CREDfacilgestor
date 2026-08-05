import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button, Input, Card, Badge, Modal } from '../../components/ui';
import { formatCurrency, formatCPF, formatPhone, formatDate } from '../../utils/formatters';
import { 
  Search, 
  UserPlus, 
  Phone, 
  MessageCircle, 
  MapPin, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  HandCoins, 
  Calendar, 
  FileText,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calcularParcela, calcularStatus } from '../../utils/calculosEmprestimo';
import { gerarContratoPDF } from '../../services/pdfService';

export default function ClientesCobrador() {
  const { 
    clientes, 
    emprestimos, 
    cobradores, 
    adicionarCliente, 
    adicionarEmprestimo, 
    config, 
    usuarioAtual 
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClientId, setExpandedClientId] = useState(null);
  
  // Modals status
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedClientForLoan, setSelectedClientForLoan] = useState(null);

  // Form states - Cliente
  const [clientForm, setClientForm] = useState({
    nome: '',
    cpfCnpj: '',
    telefone: '',
    whatsapp: '',
    endereco: { rua: '', numero: '', bairro: '', cidade: '', cep: '' }
  });

  // Form states - Empréstimo
  const [newEmprestimo, setNewEmprestimo] = useState({
    modalidade: 'tradicional', // 'tradicional' ou 'parcelado'
    valorPrincipal: '',
    taxaJuros: config.taxaPadrao || 10,
    frequencia: config.frequenciaPadrao || 'semanal',
    totalParcelas: '10',
    dataInicio: new Date().toISOString().split('T')[0],
    carenciaDias: config.carenciaPadrao || 3,
    multaFixa: '0',
    multaDiaria: '0',
    multaPercentual: config.multaPercentualPadrao ?? '2',
    valorParcela: '',
    diaVencimento: '10',
    cobradorId: ''
  });

  const loggedInCobradorId = usuarioAtual.cobradorId || usuarioAtual.id;

  // Initialize loan form when modal opens
  useEffect(() => {
    if (isLoanModalOpen) {
      setNewEmprestimo({
        modalidade: 'tradicional',
        valorPrincipal: '',
        taxaJuros: config.taxaPadrao || 10,
        frequencia: config.frequenciaPadrao || 'semanal',
        totalParcelas: '10',
        dataInicio: new Date().toISOString().split('T')[0],
        carenciaDias: config.carenciaPadrao || 3,
        multaFixa: '0',
        multaDiaria: '0',
        multaPercentual: config.multaPercentualPadrao ?? '2',
        valorParcela: '',
        diaVencimento: '10',
        cobradorId: loggedInCobradorId || cobradores[0]?.id || ''
      });
    }
  }, [isLoanModalOpen, config, loggedInCobradorId, cobradores]);

  // Search filter
  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cpfCnpj.includes(searchTerm)
  );

  const toggleExpandClient = (id) => {
    setExpandedClientId(expandedClientId === id ? null : id);
  };

  const handleClientSubmit = (e) => {
    e.preventDefault();
    if (!clientForm.nome.trim()) {
      toast.error('Informe o nome completo do cliente.');
      return;
    }
    adicionarCliente(clientForm);
    toast.success('Cliente cadastrado com sucesso!');
    setIsClientModalOpen(false);
    
    // Clear form
    setClientForm({
      nome: '',
      cpfCnpj: '',
      telefone: '',
      whatsapp: '',
      endereco: { rua: '', numero: '', bairro: '', cidade: '', cep: '' }
    });
  };

  const handleLoanSubmit = (e) => {
    e.preventDefault();
    if (!selectedClientForLoan) return;

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
      sDevedor = parcelas * vParc;
    } else {
      valorParcelaObj = calcularParcela(principal, taxa, parcelas);
    }

    // Calcular data primeiro vencimento
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
      clienteId: selectedClientForLoan.id,
      valorPrincipal: sDevedor, 
      valorPrincipalInicial: principal, 
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
    setIsLoanModalOpen(false);

    if (window.confirm('Deseja gerar o contrato PDF agora?')) {
      gerarContratoPDF(emprestimoFinal, selectedClientForLoan, config);
    }
  };

  const handleOpenLoanModal = (cliente, e) => {
    e.stopPropagation();
    setSelectedClientForLoan(cliente);
    setIsLoanModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header com botão de cadastrar */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Meus Clientes</h2>
          <p className="text-xs text-text-muted mt-0.5 font-medium uppercase tracking-wider">
            Consulte rotas e realize novos contratos
          </p>
        </div>
        
        <Button 
          onClick={() => setIsClientModalOpen(true)} 
          className="gap-1.5 h-10 px-3 text-xs font-bold"
        >
          <UserPlus size={16} />
          <span>Cadastrar</span>
        </Button>
      </div>

      {/* Caixa de busca */}
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Buscar cliente por nome ou CPF..."
            className="w-full bg-brand-surface border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-hidden focus:border-brand-primary text-text-primary transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Lista de clientes */}
      <div className="space-y-3">
        {filteredClientes.map(cliente => {
          const clientLoans = emprestimos.filter(e => e.clienteId === cliente.id);
          const activeLoans = clientLoans.filter(e => calcularStatus(e) !== 'pago');
          const isExpanded = expandedClientId === cliente.id;

          return (
            <Card 
              key={cliente.id} 
              className={`p-4 border transition-all cursor-pointer select-none ${
                isExpanded ? "border-brand-primary" : "border-border-subtle hover:border-white/10"
              }`}
              onClick={() => toggleExpandClient(cliente.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-border-subtle flex items-center justify-center font-bold text-brand-primary text-base shrink-0">
                    {cliente.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-tight text-text-primary max-w-[150px] truncate">{cliente.nome}</h4>
                    <p className="text-[10px] text-text-muted font-mono">{formatCPF(cliente.cpfCnpj) || 'Sem CPF/CNPJ'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={activeLoans.length > 0 ? "primary" : "neutral"} className="text-[8px] px-1.5 font-mono">
                    {activeLoans.length} Ativo{activeLoans.length !== 1 && 's'}
                  </Badge>
                  {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                </div>
              </div>

              {/* Seção Expandida */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border-subtle space-y-4 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                  
                  {/* Linhas de contato e endereço */}
                  <div className="grid grid-cols-2 gap-3">
                    <a 
                      href={`tel:${cliente.telefone}`} 
                      className="p-2.5 rounded-xl bg-brand-surface-2 hover:bg-white/5 border border-border-subtle flex items-center gap-2 text-[10px] font-black text-text-secondary uppercase tracking-tight"
                    >
                      <Phone size={12} className="text-brand-primary" />
                      Ligar: {formatPhone(cliente.telefone)}
                    </a>
                    
                    {cliente.whatsapp ? (
                      <a 
                        href={`https://wa.me/55${cliente.whatsapp.replace(/\D/g, '')}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-tight"
                      >
                        <MessageCircle size={12} className="text-emerald-400" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="p-2.5 rounded-xl bg-brand-surface-2 opacity-50 border border-border-subtle flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-tight">
                        <MessageCircle size={12} />
                        Sem Whats
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-brand-surface-2 border border-border-subtle flex items-start gap-2 text-xs">
                    <MapPin size={14} className="text-brand-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-text-primary text-[10px] uppercase">Endereço de Cobrança</p>
                      <p className="text-text-secondary text-[11px] mt-0.5">
                        {cliente.endereco?.rua ? (
                          `${cliente.endereco.rua}, ${cliente.endereco.numero || 'S/N'} - ${cliente.endereco.bairro || ''}, ${cliente.endereco.cidade || ''}`
                        ) : (
                          "Endereço não cadastrado."
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Listagem de empréstimos do cliente */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-0.5">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Contratos</p>
                      <button 
                        type="button"
                        onClick={(e) => handleOpenLoanModal(cliente, e)}
                        className="text-[10px] font-black text-brand-primary uppercase flex items-center gap-1 hover:underline"
                      >
                        <Plus size={10} />
                        Novo Contrato / Empréstimo
                      </button>
                    </div>

                    {clientLoans.length === 0 ? (
                      <div className="py-6 rounded-xl bg-brand-surface-2/30 border border-dashed border-border-subtle text-center">
                        <HandCoins size={20} className="text-text-muted/30 mx-auto mb-1" />
                        <p className="text-[10px] font-black text-text-muted/50 uppercase tracking-wide">Sem contratos lançados</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {clientLoans.map(e => {
                          const status = calcularStatus(e);
                          const total = parseFloat(e.valorPrincipalInicial || e.valorPrincipal || 0);
                          const rest = parseFloat(e.valorPrincipal || 0);
                          return (
                            <div key={e.id} className="p-3 bg-brand-surface-2 border border-border-subtle rounded-xl flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black font-mono">
                                    {e.modalidade === 'parcelado' ? 'Parcelado' : 'Tradicional'}
                                  </span>
                                  <Badge className={`text-[8px] font-black px-1.5 py-0 ${
                                    status === 'pago' ? 'bg-success/10 text-success' : 
                                    status === 'atrasado' ? 'bg-danger/10 text-danger' : 
                                    'bg-amber-400/10 text-amber-400'
                                  }`}>
                                    {status.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="mt-1 flex gap-3 text-[10px] text-text-secondary font-bold">
                                  <span>Principal: <strong className="font-mono text-white">{formatCurrency(total)}</strong></span>
                                  <span>Saldo: <strong className="font-mono text-brand-primary">{formatCurrency(rest)}</strong></span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="block text-[8px] text-text-muted font-black uppercase">Parcela</span>
                                <span className="font-black font-mono text-emerald-400 text-xs">
                                  {formatCurrency(e.valorParcela)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Botão de ação direta para criar empréstimo */}
                  <Button 
                    variant="primary" 
                    className="w-full h-11 text-xs gap-2 font-black uppercase tracking-wider bg-linear-to-r from-brand-primary to-brand-primary/80"
                    onClick={(e) => handleOpenLoanModal(cliente, e)}
                  >
                    <HandCoins size={14} />
                    Lançar Novo Empréstimo
                  </Button>

                </div>
              )}
            </Card>
          );
        })}

        {filteredClientes.length === 0 && (
          <div className="py-12 bg-brand-surface/30 border border-dashed border-border-subtle rounded-3xl text-center flex flex-col items-center justify-center text-text-muted/40">
            <UserPlus size={36} className="mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* MODAL: REGISTRAR CLIENTE */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Cadastrar Novo Cliente"
        footer={
          <>
            <Button variant="ghost" className="text-xs" onClick={() => setIsClientModalOpen(false)}>Cancelar</Button>
            <Button className="text-xs" onClick={handleClientSubmit}>Cadastrar Cliente</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input
            label="Nome Completo *"
            placeholder="Ex: Carlos Santos"
            value={clientForm.nome}
            onChange={e => setClientForm({ ...clientForm, nome: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="CPF ou CNPJ"
              placeholder="000.000.000-00"
              value={clientForm.cpfCnpj}
              onChange={e => setClientForm({ ...clientForm, cpfCnpj: e.target.value })}
            />
            <Input
              label="Telefone *"
              placeholder="(85) 99999-9999"
              value={clientForm.telefone}
              onChange={e => setClientForm({ ...clientForm, telefone: e.target.value })}
              required
            />
          </div>

          <Input
            label="WhatsApp (Apenas números)"
            placeholder="85999999999"
            value={clientForm.whatsapp}
            onChange={e => setClientForm({ ...clientForm, whatsapp: e.target.value })}
          />

          <div className="pt-3 border-t border-border-subtle">
            <p className="text-xs font-black uppercase text-text-muted tracking-wider mb-2">Endereço de Cobrança</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Rua / Av"
                  placeholder="Ex: Rua Central"
                  value={clientForm.endereco.rua}
                  onChange={e => setClientForm({ 
                    ...clientForm, 
                    endereco: { ...clientForm.endereco, rua: e.target.value } 
                  })}
                />
              </div>
              <Input
                label="Nº"
                placeholder="123"
                value={clientForm.endereco.numero}
                onChange={e => setClientForm({ 
                  ...clientForm, 
                  endereco: { ...clientForm.endereco, numero: e.target.value } 
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                label="Bairro"
                placeholder="Ex: Centro"
                value={clientForm.endereco.bairro}
                onChange={e => setClientForm({ 
                  ...clientForm, 
                  endereco: { ...clientForm.endereco, bairro: e.target.value } 
                })}
              />
              <Input
                label="Cidade"
                placeholder="Ex: Fortaleza"
                value={clientForm.endereco.cidade}
                onChange={e => setClientForm({ 
                  ...clientForm, 
                  endereco: { ...clientForm.endereco, cidade: e.target.value } 
                })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: NOVO EMPRÉSTIMO */}
      <Modal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title={`Novo Empréstimo para ${selectedClientForLoan?.nome}`}
        footer={
          <>
            <Button variant="ghost" className="text-xs" onClick={() => setIsLoanModalOpen(false)}>Cancelar</Button>
            <Button className="text-xs" onClick={handleLoanSubmit}>Confirmar e Lançar</Button>
          </>
        }
      >
        <form className="space-y-4">
          
          {/* Modalidade */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider ml-1">Modalidade</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`p-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  newEmprestimo.modalidade === 'tradicional'
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-brand-surface-2 hover:bg-white/5 border-border-subtle text-text-secondary"
                }`}
                onClick={() => setNewEmprestimo({ ...newEmprestimo, modalidade: 'tradicional' })}
              >
                Tradicional (Taxa %)
              </button>
              <button
                type="button"
                className={`p-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  newEmprestimo.modalidade === 'parcelado'
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-brand-surface-2 hover:bg-white/5 border-border-subtle text-text-secondary"
                }`}
                onClick={() => setNewEmprestimo({ ...newEmprestimo, modalidade: 'parcelado' })}
              >
                Parcelado (Fixo R$)
              </button>
            </div>
          </div>

          {/* Valores e Taxa ou Parcela */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={newEmprestimo.modalidade === 'parcelado' ? "Valor Emprestado (R$) *" : "Valor Principal (R$) *"}
              type="number"
              placeholder="1000.00"
              value={newEmprestimo.valorPrincipal}
              onChange={e => setNewEmprestimo({ ...newEmprestimo, valorPrincipal: e.target.value })}
              required
            />

            {newEmprestimo.modalidade === 'parcelado' ? (
              <Input
                label="Valor da Parcela *"
                type="number"
                placeholder="100.00"
                value={newEmprestimo.valorParcela}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, valorParcela: e.target.value })}
                required
              />
            ) : (
              <Input
                label="Taxa de Juros (%) *"
                type="number"
                value={newEmprestimo.taxaJuros}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, taxaJuros: e.target.value })}
                required
              />
            )}
          </div>

          {/* Frequência & Dia Vencimento ou Cobrador */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary ml-1">Frequência *</label>
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
                label="Dia de Vencimento *"
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
                <label className="text-sm font-medium text-text-secondary ml-1">Cobrador Principal *</label>
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

          {/* Total Parcelas e Data Inicio ou Cobrador */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total de Parcelas *"
              type="number"
              placeholder="10"
              value={newEmprestimo.totalParcelas}
              onChange={e => setNewEmprestimo({ ...newEmprestimo, totalParcelas: e.target.value })}
              required
            />
            
            {newEmprestimo.frequencia === 'dia_especifico' ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary ml-1">Cobrador Principal *</label>
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
                label="Data de Início *"
                type="date"
                value={newEmprestimo.dataInicio}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, dataInicio: e.target.value })}
                required
              />
            )}
          </div>

          {newEmprestimo.frequencia === 'dia_especifico' && (
            <Input
              label="Data de Início *"
              type="date"
              value={newEmprestimo.dataInicio}
              onChange={e => setNewEmprestimo({ ...newEmprestimo, dataInicio: e.target.value })}
              required
            />
          )}

          {/* Regras de atraso (Default ou customizado) */}
          <div className="pt-3 border-t border-border-subtle">
            <p className="text-xs font-black uppercase text-text-muted tracking-wider mb-2">Regras de Atraso</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Carência (Dias)"
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
            
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                label="Multa Diária (R$)"
                type="number"
                value={newEmprestimo.multaDiaria}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, multaDiaria: e.target.value })}
              />
              <Input
                label="Multa Percentual (%)"
                type="number"
                value={newEmprestimo.multaPercentual}
                onChange={e => setNewEmprestimo({ ...newEmprestimo, multaPercentual: e.target.value })}
              />
            </div>
          </div>

        </form>
      </Modal>
    </div>
  );
}
