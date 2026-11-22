// =====================================================================
// Motor de pagamentos. Função PURA: recebe o contrato + o pagamento e
// devolve o que muda no contrato e como o valor foi distribuído.
// Usado igualzinho pelo gestor e pelo cobrador (antes eram duas cópias
// diferentes de ~150 linhas cada).
//
// Ordem em que um pagamento é aplicado:
//   1. multa em aberto
//   2. valor jogado da parcela anterior ("acréscimo")
//   3. parcela(s) / juro(s) do período
//   4. (contrato de juros) o que sobrar abate o capital
//
// Pagamento parcial de uma parcela/juro → quem registra escolhe:
//   'manter'  = a parcela continua aberta no mesmo período (vencimento não anda)
//   'proxima' = o período anda e o que faltou soma na próxima parcela
// =====================================================================
import {
  num, int, round2, ehParcelado, juroPorPeriodo, periodosEmAberto, multaDinamica, multaDevida,
  proximoVencimento, saldoDevedor, calcularStatus, conservarMulta, fracaoJurosParcela, valorQuitacao,
  parcelasRestantes,
} from './emprestimo.js';

const EPS = 0.005;

/** Campos do contrato que um pagamento pode alterar (as regras do Firestore usam a mesma lista). */
export const CAMPOS_PAGAMENTO = [
  'status', 'saldoDevedor', 'valorPrincipal', 'valorParcela', 'parcelasPagas', 'dataVencimento',
  'multaAcumulada', 'multaAbatida', 'abatimentoJuros', 'pagoParcelaAtual', 'acrescimoProximo',
  'ultimoRecebimentoId',
];

export const TIPOS_PAGAMENTO = {
  regular: 'Pagamento',
  quitacao: 'Quitação',
  somente_juros: 'Só juros',
  multa: 'Só multa',
};

/** Retrato dos campos do contrato antes do pagamento — permite desfazer com exatidão. */
export const fotografarContrato = (emp) => {
  const foto = {};
  CAMPOS_PAGAMENTO.forEach((c) => { foto[c] = emp[c] ?? null; });
  return foto;
};

/**
 * @param emp     contrato atual
 * @param opts    { valor, tipo: 'regular'|'quitacao'|'somente_juros'|'multa', opcaoParcial: 'manter'|'proxima'|null, ref: Date }
 * @returns { erro?, novosDados, composicao:{multa,juros,capital,parcela}, parcial:{faltando, podeJogarProxima}|null,
 *            precisaEscolha, troco, desconto, avancouPeriodos }
 */
