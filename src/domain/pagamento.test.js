// Rode com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simularPagamento } from './pagamento.js';
import {
  multaDevida, multaDinamica, devidoAgora, valorQuitacao, calcularStatus, montarNovoEmprestimo,
  conservarMulta, hojeISO,
} from './emprestimo.js';

const HOJE = new Date(2026, 10, 22, 15, 0, 0); // 22/11/2026 15h
const diasAtras = (d) => { const x = new Date(HOJE); x.setDate(x.getDate() - d); return x.toISOString(); };
const diasFrente = (d) => diasAtras(-d);

const parcelado = (extra = {}) => ({
  modalidade: 'parcelado', versaoRegra: 2, valorPrincipalInicial: 1000, valorParcela: 100, totalParcelas: 12,
  parcelasPagas: 0, valorPrincipal: 1200, saldoDevedor: 1200, frequencia: 'mensal', carenciaDias: 0,
  dataVencimento: diasFrente(5), tipoMulta: 'nenhuma', valorMulta: 0, ...extra,
});
const juros = (extra = {}) => ({
  modalidade: 'tradicional', versaoRegra: 2, valorPrincipal: 1000, taxaJuros: 20, frequencia: 'mensal',
  carenciaDias: 0, dataVencimento: diasFrente(5), tipoMulta: 'nenhuma', valorMulta: 0, ...extra,
});
const pagar = (emp, valor, tipo = 'regular', opcaoParcial = null) => simularPagamento(emp, { valor, tipo, opcaoParcial, ref: HOJE });

// ----- PARCELADO: 1.000 em 12x de 100 -----
test('parcelado: paga 100 → 1 parcela, vencimento anda, saldo 1100', () => {
  const r = pagar(parcelado(), 100);
  assert.equal(r.contratoDepois.parcelasPagas, 1);
  assert.equal(r.contratoDepois.saldoDevedor, 1100);
  assert.equal(r.avancouPeriodos, 1);
  assert.equal(r.precisaEscolha, false);
});

test('parcelado: paga 40 de 100 → pergunta o que fazer com os 60', () => {
  const r = pagar(parcelado(), 40);
  assert.equal(r.precisaEscolha, true);
  assert.equal(r.parcial.faltando, 60);
});

test('parcelado: 40 de 100 "manter" → parcela segue aberta, vencimento parado, faltam 60', () => {
  const emp = parcelado();
  const r = pagar(emp, 40, 'regular', 'manter');
  assert.equal(r.contratoDepois.parcelasPagas, 0);
  assert.equal(r.contratoDepois.pagoParcelaAtual, 40);
  assert.equal(r.contratoDepois.dataVencimento, emp.dataVencimento);
  assert.equal(r.contratoDepois.saldoDevedor, 1160);
  assert.equal(devidoAgora(r.contratoDepois, HOJE).total, 60);
  // depois paga os 60 → parcela fecha
  const r2 = pagar(r.contratoDepois, 60);
  assert.equal(r2.contratoDepois.parcelasPagas, 1);
  assert.equal(r2.contratoDepois.pagoParcelaAtual, 0);
  assert.equal(r2.contratoDepois.saldoDevedor, 1100);
});

test('parcelado: 40 de 100 "proxima" → próxima parcela fica 160', () => {
  const r = pagar(parcelado(), 40, 'regular', 'proxima');
  const c = r.contratoDepois;
  assert.equal(c.parcelasPagas, 1);
  assert.equal(c.acrescimoProximo, 60);
  assert.equal(c.saldoDevedor, 1160);
  assert.equal(devidoAgora(c, HOJE).total, 160);
  const r2 = pagar(c, 160);
  assert.equal(r2.contratoDepois.parcelasPagas, 2);
  assert.equal(r2.contratoDepois.acrescimoProximo, 0);
  assert.equal(r2.contratoDepois.saldoDevedor, 1000);
});

test('parcelado: na última parcela não dá pra jogar pra próxima', () => {
  const r = pagar(parcelado({ parcelasPagas: 11, valorPrincipal: 100 }), 40, 'regular', 'proxima');
  assert.equal(r.parcial.podeJogarProxima, false);
  assert.equal(r.contratoDepois.parcelasPagas, 11);
  assert.equal(r.contratoDepois.pagoParcelaAtual, 40);
});

