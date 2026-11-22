// Conferência do dia: quanto cada cobrador recebeu (separado em juros,
// capital, multa), as despesas que lançou e o valor líquido a entregar.
import { composicaoDoRecebimento } from './pagamento.js';
import { mesmoDia, num, round2, pertenceAoCobrador, parseData } from './emprestimo.js';

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
export function conferenciaDoDia(dia, { recebimentos, despesas, cobradores }) {
  const recsDia = recebimentos.filter((r) => mesmoDia(dataDoRecebimento(r), dia));
  const despsDia = despesas.filter((d) => mesmoDia(dataDaDespesa(d), dia));

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
