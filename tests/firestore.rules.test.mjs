// Testes das regras de segurança do Firestore.
// Rode com:  npm run test:rules   (precisa de Java instalado; usa o emulador do Firebase)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, collection, collectionGroup, query, where, limit, getDocs, writeBatch,
} from 'firebase/firestore';

let env;
const T = 'empresa1';
const OUTRA = 'empresa2';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-credfacil',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `tenants/${T}`), { nome: 'Empresa 1', adminEmail: 'gestor@gmail.com', plano: 'Pro', status: 'ativo', vencimento: '2027-01-01' });
    await setDoc(doc(db, `tenants/${OUTRA}`), { nome: 'Empresa 2', adminEmail: 'outro@gmail.com', plano: 'Pro', status: 'ativo', vencimento: '2027-01-01' });
    await setDoc(doc(db, `tenants/${T}/cobradores/cob1`), { nome: 'Carlos', username: 'carlos', authUid: 'uidCarlos', ativo: true });
    await setDoc(doc(db, `tenants/${T}/cobradores/cob2`), { nome: 'Ana', username: 'ana', authUid: 'uidAna', ativo: false });
    await setDoc(doc(db, `tenants/${T}/cobradores/cob3`), { nome: 'Zé', email: 'ze@gmail.com', ativo: true });
    await setDoc(doc(db, 'users/uidCarlos'), { role: 'cobrador', tenantId: T, cobradorId: 'cob1', email: 'carlos@credfacil.app' });
    await setDoc(doc(db, 'users/uidAna'), { role: 'cobrador', tenantId: T, cobradorId: 'cob2', email: 'ana@credfacil.app' });
    await setDoc(doc(db, `tenants/${T}/clientes/cli1`), { nome: 'João', criadoEm: '2026-01-01' });
    await setDoc(doc(db, `tenants/${T}/emprestimos/emp1`), {
      clienteId: 'cli1', valorPrincipal: 1000, saldoDevedor: 1000, status: 'ativo', criadoEm: '2026-01-01', cobradorId: 'cob1',
    });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const como = (uid, token = {}) => env.authenticatedContext(uid, token).firestore();
const gestor = () => como('uidGestor', { email: 'gestor@gmail.com', email_verified: true });
const carlos = () => como('uidCarlos', { email: 'carlos@credfacil.app', email_verified: false });

test('sem login NÃO lê cobradores (antes vazava o hash das senhas)', async () => {
  await assertFails(getDocs(query(collectionGroup(anon(), 'cobradores'), where('username', '==', 'carlos'), limit(1))));
});

test('logado NÃO lista empresas dos outros', async () => {
  await assertFails(getDocs(query(collection(como('qualquer', { email: 'x@gmail.com', email_verified: true }), 'tenants'), limit(1))));
});

test('gestor com e-mail verificado acessa a própria empresa', async () => {
  await assertSucceeds(getDocs(collection(gestor(), `tenants/${T}/clientes`)));
  await assertSucceeds(getDocs(query(collection(gestor(), 'tenants'), where('adminEmail', '==', 'gestor@gmail.com'), limit(1))));
});

test('e-mail do gestor NÃO verificado não vira admin (conta criada por terceiro)', async () => {
  const falso = como('golpista', { email: 'gestor@gmail.com', email_verified: false });
  await assertFails(getDocs(collection(falso, `tenants/${T}/clientes`)));
});

test('gestor NÃO acessa outra empresa', async () => {
  await assertFails(getDocs(collection(gestor(), `tenants/${OUTRA}/clientes`)));
});

test('cobrador ativo lê os dados da empresa; bloqueado não', async () => {
  await assertSucceeds(getDocs(collection(carlos(), `tenants/${T}/clientes`)));
  await assertFails(getDocs(collection(como('uidAna', { email: 'ana@credfacil.app' }), `tenants/${T}/clientes`)));
});

test('cobrador acha o próprio cadastro pelo uid, mas não o dos outros', async () => {
  await assertSucceeds(getDocs(query(collectionGroup(como('uidCarlos'), 'cobradores'), where('authUid', '==', 'uidCarlos'), limit(1))));
  await assertFails(getDocs(query(collectionGroup(como('uidCarlos'), 'cobradores'), where('authUid', '==', 'uidAna'), limit(1))));
});

