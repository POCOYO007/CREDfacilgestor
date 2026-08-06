export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    let d;
    if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'object' && dateStr !== null && typeof dateStr.seconds === 'number') {
      d = new Date(dateStr.seconds * 1000);
    } else if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      d = new Date(year, month - 1, day, 12, 0, 0, 0);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('pt-BR').format(d);
  } catch (e) {
    return 'N/A';
  }
};

export const formatCPF = (value) => {
  if (!value) return '';
  const nums = value.replace(/\D/g, '');
  if (nums.length <= 11) return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const formatPhone = (value) => {
  if (!value) return '';
  const nums = value.replace(/\D/g, '');
  if (nums.length === 11) return nums.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (nums.length === 10) return nums.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return value;
};

export const substituirVariaveis = (template, { cliente, valor, dataVencimento, valorPago, saldoRestante, data }) => {
  if (!template) return '';
  return template
    .replace(/\{CLIENTE\}/g, cliente || '')
    .replace(/\{VALOR\}/g, formatCurrency(valor))
    .replace(/\{DATA_VENCIMENTO\}/g, formatDate(dataVencimento))
    .replace(/\{VALOR_PAGO\}/g, formatCurrency(valorPago))
    .replace(/\{SALDO_RESTANTE\}/g, formatCurrency(saldoRestante))
    .replace(/\{DATA\}/g, formatDate(data || dataVencimento));
};

export const gerarTextoExtrato = (emp, cliente, recebimentos) => {
  const recs = recebimentos.filter(r => r.emprestimoId === emp.id).sort((a, b) => new Date(b.dataRecebimento) - new Date(a.dataRecebimento));
  
  let texto = `*EXTRATO DE EMPRÉSTIMO*\n`;
  texto += `----------------------------\n`;
  texto += `*Cliente:* ${cliente.nome}\n`;
  texto += `*Data:* ${formatDate(new Date().toISOString())}\n\n`;
  
  texto += `*DADOS DO CONTRATO*\n`;
  texto += `• Principal: ${formatCurrency(emp.valorPrincipalOriginal || (emp.valorPrincipal + (recs.filter(r => r.tipo === 'regular').reduce((s, r) => s + r.valor, 0))))}\n`;
  texto += `• Saldo Atual: ${formatCurrency(emp.valorPrincipal)}\n`;
  texto += `• Próx. Vencimento: ${formatDate(emp.dataVencimento)}\n`;
  texto += `• Status: ${emp.status === 'atrasado' ? '🔴 EM ATRASO' : '🟢 EM DIA'}\n\n`;

  if (recs.length > 0) {
    texto += `*HISTÓRICO RECENTE*\n`;
    recs.slice(0, 10).forEach(r => {
      const tipoLabel = r.tipo === 'regular' ? 'PAGTO' : r.tipo === 'multa' ? 'MULTA' : r.tipo === 'somente_juros' ? 'JUROS' : 'QUIT.';
      texto += `• ${formatDate(r.dataRecebimento)}: ${formatCurrency(r.valor)} (${tipoLabel})\n`;
    });
    texto += `\n`;
  }

  const juros = recs.filter(r => r.tipo === 'somente_juros' || r.tipo === 'regular').reduce((s, r) => s + r.valor, 0);
  const multasPagos = recs.filter(r => r.tipo === 'multa').reduce((s, r) => s + r.valor, 0);

  texto += `*RESUMO GERAL*\n`;
  texto += `• Total Pago (Capital/Juros): ${formatCurrency(juros)}\n`;
  texto += `• Total Pago (Multas): ${formatCurrency(multasPagos)}\n`;
  
  return texto;
};

export const diasAtraso = (dataVencimento) => {
  const diff = new Date().getTime() - new Date(dataVencimento).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

export const parseSafeDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  
  if (typeof dateVal === 'object' && dateVal !== null && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  
  if (typeof dateVal === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0); // Use mid-day to prevent timezone drift
    }
    
    const isoMatch = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      const hours = parseInt(isoMatch[4], 10);
      const minutes = parseInt(isoMatch[5], 10);
      
      if (hours === 0 && minutes === 0) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
      }
      return new Date(year, month - 1, day, hours, minutes, parseInt(isoMatch[6], 10) || 0, 0);
    }
  }
  
  const parsed = new Date(dateVal);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const isTodayDate = (value) => {
  const date = parseSafeDate(value);
  if (!date) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

export const normalizePhoneBR = (phone) => {
  if (!phone) return "";

  let cleaned = String(phone).replace(/\D/g, "");

  if (!cleaned) return "";

  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`;
  }

  return cleaned;
};

export const buildWhatsAppUrl = (phone, message) => {
  const normalizedPhone = normalizePhoneBR(phone);

  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};

export const buildJurosVencendoHojeMessage = (cliente, emprestimo, config) => {
  const nomeCliente = cliente?.nome || 'Cliente';
  const valor = emprestimo?.valorParcela || 0;
  const data = formatDate(emprestimo?.dataVencimento);
  const nomeEmpresa = config?.global?.nomeEmpresa || config?.nomeEmpresa || 'Meu Jurista Online';

  return `Olá, ${nomeCliente}! Tudo bem?

Passando para lembrar que os juros do seu empréstimo vencem hoje.

Valor em aberto: ${formatCurrency(valor)}
Data de vencimento: ${data}

Para evitar atrasos ou acréscimos, você pode realizar o pagamento ainda hoje.

Atenciosamente,
${nomeEmpresa}`;
};

export const buildExtratoQuitacaoMessage = (cliente, quitacaoInfo, config) => {
  const nomeCliente = cliente?.nome || 'Cliente';
  const nomeEmpresa = config?.global?.nomeEmpresa || config?.nomeEmpresa || 'Meu Jurista Online';

  return `Olá, ${nomeCliente}! Tudo bem?

Segue o resumo atualizado do seu contrato:

Capital / saldo devedor: ${formatCurrency(quitacaoInfo.saldoDevedor)}
Dias em atraso: ${quitacaoInfo.diasAtraso} dias
Multa fixa: ${formatCurrency(quitacaoInfo.multaFixaAplicada)}
Multa percentual: ${formatCurrency(quitacaoInfo.multaPercentualAplicada)}
Juros por atraso: ${formatCurrency(quitacaoInfo.multaDiariaAplicada)}

Total de encargos: ${formatCurrency(quitacaoInfo.totalEncargosAtraso)}
Total para quitação hoje: ${formatCurrency(quitacaoInfo.totalQuitacao)}

Esse valor está atualizado para a data de hoje.

Atenciosamente,
${nomeEmpresa}`;
};
