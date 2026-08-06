import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calcularQuitacaoAtualizada } from '../utils/calculosEmprestimo';

export const gerarContratoPDF = (emprestimo = {}, cliente = {}, config = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Cabeçalho
  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config?.nomeEmpresa || 'Meu Jurista Online', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tel: ${config?.telefone || ''}  |  ${config?.endereco || ''}`, 14, 28);

  // Título do Documento
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE EMPRÉSTIMO', pageWidth / 2, 55, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const empId = emprestimo?.id ? emprestimo.id.substring(0, 8).toUpperCase() : 'S/N';
  doc.text(`Nº do Contrato: #${empId}`, pageWidth / 2, 62, { align: 'center' });

  // Seção: Dados do Cliente
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. DADOS DO CLIENTE', margin, 75);
  doc.line(margin, 77, pageWidth - margin, 77);

  const formatEndereco = (end) => {
    if (!end) return 'Não informado';
    if (typeof end === 'string') return end;
    const parts = [
      end.rua && `${end.rua}${end.numero ? `, ${end.numero}` : ''}`,
      end.bairro,
      end.cidade,
      end.cep
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Não informado';
  };

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nome: ${cliente?.nome || 'Não informado'}`, margin, 85);
  doc.text(`CPF/CNPJ: ${cliente?.cpfCnpj || 'Não informado'}`, margin, 90);
  doc.text(`Endereço: ${formatEndereco(cliente?.endereco)}`, margin, 95);
  doc.text(`Telefone: ${cliente?.telefone || cliente?.whatsapp || 'Não informado'}`, margin, 100);

  // Seção: Detalhes do Empréstimo
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DETALHES DO EMPRÉSTIMO', margin, 115);
  doc.line(margin, 117, pageWidth - margin, 117);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const loanDetails = [
    ['Valor Principal', formatCurrency(emprestimo?.valorPrincipal || emprestimo?.valor || 0)],
    ['Taxa de Juros', `${emprestimo?.taxaJuros || emprestimo?.taxa || 0}% ao período`],
    ['Frequência', (emprestimo?.frequencia || 'semanal').toUpperCase()],
    ['Data de Início', formatDate(emprestimo?.criadoEm || new Date())],
    ['Carência', `${emprestimo?.carenciaDias || 0} dias`],
  ];

  autoTable(doc, {
    startY: 122,
    margin: { left: margin },
    head: [['Descrição', 'Valor']],
    body: loanDetails,
    theme: 'striped',
    headStyles: { fillColor: [255, 107, 0] },
  });

  const finalY = doc.lastAutoTable.finalY + 20;

  // Seção: Termos e Condições
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. TERMOS E CONDIÇÕES', margin, finalY);
  doc.line(margin, finalY + 2, pageWidth - margin, finalY + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const termos = [
    'O MUTUÁRIO declara ter recebido a quantia acima descrita na data de assinatura deste contrato.',
    'O pagamento deverá ser realizado conforme a frequência acordada, sob pena de multa e juros de mora.',
    'Em caso de atraso superior a carência acordada, será aplicada multa conforme as regras vigentes.',
    'Este contrato serve como comprovante de dívida e pode ser utilizado para fins de cobrança judicial e extrajudicial.'
  ];

  let currentY = finalY + 10;
  termos.forEach(termo => {
    const splitText = doc.splitTextToSize(termo, pageWidth - (margin * 2));
    doc.text(splitText, margin, currentY);
    currentY += (splitText.length * 5);
  });

  // Assinaturas
  const signatureY = currentY + 30;
  doc.line(margin, signatureY, margin + 70, signatureY);
  doc.text('Assinatura do Credor', margin + 35, signatureY + 5, { align: 'center' });

  doc.line(pageWidth - margin - 70, signatureY, pageWidth - margin, signatureY);
  doc.text('Assinatura do Mutuário', pageWidth - margin - 35, signatureY + 5, { align: 'center' });

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleString()} - Meu Jurista Online`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  // Salvar
  const finalFilename = (cliente?.nome || 'Cliente').replace(/\s+/g, '_');
  const shortEmpId = emprestimo?.id ? emprestimo.id.substring(0, 8) : 'id';
  doc.save(`Contrato_${finalFilename}_${shortEmpId}.pdf`);
};

export const gerarComprovante = (recebimento = {}, emprestimo = {}, cliente = {}, cobrador = {}, config = {}) => {
  const doc = new jsPDF();

  // Header laranja
  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config?.nomeEmpresa || 'Meu Jurista Online', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tel: ${config?.telefone || ''}  |  ${config?.endereco || ''}`, 14, 28);

  // Título
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE PAGAMENTO', 105, 50, { align: 'center' });

  // Linha separadora
  doc.setDrawColor(255, 107, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 54, 196, 54);

  // Dados
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const tipoLabel = { 
    regular: 'Pagamento Regular', 
    quitacao: 'Quitação Antecipada', 
    somente_juros: 'Pagamento de Juros', 
    multa: 'Pagamento de Multa' 
  };

  const receiptId = recebimento?.id ? recebimento.id.slice(0, 8).toUpperCase() : 'S/N';
  const payDateFormatted = recebimento?.dataRecebimento ? new Date(recebimento.dataRecebimento).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const userTypeLabel = tipoLabel[recebimento?.tipo] || 'Pagamento';
  const recValor = recebimento?.valor || 0;
  const balanceRemaining = emprestimo?.saldoDevedor || emprestimo?.valorPrincipal || 0;

  autoTable(doc, {
    startY: 60,
    head: [],
    body: [
      ['Nº do Recibo', receiptId],
      ['Data do Pagamento', payDateFormatted],
      ['Cliente', cliente?.nome || 'Não informado'],
      ['CPF/CNPJ', cliente?.cpfCnpj || 'Não informado'],
      ['Tipo de Pagamento', userTypeLabel],
      ['Valor Pago', `R$ ${recValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Saldo Devedor Restante', `R$ ${balanceRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Cobrador', cobrador?.nome || 'N/A'],
    ],
    theme: 'grid',
    styles: { fontSize: 11 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [255, 240, 230] } },
  });

  // Rodapé
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Este comprovante é válido como recibo de pagamento.', 105, 280, { align: 'center' });

  doc.save(`recibo-${receiptId}.pdf`);
};

