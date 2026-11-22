import { create } from 'zustand';
import { db, auth, criarLoginCobrador, emailDoUsuario } from '../lib/firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, writeBatch, deleteField,
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { fotografarContrato } from '../domain/pagamento';

const BATCH_LIMIT = 450; // abaixo do limite de 500 operações por batch

const CONFIG_PADRAO = {
  nomeEmpresa: 'Meu Jurista Online',
  telefone: '',
  endereco: '',
  taxaPadrao: 10,
  frequenciaPadrao: 'mensal',
  carenciaPadrao: 3,
  multaPercentualPadrao: 2,
  tipoMultaPadrao: 'parcela_percentual',
  valorMultaPadrao: 10,
  templateCobranca: 'Olá {CLIENTE}, sua parcela de {VALOR} vence em {DATA_VENCIMENTO}.',
  templateRecibo: 'Recebemos seu pagamento de {VALOR_PAGO}. Saldo restante: {SALDO_RESTANTE}.',
  templateLembrete: 'Lembrete: sua parcela de {VALOR} vence amanhã, {DATA_VENCIMENTO}.',
};

const DADOS_VAZIOS = {
  clientes: [],
  emprestimos: [],
  recebimentos: [],
  cobradores: [],
  despesas: [],
  pagamentosCobradores: [],
};

const temaSalvo = () => {
  try { return localStorage.getItem('credfacil_tema') || 'light'; } catch { return 'light'; }
};

const agora = () => new Date().toISOString();

