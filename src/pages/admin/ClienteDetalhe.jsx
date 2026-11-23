import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, MessageCircle, Phone, MapPin, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { linkContrato } from '../../domain/emprestimo';
import { useContratos } from '../../hooks/useCarteira';
import { PageHeader, Card, Row, SectionTitle, Button, Empty, Modal, IconButton, cn } from '../../components/ui';
import ContratoCard, { linkMapa } from '../../components/ContratoCard';
import ClienteForm from '../../components/ClienteForm';
import EmprestimoForm from '../../components/EmprestimoForm';
import AluguelForm from '../../components/AluguelForm';
import { TelaCarregando } from '../../components/layout';
import { formatCurrency, buildWhatsAppUrl } from '../../utils/formatters';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientes = useAppStore((s) => s.clientes);
  const carregado = useAppStore((s) => s.carregado.clientes);
  const config = useAppStore((s) => s.config);
  const removerCliente = useAppStore((s) => s.removerCliente);
  const contratos = useContratos();
  const [editando, setEditando] = useState(false);
  const [novoEmp, setNovoEmp] = useState(false);
  const [novoAluguel, setNovoAluguel] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) {
    if (!carregado) return <TelaCarregando />;
    return <div><PageHeader back title="Cliente" /><Card><Empty title="Cliente não encontrado" /></Card></div>;
  }

  const meus = contratos.filter((c) => c.clienteId === id);
  const ativos = meus.filter((c) => c.status !== 'pago');
  const quitados = meus.filter((c) => c.status === 'pago');
  const whats = buildWhatsAppUrl(cliente.whatsapp || cliente.telefone, `Olá ${cliente.nome}!`);
  const mapa = linkMapa(cliente);
  const end = cliente.endereco || {};

  const apagar = async () => {
    setOcupado(true);
    try {
      await removerCliente(id);
      toast.success('Cliente excluído.');
      navigate('/app/clientes', { replace: true });
    } catch (e) { toast.error(e.message); setOcupado(false); }
  };

  return (
    <div>
      <PageHeader
        back="/app/clientes"
        title={cliente.nome}
        subtitle={cliente.cpfCnpj || undefined}
        actions={<IconButton label="Editar cliente" onClick={() => setEditando(true)}><Pencil className="w-5 h-5" /></IconButton>}
      />

      <div className="grid grid-cols-3 gap-2">
        <AcaoContato href={whats} icon={MessageCircle} label="WhatsApp" className="text-success" />
        <AcaoContato href={cliente.telefone ? `tel:${cliente.telefone.replace(/\D/g, '')}` : null} icon={Phone} label="Ligar" />
        <AcaoContato href={mapa} icon={MapPin} label="Mapa" />
      </div>

      <Card className="px-4 py-2 mt-3">
        <Row label="Telefone" value={cliente.telefone || '—'} />
        <Row label="Endereço" value={[end.rua && `${end.rua}${end.numero ? `, ${end.numero}` : ''}`, end.bairro].filter(Boolean).join(' · ') || '—'} />
        {end.cidade && <Row label="Cidade" value={end.cidade} />}
        <Row label="Em aberto" value={formatCurrency(ativos.reduce((s, c) => s + c.saldo, 0))} strong />
      </Card>

      <SectionTitle action={(
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setNovoAluguel(true)}><Plus className="w-4 h-4" /> Aluguel</Button>
          <Button size="sm" onClick={() => setNovoEmp(true)}><Plus className="w-4 h-4" /> Empréstimo</Button>
        </div>
      )}>
        Contratos ativos ({ativos.length})
      </SectionTitle>
      {ativos.length === 0 ? (
        <Card><Empty icon={<FileText className="w-6 h-6" />} title="Nenhum contrato ativo" action={<Button onClick={() => setNovoEmp(true)}>Novo empréstimo</Button>} /></Card>
      ) : (
        <div className="space-y-2">{ativos.map((c) => <ContratoCard key={c.id} contrato={c} to={linkContrato(c)} config={config} mostrarCobrador />)}</div>
      )}

      {quitados.length > 0 && (
        <>
          <SectionTitle>Quitados ({quitados.length})</SectionTitle>
          <div className="space-y-2">{quitados.map((c) => <ContratoCard key={c.id} contrato={c} to={linkContrato(c)} config={config} />)}</div>
        </>
      )}

      <Button variant="danger-soft" block className="mt-8" onClick={() => setExcluir(true)}><Trash2 className="w-4 h-4" /> Excluir cliente</Button>

      <ClienteForm isOpen={editando} onClose={() => setEditando(false)} cliente={cliente} />
      <AluguelForm isOpen={novoAluguel} onClose={() => setNovoAluguel(false)} cliente={cliente} onCriado={(e) => e.id && navigate(linkContrato(e))} />
      <EmprestimoForm isOpen={novoEmp} onClose={() => setNovoEmp(false)} cliente={cliente} onCriado={(e) => e.id && navigate(linkContrato(e))} />
      <Modal
        isOpen={excluir}
        onClose={() => setExcluir(false)}
        title="Excluir cliente?"
        footer={<><Button variant="ghost" className="flex-1" onClick={() => setExcluir(false)}>Cancelar</Button><Button variant="danger" className="flex-1" loading={ocupado} onClick={apagar}>Excluir tudo</Button></>}
      >
        <p className="text-sm text-text-secondary">Apaga o cliente, os {meus.length} contrato(s) e todos os recebimentos dele. Não dá para desfazer.</p>
      </Modal>
    </div>
  );
}

function AcaoContato({ href, icon: Icon, label, className }) {
  return (
    <a href={href || undefined} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
      className={cn('surface-card h-16 flex flex-col items-center justify-center gap-1 text-[12px] font-semibold text-text-secondary active:bg-brand-surface-2', !href && 'opacity-40 pointer-events-none')}>
      <Icon className={cn('w-5 h-5', className)} />{label}
    </a>
  );
}
