import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, UsersRound, KeyRound, Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { conferenciaDoDia } from '../../domain/conferencia';
import { PageHeader, Card, Badge, Button, Modal, Input, Empty, IconButton } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import { DOMINIO_USUARIO } from '../../lib/firebase';

const usuarioValido = (u) => /^[a-z0-9._-]{3,30}$/.test(u);

export default function Equipe() {
  const cobradores = useAppStore((s) => s.cobradores);
  const recebimentos = useAppStore((s) => s.recebimentos);
  const despesas = useAppStore((s) => s.despesas);
  const editarCobrador = useAppStore((s) => s.editarCobrador);
  const [form, setForm] = useState(null); // { modo: 'novo'|'editar'|'acesso', cob }

  const hoje = useMemo(() => conferenciaDoDia(new Date(), { recebimentos, despesas, cobradores }), [recebimentos, despesas, cobradores]);
  const doDia = (id) => hoje.grupos.find((g) => g.id === id);

  const alternar = async (cob) => {
    try {
      await editarCobrador(cob.id, { ativo: cob.ativo === false });
      toast.success(cob.ativo === false ? 'Cobrador liberado' : 'Cobrador bloqueado — ele perde o acesso na hora');
    } catch (e) { toast.error(e.message); }
  };

  const lista = [...cobradores].sort((a, b) => (a.ativo === false) - (b.ativo === false) || a.nome.localeCompare(b.nome));

  return (
    <div>
      <PageHeader back="/app/mais" title="Equipe" subtitle="Cobradores e acessos" actions={<Button size="sm" onClick={() => setForm({ modo: 'novo' })}><UserPlus className="w-4 h-4" /> Novo</Button>} />

      {lista.length === 0 ? (
        <Card><Empty icon={<UsersRound className="w-6 h-6" />} title="Nenhum cobrador" text="Cadastre o cobrador com usuário e senha para ele entrar no app." action={<Button onClick={() => setForm({ modo: 'novo' })}>Cadastrar cobrador</Button>} /></Card>
      ) : (
        <div className="space-y-2">
          {lista.map((cob) => {
            const dia = doDia(cob.id);
            const temAcesso = !!cob.authUid || !!cob.email;
            return (
              <Card key={cob.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-surface-2 flex items-center justify-center font-bold text-brand-primary shrink-0">{cob.nome?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold truncate">{cob.nome}</p>
                      {cob.ativo === false && <Badge variant="danger">Bloqueado</Badge>}
                    </div>
                    <p className="text-[12px] text-text-secondary truncate">
                      {cob.authUid ? `Usuário: ${cob.username}` : cob.email ? `Google: ${cob.email}` : 'Sem acesso ao app'}
                      {' · '}comissão {cob.comissao || 0}%
                    </p>
                  </div>
                  <IconButton label="Editar" onClick={() => setForm({ modo: 'editar', cob })}><Pencil className="w-4 h-4" /></IconButton>
                </div>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-text-secondary">Hoje: <b className="text-text-primary tabular-nums">{formatCurrency(dia?.total || 0)}</b>{dia?.totalDespesas ? <span className="text-danger"> · desp. {formatCurrency(dia.totalDespesas)}</span> : null}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {!temAcesso ? (
                    <Button variant="primary" size="sm" onClick={() => setForm({ modo: 'acesso', cob })}><KeyRound className="w-4 h-4" /> Criar acesso</Button>
                  ) : (
                    <Link to={`/app/equipe/${cob.id}/acerto`}><Button variant="secondary" size="sm" block>Acerto</Button></Link>
                  )}
                  <Button variant={cob.ativo === false ? 'success' : 'danger-soft'} size="sm" onClick={() => alternar(cob)}>
                    {cob.ativo === false ? <><CheckCircle2 className="w-4 h-4" /> Liberar</> : <><Ban className="w-4 h-4" /> Bloquear</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FormCobrador estado={form} onClose={() => setForm(null)} />
    </div>
  );
}

function FormCobrador({ estado, onClose }) {
  const adicionarCobrador = useAppStore((s) => s.adicionarCobrador);
  const editarCobrador = useAppStore((s) => s.editarCobrador);
  const criarAcessoCobrador = useAppStore((s) => s.criarAcessoCobrador);
  const [f, setF] = useState({});
  const [salvando, setSalvando] = useState(false);
  const modo = estado?.modo;
  const cob = estado?.cob;

  React.useEffect(() => {
    if (!estado) return;
    setF({
      nome: cob?.nome || '',
      username: cob?.username || '',
      email: cob?.email || '',
      senha: '',
      comissao: String(cob?.comissao ?? 5),
    });
  }, [estado]); // eslint-disable-line

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const salvar = async () => {
    const username = (f.username || '').trim().toLowerCase();
    if (modo !== 'acesso' && !f.nome?.trim()) { toast.error('Informe o nome.'); return; }
    if (modo !== 'editar') {
      if (!usuarioValido(username)) { toast.error('Usuário: 3 a 30 letras minúsculas, números, ponto ou traço (sem espaço).'); return; }
      if ((f.senha || '').length < 6) { toast.error('A senha precisa ter pelo menos 6 caracteres.'); return; }
    }
    setSalvando(true);
    try {
      if (modo === 'novo') {
        await adicionarCobrador({ ...f, username });
        toast.success(`Cobrador criado! Login: ${username}`);
      } else if (modo === 'acesso') {
        await criarAcessoCobrador(cob, username, f.senha);
        toast.success(`Acesso criado! Login: ${username}`);
      } else {
        await editarCobrador(cob.id, { nome: f.nome.trim(), email: f.email, comissao: Number(f.comissao) || 0 });
        toast.success('Cobrador atualizado');
      }
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const titulos = { novo: 'Novo cobrador', editar: 'Editar cobrador', acesso: 'Criar acesso ao app' };
  return (
    <Modal
      isOpen={!!estado}
      onClose={onClose}
      title={titulos[modo]}
      subtitle={modo === 'acesso' ? cob?.nome : undefined}
      footer={<Button size="lg" block loading={salvando} onClick={salvar}>Salvar</Button>}
    >
      <div className="space-y-3">
        {modo !== 'acesso' && <Input label="Nome" value={f.nome || ''} onChange={set('nome')} />}
        {modo !== 'editar' && (
          <>
            <Input label="Usuário (para entrar no app)" value={f.username || ''} onChange={set('username')} autoCapitalize="none" autoCorrect="off" hint={`Ele entra digitando só o usuário. (Conta interna: usuário@${DOMINIO_USUARIO})`} />
            <Input label="Senha" type="text" value={f.senha || ''} onChange={set('senha')} hint="Mínimo 6 caracteres. Anote e passe para o cobrador." />
          </>
        )}
        {modo === 'editar' && cob?.authUid && (
          <p className="text-[13px] text-text-secondary rounded-xl bg-brand-surface-2 p-3">
            Login: <b>{cob.username}</b>. Para trocar a senha, cadastre um novo usuário ou redefina pelo Firebase Console (Authentication).
          </p>
        )}
        {modo !== 'acesso' && (
          <>
            <Input label="E-mail Google (opcional)" type="email" value={f.email || ''} onChange={set('email')} hint="Se preencher, ele também pode entrar com o botão Google." />
            <Input label="Comissão" type="number" min="0" step="0.5" prefix="%" value={f.comissao || ''} onChange={set('comissao')} />
          </>
        )}
      </div>
    </Modal>
  );
}
