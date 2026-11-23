import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Phone, MapPin, ChevronRight } from 'lucide-react';
import { Badge, Button, cn } from './ui';
import { statusVisual } from '../hooks/useCarteira';
import { ehParcelado, int } from '../domain/emprestimo';
import { formatCurrency, formatDate, buildWhatsAppUrl, substituirVariaveis } from '../utils/formatters';

export const mensagemCobranca = (contrato, config) => substituirVariaveis(config?.templateCobranca, {
  cliente: contrato.cliente?.nome,
  valor: contrato.devido.total,
  dataVencimento: contrato.dataVencimento,
});

export const linkWhatsCobranca = (contrato, config) =>
  buildWhatsAppUrl(contrato.cliente?.whatsapp || contrato.cliente?.telefone, mensagemCobranca(contrato, config));

export const linkMapa = (cliente) => {
  const e = cliente?.endereco || {};
  const q = [e.rua, e.numero, e.bairro, e.cidade].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
};

export const descricaoContrato = (c) => {
  if (c.modalidade === 'aluguel') {
    const prazo = int(c.totalParcelas) > 0 ? ` · ${int(c.parcelasPagas)}/${int(c.totalParcelas)}` : '';
    return `Aluguel${c.itemDescricao ? `: ${c.itemDescricao}` : ''}${prazo}`;
  }
  return ehParcelado(c) ? `Parcelado ${int(c.parcelasPagas)}/${int(c.totalParcelas)}` : `Juros ${c.taxaJuros || 0}%`;
};

/**
 * Cartão de contrato para listas.
 * - `to`: link para o detalhe
 * - `onReceber`: mostra a barra de ações do cobrador (Receber / WhatsApp / Ligar / Mapa)
 */
export default function ContratoCard({ contrato: c, to, onReceber, config, mostrarCobrador }) {
  const st = statusVisual(c);
  const pago = c.status === 'pago';
  const whats = onReceber ? linkWhatsCobranca(c, config) : null;
  const mapa = onReceber ? linkMapa(c.cliente) : null;

  const corpo = (
    <div className="flex items-start gap-3">
      <div className={cn(
        'w-1 self-stretch rounded-full shrink-0',
        pago ? 'bg-success' : c.status === 'atrasado' ? 'bg-danger' : c.venceHoje ? 'bg-warning' : 'bg-border-strong',
      )} />
      <div className="flex-1 min-w-0">
        <p className="font-bold leading-snug break-words">{c.cliente?.nome || 'Cliente removido'}</p>
        <Badge variant={st.variant} className="mt-1">{st.label}</Badge>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('font-extrabold tabular-nums', c.status === 'atrasado' && 'text-danger')}>
          {formatCurrency(pago ? (c.modalidade === 'aluguel' ? c.valorParcela : c.valorPrincipalInicial) || 0 : c.devido.total)}
        </p>
        <p className="text-[12px] text-text-muted mt-0.5">{pago ? (c.modalidade === 'aluguel' ? 'encerrado' : 'quitado') : `vence ${formatDate(c.dataVencimento).slice(0, 5)}`}</p>
      </div>
      {to && !onReceber && <ChevronRight className="w-4 h-4 text-text-muted self-center -mr-1" />}
    </div>
  );

  return (
    <div className="surface-card overflow-hidden">
      {to ? <Link to={to} className="block p-3.5 active:bg-brand-surface-2">{corpo}</Link> : <div className="p-3.5">{corpo}</div>}
      {onReceber && !pago && (
        <div className="flex items-center gap-2 px-3.5 pb-3.5">
          <Button variant="success" className="flex-1" onClick={() => onReceber(c)}>Receber</Button>
          <a aria-label="WhatsApp" href={whats || undefined} target="_blank" rel="noreferrer"
            className={cn('w-11 h-11 rounded-xl bg-brand-surface-2 flex items-center justify-center text-success', !whats && 'opacity-40 pointer-events-none')}>
            <MessageCircle className="w-5 h-5" />
          </a>
          <a aria-label="Ligar" href={c.cliente?.telefone ? `tel:${c.cliente.telefone.replace(/\D/g, '')}` : undefined}
            className={cn('w-11 h-11 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary', !c.cliente?.telefone && 'opacity-40 pointer-events-none')}>
            <Phone className="w-5 h-5" />
          </a>
          <a aria-label="Mapa" href={mapa || undefined} target="_blank" rel="noreferrer"
            className={cn('w-11 h-11 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary', !mapa && 'opacity-40 pointer-events-none')}>
            <MapPin className="w-5 h-5" />
          </a>
        </div>
      )}
    </div>
  );
}
