import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageCircle, Pencil, FileDown, Trash2, Undo2, Receipt, MoreHorizontal, Phone, MapPin, Lock, Unlock, PauseCircle, ScrollText } from 'lucide-react';
import { PageHeader, Card, Badge, Button, Row, SectionTitle, Modal, Empty, IconButton, Input, cn } from './ui';
import PagamentoSheet from './PagamentoSheet';
import EditarContratoSheet from './EditarContratoSheet';
import ExtratoSheet from './ExtratoSheet';
import { statusVisual } from '../hooks/useCarteira';
import { descricaoContrato, linkWhatsCobranca, linkMapa } from './ContratoCard';
import { useAppStore } from '../store/useAppStore';
import { ehParcelado, descreverMulta, juroPorPeriodo, num, int, parseData, aplicarCarencia, saldoAluguelEmAberto, multaDevida, diasDoPeriodo, devidoAgora } from '../domain/emprestimo';
import { composicaoDoRecebimento, TIPOS_PAGAMENTO } from '../domain/pagamento';
import { formatCurrency, formatDate } from '../utils/formatters';

const ROTULO = { multa: 'multa', juros: 'juros', capital: 'capital', parcela: 'parcela', aluguel: 'aluguel' };
const ROTULO_FREQ = { diario: 'por dia', semanal: 'por semana', quinzenal: 'por quinzena', mensal: 'por mês', dia_especifico: 'por mês' };
const ROTULO_ITEM = { carro: 'Carro', moto: 'Moto', casa: 'Casa / imóvel', outro: 'Item' };

