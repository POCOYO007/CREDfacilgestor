import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { formatCurrency, isTodayDate } from '../../utils/formatters';
import { UsersRound, UserPlus, Shield, ShieldAlert, Edit, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { hashSenha } from '../../utils/crypto';

export default function Equipe() {
  const { cobradores, adicionarCobrador, editarCobrador, recebimentos, emprestimos } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCobrador, setEditingCobrador] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    email: '',
    senha: '',
    comissao: '5',
  });

  const handleOpenModal = (cob = null) => {
    if (cob) {
      setEditingCobrador(cob);
      setFormData({
        nome: cob.nome,
        username: cob.username,
        email: cob.email || '',
        senha: '', // nunca pré-preencher: campo vazio = manter senha atual (já hasheada)
        comissao: cob.comissao.toString(),
      });
    } else {
      setEditingCobrador(null);
      setFormData({ nome: '', username: '', email: '', senha: '', comissao: '5' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { senha, ...rest } = formData;
    const dados = { ...rest, comissao: parseFloat(formData.comissao) };

    if (editingCobrador) {
      // Campo em branco = manter a senha (já hasheada) que está salva
      if (senha) dados.senha = await hashSenha(senha);
      editarCobrador(editingCobrador.id, dados);
      toast.success('Cobrador atualizado!');
    } else {
      dados.senha = await hashSenha(senha);
      adicionarCobrador(dados);
      toast.success('Cobrador cadastrado!');
    }
    setIsModalOpen(false);
  };

  const toggleStatus = (cob) => {
    editarCobrador(cob.id, { ativo: !cob.ativo });
    toast.success(`Cobrador ${cob.ativo ? 'bloqueado' : 'ativado'}!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipe</h2>
          <p className="text-sm text-text-secondary">Gerencie seus cobradores e comissões.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 w-full sm:w-auto justify-center">
          <UserPlus size={20} />
          Novo Cobrador
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cobradores.map(cob => {
          const recsHoje = recebimentos.filter(r => {
            const e = emprestimos.find(emp => emp.id === r.emprestimoId);
            const pertenceCobrador = (r.cobradorId && r.cobradorId === cob.id) || (e && e.cobradorId === cob.id);
            return pertenceCobrador && (isTodayDate(r.dataRecebimento) || isTodayDate(r.criadoEm));
          });
            
          const coletadoHoje = recsHoje.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
          const multasHoje = recsHoje.filter(r => r.tipo === 'multa').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);

          return (
            <Card key={cob.id} className="flex flex-col p-4 sm:p-5">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-surface-2 border border-border-subtle flex items-center justify-center font-bold text-brand-primary text-lg sm:text-xl shrink-0">
                    {cob.nome.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-base sm:text-lg leading-tight truncate">{cob.nome}</h4>
                    <p className="text-xs text-text-muted truncate">@{cob.username}</p>
                  </div>
                </div>
                <Badge variant={cob.ativo ? "success" : "danger"} className="shrink-0 text-[10px]">
                  {cob.ativo ? "ATIVO" : "BLOQUEADO"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-text-primary/5 min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold truncate">Comissão</p>
                  <p className="text-base sm:text-lg font-bold font-mono truncate">{cob.comissao}%</p>
                </div>
                <div className="p-3 rounded-xl bg-text-primary/5 border border-success/20 min-w-0">
                  <p className="text-[10px] text-text-muted uppercase font-bold text-success/80 truncate">Coletado Hoje</p>
                  <p className="text-base sm:text-lg font-bold text-success font-mono truncate">{formatCurrency(coletadoHoje)}</p>
                  {multasHoje > 0 && (
                    <p className="text-[9px] text-success/60 font-bold uppercase mt-1 truncate">
                      Inc. {formatCurrency(multasHoje)} multas
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-border-subtle grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/app/equipe/${cob.id}/acerto`)} className="gap-2 justify-center text-xs sm:text-sm py-2">
                  <Wallet size={15} />
                  Acerto
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 justify-center py-2" onClick={() => handleOpenModal(cob)}>
                    <Edit size={15} />
                  </Button>
                  <Button variant={cob.ativo ? "danger" : "primary"} size="sm" className="flex-1 justify-center py-2" onClick={() => toggleStatus(cob)}>
                    {cob.ativo ? <ShieldAlert size={15} /> : <Shield size={15} />}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCobrador ? "Editar Cobrador" : "Novo Cobrador"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingCobrador ? "Salvar Alterações" : "Cadastrar Cobrador"}</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 mb-4">
            <p className="text-xs text-brand-primary font-bold uppercase mb-2 flex items-center gap-2">
              <Shield size={14} />
              Segurança e Acesso
            </p>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              O cobrador pode entrar de duas formas:
              <br />• <b>Google:</b> Basta informar o Gmail abaixo.
              <br />• <b>Usuário/Senha:</b> Informe os campos de Usuário e Senha.
            </p>
          </div>

          <Input
            label="Nome Completo"
            placeholder="Ex: Carlos Silva"
            value={formData.nome}
            onChange={e => setFormData({ ...formData, nome: e.target.value })}
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Usuário (Login)"
              placeholder="carlos.silva"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              required
            />
            <Input
              label="Comissão (%)"
              type="number"
              value={formData.comissao}
              onChange={e => setFormData({ ...formData, comissao: e.target.value })}
              required
            />
          </div>

          <Input
            label="E-mail (Para Login com Google)"
            type="email"
            placeholder="carlos@gmail.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label={editingCobrador ? "Nova Senha (opcional)" : "Senha (Para Login Direto)"}
            type="password"
            placeholder={editingCobrador ? "Deixe em branco para manter a atual" : "••••••••"}
            value={formData.senha}
            onChange={e => setFormData({ ...formData, senha: e.target.value })}
            required={!editingCobrador}
          />
        </form>
      </Modal>
    </div>
  );
}
