// Conferência do dia: quanto cada cobrador recebeu (separado em juros,
// capital, multa), as despesas que lançou e o valor líquido a entregar.
import { composicaoDoRecebimento } from './pagamento.js';
import { num, round2, pertenceAoCobrador, parseData } from './emprestimo.js';

const somar = (a, b) => {
  const r = { ...a };
  Object.entries(b).forEach(([k, v]) => { r[k] = round2((r[k] || 0) + num(v)); });
  return r;
};

export const dataDoRecebimento = (r) => r.dataRecebimento || r.criadoEm;
export const dataDaDespesa = (d) => d.data || d.criadoEm;

/**
 * @returns { grupos: [{ id, nome, cobrador, recebimentos, despesas, totais, total, totalDespesas, liquido }], geral }
 */
export function conferenciaDoDia(dia, dados) {
  const ini = parseData(dia); ini.setHours(0, 0, 0, 0);
  const fim = new Date(ini); fim.setHours(23, 59, 59, 999);
  return conferenciaDoPeriodo(ini, fim, dados);
}

/** Igual à conferência do dia, mas para um intervalo [inicio, fim]. */
export function conferenciaDoPeriodo(inicio, fim, { recebimentos, despesas, cobradores }) {
  const dentro = (v) => { const d = parseData(v); return !!d && d >= inicio && d <= fim; };
  const recsDia = recebimentos.filter((r) => dentro(dataDoRecebimento(r)));
  const despsDia = despesas.filter((d) => dentro(dataDaDespesa(d)));

  const grupoDe = (cobradorId) => cobradores.find((c) => pertenceAoCobrador(cobradorId, c)) || null;
  const mapa = new Map();
  const pegar = (cob) => {
    const id = cob?.id || '_gestor';
    if (!mapa.has(id)) {
      mapa.set(id, {
        id, cobrador: cob, nome: cob?.nome || 'Recebido pelo gestor',
        recebimentos: [], despesas: [], totais: {}, total: 0, totalDespesas: 0, liquido: 0,
      });
    }
    return mapa.get(id);
  };

  recsDia.forEach((r) => {
    const g = pegar(grupoDe(r.cobradorId));
    g.recebimentos.push(r);
    g.totais = somar(g.totais, composicaoDoRecebimento(r));
    g.total = round2(g.total + num(r.valor));
  });
  despsDia.forEach((d) => {
    const g = pegar(grupoDe(d.cobradorId));
    g.despesas.push(d);
    if (d.aprovada !== false) g.totalDespesas = round2(g.totalDespesas + num(d.valor));
  });

  const ordenarHora = (a, b) => (parseData(dataDoRecebimento(b)) || 0) - (parseData(dataDoRecebimento(a)) || 0);
  const grupos = [...mapa.values()].map((g) => ({
    ...g,
    recebimentos: g.recebimentos.sort(ordenarHora),
    liquido: round2(g.total - g.totalDespesas),
  })).sort((a, b) => b.total - a.total);

  const geral = grupos.reduce((acc, g) => ({
    totais: somar(acc.totais, g.totais),
    total: round2(acc.total + g.total),
    totalDespesas: round2(acc.totalDespesas + g.totalDespesas),
    liquido: round2(acc.liquido + g.liquido),
    qtd: acc.qtd + g.recebimentos.length,
  }), { totais: {}, total: 0, totalDespesas: 0, liquido: 0, qtd: 0 });

  return { grupos, geral };
}

// ---------- períodos ----------
export const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

/** Converte a escolha do filtro em { inicio, fim } (datas locais, dia inteiro). */
export function intervaloDoPeriodo(periodo, de, ate, ref = new Date()) {
  const fim = new Date(ref); fim.setHours(23, 59, 59, 999);
  const inicio = new Date(ref); inicio.setHours(0, 0, 0, 0);
  if (periodo === '7d') inicio.setDate(inicio.getDate() - 6);
  else if (periodo === '30d') inicio.setDate(inicio.getDate() - 29);
  else if (periodo === 'custom') {
    const a = parseData(de); const b = parseData(ate);
    if (a && b) {
      const i = new Date(Math.min(a, b)); i.setHours(0, 0, 0, 0);
      const f = new Date(Math.max(a, b)); f.setHours(23, 59, 59, 999);
      return { inicio: i, fim: f };
    }
  }
  return { inicio, fim };
}
