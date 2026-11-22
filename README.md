# Meu Jurista / CredFácil — gestão de empréstimos e cobrança

App web (PWA, mobile first) para gestor e cobradores. React + Vite + Firebase (Auth + Firestore), publicado na Vercel.

## Estrutura
- `src/domain/` — **regras de negócio** (cálculo de juros, multa, pagamento parcial, conferência). Funções puras, com testes.
- `src/store/` — estado + gravações no Firestore (pagamento é gravado de forma atômica).
- `src/components/` — kit visual (`ui/`), layout e componentes de negócio (receber pagamento, novo empréstimo, editar contrato).
- `src/pages/admin` (gestor), `src/pages/cobrador`, `src/pages/master`.
- `firestore.rules` — regras de segurança. `tests/` — testes das regras.

## Rodar
```bash
npm install
npm run dev
npm test
```

Para publicar, veja **PUBLICAR.md**.
