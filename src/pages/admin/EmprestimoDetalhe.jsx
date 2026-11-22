import React from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useContrato } from '../../hooks/useCarteira';
import ContratoView from '../../components/ContratoView';
import { PageHeader, Card, Empty } from '../../components/ui';
import { TelaCarregando } from '../../components/layout';

export default function EmprestimoDetalhe() {
  const { id } = useParams();
  const carregado = useAppStore((s) => s.carregado.emprestimos);
  const contrato = useContrato(id);

  if (!contrato) {
    if (!carregado) return <TelaCarregando />;
    return (
      <div>
        <PageHeader back title="Contrato" />
        <Card><Empty title="Contrato não encontrado" text="Ele pode ter sido excluído." /></Card>
      </div>
    );
  }
  return <ContratoView contrato={contrato} modo="admin" />;
}
