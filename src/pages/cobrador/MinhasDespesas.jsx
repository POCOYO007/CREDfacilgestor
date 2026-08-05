import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Card, Button, Input, Badge, cn } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Fuel, Utensils, MoreHorizontal, Plus, Loader2, ArrowLeft, History, AlertCircle, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function MinhasDespesas() {
  const { usuarioAtual, despesas, adicionarDespesa } = useAppStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    tipo: 'combustivel',
    valor: '',
    descricao: '',
    data: new Date().toISOString().split('T')[0]
  });

  const cid = usuarioAtual.cobradorId || usuarioAtual.id;

  const minhasDespesas = despesas.filter(d => d.cobradorId === cid).sort((a, b) => new Date(b.data) - new Date(a.data));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    await new Promise(r => setTimeout(r, 500));
    
    adicionarDespesa({
      ...formData,
      valor: parseFloat(formData.valor),
      cobradorId: cid,
      aprovada: null // pendente
    });

    toast.success('Despesa lançada!');
    setFormData({ tipo: 'combustivel', valor: '', descricao: '', data: new Date().toISOString().split('T')[0] });
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <div className="flex justify-between items-center px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tight">Custo Operacional</h2>
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Lançamento de Despesas</p>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/cobrador')}
          className="w-10 h-10 rounded-xl bg-brand-surface border border-border-subtle flex items-center justify-center text-text-muted shadow-xs"
        >
          <ArrowLeft size={20} />
        </motion.button>
      </div>

      <Card className="p-5 border-border-subtle shadow-lg shadow-black/5">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <Plus size={18} />
          </div>
          <h3 className="font-black text-sm uppercase tracking-widest text-text-primary">Novo Lançamento</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Tipo de Despesa</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'combustivel', icon: Fuel, label: 'Gasolina', color: 'bg-orange-500' },
                { id: 'alimentacao', icon: Utensils, label: 'Refeição', color: 'bg-emerald-500' },
                { id: 'mecanica', icon: Wrench, label: 'Mecânica', color: 'bg-blue-500' },
                { id: 'outro', icon: MoreHorizontal, label: 'Outros', color: 'bg-purple-500' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: t.id })}
                  className={cn(
                    "flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all relative overflow-hidden",
                    formData.tipo === t.id 
                      ? "bg-brand-primary/5 border-brand-primary shadow-sm" 
                      : "bg-brand-surface-2/50 border-border-subtle opacity-60"
                  )}
                >
                  {formData.tipo === t.id && (
                    <motion.div 
                      layoutId="tab-indicator"
                      className="absolute inset-0 bg-brand-primary/5 -z-10"
                    />
                  )}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm",
                    t.color
                  )}>
                    <t.icon size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Valor Pago (R$)"
              type="number"
              placeholder="0.00"
              inputClassName="text-lg font-black font-mono py-4"
              value={formData.valor}
              onChange={e => setFormData({ ...formData, valor: e.target.value })}
              required
            />
            <Input
              label="Data Gasto"
              type="date"
              inputClassName="font-bold py-4 h-[58px]"
              value={formData.data}
              onChange={e => setFormData({ ...formData, data: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Detalhes Adicionais</label>
            <textarea
              className="input-field min-h-[80px] py-4 text-sm font-bold placeholder:font-normal"
              placeholder="Ex: Borracharia pneu moto..."
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              required
            />
          </div>

          <Button type="submit" className="w-full h-14 rounded-2xl gap-3 font-black text-base shadow-xl shadow-brand-primary/20" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus size={20} />}
            CONFIRMAR LANÇAMENTO
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-sm uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-text-muted rounded-full" />
            Histórico Recente
          </h3>
          <History size={16} className="text-text-muted opacity-50" />
        </div>
        
        <div className="space-y-2">
          <AnimatePresence>
            {minhasDespesas.map((d, idx) => (
              <motion.div 
                key={d.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 bg-brand-surface border border-border-subtle rounded-2xl flex justify-between items-center active:scale-[0.98] transition-transform shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0",
                    d.tipo === 'combustivel' ? "bg-orange-500" : d.tipo === 'alimentacao' ? "bg-emerald-500" : d.tipo === 'mecanica' ? "bg-blue-500" : "bg-purple-500"
                  )}>
                    {d.tipo === 'combustivel' ? <Fuel size={24} /> : d.tipo === 'alimentacao' ? <Utensils size={24} /> : d.tipo === 'mecanica' ? <Wrench size={24} /> : <MoreHorizontal size={24} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black font-mono tracking-tighter">{formatCurrency(d.valor)}</p>
                    <p className="text-[10px] text-text-muted font-bold truncate uppercase tracking-tighter flex items-center gap-1.5 mt-0.5">
                      <span className="shrink-0">{formatDate(d.data)}</span>
                      <span className="w-1 h-1 rounded-full bg-text-muted/30 shrink-0" />
                      <span className="truncate">{d.descricao}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                   <Badge className={cn(
                     "text-[8px] font-black px-1.5 py-0.5 border-none",
                     d.aprovada === true ? "bg-success/20 text-success" : d.aprovada === false ? "bg-danger/20 text-danger" : "bg-brand-surface-2 text-text-muted"
                   )}>
                    {d.aprovada === true ? "CONFERIDO" : d.aprovada === false ? "REJEITADO" : "PENDENTE"}
                  </Badge>
                  {d.aprovada === false && (
                    <div className="p-1 rounded-full bg-danger/10 text-danger">
                      <AlertCircle size={10} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {minhasDespesas.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-text-muted opacity-30 bg-brand-surface/30 rounded-3xl border border-dashed border-border-subtle">
              <History size={40} className="mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest italic">Nada lançado recentemente</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
