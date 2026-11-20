# M1 · Vitrine pública — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar sem login a grade de horários (por ritmo) e os eventos (com prévia de link, ingresso pelo WhatsApp ou link externo e aviso de esgotado), cadastrados pela administração no painel, já com a identidade visual do estúdio.

**Architecture:** O monólito Next.js do M0 ganha telas públicas renderizadas no servidor a cada requisição (`dynamic = "force-dynamic"`, sem cache a invalidar) e telas de cadastro no painel. Cada cadastro tem um módulo de serviço em `src/servidor/cadastros/` (validação zod + Drizzle, testado com banco real) e uma camada fina de server actions em `src/app/painel/**/acoes.ts`, que sempre começa por `await exigirAdministracao()`. As capas ficam no Postgres (`imagens`, `bytea`), processadas com `sharp` e servidas por `/capas/[id]`; as imagens de prévia sem capa são geradas com `next/og`.

**Tech Stack:** Node 26, pnpm 10.28, Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind 4, Drizzle ORM + drizzle-kit, PostgreSQL 17, Better Auth 1.7.27, Zod 4, Vitest, Biome; novos: `sharp`, `@fontsource-variable/raleway`, `@fontsource-variable/dancing-script`, `@fontsource/raleway` (arquivos `.woff` estáticos para o `next/og`, que não lê woff2).

**Spec:** `docs/superpowers/specs/2026-11-20-m1-vitrine-publica-design.md`. Design dos marcos: `docs/superpowers/specs/2026-11-20-mvp-marcos-design.md`. Identidade de origem: `claude/estado-do-projeto.md` no Project (cores e fontes copiadas na Tarefa 1).

## Global Constraints

- Interface, mensagens, comentários e documentação em português do Brasil. Nomes do domínio em português.
- Toda tela é pensada primeiro para o celular e verificada em 375 px, 768 px e 1280 px. Use a skill `anthropic-skills:design-craft` em toda tela e siga `docs/design.md` (reescrito na Tarefa 1): três tamanhos de texto, só cores e fontes dos tokens, estados vazio/carregando/erro desenhados, áreas de toque ≥ 48 px.
- Toda mudança de código começa por um teste que falha (superpowers:test-driven-development).
- Toda server action do painel começa por `await exigirAdministracao();`. O layout do painel não protege actions.
- Páginas públicas: nunca mostram nome de aluno ou de professor; só ritmos/módulos ativos, turmas ativas e eventos publicados. Professor não aparece nem como filtro.
- Horários exibidos e digitados no fuso `America/Sao_Paulo`, seja qual for o fuso do servidor (os testes rodam com `TZ=UTC` e com `TZ=Asia/Tokyo` onde indicado).
- Migrações novas em `drizzle/` geradas com `pnpm db:gerar --name <nome>` e ajustadas à mão quando preciso; nunca editar migrações existentes.
- Dados fixos do estúdio só em `src/estudio.ts`: nome "Arquitetura da Dança", Instagram `@arquiteturadadanca` (`https://www.instagram.com/arquiteturadadanca/`), WhatsApp `5527999891561` (exibido "(27) 99989-1561"), endereço "R. Antônio Guilherme do Nascimento, 173 · Jardim Camburi, Vitória/ES", funcionamento "seg a qui, 14h às 21h · sex, 17h às 20h30", site `https://arquiteturadadanca.com.br/`.
- URL pública absoluta (prévias, compartilhar): `ambiente.BETTER_AUTH_URL`.
- Nada de aula experimental no M1.
- Commits em português no formato `tipo: descrição`, terminando com as linhas de atribuição da sessão.

## Review Focus

1. **Evento em rascunho vazando:** `/eventos/<slug-de-rascunho>`, `/capas/<id-da-capa-do-rascunho>` e `/og/evento/<slug-de-rascunho>` respondem 404 para quem não está logado como administração. Testes nas Tarefas 5, 11 e 15.
2. **Servidor fora do fuso de São Paulo:** com `TZ=UTC`, um evento digitado "13/12 21:00" é gravado como `2026-12-14T00:00:00Z`, aparece como "sáb, 13 de dezembro · 21h" e só "passa" à 0h de 14/12 em São Paulo (03:00Z). Testes na Tarefa 4.
3. **Arquivo de capa errado:** um PDF renomeado para `.jpg`, um arquivo de 0 bytes ou um de 12 MB recebem mensagem clara no campo, sem erro 500 e sem gravar nada. Teste na Tarefa 5 (e o limite do corpo da action na Tarefa 10).
4. **Desativar o que está em uso:** desativar um ritmo, módulo ou professor tira o item da vitrine e das escolhas de turma nova, mas a turma existente continua editável com o valor atual; excluir algo em uso devolve "Está em uso; desative em vez de excluir." Testes nas Tarefas 7, 8 e 9.
5. **Endereço compartilhado:** depois da primeira publicação, o slug do evento não muda, mesmo que o evento volte a rascunho e seja editado; filtros inválidos na grade (`?dia=xyz&modulo=nao-existe`) são ignorados, sem erro. Testes nas Tarefas 10 e 11.

---

## Estrutura de arquivos

```
src/estudio.ts                                 dados fixos do estúdio (nome, Instagram, WhatsApp, endereço)
src/app/globals.css, src/app/layout.tsx        tokens e fontes novos; link "Pular para o conteúdo"
src/app/marca.tsx                              marca em Dancing Script (lê ESTUDIO.nome)
src/app/cliente-auth.ts                        createAuthClient único (entrar e sair)
src/app/api/auth/[...all]/route.ts             só as rotas do Better Auth usadas
src/servidor/auth/rotas-permitidas.ts          lista das rotas do Better Auth expostas
src/servidor/auth/acesso.ts                    + exigirAdministracao(); papéis inativos não contam
src/servidor/banco/esquema/*.ts                colunas e tabela novas (Tarefa 3)
src/servidor/vitrine/texto.ts                  slug, dias, horários, datas (fuso SP)
src/servidor/vitrine/eventos.ts                evento passado, mensagens e links do WhatsApp
src/servidor/imagens/capa.ts                   processar, gravar e ler capas
src/servidor/cadastros/resultado.ts            tipo Resultado e tradução de erros do banco
src/servidor/cadastros/{ritmos,modulos,professores,turmas,eventos}.ts
src/servidor/vitrine/consultas.ts              consultas públicas
src/app/capas/[id]/route.ts                    imagem da capa
src/app/og/padrao/route.tsx, src/app/og/evento/[slug]/route.tsx   prévias geradas
src/app/painel/layout.tsx, navegacao.tsx       navegação do painel (cadastros só para a administração)
src/app/painel/_formulario/                    componentes de formulário do painel
src/app/painel/{ritmos,modulos,professores,turmas,eventos}/   telas e acoes.ts
src/app/(publico)/layout.tsx                   cabeçalho e rodapé públicos
src/app/(publico)/page.tsx                     página inicial (substitui src/app/page.tsx)
src/app/(publico)/grade/...                    grade por ritmo
src/app/(publico)/eventos/...                  lista e página de evento
tests/integracao/*.test.ts                     um arquivo por serviço/consulta
tests/apoio/fabricas.ts                        criar ritmo, módulo, professor, turma, evento de teste
```

---

### Task 1: Identidade visual do estúdio

