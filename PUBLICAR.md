# Como publicar a versão 2.0

> **Importante:** o app novo e as regras novas do banco precisam ir pro ar **juntos**.
> Publique o código primeiro (passo 1) e, assim que a Vercel terminar o deploy, publique as regras (passo 3).
> O app antigo não funciona com as regras novas, e o app novo não funciona com as regras antigas.

## 1. Subir o código (GitHub → Vercel)
Suba esta pasta no repositório `POCOYO007/CREDfacilgestor`, branch `main`. A Vercel publica sozinha.

## 2. Firebase — Authentication
Entre no Firebase com a conta dona do projeto (**contasteamsiri@gmail.com**) → projeto **MEUJURISTAcredfacil**.

- **Authentication → Método de login**: deixe **E-mail/senha** e **Google** ativados.

## 3. Firebase — Regras do banco
- **Firestore Database** → selecione o banco `ai-studio-996ed5a6-63ec-4220-b0bd-e1c5c0da8c24`
- Aba **Regras** → apague tudo → cole o conteúdo do arquivo `firestore.rules` → **Publicar**.

## 4. Firebase — Índices (login dos cobradores)
Firestore → **Índices** → aba **Isenções de campo único** → **Adicionar isenção**:

| Coleção | Campo | Escopo | Ordem |
|---|---|---|---|
| `cobradores` | `authUid` | Grupo de coleções | Crescente |
| `cobradores` | `email` | Grupo de coleções | Crescente |

(Se esquecer, o primeiro login de cobrador dá erro no console do navegador com um link para criar o índice.)

## 5. Conferir os gestores
Firestore → coleção `tenants` → em cada empresa, o campo `adminEmail` precisa ser o e-mail Google do gestor, **todo em minúsculas**.

## 6. Cobradores antigos
O login antigo de cobrador (usuário + senha salva no banco) nunca funcionou com as regras do banco. Agora:
- O gestor entra em **Mais → Equipe** e clica **Criar acesso** em cada cobrador (define usuário e senha).
- O cobrador entra digitando só o **usuário** e a **senha**.
- Cobradores que entram com **Google** (campo e-mail preenchido) continuam funcionando sem fazer nada.

## Testes
```bash
npm test          # cálculos de pagamento, multa e parcial (28 cenários)
npm run test:rules  # regras do banco no emulador (precisa de Java)
```
