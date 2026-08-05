import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Card, Badge, Button, cn } from '../../components/ui';
import { 
  formatCurrency, 
  formatDate, 
  formatPhone, 
  isTodayDate, 
  buildWhatsAppUrl, 
  buildJurosVencendoHojeMessage 
} from '../../utils/formatters';
import { calcularStatus, calcularMulta } from '../../utils/calculosEmprestimo';
import { 
  TrendingUp, 
  Users, 
  HandCoins, 
  AlertCircle, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Receipt,
  FileText,
  Clock,
  CalendarDays,
  MessageCircle,
  Phone
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- Date Normalization and Period Helpers ---

const parseSafeDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  
  if (typeof dateVal === 'object' && dateVal !== null && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  
  if (typeof dateVal === 'string') {
    // Format YYYY-MM-DD (e.g. from input type=date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0); // Use mid-day to prevent timezone drift
    }
    
    // ISO match
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
      return new Date(year, month - 1, day, hours, minutes, parseInt(isoMatch[6], 10) || 0, 0);
    }
  }
  
  const parsed = new Date(dateVal);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const isDateInRange = (dateValue, startDate, endDate) => {
  const d = parseSafeDate(dateValue);
  if (!d) return false;
  return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
};

const getPeriodRange = (periodo, customStart, customEnd) => {
  const agora = new Date();
  let inicio = new Date();
  let fim = new Date();
  
  if (periodo === 'hoje') {
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
  } else if (periodo === 'semana') {
    // Monday as first day of week in Brazil
    const diaSemana = agora.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = agora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    inicio.setDate(diff);
    inicio.setHours(0, 0, 0, 0);
    
    fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    fim.setHours(23, 59, 59, 999);
  } else if (periodo === 'mes') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (periodo === 'personalizado') {
    if (customStart) {
      const pStart = parseSafeDate(customStart);
      if (pStart) {
        inicio = new Date(pStart);
        inicio.setHours(0, 0, 0, 0);
      } else {
        inicio.setHours(0, 0, 0, 0);
      }
    } else {
      // Default to 30 days ago
      inicio.setDate(agora.getDate() - 30);
      inicio.setHours(0, 0, 0, 0);
    }
    
    if (customEnd) {
      const pEnd = parseSafeDate(customEnd);
      if (pEnd) {
        fim = new Date(pEnd);
        fim.setHours(23, 59, 59, 999);
      } else {
        fim.setHours(23, 59, 59, 999);
      }
    } else {
      fim.setHours(23, 59, 59, 999);
    }
  }
  return { inicio, fim };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    emprestimos, 
    recebimentos, 
    clientes, 
    cobradores, 
    despesas, 
    pagamentosCobradores,
    config 
  } = useAppStore();

  // Estados dos filtros de período
  const [periodo, setPeriodo] = React.useState('mes');
  const [customStart, setCustomStart] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = React.useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Obter o intervalo de datas do período selecionado
  const { inicio, fim } = React.useMemo(
    () => getPeriodRange(periodo, customStart, customEnd),
    [periodo, customStart, customEnd]
  );

  // --- Filtros Multi-Tenant sobre Coleções (Zustand State) ---
  // Memoizados: essas listas fazem parse de data item a item, então sem
  // useMemo elas rodavam de novo a cada render (inclusive quando o motivo do
  // render era outra coleção do store mudando, já que useAppStore() sem
  // seletor re-renderiza em qualquer set()).

  // 1. Recebimentos do período
  const recebimentosFiltrados = React.useMemo(() => recebimentos.filter(r => {
    const data = r.dataRecebimento || r.criadoEm;
    return isDateInRange(data, inicio, fim);
  }), [recebimentos, inicio, fim]);

  // 2. Despesas do período (Somente as APROVADAS)
  const despesasFiltradas = React.useMemo(() => despesas.filter(d => {
    if (d.aprovada !== true) return false;
    const data = d.data || d.criadoEm;
    return isDateInRange(data, inicio, fim);
  }), [despesas, inicio, fim]);

  // 3. Pagamentos/Repasses aos cobradores do período
  const pagamentosCobradoresFiltrados = React.useMemo(() => (pagamentosCobradores || []).filter(p => {
    const data = p.data || p.criadoEm;
    return isDateInRange(data, inicio, fim);
  }), [pagamentosCobradores, inicio, fim]);

  // 4. Empréstimos criados ou ativos no período
  const emprestimosComStatus = React.useMemo(() => emprestimos.map(e => ({
    ...e,
    status: calcularStatus(e)
  })), [emprestimos]);

  const emprestimosFiltrados = React.useMemo(() => emprestimosComStatus.filter(e => {
    const data = e.criadoEm;
    return isDateInRange(data, inicio, fim);
  }), [emprestimosComStatus, inicio, fim]);

  // --- Cálculos Financeiros Respeitando o Período ---

  // Total Coletado
  const totalColetadoPeriodo = recebimentosFiltrados.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  
  // Multas Coletadas
  const multasColetadasPeriodo = recebimentosFiltrados
    .filter(r => r.tipo === 'multa')
    .reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);

  // Despesas Aprovadas
  const despesasAprovadasPeriodo = despesasFiltradas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

  // Repasses a Cobradores
  const pagamentosCobradoresPeriodo = pagamentosCobradoresFiltrados.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

  // Lucro Líquido do Período
  // Fórmula acordada: totalColetado - despesasAprovadas - pagamentosCobradores
  const lucroLiquidoPeriodo = totalColetadoPeriodo - despesasAprovadasPeriodo - pagamentosCobradoresPeriodo;

  // --- Indicadores de Carteira de Longo Prazo / Estáticos ---
  // Estes indicam o estado global atual e permanecem corretos para o gestor
  // calcularMulta faz parse de data por item, então também vale memoizar.
  const capitalInvestidoTotal = React.useMemo(
    () => emprestimos.reduce((s, e) => s + (e.valorPrincipalInicial || e.valorPrincipal || 0), 0),
    [emprestimos]
  );
  const carteiraAberta = React.useMemo(
    () => emprestimosComStatus.filter(e => e.status !== 'pago'),
    [emprestimosComStatus]
  );
  const saldoEmRua = React.useMemo(
    () => carteiraAberta.reduce((s, e) => s + (e.valorPrincipal || 0), 0),
    [carteiraAberta]
  );
  const multasPendentesTotal = React.useMemo(
    () => carteiraAberta.reduce((s, e) => s + calcularMulta(e), 0),
    [carteiraAberta]
  );
  const projecaoMensal = React.useMemo(
    () => carteiraAberta.reduce((s, e) => s + (e.valorParcela || 0), 0),
    [carteiraAberta]
  );

  const ativosCount = emprestimosFiltrados.filter(e => e.status === 'ativo').length;
  const atrasadosCount = emprestimosFiltrados.filter(e => e.status === 'atrasado').length;
  const quitadosCount = emprestimosFiltrados.filter(e => e.status === 'pago').length;
  const totalContratosPeriodo = emprestimosFiltrados.length;
  const totalCarteiraAtivaPeriodo = emprestimosFiltrados.filter(e => e.status !== 'pago').length;
  const taxaInadimplenciaPeriodo = totalCarteiraAtivaPeriodo ? ((atrasadosCount / totalCarteiraAtivaPeriodo) * 100).toFixed(1) : 0;

  // --- Atividades Recentes ---
  const coletasHoje = React.useMemo(() => [...recebimentos]
    .filter(r => isTodayDate(r.dataRecebimento || r.criadoEm))
    .sort((a, b) => new Date(b.dataRecebimento || b.criadoEm) - new Date(a.dataRecebimento || a.criadoEm)),
    [recebimentos]
  );

  const despesasRecentes = React.useMemo(() => [...despesas]
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
    .slice(0, 5),
    [despesas]
  );

  const contratosRecentes = React.useMemo(() => [...emprestimosComStatus]
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
    .slice(0, 5),
    [emprestimosComStatus]
  );

  // --- Conectando Período ao Gráfico de Fluxo de Caixa ---

  const getChartDataForRange = (inicioRange, fimRange) => {
    const diffMs = fimRange.getTime() - inicioRange.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      // Hoje -> Dividir em blocos de 3 horas
      const blocks = [
        { label: '00h-06h', startHour: 0, endHour: 6 },
        { label: '06h-12h', startHour: 6, endHour: 12 },
        { label: '12h-18h', startHour: 12, endHour: 18 },
        { label: '18h-24h', startHour: 18, endHour: 24 }
      ];
      return blocks.map(b => {
        const valor = recebimentosFiltrados.filter(r => {
          const d = parseSafeDate(r.dataRecebimento || r.criadoEm);
          if (!d) return false;
          const h = d.getHours();
          return h >= b.startHour && h < b.endHour;
        }).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        return { name: b.label, valor };
      });
    } else if (diffDays <= 7) {
      // Semana -> Listar cada dia do período
      const data = [];
      const temp = new Date(inicioRange);
      while (temp <= fimRange) {
        const dateStr = temp.toDateString();
        const label = temp.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
        const valor = recebimentosFiltrados.filter(r => {
          const d = parseSafeDate(r.dataRecebimento || r.criadoEm);
          return d && d.toDateString() === dateStr;
        }).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        data.push({ name: label, valor });
        temp.setDate(temp.getDate() + 1);
      }
      return data;
    } else if (diffDays <= 31) {
      // Mês -> Dividir em 6 intervalos de amostragem
      const steps = 6;
      const data = [];
      const interval = diffMs / (steps - 1);
      for (let i = 0; i < steps; i++) {
        const targetTime = inicioRange.getTime() + (interval * i);
        const targetDate = new Date(targetTime);
        const label = targetDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
        
        const halfInterval = interval / 2;
        const valor = recebimentosFiltrados.filter(r => {
          const d = parseSafeDate(r.dataRecebimento || r.criadoEm);
          if (!d) return false;
          const diff = Math.abs(d.getTime() - targetTime);
          return diff <= halfInterval;
        }).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        
        data.push({ name: label, valor });
      }
      return data;
    } else {
      // Acima de 1 mês -> Agrupar por Mês calendário
      const data = [];
      const temp = new Date(inicioRange);
      temp.setDate(1);
      while (temp <= fimRange) {
        const monthLabel = temp.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const m = temp.getMonth();
        const y = temp.getFullYear();
        
        const valor = recebimentosFiltrados.filter(r => {
          const d = parseSafeDate(r.dataRecebimento || r.criadoEm);
          return d && d.getMonth() === m && d.getFullYear() === y;
        }).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        
        data.push({ name: monthLabel, valor });
        temp.setMonth(temp.getMonth() + 1);
      }
      return data;
    }
  };

  // Loop aninhado (varre recebimentosFiltrados uma vez por bucket do
  // gráfico) — é o cálculo mais caro da tela, por isso memoizado à parte.
  const chartData = React.useMemo(
    () => getChartDataForRange(inicio, fim),
    [recebimentosFiltrados, inicio, fim]
  );

  // Dados do gráfico de pizza
  const pieData = [
    { name: 'Regular', value: ativosCount, color: '#48BB78' },
    { name: 'Atrasados', value: atrasadosCount, color: '#F56565' },
    { name: 'Quitados', value: quitadosCount, color: '#A0AEC0' },
  ];

  // Configuração de Metas Dinâmicas para os indicadores do card lateral
  const metaPeriodo = {
    hoje: 1000,
    semana: 5000,
    mes: 20000,
    personalizado: 10000,
  }[periodo] || 10000;

  const progressoMeta = Math.min(100, Math.round((totalColetadoPeriodo / metaPeriodo) * 100)) || 0;

  const labelMeta = {
    hoje: 'hoje',
    semana: 'nesta semana',
    mes: 'neste mês',
    personalizado: 'no período',
  }[periodo] || 'no período';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard do Gestor</h2>
          <p className="text-xs sm:text-sm text-text-secondary">Visão financeira completa e controle de contratos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl glass border border-white/5 flex flex-col min-w-44 bg-white/2">
            <span className="text-[10px] text-text-muted uppercase font-bold">Lucro Líquido (Período)</span>
            <span className={cn("text-base sm:text-lg font-bold font-mono truncate", lucroLiquidoPeriodo >= 0 ? "text-success" : "text-danger")}>
              {formatCurrency(lucroLiquidoPeriodo)}
            </span>
          </div>
        </div>
      </div>

      {/* Filtros de Período Premium */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-2xl glass border border-white/5 bg-white/2 animate-fadeIn">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'hoje', label: 'Hoje' },
            { id: 'semana', label: 'Semana' },
            { id: 'mes', label: 'Mês' },
            { id: 'personalizado', label: 'Personalizado' },
          ].map((p) => (
            <Button
              key={p.id}
              variant={periodo === p.id ? 'primary' : 'outline'}
              onClick={() => setPeriodo(p.id)}
              className="text-xs px-4 py-2 rounded-xl"
              id={`filter-btn-${p.id}`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-4 animate-slideIn">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary uppercase font-bold font-sans">De:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-brand-surface border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary"
                id="filter-date-start"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary uppercase font-bold font-sans">Até:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-brand-surface border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary"
                id="filter-date-end"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bento Grid Principal: 6 Cards Super Premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
        
        {/* Total Coletado */}
        <Card className="relative overflow-hidden group border-l-4 border-success bg-linear-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col justify-between" id="card-total-coletado">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp size={70} />
          </div>
          <div>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-[9px]">Total Coletado</p>
            <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono text-success truncate">{formatCurrency(totalColetadoPeriodo)}</h3>
          </div>
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 gap-2">
            <div className="min-w-0">
              <p className="text-[8px] text-text-muted uppercase truncate">Multas</p>
              <p className="text-xs font-bold font-mono text-success truncate">{formatCurrency(multasColetadasPeriodo)}</p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[8px] text-text-muted uppercase truncate">Regulares</p>
              <p className="text-xs font-bold font-mono text-white truncate">{formatCurrency(Math.max(0, totalColetadoPeriodo - multasColetadasPeriodo))}</p>
            </div>
          </div>
        </Card>

        {/* Despesas Aprovadas */}
        <Card className="relative overflow-hidden group border-l-4 border-danger bg-linear-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col justify-between" id="card-despesas-aprovadas">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <ArrowDownRight size={70} />
          </div>
          <div>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-[9px]">Despesas Aprovadas</p>
            <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono text-danger truncate">{formatCurrency(despesasAprovadasPeriodo)}</h3>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5">
            <p className="text-[8px] text-text-muted uppercase truncate">Apenas custos aprovados</p>
          </div>
        </Card>

        {/* Repasses Cobradores */}
        <Card className="relative overflow-hidden group border-l-4 border-brand-primary bg-linear-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col justify-between" id="card-pagamentos-cobradores">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <Users size={70} />
          </div>
          <div>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-[9px]">Repasses Cobradores</p>
            <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono text-brand-primary truncate">{formatCurrency(pagamentosCobradoresPeriodo)}</h3>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5">
            <p className="text-[8px] text-text-muted uppercase truncate">Comissões pagas no período</p>
          </div>
        </Card>

        {/* Lucro Líquido */}
        <Card className="relative overflow-hidden group border-l-4 border-indigo-500 bg-linear-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col justify-between" id="card-lucro-liquido-periodo">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <DollarSign size={70} />
          </div>
          <div>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-[9px]">Lucro Líquido (Filtro)</p>
            <h3 className={cn("text-xl sm:text-2xl font-bold mt-1 font-mono truncate", lucroLiquidoPeriodo >= 0 ? "text-success" : "text-danger")}>
              {formatCurrency(lucroLiquidoPeriodo)}
            </h3>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5">
            <p className="text-[8px] text-text-muted uppercase truncate">Fórmula oficial do acerto</p>
          </div>
        </Card>

        {/* Capital em Rua (Estático) */}
        <Card className="relative overflow-hidden group border-l-4 border-warning bg-linear-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col justify-between" id="card-capital-rua">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <HandCoins size={70} />
          </div>
          <div>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-[9px]">Capital em Rua (Atual)</p>
            <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono text-warning truncate">{formatCurrency(saldoEmRua)}</h3>
          </div>
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 gap-2">
            <div className="min-w-0">
              <p className="text-[8px] text-text-muted uppercase truncate">Principal</p>
              <p className="text-xs font-bold font-mono text-warning truncate">{formatCurrency(saldoEmRua)}</p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[8px] text-text-muted uppercase truncate">Multas Pend.</p>
              <p className="text-xs font-bold font-mono text-danger truncate">{formatCurrency(multasPendentesTotal)}</p>
            </div>
          </div>
        </Card>

        {/* Projeção de Receita (Mensal) */}
        <Card className="relative overflow-hidden group border-l-4 border-pink-500 bg-linear-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col justify-between" id="card-projecao-mensal">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <Clock size={70} />
          </div>
          <div>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-[9px]">Projeção Mensal</p>
            <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono text-pink-400 truncate">{formatCurrency(projecaoMensal)}</h3>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5">
            <p className="text-[8px] text-text-muted uppercase truncate">Contratos ativos este mês</p>
          </div>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Esquerda: Gráficos e Detalhes */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Gráfico de Recebimentos Dinâmico */}
            <Card className="h-[350px] flex flex-col" id="chart-recebimentos-card">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-sm sm:text-base">Fluxo de Caixa (Filtrado)</h4>
                <Badge variant="primary">Recebimentos</Badge>
              </div>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#A0AEC0" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#A0AEC0" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#16213E', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      itemStyle={{ color: '#FF6B00' }}
                    />
                    <Line type="monotone" dataKey="valor" stroke="#FF6B00" strokeWidth={3} dot={{ r: 4, fill: '#FF6B00' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Resumo de Contratos do Período */}
            <Card className="h-[350px] flex flex-col" id="chart-contratos-card">
              <h4 className="font-bold mb-6 text-sm sm:text-base">Status de Contratos (Criados no Período)</h4>
              <div className="flex-1 flex items-center min-w-0">
                <div className="h-[240px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3 pr-4">
                  {pieData.map(item => (
                    <div key={item.name} className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] text-text-muted uppercase font-bold">{item.name}</span>
                      </div>
                      <span className="text-lg font-bold ml-4">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-border-subtle flex justify-between items-center">
                <span className="text-xs text-text-secondary">Novos Contratos no Período</span>
                <span className="text-sm font-bold">{totalContratosPeriodo}</span>
              </div>
            </Card>
          </div>

          {/* Tabelas de Itens Recentes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Clientes Coletados Hoje */}
            <Card className="p-0 overflow-hidden" id="card-tabela-coletas">
              <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-white/2">
                <h4 className="font-bold flex items-center gap-2 text-sm">
                  <HandCoins size={18} className="text-emerald-400" />
                  Coletados Hoje
                </h4>
                <Badge variant="success" className="text-[10px] font-mono font-bold">
                  {coletasHoje.length} ({formatCurrency(coletasHoje.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0))})
                </Badge>
              </div>
              <div className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
                {coletasHoje.map(r => {
                  let cliente = clientes.find(c => c.id === r.clienteId);
                  if (!cliente && r.emprestimoId) {
                    const emp = emprestimos.find(e => e.id === r.emprestimoId);
                    if (emp) cliente = clientes.find(c => c.id === emp.clienteId);
                  }
                  const cobrador = cobradores.find(cb => cb.id === r.cobradorId);
                  const nomeCliente = cliente?.nome || r.clienteNome || 'Cliente Não Identificado';
                  return (
                    <div key={r.id} className="px-5 py-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-bold text-white truncate">{nomeCliente}</p>
                        <p className="text-[10px] text-text-muted truncate">
                          Cobrador: <span className="text-text-secondary font-medium">{cobrador?.nome || 'Não inf.'}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-black font-mono text-emerald-400">{formatCurrency(r.valor)}</span>
                        <p className="text-[9px] text-text-muted uppercase font-bold">{r.tipo}</p>
                      </div>
                    </div>
                  );
                })}
                {coletasHoje.length === 0 && (
                  <div className="p-8 text-center text-text-muted opacity-50 text-xs">Nenhuma coleta realizada hoje.</div>
                )}
              </div>
            </Card>

            {/* Despesas Recentes */}
            <Card className="p-0 overflow-hidden" id="card-tabela-despesas">
              <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-white/2">
                <h4 className="font-bold flex items-center gap-2 text-sm">
                  <Receipt size={18} className="text-danger" />
                  Despesas Recentes
                </h4>
                <Badge variant="danger">{despesas.length}</Badge>
              </div>
              <div className="divide-y divide-border-subtle">
                {despesasRecentes.map(desp => (
                  <div key={desp.id} className="px-6 py-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                    <div>
                      <p className="text-sm font-bold truncate max-w-44">{desp.descricao}</p>
                      <p className="text-[10px] text-text-muted uppercase">{desp.tipo} • {formatDate(desp.criadoEm)}</p>
                    </div>
                    <span className="text-sm font-bold text-danger">-{formatCurrency(desp.valor)}</span>
                  </div>
                ))}
                {despesasRecentes.length === 0 && (
                  <div className="p-8 text-center text-text-muted opacity-50 text-xs">Nenhuma despesa registrada.</div>
                )}
              </div>
            </Card>

            {/* Contratos Recentes */}
            <Card className="p-0 overflow-hidden" id="card-tabela-contratos">
              <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-white/2">
                <h4 className="font-bold flex items-center gap-2 text-sm">
                  <FileText size={18} className="text-brand-primary" />
                  Novos Contratos
                </h4>
                <Badge variant="primary">{emprestimos.length}</Badge>
              </div>
              <div className="divide-y divide-border-subtle">
                {contratosRecentes.map(emp => {
                  const cliente = clientes.find(c => c.id === emp.clienteId);
                  return (
                    <div key={emp.id} className="px-6 py-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                      <div>
                        <p className="text-sm font-bold truncate max-w-44">{cliente?.nome || 'N/A'}</p>
                        <p className="text-[10px] text-text-muted uppercase">{formatCurrency(emp.valorPrincipal)} • {formatDate(emp.criadoEm)}</p>
                      </div>
                      <Badge variant={emp.status === 'atrasado' ? 'danger' : 'success'} className="text-[8px]">
                        {emp.status.toUpperCase()}
                      </Badge>
                    </div>
                  );
                })}
                {contratosRecentes.length === 0 && (
                  <div className="p-8 text-center text-text-muted opacity-50 text-xs">Nenhum contrato criado ainda.</div>
                )}
              </div>
            </Card>
          </div>

          {/* Guia Financeiro do Gestor */}
          <Card className="bg-brand-primary/5 border-brand-primary/10" id="card-guia-gestor">
            <h4 className="font-bold flex items-center gap-2 mb-4 text-sm">
              <AlertCircle size={18} className="text-brand-primary" />
              Guia Financeiro do Gestor
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-white/2 border border-white/5">
                <p className="text-xs font-bold text-brand-primary uppercase mb-2">Lucro do Período</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  O <strong>Lucro Líquido do Período</strong> é computado pela receita arrecadada (Total Coletado) subtraindo despesas de combustível/insumos (Despesas Aprovadas) e remunerações pagas aos cobradores (Repasses).
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/2 border border-white/5">
                <p className="text-xs font-bold text-indigo-400 uppercase mb-2">Projeção de Receita</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Reflete a expectativa bruta de parcelas a receber no mês corrente. É ideal para prever reinvestimentos e planejar novas alocações de capital.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/2 border border-white/5">
                <p className="text-xs font-bold text-warning uppercase mb-2">Capital em Rua</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Representa o saldo principal atualmente emprestado e pendente de amortização. É a base ativa que gera a sua rentabilidade.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/2 border border-white/5">
                <p className="text-xs font-bold text-success uppercase mb-2">Multi-Tenant Isolado</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Todas as transações e contratos estão isolados de forma segura sob o identificador exclusivo do Tenant autenticado na plataforma.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Coluna Direita: Metas e Vencimentos */}
        <div className="space-y-6">
          
          {/* Recebidos e Meta */}
          <Card className="bg-success/10 border-success/20" id="card-meta-recebidos">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-success font-bold uppercase tracking-widest">Coletado no Período</p>
              <DollarSign size={16} className="text-success" />
            </div>
            <h3 className="text-3xl font-bold font-mono text-success">{formatCurrency(totalColetadoPeriodo)}</h3>
            <div className="mt-4 h-1.5 w-full bg-success/10 rounded-full overflow-hidden">
              <div className="h-full bg-success" style={{ width: `${progressoMeta}%` }} />
            </div>
            <p className="text-[10px] text-text-muted mt-2">{progressoMeta}% da meta estipulada {labelMeta} (Meta: {formatCurrency(metaPeriodo)})</p>
          </Card>

          {/* Juros vencendo hoje */}
          <Card className="flex flex-col h-[550px]" id="card-vencendo-hoje">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-sm sm:text-base">Juros Vencendo Hoje</h4>
              <Badge variant="warning">{emprestimosComStatus.filter(e => e.status !== 'pago' && isTodayDate(e.dataVencimento)).length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {emprestimosComStatus
                .filter(e => e.status !== 'pago' && isTodayDate(e.dataVencimento))
                .map(e => {
                  const cliente = clientes.find(c => c.id === e.clienteId);
                  const cobrador = cobradores.find(cob => cob.id === e.cobradorId);
                  const message = cliente ? buildJurosVencendoHojeMessage(cliente, e, config) : '';
                  const whatsappUrl = cliente?.telefone ? buildWhatsAppUrl(cliente.telefone, message) : null;
                  return (
                    <div key={e.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2 group hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning shrink-0">
                            <Clock size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate max-w-[130px]">{cliente?.nome || 'N/A'}</p>
                            <p className="text-[10px] text-text-muted font-mono">{cliente?.telefone ? formatPhone(cliente.telefone) : 'Sem Telefone'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="warning" className="text-[9px]">HOJE</Badge>
                          <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">{formatCurrency(e.valorParcela)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-text-secondary">
                        <span className="truncate max-w-[120px]">Cobrador: <strong className="text-white">{cobrador?.nome || 'N/A'}</strong></span>
                        {cliente?.telefone ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition-all text-[10px]"
                          >
                            <MessageCircle size={12} />
                            Cobrar
                          </a>
                        ) : (
                          <span className="text-[9px] text-danger italic" title="Cliente sem telefone cadastrado.">Sem telefone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              {emprestimosComStatus.filter(e => e.status !== 'pago' && isTodayDate(e.dataVencimento)).length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-30">
                  <CheckCircle2 size={48} className="mb-2" />
                  <p className="text-sm">Tudo em dia!</p>
                </div>
              )}
            </div>
            <Button variant="outline" className="w-full mt-4 text-xs h-10" onClick={() => navigate('/app/emprestimos')} id="btn-ver-contratos">
              Ver Todos os Contratos
            </Button>
          </Card>

        </div>
      </div>
    </div>
  );
}
