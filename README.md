# Arquitetura da Dança

Plataforma web responsiva, pensada primeiro para o celular, do estúdio de dança: alunos matriculados reveem em vídeo os passos ensinados pelos professores (por ritmo e módulo), acompanham eventos e participam da comunidade. A grade de horários e a divulgação de eventos ficam abertas ao público. A equipe gerencia alunos, turmas, períodos contratados e consentimentos de contato num painel, que substitui a planilha atual. O M0 entrega a base: banco, autenticação da equipe, painel inicial, backups e operação em produção.

## Requisitos

- Node.js 26 (`.nvmrc`)
- pnpm 10.28.0 (campo `packageManager` do `package.json`)
- PostgreSQL 17: via `docker compose` (`docker-compose.yml`) ou uma instalação local

## Como rodar localmente

```bash
pnpm install
docker compose up -d postgres        # Postgres 17 em localhost:5432 (ou use um Postgres local)
cp .env.example .env.local           # preencha os valores (veja abaixo)
pnpm db:migrar                       # aplica as migrações (lê .env.local)
pnpm equipe:criar --nome "Nome" --email "email@exemplo.com" --papel administracao
pnpm dev                             # http://localhost:3000
```

Variáveis de `.env.local` (nunca versione valores reais):

- `DATABASE_URL`: com o `docker-compose.yml`, `postgres://dev:dev@localhost:5432/arquitetura_dev`.
- `BETTER_AUTH_SECRET`: mínimo de 32 caracteres (`openssl rand -base64 32`).
- `BETTER_AUTH_URL`: `http://localhost:3000`.
- `DATABASE_URL_TESTE_ADMIN`: superusuário do Postgres, usado só pelos testes de integração para criar e remover bancos temporários (ex.: `postgres://dev:dev@localhost:5432/postgres`).
- `PROXIES_CONFIAVEIS`: opcional, deixe vazia.

O `pnpm equipe:criar` pede a senha no terminal (não a passe como argumento; mínimo de 12 caracteres). O papel aceito é `administracao` ou `atendente`. Depois, entre em `http://localhost:3000/entrar`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção do Next.js |
| `pnpm lint` | Verificação com Biome |
| `pnpm tipos` | Checagem de tipos (`tsc --noEmit`) |
| `pnpm teste` | Testes de unidade |
| `pnpm teste:integracao` | Testes de integração (precisam de `DATABASE_URL_TESTE_ADMIN`) |
| `pnpm db:gerar` | Gera uma migração a partir do esquema (`--name <nome>`) |
| `pnpm db:migrar` | Aplica as migrações no banco de `DATABASE_URL` |
| `pnpm build:scripts` | Empacota os scripts em `dist/` (usados em produção) |
| `pnpm equipe:criar` | Cria um membro da equipe (`--nome`, `--email`, `--papel`) |
| `pnpm backup:verificar -- <url>` | Verifica um banco restaurado de backup |

Em produção, as migrações rodam sozinhas quando o contêiner inicia (`scripts/iniciar.sh` executa `node dist/migrar.js` e depois o servidor); não há comando de pré-deploy no Coolify.

## Estrutura

- `src/app/`: telas e rotas do Next.js (`entrar`, `painel`, `sem-acesso`, `api`).
- `src/servidor/`: código de servidor (`banco`, `auth`, `equipe`, `pessoas`, ambiente e saúde).
- `drizzle/`: migrações SQL. `scripts/`: migração, criação da equipe, verificação de restauração.
- `tests/`: apoio e testes de integração. `docs/`: design e operação.

## Documentação

- [Design visual](docs/design.md)
- [Servidor: VPS, Coolify, ambientes e monitoramento](docs/operacao/servidor.md)
- [Backups e restauração verificada](docs/operacao/backup.md)
- [Design do MVP e marcos](docs/superpowers/specs/2026-11-20-mvp-marcos-design.md)
- [Plano do M0](docs/superpowers/plans/2026-11-20-m0-base.md)

## Fechamento do M0 em produção

Feito pelo dono do projeto, depois do primeiro deploy.

Primeira administradora (terminal do contêiner no Coolify, ou `docker exec -it <contêiner> sh`; o comando pede a senha de forma interativa):

```bash
node dist/criar-membro-equipe.js --nome "Nome" --email "email@exemplo.com" --papel administracao
```

Critérios de pronto:

- [ ] `curl -sS https://<domínio>/api/saude` responde `{"status":"ok","banco":"ok"}`.
- [ ] A administradora entra em `https://<domínio>/entrar` e chega ao `/painel`.
- [ ] A integração contínua do último commit da `main` passou, incluindo a migração do zero (`tests/integracao/migracoes.test.ts`).
- [ ] A restauração está registrada como verificada na tabela de `docs/operacao/backup.md`. Comando: `./scripts/restaurar-backup.sh ultimo.dmp postgres://usuario:senha@localhost:5432/restauracao`, com resultado `Restauração verificada: nenhum problema encontrado.`
- [ ] O monitoramento externo mostra a produção no ar e um alerta de teste chegou por e-mail (pause a aplicação no Coolify por alguns minutos, confira o e-mail e reative).

A checklist final completa da infraestrutura está em `docs/operacao/servidor.md`.