export function simularPagamento(emp, { valor, tipo = 'regular', opcaoParcial = null, ref = new Date() } = {}) {
  const v = round2(valor);
  if (!(v > 0)) return { erro: 'Informe um valor maior que zero.' };
  if (tipo === 'somente_juros' && ehParcelado(emp)) return { erro: '"Só juros" não existe para contrato parcelado.' };

  const parcelado = ehParcelado(emp);
  const multaDin = multaDinamica(emp, ref);
  const multaAntes = multaDevida(emp, ref);
  const comp = { multa: 0, juros: 0, capital: 0, parcela: 0 };
  let r = v;
  let multaAcumulada = num(emp.multaAcumulada);
  let multaAbatida = num(emp.multaAbatida);
  let acrescimo = num(emp.acrescimoProximo);
  let avancou = 0;
  let parcial = null;
  let desconto = 0;

  const n = { ...emp };

  // ---------- QUITAÇÃO ----------
  if (tipo === 'quitacao') {
    const total = valorQuitacao(emp, ref);
    desconto = round2(Math.max(0, total - v));
    // distribui o valor pago: multa → juros → capital
    comp.multa = round2(Math.min(r, multaAntes)); r = round2(r - comp.multa);
    if (parcelado) {
      registrarParcela(comp, emp, Math.min(r, saldoDevedor(emp))); r = round2(r - Math.min(r, saldoDevedor(emp)));
    } else {
      const juros = round2(Math.max(0, juroPorPeriodo(emp) * periodosEmAberto(emp, ref) - num(emp.abatimentoJuros)) + acrescimo);
      comp.juros = round2(Math.min(r, juros)); r = round2(r - comp.juros);
      comp.capital = round2(Math.min(r, saldoDevedor(emp))); r = round2(r - comp.capital);
    }
    Object.assign(n, {
      valorPrincipal: 0, saldoDevedor: 0, multaAcumulada: 0, multaAbatida: 0, abatimentoJuros: 0,
      pagoParcelaAtual: 0, acrescimoProximo: 0, status: 'pago',
    });
    if (parcelado) n.parcelasPagas = int(emp.totalParcelas);
    return finalizar(emp, n, comp, { parcial, troco: r, desconto, avancou, ref });
  }

  // ---------- 1. MULTA ----------
  const pagoMulta = round2(Math.min(r, multaAntes));
  if (pagoMulta > 0) {
    const daAcumulada = Math.min(pagoMulta, multaAcumulada);
    multaAcumulada = round2(multaAcumulada - daAcumulada);
    multaAbatida = round2(multaAbatida + (pagoMulta - daAcumulada));
    comp.multa = pagoMulta;
    r = round2(r - pagoMulta);
  }
  if (tipo === 'multa') {
    Object.assign(n, { multaAcumulada, multaAbatida });
    return finalizar(emp, n, comp, { parcial, troco: r, desconto, avancou, ref });
  }

  // ---------- 2. ACRÉSCIMO (o que foi jogado da parcela anterior) ----------
  const pagoAcresc = round2(Math.min(r, acrescimo));
  if (pagoAcresc > 0) {
    acrescimo = round2(acrescimo - pagoAcresc);
    r = round2(r - pagoAcresc);
    if (parcelado) registrarParcela(comp, emp, pagoAcresc);
    else comp.juros = round2(comp.juros + pagoAcresc);
  }

  if (parcelado) {
    // ---------- 3. PARCELAS ----------
    const valP = num(emp.valorParcela);
    const total = int(emp.totalParcelas);
    let pagas = int(emp.parcelasPagas);
    let pagoAtual = num(emp.pagoParcelaAtual);
    while (r > EPS && pagas < total && valP > 0) {
      const falta = round2(valP - pagoAtual);
      if (r + EPS >= falta) {
        registrarParcela(comp, emp, falta);
        r = round2(r - falta);
        pagas += 1; pagoAtual = 0; avancou += 1;
      } else {
        const faltando = round2(falta - r);
        const podeJogarProxima = pagas < total - 1;
        parcial = { faltando, podeJogarProxima, rotulo: 'parcela' };
        registrarParcela(comp, emp, r);
        if (opcaoParcial === 'proxima' && podeJogarProxima) {
          pagas += 1; pagoAtual = 0; avancou += 1;
          acrescimo = round2(acrescimo + faltando);
        } else {
          pagoAtual = round2(pagoAtual + r);
        }
        r = 0;
      }
    }
    n.parcelasPagas = pagas;
    n.pagoParcelaAtual = pagoAtual;
  } else {
    // ---------- 3. JUROS ----------
    const J = juroPorPeriodo(emp);
    let abat = num(emp.abatimentoJuros);
    if (J > EPS) {
      const periodos = periodosEmAberto(emp, ref);
      let k = 0;
      while (r > EPS && k < periodos) {
        const falta = round2(J - abat);
        if (r + EPS >= falta) {
          comp.juros = round2(comp.juros + falta);
          r = round2(r - falta);
          abat = 0; k += 1; avancou += 1;
        } else {
          const faltando = round2(falta - r);
          parcial = { faltando, podeJogarProxima: true, rotulo: 'juros' };
          comp.juros = round2(comp.juros + r);
          if (opcaoParcial === 'proxima') {
            avancou += 1; abat = 0;
            acrescimo = round2(acrescimo + faltando);
          } else {
            abat = round2(abat + r);
          }
          r = 0; k += 1;
        }
      }
      // "Só juros" pode adiantar períodos futuros; sobra vira crédito para o próximo juro.
      if (tipo === 'somente_juros' && r > EPS) {
        const extras = Math.floor((r + abat + EPS) / J);
        if (extras > 0) {
          comp.juros = round2(comp.juros + r);
          abat = round2(r + abat - extras * J);
          avancou += extras;
        } else {
          comp.juros = round2(comp.juros + r);
          abat = round2(abat + r);
        }
        r = 0;
      }
    } else if (r > EPS) {
      // taxa zero: tudo abate capital e o vencimento anda um período
      avancou += 1;
    }
    n.abatimentoJuros = abat;

    // ---------- 4. CAPITAL ----------
    if (tipo === 'regular' && r > EPS) {
      const cap = round2(Math.min(r, num(emp.valorPrincipal)));
      comp.capital = round2(comp.capital + cap);
      r = round2(r - cap);
      n.valorPrincipal = round2(num(emp.valorPrincipal) - cap);
    }
    n.valorParcela = round2(num(n.valorPrincipal) * num(emp.taxaJuros) / 100);
  }

  n.acrescimoProximo = acrescimo;
  if (avancou > 0) n.dataVencimento = proximoVencimento(emp.dataVencimento, emp.frequencia, avancou, emp.diaVencimento);

  // Mantém a multa restante consistente com o novo vencimento (nem some, nem duplica).
  const multaRestante = round2(multaAcumulada + Math.max(0, multaDin - multaAbatida));
  if (avancou > 0) Object.assign(n, conservarMulta(multaRestante, n, ref));
  else Object.assign(n, { multaAcumulada, multaAbatida });

  return finalizar(emp, n, comp, { parcial, troco: r, desconto, avancou, ref, opcaoParcial });
}

