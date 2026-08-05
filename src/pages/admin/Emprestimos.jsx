import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Card, Badge, Button, Input, cn } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Search, Filter, HandCoins, Calendar, User, ChevronRight, Clock, Download, ArrowUpDown, SortAsc } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDiasAtraso, calcularStatus } from '../../utils/calculosEmprestimo';
import { gerarContratoPDF } from '../../services/pdfService';

export default function Emprestimos() {
  const { emprestimos, clientes, cobradores, config } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sortBy, setSortBy] = useState('vencimento');
  const navigate = useNavigate();

  const filteredEmprestimos = useMemo(() => emprestimos.map(e => ({
    ...e,
    status: calcularStatus(e)
  })).filter(e => {
    const cliente = clientes.find(c => c.id === e.clienteId);
    const cobrador = cobradores.find(c => c.id === e.cobradorId);
    const matchesSearch = !searchTerm ||
                          cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          cliente?.cpfCnpj?.includes(searchTerm) ||
                          cobrador?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || e.status === statusFilter;
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
    if (sortBy === 'valor') {
      return (b.valorPrincipal || 0) - (a.valorPrincipal || 0);
    }
    // Default: 'vencimento'
    return new Date(a.dataVencimento) - new Date(b.dataVencimento);
  }), [emprestimos, clientes, cobradores, searchTerm, statusFilter, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Empréstimos</h2>
          <p className="text-sm text-text-secondary">Acompanhe todos os contratos ativos e quitados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 sm:gap-4">
        <Card className="sm:col-span-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar por cliente, documento ou cobrador..."
              className="w-full bg-brand-surface-2 border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-sm sm:text-base focus:outline-hidden focus:border-brand-primary transition-all text-text-primary"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </Card>

        <Card className="sm:col-span-1.5 p-3 sm:p-4 flex items-center">
          <Filter className="text-brand-primary mr-2 shrink-0" size={18} />
          <select 
            className="w-full bg-[#181b22] text-white border-none focus:outline-hidden text-xs sm:text-sm cursor-pointer font-bold"
            style={{ backgroundColor: '#181b22', color: '#ffffff' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="todos" className="bg-[#181b22] text-white">Todos Status</option>
            <option value="ativo" className="bg-[#181b22] text-white">🟢 Em Dia (Ativos)</option>
            <option value="atrasado" className="bg-[#181b22] text-white">🔴 Atrasados</option>
            <option value="pago" className="bg-[#181b22] text-white">⚪ Quitados</option>
          </select>
        </Card>

        <Card className="sm:col-span-1.5 p-3 sm:p-4 flex items-center">
          <ArrowUpDown className="text-brand-primary mr-2 shrink-0" size={18} />
          <select 
            className="w-full bg-[#181b22] text-white border-none focus:outline-hidden text-xs sm:text-sm cursor-pointer font-bold"
            style={{ backgroundColor: '#181b22', color: '#ffffff' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="vencimento" className="bg-[#181b22] text-white">📅 Vencimento</option>
            <option value="nome" className="bg-[#181b22] text-white">🔤 Nome (A-Z)</option>
            <option value="atrasado" className="bg-[#181b22] text-white">⚠️ Mais Atrasados</option>
            <option value="valor" className="bg-[#181b22] text-white">💰 Maior Valor</option>
          </select>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredEmprestimos.map(emp => {
          const cliente = clientes.find(c => c.id === emp.clienteId);
          const cobrador = cobradores.find(c => c.id === emp.cobradorId);
          return (
            <Card 
              key={emp.id} 
              className="p-0 overflow-hidden hover:border-brand-primary/30 transition-all cursor-pointer group"
              onClick={() => navigate(`/app/emprestimos/${emp.id}`)}
            >
              <div className="p-4 sm:p-6 flex flex-col sm:grid sm:grid-cols-4 gap-4 sm:gap-6 items-start sm:items-center">
                <div className="flex items-center gap-3 w-full sm:min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-surface-2 border border-border-subtle flex items-center justify-center font-bold text-brand-primary text-base sm:text-lg shrink-0">
                    {cliente?.nome.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-grow sm:flex-grow-0">
                    <h4 className="font-bold text-sm sm:text-base truncate">{cliente?.nome || 'N/A'}</h4>
                    <p className="text-xs text-text-muted font-mono truncate">{cliente?.cpfCnpj}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <User size={10} className="text-brand-primary shrink-0" />
                      <span className="text-[10px] font-bold text-brand-primary uppercase truncate">{cobrador?.nome || 'SEM COBRADOR'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col justify-between items-center sm:items-start w-full sm:w-auto gap-1 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold">Valor Principal</p>
                  <p className="font-bold font-mono text-base sm:text-lg text-white">{formatCurrency(emp.valorPrincipal)}</p>
                </div>

                <div className="flex flex-row sm:flex-col justify-between items-center sm:items-start w-full sm:w-auto gap-1 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold">Próximo Vencimento</p>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-text-muted shrink-0" />
                    <p className="text-xs sm:text-sm font-medium">{formatDate(emp.dataVencimento)}</p>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-2 sm:gap-1 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                  <div className="text-right sm:block hidden min-w-0">
                    <p className="text-[10px] text-text-muted uppercase font-bold">Saldo Devedor</p>
                    <p className="font-bold font-mono text-brand-primary truncate">{formatCurrency(emp.saldoDevedor)}</p>
                  </div>
                  <div className="flex items-center sm:hidden min-w-0">
                    <div>
                      <p className="text-[10px] text-text-muted uppercase font-bold">Saldo Devedor</p>
                      <p className="font-bold font-mono text-brand-primary truncate">{formatCurrency(emp.saldoDevedor)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        gerarContratoPDF(emp, cliente, config);
                      }}
                      className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                      title="Baixar Contrato PDF"
                    >
                      <Download size={14} />
                    </button>
                    <div className="flex flex-col items-end shrink-0">
                      <Badge variant={emp.status === 'atrasado' ? 'danger' : emp.status === 'pago' ? 'neutral' : 'success'} className="text-[10px]">
                        {emp.status === 'atrasado' ? 'EM ATRASO' : emp.status === 'pago' ? 'QUITADO' : 'REGULAR'}
                      </Badge>
                      {emp.status === 'atrasado' && (
                        <div className="flex items-center gap-1 text-[9px] text-danger font-bold mt-0.5">
                          <Clock size={10} />
                          <span>{getDiasAtraso(emp.dataVencimento)} DIAS</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-text-muted group-hover:translate-x-1 transition-transform sm:block hidden" />
                  </div>
                </div>
              </div>
              
              <div className="h-1 bg-white/5 w-full">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    emp.status === 'atrasado' ? "bg-danger" : emp.status === 'pago' ? "bg-text-muted" : "bg-success"
                  )} 
                  style={{ width: emp.status === 'pago' ? '100%' : `${Math.min(100, (1 - (emp.valorPrincipal / (emp.valorPrincipalInicial || emp.valorPrincipal))) * 100)}%` }} 
                />
              </div>
            </Card>
          );
        })}

        {filteredEmprestimos.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-text-muted opacity-50">
            <HandCoins size={64} className="mb-4" />
            <p className="text-xl font-bold">Nenhum empréstimo encontrado</p>
            <p>Tente ajustar seus filtros de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
