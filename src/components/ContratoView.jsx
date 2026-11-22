import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageCircle, Pencil, FileDown, Trash2, Undo2, Receipt, MoreHorizontal, Phone, MapPin } from 'lucide-react';
import { PageHeader, Card, Badge, Button, Row, SectionTitle, Modal, Empty, IconButton, cn } from './ui';
import PagamentoSheet from './PagamentoSheet';
import EditarContratoSheet from './EditarContratoSheet';
import { statusVisual } from '../hooks/useCarteira';
import { descricaoContrato, linkWhatsCobranca, linkMapa } from './ContratoCard';
import { useAppStore } from '../store/useAppStore';
import { ehParcelado, descreverMulta, juroPorPeriodo, num, int, parseData } from '../domain/emprestimo';
import { composicaoDoRecebimento, TIPOS_PAGAMENTO } from '../domain/pagamento';
import { formatCurrency, formatDate } from '../utils/formatters';

const ROTULO = { multa: 'multa', juros: 'juros', capital: 'capital', parcela: 'parcela' };

export default function ContratoView({ contrato: c, modo = 'admin', cobradorId }) {
  const navigate = useNavigate();
  const recebimentos = useAppStore((s) => s.recebimentos);
  const config = useAppStore((s) => s.config);
  const removerRecebimento = useAppStore((s) => s.removerRecebimento);
  const removerEmprestimo = useAppStore((s) => s.removerEmprestimo);
  const admin = modo === 'admin';

  const [pagando, setPagando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [excluirRec, setExcluirRec] = useState(null);
  const [excluirContrato, setExcluirContrato] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const historico = useMemo(() => recebimentos
    .filter((r) => r.emprestimoId === c.id)
    .sort((a, b) => (parseData(b.dataRecebimento) || 0) - (parseData(a.dataRecebimento) || 0)), [recebimentos, c.id]);

  const st = statusVisual(c);
  const parcelado = ehParcelado(c);
  const pago = c.status === 'pago';
  const whats = linkWhatsCobranca(c, config);
  const mapa = linkMapa(c.cliente);

  const pdf = async (fn, ...args) => {
    const mod = await import('../services/pdfService');
    mod[fn](...args);
  };

  const confirmarExclusaoRec = async () => {
    setOcupado(true);
    try {
      const r = await removerRecebimento(excluirRec);
      toast.success(r === 'restaurado' ? 'Pagamento desfeito e contrato voltou como estava.' : 'Recebimento excluído. Confira o contrato e ajuste em "Editar" se precisar.');
      setExcluirRec(null);
    } catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };

  const confirmarExclusaoContrato = async () => {
    setOcupado(true);
    try {
      await removerEmprestimo(c.id);
      toast.success('Contrato excluído.');
      navigate(-1);
    } catch (e) { toast.error(e.message); setOcupado(false); }
  };

  return (
    <div>
      <PageHeader
        back
        title={c.cliente?.nome || 'Contrato'}
        subtitle={`${descricaoContrato(c)} · #${c.id.slice(0, 6).toUpperCase()}`}
        actions={admin && (
          <div className="relative">
            <IconButton label="Mais opções" onClick={() => setMenu((v) => !v)}><MoreHorizontal className="w-5 h-5" /></IconButton>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-11 z-20 w-60 surface-card shadow-xl p-1.5">
                  <MenuItem icon={FileDown} onClick={() => { setMenu(false); pdf('gerarContratoPDF', c, c.cliente, config); }}>Contrato em PDF</MenuItem>
                  <MenuItem icon={Receipt} onClick={() => { setMenu(false); pdf('gerarExtratoPagamentos', c, c.cliente, historico, config); }}>Extrato em PDF</MenuItem>
                  {c.cliente && <MenuItem icon={Receipt} onClick={() => navigate(`/app/clientes/${c.cliente.id}`)}>Ver cliente</MenuItem>}
                  <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); setExcluirContrato(true); }}>Excluir contrato</MenuItem>
                </div>
              </>
            )}
          </div>
        )}
      />

      {/* Destaque: quanto cobrar */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-text-secondary">{pago ? 'Contrato quitado' : 'Devido hoje'}</span>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        {!pago && (
          <>
            <p className={cn('text-4xl font-extrabold tabular-nums mt-1', c.status === 'atrasado' && 'text-danger')}>{formatCurrency(c.devido.total)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[13px] text-text-secondary">
              {c.devido.multa > 0 && <span>Multa <b className="text-danger">{formatCurrency(c.devido.multa)}</b></span>}
              {c.devido.acrescimo > 0 && <span>Restante anterior <b>{formatCurrency(c.devido.acrescimo)}</b></span>}
              {parcelado
                ? <span>{c.devido.qtdParcelas > 1 ? `${c.devido.qtdParcelas} parcelas` : 'Parcela'} <b>{formatCurrency(c.devido.parcelas)}</b></span>
                : <span>Juros <b>{formatCurrency(c.devido.juros)}</b></span>}
              <span>Venc. <b>{formatDate(c.dataVencimento)}</b></span>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="lg" variant="success" className="flex-1" onClick={() => setPagando(true)}>Receber</Button>
              <a aria-label="Cobrar no WhatsApp" href={whats || undefined} target="_blank" rel="noreferrer"
                className={cn('w-14 h-14 rounded-xl bg-brand-surface-2 flex items-center justify-center text-success', !whats && 'opacity-40 pointer-events-none')}>
                <MessageCircle className="w-6 h-6" />
              </a>
              {admin ? (
                <button aria-label="Editar contrato" onClick={() => setEditando(true)} className="w-14 h-14 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary">
                  <Pencil className="w-5 h-5" />
                </button>
              ) : (
                <>
                  <a aria-label="Ligar" href={c.cliente?.telefone ? `tel:${c.cliente.telefone.replace(/\D/g, '')}` : undefined} className="w-14 h-14 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary"><Phone className="w-5 h-5" /></a>
                  <a aria-label="Mapa" href={mapa || undefined} target="_blank" rel="noreferrer" className={cn('w-14 h-14 rounded-xl bg-brand-surface-2 flex items-center justify-center text-text-secondary', !mapa && 'opacity-40 pointer-events-none')}><MapPin className="w-5 h-5" /></a>
                </>
              )}
            </div>
          </>
        )}
        {pago && admin && (
          <Button variant="outline" className="mt-3" onClick={() => setEditando(true)}><Pencil className="w-4 h-4" /> Editar contrato</Button>
        )}
      </Card>

      <SectionTitle>Contrato</SectionTitle>
      <Card className="px-4 py-2">
        <Row label="Saldo devedor" value={formatCurrency(c.saldo)} strong />
        {!pago && <Row label="Para quitar hoje" value={formatCurrency(c.quitacao)} />}
        <Row label="Valor emprestado" value={formatCurrency(c.valorPrincipalInicial || (parcelado ? 0 : c.valorPrincipal))} />
        {parcelado ? (
          <>
            <Row label="Parcelas" value={`${int(c.parcelasPagas)} de ${int(c.totalParcelas)} pagas`} />
            <Row label="Valor da parcela" value={formatCurrency(c.valorParcela)} />
            {num(c.pagoParcelaAtual) > 0 && <Row label="Já pago da parcela atual" value={formatCurrency(c.pagoParcelaAtual)} />}
          </>
        ) : (
          <>
            <Row label="Taxa" value={`${c.taxaJuros || 0}% por período`} />
            <Row label="Juro do período" value={formatCurrency(juroPorPeriodo(c))} />
            {num(c.abatimentoJuros) > 0 && <Row label="Já pago do juro atual" value={formatCurrency(c.abatimentoJuros)} />}
          </>
        )}
        {num(c.acrescimoProximo) > 0 && <Row label="Restante jogado p/ próxima" value={formatCurrency(c.acrescimoProximo)} tone="warning" />}
        <Row label="Multa" value={descreverMulta(c)} />
        <Row label="Carência" value={`${int(c.carenciaDias)} dia(s)`} />
        <Row label="Cobrador" value={c.cobrador?.nome || 'Gestor'} />
        <Row label="Início" value={formatDate(c.dataInicio || c.criadoEm)} />
      </Card>

      <SectionTitle>Recebimentos ({historico.length})</SectionTitle>
      {historico.length === 0 ? (
        <Card><Empty icon={<Receipt className="w-6 h-6" />} title="Nenhum pagamento ainda" /></Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {historico.map((r) => {
            const comp = composicaoDoRecebimento(r);
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold tabular-nums">{formatCurrency(r.valor)} <span className="text-[12px] font-semibold text-text-muted">· {TIPOS_PAGAMENTO[r.tipo] || r.tipo}</span></p>
                  <p className="text-[12px] text-text-secondary truncate">
                    {formatDate(r.dataRecebimento)}
                    {' · '}
                    {Object.entries(comp).map(([k, v]) => `${ROTULO[k] || k} ${formatCurrency(v)}`).join(' + ')}
                    {r.opcaoParcial === 'proxima' ? ' · restante p/ próxima' : ''}
                  </p>
                </div>
                <IconButton label="Comprovante" onClick={() => pdf('gerarComprovante', r, c, c.cliente, c.cobrador, config)}><FileDown className="w-[18px] h-[18px]" /></IconButton>
                {admin && (
                  <IconButton label="Excluir / desfazer" onClick={() => setExcluirRec(r)} className="text-danger hover:bg-danger/10 hover:text-danger">
                    {c.ultimoRecebimentoId === r.id && r.estadoAnterior ? <Undo2 className="w-[18px] h-[18px]" /> : <Trash2 className="w-[18px] h-[18px]" />}
                  </IconButton>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <PagamentoSheet
        isOpen={pagando}
        onClose={() => setPagando(false)}
        contrato={c}
        cobradorId={admin ? (c.cobrador?.id || c.cobradorId || '') : cobradorId}
        ehCobrador={!admin}
      />
      {admin && <EditarContratoSheet isOpen={editando} onClose={() => setEditando(false)} contrato={c} />}

      <Modal
        isOpen={!!excluirRec}
        onClose={() => setExcluirRec(null)}
        title={excluirRec && c.ultimoRecebimentoId === excluirRec.id && excluirRec.estadoAnterior ? 'Desfazer pagamento?' : 'Excluir recebimento?'}
        footer={(
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setExcluirRec(null)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" loading={ocupado} onClick={confirmarExclusaoRec}>Confirmar</Button>
          </>
        )}
      >
        {excluirRec && (c.ultimoRecebimentoId === excluirRec.id && excluirRec.estadoAnterior ? (
          <p className="text-sm text-text-secondary">O recebimento de <b>{formatCurrency(excluirRec.valor)}</b> será apagado e o contrato volta exatamente como estava antes dele.</p>
        ) : (
          <p className="text-sm text-text-secondary">
            O recebimento de <b>{formatCurrency(excluirRec.valor)}</b> será apagado, mas o saldo do contrato <b>não</b> muda automaticamente
            (só o último pagamento pode ser desfeito). Depois ajuste o contrato em <b>Editar</b>.
          </p>
        ))}
      </Modal>

      <Modal
        isOpen={excluirContrato}
        onClose={() => setExcluirContrato(false)}
        title="Excluir contrato?"
        footer={(
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setExcluirContrato(false)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" loading={ocupado} onClick={confirmarExclusaoContrato}>Excluir</Button>
          </>
        )}
      >
        <p className="text-sm text-text-secondary">O contrato e os {historico.length} recebimento(s) dele serão apagados para sempre.</p>
      </Modal>
    </div>
  );
}

function MenuItem({ icon: Icon, children, danger, onClick }) {
  return (
    <button onClick={onClick} className={cn('w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold hover:bg-brand-surface-2 text-left', danger && 'text-danger hover:bg-danger/10')}>
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}
