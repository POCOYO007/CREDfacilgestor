import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Info } from 'lucide-react';
import { Modal, Button, Input, MoneyInput, Select, Row } from './ui';
import { CamposMulta } from './EmprestimoForm';
import {
  FREQUENCIAS, ehParcelado, ehRegraNova, num, int, round2, hojeISO, parseData, conservarMulta, saldoDevedor,
  calcularStatus, multaDevida, descreverMulta, VERSAO_REGRA_ATUAL,
} from '../domain/emprestimo';
import { formatCurrency } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

/** Traduz a multa antiga (fixa + % + diária) para a opção mais próxima da regra nova. */
const multaSugerida = (c) => {
  if (ehRegraNova(c)) return { tipo: c.tipoMulta || 'nenhuma', valor: String(c.valorMulta ?? '') };
  if (num(c.multaDiaria) > 0) return { tipo: 'atraso_diaria', valor: String(c.multaDiaria) };
  if (num(c.multaPercentual) > 0) return { tipo: 'parcela_percentual', valor: String(c.multaPercentual) };
  if (num(c.multaFixa) > 0) return { tipo: 'parcela_fixa', valor: String(c.multaFixa) };
  return { tipo: 'nenhuma', valor: '' };
};

const paraData = (iso) => (parseData(iso) ? hojeISO(parseData(iso)) : '');

