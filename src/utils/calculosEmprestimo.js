const parseToLocalDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  
  if (typeof dateVal === 'object' && dateVal !== null && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  
  if (typeof dateVal === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    
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

export const calcularParcela = (principal, taxa, numParcelas) => {
  const p = parseFloat(principal);
  const t = parseFloat(taxa);
  
  if (isNaN(p) || isNaN(t)) return 0;
  
  // No modelo "Agiota", a parcela sugerida é apenas o Juro do período
  // Se houver numParcelas > 1, podemos sugerir (Principal / Parcelas) + Juros
  const n = parseInt(numParcelas) || 1;
  const jurosPorPeriodo = p * (t / 100);
  const amortizacao = p / n;
  
  return jurosPorPeriodo + amortizacao;
};

export const calcularSaldoDevedor = (emprestimo) => {
  if (emprestimo.modalidade === 'parcelado') {
    const totalParcs = parseInt(emprestimo.totalParcelas) || 1;
    const pagas = parseInt(emprestimo.parcelasPagas) || 0;
    const valParc = parseFloat(emprestimo.valorParcela) || 0;
    return Math.max(0, (totalParcs - pagas) * valParc);
  }
  // No modelo de amortização variável, o saldo devedor é o valorPrincipal atual
  return parseFloat(emprestimo.valorPrincipal) || 0;
};

export const getDiasAtraso = (dataVencimento) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = parseToLocalDate(dataVencimento);
  vencimento.setHours(0, 0, 0, 0);
  
  const diff = hoje.getTime() - vencimento.getTime();
  const dias = Math.floor(diff / 86400000);
  return dias > 0 ? dias : 0;
};

export const calcularStatus = (emprestimo) => {
  if (emprestimo.modalidade === 'parcelado') {
    const totalParcs = parseInt(emprestimo.totalParcelas) || 1;
    const pagas = parseInt(emprestimo.parcelasPagas) || 0;
    if (pagas >= totalParcs) return 'pago';
  } else {
    if (parseFloat(emprestimo.valorPrincipal) <= 0) return 'pago';
  }
  const diasAtraso = getDiasAtraso(emprestimo.dataVencimento);
  if (diasAtraso > (parseInt(emprestimo.carenciaDias) || 0)) return 'atrasado';
  return 'ativo';
};

export const calcularMulta = (emprestimo) => {
  const multaAcumulada = parseFloat(emprestimo.multaAcumulada) || 0;
  const diasAtraso = getDiasAtraso(emprestimo.dataVencimento);
  
  // Se não há atraso atual, retornamos apenas o que já estava acumulado e não foi pago
  if (diasAtraso <= (parseInt(emprestimo.carenciaDias) || 0)) return multaAcumulada;
  
  const multaFixa = parseFloat(emprestimo.multaFixa) || 0;
  const multaDiaria = parseFloat(emprestimo.multaDiaria) || 0;
  const saldo = calcularSaldoDevedor(emprestimo);
  
  const baseCalculoPerc = emprestimo.modalidade === 'parcelado' 
    ? (parseFloat(emprestimo.valorParcela) || 0)
    : saldo;
    
  const multaPerc = (baseCalculoPerc * (parseFloat(emprestimo.multaPercentual) || 0)) / 100;
  const totalMultaDiaria = diasAtraso * multaDiaria;
  
  // A multa total é a soma da multa dinâmica do atraso atual + qualquer multa acumulada de atrasos anteriores
  return multaAcumulada + multaFixa + multaPerc + totalMultaDiaria;
};

export const getQuantidadePeriodosAcumulados = (emprestimo) => {
  const diasAtraso = getDiasAtraso(emprestimo.dataVencimento);
  if (emprestimo.frequencia === 'dia_especifico') {
    return Math.max(1, Math.ceil(diasAtraso / 30));
  }
  const freq = { diario: 1, semanal: 7, quinzenal: 15, mensal: 30 };
  const diasPeriodo = freq[emprestimo.frequencia] || 30;
  
  // Se não há atraso, o período atual é 1. 
  // Se há atraso, contamos o período atual + os períodos que já passaram.
  return Math.max(1, Math.ceil(diasAtraso / diasPeriodo));
};

export const getJuroPorPeriodo = (emprestimo) => {
  if (emprestimo.modalidade === 'parcelado') return 0;
  const principal = parseFloat(emprestimo.valorPrincipal) || 0;
  const taxa = parseFloat(emprestimo.taxaJuros) || 0;
  return principal * (taxa / 100);
};

export const calcularJurosAcumulados = (emprestimo) => {
  if (emprestimo.modalidade === 'parcelado') return 0;
  // Usamos o principal atual para o cálculo de juros acumulados.
  const juroPorPeriodo = getJuroPorPeriodo(emprestimo);
  const totalPeriodos = getQuantidadePeriodosAcumulados(emprestimo);
  const abatimento = parseFloat(emprestimo.abatimentoJuros) || 0;
  
  const totalJuros = juroPorPeriodo * totalPeriodos;
  return Math.max(0, totalJuros - abatimento);
};

export const calcularPayoff = (emprestimo) => {
  if (emprestimo.modalidade === 'parcelado') {
    const totalParcs = parseInt(emprestimo.totalParcelas) || 1;
    const pagas = parseInt(emprestimo.parcelasPagas) || 0;
    const valParc = parseFloat(emprestimo.valorParcela) || 0;
    const saldoRestante = Math.max(0, (totalParcs - pagas) * valParc);
    return saldoRestante + calcularMulta(emprestimo);
  }
  const saldo = calcularSaldoDevedor(emprestimo);
  const juros = calcularJurosAcumulados(emprestimo);
  return saldo + juros + calcularMulta(emprestimo);
};

export const proximoVencimento = (dataVencimento, frequencia, numPeriodos = 1, diaVencimento = null) => {
  const venc = new Date(dataVencimento);
  
  if (frequencia === 'dia_especifico') {
    const targetDay = parseInt(diaVencimento) || venc.getDate();
    for (let i = 0; i < numPeriodos; i++) {
      venc.setMonth(venc.getMonth() + 1);
    }
    const maxDiasNoMes = new Date(venc.getFullYear(), venc.getMonth() + 1, 0).getDate();
    venc.setDate(Math.min(targetDay, maxDiasNoMes));
    return venc.toISOString();
  }
  
  const freq = { diario: 1, semanal: 7, quinzenal: 15, mensal: 30 };
  const dias = freq[frequencia] || 30;
  
  venc.setDate(venc.getDate() + (dias * numPeriodos));
  return venc.toISOString();
};

export const calcularQuitacaoAtualizada = (emprestimo, dataBase = new Date()) => {
  const status = calcularStatus(emprestimo);
  const estaAtrasado = status === 'atrasado';
  const saldoDevedor = calcularSaldoDevedor(emprestimo);

  // Raw difference in days
  const vencimento = parseToLocalDate(emprestimo.dataVencimento);
  vencimento.setHours(0, 0, 0, 0);
  const dbDate = new Date(dataBase);
  dbDate.setHours(0, 0, 0, 0);

  const diff = dbDate.getTime() - vencimento.getTime();
  const diasTotais = Math.floor(diff / 86400000);
  const diasAtrasoTotal = diasTotais > 0 ? diasTotais : 0;

  const carenciaDias = parseInt(emprestimo.carenciaDias) || 0;
  const diasAtrasoAplicaveis = diasAtrasoTotal > carenciaDias ? (diasAtrasoTotal - carenciaDias) : 0;

  const diasAtraso = estaAtrasado ? diasAtrasoAplicaveis : 0;

  const multaFixa = parseFloat(emprestimo.multaFixa) || 0;
  const multaPercentual = parseFloat(emprestimo.multaPercentual) || 0;
  const multaDiaria = parseFloat(emprestimo.multaDiaria) || 0;

  const multaFixaAplicada = diasAtraso > 0 ? multaFixa : 0;
  const multaPercentualAplicada = diasAtraso > 0 ? (saldoDevedor * multaPercentual) / 100 : 0;
  const multaDiariaAplicada = diasAtraso > 0 ? multaDiaria * diasAtraso : 0;

  const multaAcumulada = parseFloat(emprestimo.multaAcumulada) || 0;
  const totalEncargosAtraso = multaFixaAplicada + multaPercentualAplicada + multaDiariaAplicada + multaAcumulada;

  // Let's add juros acumulados to the payoff if it is a non-parcelado (juros-only) loan
  let jurosAcumulados = 0;
  if (emprestimo.modalidade !== 'parcelado') {
    jurosAcumulados = calcularJurosAcumulados(emprestimo);
  }

  // totalQuitacao: saldoDevedor + totalEncargosAtraso + any accumulated regular juros for juros-only models
  const totalQuitacao = saldoDevedor + totalEncargosAtraso + jurosAcumulados;

  return {
    saldoDevedor,
    diasAtraso,
    multaFixaAplicada,
    multaPercentualAplicada,
    multaDiariaAplicada: multaDiariaAplicada + jurosAcumulados, // merge juros under delay interest/daily fine
    totalEncargosAtraso: totalEncargosAtraso + jurosAcumulados,
    totalQuitacao,
    estaAtrasado
  };
};