**Files:**
- Create: `src/estudio.ts`, `src/estudio.test.ts`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/marca.tsx`, `src/app/page.tsx`, `src/app/entrar/page.tsx`, `src/app/painel/page.tsx`, `src/app/painel/layout.tsx`, `src/app/painel/sair.tsx`, `src/app/sem-acesso/page.tsx`, `docs/design.md`, `package.json`

**Interfaces:**
- Produces: `ESTUDIO: { nome: string; instagram: { usuario: string; url: string }; whatsapp: { numero: string; exibicao: string }; endereco: string; funcionamento: string; site: string }` em `src/estudio.ts`; `NOME_ESTUDIO` continua exportado de `src/app/marca.tsx` (= `ESTUDIO.nome`).
- Produces (tokens Tailwind, usados por todas as telas): cores `fundo #ffffff`, `fundo-suave #f2f2f2`, `texto #1f1f1f`, `texto-suave #555555`, `borda #8c8c8c` (contorno de campo, 3,4:1), `linha #dcdcdc` (divisórias), `marca #c25b8f` (decorativa, nunca fundo de texto branco), `acao #a8457a` (botão com texto branco, 5,5:1), `acao-escura #8e3a67` (hover), `link #7f2f57` (8,6:1), `rosa-suave #f8e9f1`, `amarelo #f5e056`, `laranja #f58c23`, `palco #1a1a1a`, `erro #b3261e`, `sucesso #1f6b43`; tamanhos `text-pequeno`, `text-base`, `text-titulo` (mesmos valores do M0); famílias `font-texto` e `font-titulo` (Raleway variável) e `font-assinatura` (Dancing Script variável); utilitário `fita` (degradê `linear-gradient(100deg,#f5db53,#f58c23)` atrás de 2 a 4 palavras, texto na cor `texto`) e utilitário `faixa-esgotado` (fundo `palco`, texto branco, `font-semibold`).