async function apagarEmLotes(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export const useAppStore = create((set, get) => {
  const caminho = (col) => `tenants/${get().tenantId}/${col}`;

  /** Executa uma gravação e transforma erro do Firestore em mensagem amigável. */
  const gravar = async (op, path, fn) => {
    try {
      return await fn();
    } catch (e) {
      handleFirestoreError(e, op, path);
    }
  };

  return {
    // ---------- sessão ----------
    usuarioAtual: null,
    tenantId: null,
    tema: temaSalvo(),
    ready: false,
    carregado: {}, // coleções que já chegaram pelo menos 1 vez
    erroSync: null,

    ...DADOS_VAZIOS,
    globalTenants: [],
    config: CONFIG_PADRAO,

    unsubscribers: [],
    globalUnsubscribers: [],

    setUsuario: (usuario) => {
      set({ usuarioAtual: usuario });
      if (usuario?.tenantId) {
        if (usuario.role === 'master') get().initGlobalSync();
        get().initSync(usuario.tenantId);
      } else if (usuario?.role === 'master') {
        get().initGlobalSync();
      } else {
        get().stopSync();
      }
    },

    logout: async () => {
      try { await auth.signOut(); } catch (e) { console.error('Logout error', e); }
      try { localStorage.removeItem('credfacil_session'); } catch { /* sessão antiga */ }
      get().stopSync();
      set({ usuarioAtual: null });
    },

    toggleTema: () => set((s) => {
      const tema = s.tema === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('credfacil_tema', tema); } catch { /* ignore */ }
      return { tema };
    }),

    // ---------- sincronização ----------
    initSync: (tenantId) => {
      get().unsubscribers.forEach((u) => u());
      set({ ...DADOS_VAZIOS, carregado: {}, erroSync: null });

      const colecoes = Object.keys(DADOS_VAZIOS);
      const unsubs = colecoes.map((col) => onSnapshot(
        collection(db, `tenants/${tenantId}/${col}`),
        (snap) => set((s) => ({
          [col]: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          carregado: { ...s.carregado, [col]: true },
        })),
        (error) => {
          console.error('[sync]', col, error?.code, error?.message);
          set({ erroSync: error?.code === 'permission-denied' ? 'sem-permissao' : 'erro' });
        },
      ));

      const configUnsub = onSnapshot(
        doc(db, `tenants/${tenantId}/config/global`),
        (d) => set({ config: d.exists() ? { ...CONFIG_PADRAO, ...d.data() } : CONFIG_PADRAO }),
        (error) => console.error('[sync] config', error?.code),
      );

      set({ unsubscribers: [...unsubs, configUnsub], ready: true, tenantId });
    },

    stopSync: () => {
      get().unsubscribers.forEach((u) => u());
      get().globalUnsubscribers.forEach((u) => u());
      set({
        unsubscribers: [], globalUnsubscribers: [], ready: false, tenantId: null,
        globalTenants: [], carregado: {}, erroSync: null, ...DADOS_VAZIOS, config: CONFIG_PADRAO,
      });
    },

    initGlobalSync: () => {
      if (get().globalUnsubscribers.length > 0) return;
      const unsub = onSnapshot(
        collection(db, 'tenants'),
        (snap) => set({ globalTenants: snap.docs.map((d) => ({ ...d.data(), id: d.id })) }),
        (error) => console.error('[sync] tenants', error?.code),
      );
      set({ globalUnsubscribers: [unsub] });
    },

    // ---------- master ----------
    adicionarTenant: (id, tenant) => gravar(OperationType.CREATE, `tenants/${id}`, () =>
      setDoc(doc(db, 'tenants', id), { ...tenant, criadoEm: agora() })),

    editarTenant: (id, dados) => gravar(OperationType.UPDATE, `tenants/${id}`, () =>
      updateDoc(doc(db, 'tenants', id), dados)),

    // ---------- clientes ----------
    adicionarCliente: (cliente) => gravar(OperationType.CREATE, caminho('clientes'), async () => {
      const ref = await addDoc(collection(db, caminho('clientes')), {
        ...cliente, tenantId: get().tenantId, criadoEm: agora(),
      });
      return ref.id;
    }),

    editarCliente: (id, dados) => gravar(OperationType.UPDATE, caminho(`clientes/${id}`), () => {
      const { nome, cpfCnpj, telefone, whatsapp, endereco } = dados;
      return updateDoc(doc(db, caminho(`clientes/${id}`)), { nome, cpfCnpj: cpfCnpj || '', telefone: telefone || '', whatsapp: whatsapp || '', endereco: endereco || {} });
    }),

    removerCliente: (id) => gravar(OperationType.DELETE, caminho(`clientes/${id}`), () => {
      const { emprestimos, recebimentos } = get();
      const empIds = emprestimos.filter((e) => e.clienteId === id).map((e) => e.id);
      const recIds = recebimentos.filter((r) => r.clienteId === id || empIds.includes(r.emprestimoId)).map((r) => r.id);
      return apagarEmLotes([
        ...recIds.map((rid) => doc(db, caminho(`recebimentos/${rid}`))),
        ...empIds.map((eid) => doc(db, caminho(`emprestimos/${eid}`))),
        doc(db, caminho(`clientes/${id}`)),
      ]);
    }),

    // ---------- contratos ----------
    adicionarEmprestimo: (emp) => gravar(OperationType.CREATE, caminho('emprestimos'), async () => {
      const ref = await addDoc(collection(db, caminho('emprestimos')), {
        ...emp, tenantId: get().tenantId, criadoEm: agora(),
      });
      return ref.id;
    }),

    /** "Editar contrato" do gestor. `dados` já vem calculado pela tela. */
    editarEmprestimo: (id, dados) => gravar(OperationType.UPDATE, caminho(`emprestimos/${id}`), () => {
      const { id: _ignorado, ...limpo } = dados;
      return updateDoc(doc(db, caminho(`emprestimos/${id}`)), { ...limpo, editadoEm: agora() });
    }),

    removerEmprestimo: (id) => gravar(OperationType.DELETE, caminho(`emprestimos/${id}`), () => {
      const recIds = get().recebimentos.filter((r) => r.emprestimoId === id).map((r) => r.id);
      return apagarEmLotes([
        ...recIds.map((rid) => doc(db, caminho(`recebimentos/${rid}`))),
        doc(db, caminho(`emprestimos/${id}`)),
      ]);
    }),

    // ---------- pagamentos ----------
    /**
     * Grava o recebimento e a atualização do contrato numa ÚNICA operação
     * atômica (ou grava os dois, ou nenhum).
     * @param emp       contrato antes do pagamento
     * @param simulacao resultado de simularPagamento()
     * @param dadosRec  { tipo, valor, dataRecebimento, observacao, cobradorId, opcaoParcial }
     */
    registrarPagamento: (emp, simulacao, dadosRec) => gravar(OperationType.WRITE, caminho('recebimentos'), async () => {
      const { tenantId } = get();
      const recRef = doc(collection(db, caminho('recebimentos')));
      const recebimento = {
        emprestimoId: emp.id,
        clienteId: emp.clienteId,
        tipo: dadosRec.tipo,
        valor: dadosRec.valor,
        cobradorId: dadosRec.cobradorId || '',
        dataRecebimento: dadosRec.dataRecebimento,
        observacao: dadosRec.observacao || '',
        opcaoParcial: dadosRec.opcaoParcial || null,
        composicao: simulacao.composicao,
        desconto: simulacao.desconto || 0,
        estadoAnterior: fotografarContrato(emp),
        registradoPor: get().usuarioAtual?.id || '',
        tenantId,
        criadoEm: agora(),
      };
      const batch = writeBatch(db);
      batch.set(recRef, recebimento);
      batch.update(doc(db, caminho(`emprestimos/${emp.id}`)), {
        ...simulacao.novosDados,
        ultimoRecebimentoId: recRef.id,
      });
      await batch.commit();
      return { id: recRef.id, ...recebimento };
    }),

    /**
     * Exclui um recebimento. Se for o ÚLTIMO pagamento do contrato e tiver o
     * retrato do contrato de antes, volta o contrato exatamente como estava.
     * Devolve 'restaurado' | 'so-apagado'.
     */
    removerRecebimento: (rec) => gravar(OperationType.DELETE, caminho(`recebimentos/${rec.id}`), async () => {
      const emp = get().emprestimos.find((e) => e.id === rec.emprestimoId);
      const batch = writeBatch(db);
      batch.delete(doc(db, caminho(`recebimentos/${rec.id}`)));
      let resultado = 'so-apagado';
      if (emp && rec.estadoAnterior && emp.ultimoRecebimentoId === rec.id) {
        const restaurar = {};
        Object.entries(rec.estadoAnterior).forEach(([k, v]) => { restaurar[k] = v === null ? deleteField() : v; });
        batch.update(doc(db, caminho(`emprestimos/${emp.id}`)), restaurar);
        resultado = 'restaurado';
      }
      await batch.commit();
      return resultado;
    }),

    // ---------- equipe ----------
    /** Cria cobrador + login (usuário/senha) dele. */
    adicionarCobrador: ({ nome, username, email, senha, comissao }) => gravar(OperationType.CREATE, caminho('cobradores'), async () => {
      const usuario = String(username || '').trim().toLowerCase();
      const authUid = senha ? await criarLoginCobrador(usuario, senha) : '';
      await addDoc(collection(db, caminho('cobradores')), {
        nome: nome.trim(),
        username: usuario,
        loginEmail: authUid ? emailDoUsuario(usuario) : '',
        email: (email || '').trim().toLowerCase(),
        authUid,
        comissao: Number(comissao) || 0,
        ativo: true,
        tenantId: get().tenantId,
        criadoEm: agora(),
      });
    }),

    /** Cria o login para um cobrador antigo (que usava a senha salva no banco). */
    criarAcessoCobrador: (cob, username, senha) => gravar(OperationType.UPDATE, caminho(`cobradores/${cob.id}`), async () => {
      const usuario = String(username || '').trim().toLowerCase();
      const authUid = await criarLoginCobrador(usuario, senha);
      await updateDoc(doc(db, caminho(`cobradores/${cob.id}`)), {
        authUid, username: usuario, loginEmail: emailDoUsuario(usuario), senha: deleteField(),
      });
    }),

    editarCobrador: (id, dados) => gravar(OperationType.UPDATE, caminho(`cobradores/${id}`), () => {
      const { id: _ignorado, senha: _senha, authUid: _uid, ...limpo } = dados;
      if (typeof limpo.email === 'string') limpo.email = limpo.email.trim().toLowerCase();
      return updateDoc(doc(db, caminho(`cobradores/${id}`)), limpo);
    }),

    /** Remove o hash de senha antigo que ficava salvo no documento do cobrador. */
    limparSenhasLegadas: async () => {
      const comSenha = get().cobradores.filter((c) => c.senha);
      if (!comSenha.length) return;
      const batch = writeBatch(db);
      comSenha.forEach((c) => batch.update(doc(db, caminho(`cobradores/${c.id}`)), { senha: deleteField() }));
      await batch.commit().catch((e) => console.warn('limparSenhasLegadas', e?.code));
    },

    // ---------- despesas / repasses / config ----------
    adicionarDespesa: (desp) => gravar(OperationType.CREATE, caminho('despesas'), () =>
      addDoc(collection(db, caminho('despesas')), { ...desp, tenantId: get().tenantId, criadoEm: agora() })),

    editarDespesa: (id, dados) => gravar(OperationType.UPDATE, caminho(`despesas/${id}`), () =>
      updateDoc(doc(db, caminho(`despesas/${id}`)), dados)),

    adicionarPagamentoCobrador: (pag) => gravar(OperationType.CREATE, caminho('pagamentosCobradores'), () =>
      addDoc(collection(db, caminho('pagamentosCobradores')), { ...pag, tenantId: get().tenantId, criadoEm: agora() })),

    atualizarConfig: (dados) => gravar(OperationType.UPDATE, caminho('config/global'), () =>
      setDoc(doc(db, caminho('config/global')), dados, { merge: true })),
  };
});