export default function EditarContratoSheet({ isOpen, onClose, contrato }) {
  const cobradores = useAppStore((s) => s.cobradores);
  const editarEmprestimo = useAppStore((s) => s.editarEmprestimo);
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  useEffect(() => {
    if (!isOpen || !contrato) return;
    const m = multaSugerida(contrato);
    setF({
      cobradorId: contrato.cobrador?.id || contrato.cobradorId || '',
      dataVencimento: paraData(contrato.dataVencimento),
      frequencia: contrato.frequencia || 'mensal',
      diaVencimento: String(contrato.diaVencimento || ''),
      carenciaDias: String(contrato.carenciaDias ?? 0),
      // parcelado
      valorParcela: String(contrato.valorParcela ?? ''),
      totalParcelas: String(contrato.totalParcelas ?? ''),
      parcelasPagas: String(contrato.parcelasPagas ?? 0),
      pagoParcelaAtual: String(contrato.pagoParcelaAtual ?? 0),
      // juros
      valorPrincipal: String(contrato.valorPrincipal ?? ''),
      taxaJuros: String(contrato.taxaJuros ?? ''),
      abatimentoJuros: String(contrato.abatimentoJuros ?? 0),
      acrescimoProximo: String(contrato.acrescimoProximo ?? 0),
      // multa
      migrar: true,
      tipoMulta: m.tipo,
      valorMulta: m.valor,
      multaHoje: String(multaDevida(contrato)),
    });
  }, [isOpen, contrato]);

  if (!contrato || !f) return null;
  const parcelado = ehParcelado(contrato);
  const antigo = !ehRegraNova(contrato);

  const salvar = async () => {
    const venc = parseData(f.dataVencimento);
    if (!venc) { toast.error('Informe a data de vencimento.'); return; }
    const mudancas = {
      cobradorId: f.cobradorId,
      dataVencimento: venc.toISOString(),
      frequencia: f.frequencia,
      diaVencimento: f.frequencia === 'dia_especifico' ? int(f.diaVencimento) || venc.getDate() : null,
      carenciaDias: int(f.carenciaDias),
      acrescimoProximo: round2(f.acrescimoProximo),
    };
    if (parcelado) {
      const total = int(f.totalParcelas);
      const pagas = int(f.parcelasPagas);
      if (!(total > 0) || !(num(f.valorParcela) > 0)) { toast.error('Informe parcelas e valor da parcela.'); return; }
      if (pagas > total) { toast.error('Parcelas pagas não pode passar do total.'); return; }
      Object.assign(mudancas, {
        valorParcela: round2(f.valorParcela), totalParcelas: total, parcelasPagas: pagas,
        pagoParcelaAtual: round2(Math.min(num(f.pagoParcelaAtual), num(f.valorParcela))),
      });
    } else {
      Object.assign(mudancas, {
        valorPrincipal: round2(f.valorPrincipal), taxaJuros: num(f.taxaJuros), abatimentoJuros: round2(f.abatimentoJuros),
      });
    }
    if (!antigo || f.migrar) {
      if (f.tipoMulta !== 'nenhuma' && !(num(f.valorMulta) > 0)) { toast.error('Informe o valor da multa.'); return; }
      Object.assign(mudancas, {
        versaoRegra: VERSAO_REGRA_ATUAL,
        tipoMulta: f.tipoMulta,
        valorMulta: f.tipoMulta === 'nenhuma' ? 0 : num(f.valorMulta),
      });
    }

    const depois = { ...contrato, ...mudancas };
    if (!parcelado) depois.valorParcela = round2(num(depois.valorPrincipal) * num(depois.taxaJuros) / 100);
    // A multa em aberto fica exatamente no valor informado, e daqui pra frente segue a regra do contrato.
    Object.assign(depois, conservarMulta(Math.max(0, round2(f.multaHoje)), depois));
    depois.saldoDevedor = saldoDevedor(depois);
    if (parcelado) depois.valorPrincipal = depois.saldoDevedor;
    depois.status = calcularStatus(depois);

    const campos = [
      ...Object.keys(mudancas), 'valorParcela', 'valorPrincipal', 'saldoDevedor', 'status', 'multaAcumulada', 'multaAbatida',
    ];
    const dados = Object.fromEntries([...new Set(campos)].map((k) => [k, depois[k] ?? null]));
    // Depois de uma edição manual, excluir um recebimento antigo não deve desfazer a edição.
    dados.ultimoRecebimentoId = null;

    setSalvando(true);
    try {
      await editarEmprestimo(contrato.id, dados);
      toast.success('Contrato atualizado!');
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar contrato"
      subtitle={contrato.cliente?.nome}
      footer={<Button size="lg" block loading={salvando} onClick={salvar}>Salvar alterações</Button>}
    >
      <div className="space-y-4">
        <Select label="Cobrador" value={f.cobradorId} onChange={set('cobradorId')}>
          <option value="">Sem cobrador (gestor recebe)</option>
          {cobradores.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo === false ? ' (bloqueado)' : ''}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Próximo vencimento" type="date" value={f.dataVencimento} onChange={set('dataVencimento')} />
          <Input label="Carência (dias)" type="number" min="0" value={f.carenciaDias} onChange={set('carenciaDias')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Frequência" value={f.frequencia} onChange={set('frequencia')} options={FREQUENCIAS} />
          {f.frequencia === 'dia_especifico' && <Input label="Dia do mês" type="number" min="1" max="31" value={f.diaVencimento} onChange={set('diaVencimento')} />}
        </div>

        {parcelado ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Total de parcelas" type="number" min="1" value={f.totalParcelas} onChange={set('totalParcelas')} />
              <MoneyInput label="Valor da parcela" value={f.valorParcela} onChange={set('valorParcela')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Parcelas pagas" type="number" min="0" value={f.parcelasPagas} onChange={set('parcelasPagas')} />
              <MoneyInput label="Já pago da parcela atual" value={f.pagoParcelaAtual} onChange={set('pagoParcelaAtual')} />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput label="Capital em aberto" value={f.valorPrincipal} onChange={set('valorPrincipal')} />
              <Input label="Juros por período" type="number" step="0.1" min="0" prefix="%" value={f.taxaJuros} onChange={set('taxaJuros')} />
            </div>
            <MoneyInput label="Crédito parcial no juro atual" value={f.abatimentoJuros} onChange={set('abatimentoJuros')} hint="Valor já pago do juro deste período." />
          </>
        )}
        <MoneyInput label="Restante jogado para a próxima" value={f.acrescimoProximo} onChange={set('acrescimoProximo')} />

        <div className="border-t border-border-subtle pt-4 space-y-3">
          {antigo && (
            <div className="rounded-xl bg-brand-primary/8 p-3 text-[13px] flex gap-2">
              <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
              <div>
                <p>Este contrato usa a <b>regra antiga de multa</b>: {descreverMulta(contrato)}.</p>
                <label className="flex items-center gap-2 mt-2 font-semibold">
                  <input type="checkbox" checked={f.migrar} onChange={set('migrar')} className="w-4 h-4 accent-[var(--brand-primary)]" />
                  Atualizar para a regra nova (uma multa só)
                </label>
              </div>
            </div>
          )}
          {(!antigo || f.migrar) && (
            <CamposMulta tipo={f.tipoMulta} valor={f.valorMulta} onTipo={set('tipoMulta')} onValor={set('valorMulta')} />
          )}
          <MoneyInput
            label="Multa em aberto hoje"
            value={f.multaHoje}
            onChange={set('multaHoje')}
            hint="O cliente fica devendo exatamente esse valor de multa hoje; daqui pra frente a multa segue a regra acima. Coloque 0 para perdoar."
          />
          <Row label="Saldo atual" value={formatCurrency(contrato.saldo)} />
        </div>
      </div>
    </Modal>
  );
}