test('parcelado: 250 → 2 parcelas + 50 parcial (antes contava 3 parcelas)', () => {
  const r = pagar(parcelado(), 250, 'regular', 'manter');
  assert.equal(r.contratoDepois.parcelasPagas, 2);
  assert.equal(r.contratoDepois.pagoParcelaAtual, 50);
});

test('parcelado: separa juros e capital (1000 → 1200: 1/6 de cada parcela é juros)', () => {
  const r = pagar(parcelado(), 100);
  assert.equal(r.composicao.juros, 16.67);
  assert.equal(r.composicao.capital, 83.33);
});

test('parcelado: última parcela quita o contrato', () => {
  const r = pagar(parcelado({ parcelasPagas: 11, valorPrincipal: 100 }), 100);
  assert.equal(r.contratoDepois.status, 'pago');
  assert.equal(r.contratoDepois.saldoDevedor, 0);
});

// ----- JUROS: 1.000 a 20% -----
test('juros: paga 200 → quita o juro, vencimento anda, capital igual', () => {
  const r = pagar(juros(), 200);
  assert.equal(r.contratoDepois.valorPrincipal, 1000);
  assert.equal(r.avancouPeriodos, 1);
  assert.equal(r.composicao.juros, 200);
});

test('juros: paga 500 → 200 juros + 300 capital, próximo juro 140', () => {
  const r = pagar(juros(), 500);
  assert.equal(r.composicao.juros, 200);
  assert.equal(r.composicao.capital, 300);
  assert.equal(r.contratoDepois.valorPrincipal, 700);
  assert.equal(r.contratoDepois.valorParcela, 140);
});

test('juros: 150 de 200 "manter" → crédito de 150, vencimento parado', () => {
  const emp = juros();
  const r = pagar(emp, 150, 'regular', 'manter');
  assert.equal(r.precisaEscolha, false);
  assert.equal(r.contratoDepois.abatimentoJuros, 150);
  assert.equal(r.contratoDepois.dataVencimento, emp.dataVencimento);
  assert.equal(devidoAgora(r.contratoDepois, HOJE).total, 50);
});

test('juros: 150 de 200 "proxima" → período anda, próximo juro 250', () => {
  const r = pagar(juros(), 150, 'regular', 'proxima');
  assert.equal(r.contratoDepois.acrescimoProximo, 50);
  assert.equal(r.avancouPeriodos, 1);
  assert.equal(devidoAgora(r.contratoDepois, HOJE).total, 250);
});

test('juros: 2 meses sem pagar → deve 400', () => {
  const emp = juros({ dataVencimento: diasAtras(40) });
  assert.equal(devidoAgora(emp, HOJE).juros, 400);
});

test('juros com taxa 0 não trava (antes dava divisão por zero)', () => {
  const r = pagar(juros({ taxaJuros: 0 }), 300);
  assert.equal(r.erro, undefined);
  assert.equal(r.contratoDepois.valorPrincipal, 700);
});

test('"só juros" em parcelado é recusado ANTES de gravar qualquer coisa', () => {
  assert.ok(pagar(parcelado(), 50, 'somente_juros').erro);
});

// ----- MULTAS (regra nova: uma só) -----
test('multa por atraso: R$5/dia, 10 dias = 50', () => {
  const emp = juros({ dataVencimento: diasAtras(10), tipoMulta: 'atraso_diaria', valorMulta: 5 });
  assert.equal(multaDinamica(emp, HOJE), 50);
});

test('multa da parcela 10%: parcela 100 atrasada = 10', () => {
  const emp = parcelado({ dataVencimento: diasAtras(3), tipoMulta: 'parcela_percentual', valorMulta: 10 });
  assert.equal(multaDinamica(emp, HOJE), 10);
});

test('multa da parcela fixa R$20: duas parcelas atrasadas = 40', () => {
  const emp = parcelado({ dataVencimento: diasAtras(35), tipoMulta: 'parcela_fixa', valorMulta: 20 });
  assert.equal(multaDinamica(emp, HOJE), 40);
});