export const gerarExtratoPagamentos = (emprestimo = {}, cliente = {}, recebimentos = [], config = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Cabeçalho
  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config?.nomeEmpresa || 'Meu Jurista Online', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tel: ${config?.telefone || ''}  |  ${config?.endereco || ''}`, 14, 28);

  // Título
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('EXTRATO DETALHADO DO CLIENTE', 105, 50, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const shortEmpId = emprestimo?.id ? emprestimo.id.substring(0, 8).toUpperCase() : 'S/N';
  doc.text(`Referência: #${shortEmpId}`, 105, 56, { align: 'center' });

  // Dados do Cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin, 70);
  doc.line(margin, 71, 80, 71);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${cliente?.nome || 'Não informado'}`, margin, 78);
  doc.text(`CPF/CNPJ: ${cliente?.cpfCnpj || 'Não informado'}`, margin, 83);
  doc.text(`Telefone: ${cliente?.telefone || cliente?.whatsapp || 'Não informado'}`, margin, 88);

  // Status do Contrato
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DO CONTRATO', 120, 70);
  doc.line(120, 71, 196, 71);
  doc.setFont('helvetica', 'normal');
  doc.text(`Capital em Aberto: ${formatCurrency(emprestimo?.valorPrincipal || 0)}`, 120, 78);
  doc.text(`Status: ${emprestimo?.status === 'atrasado' ? 'EM ATRASO' : 'EM DIA'}`, 120, 83);
  doc.text(`Próximo Vencimento: ${formatDate(emprestimo?.dataVencimento)}`, 120, 88);

  // Tabela de Histórico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('HISTÓRICO DE LANÇAMENTOS', margin, 105);

  const safeRecs = Array.isArray(recebimentos) ? recebimentos : [];
  const sortedRecs = [...safeRecs].sort((a, b) => {
    const dataA = a?.dataRecebimento ? new Date(a.dataRecebimento).getTime() : 0;
    const dataB = b?.dataRecebimento ? new Date(b.dataRecebimento).getTime() : 0;
    return dataB - dataA;
  });

  const tableData = sortedRecs.map(rec => [
    formatDate(rec?.dataRecebimento),
    rec?.tipo === 'regular' ? 'Principal/Juros' : rec?.tipo === 'multa' ? 'Multa' : rec?.tipo === 'somente_juros' ? 'Juros Acumulados' : 'Quitação',
    rec?.observacao || '-',
    formatCurrency(rec?.valor || 0)
  ]);

  autoTable(doc, {
    startY: 110,
    head: [['Data', 'Tipo de Lançamento', 'Observação', 'Valor']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [255, 107, 0] },
    columnStyles: {
      3: { halign: 'right' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 15;
  const totalPagos = safeRecs.reduce((s, r) => s + (r?.valor || 0), 0);
  const totalMultas = safeRecs.filter(r => r?.tipo === 'multa').reduce((s, r) => s + (r?.valor || 0), 0);

  // Totais
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RESUMO FINANCEIRO', margin, finalY);
  doc.line(margin, finalY + 1, 80, finalY + 1);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Amortizado + Juros: ${formatCurrency(totalPagos - totalMultas)}`, margin, finalY + 8);
  doc.text(`Total Pago em Multas: ${formatCurrency(totalMultas)}`, margin, finalY + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL GERAL PAGO: ${formatCurrency(totalPagos)}`, margin, finalY + 22);

  // Saldo Final com Resumo para Quitação
  const quitacaoInfo = calcularQuitacaoAtualizada(emprestimo);

  if (quitacaoInfo.estaAtrasado) {
    // Desenha caixa estilizada para o "Resumo para Quitação"
    doc.setFillColor(248, 249, 250);
    doc.rect(105, finalY - 5, 91, 62, 'F');
    doc.setDrawColor(220, 224, 230);
    doc.rect(105, finalY - 5, 91, 62, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 107, 0);
    doc.text('RESUMO PARA QUITAÇÃO HOJE', 110, finalY + 2);
    doc.line(110, finalY + 4, 190, finalY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    
    doc.text(`Capital / saldo devedor:`, 110, finalY + 10);
    doc.text(`${formatCurrency(quitacaoInfo.saldoDevedor)}`, 190, finalY + 10, { align: 'right' });

    doc.text(`Dias em atraso:`, 110, finalY + 15);
    doc.text(`${quitacaoInfo.diasAtraso} dias`, 190, finalY + 15, { align: 'right' });

    doc.text(`Multa fixa:`, 110, finalY + 20);
    doc.text(`${formatCurrency(quitacaoInfo.multaFixaAplicada)}`, 190, finalY + 20, { align: 'right' });

    doc.text(`Multa percentual:`, 110, finalY + 25);
    doc.text(`${formatCurrency(quitacaoInfo.multaPercentualAplicada)}`, 190, finalY + 25, { align: 'right' });

    doc.text(`Juros por atraso:`, 110, finalY + 30);
    doc.text(`${formatCurrency(quitacaoInfo.multaDiariaAplicada)}`, 190, finalY + 30, { align: 'right' });

    doc.line(110, finalY + 34, 190, finalY + 34);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de encargos:`, 110, finalY + 39);
    doc.text(`${formatCurrency(quitacaoInfo.totalEncargosAtraso)}`, 190, finalY + 39, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(255, 107, 0);
    doc.text(`TOTAL PARA QUITAÇÃO HOJE:`, 110, finalY + 48);
    doc.setFontSize(11);
    doc.text(`${formatCurrency(quitacaoInfo.totalQuitacao)}`, 190, finalY + 48, { align: 'right' });
  } else {
    doc.setFontSize(14);
    doc.setTextColor(255, 107, 0);
    doc.text(`VALOR PARA QUITAÇÃO HOJE: ${formatCurrency(quitacaoInfo.totalQuitacao)}`, pageWidth - margin, finalY + 22, { align: 'right' });
  }

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.setFont('helvetica', 'normal');
  doc.text(`Extrato oficial gerado em ${new Date().toLocaleString()} - Meu Jurista Online`, pageWidth / 2, 285, { align: 'center' });

  const safeClientName = (cliente?.nome || 'Cliente').replace(/\s+/g, '_');
  doc.save(`Extrato_${safeClientName}_${new Date().getTime()}.pdf`);
};
