# Arquitetura da Dança

Plataforma web responsiva, pensada primeiro para o celular, do estúdio de dança: alunos matriculados reveem em vídeo os passos ensinados pelos professores (por ritmo e módulo), acompanham eventos e participam da comunidade. A grade de horários e a divulgação de eventos ficam abertas ao público. A equipe gerencia alunos, turmas, períodos contratados e consentimentos de contato num painel, que substitui a planilha atual. O M0 entrega a base (banco, autenticação da equipe, painel inicial, backups e operação em produção), o M1 a vitrine pública e o M2 o painel de alunos e períodos.

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
| `pnpm teste:fuso` | Testes de horário da vitrine com `TZ=Asia/Tokyo` (o servidor pode ter qualquer fuso) |
| `pnpm teste:integracao` | Testes de integração (precisam de `DATABASE_URL_TESTE_ADMIN`) |
| `pnpm db:gerar` | Gera uma migração a partir do esquema (`--name <nome>`) |
| `pnpm db:migrar` | Aplica as migrações no banco de `DATABASE_URL` |
| `pnpm build:scripts` | Empacota os scripts em `dist/` (usados em produção) |
| `pnpm equipe:criar` | Cria um membro da equipe (`--nome`, `--email`, `--papel`) |
| `pnpm backup:verificar -- <url>` | Verifica um banco restaurado de backup |

Em produção, as migrações rodam sozinhas quando o contêiner inicia (`scripts/iniciar.sh` executa `node dist/migrar.js` e depois o servidor); não há comando de pré-deploy no Coolify.

## Estrutura

- `src/app/`: telas e rotas do Next.js (`entrar`, `painel`, `sem-acesso`, `api`, e a vitrine pública: `(publico)`, `capas`, `og`).
- `src/servidor/`: código de servidor (`banco`, `auth`, `equipe`, `pessoas`, `alunos`, `contatos`, `configuracoes`, `cadastros`, `vitrine`, ambiente e saúde).
- `drizzle/`: migrações SQL. `scripts/`: migração, criação da equipe, verificação de restauração.
- `tests/`: apoio e testes de integração. `docs/`: design e operação.

## Documentação

- [Design visual](docs/design.md)
- [Servidor: VPS, Coolify, ambientes e monitoramento](docs/operacao/servidor.md)
- [Backups e restauração verificada](docs/operacao/backup.md)
- [Design do MVP e marcos](docs/superpowers/specs/2026-11-20-mvp-marcos-design.md)
- [Plano do M0](docs/superpowers/plans/2026-11-20-m0-base.md)

## M1: vitrine pública

O M1 abre o site ao público e dá à administração os cadastros que o alimentam. Tudo o que é público mostra só conteúdo ativo/publicado e nunca nomes de alunos ou de professores.

**Rotas públicas (sem login)**

- `/`: página inicial com o próximo evento e os ritmos ativos.
- `/grade` e `/grade/[ritmo]`: grade de horários por ritmo, com filtros de módulo e dia.
- `/eventos` e `/eventos/[slug]`: lista e página de cada evento (capa, ingresso, compartilhar no WhatsApp, copiar link).
- `/capas/[id]`: bytes da capa de um evento; `/og/padrao` e `/og/evento/[slug]`: imagens de prévia do link.

**Rotas do painel (administração; a atendente cai em `/sem-acesso`)**

- `/painel/ritmos`, `/painel/modulos`, `/painel/professores`: cadastros de apoio, cada um com `/novo` e `/[id]`.
- `/painel/turmas` (`/nova` e `/[id]`): dia(s) da semana, horário, ritmo, módulo e professor.
- `/painel/eventos` (`/novo` e `/[id]`): data, local, preço, link de ingresso, capa, esgotado e publicado.

**Como a administração cadastra a grade**

1. Em Ritmos, cadastre os ritmos na ordem em que devem aparecer (campo "Ordem").
2. Em Módulos, cadastre os níveis (Iniciante, Básico...), também em ordem.
3. Em Professores, cadastre quem dá aula. Os nomes só aparecem no painel.
4. Em Turmas, crie uma turma para cada combinação de ritmo, módulo, professor, dias e horário. Só turmas ativas aparecem em `/grade`.
5. Em Eventos, cadastre e marque "Publicado" para o evento aparecer no site. Eventos passados continuam acessíveis pelo link.

Horários são digitados e exibidos em `America/Sao_Paulo`, seja qual for o fuso do servidor. Os dados fixos do estúdio (Instagram, WhatsApp, endereço, funcionamento) ficam em `src/estudio.ts`.

**Pendente em produção (dono do projeto)**

- [ ] Cadastrar a grade real do estúdio em produção e conferir que `/grade` aparece sem login.
- [ ] Colar o link de um evento no WhatsApp (com e sem capa) e conferir a prévia com imagem.

