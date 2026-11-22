import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useContratos } from './useCarteira';
import { pertenceAoCobrador } from '../domain/emprestimo';

/** Cobrador logado + os contratos/recebimentos/despesas dele. */
export function useMeuCobrador() {
  const usuario = useAppStore((s) => s.usuarioAtual);
  const cobradores = useAppStore((s) => s.cobradores);
  const recebimentos = useAppStore((s) => s.recebimentos);
  const despesas = useAppStore((s) => s.despesas);
  const contratos = useContratos();

  const eu = useMemo(() => cobradores.find((c) => c.id === usuario?.cobradorId)
    || { id: usuario?.cobradorId, nome: usuario?.nome, email: usuario?.email }, [cobradores, usuario]);

  const meus = (registroId) => registroId === eu.id || pertenceAoCobrador(registroId, eu);

  return useMemo(() => ({
    eu,
    cobradorId: eu.id,
    contratos: contratos.filter((c) => meus(c.cobradorId)),
    recebimentos: recebimentos.filter((r) => meus(r.cobradorId)),
    despesas: despesas.filter((d) => meus(d.cobradorId)),
  }), [eu, contratos, recebimentos, despesas]); // eslint-disable-line
}