test('carência: dentro dos dias de carência não tem multa', () => {
  const emp = parcelado({ dataVencimento: diasAtras(2), carenciaDias: 3, tipoMulta: 'parcela_fixa', valorMulta: 20 });
  assert.equal(multaDinamica(emp, HOJE), 0);
  assert.equal(calcularStatus(emp, HOJE), 'ativo');
});

test('pagamento cobre a multa primeiro', () => {
  const emp = parcelado({ dataVencimento: diasAtras(3), tipoMulta: 'parcela_fixa', valorMulta: 20 });
  const r = pagar(emp, 120);
  assert.equal(r.composicao.multa, 20);
  assert.equal(r.contratoDepois.parcelasPagas, 1);
});

test('multa não duplica nem some quando o vencimento anda com atraso de 2 parcelas', () => {
  const emp = parcelado({ dataVencimento: diasAtras(35), tipoMulta: 'parcela_fixa', valorMulta: 20 });
  assert.equal(multaDevida(emp, HOJE), 40);
  const r = pagar(emp, 100, 'regular', 'manter'); // só cobre parte da multa + 60 da parcela
  const c = r.contratoDepois;
  // pagou 40 de multa → multa em aberto deve ser 0 + multa da parcela ainda atrasada no novo estado
  assert.equal(r.composicao.multa, 40);
  assert.equal(multaDevida(c, HOJE), 0);
});

// ----- CONTRATOS ANTIGOS -----
test('contrato antigo calcula multa como antes (fixa + % + diária)', () => {
  const antigo = {
    modalidade: 'parcelado', valorParcela: 100, totalParcelas: 10, parcelasPagas: 2,
    dataVencimento: diasAtras(5), carenciaDias: 0, multaFixa: 10, multaPercentual: 2, multaDiaria: 1,
  };
  assert.equal(multaDinamica(antigo, HOJE), 10 + 2 + 5);
});

test('contrato antigo sem campos novos paga normalmente', () => {
  const antigo = { modalidade: 'tradicional', valorPrincipal: 1000, taxaJuros: 10, frequencia: 'semanal', dataVencimento: diasFrente(2) };
  const r = pagar(antigo, 100);
  assert.equal(r.contratoDepois.valorPrincipal, 1000);
  assert.equal(r.avancouPeriodos, 1);
});

// ----- QUITAÇÃO -----
test('quitação zera tudo e marca pago', () => {
  const emp = juros({ dataVencimento: diasAtras(10), tipoMulta: 'atraso_diaria', valorMulta: 2 });
  const total = valorQuitacao(emp, HOJE);
  assert.equal(total, 1000 + 200 + 20);
  const r = pagar(emp, total, 'quitacao');
  assert.equal(r.contratoDepois.status, 'pago');
  assert.equal(r.desconto, 0);
  assert.equal(r.composicao.capital, 1000);
});

test('quitação com valor menor registra o desconto', () => {
  const emp = juros();
  const r = pagar(emp, 1000, 'quitacao');
  assert.equal(r.desconto, 200);
});

// ----- UTIL -----
test('conservarMulta mantém o total', () => {
  const depois = parcelado({ dataVencimento: diasAtras(3), tipoMulta: 'parcela_fixa', valorMulta: 20 });
  const m = conservarMulta(50, depois, HOJE);
  assert.equal(multaDevida({ ...depois, ...m }, HOJE), 50);
  const m2 = conservarMulta(5, depois, HOJE);
  assert.equal(multaDevida({ ...depois, ...m2 }, HOJE), 5);
});

test('montarNovoEmprestimo valida e monta', () => {
  const e = montarNovoEmprestimo({ modalidade: 'parcelado', valorPrincipal: 1000, valorParcela: 100, totalParcelas: 12, frequencia: 'mensal', dataInicio: '2026-11-01', tipoMulta: 'parcela_percentual', valorMulta: 10 }, { clienteId: 'c1', cobradorId: 'k1' });
  assert.equal(e.saldoDevedor, 1200);
  assert.equal(e.versaoRegra, 2);
  assert.throws(() => montarNovoEmprestimo({ modalidade: 'parcelado', valorPrincipal: 1000 }, {}));
});

test('hojeISO usa o dia local', () => {
  assert.equal(hojeISO(new Date(2026, 10, 22, 23, 30)), '2026-11-22');
});
