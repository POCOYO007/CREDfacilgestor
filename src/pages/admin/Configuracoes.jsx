import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button, Card, Input, cn } from '../../components/ui';
import { Settings, Building2, MessageSquare, ShieldCheck, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Configuracoes() {
  const { config, atualizarConfig } = useAppStore();
  const [formData, setFormData] = useState(config);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState('empresa');

  // Sincroniza formData com config do store quando config carregar do Firebase
  React.useEffect(() => {
    if (!isDirty) {
      setFormData(config);
    }
  }, [config, isDirty]);

  const handleSave = async () => {
    // Converter campos numéricos
    const finalData = {
      ...formData,
      taxaPadrao: parseFloat(formData.taxaPadrao) || 0,
      carenciaPadrao: parseInt(formData.carenciaPadrao) || 0,
      multaPercentualPadrao: parseFloat(formData.multaPercentualPadrao) || 0
    };
    
    try {
      await atualizarConfig(finalData);
      setIsDirty(false);
      toast.success('Configurações salvas!');
    } catch (e) {
      toast.error('Erro ao salvar as configurações');
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-text-secondary">Personalize o sistema e seus templates de comunicação.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar de Abas */}
        <aside className="lg:w-64 space-y-2">
          {[
            { id: 'empresa', label: 'Empresa', icon: Building2 },
            { id: 'templates', label: 'Templates WhatsApp', icon: MessageSquare },
            { id: 'padroes', label: 'Padrões do Sistema', icon: ShieldCheck },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                activeTab === tab.id ? "bg-brand-primary text-white shadow-lg" : "text-text-secondary hover:bg-brand-surface-2"
              )}
            >
              <tab.icon size={20} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Conteúdo da Aba */}
        <div className="flex-1 space-y-6">
          <Card className="p-8">
            {activeTab === 'empresa' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold mb-6">Dados da Empresa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Nome da Empresa"
                    value={formData.nomeEmpresa}
                    onChange={e => updateField('nomeEmpresa', e.target.value)}
                  />
                  <Input
                    label="Telefone de Contato"
                    value={formData.telefone}
                    onChange={e => updateField('telefone', e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <Input
                      label="Endereço Completo"
                      value={formData.endereco}
                      onChange={e => updateField('endereco', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="space-y-8">
                <h3 className="text-xl font-bold mb-6">Templates de WhatsApp</h3>
                <div className="space-y-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-secondary ml-1">Mensagem de Cobrança</label>
                    <textarea 
                      className="input-field min-h-[120px] resize-none"
                      value={formData.templateCobranca}
                      onChange={e => updateField('templateCobranca', e.target.value)}
                    />
                    <p className="text-[10px] text-text-muted mt-1">Variáveis: {'{CLIENTE}, {VALOR}, {DATA_VENCIMENTO}'}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-secondary ml-1">Mensagem de Recibo</label>
                    <textarea 
                      className="input-field min-h-[120px] resize-none"
                      value={formData.templateRecibo}
                      onChange={e => updateField('templateRecibo', e.target.value)}
                    />
                    <p className="text-[10px] text-text-muted mt-1">Variáveis: {'{CLIENTE}, {VALOR_PAGO}, {SALDO_RESTANTE}'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'padroes' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold mb-6">Padrões de Novos Contratos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Taxa de Juros Padrão (%)"
                    type="number"
                    value={formData.taxaPadrao}
                    onChange={e => updateField('taxaPadrao', e.target.value)}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-secondary ml-1">Frequência Padrão</label>
                    <select 
                      className="input-field"
                      value={formData.frequenciaPadrao}
                      onChange={e => updateField('frequenciaPadrao', e.target.value)}
                    >
                      <option value="diario">Diário</option>
                      <option value="semanal">Semanal</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  <Input
                    label="Carência Padrão (dias)"
                    type="number"
                    value={formData.carenciaPadrao}
                    onChange={e => updateField('carenciaPadrao', e.target.value)}
                  />
                  <Input
                    label="Multa Padrão (%)"
                    type="number"
                    step="0.1"
                    value={formData.multaPercentualPadrao ?? 2}
                    onChange={e => updateField('multaPercentualPadrao', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-border-subtle flex justify-end">
              <Button onClick={handleSave} className="gap-2 px-8">
                <Save size={20} />
                Salvar Alterações
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
