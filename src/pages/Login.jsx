import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { auth, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider
} from 'firebase/auth';
import { collectionGroup, query, where, limit, getDocs } from 'firebase/firestore';
import { Button, Input, Card } from '../components/ui';
import { Scale, Lock, User, Loader2, Sun, Moon, Github } from 'lucide-react';
import toast from 'react-hot-toast';
import { hashSenha } from '../utils/crypto';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const usuarioAtual = useAppStore(state => state.usuarioAtual);
  const setUsuario = useAppStore(state => state.setUsuario);
  const tema = useAppStore(state => state.tema);
  const toggleTema = useAppStore(state => state.toggleTema);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (usuarioAtual) {
      if (usuarioAtual.role === 'master') navigate('/master');
      else if (usuarioAtual.role === 'admin') navigate('/app');
      else navigate('/cobrador');
    }
  }, [usuarioAtual, navigate]);

  // Resultado do signInWithRedirect: a página recarrega inteira depois do
  // Google, então precisamos captar o resultado (ou erro) aqui em vez de no
  // handler original do clique — esse já se foi junto com o navigate.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log('[auth] verificando getRedirectResult()...');
        const result = await getRedirectResult(auth);
        console.log('[auth] getRedirectResult retornou:', result ? result.user?.email : null);
        if (result && !cancelled) {
          toast.success('Bem-vindo!');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[auth] erro no getRedirectResult:', error);
          toast.error(`Erro ao entrar com Google: ${error.code || error.message}`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // App instalado (ícone na tela de início) roda em modo standalone. Nesse
  // modo, signInWithRedirect ejeta a navegação pro navegador comum e o
  // ícone nunca recebe o resultado de volta — por isso usamos popup aqui,
  // que abre uma aba vinculada ao próprio app e preserva essa ligação. Em
  // aba de navegador normal continuamos com redirect (popup falha no
  // Safari/Chrome mobile por particionamento de sessionStorage).
  const isStandalonePWA = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginEmail = email.includes('@') ? email : `${email}@credfacil.app`;
      try {
        await signInWithEmailAndPassword(auth, loginEmail, senha);
        toast.success('Login realizado com sucesso!');
      } catch (authError) {
        // Se falhar o login padrão, tentamos o login manual gerenciado
        const senhaHash = await hashSenha(senha);
        const q = query(collectionGroup(db, 'cobradores'), where('username', '==', email), where('senha', '==', senhaHash), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const cobDoc = snapshot.docs[0];
          const cobData = cobDoc.data();
          const tenantId = cobDoc.ref.parent.parent?.id;
          
          setUsuario({
            id: cobDoc.id,
            nome: cobData.nome,
            email: cobData.email || `${cobData.username}@credfacil.app`,
            role: 'cobrador',
            tenantId: tenantId,
            cobradorId: cobDoc.id,
            managed: true // Flag para persistência local
          });
          toast.success('Login realizado com sucesso!');
          return;
        }
        
        throw authError; // Se nem manual funcionou, joga o erro original
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/invalid-email') {
        toast.error('Formato de e-mail inválido.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        toast.error('Usuário ou senha incorretos.');
      } else {
        toast.error('Erro ao entrar. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      if (isStandalonePWA()) {
        console.log('[auth] modo standalone (PWA instalado) — usando signInWithPopup');
        const result = await signInWithPopup(auth, provider);
        console.log('[auth] signInWithPopup resolveu:', result?.user?.email);
        toast.success('Bem-vindo!');
      } else {
        console.log('[auth] navegador normal — usando signInWithRedirect');
        await signInWithRedirect(auth, provider);
        // A página navega pro Google aqui — o resultado é tratado no
        // useEffect com getRedirectResult() quando o usuário voltar.
      }
    } catch (error) {
      console.error('[auth] erro no login com Google:', error);
      toast.error(`Erro ao entrar com Google: ${error.code || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-secondary p-4 relative overflow-hidden">
      {/* Theme Toggle */}
      <button 
        onClick={toggleTema}
        className="absolute top-6 right-6 p-3 rounded-full glass hover:bg-brand-surface-2 transition-all z-50 text-text-secondary hover:text-text-primary"
      >
        {tema === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/10 blur-[120px] rounded-full" />

      <Card className="w-full max-w-md p-10 relative z-10 shadow-2xl">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-brand-accent to-brand-primary flex items-center justify-center shadow-2xl shadow-brand-primary/30 mb-6 transform hover:rotate-6 transition-transform duration-300">
            <Scale className="text-white w-11 h-11" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-text-primary text-center leading-tight">Meu Jurista Online</h1>
          <p className="text-text-secondary mt-3 font-medium">Gestão inteligente de crédito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <Input
            label="E-mail ou Usuário"
            placeholder="admin@demo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            icon={<User size={20} className="text-brand-primary/60" />}
            inputClassName="h-14"
            required
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            icon={<Lock size={20} className="text-brand-primary/60" />}
            inputClassName="h-14"
            required
          />

          <Button type="submit" className="w-full h-14 text-xl font-bold mt-4 shadow-brand-primary/40" disabled={loading}>
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Entrar na conta'}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-brand-surface-1 px-2 text-text-muted">Ou continue com</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="ghost" 
            onClick={handleGoogleLogin} 
            className="w-full h-14 text-lg font-medium border border-border-subtle hover:bg-brand-surface-2"
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Google
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border-subtle text-center">
          <p className="text-xs text-text-muted">
            © 2026 Meu Jurista Online. Todos os direitos reservados.
          </p>
        </div>
      </Card>
    </div>
  );
}
