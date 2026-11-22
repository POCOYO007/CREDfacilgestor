import { auth } from './firebase';

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

/** Traduz o erro do Firestore para uma mensagem que a tela pode mostrar. */
export function mensagemDeErro(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Sem permissão para essa ação. Se o problema continuar, fale com o gestor.';
  if (code.includes('unavailable')) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (code.includes('failed-precondition')) return 'Operação bloqueada pelo banco (índice ou pré-condição).';
  return error?.message || 'Erro inesperado.';
}

/** Loga com contexto (para depuração) e lança um Error com mensagem amigável. */
export function handleFirestoreError(error, operationType, path) {
  console.error('[firestore]', operationType, path, {
    code: error?.code,
    message: error?.message,
    uid: auth.currentUser?.uid,
  });
  const e = new Error(mensagemDeErro(error));
  e.code = error?.code;
  throw e;
}
