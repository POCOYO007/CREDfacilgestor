import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { Modal, Button, Segmented, MoneyInput, Input, Select, Row } from './ui';
import { CamposMulta } from './EmprestimoForm';
import ClienteForm from './ClienteForm';
import {
  FREQUENCIAS, TIPOS_ITEM_ALUGUEL, montarNovoAluguel, hojeISO, num, int,
} from '../domain/emprestimo';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

const ROTULO_FREQ = { diario: 'por dia', semanal: 'por semana', quinzenal: 'por quinzena', mensal: 'por mês', dia_especifico: 'por mês' };

const formVazio = (config, cobradorId, clienteId) => ({
  clienteId: clienteId || '',
  itemTipo: 'moto',
  itemDescricao: '',
  valorParcela: '',
  frequencia: 'semanal',
  diaVencimento: '10',
  dataInicio: hojeISO(),
  primeiroVencimento: hojeISO(),
  prazo: 'indeterminado',
  totalParcelas: '',
  caucao: '',
  cobradorId: cobradorId || '',
  carenciaDias: String(config.carenciaPadrao ?? 0),
  tipoMulta: 'parcela_fixa',
  valorMulta: '',
});

/** Novo contrato de aluguel (carro, moto, casa ou o que o gestor quiser). */
export default function AluguelForm({ isOpen, onClose, cliente, onCriado }) {
  const config = useAppStore((s) => s.config);
  const clientes = useAppStore((s) => s.clientes);
  const cobradores = useAppStore((s) => s.cobradores);
  const adicionarEmprestimo = useAppStore((s) => s.adicionarEmprestimo);
  const [f, setF] = useState(() => formVazio(config, '', cliente?.id));
  const [salvando, setSalvando] = useState(false);
  const [novoCliente, setNovoCliente] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (isOpen) setF(formVazio(config, cobradores.find((c) => c.ativo !== false)?.id, cliente?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const clientesOrdenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  const total = f.prazo === 'fixo' ? num(f.valorParcela) * int(f.totalParcelas) : 0;

  const salvar = async () => {
    if (!f.clienteId) { toast.error('Escolha o cliente.'); return; }
    let doc;
    try {
      doc = montarNovoAluguel(f, { clienteId: f.clienteId, cobradorId: f.cobradorId });
    } catch (e) { toast.error(e.message); return; }
    setSalvando(true);
    try {
      const id = await adicionarEmprestimo(doc);
      toast.success('Aluguel criado!');
      onCriado?.({ ...doc, id });
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !novoCliente}
        onClose={onClose}
        title="Novo aluguel"
        subtitle={cliente?.nome}
        footer={<Button size="lg" block loading={salvando} onClick={salvar}>Criar aluguel</Button>}
      >
        <div className="space-y-4">
          {!cliente && (
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Select label="Cliente (locatário)" value={f.clienteId} onChange={set('clienteId')}>
                <option value="">Escolha…</option>
                {clientesOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
              <Button variant="secondary" className="h-12" onClick={() => setNovoCliente(true)} aria-label="Novo cliente"><UserPlus className="w-5 h-5" /></Button>
            </div>
          )}

          <Segmented options={TIPOS_ITEM_ALUGUEL.map((t) => ({ value: t.value, label: t.label.split(' ')[0] }))} value={f.itemTipo} onChange={set('itemTipo')} />
          <Input
            label="O que está sendo alugado"
            value={f.itemDescricao}
            onChange={set('itemDescricao')}
            placeholder={{ carro: 'Ex.: Gol 2015 prata, placa ABC1D23', moto: 'Ex.: Honda CG 160, placa ABC1D23', casa: 'Ex.: Casa 2 quartos, Rua A nº 10' }[f.itemTipo] || 'Descreva o item'}
            maxLength={200}
          />

          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Valor do aluguel" value={f.valorParcela} onChange={set('valorParcela')} />
            <Select label="Cobrança" value={f.frequencia} onChange={set('frequencia')} options={FREQUENCIAS} />
          </div>
          {f.frequencia === 'dia_especifico' && (
            <Input label="Dia do mês" type="number" min="1" max="31" value={f.diaVencimento} onChange={set('diaVencimento')} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Início" type="date" value={f.dataInicio} onChange={set('dataInicio')} />
            <Input label="1º pagamento" type="date" value={f.primeiroVencimento} onChange={set('primeiroVencimento')} />
          </div>

          <div>
            <span className="text-[13px] font-semibold text-text-secondary">Prazo</span>
            <Segmented
              className="mt-1.5"
              options={[{ value: 'indeterminado', label: 'Sem prazo' }, { value: 'fixo', label: 'Nº de períodos' }]}
              value={f.prazo}
              onChange={set('prazo')}
            />
          </div>
          {f.prazo === 'fixo' && (
            <Input label="Quantos períodos" type="number" min="1" inputMode="numeric" value={f.totalParcelas} onChange={set('totalParcelas')} hint="Ex.: 52 semanas, 12 meses." />
          )}

          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Caução (opcional)" value={f.caucao} onChange={set('caucao')} />
            <Input label="Carência (dias)" type="number" min="0" value={f.carenciaDias} onChange={set('carenciaDias')} />
          </div>

          <Select label="Cobrador" value={f.cobradorId} onChange={set('cobradorId')}>
            <option value="">Sem cobrador (gestor recebe)</option>
            {cobradores.filter((c) => c.ativo !== false).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>

          <CamposMulta tipo={f.tipoMulta} valor={f.valorMulta} onTipo={set('tipoMulta')} onValor={set('valorMulta')} />

          <div className="rounded-2xl bg-brand-surface-2 p-3.5">
            <Row label="Aluguel" value={`${formatCurrency(num(f.valorParcela))} ${ROTULO_FREQ[f.frequencia] || ''}`} strong />
            {f.prazo === 'fixo' && total > 0 && <Row label="Total do contrato" value={formatCurrency(total)} />}
            {num(f.caucao) > 0 && <Row label="Caução" value={formatCurrency(num(f.caucao))} />}
            {f.primeiroVencimento && <Row label="1º pagamento" value={formatDate(f.primeiroVencimento)} />}
          </div>
        </div>
      </Modal>
      <ClienteForm
        isOpen={novoCliente}
        onClose={() => setNovoCliente(false)}
        onSalvo={(id) => { if (id) setF((p) => ({ ...p, clienteId: id })); }}
      />
    </>
  );
}
