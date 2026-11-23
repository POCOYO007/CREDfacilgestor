import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Share2, MessageCircle, FileDown } from 'lucide-react';
import { Modal, Button, Row } from './ui';
import { useAppStore } from '../store/useAppStore';
import { TIPOS_PAGAMENTO } from '../domain/pagamento';
import { int, parseData } from '../domain/emprestimo';
import { formatCurrency, formatDate, buildWhatsAppUrl } from '../utils/formatters';

const MAX_LINHAS_WHATS = 15;

/** Texto do extrato para mandar no WhatsApp. */
export function textoExtrato(c, historico, config) {
  const aluguel = c.modalidade === 'aluguel';
  const pago = c.status === 'pago';
  const total = historico.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const linhas = historico.slice(0, MAX_LINHAS_WHATS)
    .map((r) => `• ${formatDate(r.dataRecebimento)} — ${formatCurrency(r.valor)} (${aluguel && r.tipo === 'regular' ? 'aluguel' : (TIPOS_PAGAMENTO[r.tipo] || 'pagamento').toLowerCase()})`);
  const partes = [
    `*${config?.nomeEmpresa || 'Extrato'}*`,
    `Extrato de ${c.cliente?.nome || 'cliente'} — ${formatDate(new Date())}`,
    aluguel ? `Aluguel: ${c.itemDescricao || ''} (${formatCurrency(c.valorParcela)})` : `Contrato #${c.id.slice(0, 6).toUpperCase()}`,
    '',
    historico.length ? `*Pagamentos (${historico.length})*` : '*Nenhum pagamento registrado ainda*',
    ...linhas,
    historico.length > MAX_LINHAS_WHATS ? `… e mais ${historico.length - MAX_LINHAS_WHATS} pagamento(s) anteriores` : null,
    historico.length ? `*Total pago: ${formatCurrency(total)}*` : null,
    '',
  ];
  if (pago) {
    partes.push(aluguel ? '✅ Aluguel encerrado.' : '✅ Contrato quitado.');
  } else {
    if (aluguel) {
      partes.push(`Em aberto hoje: *${formatCurrency(c.devido.total)}*`);
    } else {
      partes.push(`Saldo devedor: *${formatCurrency(c.saldo)}*`);
      if (c.modalidade === 'parcelado') partes.push(`Parcelas pagas: ${int(c.parcelasPagas)} de ${int(c.totalParcelas)}`);
      partes.push(`Valor para ficar em dia hoje: *${formatCurrency(c.devido.total)}*`);
    }
    if (c.multa > 0) partes.push(`(inclui multa de ${formatCurrency(c.multa)})`);
    partes.push(`Próximo vencimento: ${formatDate(c.dataVencimento)}`);
  }
  return partes.filter((x) => x !== null).join('\n');
}

export default function ExtratoSheet({ isOpen, onClose, contrato: c, historico }) {
  const config = useAppStore((s) => s.config);
  const [gerando, setGerando] = useState(false);
  if (!c) return null;

  const telefone = c.cliente?.whatsapp || c.cliente?.telefone;
  const urlTexto = buildWhatsAppUrl(telefone, textoExtrato(c, historico, config));
  const total = historico.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const ultimo = historico[0];

  const gerarPdf = async () => {
    const { gerarExtratoPagamentos } = await import('../services/pdfService');
    return gerarExtratoPagamentos(c, c.cliente, historico, config, { retornar: true });
  };

  const compartilharPdf = async () => {
    setGerando(true);
    try {
      const { blob, nome } = await gerarPdf();
      const arquivo = new File([blob], nome, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome, text: `Extrato de ${c.cliente?.nome || ''}` });
      } else {
        baixar(blob, nome);
        toast('PDF baixado. Anexe no WhatsApp do cliente.', { icon: '📎' });
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const baixarPdf = async () => {
    setGerando(true);
    try {
      const { blob, nome } = await gerarPdf();
      baixar(blob, nome);
    } catch {
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Extrato" subtitle={c.cliente?.nome}>
      <div className="rounded-2xl bg-brand-surface-2 p-3.5 mb-4">
        <Row label="Pagamentos registrados" value={historico.length} />
        <Row label="Total pago" value={formatCurrency(total)} strong />
        {ultimo && <Row label="Último pagamento" value={`${formatDate(ultimo.dataRecebimento)} · ${formatCurrency(ultimo.valor)}`} />}
        {c.status !== 'pago' && <Row label={c.modalidade === 'aluguel' ? 'Em aberto hoje' : 'Saldo devedor'} value={formatCurrency(c.modalidade === 'aluguel' ? c.devido.total : c.saldo)} />}
      </div>
      <div className="grid gap-2">
        <Button size="lg" variant="success" loading={gerando} onClick={compartilharPdf}>
          <Share2 className="w-5 h-5" /> Enviar PDF (WhatsApp, e-mail…)
        </Button>
        <Button size="lg" variant="outline" disabled={!urlTexto} onClick={() => urlTexto && window.open(urlTexto, '_blank')}>
          <MessageCircle className="w-5 h-5 text-success" /> Resumo em texto no WhatsApp
        </Button>
        <Button variant="ghost" onClick={baixarPdf} disabled={gerando}>
          <FileDown className="w-5 h-5" /> Baixar PDF
        </Button>
      </div>
      {!urlTexto && <p className="text-[12px] text-text-muted mt-2">Cliente sem telefone cadastrado: o resumo em texto precisa do WhatsApp dele.</p>}
      <p className="text-[12px] text-text-muted mt-3">
        No celular, "Enviar PDF" abre a lista de apps: escolha o WhatsApp e o contato do cliente. No computador, o PDF é baixado para você anexar.
      </p>
    </Modal>
  );
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const ordenarHistorico = (lista) => [...lista].sort((a, b) => (parseData(b.dataRecebimento) || 0) - (parseData(a.dataRecebimento) || 0));
