# Arquitetura da Dança

Plataforma web do estúdio: vídeos dos passos, eventos e comunidade.

- Design do MVP: `docs/superpowers/specs/2026-11-20-mvp-marcos-design.md`
- Plano do M0: `docs/superpowers/plans/2026-11-20-m0-base.md`

## Como rodar

Requisitos: Node.js 26 (`.nvmrc`) e pnpm.

```bash
pnpm install
cp .env.example .env.local   # preencha os valores
pnpm dev                     # http://localhost:3000
```

Verificações: `pnpm lint`, `pnpm tipos`, `pnpm teste` e `pnpm build`.
