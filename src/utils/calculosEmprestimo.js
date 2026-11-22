// Compatibilidade: os cálculos agora vivem em src/domain/emprestimo.js.
// Este arquivo só mantém os nomes antigos para quem ainda importa daqui.
import {
  parseToLocalDate, getDiasAtraso, calcularStatus, proximoVencimento, saldoDevedor, multaDevida,
  multaDinamica, jurosAcumulados, juroPorPeriodo, periodosEmAberto, valorQuitacao, estaAtrasado, num, int,
} from '../domain/emprestimo.js';

export { parseToLocalDate, getDiasAtraso, calcularStatus, proximoVencimento };

export const calcularSaldoDevedor = saldoDevedor;
export const calcularMulta = (emp) => multaDevida(emp);
export const calcularJurosAcumulados = (emp) => jurosAcumulados(emp);
export const getJuroPorPeriodo = juroPorPeriodo;
export const getQuantidadePeriodosAcumulados = (emp) => periodosEmAberto(emp);
export const calcularPayoff = (emp) => valorQuitacao(emp);

export const calcularParcela = (principal, taxa, numParcelas) => {
  const p = num(principal);
  const n = int(numParcelas) || 1;
  return p * (num(taxa) / 100) + p / n;
};

/** Usado no PDF de extrato. */
export const calcularQuitacaoAtualizada = (emp, dataBase = new Date()) => {
  const atrasado = estaAtrasado(emp, dataBase);
  const multa = multaDevida(emp, dataBase);
  const juros = jurosAcumulados(emp, dataBase) + num(emp.acrescimoProximo) * (emp.modalidade === 'parcelado' ? 0 : 1);
  return {
    saldoDevedor: saldoDevedor(emp),
    diasAtraso: atrasado ? getDiasAtraso(emp.dataVencimento, dataBase) : 0,
    multaFixaAplicada: 0,
    multaPercentualAplicada: multa,
    multaDiariaAplicada: emp.modalidade === 'parcelado' ? 0 : juros,
    totalEncargosAtraso: valorQuitacao(emp, dataBase) - saldoDevedor(emp),
    totalQuitacao: valorQuitacao(emp, dataBase),
    estaAtrasado: atrasado,
    multaDinamica: multaDinamica(emp, dataBase),
  };
};
