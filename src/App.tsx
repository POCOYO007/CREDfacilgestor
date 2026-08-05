import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/useAppStore';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, collectionGroup } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

// Layouts
import { AdminLayout, CobradorLayout, ProtectedRoute } from './components/layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import Clientes from './pages/admin/Clientes';
import ClienteDetalhe from './pages/admin/ClienteDetalhe';
import Emprestimos from './pages/admin/Emprestimos';
import EmprestimoDetalhe from './pages/admin/EmprestimoDetalhe';
import Equipe from './pages/admin/Equipe';
import AcertoCobrador from './pages/admin/AcertoCobrador';
import Configuracoes from './pages/admin/Configuracoes';

import CobradorDashboard from './pages/cobrador/CobradorDashboard';
import MinhaRota from './pages/cobrador/MinhaRota';
import MinhasDespesas from './pages/cobrador/MinhasDespesas';
import Calculadora from './pages/cobrador/Calculadora';
import ClientesCobrador from './pages/cobrador/ClientesCobrador';

import MasterDashboard from './pages/master/MasterDashboard';

export default function App() {
  const { setUsuario, tema, ready } = useAppStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // 1. Verificar Coleção Global de Usuários
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUsuario({
              id: fbUser.uid,
              nome: fbUser.displayName || data.email || fbUser.email,
              email: fbUser.email,
              role: data.role,
              tenantId: data.tenantId,
              tenantNome: data.tenantNome
            });
            setInitializing(false);
            return;
          }

          // 2. Fallback: Master Email (configurável via VITE_MASTER_EMAIL, sem doc em users/{uid} ainda)
          const masterEmail = import.meta.env.VITE_MASTER_EMAIL;
          if (masterEmail && fbUser.email === masterEmail) {
            setUsuario({
              id: fbUser.uid,
              nome: fbUser.displayName || 'Master Admin',
              email: fbUser.email,
              role: 'master',
              tenantId: 'empresa-demo'
            });
            setInitializing(false);
            return;
          }

          // 3. Fallback: Busca por adminEmail nos tenants
          try {
            const qTenant = query(collection(db, 'tenants'), where('adminEmail', '==', fbUser.email));
            const snapshotTenant = await getDocs(qTenant);
            
            if (!snapshotTenant.empty) {
              const tenantDoc = snapshotTenant.docs[0];
              const tenantData = tenantDoc.data();
              setUsuario({
                id: fbUser.uid,
                nome: fbUser.displayName || fbUser.email,
                email: fbUser.email,
                role: 'admin',
                tenantId: tenantDoc.id,
                tenantNome: tenantData.nome
              });
              setInitializing(false);
              return;
            }
          } catch (e) {
            console.warn("Erro ao buscar tenant admin:", e.message);
          }

          // 4. Fallback: Busca como cobrador
          try {
            console.log("Buscando vínculo como cobrador para:", fbUser.email);
            // limit(1) é exigido pelas firestore.rules para permitir essa busca
            // cross-tenant (o cliente ainda não sabe o tenantId neste ponto).
            const qCobradorEmail = query(collectionGroup(db, 'cobradores'), where('email', '==', fbUser.email), limit(1));
            const snapshotCobEmail = await getDocs(qCobradorEmail);

            let cobDoc = !snapshotCobEmail.empty ? snapshotCobEmail.docs[0] : null;

            if (!cobDoc) {
              const username = fbUser.email.split('@')[0];
              const qCobradorUser = query(collectionGroup(db, 'cobradores'), where('username', '==', username), limit(1));
              const snapshotCobUser = await getDocs(qCobradorUser);
              if (!snapshotCobUser.empty) cobDoc = snapshotCobUser.docs[0];
            }

            if (cobDoc) {
              const cobData = cobDoc.data();
              const tid = cobDoc.ref.parent.parent?.id;
              console.log("Vínculo de cobrador encontrado no tenant:", tid);

              // Registra o vínculo email -> tenant -> role em users/{uid} para
              // que as próximas leituras (regras isTenantMember) reconheçam
              // este usuário como membro do tenant. Só é possível quando o
              // vínculo foi achado pelo email (as rules exigem que bata com
              // o e-mail autenticado); a via por username fica sem esse
              // registro automático.
              if (cobData.email === fbUser.email && tid) {
                try {
                  await setDoc(doc(db, 'users', fbUser.uid), {
                    email: fbUser.email,
                    tenantId: tid,
                    role: 'cobrador',
                    cobradorId: cobDoc.id
                  });
                } catch (provisionError) {
                  console.warn("Não foi possível registrar users/{uid} do cobrador:", provisionError);
                }
              }

              setUsuario({
                id: fbUser.uid,
                nome: cobData.nome,
                email: fbUser.email,
                role: 'cobrador',
                tenantId: tid,
                cobradorId: cobDoc.id
              });
              setInitializing(false);
              return;
            }
          } catch (err) {
            console.warn("Erro ao buscar via collectionGroup:", err);
          }

          // 5. Fallback final
          setUsuario({
            id: fbUser.uid,
            nome: fbUser.displayName || fbUser.email,
            email: fbUser.email,
            role: 'admin', 
            tenantId: 'empresa-demo'
          });

        } catch (error) {
          console.error("Erro ao buscar vínculo do usuário:", error);
          setUsuario(null);
        }
      } else {
        // Sessão Manual
        const savedSession = localStorage.getItem('credfacil_session');
        if (savedSession) {
          try {
            setUsuario(JSON.parse(savedSession));
          } catch (e) {
            setUsuario(null);
          }
        } else {
          setUsuario(null);
        }
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [setUsuario]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-brand-secondary flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary flex items-center justify-center shadow-xl animate-bounce mb-4">
          <Loader2 className="text-white w-10 h-10 animate-spin" />
        </div>
        <p className="text-text-muted animate-pulse font-medium">Iniciando CredFácil...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#16213E',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
        }}
      />
      
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* MASTER */}
        <Route path="/master" element={
          <ProtectedRoute role="master">
            <MasterDashboard />
          </ProtectedRoute>
        } />

        {/* ADMIN */}
        <Route path="/app" element={
          <ProtectedRoute role="admin">
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:id" element={<ClienteDetalhe />} />
          <Route path="emprestimos" element={<Emprestimos />} />
          <Route path="emprestimos/:id" element={<EmprestimoDetalhe />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="equipe/:id/acerto" element={<AcertoCobrador />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>

        {/* COBRADOR */}
        <Route path="/cobrador" element={
          <ProtectedRoute role="cobrador">
            <CobradorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<CobradorDashboard />} />
          <Route path="rota" element={<MinhaRota />} />
          <Route path="despesas" element={<MinhasDespesas />} />
          <Route path="calculadora" element={<Calculadora />} />
          <Route path="clientes" element={<ClientesCobrador />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