- [ ] **Step 1: Teste de `ESTUDIO`.** Em `src/estudio.test.ts`: `ESTUDIO.whatsapp.numero` casa `/^55\d{10,11}$/`; `ESTUDIO.instagram.url` começa com `https://www.instagram.com/`; `ESTUDIO.nome === "Arquitetura da Dança"`.
- [ ] **Step 2:** `pnpm teste src/estudio.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Criar `src/estudio.ts` com os valores das Global Constraints; `marca.tsx` passa a reexportar `NOME_ESTUDIO = ESTUDIO.nome`.
- [ ] **Step 4:** `pnpm teste src/estudio.test.ts` → PASS.
- [ ] **Step 5: Fontes.** `pnpm add @fontsource-variable/raleway @fontsource-variable/dancing-script @fontsource/raleway` e remover `@fontsource-variable/archivo` e `@fontsource-variable/atkinson-hyperlegible-next`. Em `layout.tsx`, `localFont` com os `.woff2` latinos variáveis de Raleway (`--fonte-texto`) e Dancing Script (`--fonte-assinatura`); confira os nomes exatos dos arquivos em `node_modules/@fontsource-variable/*/files/`.
- [ ] **Step 6: Tokens.** Reescrever o `@theme` de `globals.css` com os tokens acima (mantendo `--color-*: initial`, `--text-*: initial`, `--font-*: initial`), `font-titulo` = Raleway peso 700 nos `h1–h3`, remover `font-variation-settings` de largura, reescrever `fita` e criar `faixa-esgotado`.
- [ ] **Step 7: Telas do M0 na identidade nova.** Trocar `text-texto/70` por `text-texto-suave`, `decoration-borda` por `decoration-link`/`text-link` nos links, botão principal `bg-acao text-fundo hover:bg-acao-escura`, divisórias `border-linha`. `Marca` em `font-assinatura` (sem `uppercase`). No `layout.tsx`, link "Pular para o conteúdo" como primeiro elemento do `body` (visível só no foco) apontando para `#conteudo`; todo `<main>` ganha `id="conteudo"`. No `painel/page.tsx`, o h1 "Olá, {nome}" ganha `break-words`. A página inicial provisória continua até a Tarefa 12.
- [ ] **Step 8: `docs/design.md`.** Reescrever na identidade nova: tirar o aviso de "provisória" (manter a nota de que o logo original ainda não chegou e a marca é o nome em Dancing Script), paleta com papel e contraste de cada token (valores acima), Raleway e Dancing Script com papéis, os três tamanhos, espaçamento (sem mudança), a fita no degradê do estúdio (única ousadia e único degradê), a `faixa-esgotado` como única exceção à regra de "sem selos", voz calorosa e direta, e a lista "Nunca fazer" revisada (sem amarelo como texto, sem texto branco sobre `marca`, sem segundo degradê).
- [ ] **Step 9: Verificar.** `pnpm lint && pnpm tipos && pnpm teste && pnpm build` → tudo passa. Com `pnpm dev`, abrir `/`, `/entrar`, `/sem-acesso` e `/painel` em 375, 768 e 1280 px (screenshots) e conferir fontes carregadas, foco visível e o link "Pular para o conteúdo".
- [ ] **Step 10: Commit** `feat: identidade visual do estúdio`.

---

### Task 2: Acertos de autenticação herdados do M0

**Files:**
- Create: `src/app/cliente-auth.ts`, `src/servidor/auth/rotas-permitidas.ts`, `src/servidor/auth/rotas-permitidas.test.ts`
- Modify: `src/app/entrar/page.tsx`, `src/app/painel/sair.tsx`, `src/app/api/auth/[...all]/route.ts`

**Interfaces:**
- Produces: `clienteAuth` (único `createAuthClient()`) em `src/app/cliente-auth.ts`; `rotaAuthPermitida(metodo: string, caminho: string): boolean` em `rotas-permitidas.ts`, com `caminho` relativo a `/api/auth` (ex.: `/sign-in/email`).

- [ ] **Step 1: Testes.** `rotaAuthPermitida("POST", "/sign-in/email")`, `("POST", "/sign-out")` e `("GET", "/get-session")` → `true`; `("POST", "/sign-up/email")`, `("POST", "/forget-password")`, `("GET", "/list-sessions")`, `("GET", "/sign-in/email")` e `("POST", "/sign-in/email/")` → `false`.
- [ ] **Step 2:** `pnpm teste src/servidor/auth/rotas-permitidas.test.ts` → FAIL.
- [ ] **Step 3:** Implementar com uma lista explícita `[metodo, caminho]`. No `route.ts`, extrair o caminho depois de `/api/auth` e responder `404` (corpo vazio) quando `!rotaAuthPermitida(...)`, antes de chamar o handler.
- [ ] **Step 4:** `pnpm teste` → PASS. `pnpm teste:integracao tests/integracao/auth-equipe.test.ts` continua passando.
- [ ] **Step 5: Cliente único e mensagens.** `entrar` e `sair` importam `clienteAuth`. No `entrar`, se `signIn.email` lançar exceção ou devolver erro sem `status` (falha de rede), a mensagem é "Não foi possível conectar. Verifique sua internet e tente de novo." (sem `aria-invalid` nos campos); 401 continua "E-mail ou senha incorretos"; 429 continua igual. No `sair`, se `signOut` falhar (erro ou exceção), o botão volta a "Sair" e aparece "Não foi possível sair. Tente de novo." com `role="alert"` ao lado.
- [ ] **Step 6: Verificar.** `pnpm lint && pnpm tipos && pnpm build`. Com `pnpm dev`: `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/auth/sign-up/email` → `404`; entrar e sair pelo navegador funcionam; com a rede desligada no DevTools, a mensagem de conexão aparece.
- [ ] **Step 7: Commit** `fix: rotas do Better Auth explícitas e mensagens de login e saída`.

---

### Task 3: Esquema do M1

**Files:**
- Modify: `src/servidor/banco/esquema/estrutura.ts`, `eventos.ts`, `pessoas.ts`; create `src/servidor/banco/esquema/imagens.ts` (exportada em `index.ts`)
- Create: migração `drizzle/0009_vitrine_publica.sql` (+ meta), `tests/integracao/esquema-vitrine.test.ts`, `tests/apoio/fabricas.ts`
- Modify: `src/servidor/auth/acesso.ts`; create `tests/integracao/acesso-papeis.test.ts`

**Interfaces:**
- Produces (colunas Drizzle): `ritmos.slug: text not null unique` (check `^[a-z0-9]+(-[a-z0-9]+)*$`), `ritmos.ordem: integer not null default 0`; `eventos.preco: text`, `eventos.linkIngresso: text` (check `link_ingresso is null or link_ingresso like 'https://%'`), `eventos.esgotado: boolean not null default false`, `eventos.capaId: uuid references imagens(id) on delete set null`, `eventos.primeiraPublicacaoEm: timestamptz`; `eventos.capaUrl` removida; `pessoaPapeis.ativo: boolean not null default true`; tabela `imagens { id uuid pk default random, dados bytea not null, tipo text not null, largura integer not null, altura integer not null, tamanho integer not null, criadoEm timestamptz not null default now }` (Drizzle `customType` para `bytea` ↔ `Buffer`).
- Produces (testes): `tests/apoio/fabricas.ts` com `criarRitmo(db, parcial?)`, `criarModulo(db, parcial?)`, `criarProfessor(db, parcial?)`, `criarTurma(db, parcial?)` (cria ritmo/módulo/professor se faltarem; dias padrão `[2,4]`, 19:00–20:00), `criarEvento(db, parcial?)` (publicado por padrão, início daqui a 7 dias), todos devolvendo a linha inserida.
- Produces: `exigirPapel` só considera papéis com `ativo = true`.

- [ ] **Step 1: Testes do esquema** em `esquema-vitrine.test.ts`: slug de ritmo repetido → `23505`; slug `"Forró"` → `23514`; `link_ingresso = 'http://x'` → `23514`; apagar a imagem de um evento deixa `capa_id` nulo; `imagens.dados` grava e lê de volta um `Buffer` igual byte a byte; `pessoa_papeis.ativo` nasce `true`; inserir ritmo sem `ordem` grava `0`.
- [ ] **Step 2: Teste de acesso** (`tests/integracao/acesso-papeis.test.ts`): a função que carrega os papéis de uma pessoa (extraia `papeisAtivos(db, pessoaId): Promise<Papel[]>` de `acesso.ts` para ser testável) não devolve um papel com `ativo = false`.
- [ ] **Step 3:** `pnpm teste:integracao` → os novos testes FALHAM.
- [ ] **Step 4:** Alterar o esquema, `pnpm db:gerar --name vitrine_publica`, e ajustar o SQL para que funcione com linhas existentes em `ritmos`: adicionar `slug` anulável, preencher com `'ritmo-' || left(id::text, 8)`, e só então `set not null` + índice único + check. Implementar `papeisAtivos` e usá-lo em `exigirPapel`.
- [ ] **Step 5:** `pnpm teste:integracao` → PASS (inclusive `migracoes.test.ts`, que sobe do zero e reaplica).
- [ ] **Step 6:** Escrever `tests/apoio/fabricas.ts` (usado a partir da Tarefa 5).
- [ ] **Step 7: Commit** `feat: esquema do M1 (slug e ordem de ritmos, ingresso, esgotado, capas, papel ativo)`.

---

### Task 4: Regras de texto, datas e links (fuso de São Paulo)

**Files:**
- Create: `src/servidor/vitrine/texto.ts`, `texto.test.ts`, `src/servidor/vitrine/eventos.ts`, `eventos.test.ts`
- Modify: `package.json` (scripts `teste` rodam com `TZ=UTC`; adicione `teste:fuso` = `TZ=Asia/Tokyo vitest run --project unidade src/servidor/vitrine` e inclua na CI)

**Interfaces:**
- Produces em `texto.ts`:
  - `gerarSlug(texto: string): string` — sem acentos, minúsculas, não alfanuméricos viram `-`, sem `-` nas pontas nem repetidos.
  - `DIAS_SEMANA: readonly { numero: 0..6; curto: "dom"|"seg"|"ter"|"qua"|"qui"|"sex"|"sab"; exibicao: string }[]` (`exibicao`: "dom", "seg", "ter", "qua", "qui", "sex", "sáb").
  - `formatarDias(dias: number[]): string`
  - `formatarHorario(inicio: string, fim: string): string` (entrada `"HH:MM:SS"` ou `"HH:MM"`)
  - `dataHoraLocalParaInstante(valor: string): Date` (valor de `<input type="datetime-local">`, interpretado em `America/Sao_Paulo`)
  - `instanteParaDataHoraLocal(instante: Date): string` (inverso, `"YYYY-MM-DDTHH:MM"`)
  - `formatarDataEvento(inicio: Date, fim: Date | null): string`
  - `formatarDataCurta(instante: Date): string` (`"13/12"`)
- Produces em `eventos.ts`:
  - `eventoJaPassou(evento: { inicio: Date; fim: Date | null }, agora: Date): boolean`
  - `linkWhatsapp(mensagem?: string): string` (para `ESTUDIO.whatsapp.numero`)
  - `linkIngresso(evento: { titulo: string; inicio: Date; linkIngresso: string | null }): string`
  - `linkCompartilharWhatsapp(texto: string, url: string): string`
  - `linkGrupoWhatsappValido(url: string): boolean`

- [ ] **Step 1: Testes de `texto.ts`** (com valores exatos):
  - `gerarSlug("Samba de Gafieira")` → `"samba-de-gafieira"`; `gerarSlug("  Forró & Xote!! ")` → `"forro-xote"`; `gerarSlug("Baile de Dezembro 2026")` → `"baile-de-dezembro-2026"`.
  - `formatarDias([4, 2])` → `"ter e qui"`; `formatarDias([1, 3, 5])` → `"seg, qua e sex"`; `formatarDias([6])` → `"sáb"`.
  - `formatarHorario("19:00:00", "20:00:00")` → `"19h–20h"`; `formatarHorario("19:30", "20:30")` → `"19h30–20h30"` (traço `–`).
  - `dataHoraLocalParaInstante("2026-12-13T21:00").toISOString()` → `"2026-12-14T00:00:00.000Z"`; `instanteParaDataHoraLocal(new Date("2026-12-14T00:00:00Z"))` → `"2026-12-13T21:00"`.
  - `formatarDataEvento(new Date("2026-12-14T00:00:00Z"), null)` → `"sáb, 13 de dezembro · 21h"`; com fim `2026-12-14T05:00:00Z` → `"sáb, 13 de dezembro · 21h–2h"`; início `2026-12-13T12:00:00Z` e fim `2026-12-14T21:00:00Z` → `"sáb, 13 de dezembro, 9h – dom, 14 de dezembro, 18h"` (regra: mesmo dia, ou fim até 12h do dia seguinte → só a hora; senão, as duas datas).
  - `formatarDataCurta(new Date("2026-12-14T00:00:00Z"))` → `"13/12"`.
- [ ] **Step 2: Testes de `eventos.ts`:**
  - Sem fim, início `2026-12-14T00:00:00Z` (21h de 13/12 em SP): `eventoJaPassou(..., new Date("2026-12-14T02:59:59Z"))` → `false`; `..."2026-12-14T03:00:00Z"` → `true`.
  - Com fim `2026-12-14T05:00:00Z`: às `04:59:59Z` → `false`; às `05:00:00Z` → `true`.
  - `linkWhatsapp()` → `"https://wa.me/5527999891561"`; `linkWhatsapp("Olá & tchau")` → `"https://wa.me/5527999891561?text=Ol%C3%A1%20%26%20tchau"`.
  - `linkIngresso({ titulo: "Baile de Dezembro", inicio: new Date("2026-12-14T00:00:00Z"), linkIngresso: null })` decodificado contém `"Olá! Quero garantir meu ingresso para o Baile de Dezembro (13/12). Vi no site do estúdio."`; com `linkIngresso: "https://sympla.com.br/x"` → exatamente esse link.
  - `linkCompartilharWhatsapp("Baile · sáb", "https://x.com/eventos/baile")` → `"https://wa.me/?text=" + encodeURIComponent("Baile · sáb\nhttps://x.com/eventos/baile")`.
  - `linkGrupoWhatsappValido("https://chat.whatsapp.com/AbC123xyz")` → `true`; `"https://chat.whatsapp.com/"`, `"http://chat.whatsapp.com/AbC"`, `"https://chat.whatsapp.com/AbC/extra"` e `"https://evil.com/?https://chat.whatsapp.com/AbC"` → `false`.
- [ ] **Step 3:** `pnpm teste src/servidor/vitrine` → FAIL.
- [ ] **Step 4:** Implementar com `Intl.DateTimeFormat` e `timeZone: "America/Sao_Paulo"` (sem biblioteca nova); `dataHoraLocalParaInstante` calcula o deslocamento do fuso para aquela data via `Intl` (não fixe `-03:00`). Fins de semana e meses em minúsculas, sem ponto ("sáb", "dezembro").
- [ ] **Step 5:** `pnpm teste src/servidor/vitrine && pnpm teste:fuso` → PASS nos dois fusos.
- [ ] **Step 6: Commit** `feat: regras de texto, datas e links da vitrine`.

---

### Task 5: Capas — processar, guardar e servir

**Files:**
- Create: `src/servidor/imagens/capa.ts`, `src/servidor/imagens/capa.test.ts`, `src/app/capas/[id]/route.ts`, `tests/integracao/capas.test.ts`
- Modify: `package.json` (`sharp`), `pnpm-workspace.yaml` (tirar `sharp` de `ignoredBuiltDependencies` se a instalação exigir), `next.config.ts` (`serverExternalPackages: ["sharp"]` se o build pedir)

**Interfaces:**
- Consumes: tabela `imagens`, `eventos.capaId` (Tarefa 3); `exigirPapel`/`papeisAtivos` (Tarefa 3).
- Produces:
  - `class ErroCapa extends Error` (mensagem pronta para o usuário)
  - `TAMANHO_MAXIMO_CAPA = 10 * 1024 * 1024`
  - `processarCapa(arquivo: { bytes: Uint8Array; tipo: string }): Promise<{ dados: Buffer; largura: number; altura: number; tamanho: number }>`
  - `gravarCapa(db: Banco, processada: Awaited<ReturnType<typeof processarCapa>>): Promise<string>` (id)
  - `lerCapa(db: Banco, id: string, opcoes: { incluirRascunhos: boolean }): Promise<{ dados: Buffer; tipo: string } | null>` — sem `incluirRascunhos`, só devolve se a imagem é capa de um evento publicado.
  - Rota `GET /capas/[id]`: 200 `image/jpeg` com `Cache-Control: public, max-age=31536000, immutable`; 404 caso contrário. Administração logada vê capa de rascunho (com `Cache-Control: private, no-store`).

- [ ] **Step 1: Testes de unidade** (`capa.test.ts`, imagens geradas com `sharp` no próprio teste):
  - PNG 3000×1500 → JPEG (`dados` começa com `FF D8`), `largura` 1200, `altura` 600.
  - JPEG 1080×1350 → 960×1200 (mantém a proporção, lado maior 1200).
  - Imagem 800×600 → continua 800×600 (não amplia).
  - JPEG com EXIF `orientation: 6` (gerado com `.withMetadata({ orientation: 6 })`) 400×200 → sai 200×400 e sem EXIF (`sharp(dados).metadata()` sem `exif`).
  - Saída de uma foto ruidosa 4000×3000 tem `tamanho` ≤ 350_000.
  - `tipo: "application/pdf"` → `ErroCapa` "Envie uma imagem JPEG, PNG ou WebP."; bytes de um PDF com `tipo: "image/jpeg"` → mesma mensagem; 0 bytes → "O arquivo está vazio."; `TAMANHO_MAXIMO_CAPA + 1` bytes → "A imagem pode ter até 10 MB."
- [ ] **Step 2:** `pnpm teste src/servidor/imagens` → FAIL.
- [ ] **Step 3:** Implementar `processarCapa` com `sharp(...).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality, mozjpeg: true })`, baixando a qualidade de 82 até 60 em passos de 6 enquanto passar de 300 KB. Conferir o formato real com `sharp().metadata()`.
- [ ] **Step 4:** `pnpm teste src/servidor/imagens` → PASS.
- [ ] **Step 5: Testes de integração** (`capas.test.ts`): `gravarCapa` + `lerCapa` com evento publicado → bytes iguais; capa de evento em rascunho → `null` sem `incluirRascunhos` e bytes com `incluirRascunhos: true`; imagem sem evento → `null` sem `incluirRascunhos`; id que não é uuid → `null` (sem lançar).
- [ ] **Step 6:** Implementar `gravarCapa`, `lerCapa` e a rota (a rota tenta a sessão só se a leitura pública der `null`).
- [ ] **Step 7:** `pnpm teste:integracao tests/integracao/capas.test.ts && pnpm build` → PASS; o build standalone inclui o `sharp` (conferir `.next/standalone/node_modules/sharp` ou `@img`).
- [ ] **Step 8: Commit** `feat: capas de evento no banco, processadas e servidas por rota própria`.

---

### Task 6: Base do painel da administração

**Files:**
- Create: `src/servidor/cadastros/resultado.ts`, `tests/integracao/resultado.test.ts`, `src/app/painel/navegacao.tsx`, `src/app/painel/_formulario/` (`campo.tsx`, `botao-enviar.tsx`, `mensagem.tsx`, `estado.ts`), `src/app/painel/acoes-protegidas.test.ts`
- Modify: `src/servidor/auth/acesso.ts`, `src/app/painel/layout.tsx`, `src/app/painel/page.tsx`

**Interfaces:**
- Produces:
  - `exigirAdministracao(): Promise<{ pessoaId: string; nome: string; papeis: Papel[] }>` = `exigirPapel(["administracao"])`.
  - `type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: Record<string, string> }` (chave `"_"` = erro geral do formulário).
  - `errosDeZod(erro: z.ZodError): Record<string, string>` (primeira mensagem por campo).
  - `traduzirErroBanco(erro: unknown, mapa: Record<string, { campo: string; mensagem: string }>): Record<string, string> | null` — olha `constraint` do erro do pg (também dentro de `cause`); `23503` sem entrada no mapa vira `{ _: "Está em uso; desative em vez de excluir." }`; erro não reconhecido → `null` (quem chama relança).
  - `type EstadoFormulario = { erros?: Record<string, string>; valores?: Record<string, string> }` e `ESTADO_INICIAL: EstadoFormulario`, para `useActionState`.
  - Componentes `Campo` (rótulo acima, erro abaixo com `aria-describedby` e `aria-invalid`), `BotaoEnviar` (usa `useFormStatus`; texto de carregando informado por prop, ex.: "Salvando…"), `MensagemErroGeral`.
  - Navegação: Início (`/painel`), Eventos, Turmas, Ritmos, Módulos, Professores — os cinco últimos só aparecem para quem tem `administracao`.

- [ ] **Step 1: Teste estático das actions** (`acoes-protegidas.test.ts`, projeto de unidade): encontra todo `src/app/painel/**/acoes.ts`, analisa com a API do `typescript` e exige que (a) o arquivo comece com `"use server"`, (b) toda função exportada seja `async` e (c) a primeira instrução de cada uma seja `await exigirAdministracao();`. Inclua um caso que monta o texto de um arquivo inválido em memória e verifica que a checagem o reprova. Enquanto não houver `acoes.ts`, o teste exige ao menos que a função de checagem exista e reprove o exemplo.
- [ ] **Step 2: Testes de `traduzirErroBanco`** (integração, com banco real): inserir ritmo com slug repetido e traduzir com o mapa `{ ritmos_slug_unico: { campo: "slug", mensagem: "Esse endereço já está em uso." } }` → `{ slug: "Esse endereço já está em uso." }`; apagar um ritmo usado por turma → `{ _: "Está em uso; desative em vez de excluir." }`; `new Error("x")` → `null`.
- [ ] **Step 3:** Rodar os dois testes → FAIL.
- [ ] **Step 4:** Implementar `resultado.ts`, `exigirAdministracao`, a checagem estática, os componentes de formulário (design-craft) e a navegação no `layout.tsx` (no celular, a navegação rola na horizontal abaixo do cabeçalho; no computador, fica na mesma linha). O `painel/page.tsx` troca o texto "O painel ainda está vazio" por atalhos para os cadastros (administração) ou pelo texto atual (atendente).
- [ ] **Step 5:** `pnpm teste && pnpm teste:integracao tests/integracao/resultado.test.ts && pnpm lint && pnpm tipos` → PASS.
- [ ] **Step 6: Commit** `feat: base do painel da administração (navegação, formulários, erros, actions protegidas)`.

---

### Task 7: Ritmos e módulos

**Files:**
- Create: `src/servidor/cadastros/ritmos.ts`, `src/servidor/cadastros/modulos.ts`, `tests/integracao/cadastro-ritmos.test.ts`, `tests/integracao/cadastro-modulos.test.ts`, `src/app/painel/ritmos/{page.tsx,novo/page.tsx,[id]/page.tsx,formulario.tsx,acoes.ts}`, idem em `src/app/painel/modulos/`

**Interfaces:**
- Consumes: `Resultado`, `traduzirErroBanco`, `errosDeZod`, componentes de formulário (Tarefa 6); `gerarSlug` (Tarefa 4).
- Produces:
  - `listarRitmos(db): Promise<{ id; nome; slug; ordem; ativo; turmasAtivas: number }[]>` (ordem, depois nome)
  - `salvarRitmo(db, dados: { id?: string; nome: string; slug?: string; ordem: number | string; ativo: boolean }): Promise<Resultado<{ id: string }>>` — slug vazio → `gerarSlug(nome)`.
  - `excluirRitmo(db, id): Promise<Resultado<null>>`
  - `listarModulos(db)`, `salvarModulo(db, { id?, nome, ordem, ativo })`, `excluirModulo(db, id)` no mesmo formato.
  - Actions: `salvarRitmoAcao(estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario>` (redireciona para `/painel/ritmos` no sucesso), `excluirRitmoAcao(form: FormData)`; idem para módulos.

- [ ] **Step 1: Testes de ritmos:** criar "Samba de Gafieira" sem slug → slug `"samba-de-gafieira"`; nome repetido com outra caixa ("forró" depois de "Forró") → `erros.nome = "Já existe um ritmo com esse nome."`; slug repetido → `erros.slug = "Esse endereço já está em uso."`; slug `"Forró"` digitado → normalizado por `gerarSlug` para `"forro"`; nome vazio → `erros.nome = "Informe o nome."`; ordem `"abc"` → `erros.ordem = "Informe um número."`; `listarRitmos` ordena por `ordem` e conta `turmasAtivas`; excluir ritmo sem turma → `ok`; excluir ritmo com turma → `erros._ = "Está em uso; desative em vez de excluir."`.
- [ ] **Step 2: Testes de módulos:** os mesmos casos de nome vazio/repetido, ordem inválida, exclusão em uso e ordenação.
- [ ] **Step 3:** Rodar → FAIL.
- [ ] **Step 4:** Implementar serviços, actions e telas. A lista mostra nome, endereço (`/grade/<slug>`), ordem, situação (Ativo/Desativado) e "Editar"; vazia: "Nenhum ritmo cadastrado" + "Cadastre os ritmos que o estúdio ensina; eles aparecem na grade pública na ordem definida aqui." + botão "Novo ritmo". No formulário de edição de ritmo, abaixo do campo endereço: "Mudar o endereço faz links antigos da grade deixarem de funcionar." Excluir fica num formulário separado no fim da página de edição, com o texto do botão "Excluir ritmo".
- [ ] **Step 5:** `pnpm teste:integracao tests/integracao/cadastro-ritmos.test.ts tests/integracao/cadastro-modulos.test.ts && pnpm teste && pnpm lint && pnpm tipos` → PASS (o teste estático da Tarefa 6 passa a checar estes `acoes.ts`).
- [ ] **Step 6: Verificar** as telas em 375/768/1280 px com `pnpm dev`: lista vazia, lista cheia, formulário com erro, "Salvando…".
- [ ] **Step 7: Commit** `feat: cadastro de ritmos e módulos`.

---

### Task 8: Professores

**Files:**
- Create: `src/servidor/cadastros/professores.ts`, `tests/integracao/cadastro-professores.test.ts`, `src/app/painel/professores/{page.tsx,novo/page.tsx,[id]/page.tsx,formulario.tsx,acoes.ts}`

**Interfaces:**
- Consumes: `normalizarEmail`, `normalizarWhatsapp` (M0); `Resultado` (Tarefa 6); `pessoaPapeis.ativo` (Tarefa 3).
- Produces:
  - `listarProfessores(db, opcoes?: { somenteAtivos?: boolean }): Promise<{ pessoaId; nome; email; whatsapp; ativo }[]>` (por nome)
  - `cadastrarProfessor(db, dados: { nome: string; email?: string; whatsapp?: string }): Promise<Resultado<{ tipo: "criado"; pessoaId: string } | { tipo: "pessoa-existente"; pessoaId: string; nome: string; jaProfessor: boolean }>>`
  - `tornarProfessor(db, pessoaId: string): Promise<Resultado<null>>`
  - `atualizarProfessor(db, pessoaId, dados: { nome; email?; whatsapp?; ativo: boolean }): Promise<Resultado<null>>`
  - `excluirProfessor(db, pessoaId): Promise<Resultado<null>>` — remove o papel `professor`; se a pessoa ficar sem papel e sem `usuarioId`, apaga a pessoa.

- [ ] **Step 1: Testes:** cadastrar "Bruno" com WhatsApp "(27) 99999-0000" → pessoa com papel `professor` ativo e WhatsApp `5527999990000`; WhatsApp "123" → `erros.whatsapp = "WhatsApp inválido. Use DDD e número."`; e-mail de uma pessoa da administração → `tipo: "pessoa-existente"`, sem criar pessoa nova; `tornarProfessor` nela → ela passa a ter `administracao` e `professor`; desativar professor (`ativo: false`) → `listarProfessores({ somenteAtivos: true })` não o devolve e a pessoa continua com `administracao` ativo; excluir professor com turma → `erros._ = "Está em uso; desative em vez de excluir."`; excluir professor sem turma que só era professor → pessoa apagada; excluir professor sem turma que também é administração → só o papel sai.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar serviços, actions e telas. Quando `cadastrarProfessor` devolve `pessoa-existente`, a tela mostra "{nome} já está cadastrada com esse e-mail." e o botão "Tornar professor(a)" (action `tornarProfessorAcao`); se `jaProfessor`, mostra "{nome} já é professor(a)." com link para a edição.
- [ ] **Step 4:** `pnpm teste:integracao tests/integracao/cadastro-professores.test.ts && pnpm teste && pnpm lint && pnpm tipos` → PASS.
- [ ] **Step 5: Verificar** as telas em 375/768/1280 px (vazio, cheio, erro, pessoa existente).
- [ ] **Step 6: Commit** `feat: cadastro de professores`.

---

### Task 9: Turmas

**Files:**
- Create: `src/servidor/cadastros/turmas.ts`, `tests/integracao/cadastro-turmas.test.ts`, `src/app/painel/turmas/{page.tsx,nova/page.tsx,[id]/page.tsx,formulario.tsx,acoes.ts}`

**Interfaces:**
- Consumes: `linkGrupoWhatsappValido`, `formatarDias`, `formatarHorario`, `DIAS_SEMANA` (Tarefa 4); listagens de ritmos, módulos e professores (Tarefas 7–8).
- Produces:
  - `listarTurmas(db): Promise<{ id; ritmo; modulo; professor; dias: number[]; horarioInicio; horarioFim; ativa }[]>` (por ordem do ritmo, ordem do módulo, primeiro dia, início)
  - `obterTurma(db, id)`
  - `opcoesDeTurma(db, turmaId?: string): Promise<{ ritmos; modulos; professores }>` — só ativos, mais o ritmo/módulo/professor atual da turma `turmaId` mesmo se desativado.
  - `salvarTurma(db, dados: { id?; ritmoId; moduloId; professorId; dias: number[]; horarioInicio: string; horarioFim: string; linkGrupoWhatsapp?: string; ativa: boolean }): Promise<Resultado<{ id: string }>>` — grava `turmas` e substitui `turma_dias` numa transação.
  - `excluirTurma(db, id): Promise<Resultado<null>>`

- [ ] **Step 1: Testes:** criar turma ter e qui 19:00–20:00 → `turma_dias` = {2,4}; editar para só sáb → `turma_dias` = {6}; sem dias → `erros.dias = "Escolha pelo menos um dia."`; fim 19:00 com início 19:00 → `erros.horarioFim = "O fim precisa ser depois do início."`; link `"https://chat.whatsapp.com/"` → `erros.linkGrupoWhatsapp = "Cole o link de convite do grupo (https://chat.whatsapp.com/...)."`; link vazio → grava `null`; ritmo desativado numa turma nova → `erros.ritmoId = "Escolha um ritmo ativo."`; ao editar uma turma cujo professor foi desativado, mantendo o mesmo professor → `ok`; `opcoesDeTurma(db, idDessaTurma)` inclui esse professor e `opcoesDeTurma(db)` não; excluir turma com matrícula → `erros._` "Está em uso; desative em vez de excluir."; falha no meio da transação (dia `9`, que viola o check) não deixa turma gravada.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar serviços, actions e telas. Dias como sete caixas de seleção grandes (`dom`…`sáb`); horários com `<input type="time" step="1800">`. A lista mostra ritmo, módulo, professor, "ter e qui · 19h–20h" e situação; vazia: "Nenhuma turma cadastrada" + "Cadastre antes os ritmos, os módulos e os professores." com links para eles quando faltarem.
- [ ] **Step 4:** `pnpm teste:integracao tests/integracao/cadastro-turmas.test.ts && pnpm teste && pnpm lint && pnpm tipos` → PASS.
- [ ] **Step 5: Verificar** as telas em 375/768/1280 px.
- [ ] **Step 6: Commit** `feat: cadastro de turmas com validação do link do grupo`.

---

### Task 10: Eventos no painel

**Files:**
- Create: `src/servidor/cadastros/eventos.ts`, `tests/integracao/cadastro-eventos.test.ts`, `src/app/painel/eventos/{page.tsx,novo/page.tsx,[id]/page.tsx,formulario.tsx,acoes.ts}`
- Modify: `next.config.ts` (limite do corpo das server actions para `11mb`; conferir a chave exata para o Next 16 em `node_modules/next/dist/server/config-shared.d.ts`)

**Interfaces:**
- Consumes: `processarCapa`, `gravarCapa`, `ErroCapa` (Tarefa 5); `dataHoraLocalParaInstante`, `instanteParaDataHoraLocal`, `gerarSlug`, `eventoJaPassou`, `formatarDataEvento` (Tarefa 4).
- Produces:
  - `listarEventosPainel(db, agora: Date): Promise<{ id; titulo; slug; inicio; fim; publicado; esgotado; passou: boolean }[]>` (próximos primeiro, por início; depois os passados, do mais recente)
  - `obterEventoPainel(db, id)` (inclui `slugEditavel: boolean` = `primeiraPublicacaoEm === null`)
  - `salvarEvento(db, dados: { id?; titulo; slug?; inicio: string; fim?: string; local?; descricao?; preco?; linkIngresso?; publicado: boolean; esgotado: boolean; capa?: { bytes: Uint8Array; tipo: string } | null; removerCapa?: boolean }): Promise<Resultado<{ id: string }>>` — `inicio`/`fim` no formato `datetime-local`; na primeira publicação grava `primeiraPublicacaoEm`; com `primeiraPublicacaoEm` preenchido, ignora o slug enviado; capa nova substitui a anterior e apaga a imagem antiga na mesma transação.
  - `alternarEsgotado(db, id): Promise<Resultado<{ esgotado: boolean }>>`
  - `excluirEvento(db, id): Promise<Resultado<null>>` — só se `publicado = false`; apaga também a capa.

- [ ] **Step 1: Testes:** criar "Baile de Dezembro" com início `"2026-12-13T21:00"` → `inicio` = `2026-12-14T00:00:00Z` e slug `"baile-de-dezembro"`; slug repetido → `erros.slug = "Esse endereço já está em uso."`; fim antes do início → `erros.fim = "O fim precisa ser depois do início."`; `linkIngresso: "sympla.com.br/x"` → `erros.linkIngresso = "Use um link completo, começando com https://."`; título vazio → `erros.titulo = "Informe o título."`; publicar → `primeiraPublicacaoEm` preenchido; voltar a rascunho e salvar com slug `"outro"` → slug continua `"baile-de-dezembro"`; evento nunca publicado aceita trocar o slug; capa inválida (bytes de texto) → `erros.capa = "Envie uma imagem JPEG, PNG ou WebP."` e nada gravado; trocar a capa → a imagem antiga some de `imagens`; `removerCapa` → `capaId` nulo e imagem apagada; `alternarEsgotado` duas vezes → `true` e depois `false`; excluir publicado → `erros._ = "Volte o evento para rascunho antes de excluir."`; excluir rascunho → evento e capa apagados; `listarEventosPainel` marca `passou` com a regra de `eventoJaPassou`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar serviços, actions e telas. Formulário: título, endereço (desabilitado com a explicação "O endereço fica fixo depois da primeira publicação, para não quebrar links já compartilhados." quando `!slugEditavel`), início, fim (opcional), local, preço (ajuda: "Ex.: R$ 35 antecipado · R$ 40 no dia"), link de ingresso (ajuda: "Se vazio, o botão abre o WhatsApp do estúdio com uma mensagem pronta."), descrição (`textarea`), capa (prévia da atual, "Trocar capa", "Remover capa"; ajuda: "JPEG, PNG ou WebP, até 10 MB. A imagem é mostrada inteira, sem cortes."), "Ingressos esgotados" (caixa de seleção), "Publicado" (caixa de seleção). A lista mostra data, título, situação (Rascunho / Publicado / Esgotado / Já aconteceu), "Editar" e, para publicados que não passaram, o botão "Marcar como esgotado" ou "Reabrir ingressos" (action `alternarEsgotadoAcao`, sem abrir o formulário). Erro de corpo grande demais no envio da capa vira a mensagem "A imagem pode ter até 10 MB." no campo.
- [ ] **Step 4:** `pnpm teste:integracao tests/integracao/cadastro-eventos.test.ts && pnpm teste && pnpm lint && pnpm tipos && pnpm build` → PASS.
- [ ] **Step 5: Verificar** com `pnpm dev`, em 375/768/1280 px: lista vazia, cheia, formulário com erro, envio de capa de 8 MB (passa) e de 12 MB (mensagem), botão esgotado.
- [ ] **Step 6: Commit** `feat: cadastro de eventos com capa, esgotado e endereço fixo após publicar`.

---

### Task 11: Consultas da vitrine

**Files:**
- Create: `src/servidor/vitrine/consultas.ts`, `tests/integracao/vitrine-consultas.test.ts`

**Interfaces:**
- Consumes: `eventoJaPassou`, `gerarSlug`, `DIAS_SEMANA` (Tarefa 4); fábricas (Tarefa 3).
- Produces (tipos sem nenhum campo de pessoa):
  - `type EventoPublico = { id; titulo; slug; descricao: string | null; local: string | null; inicio: Date; fim: Date | null; preco: string | null; linkIngresso: string | null; esgotado: boolean; capa: { id: string; largura: number; altura: number } | null }`
  - `listarRitmosDaGrade(db): Promise<{ nome: string; slug: string }[]>` — ritmos ativos com ao menos uma turma ativa cujo módulo está ativo, pela `ordem`.
  - `obterGradeDoRitmo(db, slug: string, filtros: { modulo?: string; dia?: string }): Promise<{ ritmo: { nome; slug }; modulos: { nome; slug }[]; turmas: { id; modulo: string; dias: number[]; horarioInicio: string; horarioFim: string }[]; filtrosAplicados: { modulo?: string; dia?: string } } | null>` — `null` para ritmo inexistente ou desativado; `modulos` = os que têm turma ativa nesse ritmo (para o filtro); filtro desconhecido é ignorado e não aparece em `filtrosAplicados`; `dia` usa `DIAS_SEMANA[].curto`; `modulo` compara com `gerarSlug(modulo.nome)`.
  - `proximoEvento(db, agora: Date): Promise<EventoPublico | null>`
  - `listarProximosEventos(db, agora: Date): Promise<EventoPublico[]>`
  - `obterEventoPublico(db, slug: string, agora: Date): Promise<(EventoPublico & { passou: boolean }) | null>` — `null` se não existe ou não está publicado.

- [ ] **Step 1: Testes:** `listarRitmosDaGrade` não traz ritmo desativado, ritmo sem turma, ritmo cuja única turma está desativada, nem ritmo cuja única turma usa módulo desativado, e respeita `ordem`; `obterGradeDoRitmo(db, "forro", {})` traz as turmas ativas ordenadas por ordem do módulo, primeiro dia e início, e o objeto devolvido não tem nenhuma chave `professor`/`professorId` (verifique com `JSON.stringify` que o nome do professor da fábrica não aparece); `{ dia: "ter" }` traz só turmas com terça; `{ modulo: "iniciante" }` só Iniciante; `{ dia: "xyz", modulo: "nao-existe" }` → mesmas turmas de `{}` e `filtrosAplicados` vazio; ritmo desativado → `null`; `proximoEvento` ignora rascunho e evento que já passou, escolhe o de início mais próximo e devolve um evento esgotado se for o próximo; `listarProximosEventos` em ordem de início, sem rascunhos e sem passados; `obterEventoPublico` de rascunho → `null`; de evento passado → objeto com `passou: true`; nenhum `EventoPublico` serializado contém o nome de uma pessoa cadastrada no teste.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar com Drizzle (selecionando colunas explicitamente).
- [ ] **Step 4:** `pnpm teste:integracao tests/integracao/vitrine-consultas.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: consultas públicas da grade e dos eventos`.

---

### Task 12: Layout público e página inicial

**Files:**
- Create: `src/servidor/vitrine/pagina-inicial.ts`, `tests/integracao/pagina-inicial.test.ts`, `src/app/(publico)/layout.tsx`, `src/app/(publico)/page.tsx`, `src/app/(publico)/componentes/` (`cabecalho.tsx`, `rodape.tsx`, `destaque-evento.tsx`, `botao-ingresso.tsx`)
- Delete: `src/app/page.tsx`

**Interfaces:**
- Consumes: `proximoEvento`, `listarProximosEventos`, `listarRitmosDaGrade` (Tarefa 11); `formatarDataEvento`, `linkIngresso`, `linkWhatsapp` (Tarefa 4); `ESTUDIO` (Tarefa 1).
- Produces: `<BotaoIngresso evento={EventoPublico} />` (botão principal "Garantir meu ingresso" → `linkIngresso(evento)`, abre em nova aba com `rel="noopener"`; quando `esgotado`, no lugar do botão, o texto "Ingressos esgotados"); `<DestaqueEvento evento={EventoPublico} />` (capa na proporção original com a `faixa-esgotado` "Esgotado" no canto superior quando esgotado; sem capa, a faixa fica ao lado do título); cabeçalho (marca + "Entrar" discreto) e rodapé (Instagram primeiro, WhatsApp geral com `linkWhatsapp()`, endereço, funcionamento, link para o site) reutilizados nas Tarefas 13 e 14.

- [ ] **Step 1: Teste de página** (`tests/integracao/pagina-inicial.test.ts`): renderizar o componente da página com `renderToStaticMarkup` não funciona com componentes assíncronos; em vez disso, extraia `montarPaginaInicial(db, agora): Promise<{ destaque: EventoPublico | null; outrosEventos: number; ritmos: { nome; slug }[] }>` em `src/servidor/vitrine/pagina-inicial.ts` e teste: sem eventos → `destaque: null`; com dois eventos futuros → `destaque` é o mais próximo e `outrosEventos = 1`; ritmos vêm de `listarRitmosDaGrade`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar `montarPaginaInicial`, o layout público (`dynamic = "force-dynamic"` nas páginas) e a página: destaque do próximo evento (título, `formatarDataEvento`, local, preço, `BotaoIngresso`, link "Ver detalhes" → `/eventos/<slug>`); "Ver todos os eventos" se `outrosEventos > 0`; seção "Ritmos" com links para `/grade/<slug>` (some se não houver ritmos); frase de assinatura do estúdio em `font-assinatura` ("A dança é a linguagem escondida da alma."). Sem evento e sem ritmos, a página mostra a frase, o convite "Acompanhe as novidades no Instagram" e o rodapé. Design-craft: a ousadia (fita ou capa) fica num lugar só.
- [ ] **Step 4:** `pnpm teste:integracao tests/integracao/pagina-inicial.test.ts && pnpm lint && pnpm tipos && pnpm build` → PASS.
- [ ] **Step 5: Verificar** com `pnpm dev` em 375/768/1280 px: sem nada cadastrado; só ritmos; evento com capa vertical (1080×1350); evento sem capa; evento esgotado.
- [ ] **Step 6: Commit** `feat: página inicial pública com o próximo evento em destaque`.

---

### Task 13: Grade de horários

**Files:**
- Modify: `src/servidor/vitrine/texto.ts`, `texto.test.ts` (`urlDaGrade`)
- Create: `src/app/(publico)/grade/page.tsx`, `src/app/(publico)/grade/[ritmo]/page.tsx`, `src/app/(publico)/grade/[ritmo]/not-found.tsx`, `src/app/(publico)/grade/filtros.tsx` (componente cliente)

**Interfaces:**
- Consumes: `listarRitmosDaGrade`, `obterGradeDoRitmo` (Tarefa 11); `formatarDias`, `formatarHorario`, `DIAS_SEMANA` (Tarefa 4); cabeçalho/rodapé (Tarefa 12).

- [ ] **Step 1: Teste** em `src/servidor/vitrine/texto.test.ts`: `urlDaGrade(ritmoSlug: string, filtros: { modulo?: string; dia?: string }): string` → `urlDaGrade("forro", {})` = `"/grade/forro"`; `urlDaGrade("forro", { dia: "ter", modulo: "iniciante" })` = `"/grade/forro?modulo=iniciante&dia=ter"` (ordem fixa: modulo, dia).
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar `urlDaGrade` em `src/servidor/vitrine/texto.ts`. **Step 4:** Rodar → PASS.
- [ ] **Step 5: Páginas.** `/grade` redireciona para `/grade/<primeiro-slug>`; sem ritmos, mostra o estado vazio "A grade será publicada em breve" + "Acompanhe as novidades no Instagram" (link). `/grade/[ritmo]`: título "Grade de horários", ritmos como links no topo (o atual marcado com `aria-current="page"`, rolagem horizontal no celular), filtros "Módulo" e "Dia" num `<form method="get">` com `<select>`s e botão "Filtrar" (o componente cliente envia ao mudar a seleção e esconde o botão quando há JS); lista de turmas no celular (módulo em `font-semibold`, "ter e qui · 19h–20h") e `<table>` a partir de `md` (Módulo, Dias, Horário). Filtro sem resultado: "Nenhuma turma de {ritmo} com esses filtros." + link "Limpar filtros" (`urlDaGrade(slug, {})`). Ritmo inexistente: `notFound()`, com `not-found.tsx` dizendo "Não encontramos esse ritmo." e link "Ver a grade".
- [ ] **Step 6: Verificar** `pnpm lint && pnpm tipos && pnpm build`; com `pnpm dev`, em 375/768/1280 px: grade vazia, ritmo com turmas, filtros aplicados, filtro sem resultado, ritmo inexistente; sem JavaScript (DevTools), os filtros funcionam pelo botão "Filtrar". A página não contém o nome de nenhum professor (procure o nome usado no cadastro de teste no HTML com `curl`).
- [ ] **Step 7: Commit** `feat: grade de horários pública por ritmo`.

---

### Task 14: Páginas públicas de eventos

**Files:**
- Modify: `src/servidor/vitrine/eventos.ts`, `eventos.test.ts` (`urlDoEvento`)
- Create: `src/app/(publico)/eventos/page.tsx`, `src/app/(publico)/eventos/[slug]/page.tsx`, `src/app/(publico)/eventos/[slug]/not-found.tsx`, `src/app/(publico)/eventos/[slug]/compartilhar.tsx` (componente cliente)

**Interfaces:**
- Consumes: `listarProximosEventos`, `obterEventoPublico` (Tarefa 11); `BotaoIngresso`, `DestaqueEvento` (Tarefa 12); `linkCompartilharWhatsapp`, `formatarDataEvento` (Tarefa 4); `ambiente.BETTER_AUTH_URL`.
- Produces: `urlDoEvento(slug: string): string` em `src/servidor/vitrine/eventos.ts` = `new URL(`/eventos/${slug}`, ambiente.BETTER_AUTH_URL).toString()` (usado também na Tarefa 15).

- [ ] **Step 1: Teste:** `urlDoEvento("baile")` com `BETTER_AUTH_URL=https://app.exemplo.com.br` → `"https://app.exemplo.com.br/eventos/baile"` (em teste, injete a base: implemente `urlDoEvento(slug, base = ambiente.BETTER_AUTH_URL)`).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Páginas.** `/eventos`: lista de próximos eventos (data, título, local, preço, "Esgotado" quando for o caso; capa pequena quando houver), cada item levando à página; vazia: "Nenhum evento marcado agora" + "Os próximos bailes e workshops aparecem aqui e no Instagram." `/eventos/[slug]`: capa inteira (proporção original, `width`/`height` reais para não pular o layout) com a `faixa-esgotado` quando esgotado, título (h1), data/hora, local, preço, descrição (quebras de linha preservadas, texto escapado), `BotaoIngresso`, e o componente `Compartilhar` com "Compartilhar no WhatsApp" (`linkCompartilharWhatsapp(`${titulo} · ${data}`, urlDoEvento(slug))`) e "Copiar link" (`navigator.clipboard.writeText`; sucesso: "Link copiado" em `text-sucesso` com `role="status"` por 3 s; falha ou sem clipboard: mostra um `<input readonly>` com a URL, selecionada). Evento passado: aviso "Este evento já aconteceu." no topo e sem `BotaoIngresso`. Rascunho ou inexistente: `notFound()` com "Não encontramos esse evento." e link "Ver os próximos eventos".
- [ ] **Step 4: Verificar** `pnpm lint && pnpm tipos && pnpm build`; com `pnpm dev`, em 375/768/1280 px: lista vazia e cheia, evento com e sem capa, esgotado, passado, com link externo e com WhatsApp, rascunho dá 404 (`curl -s -o /dev/null -w "%{http_code}" localhost:3000/eventos/<slug-rascunho>` → `404`), copiar link com e sem permissão de clipboard.
- [ ] **Step 5: Commit** `feat: lista e página pública de eventos com compartilhar e copiar link`.

---

### Task 15: Prévia de link (Open Graph)

**Files:**
- Create: `src/servidor/vitrine/metadados.ts`, `metadados.test.ts`, `src/app/og/padrao/route.tsx`, `src/app/og/evento/[slug]/route.tsx`, `src/servidor/vitrine/imagem-previa.tsx`
- Modify: `src/app/layout.tsx` (`metadataBase`, metadados padrão), `src/app/(publico)/page.tsx`, `grade/[ritmo]/page.tsx`, `eventos/page.tsx`, `eventos/[slug]/page.tsx` (`generateMetadata`)

**Interfaces:**
- Consumes: `EventoPublico`, `obterEventoPublico` (Tarefa 11); `formatarDataEvento` (Tarefa 4); `urlDoEvento` (Tarefa 14).
- Produces:
  - `metadadosDoEvento(evento: EventoPublico, base: string): Metadata` — `title` = título; `description` = `[ "Esgotado", formatarDataEvento(...), local, preco ].filter(Boolean).join(" · ")` (o "Esgotado" só quando esgotado); `openGraph`: `type: "website"`, `locale: "pt_BR"`, `siteName: ESTUDIO.nome`, `url: urlDoEvento(slug, base)`, `images: [{ url, width, height, alt: titulo }]` com a capa (`/capas/<id>`, largura e altura reais) ou, sem capa, `/og/evento/<slug>` 1200×630; `twitter.card: "summary_large_image"`.
  - `metadadosPadrao(base: string, pagina: { titulo: string; descricao: string; caminho: string }): Metadata` com imagem `/og/padrao`.
  - `imagemPrevia(conteudo: { titulo: string; linha?: string; esgotado?: boolean }): ImageResponse` (1200×630, fundo `palco`, faixa no degradê do estúdio, Raleway 700 e 400 lidos de `node_modules/@fontsource/raleway/files/raleway-latin-{700,400}-normal.woff`).

- [ ] **Step 1: Testes de `metadadosDoEvento`:** evento com capa 960×1200 → `openGraph.images[0]` = `{ url: "https://app.exemplo.com.br/capas/<id>", width: 960, height: 1200, alt: "Baile de Dezembro" }`; sem capa → `url` termina em `/og/evento/baile-de-dezembro`, 1200×630; esgotado → `description` começa com `"Esgotado · "`; sem local e sem preço → `description` = só a data; `openGraph.locale === "pt_BR"` e `twitter.card === "summary_large_image"`.
- [ ] **Step 2:** FAIL → implementar `metadados.ts` → PASS.
- [ ] **Step 3: Rotas de imagem.** `/og/padrao` → PNG com o nome do estúdio e a frase de assinatura; `/og/evento/[slug]` → PNG com título, data e (se esgotado) "Esgotado"; 404 para rascunho ou inexistente. Ambas com `runtime = "nodejs"` e `Cache-Control: public, max-age=3600`.
- [ ] **Step 4: `generateMetadata`** nas páginas públicas; `metadataBase` = `new URL(ambiente.BETTER_AUTH_URL)` lido dentro de `generateMetadata` (o build não tem variáveis de ambiente).
- [ ] **Step 5: Verificar.** `pnpm lint && pnpm tipos && pnpm teste && pnpm build`. Com `pnpm dev`: `curl -s localhost:3000/eventos/<slug> | grep -o '<meta property="og:[^>]*>'` mostra `og:title`, `og:description`, `og:image` (absoluto), `og:image:width`, `og:image:height`, `og:type`, `og:locale`; `curl -sI localhost:3000/og/evento/<slug>` → `200` e `content-type: image/png`; o mesmo para um evento sem capa e para o rascunho (`404`). Abrir as duas imagens geradas e conferir textos e acentos.
- [ ] **Step 6: Commit** `feat: prévia de link para eventos, grade e página inicial`.

---

### Task 16: Verificação final do M1

**Files:**
- Modify: `README.md` (seção "M1: vitrine pública" com o que existe, rotas públicas e do painel, e o checklist de produção pendente), `.github/workflows/ci.yml` (`pnpm teste:fuso`), `docs/superpowers/specs/2026-11-20-m1-vitrine-publica-design.md` (marcar os itens verificáveis do "Pronto quando")

- [ ] **Step 1:** Rodar tudo: `pnpm lint && pnpm tipos && pnpm teste && pnpm teste:fuso && pnpm teste:integracao && pnpm build && docker build -t arquitetura-danca:m1 . && ./scripts/smoke.sh arquitetura-danca:m1` → tudo passa.
- [ ] **Step 2: Percorrer as telas** com `pnpm dev` e um banco com dados de exemplo (cadastrados pelo próprio painel: 6 ritmos na ordem do estúdio, 4 módulos, 3 professores, 10 turmas, 3 eventos — um com capa vertical, um sem capa e esgotado, um passado — e um rascunho), tirando screenshots em 375, 768 e 1280 px de: `/`, `/grade/<ritmo>` (com e sem filtro, sem resultado), `/eventos`, `/eventos/<slug>` (com capa, sem capa, esgotado, passado), 404 de evento e de ritmo, e cada lista e formulário do painel (vazio, cheio, erro, enviando). Conferir: nenhum nome de professor nas páginas públicas (`curl` + `grep` pelos nomes cadastrados), foco visível, "Pular para o conteúdo", áreas de toque ≥ 48 px, nada transbordando na horizontal em 375 px.
- [ ] **Step 3: Atendente.** Com uma conta `atendente`, `/painel/eventos` (e as outras telas de cadastro) redirecionam para `/sem-acesso`, e a navegação não mostra os cadastros.
- [ ] **Step 4:** Atualizar README e o "Pronto quando" do design (itens de produção continuam pendentes).
- [ ] **Step 5: Commit** `docs: fechamento do M1 (verificação e README)`.
