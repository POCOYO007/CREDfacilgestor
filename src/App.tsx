import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, collectionGroup, query, where, limit, getDocs } from 'firebase/firestore';
import { useAppStore } from './store/useAppStore';
import { auth, db } from './lib/firebase';
import { AdminLayout, CobradorLayout, ProtectedRoute, TelaCarregando, SemAcesso } from './components/layout';
import Login from './pages/Login';

// Cada área carrega só quando é usada (app mais leve no celular do cobrador).
const Painel = lazy(() => import('./pages/admin/Painel'));
const Conferencia = lazy(() => import('./pages/admin/Conferencia'));
const Clientes = lazy(() => import('./pages/admin/Clientes'));
const ClienteDetalhe = lazy(() => import('./pages/admin/ClienteDetalhe'));
const Emprestimos = lazy(() => import('./pages/admin/Emprestimos'));
const Alugueis = lazy(() => import('./pages/admin/Alugueis'));
const EmprestimoDetalhe = lazy(() => import('./pages/admin/EmprestimoDetalhe'));
const Equipe = lazy(() => import('./pages/admin/Equipe'));
const AcertoCobrador = lazy(() => import('./pages/admin/AcertoCobrador'));
const Configuracoes = lazy(() => import('./pages/admin/Configuracoes'));
const Mais = lazy(() => import('./pages/admin/Mais'));

const Rota = lazy(() => import('./pages/cobrador/Rota'));
const MeuDia = lazy(() => import('./pages/cobrador/MeuDia'));
const MinhasDespesas = lazy(() => import('./pages/cobrador/MinhasDespesas'));
const Calculadora = lazy(() => import('./pages/cobrador/Calculadora'));
const ClientesCobrador = lazy(() => import('./pages/cobrador/ClientesCobrador'));
const ContratoCobrador = lazy(() => import('./pages/cobrador/ContratoCobrador'));

const MasterDashboard = lazy(() => import('./pages/master/MasterDashboard'));

type Usuario = {
  id: string; nome: string; email: string | null; role: string;
  tenantId?: string; tenantNome?: string; cobradorId?: string;
};

/** Descobre quem é o usuário logado e a que empresa ele pertence. */
async function resolverUsuario(fbUser: User): Promise<Usuario | null> {
  const base = { id: fbUser.uid, email: fbUser.email };

  // 1. Vínculo já registrado
  const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
  if (userDoc.exists()) {
    const d = userDoc.data();
    let nome = fbUser.displayName || d.email || fbUser.email || '';
    if (d.role === 'cobrador' && d.tenantId && d.cobradorId) {
      const cob = await getDoc(doc(db, `tenants/${d.tenantId}/cobradores/${d.cobradorId}`)).catch(() => null);
      if (cob?.exists()) {
        if (cob.data().ativo === false) return { ...base, nome, role: 'bloqueado' };
        nome = cob.data().nome || nome;
      }
    }
    return { ...base, nome, role: d.role, tenantId: d.tenantId, tenantNome: d.tenantNome, cobradorId: d.cobradorId };
  }

  // 2. Primeiro acesso do master (configurado na Vercel)
  const masterEmail = import.meta.env.VITE_MASTER_EMAIL;
  if (masterEmail && fbUser.emailVerified && fbUser.email === masterEmail) {
    return { ...base, nome: fbUser.displayName || 'Master', role: 'master' };
  }

  // 3. Gestor de uma empresa (e-mail verificado = adminEmail da empresa)
  if (fbUser.email && fbUser.emailVerified) {
    try {
      const snap = await getDocs(query(collection(db, 'tenants'), where('adminEmail', '==', fbUser.email), limit(1)));
      if (!snap.empty) {
        const t = snap.docs[0];
        return { ...base, nome: fbUser.displayName || fbUser.email, role: 'admin', tenantId: t.id, tenantNome: t.data().nome };
      }
    } catch (e: any) {
      console.warn('[login] busca de empresa:', e?.code);
    }
  }

  // 4. Cobrador: pelo login criado pelo gestor (uid) ou pelo Google (e-mail verificado)
  const buscas = [query(collectionGroup(db, 'cobradores'), where('authUid', '==', fbUser.uid), limit(1))];
  if (fbUser.email && fbUser.emailVerified) {
    buscas.push(query(collectionGroup(db, 'cobradores'), where('email', '==', fbUser.email), limit(1)));
  }
  for (const q of buscas) {
    try {
      const snap = await getDocs(q);
      if (snap.empty) continue;
      const cobDoc = snap.docs[0];
      const cob = cobDoc.data();
      const tenantId = cobDoc.ref.parent.parent?.id;
      if (!tenantId) continue;
      if (cob.ativo === false) return { ...base, nome: cob.nome, role: 'bloqueado' };
      // Registra o vínculo para as regras de segurança reconhecerem este login.
      await setDoc(doc(db, 'users', fbUser.uid), {
        email: fbUser.email, tenantId, role: 'cobrador', cobradorId: cobDoc.id,
      });
      return { ...base, nome: cob.nome, role: 'cobrador', tenantId, cobradorId: cobDoc.id };
    } catch (e: any) {
      console.warn('[login] busca de cobrador:', e?.code, e?.message);
    }
  }

  // 5. Ninguém cadastrou esse login
  return { ...base, nome: fbUser.displayName || fbUser.email || '', role: 'sem-acesso' };
}

