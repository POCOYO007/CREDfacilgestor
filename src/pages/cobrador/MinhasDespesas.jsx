import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Fuel, Utensils, Wrench, MoreHorizontal, Wallet } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useMeuCobrador } from '../../hooks/useMeuCobrador';
import { PageHeader, Card, Button, MoneyInput, Input, Badge, SectionTitle, Empty, cn } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { hojeISO, num, parseData } from '../../domain/emprestimo';

const TIPOS = [
  { id: 'combustivel', icon: Fuel, label: 'Gasolina' },
  { id: 'alimentacao', icon: Utensils, label: 'Refeição' },
  { id: 'mecanica', icon: Wrench, label: 'Mecânica' },
  { id: 'outro', icon: MoreHorizontal, label: 'Outros' },
];

export default function MinhasDespesas() {
  const adicionarDespesa = useAppStore((s) => s.adicionarDespesa);
  const { cobradorId, despesas } = useMeuCobrador();
  const [f, setF] = useState({ tipo: 'combustivel', valor: '', descricao: '', data: hojeISO() });
  const [salvando, setSalvando] = useState(false);

  const lista = [...despesas].sort((a, b) => (parseData(b.data) || 0) - (parseData(a.data) || 0));

  const salvar = async (e) => {
    e.preventDefault();
    if (!(num(f.valor) > 0)) { toast.error('Informe o valor.'); return; }
    setSalvando(true);
    try {
      await adicionarDespesa({
        tipo: f.tipo,
        valor: num(f.valor),
        descricao: f.descricao.trim() || TIPOS.find((t) => t.id === f.tipo)?.label || 'Despesa',
        data: f.data,
        cobradorId,
        aprovada: null,
      });
      toast.success('Despesa lançada! O gestor vai conferir.');
      setF({ tipo: f.tipo, valor: '', descricao: '', data: hojeISO() });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <PageHeader title="Despesas" subtitle="Lance o que gastou na rota" />
      <Card className="p-4">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {TIPOS.map((t) => (
              <button key={t.id} type="button" onClick={() => setF({ ...f, tipo: t.id })}
                className={cn('flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-[12px] font-semibold transition-colors',
                  f.tipo === t.id ? 'border-brand-primary bg-brand-primary/8 text-text-primary' : 'border-transparent bg-brand-surface-2 text-text-secondary')}>
                <t.icon className="w-5 h-5" />{t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Valor" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputClassName="text-lg font-bold" />
            <Input label="Data" type="date" max={hojeISO()} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
          </div>
          <Input label="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: pneu da moto" maxLength={200} />
          <Button type="submit" size="lg" block loading={salvando}>Lançar despesa</Button>
        </form>
      </Card>

      <SectionTitle>Minhas despesas</SectionTitle>
      {lista.length === 0 ? (
        <Card><Empty icon={<Wallet className="w-6 h-6" />} title="Nenhuma despesa lançada" /></Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {lista.slice(0, 50).map((d) => {
            const T = TIPOS.find((t) => t.id === d.tipo) || TIPOS[3];
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary shrink-0"><T.icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{d.descricao}</p>
                  <p className="text-[12px] text-text-secondary">{formatDate(d.data)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{formatCurrency(d.valor)}</p>
                  <Badge variant={d.aprovada === true ? 'success' : d.aprovada === false ? 'danger' : 'neutral'}>
                    {d.aprovada === true ? 'Aprovada' : d.aprovada === false ? 'Rejeitada' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
