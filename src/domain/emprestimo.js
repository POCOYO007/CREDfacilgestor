// =====================================================================
// Regras de cálculo de empréstimos — fonte ÚNICA de verdade.
//
// Dois tipos de contrato:
//  - "parcelado": N parcelas de valor fixo (ex.: pegou 1.000, paga 12x100).
//  - "tradicional" (juros): o cliente paga o juro do período
//    (principal × taxa) e o que passar disso abate o capital.
//
// Duas gerações de regra de multa:
//  - versaoRegra 1 (contratos antigos): soma multa fixa + % + diária,
//    exatamente como o sistema sempre calculou. NADA muda para eles até
//    o gestor editar o contrato.
//  - versaoRegra 2 (contratos novos/editados): UMA multa só, escolhida
//    no contrato (por dia de atraso, % da parcela ou valor fixo por parcela).
// =====================================================================

export const FREQ_DIAS = { diario: 1, semanal: 7, quinzenal: 15, mensal: 30 };

export const FREQUENCIAS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal (30 dias)' },
  { value: 'dia_especifico', label: 'Todo mês no dia…' },
];

export const TIPOS_MULTA = [
  { value: 'nenhuma', label: 'Sem multa', unidade: '' },
  { value: 'atraso_diaria', label: 'Multa por atraso (R$ por dia)', unidade: 'R$/dia' },
  { value: 'parcela_percentual', label: 'Multa da parcela (%)', unidade: '%' },
  { value: 'parcela_fixa', label: 'Multa da parcela (R$ fixo)', unidade: 'R$' },
];

export const VERSAO_REGRA_ATUAL = 2;

// ---------- números ----------
export const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
export const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
/** Arredonda para centavos (evita 0.1 + 0.2 = 0.30000000000000004). */
export const round2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

// ---------- datas ----------
/** Converte string/Date/Timestamp em Date local. Datas "YYYY-MM-DD" viram meio-dia local (sem drift de fuso). */
export const parseData = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return new Date(dateVal.getTime());
  if (typeof dateVal === 'object' && typeof dateVal.seconds === 'number') return new Date(dateVal.seconds * 1000);
  if (typeof dateVal === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0, 0);
    }
  }
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Mesmo comportamento antigo: data inválida/ausente vira "agora". */
export const parseToLocalDate = (dateVal) => parseData(dateVal) || new Date();

