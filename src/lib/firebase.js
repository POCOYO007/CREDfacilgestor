import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// Em dev local usa o token de debug do App Check (registre-o no Console na 1ª vez).
if (import.meta.env.DEV) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

function ligarAppCheck(app) {
  if (!recaptchaSiteKey) return;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const app = initializeApp(firebaseConfig);
ligarAppCheck(app);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

/** Domínio usado para os logins por "usuário" dos cobradores (ex.: carlos → carlos@credfacil.app). */
export const DOMINIO_USUARIO = 'credfacil.app';
export const emailDoUsuario = (usuario) => {
  const u = String(usuario || '').trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${DOMINIO_USUARIO}`;
};

/**
 * Cria o login (usuário + senha) de um cobrador SEM deslogar o gestor:
 * usa uma segunda instância do Firebase só para isso.
 * Devolve o uid da conta criada.
 */
export async function criarLoginCobrador(usuario, senha) {
  const nome = 'criador-de-contas';
  const secundario = getApps().some((a) => a.name === nome) ? getApp(nome) : initializeApp(firebaseConfig, nome);
  if (!secundario._appCheckLigado) {
    try { ligarAppCheck(secundario); } catch { /* já ligado */ }
    secundario._appCheckLigado = true;
  }
  const authSec = getAuth(secundario);
  try {
    const cred = await createUserWithEmailAndPassword(authSec, emailDoUsuario(usuario), senha);
    return cred.user.uid;
  } catch (e) {
    const msgs = {
      'auth/email-already-in-use': 'Esse usuário já existe. Escolha outro nome de usuário.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/invalid-email': 'Usuário inválido. Use só letras, números, ponto ou traço.',
      'auth/operation-not-allowed': 'Ative o login por E-mail/Senha no Firebase Console (Authentication > Sign-in method).',
    };
    throw new Error(msgs[e.code] || `Não foi possível criar o acesso (${e.code || e.message}).`);
  } finally {
    await signOut(authSec).catch(() => {});
  }
}