export default function ContratoView({ contrato: c, modo = 'admin', cobradorId }) {
  const navigate = useNavigate();
  const recebimentos = useAppStore((s) => s.recebimentos);
  const config = useAppStore((s) => s.config);
  const removerRecebimento = useAppStore((s) => s.removerRecebimento);
  const removerEmprestimo = useAppStore((s) => s.removerEmprestimo);
  const editarEmprestimo = useAppStore((s) => s.editarEmprestimo);
  const admin = modo === 'admin';

  const [pagando, setPagando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [excluirRec, setExcluirRec] = useState(null);
  const [excluirContrato, setExcluirContrato] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [encerrar, setEncerrar] = useState(false);
  const [extrato, setExtrato] = useState(false);
  const [carencia, setCarencia] = useState(null); // { dias, motivo, perdoar }
  const darCarencia = useAppStore((s) => s.darCarencia);

  const historico = useMemo(() => recebimentos
    .filter((r) => r.emprestimoId === c.id)
    .sort((a, b) => (parseData(b.dataRecebimento) || 0) - (parseData(a.dataRecebimento) || 0)), [recebimentos, c.id]);

  const st = statusVisual(c);
  const parcelado = ehParcelado(c);
  const pago = c.status === 'pago';
  const aluguel = c.modalidade === 'aluguel';
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
                  {!aluguel && <MenuItem icon={FileDown} onClick={() => { setMenu(false); pdf('gerarContratoPDF', c, c.cliente, config); }}>Contrato em PDF</MenuItem>}
                  {aluguel && (
                    <MenuItem icon={c.encerrado ? Unlock : Lock} onClick={() => { setMenu(false); setEncerrar(true); }}>
                      {c.encerrado ? 'Reabrir aluguel' : 'Encerrar aluguel'}
                    </MenuItem>
                  )}
                  <MenuItem icon={ScrollText} onClick={() => { setMenu(false); setExtrato(true); }}>Extrato</MenuItem>
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
          <span className="text-sm font-semibold text-text-secondary">{pago ? (aluguel ? 'Aluguel encerrado' : 'Contrato quitado') : 'Devido hoje'}</span>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        {!pago && (
          <>
            <p className={cn('text-4xl font-extrabold tabular-nums mt-1', c.status === 'atrasado' && 'text-danger')}>{formatCurrency(c.devido.total)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[13px] text-text-secondary">
              {c.devido.multa > 0 && <span>Multa <b className="text-danger">{formatCurrency(c.devido.multa)}</b></span>}
              {c.devido.acrescimo > 0 && <span>Restante anterior <b>{formatCurrency(c.devido.acrescimo)}</b></span>}
              {parcelado
                ? <span>{c.devido.qtdParcelas > 1 ? `${c.devido.qtdParcelas} ${aluguel ? 'aluguéis' : 'parcelas'}` : (aluguel ? 'Aluguel' : 'Parcela')} <b>{formatCurrency(c.devido.parcelas)}</b></span>
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
        <div className="flex gap-2 mt-2">
          <Button variant="secondary" className="flex-1" onClick={() => setExtrato(true)}>
            <ScrollText className="w-4 h-4" /> Extrato
          </Button>
          {admin && !pago && !c.encerrado && (
            <Button variant="secondary" className="flex-1" onClick={() => setCarencia({ dias: String(aluguel ? diasDoPeriodo(c) : 7), motivo: '', perdoar: false })}>
              <PauseCircle className="w-4 h-4" /> Carência
            </Button>
          )}
        </div>
      </Card>

      <SectionTitle>Contrato</SectionTitle>
      <Card className="px-4 py-2">
        {aluguel ? (
          <>
            <Row label={ROTULO_ITEM[c.itemTipo] || 'Item'} value={c.itemDescricao || '—'} strong />
            <Row label="Aluguel" value={`${formatCurrency(c.valorParcela)} ${ROTULO_FREQ[c.frequencia] || ''}`} />
            <Row label="Em aberto (vencido)" value={formatCurrency(c.saldo)} tone={c.saldo > 0 ? 'danger' : 'default'} />
            <Row label="Períodos pagos" value={int(c.totalParcelas) > 0 ? `${int(c.parcelasPagas)} de ${int(c.totalParcelas)}` : `${int(c.parcelasPagas)} (sem prazo)`} />
            {num(c.pagoParcelaAtual) > 0 && <Row label="Já pago do aluguel atual" value={formatCurrency(c.pagoParcelaAtual)} />}
            {num(c.caucao) > 0 && <Row label="Caução" value={formatCurrency(c.caucao)} />}
          </>
        ) : (
          <>
            <Row label="Saldo devedor" value={formatCurrency(c.saldo)} strong />
            {!pago && <Row label="Para quitar hoje" value={formatCurrency(c.quitacao)} />}
            <Row label="Valor emprestado" value={formatCurrency(c.valorPrincipalInicial || (parcelado ? 0 : c.valorPrincipal))} />
          </>
        )}
        {aluguel ? null : parcelado ? (
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

      {Array.isArray(c.carencias) && c.carencias.length > 0 && (
        <>
          <SectionTitle>Carências concedidas ({c.carencias.length})</SectionTitle>
          <Card className="divide-y divide-border-subtle">
            {[...c.carencias].reverse().map((k, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm font-semibold">{k.dias} dia(s) {aluguel ? 'sem cobrar' : 'de carência'}{k.multaPerdoada ? ' · multa perdoada' : ''}</p>
                <p className="text-[12px] text-text-secondary">
                  {formatDate(k.data)} · vencimento {formatDate(k.vencimentoAntes)} → {formatDate(k.vencimentoDepois)}{k.motivo ? ` · ${k.motivo}` : ''}{k.por ? ` · por ${k.por}` : ''}
                </p>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle action={historico.length > 0 && <button type="button" onClick={() => setExtrato(true)} className="text-[13px] font-semibold text-brand-primary">Enviar extrato</button>}>
        Recebimentos ({historico.length})
      </SectionTitle>
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
      <ExtratoSheet isOpen={extrato} onClose={() => setExtrato(false)} contrato={c} historico={historico} />

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

      {carencia && (() => {
        let previa = null;
        try {
          const m = aplicarCarencia(c, carencia.dias, new Date(), { perdoarMulta: carencia.perdoar });
          const d = { ...c, ...m };
          previa = { venc: m.dataVencimento, aberto: aluguel ? saldoAluguelEmAberto(d) : devidoAgora(d).total, multa: multaDevida(d) };
        } catch { previa = null; }
        const atalhos = [[7, '1 semana'], [15, '15 dias'], [30, '1 mês']];
        return (
          <Modal
            isOpen
            onClose={() => setCarencia(null)}
            title="Dar carência"
            subtitle={aluguel ? c.itemDescricao : c.cliente?.nome}
            footer={<Button size="lg" block loading={ocupado} disabled={!previa} onClick={async () => {
              setOcupado(true);
              try {
                await darCarencia(c, carencia.dias, carencia.motivo, carencia.perdoar);
                toast.success(`Carência de ${carencia.dias} dia(s) aplicada.`);
                setCarencia(null);
              } catch (e) { toast.error(e.message); } finally { setOcupado(false); }
            }}>Aplicar carência</Button>}
          >
            <p className="text-sm text-text-secondary mb-4">
              {aluguel
                ? 'Os dias de carência não são cobrados: o vencimento anda para frente e o valor não soma na dívida.'
                : 'O vencimento é adiado: nesses dias não corre multa nem acumula juro de atraso. O valor do contrato continua o mesmo.'}
            </p>
            <div className="flex gap-2 mb-3">
              {atalhos.map(([d, l]) => (
                <button key={d} type="button" onClick={() => setCarencia((x) => ({ ...x, dias: String(d) }))}
                  className={cn('h-9 px-3.5 rounded-full text-[13px] font-semibold border', String(d) === String(carencia.dias) ? 'bg-text-primary text-brand-surface border-text-primary' : 'bg-brand-surface border-border-subtle text-text-secondary')}>{l}</button>
              ))}
            </div>
            <div className="space-y-3">
              <Input label="Dias de carência" type="number" min="1" max="365" inputMode="numeric" value={carencia.dias} onChange={(e) => setCarencia((x) => ({ ...x, dias: e.target.value }))} />
              <Input label="Motivo (opcional)" value={carencia.motivo} onChange={(e) => setCarencia((x) => ({ ...x, motivo: e.target.value }))} placeholder={aluguel ? 'Ex.: moto na oficina' : 'Ex.: cliente pediu prazo'} maxLength={200} />
              {c.multa > 0 && (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={carencia.perdoar} onChange={(e) => setCarencia((x) => ({ ...x, perdoar: e.target.checked }))} className="w-4 h-4 accent-[var(--brand-primary)]" />
                  Perdoar a multa em aberto ({formatCurrency(c.multa)})
                </label>
              )}
            </div>
            {previa && (
              <div className="rounded-2xl bg-brand-surface-2 p-3.5 mt-4">
                <Row label="Vencimento" value={`${formatDate(c.dataVencimento)} → ${formatDate(previa.venc)}`} />
                <Row label={aluguel ? 'Em aberto' : 'Devido hoje'} value={`${formatCurrency(aluguel ? c.saldo : c.devido.total)} → ${formatCurrency(previa.aberto)}`} strong />
                {c.multa > 0 && <Row label="Multa" value={`${formatCurrency(c.multa)} → ${formatCurrency(previa.multa)}`} />}
              </div>
            )}
          </Modal>
        );
      })()}

      <Modal
        isOpen={encerrar}
        onClose={() => setEncerrar(false)}
        title={c.encerrado ? 'Reabrir aluguel?' : 'Encerrar aluguel?'}
        footer={(
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setEncerrar(false)}>Cancelar</Button>
            <Button className="flex-1" loading={ocupado} onClick={async () => {
              setOcupado(true);
              try {
                await editarEmprestimo(c.id, c.encerrado
                  ? { encerrado: false, status: 'ativo', dataEncerramento: null }
                  : {
                    encerrado: true,
                    // o que já venceu e não foi pago continua devido depois de encerrar
                    acrescimoProximo: c.saldo,
                    pagoParcelaAtual: 0,
                    status: c.saldo > 0 ? 'atrasado' : 'pago',
                    dataEncerramento: new Date().toISOString(),
                  });
                toast.success(c.encerrado ? 'Aluguel reaberto.' : 'Aluguel encerrado.');
                setEncerrar(false);
              } catch (e) { toast.error(e.message); } finally { setOcupado(false); }
            }}>Confirmar</Button>
          </>
        )}
      >
        <p className="text-sm text-text-secondary">
          {c.encerrado
            ? 'O aluguel volta a gerar cobrança a partir do próximo vencimento.'
            : <>O aluguel para de gerar novas cobranças. {c.saldo > 0 && <>Os <b>{formatCurrency(c.saldo)}</b> que já venceram continuam em aberto para cobrar.</>}</>}
        </p>
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
