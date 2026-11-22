import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button, Input } from './ui';
import { useAppStore } from '../store/useAppStore';
import { formatCPF, formatPhone } from '../utils/formatters';

const vazio = { nome: '', cpfCnpj: '', telefone: '', whatsapp: '', endereco: { rua: '', numero: '', bairro: '', cidade: '', cep: '' } };

export default function ClienteForm({ isOpen, onClose, cliente, onSalvo }) {
  const adicionarCliente = useAppStore((s) => s.adicionarCliente);
  const editarCliente = useAppStore((s) => s.editarCliente);
  const [f, setF] = useState(vazio);
  const [mesmoWhats, setMesmoWhats] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (cliente) {
      setF({ ...vazio, ...cliente, endereco: { ...vazio.endereco, ...(cliente.endereco || {}) } });
      setMesmoWhats(!cliente.whatsapp || cliente.whatsapp.replace(/\D/g, '') === (cliente.telefone || '').replace(/\D/g, ''));
    } else {
      setF(vazio);
      setMesmoWhats(true);
    }
  }, [isOpen, cliente]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setEnd = (k) => (e) => setF((p) => ({ ...p, endereco: { ...p.endereco, [k]: e.target.value } }));

  const salvar = async () => {
    if (!f.nome.trim()) { toast.error('Informe o nome do cliente.'); return; }
    if (!f.telefone.trim()) { toast.error('Informe o telefone.'); return; }
    const dados = {
      nome: f.nome.trim(),
      cpfCnpj: f.cpfCnpj.trim(),
      telefone: f.telefone.trim(),
      whatsapp: (mesmoWhats ? f.telefone : f.whatsapp).replace(/\D/g, ''),
      endereco: f.endereco,
    };
    setSalvando(true);
    try {
      if (cliente) {
        await editarCliente(cliente.id, dados);
        toast.success('Cliente atualizado!');
        onSalvo?.(cliente.id);
      } else {
        const id = await adicionarCliente(dados);
        toast.success('Cliente cadastrado!');
        onSalvo?.(id);
      }
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cliente ? 'Editar cliente' : 'Novo cliente'}
      footer={<Button size="lg" block loading={salvando} onClick={salvar}>{cliente ? 'Salvar' : 'Cadastrar cliente'}</Button>}
    >
      <div className="space-y-3">
        <Input label="Nome completo *" value={f.nome} onChange={set('nome')} autoFocus={!cliente} autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone *" type="tel" inputMode="tel" value={f.telefone} onChange={set('telefone')} onBlur={() => setF((p) => ({ ...p, telefone: formatPhone(p.telefone) }))} />
          <Input label="CPF/CNPJ" inputMode="numeric" value={f.cpfCnpj} onChange={set('cpfCnpj')} onBlur={() => setF((p) => ({ ...p, cpfCnpj: formatCPF(p.cpfCnpj) }))} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={mesmoWhats} onChange={(e) => setMesmoWhats(e.target.checked)} className="w-4 h-4 accent-[var(--brand-primary)]" />
          O telefone é WhatsApp
        </label>
        {!mesmoWhats && <Input label="WhatsApp" type="tel" inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} />}

        <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted pt-2">Endereço</p>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Input label="Rua" value={f.endereco.rua} onChange={setEnd('rua')} />
          <Input label="Nº" value={f.endereco.numero} onChange={setEnd('numero')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bairro" value={f.endereco.bairro} onChange={setEnd('bairro')} />
          <Input label="Cidade" value={f.endereco.cidade} onChange={setEnd('cidade')} />
        </div>
      </div>
    </Modal>
  );
}
