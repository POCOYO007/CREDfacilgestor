import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, MessageCircle, FileDown, AlertTriangle } from 'lucide-react';
import { Modal, Button, Segmented, MoneyInput, Input, Row, cn } from './ui';
import { simularPagamento, TIPOS_PAGAMENTO } from '../domain/pagamento';
import { ehParcelado, hojeISO, juroPorPeriodo, num, parseData } from '../domain/emprestimo';
import { formatCurrency, formatDate, substituirVariaveis, buildWhatsAppUrl } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

const ROTULOS_COMPOSICAO = { multa: 'Multa', juros: 'Juros', capital: 'Capital', parcela: 'Parcela', aluguel: 'Aluguel' };

/**
 * Registrar pagamento — a mesma tela para gestor e cobrador.
 * @param contrato  contrato enriquecido (useContratos)
 * @param cobradorId quem recebeu (cobrador logado, ou o cobrador do contrato quando é o gestor)
 */
export default function PagamentoSheet({ isOpen, onClose, contrato, cobradorId, ehCobrador = false, tipoInicial = 'regular' }) {
  const registrarPagamento = useAppStore((s) => s.registrarPagamento);
  const config = useAppStore((s) => s.config);

  const [tipo, setTipo] = useState(tipoInicial);
  const [valor, setValor] = useState('');
  const [opcao, setOpcao] = useState(null);
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(null); // { rec, contratoDepois }

  const parcelado = contrato ? ehParcelado(contrato) : false;
  const aluguel = contrato?.modalidade === 'aluguel';
  const nomeParcela = aluguel ? 'Aluguel' : 'Parcela';

  const sugestoes = useMemo(() => {
    if (!contrato) return {};
    return {
      regular: contrato.devido.total,
      quitacao: contrato.quitacao,
      somente_juros: contrato.devido.juros ?? 0,
      multa: contrato.multa,
    };
  }, [contrato]);

  useEffect(() => {
    if (!isOpen || !contrato) return;
    setTipo(tipoInicial);
    setValor(sugestoes[tipoInicial] > 0 ? sugestoes[tipoInicial].toFixed(2) : '');
    setOpcao(null);
    setData(hojeISO());
    setObs('');
    setConcluido(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contrato?.id]);

  const trocarTipo = (t) => {
    setTipo(t);
    setOpcao(null);
    setValor(sugestoes[t] > 0 ? sugestoes[t].toFixed(2) : '');
  };

  const sim = useMemo(() => {
    if (!contrato || !(num(valor) > 0)) return null;
    return simularPagamento(contrato, { valor: num(valor), tipo, opcaoParcial: opcao });
  }, [contrato, valor, tipo, opcao]);

  if (!contrato) return null;

  const opcoesTipo = [
    { value: 'regular', label: 'Pagamento' },
    ...(!parcelado ? [{ value: 'somente_juros', label: 'Só juros' }] : []),
    ...(contrato.multa > 0 ? [{ value: 'multa', label: 'Só multa' }] : []),
    ...(!aluguel ? [{ value: 'quitacao', label: 'Quitar' }] : []),
  ];

  const atalhos = [
    { label: 'Devido hoje', valor: contrato.devido.total },
    parcelado ? { label: nomeParcela, valor: num(contrato.valorParcela) } : { label: 'Juro do período', valor: juroPorPeriodo(contrato) },
    ...(!aluguel ? [{ label: 'Quitar', valor: contrato.quitacao, tipo: 'quitacao' }] : []),
  ].filter((a) => a.valor > 0);

  const bloqueioDesconto = ehCobrador && tipo === 'quitacao' && sim?.desconto > 0;

  const confirmar = async () => {
    if (!sim || sim.erro) { toast.error(sim?.erro || 'Informe o valor recebido.'); return; }
    if (sim.precisaEscolha) { toast.error('Escolha o que fazer com o valor que faltou.'); return; }
    if (bloqueioDesconto) { toast.error('Quitação com desconto só pode ser feita pelo gestor.'); return; }
    setSalvando(true);
    try {
      const dataRecebimento = data === hojeISO() ? new Date().toISOString() : new Date(`${data}T12:00:00`).toISOString();
      const rec = await registrarPagamento(contrato, sim, {
        tipo, valor: num(valor), dataRecebimento, observacao: obs, cobradorId, opcaoParcial: sim.parcial ? (opcao || 'manter') : null,
      });
      setConcluido({ rec, contratoDepois: { ...contrato, ...sim.contratoDepois } });
      toast.success('Pagamento registrado!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const telefone = contrato.cliente?.whatsapp || contrato.cliente?.telefone;

  // ---------- passo 2: concluído ----------
  if (concluido) {
    const { rec, contratoDepois } = concluido;
    const msg = substituirVariaveis(config.templateRecibo, {
      cliente: contrato.cliente?.nome, valorPago: rec.valor, saldoRestante: contratoDepois.saldoDevedor,
      dataVencimento: contratoDepois.dataVencimento,
    });
    const url = buildWhatsAppUrl(telefone, msg);
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Pagamento registrado">
        <div className="text-center py-2">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
          <p className="text-3xl font-extrabold mt-3 tabular-nums">{formatCurrency(rec.valor)}</p>
          <p className="text-sm text-text-secondary mt-1">{contrato.cliente?.nome}</p>
        </div>
        <div className="surface-card p-3 mt-4">
          <Row label="Saldo restante" value={formatCurrency(contratoDepois.saldoDevedor)} />
          {contratoDepois.status !== 'pago' && <Row label="Próximo vencimento" value={formatDate(contratoDepois.dataVencimento)} />}
          {contratoDepois.status === 'pago' && <Row label="Contrato" value="Quitado ✓" tone="success" />}
        </div>
        <div className="grid gap-2 mt-4">
          <Button variant="success" size="lg" disabled={!url} onClick={() => url && window.open(url, '_blank')}>
            <MessageCircle className="w-5 h-5" /> Enviar recibo no WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const { gerarComprovante } = await import('../services/pdfService');
              gerarComprovante(rec, contratoDepois, contrato.cliente, contrato.cobrador, config);
            }}
          >
            <FileDown className="w-5 h-5" /> Baixar comprovante (PDF)
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    );
  }

  // ---------- passo 1: registrar ----------
  const comp = sim?.composicao || {};
  const depois = sim?.contratoDepois;
  const vencMudou = depois && depois.dataVencimento !== contrato.dataVencimento;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receber pagamento"
      subtitle={contrato.cliente?.nome}
      footer={(
        <Button size="lg" block variant="success" loading={salvando} onClick={confirmar} disabled={!sim || !!sim.erro || bloqueioDesconto}>
          Confirmar {num(valor) > 0 ? formatCurrency(num(valor)) : ''}
        </Button>
      )}
    >
      {/* Situação do contrato */}
      <div className="rounded-2xl bg-brand-surface-2 p-3.5 mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-text-secondary">Devido hoje</span>
          <span className="text-2xl font-extrabold tabular-nums">{formatCurrency(contrato.devido.total)}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[13px] text-text-secondary">
          {contrato.devido.multa > 0 && <span>Multa <b className="text-danger">{formatCurrency(contrato.devido.multa)}</b></span>}
          {contrato.devido.acrescimo > 0 && <span>Restante anterior <b>{formatCurrency(contrato.devido.acrescimo)}</b></span>}
          {parcelado
            ? <span>{contrato.devido.qtdParcelas > 1 ? `${contrato.devido.qtdParcelas} ${aluguel ? 'aluguéis' : 'parcelas'}` : nomeParcela} <b>{formatCurrency(contrato.devido.parcelas)}</b></span>
            : <span>Juros {contrato.devido.periodos > 1 ? `(${contrato.devido.periodos} períodos)` : ''} <b>{formatCurrency(contrato.devido.juros)}</b></span>}
          {!aluguel && <span>Saldo <b>{formatCurrency(contrato.saldo)}</b></span>}
        </div>
      </div>

      <Segmented options={opcoesTipo} value={tipo} onChange={trocarTipo} className="mb-4" />

      <MoneyInput
        label="Valor recebido"
        value={valor}
        onChange={(e) => { setValor(e.target.value); setOpcao(null); }}
        inputClassName="h-14 text-2xl font-extrabold"
        autoFocus
      />
      <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
        {atalhos.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => { if (a.tipo) setTipo(a.tipo); else if (tipo === 'quitacao') setTipo('regular'); setValor(a.valor.toFixed(2)); setOpcao(null); }}
            className="shrink-0 h-8 px-3 rounded-full bg-brand-surface-2 text-[12px] font-semibold text-text-secondary hover:text-text-primary"
          >
            {a.label} · {formatCurrency(a.valor)}
          </button>
        ))}
      </div>

      {/* Pagamento parcial: quem registra decide */}
      {sim?.parcial && (
        <div className="mt-4 rounded-2xl border-2 border-warning/50 bg-warning/8 p-3.5">
          <p className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-strong" />
            Faltam {formatCurrency(sim.parcial.faltando)} {{ parcela: 'desta parcela', aluguel: 'deste aluguel', juros: 'deste juro' }[sim.parcial.rotulo]}
          </p>
          {sim.parcial.podeJogarProxima ? (
            <div className="grid gap-2 mt-3">
              <EscolhaParcial
                ativo={opcao === 'manter'}
                onClick={() => setOpcao('manter')}
                titulo="Cobrar o restante ainda neste período"
                texto={`O vencimento continua em ${formatDate(contrato.dataVencimento)} e ficam faltando ${formatCurrency(sim.parcial.faltando)}.`}
              />
              <EscolhaParcial
                ativo={opcao === 'proxima'}
                onClick={() => setOpcao('proxima')}
                titulo="Jogar o restante para a próxima"
                texto={`Avança o vencimento e a próxima cobrança fica ${formatCurrency(
                  (parcelado ? num(contrato.valorParcela) : juroPorPeriodo(contrato)) + sim.parcial.faltando,
                )}.`}
              />
            </div>
          ) : (
            <p className="text-[13px] text-text-secondary mt-1.5">{aluguel ? 'É o último período do aluguel' : 'É a última parcela'}: o restante fica em aberto neste período.</p>
          )}
        </div>
      )}

      {/* Como o valor vai ser aplicado */}
      {sim && !sim.erro && (
        <div className="mt-4 surface-card p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-1">Como fica</p>
          {Object.entries(comp).map(([k, v]) => <Row key={k} label={ROTULOS_COMPOSICAO[k]} value={formatCurrency(v)} />)}
          {sim.desconto > 0 && <Row label="Desconto na quitação" value={formatCurrency(sim.desconto)} tone="warning" />}
          {sim.troco > 0 && <Row label="Acima do devido (não abate)" value={formatCurrency(sim.troco)} tone="warning" />}
          <div className="border-t border-border-subtle my-1.5" />
          <Row label={aluguel ? 'Em aberto depois' : 'Saldo depois'} value={formatCurrency(depois.saldoDevedor)} strong />
          {depois.status === 'pago'
            ? <Row label="Contrato" value={aluguel ? 'Encerrado ✓' : 'Quitado ✓'} tone="success" />
            : vencMudou && <Row label="Próximo vencimento" value={formatDate(depois.dataVencimento)} />}
          {bloqueioDesconto && <p className="text-[13px] text-danger font-semibold mt-2">Quitação com desconto só pode ser feita pelo gestor.</p>}
        </div>
      )}
      {sim?.erro && <p className="mt-3 text-sm text-danger font-semibold">{sim.erro}</p>}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Input label="Data" type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} />
        <Input label="Observação" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
      </div>
      {parseData(data) && data !== hojeISO() && (
        <p className="text-xs text-text-muted mt-2">O cálculo usa a situação do contrato hoje; a data fica registrada no recibo.</p>
      )}
    </Modal>
  );
}

function EscolhaParcial({ ativo, onClick, titulo, texto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border-2 p-3 transition-colors bg-brand-surface',
        ativo ? 'border-brand-primary' : 'border-border-subtle',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('w-4 h-4 rounded-full border-2 shrink-0', ativo ? 'border-brand-primary bg-brand-primary shadow-[inset_0_0_0_2px_var(--brand-surface)]' : 'border-border-strong')} />
        <span className="text-sm font-bold">{titulo}</span>
      </div>
      <p className="text-[13px] text-text-secondary mt-1 pl-6">{texto}</p>
    </button>
  );
}

export { TIPOS_PAGAMENTO };
