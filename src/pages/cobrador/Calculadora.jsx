import React, { useState } from 'react';
import { Card, Input, Button, Badge } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import { Calculator, Percent, Calendar, DollarSign, ArrowRight } from 'lucide-react';

export default function Calculadora() {
  const [valor, setValor] = useState('');
  const [taxa, setTaxa] = useState('20');
  const [parcelas, setParcelas] = useState('24');
  const [resultado, setResultado] = useState(null);

  const calcular = (e) => {
    e.preventDefault();
    const v = parseFloat(valor);
    const t = parseFloat(taxa) / 100;
    const p = parseInt(parcelas);

    if (isNaN(v) || isNaN(t) || isNaN(p)) return;

    const totalJuros = v * t;
    const totalPagar = v + totalJuros;
    const valorParcela = totalPagar / p;

    setResultado({
      totalPagar,
      totalJuros,
      valorParcela,
      parcelas: p
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="text-brand-primary" />
          Simulador de Empréstimo
        </h2>
        <p className="text-text-secondary text-sm">Calcule rapidamente valores para o cliente.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={calcular} className="space-y-4">
          <Input 
            label="Valor do Empréstimo" 
            type="number" 
            placeholder="Ex: 1000"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
            icon={<DollarSign size={16} />}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Taxa de Juros (%)" 
              type="number" 
              value={taxa}
              onChange={(e) => setTaxa(e.target.value)}
              required
              icon={<Percent size={16} />}
            />
            <Input 
              label="Nº de Parcelas" 
              type="number" 
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              required
              icon={<Calendar size={16} />}
            />
          </div>

          <Button type="submit" className="w-full h-12 text-lg">
            Calcular Simulação
          </Button>
        </form>
      </Card>

      {resultado && (
        <Card className="p-6 bg-brand-primary/5 border-brand-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Badge variant="primary">Resultado</Badge>
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-text-primary/5 rounded-xl border border-text-primary/5">
              <span className="text-sm text-text-secondary">Valor da Parcela</span>
              <span className="text-2xl font-bold text-brand-primary font-mono">
                {formatCurrency(resultado.valorParcela)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-text-primary/5 rounded-xl border border-text-primary/5">
                <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Total a Pagar</p>
                <p className="font-bold font-mono">{formatCurrency(resultado.totalPagar)}</p>
              </div>
              <div className="p-3 bg-text-primary/5 rounded-xl border border-text-primary/5">
                <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Total Juros</p>
                <p className="font-bold font-mono text-success">{formatCurrency(resultado.totalJuros)}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border-subtle">
              <p className="text-xs text-text-muted text-center italic">
                * Simulação baseada em juros simples sobre o capital.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
