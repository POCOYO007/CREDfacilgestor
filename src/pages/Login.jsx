import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signInWithEmailAndPassword, signInWithRedirect, signInWithPopup, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { Scale, Lock, User, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { auth, emailDoUsuario } from '../lib/firebase';
import { Button, Input } from '../components/ui';

const DESTINO = { master: '/master', admin: '/app', cobrador: '/cobrador' };

const mensagemLogin = (code) => ({
  'auth/invalid-email': 'Usuário ou e-mail inválido.',
  'auth/user-not-found': 'Usuário ou senha incorretos.',
  'auth/wrong-password': 'Usuário ou senha incorretos.',
  'auth/invalid-credential': 'Usuário ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem internet. Verifique a conexão.',
  'auth/user-disabled': 'Este acesso foi desativado.',
}[code] || 'Não foi possível entrar. Tente de novo.');

export default function Login() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const usuario = useAppStore((s) => s.usuarioAtual);
  const tema = useAppStore((s) => s.tema);
  const toggleTema = useAppStore((s) => s.toggleTema);
  const navigate = useNavigate();

  useEffect(() => {
    if (usuario && DESTINO[usuario.role]) navigate(DESTINO[usuario.role], { replace: true });
  }, [usuario, navigate]);

  // Volta do login Google por redirecionamento (fallback quando o popup é bloqueado).
  useEffect(() => {
    getRedirectResult(auth).catch((e) => toast.error(`Erro ao entrar com Google: ${e.code || e.message}`));
  }, []);

  const entrar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, emailDoUsuario(login), senha);
    } catch (error) {
      toast.error(mensagemLogin(error.code));
      setLoading(false);
    }
  };

  const entrarGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const popupFalhou = ['auth/popup-blocked', 'auth/missing-initial-state', 'auth/web-storage-unsupported', 'auth/operation-not-supported-in-this-environment'].includes(error.code);
      if (popupFalhou && !standalone) {
        await signInWithRedirect(auth, provider).catch((e) => toast.error(`Erro ao entrar com Google: ${e.code}`));
        return;
      }
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        toast.error(`Erro ao entrar com Google: ${error.code || error.message}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-brand-secondary">
      <div className="flex justify-end p-4">
        <button onClick={toggleTema} aria-label="Trocar tema" className="w-10 h-10 rounded-full bg-brand-surface border border-border-subtle flex items-center justify-center text-text-secondary">
          {tema === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary flex items-center justify-center shadow-xl shadow-brand-primary/30 mb-4">
              <Scale className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Meu Jurista Online</h1>
            <p className="text-text-secondary text-sm mt-1">Gestão de crédito e cobrança</p>
          </div>

          <form onSubmit={entrar} className="space-y-3">
            <Input
              label="Usuário ou e-mail"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              icon={<User className="w-[18px] h-[18px]" />}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              icon={<Lock className="w-[18px] h-[18px]" />}
              autoComplete="current-password"
              required
            />
            <Button type="submit" size="lg" block loading={loading} className="mt-2">Entrar</Button>
          </form>

          <div className="flex items-center gap-3 my-5 text-[12px] text-text-muted font-semibold">
            <div className="h-px flex-1 bg-border-subtle" /> ou <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <Button variant="outline" size="lg" block onClick={entrarGoogle} disabled={loading}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Entrar com Google
          </Button>
        </div>
      </div>
    </div>
  );
}
