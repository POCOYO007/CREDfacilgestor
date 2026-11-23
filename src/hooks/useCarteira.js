import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  calcularStatus, getDiasAtraso, devidoAgora, saldoDevedor, valorQuitacao, mesmoDia, parseData,
  pertenceAoCobrador, multaDevida,
} from '../domain/emprestimo';

/** Junta contrato + cliente + cobrador + números do dia, pronto para as telas. */
export function enriquecerContrato(e, clientes, cobradores, ref = new Date()) {
  const status = calcularStatus(e, ref);
  const devido = devidoAgora(e, ref);
  const venc = parseData(e.dataVencimento);
  return {
    ...e,
    status,
    cliente: clientes.find((c) => c.id === e.clienteId) || null,
    cobrador: cobradores.find((c) => pertenceAoCobrador(e.cobradorId, c)) || null,
    diasAtraso: status === 'pago' ? 0 : getDiasAtraso(e.dataVencimento, ref),
    venceHoje: status !== 'pago' && !!venc && mesmoDia(venc, ref),
    devido,
    multa: multaDevida(e, ref),
    saldo: saldoDevedor(e),
    quitacao: status === 'pago' ? 0 : valorQuitacao(e, ref),
  };
}

export function useContratos() {
  const emprestimos = useAppStore((s) => s.emprestimos);
  const clientes = useAppStore((s) => s.clientes);
  const cobradores = useAppStore((s) => s.cobradores);
  return useMemo(() => {
    const ref = new Date();
    return emprestimos.map((e) => enriquecerContrato(e, clientes, cobradores, ref));
  }, [emprestimos, clientes, cobradores]);
}

export function useContrato(id) {
  const contratos = useContratos();
  return contratos.find((c) => c.id === id) || null;
}

/** Ordem de cobrança: atrasados (mais dias primeiro) → vence hoje → em dia (vencimento mais próximo). */
export const ordemDeCobranca = (a, b) => {
  const peso = (c) => (c.status === 'atrasado' ? 0 : c.venceHoje ? 1 : 2);
  if (peso(a) !== peso(b)) return peso(a) - peso(b);
  if (a.status === 'atrasado') return b.diasAtraso - a.diasAtraso;
  return (parseData(a.dataVencimento) || 0) - (parseData(b.dataVencimento) || 0);
};

export const statusVisual = (c) => {
  if (c.status === 'pago') return { label: c.modalidade === 'aluguel' ? 'Encerrado' : 'Quitado', variant: c.modalidade === 'aluguel' ? 'neutral' : 'success' };
  if (c.status === 'atrasado') return { label: `${c.diasAtraso}d atraso`, variant: 'danger' };
  if (c.venceHoje) return { label: 'Vence hoje', variant: 'warning' };
  if (c.diasAtraso > 0) return { label: 'Carência', variant: 'warning' };
  return { label: 'Em dia', variant: 'neutral' };
};

// ---------- ordenação das listas ----------
const nomeDe = (c) => (c.cliente?.nome || c.nome || '').trim();
const comparaNome = (a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR', { sensitivity: 'base' });

export const ORDENS_CONTRATO = [
  { value: 'cobranca', label: 'Prioridade de cobrança' },
  { value: 'az', label: 'Nome A → Z' },
  { value: 'za', label: 'Nome Z → A' },
  { value: 'maior', label: 'Maior valor a receber' },
  { value: 'menor', label: 'Menor valor a receber' },
  { value: 'atraso', label: 'Mais dias de atraso' },
  { value: 'vencimento', label: 'Vencimento mais próximo' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigos', label: 'Mais antigos' },
];

export function ordenarContratos(lista, ordem = 'cobranca') {
  const l = [...lista];
  const data = (v) => parseData(v) || 0;
  const valor = (c) => (c.status === 'pago' ? 0 : c.devido.total);
  switch (ordem) {
    case 'az': return l.sort(comparaNome);
    case 'za': return l.sort((a, b) => comparaNome(b, a));
    case 'maior': return l.sort((a, b) => valor(b) - valor(a) || comparaNome(a, b));
    case 'menor': return l.sort((a, b) => valor(a) - valor(b) || comparaNome(a, b));
    case 'atraso': return l.sort((a, b) => b.diasAtraso - a.diasAtraso || comparaNome(a, b));
    case 'vencimento': return l.sort((a, b) => data(a.dataVencimento) - data(b.dataVencimento));
    case 'recentes': return l.sort((a, b) => data(b.criadoEm) - data(a.criadoEm));
    case 'antigos': return l.sort((a, b) => data(a.criadoEm) - data(b.criadoEm));
    default: return l.sort(ordemDeCobranca);
  }
}

export const ORDENS_CLIENTE = [
  { value: 'az', label: 'Nome A → Z' },
  { value: 'za', label: 'Nome Z → A' },
  { value: 'saldo', label: 'Maior saldo em aberto' },
  { value: 'devido', label: 'Maior valor a receber hoje' },
  { value: 'recentes', label: 'Cadastrados mais recentes' },
  { value: 'antigos', label: 'Cadastrados mais antigos' },
];

export function ordenarClientes(lista, ordem = 'az') {
  const l = [...lista];
  const data = (v) => parseData(v) || 0;
  switch (ordem) {
    case 'za': return l.sort((a, b) => comparaNome(b, a));
    case 'saldo': return l.sort((a, b) => (b.saldo || 0) - (a.saldo || 0) || comparaNome(a, b));
    case 'devido': return l.sort((a, b) => (b.devido || 0) - (a.devido || 0) || comparaNome(a, b));
    case 'recentes': return l.sort((a, b) => data(b.criadoEm) - data(a.criadoEm));
    case 'antigos': return l.sort((a, b) => data(a.criadoEm) - data(b.criadoEm));
    default: return l.sort(comparaNome);
  }
}