function registrarParcela(comp, emp, valor) {
  const f = fracaoJurosParcela(emp);
  if (f === null) { comp.parcela = round2(comp.parcela + valor); return; }
  const j = round2(valor * f);
  comp.juros = round2(comp.juros + j);
  comp.capital = round2(comp.capital + valor - j);
}

function finalizar(emp, n, comp, { parcial, troco, desconto, avancou, ref, opcaoParcial }) {
  if (ehParcelado(n)) {
    n.valorPrincipal = saldoDevedor(n);
    if (parcelasRestantes(n) === 0 && num(n.acrescimoProximo) <= EPS) n.valorPrincipal = 0;
  }
  if (num(n.valorPrincipal) <= EPS && !ehParcelado(n)) {
    Object.assign(n, { valorPrincipal: 0, abatimentoJuros: 0, acrescimoProximo: 0, valorParcela: 0 });
  }
  n.saldoDevedor = saldoDevedor(n);
  n.status = calcularStatus(n, ref);
  if (n.status === 'pago') Object.assign(n, { multaAcumulada: 0, multaAbatida: 0 });

  const novosDados = {};
  CAMPOS_PAGAMENTO.forEach((c) => {
    if (c === 'ultimoRecebimentoId') return;
    if (n[c] !== undefined && n[c] !== emp[c]) novosDados[c] = n[c];
  });

  return {
    novosDados,
    contratoDepois: n,
    composicao: Object.fromEntries(Object.entries(comp).filter(([, x]) => x > 0)),
    parcial,
    precisaEscolha: !!parcial && parcial.podeJogarProxima && !opcaoParcial,
    troco: round2(troco),
    desconto: round2(desconto),
    avancouPeriodos: avancou,
  };
}

/** Classifica recebimentos antigos (sem composição gravada) para a conferência. */
export const composicaoDoRecebimento = (rec) => {
  if (rec?.composicao && typeof rec.composicao === 'object') return rec.composicao;
  const v = num(rec?.valor);
  if (rec?.tipo === 'multa') return { multa: v };
  if (rec?.tipo === 'somente_juros') return { juros: v };
  return { parcela: v };
};