export default function App() {
  const setUsuario = useAppStore((s) => s.setUsuario);
  const usuario = useAppStore((s) => s.usuarioAtual);
  const tema = useAppStore((s) => s.tema);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // limpa a sessão "manual" antiga, que não funcionava com as regras do banco
    try { localStorage.removeItem('credfacil_session'); } catch { /* ignore */ }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUsuario(null);
        setInitializing(false);
        return;
      }
      try {
        setUsuario(await resolverUsuario(fbUser));
      } catch (error) {
        console.error('Erro ao identificar o usuário:', error);
        setUsuario({ id: fbUser.uid, nome: fbUser.email || '', email: fbUser.email, role: 'sem-acesso' });
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, [setUsuario]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#0B0B0C' : '#FFFFFF');
  }, [tema]);

  if (initializing) return <TelaCarregando />;
  if (usuario && (usuario.role === 'sem-acesso' || usuario.role === 'bloqueado')) {
    return <SemAcesso bloqueado={usuario.role === 'bloqueado'} email={usuario.email} />;
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: { background: 'var(--text-primary)', color: 'var(--brand-surface)', borderRadius: '12px', fontWeight: 600 },
        }}
      />
      <Suspense fallback={<TelaCarregando />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/master" element={<ProtectedRoute role="master"><MasterDashboard /></ProtectedRoute>} />

          <Route path="/app" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Painel />} />
            <Route path="conferencia" element={<Conferencia />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalhe />} />
            <Route path="emprestimos" element={<Emprestimos />} />
            <Route path="emprestimos/:id" element={<EmprestimoDetalhe />} />
            <Route path="alugueis" element={<Alugueis />} />
            <Route path="alugueis/:id" element={<EmprestimoDetalhe />} />
            <Route path="equipe" element={<Equipe />} />
            <Route path="equipe/:id/acerto" element={<AcertoCobrador />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="mais" element={<Mais />} />
          </Route>

          <Route path="/cobrador" element={<ProtectedRoute role="cobrador"><CobradorLayout /></ProtectedRoute>}>
            <Route index element={<Rota />} />
            <Route path="rota" element={<Navigate to="/cobrador" replace />} />
            <Route path="contrato/:id" element={<ContratoCobrador />} />
            <Route path="dia" element={<MeuDia />} />
            <Route path="despesas" element={<MinhasDespesas />} />
            <Route path="calculadora" element={<Calculadora />} />
            <Route path="clientes" element={<ClientesCobrador />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
