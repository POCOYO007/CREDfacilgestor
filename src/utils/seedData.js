export const seedDemoData = (store) => {
  const state = store.getState();
  if (state.clientes.length > 0) return;

  const cobradores = [
    { id: 'cob-1', nome: 'Carlos Silva', username: 'carlos', senha: '123', comissao: 5, ativo: true, criadoEm: new Date().toISOString() },
    { id: 'cob-2', nome: 'Ana Souza', username: 'ana', senha: '123', comissao: 4, ativo: true, criadoEm: new Date().toISOString() },
  ];

  const clientes = [
    { id: 'cli-1', nome: 'João Pereira', cpfCnpj: '123.456.789-00', telefone: '(11) 98765-4321', whatsapp: '11987654321', endereco: { rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', cep: '01000-000' }, criadoEm: new Date().toISOString() },
    { id: 'cli-2', nome: 'Maria Oliveira', cpfCnpj: '987.654.321-00', telefone: '(11) 91234-5678', whatsapp: '11912345678', endereco: { rua: 'Av B', numero: '200', bairro: 'Vila Nova', cidade: 'São Paulo', cep: '02000-000' }, criadoEm: new Date().toISOString() },
    { id: 'cli-3', nome: 'Pedro Santos', cpfCnpj: '111.222.333-44', telefone: '(11) 94444-5555', whatsapp: '11944445555', endereco: { rua: 'Rua C', numero: '5', bairro: 'Jardim', cidade: 'São Paulo', cep: '03000-000' }, criadoEm: new Date().toISOString() },
  ];

  const hoje = new Date();
  const semanaPassada = new Date(hoje); semanaPassada.setDate(hoje.getDate() - 7);
  const mesPassado = new Date(hoje); mesPassado.setDate(hoje.getDate() - 30);

  const emprestimos = [
    { id: 'emp-1', clienteId: 'cli-1', valorPrincipal: 1000, taxaJuros: 10, frequencia: 'semanal', totalParcelas: 10, parcelasPagas: 3, valorParcela: 150, saldoDevedor: 700, status: 'ativo', carenciaDias: 3, multaFixa: 0, multaPercentual: 2, cobradorId: 'cob-1', dataInicio: semanaPassada.toISOString(), dataVencimento: new Date(hoje.getTime() + 7 * 86400000).toISOString(), criadoEm: new Date().toISOString() },
    { id: 'emp-2', clienteId: 'cli-2', valorPrincipal: 2000, taxaJuros: 8, frequencia: 'mensal', totalParcelas: 6, parcelasPagas: 1, valorParcela: 400, saldoDevedor: 1800, status: 'atrasado', carenciaDias: 5, multaFixa: 20, multaPercentual: 0, cobradorId: 'cob-2', dataInicio: mesPassado.toISOString(), dataVencimento: new Date(hoje.getTime() - 5 * 86400000).toISOString(), criadoEm: new Date().toISOString() },
    { id: 'emp-3', clienteId: 'cli-3', valorPrincipal: 500, taxaJuros: 12, frequencia: 'quinzenal', totalParcelas: 4, parcelasPagas: 4, valorParcela: 155, saldoDevedor: 0, status: 'pago', carenciaDias: 2, multaFixa: 0, multaPercentual: 0, cobradorId: 'cob-1', dataInicio: mesPassado.toISOString(), dataVencimento: hoje.toISOString(), criadoEm: new Date().toISOString() },
  ];

  const recebimentos = [
    { id: 'rec-1', emprestimoId: 'emp-1', clienteId: 'cli-1', tipo: 'regular', valor: 150, cobradorId: 'cob-1', dataRecebimento: semanaPassada.toISOString(), observacao: '', criadoEm: new Date().toISOString() },
    { id: 'rec-2', emprestimoId: 'emp-1', clienteId: 'cli-1', tipo: 'regular', valor: 150, cobradorId: 'cob-1', dataRecebimento: new Date(semanaPassada.getTime() + 7 * 86400000).toISOString(), observacao: '', criadoEm: new Date().toISOString() },
    { id: 'rec-3', emprestimoId: 'emp-2', clienteId: 'cli-2', tipo: 'regular', valor: 400, cobradorId: 'cob-2', dataRecebimento: mesPassado.toISOString(), observacao: 'Primeira parcela', criadoEm: new Date().toISOString() },
  ];

  store.setState({
    cobradores,
    clientes,
    emprestimos,
    recebimentos,
  });
};
