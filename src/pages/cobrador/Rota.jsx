import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route as RouteIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useMeuCobrador } from '../../hooks/useMeuCobrador';
import { ordemDeCobranca } from '../../hooks/useCarteira';
import { mesmoDia, num, round2 } from '../../domain/emprestimo';
import { SearchInput, Chips, Card, Empty } from '../../components/ui';
import ContratoCard from '../../components/ContratoCard';
import PagamentoSheet from '../../components/PagamentoSheet';
import { formatCurrency } from '../../utils/formatters';

const FILTROS = {
  cobrar: (c) => c.status === 'atrasado' || c.venceHoje,
  atrasados: (c) => c.status === 'atrasado',
  hoje: (c) => c.venceHoje && c.status !== 'atrasado',
  proximos: (c) => c.status === 'ativo' && !c.venceHoje,
};

export default function Rota() {
  const config = useAppStore((s) => s.config);
  const carregado = useAppStore((s) => s.carregado.emprestimos);
  const { eu, cobradorId, contratos, recebimentos } = useMeuCobrador();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('cobrar');
  const [pagando, setPagando] = useState(null);

  const abertos = useMemo(() => contratos.filter((c) => c.status !== 'pago'), [contratos]);
  const buscados = useMemo(() => {
    if (!busca) return abertos;
    const t = busca.toLowerCase();
    return abertos.filter((c) => c.cliente?.nome?.toLowerCase().includes(t)
      || c.cliente?.endereco?.bairro?.toLowerCase().includes(t)
      || c.cliente?.endereco?.rua?.toLowerCase().includes(t));
  }, [abertos, busca]);
  const lista = useMemo(() => buscados.filter(FILTROS[filtro]).sort(ordemDeCobranca), [buscados, filtro]);

  const recebidoHoje = round2(recebimentos.filter((r) => mesmoDia(r.dataRecebimento || r.criadoEm, new Date())).reduce((s, r) => s + num(r.valor), 0));
  const aCobrar = round2(abertos.filter(FILTROS.cobrar).reduce((s, c) => s + c.devido.total, 0));
  const n = (f) => buscados.filter(FILTROS[f]).length;
  const contratoAberto = pagando ? contratos.find((c) => c.id === pagando) : null;

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-semibold text-text-muted">Olá, {eu.nome?.split(' ')[0]}</p>
        <h1 className="text-[26px] font-extrabold tracking-tight leading-tight">Rota de hoje</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link to="/cobrador/dia" className="surface-card p-3.5 bg-text-primary text-brand-surface border-transparent">
          <p className="text-[12px] font-semibold opacity-70">Recebi hoje</p>
          <p className="text-xl font-extrabold tabular-nums mt-0.5">{formatCurrency(recebidoHoje)}</p>
        </Link>
        <div className="surface-card p-3.5">
          <p className="text-[12px] font-semibold text-text-muted">Falta cobrar</p>
          <p className="text-xl font-extrabold tabular-nums mt-0.5 text-danger">{formatCurrency(aCobrar)}</p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Cliente, rua ou bairro" />
        <Chips value={filtro} onChange={setFiltro} options={[
          { value: 'cobrar', label: 'A cobrar', count: n('cobrar'), alert: true },
          { value: 'atrasados', label: 'Atrasados', count: n('atrasados'), alert: true },
          { value: 'hoje', label: 'Vencem hoje', count: n('hoje') },
          { value: 'proximos', label: 'Próximos', count: n('proximos') },
        ]} />
      </div>

      {lista.length === 0 ? (
        <Card>
          <Empty
            icon={<RouteIcon className="w-6 h-6" />}
            title={!carregado ? 'Carregando…' : filtro === 'cobrar' ? 'Rota limpa! 🎉' : 'Nada aqui'}
            text={carregado && filtro === 'cobrar' ? 'Nenhum cliente atrasado ou vencendo hoje.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {lista.map((c) => (
            <ContratoCard key={c.id} contrato={c} to={`/cobrador/contrato/${c.id}`} config={config} onReceber={(x) => setPagando(x.id)} />
          ))}
        </div>
      )}

      <PagamentoSheet isOpen={!!contratoAberto} onClose={() => setPagando(null)} contrato={contratoAberto} cobradorId={cobradorId} ehCobrador />
    </div>
  );
}