test('auto-cadastro em users/: só se o cobrador estiver amarrado a este login', async () => {
  const novo = como('uidNovo');
  await assertFails(setDoc(doc(novo, 'users/uidNovo'), { role: 'cobrador', tenantId: T, cobradorId: 'cob1', email: 'x' }));
  const ze = como('uidZe', { email: 'ze@gmail.com', email_verified: true });
  await assertSucceeds(setDoc(doc(ze, 'users/uidZe'), { role: 'cobrador', tenantId: T, cobradorId: 'cob3', email: 'ze@gmail.com' }));
  const zeFalso = como('uidZe2', { email: 'ze@gmail.com', email_verified: false });
  await assertFails(setDoc(doc(zeFalso, 'users/uidZe2'), { role: 'cobrador', tenantId: T, cobradorId: 'cob3', email: 'ze@gmail.com' }));
  await assertFails(setDoc(doc(ze, 'users/uidZe'), { role: 'admin', tenantId: T, cobradorId: 'cob3', email: 'ze@gmail.com' }));
});

test('cobrador NÃO zera dívida mexendo só no contrato', async () => {
  await assertFails(updateDoc(doc(carlos(), `tenants/${T}/emprestimos/emp1`), { valorPrincipal: 0, saldoDevedor: 0, status: 'pago' }));
});

test('cobrador registra pagamento (recebimento + contrato juntos)', async () => {
  const db = carlos();
  const b = writeBatch(db);
  b.set(doc(db, `tenants/${T}/recebimentos/rec1`), { emprestimoId: 'emp1', valor: 300, tipo: 'regular', cobradorId: 'cob1', criadoEm: '2026-11-22' });
  b.update(doc(db, `tenants/${T}/emprestimos/emp1`), { valorPrincipal: 700, saldoDevedor: 700, ultimoRecebimentoId: 'rec1' });
  await assertSucceeds(b.commit());
});

test('cobrador NÃO abate mais do que recebeu', async () => {
  const db = carlos();
  const b = writeBatch(db);
  b.set(doc(db, `tenants/${T}/recebimentos/rec2`), { emprestimoId: 'emp1', valor: 10, tipo: 'regular', cobradorId: 'cob1', criadoEm: '2026-11-22' });
  b.update(doc(db, `tenants/${T}/emprestimos/emp1`), { valorPrincipal: 0, saldoDevedor: 0, status: 'pago', ultimoRecebimentoId: 'rec2' });
  await assertFails(b.commit());
});

test('cobrador NÃO lança recebimento em nome de outro cobrador', async () => {
  await assertFails(setDoc(doc(carlos(), `tenants/${T}/recebimentos/rec3`), { emprestimoId: 'emp1', valor: 50, tipo: 'regular', cobradorId: 'cob3', criadoEm: '2026-11-22' }));
});

test('cobrador NÃO lança repasse/comissão para si', async () => {
  await assertFails(setDoc(doc(carlos(), `tenants/${T}/pagamentosCobradores/p1`), { cobradorId: 'cob1', valor: 500, periodo: 'x', criadoEm: '2026-11-22' }));
});

test('cobrador lança despesa própria pendente; não pode já aprovar', async () => {
  const base = { valor: 30, descricao: 'Gasolina', data: '2026-11-22', criadoEm: '2026-11-22', cobradorId: 'cob1' };
  await assertSucceeds(setDoc(doc(carlos(), `tenants/${T}/despesas/d1`), { ...base, aprovada: null }));
  await assertFails(setDoc(doc(carlos(), `tenants/${T}/despesas/d2`), { ...base, aprovada: true }));
});

test('gestor edita contrato livremente', async () => {
  await assertSucceeds(updateDoc(doc(gestor(), `tenants/${T}/emprestimos/emp1`), { tipoMulta: 'parcela_fixa', valorMulta: 20, versaoRegra: 2 }));
});

test('sem login não lê nada', async () => {
  await assertFails(getDoc(doc(anon(), `tenants/${T}/emprestimos/emp1`)));
});
