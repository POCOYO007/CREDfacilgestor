import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  setDoc,
  serverTimestamp,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { calcularStatus } from '../utils/calculosEmprestimo';

const BATCH_LIMIT = 450; // margem abaixo do limite de 500 ops por batch do Firestore

async function deleteRefsInBatches(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

export const useAppStore = create((set, get) => ({
  // Auth
  usuarioAtual: null,
  tenantId: 'empresa-demo', // Fallback ou extraído do usuário
  tema: 'dark',
  ready: false,

  // Dados
  clientes: [],
  emprestimos: [],
  recebimentos: [],
  cobradores: [],
  despesas: [],
  pagamentosCobradores: [],
  globalTenants: [],
  config: {
    nomeEmpresa: 'CredFácil Demo',
    telefone: '(11) 99999-9999',
    endereco: 'Rua das Finanças, 123',
    taxaPadrao: 10,
    frequenciaPadrao: 'semanal',
    carenciaPadrao: 3,
    multaPercentualPadrao: 2,
    templateCobranca: 'Olá {CLIENTE}, sua parcela de {VALOR} vence em {DATA_VENCIMENTO}.',
    templateRecibo: 'Recebemos seu pagamento de {VALOR_PAGO}. Saldo restante: {SALDO_RESTANTE}.',
    templateLembrete: 'Lembrete: sua parcela de {VALOR} vence amanhã, {DATA_VENCIMENTO}.',
  },

  // Listeners
  unsubscribers: [],
  globalUnsubscribers: [],

  // Actions
  setUsuario: (usuario) => {
    set({ usuarioAtual: usuario });
    if (usuario) {
      if (usuario.managed) {
        localStorage.setItem('credfacil_session', JSON.stringify(usuario));
      } else {
        localStorage.removeItem('credfacil_session');
      }
      
      if (usuario.role === 'master') {
        get().initGlobalSync();
      }
      get().initSync(usuario.tenantId || 'empresa-demo');
    } else {
      localStorage.removeItem('credfacil_session');
      get().stopSync();
    }
  },
  
  logout: async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.error("Logout error", e);
    }
    localStorage.removeItem('credfacil_session');
    get().stopSync();
    set({ usuarioAtual: null, ready: false });
  },

  toggleTema: () => set((s) => ({ tema: s.tema === 'dark' ? 'light' : 'dark' })),

  initSync: (tenantId) => {
    // Para apenas os unsubscribers de tenant anteriores
    get().unsubscribers.forEach(unsub => unsub());
    
    const paths = ['clientes', 'emprestimos', 'recebimentos', 'cobradores', 'despesas', 'pagamentosCobradores'];
    const unsubs = paths.map(path => {
      const q = collection(db, `tenants/${tenantId}/${path}`);
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        set({ [path]: data });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/${path}`);
      });
    });

    // Config global do tenant
    const configUnsub = onSnapshot(doc(db, `tenants/${tenantId}/config/global`), (doc) => {
      if (doc.exists()) {
        set({ config: doc.data() });
      }
    });

    set({ unsubscribers: [...unsubs, configUnsub], ready: true, tenantId });
  },

  stopSync: () => {
    get().unsubscribers.forEach(unsub => unsub());
    get().globalUnsubscribers.forEach(unsub => unsub());
    set({ 
      unsubscribers: [], 
      globalUnsubscribers: [], 
      ready: false, 
      globalTenants: [],
      clientes: [],
      emprestimos: [],
      recebimentos: [],
      cobradores: [],
      despesas: [],
      pagamentosCobradores: [],
      config: {
        nomeEmpresa: 'CredFácil Demo',
        telefone: '(11) 99999-9999',
        endereco: 'Rua das Finanças, 123',
        taxaPadrao: 10,
        frequenciaPadrao: 'semanal',
        carenciaPadrao: 3,
        multaPercentualPadrao: 2,
        templateCobranca: 'Olá {CLIENTE}, sua parcela de {VALOR} vence em {DATA_VENCIMENTO}.',
        templateRecibo: 'Recebemos seu pagamento de {VALOR_PAGO}. Saldo restante: {SALDO_RESTANTE}.',
        templateLembrete: 'Lembrete: sua parcela de {VALOR} vence amanhã, {DATA_VENCIMENTO}.',
      }
    });
  },

  initGlobalSync: () => {
    // Evitar duplicidade
    if (get().globalUnsubscribers.length > 0) return;

    const q = collection(db, 'tenants');
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      set({ globalTenants: data });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tenants');
    });
    set((s) => ({ globalUnsubscribers: [unsub] }));
  },

  adicionarTenant: async (id, tenant) => {
    const path = `tenants/${id}`;
    try {
      await setDoc(doc(db, 'tenants', id), {
        ...tenant,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `tenants/${id}`);
    }
  },

  editarTenant: async (id, dados) => {
    const path = `tenants/${id}`;
    try {
      await updateDoc(doc(db, path), dados);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  adicionarCliente: async (cliente) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/clientes`;
    try {
      await addDoc(collection(db, path), {
        ...cliente,
        tenantId,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  editarCliente: async (id, dados) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/clientes/${id}`;
    try {
      await updateDoc(doc(db, path), dados);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  removerCliente: async (id) => {
    const { tenantId, emprestimos, recebimentos } = get();
    try {
      const empIds = emprestimos.filter(e => e.clienteId === id).map(e => e.id);
      const recIds = recebimentos.filter(r => r.clienteId === id).map(r => r.id);

      const refs = [
        doc(db, `tenants/${tenantId}/clientes/${id}`),
        ...empIds.map(eid => doc(db, `tenants/${tenantId}/emprestimos/${eid}`)),
        ...recIds.map(rid => doc(db, `tenants/${tenantId}/recebimentos/${rid}`)),
      ];

      await deleteRefsInBatches(refs);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tenants/${tenantId}/clientes/${id}`);
    }
  },

  adicionarEmprestimo: async (emp) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/emprestimos`;
    try {
      await addDoc(collection(db, path), {
        ...emp,
        tenantId,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  editarEmprestimo: async (id, dados) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/emprestimos/${id}`;
    try {
      await updateDoc(doc(db, path), dados);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  removerEmprestimo: async (id) => {
    const { tenantId, recebimentos } = get();
    try {
      const recIds = recebimentos.filter(r => r.emprestimoId === id).map(r => r.id);

      const refs = [
        doc(db, `tenants/${tenantId}/emprestimos/${id}`),
        ...recIds.map(rid => doc(db, `tenants/${tenantId}/recebimentos/${rid}`)),
      ];

      await deleteRefsInBatches(refs);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tenants/${tenantId}/emprestimos/${id}`);
    }
  },

  adicionarRecebimento: async (rec) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/recebimentos`;
    try {
      await addDoc(collection(db, path), {
        ...rec,
        tenantId,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  removerRecebimento: async (id) => {
    const { tenantId, recebimentos, emprestimos } = get();
    try {
      const recebimento = recebimentos.find(r => r.id === id);
      if (!recebimento) return;

      await deleteDoc(doc(db, `tenants/${tenantId}/recebimentos/${id}`));

      const e = emprestimos.find(emp => emp.id === recebimento.emprestimoId);
      if (e) {
        let emprestimoAtualizado = { ...e };

        if (e.modalidade === 'parcelado') {
          const valP = parseFloat(e.valorParcela) || 0;
          const totalP = parseInt(e.totalParcelas) || 10;
          const numParcRec = valP > 0 ? Math.max(1, Math.round((recebimento.valor || 0) / valP)) : 1;
          const novasPagas = Math.max(0, (parseInt(e.parcelasPagas) || 0) - numParcRec);
          const novoValorPrincipal = Math.max(0, (totalP - novasPagas) * valP);

          emprestimoAtualizado.parcelasPagas = novasPagas;
          emprestimoAtualizado.valorPrincipal = novoValorPrincipal;
          emprestimoAtualizado.saldoDevedor = novoValorPrincipal;
        } else {
          const novoValorPrincipal = (e.valorPrincipal || 0) + (recebimento.valor || 0);
          emprestimoAtualizado.valorPrincipal = novoValorPrincipal;
          emprestimoAtualizado.saldoDevedor = novoValorPrincipal;
        }

        emprestimoAtualizado.status = calcularStatus(emprestimoAtualizado);
        
        await updateDoc(doc(db, `tenants/${tenantId}/emprestimos/${e.id}`), {
          valorPrincipal: emprestimoAtualizado.valorPrincipal,
          saldoDevedor: emprestimoAtualizado.saldoDevedor,
          parcelasPagas: emprestimoAtualizado.parcelasPagas ?? e.parcelasPagas ?? 0,
          status: emprestimoAtualizado.status
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tenants/${tenantId}/recebimentos/${id}`);
    }
  },

  adicionarCobrador: async (cob) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/cobradores`;
    try {
      await addDoc(collection(db, path), {
        ...cob,
        tenantId,
        ativo: true,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  editarCobrador: async (id, dados) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/cobradores/${id}`;
    try {
      await updateDoc(doc(db, path), dados);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  adicionarDespesa: async (desp) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/despesas`;
    try {
      await addDoc(collection(db, path), {
        ...desp,
        tenantId,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },
  
  editarDespesa: async (id, dados) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/despesas/${id}`;
    try {
      await updateDoc(doc(db, path), dados);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  adicionarPagamentoCobrador: async (pag) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/pagamentosCobradores`;
    try {
      await addDoc(collection(db, path), {
        ...pag,
        tenantId,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  atualizarConfig: async (dados) => {
    const { tenantId } = get();
    const path = `tenants/${tenantId}/config/global`;
    try {
      await setDoc(doc(db, path), dados, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },
}));
