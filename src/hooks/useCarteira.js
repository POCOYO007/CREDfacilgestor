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
