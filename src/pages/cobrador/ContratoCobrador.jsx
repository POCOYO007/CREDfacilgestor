import React from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useMeuCobrador } from '../../hooks/useMeuCobrador';
import ContratoView from '../../components/ContratoView';
import { PageHeader, Card, Empty } from '../../components/ui';
import { TelaCarregando } from '../../components/layout';

export default function ContratoCobrador() {
  const { id } = useParams();
  const carregado = useAppStore((s) => s.carregado.emprestimos);
  const { contratos, cobradorId } = useMeuCobrador();
  const contrato = contratos.find((c) => c.id === id);

  if (!contrato) {
    if (!carregado) return <TelaCarregando />;
    return <div><PageHeader back title="Contrato" /><Card><Empty title="Contrato não encontrado" /></Card></div>;
  }
  return <ContratoView contrato={contrato} modo="cobrador" cobradorId={cobradorId} />;
}