/** "YYYY-MM-DD" do dia LOCAL (o toISOString() usa UTC e vira o dia seguinte depois das 21h no Brasil). */
export const hojeISO = (ref = new Date()) => {
  const d = new Date(ref);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const mesmoDia = (a, b) => {
  const da = parseData(a);
  const db = parseData(b);
  return !!da && !!db && da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const inicioDoDia = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const diffDias = (de, ate) => Math.round((inicioDoDia(ate) - inicioDoDia(de)) / 86400000);

export const getDiasAtraso = (dataVencimento, ref = new Date()) => {
  const venc = parseData(dataVencimento);
  if (!venc) return 0;
  return Math.max(0, diffDias(venc, ref));
};

export const diasDoPeriodo = (emp) => (emp.frequencia === 'dia_especifico' ? 30 : FREQ_DIAS[emp.frequencia] || 30);

export const proximoVencimento = (dataVencimento, frequencia, numPeriodos = 1, diaVencimento = null) => {
  const venc = parseData(dataVencimento) || new Date();
  const n = Number.isFinite(numPeriodos) ? Math.max(0, Math.floor(numPeriodos)) : 0;
  if (n === 0) return venc.toISOString();
  if (frequencia === 'dia_especifico') {
    const alvo = int(diaVencimento) || venc.getDate();
    venc.setDate(1);
    venc.setMonth(venc.getMonth() + n);
    const maxDias = new Date(venc.getFullYear(), venc.getMonth() + 1, 0).getDate();
    venc.setDate(Math.min(alvo, maxDias));
    return venc.toISOString();
  }
  venc.setDate(venc.getDate() + (FREQ_DIAS[frequencia] || 30) * n);
  return venc.toISOString();
};

// ---------- contrato ----------
export const ehParcelado = (emp) => emp?.modalidade === 'parcelado';
export const ehRegraNova = (emp) => int(emp?.versaoRegra) >= 2;

export const juroPorPeriodo = (emp) => (ehParcelado(emp) ? 0 : round2(num(emp.valorPrincipal) * num(emp.taxaJuros) / 100));

/** Quantos períodos de juros estão em aberto (o atual conta como 1). Mesma regra de sempre. */
export const periodosEmAberto = (emp, ref = new Date()) => {
  const dias = getDiasAtraso(emp.dataVencimento, ref);
  return Math.max(1, Math.ceil(dias / diasDoPeriodo(emp)));
};

export const parcelasRestantes = (emp) => Math.max(0, int(emp.totalParcelas) - int(emp.parcelasPagas));

/** Saldo devedor (o que falta pagar, sem multa e sem juros futuros). */
export const saldoDevedor = (emp) => {
  if (ehParcelado(emp)) {
    const resto = parcelasRestantes(emp) * num(emp.valorParcela) - num(emp.pagoParcelaAtual) + num(emp.acrescimoProximo);
    return round2(Math.max(0, resto));
  }
  return round2(Math.max(0, num(emp.valorPrincipal)));
};

export const estaAtrasado = (emp, ref = new Date()) => getDiasAtraso(emp.dataVencimento, ref) > int(emp.carenciaDias);

/** Parcelas (ou períodos de juros) vencidas — usado pela multa "por parcela". */
export const parcelasAtrasadas = (emp, ref = new Date()) => {
  if (!estaAtrasado(emp, ref)) return 0;
  const n = Math.ceil(getDiasAtraso(emp.dataVencimento, ref) / diasDoPeriodo(emp));
  return ehParcelado(emp) ? Math.min(n, Math.max(1, parcelasRestantes(emp))) : n;
};

/** Valor-base da "multa da parcela": a parcela (parcelado) ou o juro do período (juros). */
export const baseDaParcela = (emp) => (ehParcelado(emp) ? num(emp.valorParcela) : juroPorPeriodo(emp));

/** Multa gerada pelo atraso ATUAL (sem a acumulada de atrasos anteriores, sem descontar o já pago). */
export const multaDinamica = (emp, ref = new Date()) => {
  if (!estaAtrasado(emp, ref)) return 0;
  const dias = getDiasAtraso(emp.dataVencimento, ref);

  if (!ehRegraNova(emp)) {
    // Regra antiga — idêntica ao cálculo original.
    const base = ehParcelado(emp) ? num(emp.valorParcela) : saldoDevedor(emp);
    return round2(num(emp.multaFixa) + base * num(emp.multaPercentual) / 100 + dias * num(emp.multaDiaria));
  }

  const v = num(emp.valorMulta);
  switch (emp.tipoMulta) {
    case 'atraso_diaria':
      return round2(v * dias);
    case 'parcela_percentual':
      return round2(baseDaParcela(emp) * v / 100 * parcelasAtrasadas(emp, ref));
    case 'parcela_fixa':
      return round2(v * parcelasAtrasadas(emp, ref));
    default:
      return 0;
  }
};

/** Multa total em aberto = acumulada + (dinâmica − parte da dinâmica já paga). */
export const multaDevida = (emp, ref = new Date()) =>
  round2(num(emp.multaAcumulada) + Math.max(0, multaDinamica(emp, ref) - num(emp.multaAbatida)));

/** Juros vencidos (contrato de juros): períodos em aberto × juro − crédito parcial já pago. */
export const jurosAcumulados = (emp, ref = new Date()) => {
  if (ehParcelado(emp)) return 0;
  return round2(Math.max(0, juroPorPeriodo(emp) * periodosEmAberto(emp, ref) - num(emp.abatimentoJuros)));
};

/** O que o cliente deve pagar AGORA para ficar em dia. */
export const devidoAgora = (emp, ref = new Date()) => {
  const multa = multaDevida(emp, ref);
  const acrescimo = num(emp.acrescimoProximo);
  if (ehParcelado(emp)) {
    const restantes = parcelasRestantes(emp);
    if (restantes === 0) return { multa, acrescimo, principal: 0, total: round2(multa + acrescimo) };
    const qtd = Math.min(restantes, Math.max(1, estaAtrasado(emp, ref) ? parcelasAtrasadas(emp, ref) : 1));
    const parcelas = round2(qtd * num(emp.valorParcela) - num(emp.pagoParcelaAtual));
    return { multa, acrescimo, parcelas, qtdParcelas: qtd, total: round2(multa + acrescimo + parcelas) };
  }
  const juros = jurosAcumulados(emp, ref);
  return { multa, acrescimo, juros, periodos: periodosEmAberto(emp, ref), total: round2(multa + acrescimo + juros) };
};

/** Valor para quitar o contrato hoje. */
export const valorQuitacao = (emp, ref = new Date()) => {
  const multa = multaDevida(emp, ref);
  if (ehParcelado(emp)) return round2(saldoDevedor(emp) + multa);
  return round2(saldoDevedor(emp) + jurosAcumulados(emp, ref) + num(emp.acrescimoProximo) + multa);
};

export const calcularStatus = (emp, ref = new Date()) => {
  if (ehParcelado(emp)) {
    if (int(emp.parcelasPagas) >= Math.max(1, int(emp.totalParcelas)) && num(emp.acrescimoProximo) <= EPS) return 'pago';
  } else if (num(emp.valorPrincipal) <= EPS) {
    return 'pago';
  }
  return estaAtrasado(emp, ref) ? 'atrasado' : 'ativo';
};

/** Parte de juros embutida em cada real de parcela (para separar juros × capital na conferência). */
export const fracaoJurosParcela = (emp) => {
  const total = num(emp.valorParcela) * int(emp.totalParcelas);
  const inicial = num(emp.valorPrincipalInicial);
  if (!(total > 0) || !(inicial > 0) || inicial > total) return null;
  return 1 - inicial / total;
};

/**
 * Mantém a multa em aberto igual quando o contrato muda de estado (vencimento
 * avançou, regra de multa mudou, etc.) — sem contar duas vezes e sem perder.
 * Devolve os novos { multaAcumulada, multaAbatida }.
 */
export const conservarMulta = (devidaAntes, depois, ref = new Date()) => {
  const din = multaDinamica({ ...depois, multaAbatida: 0 }, ref);
  if (devidaAntes >= din) return { multaAcumulada: round2(devidaAntes - din), multaAbatida: 0 };
  return { multaAcumulada: 0, multaAbatida: round2(din - devidaAntes) };
};

/** Descrição legível da multa do contrato. */
export const descreverMulta = (emp) => {
  if (!ehRegraNova(emp)) {
    const partes = [];
    if (num(emp.multaFixa)) partes.push(`R$ ${num(emp.multaFixa).toFixed(2)} fixa`);
    if (num(emp.multaPercentual)) partes.push(`${num(emp.multaPercentual)}%`);
    if (num(emp.multaDiaria)) partes.push(`R$ ${num(emp.multaDiaria).toFixed(2)}/dia`);
    return partes.length ? `${partes.join(' + ')} (regra antiga)` : 'Sem multa (regra antiga)';
  }
  const v = num(emp.valorMulta);
  switch (emp.tipoMulta) {
    case 'atraso_diaria': return `R$ ${v.toFixed(2)} por dia de atraso`;
    case 'parcela_percentual': return `${v}% por parcela atrasada`;
    case 'parcela_fixa': return `R$ ${v.toFixed(2)} por parcela atrasada`;
    default: return 'Sem multa';
  }
};

// ---------- cobrador ----------
/**
 * Registros antigos às vezes guardam o cobrador pelo nome/usuário/e-mail em
 * vez do id. Esta função centraliza essa compatibilidade.
 */
export const pertenceAoCobrador = (registroCobradorId, cobrador) => {
  if (!registroCobradorId || !cobrador) return false;
  const alvo = String(registroCobradorId).trim().toLowerCase();
  const chaves = [cobrador.id, cobrador.username, cobrador.email, cobrador.email?.split('@')[0]]
    .filter(Boolean)
    .map((x) => String(x).trim().toLowerCase());
  return chaves.includes(alvo);
};

// ---------- novo contrato ----------
/** Monta o documento de um empréstimo novo a partir do formulário. Lança Error com mensagem amigável. */
export const montarNovoEmprestimo = (form, { clienteId, cobradorId }) => {
  const principal = num(form.valorPrincipal);
  if (!(principal > 0)) throw new Error('Informe o valor emprestado.');
  const parcelado = form.modalidade === 'parcelado';
  const taxa = num(form.taxaJuros);
  const parcelas = int(form.totalParcelas);
  const valorParcela = num(form.valorParcela);
  if (parcelado && !(parcelas > 0)) throw new Error('Informe o número de parcelas.');
  if (parcelado && !(valorParcela > 0)) throw new Error('Informe o valor de cada parcela.');
  if (!parcelado && taxa < 0) throw new Error('Taxa de juros inválida.');
  const tipoMulta = form.tipoMulta || 'nenhuma';
  const valorMulta = tipoMulta === 'nenhuma' ? 0 : num(form.valorMulta);
  if (tipoMulta !== 'nenhuma' && !(valorMulta > 0)) throw new Error('Informe o valor da multa.');

  const inicio = parseData(form.dataInicio) || new Date();
  const primeiroVenc = form.primeiroVencimento
    ? parseData(form.primeiroVencimento)
    : parseData(proximoVencimento(inicio, form.frequencia, 1, form.diaVencimento));

  const saldo = parcelado ? round2(parcelas * valorParcela) : round2(principal);
  return {
    modalidade: parcelado ? 'parcelado' : 'tradicional',
    versaoRegra: VERSAO_REGRA_ATUAL,
    clienteId,
    cobradorId: cobradorId || '',
    valorPrincipalInicial: round2(principal),
    valorPrincipal: saldo,
    saldoDevedor: saldo,
    taxaJuros: parcelado ? 0 : taxa,
    totalParcelas: parcelado ? parcelas : 0,
    parcelasPagas: 0,
    valorParcela: parcelado ? round2(valorParcela) : round2(principal * taxa / 100),
    frequencia: form.frequencia || 'mensal',
    diaVencimento: form.frequencia === 'dia_especifico' ? int(form.diaVencimento) || primeiroVenc.getDate() : null,
    dataInicio: inicio.toISOString(),
    dataVencimento: primeiroVenc.toISOString(),
    carenciaDias: int(form.carenciaDias),
    tipoMulta,
    valorMulta,
    multaAcumulada: 0,
    multaAbatida: 0,
    abatimentoJuros: 0,
    pagoParcelaAtual: 0,
    acrescimoProximo: 0,
    status: 'ativo',
  };
};
