import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chips, Input } from './ui';
import { PERIODOS, intervaloDoPeriodo } from '../domain/conferencia';
import { hojeISO } from '../domain/emprestimo';
import { formatDate } from '../utils/formatters';

/**
 * Período escolhido (Hoje / 7 dias / 30 dias / Personalizado), guardado na URL
 * (?p=7d&de=...&ate=...) para que os links "Detalhar" levem o mesmo filtro.
 */
export function usePeriodo() {
  const [params, setParams] = useSearchParams();
  const periodo = PERIODOS.some((p) => p.value === params.get('p')) ? params.get('p') : 'hoje';
  const de = params.get('de') || hojeISO();
  const ate = params.get('ate') || hojeISO();

  const { inicio, fim } = useMemo(() => intervaloDoPeriodo(periodo, de, ate), [periodo, de, ate]);

  const atualizar = (mudancas) => {
    const novo = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([k, v]) => (v ? novo.set(k, v) : novo.delete(k)));
    if (novo.get('p') !== 'custom') { novo.delete('de'); novo.delete('ate'); }
    setParams(novo, { replace: true });
  };

  const rotulo = periodo === 'hoje' ? 'hoje'
    : periodo === '7d' ? 'nos últimos 7 dias'
      : periodo === '30d' ? 'nos últimos 30 dias'
        : `de ${formatDate(inicio)} a ${formatDate(fim)}`;

  const query = params.toString() ? `?${params.toString()}` : '';
  return { periodo, de, ate, inicio, fim, rotulo, atualizar, query, ehHoje: periodo === 'hoje' };
}

export default function PeriodoFiltro({ estado, className }) {
  const { periodo, de, ate, atualizar } = estado;
  return (
    <div className={className}>
      <Chips
        options={PERIODOS}
        value={periodo}
        onChange={(p) => atualizar(p === 'custom' ? { p, de: de || hojeISO(), ate: ate || hojeISO() } : { p: p === 'hoje' ? null : p })}
      />
      {periodo === 'custom' && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Input label="De" type="date" max={hojeISO()} value={de} onChange={(e) => e.target.value && atualizar({ p: 'custom', de: e.target.value, ate })} />
          <Input label="Até" type="date" max={hojeISO()} value={ate} onChange={(e) => e.target.value && atualizar({ p: 'custom', de, ate: e.target.value })} />
        </div>
      )}
    </div>
  );
}
