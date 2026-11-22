import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button, Segmented, MoneyInput, Input, Select, Row } from './ui';
import {
  FREQUENCIAS, TIPOS_MULTA, montarNovoEmprestimo, hojeISO, num, int, proximoVencimento, parseData,
} from '../domain/emprestimo';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

const formVazio = (config, cobradorId) => ({
  modalidade: 'parcelado',
  valorPrincipal: '',
  valorParcela: '',
  totalParcelas: '',
  taxaJuros: String(config.taxaPadrao ?? 10),
  frequencia: config.frequenciaPadrao || 'mensal',
  diaVencimento: '10',
  dataInicio: hojeISO(),
  primeiroVencimento: '',
  cobradorId: cobradorId || '',
  carenciaDias: String(config.carenciaPadrao ?? 0),
  tipoMulta: config.tipoMultaPadrao || 'parcela_percentual',
  valorMulta: String(config.valorMultaPadrao ?? config.multaPercentualPadrao ?? 10),
});

/** Campos de multa (uma só) — usado aqui e no "Editar contrato". */
export function CamposMulta({ tipo, valor, onTipo, onValor }) {
  const info = TIPOS_MULTA.find((t) => t.value === tipo);
  return (
    <div className="grid grid-cols-[1fr_120px] gap-3 items-end">
      <Select label="Multa" value={tipo} onChange={(e) => onTipo(e.target.value)} options={TIPOS_MULTA} />
      {tipo !== 'nenhuma' ? (
        <Input
          label={info?.unidade === '%' ? 'Percentual' : 'Valor'}
          type="number" inputMode="decimal" step="0.01" min="0"
          prefix={info?.unidade === '%' ? '%' : 'R$'}
          value={valor}
          onChange={(e) => onValor(e.target.value)}
        />
      ) : <div />}
    </div>
  );
}

export default function EmprestimoForm({ isOpen, onClose, cliente, cobradorFixo, onCriado }) {
  const config = useAppStore((s) => s.config);
  const cobradores = useAppStore((s) => s.cobradores);
  const adicionarEmprestimo = useAppStore((s) => s.adicionarEmprestimo);
  const [f, setF] = useState(() => formVazio(config, cobradorFixo));
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (isOpen) setF(formVazio(config, cobradorFixo || cobradores.find((c) => c.ativo !== false)?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const parcelado = f.modalidade === 'parcelado';
  const resumo = useMemo(() => {
    const p = num(f.valorPrincipal);
    if (parcelado) {
      const total = num(f.valorParcela) * int(f.totalParcelas);
      return { total, lucro: total - p };
    }
    return { juro: (p * num(f.taxaJuros)) / 100 };
  }, [f, parcelado]);

  const primeiroVenc = f.primeiroVencimento || (parseData(f.dataInicio)
    ? proximoVencimento(parseData(f.dataInicio), f.frequencia, 1, f.diaVencimento).slice(0, 10)
    : '');

  const salvar = async () => {
    let emp;
    try {
      emp = montarNovoEmprestimo(
        { ...f, primeiroVencimento: f.primeiroVencimento ? f.primeiroVencimento : null },
        { clienteId: cliente.id, cobradorId: cobradorFixo || f.cobradorId },
      );
    } catch (e) {
      toast.error(e.message);
      return;
    }
    setSalvando(true);
    try {
      const id = await adicionarEmprestimo(emp);
      toast.success('Empréstimo criado!');
      onCriado?.({ ...emp, id });
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
      title="Novo empréstimo"
      subtitle={cliente?.nome}
      footer={<Button size="lg" block loading={salvando} onClick={salvar}>Criar empréstimo</Button>}
    >
      <div className="space-y-4">
        <Segmented
          options={[{ value: 'parcelado', label: 'Parcelado' }, { value: 'tradicional', label: 'Juros (paga o juro)' }]}
          value={f.modalidade}
          onChange={set('modalidade')}
        />

        <MoneyInput label="Valor emprestado" value={f.valorPrincipal} onChange={set('valorPrincipal')} autoFocus />

        {parcelado ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nº de parcelas" type="number" inputMode="numeric" min="1" value={f.totalParcelas} onChange={set('totalParcelas')} />
            <MoneyInput label="Valor da parcela" value={f.valorParcela} onChange={set('valorParcela')} />
          </div>
        ) : (
          <Input label="Juros por período" type="number" inputMode="decimal" step="0.1" min="0" prefix="%" value={f.taxaJuros} onChange={set('taxaJuros')} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="Frequência" value={f.frequencia} onChange={set('frequencia')} options={FREQUENCIAS} />
          {f.frequencia === 'dia_especifico'
            ? <Input label="Dia do mês" type="number" min="1" max="31" value={f.diaVencimento} onChange={set('diaVencimento')} />
            : <Input label="Data do empréstimo" type="date" value={f.dataInicio} onChange={set('dataInicio')} />}
        </div>
        {f.frequencia === 'dia_especifico' && (
          <Input label="Data do empréstimo" type="date" value={f.dataInicio} onChange={set('dataInicio')} />
        )}
        <Input
          label="1º vencimento"
          type="date"
          value={primeiroVenc}
          onChange={set('primeiroVencimento')}
          hint="Calculado pela frequência — altere se precisar."
        />

        {!cobradorFixo && (
          <Select label="Cobrador" value={f.cobradorId} onChange={set('cobradorId')}>
            <option value="">Sem cobrador (gestor recebe)</option>
            {cobradores.filter((c) => c.ativo !== false).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        )}

        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Input label="Carência" type="number" min="0" inputMode="numeric" value={f.carenciaDias} onChange={set('carenciaDias')} hint="dias" />
          <div />
        </div>
        <CamposMulta tipo={f.tipoMulta} valor={f.valorMulta} onTipo={set('tipoMulta')} onValor={set('valorMulta')} />

        <div className="rounded-2xl bg-brand-surface-2 p-3.5">
          {parcelado ? (
            <>
              <Row label="Total a receber" value={formatCurrency(resumo.total)} strong />
              <Row label="Lucro do contrato" value={formatCurrency(resumo.lucro)} tone={resumo.lucro >= 0 ? 'success' : 'danger'} />
            </>
          ) : (
            <Row label="Juro por período" value={formatCurrency(resumo.juro)} strong />
          )}
          {primeiroVenc && <Row label="1º vencimento" value={formatDate(primeiroVenc)} />}
        </div>
      </div>
    </Modal>
  );
}