O `docker build` e o `scripts/smoke.sh` rodam na CI a cada push.

## M2: alunos e períodos

O M2 dá à administração o painel que substitui a planilha: alunos, turmas, períodos contratados, extensões, trancamentos, transferências de dias e a lista de quem contatar. Só a administração usa o M2; a atendente continua vendo apenas o início do painel e cai em `/sem-acesso` nas demais telas. Nada com história é apagado: períodos, extensões, trancamentos e transferências são anulados (com motivo, quem e quando), matrículas ganham data de saída e alunos são encerrados. Nenhum dado de aluno aparece em página pública.

**Rotas do painel (só administração)**

- `/painel`: início com os números (vigentes, vencem em breve, vencidos sem contato, trancados, sem período) e "Vigentes por" turma, ritmo, módulo e professor. Cada número abre a lista que ele conta.
- `/painel/alunos`: lista com busca (sem acento) e filtros de turma, ritmo, módulo, professor, período e situação; `/novo` (cadastro), `/estender-turma` (extensão em lote, com prévia) e `/estender-turma/lotes` (lotes feitos, com anulação).
- `/painel/alunos/[id]`: ficha com turmas, período, histórico único e contatos. Ações em páginas próprias: `/editar`, `/periodo` (registrar, renovar ou `?corrigir=<id>`), `/estender`, `/trancar`, `/destrancar/[trancamentoId]`, `/transferir`, `/turmas`, `/encerrar` e `/anular?tipo=...&alvo=<id>`.
- `/painel/contatos`: duas abas, "Vencem em breve" e "Vencidos", com botão WhatsApp e resultado de cada contato. `POST /painel/contatos/abrir` registra o contato e abre o `wa.me`.
- `/painel/configuracoes`: unidade dos ajustes (dias ou aulas), planos (`/planos/novo` e `/planos/[id]`) e mensagens prontas (`/mensagens/nova` e `/mensagens/[id]`).
- `/painel/vitrine`: atalhos para os cadastros do M1 (eventos, turmas, ritmos, módulos, professores).

**Como usar**

1. Em Configurações, cadastre os planos do estúdio (nome, duração em meses ou dias). Confira as duas mensagens prontas (renovação e convite para voltar) e ajuste o texto; campos que se preenchem sozinhos: `{nome}`, `{aluno}`, `{turma}` e `{fim}`. Só uma mensagem fica ativa por finalidade.
2. Garanta que as turmas existem (M1) e cadastre os alunos em Alunos, "Novo aluno": nome, nascimento, WhatsApp e turmas. Para menor de 18 anos, informe o responsável (o sistema oferece quem já está cadastrado); as mensagens vão para o responsável.
3. Na ficha, "Registrar período" (ou "Renovar") escolhe o plano e as datas de início e fim; o fim vem calculado pelo plano e só se muda em acordos especiais. Para quem já tem um período que ainda não terminou, o início sugerido é o dia seguinte ao fim atual; senão, é hoje.
4. Ajustes, sempre com motivo: "Estender" soma dias ou aulas, "Trancar" pausa (com data de volta ou em aberto, até "Destrancar"), "Transferir" cede dias a outro aluno, "Estender turma" soma dias a quem está vigente numa ou mais turmas (ou no estúdio todo) depois de mostrar quem recebe. Qualquer lançamento errado se desfaz em "Anular" (fica riscado no histórico).
5. Em Contatos, toque em "WhatsApp" para abrir a conversa com a mensagem pronta; o contato é registrado ao tocar. Depois marque o resultado (vai renovar, vai pensar, não respondeu, não volta, não quer contato). "Não quer contato" tira a pessoa das listas e do botão WhatsApp até alguém marcar "Voltou a aceitar contato" na ficha. Quem foi contatado recentemente desce para o fim da lista.

"Hoje" é sempre o dia em `America/Sao_Paulo` e as datas de período são dias inteiros, seja qual for o fuso do servidor (`pnpm teste:fuso` confere).

**Pendente em produção (dono do projeto)**

- [ ] Configurar o backup fora da VPS e fazer a primeira restauração verificada (`docs/operacao/backup.md`) **antes de cadastrar o primeiro aluno real**: a partir daí o banco guarda dados pessoais.
- [ ] Cadastrar os planos reais, conferir as mensagens prontas e cadastrar a turma piloto e seus alunos em produção.
- [ ] A administração (hoje também no papel das atendentes) passa a cadastrar os alunos novos e as mudanças do dia a dia no painel.

**Para o M4: "não quer contato"**

A marca "não quer contato" (resultado de um contato, guardada na pessoa) precisa ser considerada na ativação dos alunos junto com os consentimentos (opt-ins): não pré-marcar nenhum consentimento, como já previsto, e avisar a equipe se a pessoa der opt-in depois de ter pedido para não ser contatada.

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
