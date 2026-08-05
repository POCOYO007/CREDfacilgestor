import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button, Input, Card, Badge, Modal } from '../../components/ui';
import { formatCurrency, formatCPF, formatPhone } from '../../utils/formatters';
import { Search, UserPlus, MoreVertical, Phone, MessageCircle, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Clientes() {
  const { clientes, adicionarCliente, editarCliente, removerCliente, emprestimos } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('nome'); // 'nome' or 'recente'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [editingCliente, setEditingCliente] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: '',
    cpfCnpj: '',
    telefone: '',
    whatsapp: '',
    endereco: { rua: '', numero: '', bairro: '', cidade: '', cep: '' }
  });

  const filteredClientes = useMemo(() => clientes
    .filter(c =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpfCnpj.includes(searchTerm)
    )
    .sort((a, b) => {
      if (sortBy === 'nome') {
        return a.nome.localeCompare(b.nome);
      }
      return new Date(b.criadoEm) - new Date(a.criadoEm);
    }), [clientes, searchTerm, sortBy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCliente) {
      editarCliente(editingCliente.id, formData);
      toast.success('Cliente atualizado!');
    } else {
      adicionarCliente(formData);
      toast.success('Cliente cadastrado!');
    }
    handleCloseModal();
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormData(cliente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCliente(null);
    setFormData({
      nome: '',
      cpfCnpj: '',
      telefone: '',
      whatsapp: '',
      endereco: { rua: '', numero: '', bairro: '', cidade: '', cep: '' }
    });
  };

  const handleDelete = () => {
    if (clientToDelete) {
      removerCliente(clientToDelete.id);
      toast.success('Cliente removido.');
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    }
  };

  const openDeleteModal = (cliente) => {
    setClientToDelete(cliente);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-sm text-text-secondary">Gerencie sua base de tomadores de crédito.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 w-full sm:w-auto justify-center">
          <UserPlus size={20} />
          Novo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="sm:col-span-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF/CNPJ..."
              className="w-full bg-brand-surface-2 border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-sm sm:text-base focus:outline-hidden focus:border-brand-primary transition-all text-text-primary"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </Card>
        <Card className="p-3 sm:p-4 flex items-center">
          <select 
            className="w-full bg-transparent focus:outline-hidden text-sm text-text-primary"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="nome">Ordem Alfabética</option>
            <option value="recente">Mais Recentes</option>
          </select>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredClientes.map(cliente => {
          const clientEmprestimos = emprestimos.filter(e => e.clienteId === cliente.id && e.status !== 'pago');
          const totalDevedor = clientEmprestimos.reduce((s, e) => s + (e.saldoDevedor || 0), 0);

          return (
            <Card key={cliente.id} className="flex flex-col hover:border-brand-primary/50 transition-all cursor-pointer p-4 sm:p-5" onClick={() => navigate(`/app/clientes/${cliente.id}`)}>
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-surface-2 border border-border-subtle flex items-center justify-center font-bold text-brand-primary text-lg sm:text-xl shrink-0">
                    {cliente.nome.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-base sm:text-lg leading-tight truncate">{cliente.nome}</h4>
                    <p className="text-xs text-text-muted font-mono truncate">{formatCPF(cliente.cpfCnpj)}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => handleEdit(cliente)} className="p-1.5 text-text-muted hover:text-white transition-colors"><Edit size={16} /></button>
                  <button type="button" onClick={() => openDeleteModal(cliente)} className="p-1.5 text-text-muted hover:text-danger transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary min-w-0">
                  <Phone size={14} className="shrink-0" />
                  <span className="truncate">{formatPhone(cliente.telefone)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary min-w-0">
                  <MessageCircle size={14} className="shrink-0" />
                  <span className="truncate">{cliente.whatsapp || 'N/A'}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold truncate">Saldo Devedor</p>
                  <p className="font-mono font-bold text-brand-primary truncate">{formatCurrency(totalDevedor)}</p>
                </div>
                <Badge variant={clientEmprestimos.length > 0 ? "primary" : "neutral"} className="shrink-0">
                  {clientEmprestimos.length} Ativo(s)
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCliente ? "Editar Cliente" : "Novo Cliente"}
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingCliente ? "Salvar Alterações" : "Cadastrar Cliente"}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input
            label="Nome Completo"
            placeholder="Ex: João da Silva"
            value={formData.nome}
            onChange={e => setFormData({ ...formData, nome: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="CPF ou CNPJ"
              placeholder="000.000.000-00"
              value={formData.cpfCnpj}
              onChange={e => setFormData({ ...formData, cpfCnpj: e.target.value })}
              required
            />
            <Input
              label="Telefone"
              placeholder="(11) 99999-9999"
              value={formData.telefone}
              onChange={e => setFormData({ ...formData, telefone: e.target.value })}
              required
            />
          </div>
          <Input
            label="WhatsApp (Apenas números)"
            placeholder="11999999999"
            value={formData.whatsapp}
            onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
          />
          
          <div className="pt-4 border-t border-border-subtle">
            <p className="text-sm font-bold mb-3">Endereço</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <Input
                  label="Rua"
                  value={formData.endereco.rua}
                  onChange={e => setFormData({ ...formData, endereco: { ...formData.endereco, rua: e.target.value } })}
                />
              </div>
              <Input
                label="Nº"
                value={formData.endereco.numero}
                onChange={e => setFormData({ ...formData, endereco: { ...formData.endereco, numero: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Bairro"
                value={formData.endereco.bairro}
                onChange={e => setFormData({ ...formData, endereco: { ...formData.endereco, bairro: e.target.value } })}
              />
              <Input
                label="Cidade"
                value={formData.endereco.cidade}
                onChange={e => setFormData({ ...formData, endereco: { ...formData.endereco, cidade: e.target.value } })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Excluir Cliente"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Confirmar Exclusão</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3">
            <Trash2 className="text-danger shrink-0" size={24} />
            <div>
              <p className="text-sm font-bold text-danger uppercase">Atenção: Ação Irreversível</p>
              <p className="text-sm text-text-secondary mt-1">
                Você está prestes a excluir o cliente <strong>{clientToDelete?.nome}</strong>. 
                Esta ação removerá permanentemente o cliente e <strong>TODOS</strong> os seus empréstimos e histórico de pagamentos.
              </p>
            </div>
          </div>
          <p className="text-sm text-text-secondary px-1">
            Deseja realmente prosseguir com a exclusão?
          </p>
        </div>
      </Modal>
    </div>
  );
}
