import React, { useState } from 'react';
import { Card, Badge, Button, Modal, Input } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import { Building2, ShieldCheck, LogOut, Sun, Moon, Edit2, Plus, Receipt } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

export default function MasterDashboard() {
  const logout = useAppStore(state => state.logout);
  const tema = useAppStore(state => state.tema);
  const toggleTema = useAppStore(state => state.toggleTema);
  const globalTenants = useAppStore(state => state.globalTenants);
  const editarTenant = useAppStore(state => state.editarTenant);
  const adicionarTenant = useAppStore(state => state.adicionarTenant);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    adminEmail: '',
    plano: 'Básico',
    status: 'ativo',
    vencimento: ''
  });

  const openModal = (tenant = null) => {
    if (tenant) {
      setSelectedTenant(tenant);
      setFormData({
        id: tenant.id,
        nome: tenant.nome,
        adminEmail: tenant.adminEmail || '',
        plano: tenant.plano,
        status: tenant.status,
        vencimento: tenant.vencimento
      });
    } else {
      setSelectedTenant(null);
      setFormData({
        id: '',
        nome: '',
        adminEmail: '',
        plano: 'Básico',
        status: 'ativo',
        vencimento: new Date().toISOString().split('T')[0]
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.vencimento || (!selectedTenant && !formData.id)) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      if (selectedTenant) {
        await editarTenant(selectedTenant.id, formData);
        toast.success('Assinatura atualizada com sucesso');
      } else {
        await adicionarTenant(formData.id, formData);
        toast.success('Tenant criado com sucesso');
      }
      setModalOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar dados');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: globalTenants.length,
    ativos: globalTenants.filter(t => t.status === 'ativo').length,
    volume: globalTenants.reduce((acc, t) => acc + (t.volume || 0), 0),
    novos: globalTenants.filter(t => {
      const created = new Date(t.criadoEm);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length
  };

  return (
    <div className="min-h-screen bg-brand-secondary">
      <header className="h-16 glass border-b border-border-subtle flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-brand-primary w-8 h-8" />
          <span className="font-bold text-xl tracking-tight">Master Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTema} className="p-2 text-text-secondary hover:text-text-primary transition-colors">
            {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={logout} className="flex items-center gap-2 text-danger hover:bg-danger/10 px-3 py-1.5 rounded-lg transition-all">
            <LogOut size={18} />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </header>

      <div className="p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Dashboard Global</h1>
            <p className="text-text-secondary">Gestão global da plataforma SaaS.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" icon={<Receipt size={18} />}>Faturas</Button>
            <Button onClick={() => openModal()} icon={<Plus size={18} />}>Novo Tenant</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Total Tenants</p>
            <h3 className="text-3xl font-bold">{stats.total}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Ativos</p>
            <h3 className="text-3xl font-bold text-success">{stats.ativos}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Volume Global</p>
            <h3 className="text-3xl font-bold text-brand-primary">{formatCurrency(stats.volume)}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Novos (Mês)</p>
            <h3 className="text-3xl font-bold text-brand-accent">+{stats.novos}</h3>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden border border-border-subtle shadow-sm">
          <div className="px-8 py-6 border-b border-border-subtle bg-brand-surface-1">
            <h2 className="text-xl font-bold">Empresas e Assinaturas</h2>
            <p className="text-sm text-text-muted">Gerencie planos e períodos de acesso.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-brand-surface-2 text-text-muted text-xs uppercase font-bold">
                  <th className="px-8 py-4">Empresa</th>
                  <th className="px-8 py-4">Plano</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Vencimento</th>
                  <th className="px-8 py-4">Volume</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {globalTenants.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-12 text-center text-text-muted">
                      Nenhum tenant cadastrado.
                    </td>
                  </tr>
                ) : (
                  globalTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-brand-surface-2 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <p className="font-bold leading-none mb-1">{tenant.nome}</p>
                            <p className="text-[10px] text-text-muted font-mono">{tenant.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <Badge variant="primary">{tenant.plano}</Badge>
                      </td>
                      <td className="px-8 py-4">
                        <Badge variant={tenant.status === 'ativo' ? 'success' : 'danger'}>
                          {tenant.status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-8 py-4 text-sm text-text-secondary whitespace-nowrap">
                        {tenant.vencimento ? new Date(tenant.vencimento).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-8 py-4 font-mono font-bold text-sm">
                        {formatCurrency(tenant.volume || 0)}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => openModal(tenant)}
                            title="Editar Assinatura"
                          >
                            <Edit2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTenant ? "Editar Assinatura" : "Novo Tenant"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!selectedTenant && (
            <Input 
              label="Slug do Tenant (ID Único)" 
              value={formData.id} 
              onChange={e => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              placeholder="ex: credfacil-matriz"
            />
          )}

          <Input 
            label="Nome da Empresa" 
            value={formData.nome} 
            onChange={e => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Meu Jurista Online"
          />

          <Input 
            label="Email do Administrador" 
            value={formData.adminEmail} 
            onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
            placeholder="email@admin.com"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Plano</label>
              <select 
                className="input-field"
                value={formData.plano}
                onChange={e => setFormData({ ...formData, plano: e.target.value })}
              >
                <option value="Básico">Básico</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Status</label>
              <select 
                className="input-field"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="congelado">Congelado</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </div>
          </div>

          <Input 
            label="Data de Vencimento" 
            type="date"
            value={formData.vencimento}
            onChange={e => setFormData({ ...formData, vencimento: e.target.value })}
          />
          
          {selectedTenant && (
            <div className="p-4 bg-brand-surface-2 rounded-xl border border-border-subtle">
              <p className="text-xs text-text-muted font-bold uppercase mb-1">Informações Adicionais</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
                <p>Clientes: <span className="text-text-primary font-bold">{(selectedTenant.clientes || 0)}</span></p>
                <p>Empréstimos: <span className="text-text-primary font-bold">{(selectedTenant.emprestimos || 0)}</span></p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
