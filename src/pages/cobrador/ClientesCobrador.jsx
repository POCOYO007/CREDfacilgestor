import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Users, Plus, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useMeuCobrador } from '../../hooks/useMeuCobrador';
import { PageHeader, SearchInput, Chips, Card, Empty, Button, Badge } from '../../components/ui';
import ClienteForm from '../../components/ClienteForm';
import EmprestimoForm from '../../components/EmprestimoForm';
import { filtrarClientes } from '../admin/Clientes';
import { formatCurrency } from '../../utils/formatters';

export default function ClientesCobrador() {
  const clientes = useAppStore((s) => s.clientes);
  const { contratos, cobradorId } = useMeuCobrador();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('meus');
  const [novoCliente, setNovoCliente] = useState(false);
  const [emprestarPara, setEmprestarPara] = useState(null);

  const resumo = useMemo(() => clientes.map((cl) => {
    const meus = contratos.filter((c) => c.clienteId === cl.id && c.status !== 'pago');
    return { ...cl, meus, devido: meus.reduce((s, c) => s + c.devido.total, 0), atrasado: meus.some((c) => c.status === 'atrasado') };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })), [clientes, contratos]);

  const lista = filtrarClientes(resumo, busca).filter((c) => filtro === 'todos' || c.meus.length > 0);

  return (
    <div>
      <PageHeader title="Clientes" actions={<Button size="sm" onClick={() => setNovoCliente(true)}><UserPlus className="w-4 h-4" /> Novo</Button>} />
      <div className="space-y-3 mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Nome, telefone ou bairro" />
        <Chips value={filtro} onChange={setFiltro} options={[
          { value: 'meus', label: 'Na minha rota', count: resumo.filter((c) => c.meus.length).length },
          { value: 'todos', label: 'Todos', count: resumo.length },
        ]} />
      </div>

      {lista.length === 0 ? (
        <Card><Empty icon={<Users className="w-6 h-6" />} title="Nenhum cliente encontrado" action={<Button onClick={() => setNovoCliente(true)}>Cadastrar cliente</Button>} /></Card>
      ) : (
        <div className="space-y-2">
          {lista.map((c) => (
            <Card key={c.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-surface-2 flex items-center justify-center font-bold text-text-secondary shrink-0">{c.nome?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="font-bold truncate">{c.nome}</p>{c.atrasado && <Badge variant="danger">Atraso</Badge>}</div>
                  <p className="text-[12px] text-text-secondary truncate">{[c.telefone, c.endereco?.bairro].filter(Boolean).join(' · ')}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEmprestarPara(c)}><Plus className="w-4 h-4" /> Empréstimo</Button>
              </div>
              {c.meus.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {c.meus.map((e) => (
                    <Link key={e.id} to={`/cobrador/contrato/${e.id}`} className="flex items-center justify-between rounded-xl bg-brand-surface-2 px-3 py-2 text-sm">
                      <span className="text-text-secondary">{e.modalidade === 'parcelado' ? `Parcelado ${e.parcelasPagas || 0}/${e.totalParcelas}` : `Juros ${e.taxaJuros}%`}</span>
                      <span className="flex items-center gap-1 font-bold tabular-nums">{formatCurrency(e.devido.total)}<ChevronRight className="w-4 h-4 text-text-muted" /></span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ClienteForm isOpen={novoCliente} onClose={() => setNovoCliente(false)} />
      <EmprestimoForm isOpen={!!emprestarPara} onClose={() => setEmprestarPara(null)} cliente={emprestarPara} cobradorFixo={cobradorId} />
    </div>
  );
}
