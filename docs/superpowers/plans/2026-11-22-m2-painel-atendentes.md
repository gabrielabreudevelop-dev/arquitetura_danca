# M2 · Painel das atendentes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A administração passa a controlar no painel os alunos (com responsável para menores), as matrículas, o período contratado e tudo o que mexe nele (renovação, extensão individual e em lote, trancamento, transferência, anulação), chama pelo WhatsApp quem vence ou venceu, e vê um dash em que cada número abre a lista correspondente.

**Architecture:** O período segue o **livro de lançamentos** (spec, seção 5): o período guarda início, fim original e plano; toda mudança é uma linha em `ajustes_periodo`, e o fim efetivo é sempre calculado. Os serviços ficam em `src/servidor/alunos/`, `src/servidor/contatos/` e `src/servidor/configuracoes/` (zod + Drizzle, testados com banco real); as regras de datas e de estado são funções puras em `src/servidor/alunos/`. **Decisão deste plano (spec, seção 12):** o estado do período é calculado na aplicação, por uma única carga (`carregarAlunos`) que lê todos os alunos com períodos, ajustes, trancamentos, matrículas e contatos; dash, lista de alunos, contatos e ficha filtram esse resultado em memória. Na escala do estúdio (centenas de alunos) isso é rápido, mantém uma fonte só, deixa as regras testáveis sem banco e resolve a busca sem acento com `normalize("NFD")`, sem extensão do Postgres. As telas seguem o padrão do M1: server components, filtros no endereço, server actions finas em `acoes.ts` que começam por `await exigirAdministracao();`.

**Tech Stack:** Node 26, pnpm 10.28, Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind 4, Drizzle ORM 0.45 + drizzle-kit, PostgreSQL 17 (16 local), Better Auth 1.7.27, Zod 4, Vitest, Biome. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-22-m2-painel-atendentes-design.md`. Design dos marcos: `docs/superpowers/specs/2026-11-20-mvp-marcos-design.md`. Padrões herdados: `docs/superpowers/specs/2026-11-20-m1-vitrine-publica-design.md` e `docs/design.md`.

## Global Constraints

- Interface, mensagens, comentários e documentação em português do Brasil. Nomes do domínio em português.
- Toda tela é pensada primeiro para o celular e verificada em 375, 768 e 1280 px, com a skill `anthropic-skills:design-craft` e `docs/design.md`: três tamanhos de texto, só cores e fontes dos tokens, estados vazio e erro desenhados, botão "Salvando…" desabilitado durante o envio, áreas de toque ≥ 48 px, listas empilhadas no celular e `<table>` a partir de `md`.
- Toda mudança de código começa por um teste que falha (superpowers:test-driven-development).
- **Só a administração usa o M2.** Toda server action nova começa por `await exigirAdministracao();` (o teste estático `src/app/painel/acoes-protegidas.test.ts` fica como está e cobre os arquivos novos). Toda página nova do M2 chama `await exigirAdministracao()` como primeira instrução. O papel `atendente` não muda.
- **"Hoje" é o dia em `America/Sao_Paulo`**, obtido só por `hojeEmSaoPaulo()` (Tarefa 1). Datas de período são strings `"AAAA-MM-DD"` (modo padrão do `date` do Drizzle), nunca `Date`. Início e fim contam como dias inteiros.
- **Nada com história é apagado:** períodos e ajustes são anulados (quando, quem, motivo), matrículas ganham saída, alunos são encerrados. Toda operação que muda períodos, ajustes, trancamentos ou transferências de um aluno roda numa transação que começa com `SELECT ... FOR UPDATE` na linha de `pessoas` do aluno (dos dois alunos, em ordem de id, na transferência).
- Erros do banco viram mensagens legíveis (`executarTraduzindo`, `ehUuid`, `MENSAGEM_EM_USO`, `errosDeZod` de `src/servidor/cadastros/`); formulários usam `lerTexto`, `EstadoFormulario`, `Campo`, `BotaoEnviar`, `MensagemErroGeral` de `src/app/painel/_formulario/`. Ids vindos de formulário ou endereço passam por `ehUuid` antes de ir ao banco.
- Migrações novas em `drizzle/` geradas com `pnpm db:gerar --name <nome>` (rodar com pseudo-TTY: `script -qec 'pnpm db:gerar --name <nome>' /dev/null`) e ajustadas à mão quando preciso; nunca editar migrações existentes.
- Nenhum dado de aluno em página pública, log, fixture versionada com dado real ou repositório.
- Ambiente local (aprendido no M1): Node 26 via `npm i node@26 --prefix <pasta>` com o `node` padrão apontando para esse binário; pnpm 10.28; sem Docker — Postgres local com `/usr/lib/postgresql/16/bin/initdb` + `pg_ctl` (usuário e senha `postgres`); `.env.local` com `DATABASE_URL`, `DATABASE_URL_TESTE_ADMIN`, `BETTER_AUTH_SECRET` (32+ caracteres) e `BETTER_AUTH_URL=http://localhost:3000`. Next.js 16: consultar `node_modules/next/dist/docs/` antes de usar route handlers, server actions e `redirect`. O `AGENTS.md` gerado pelo `next dev` não é commitado. Screenshots com `playwright-core` e o Chrome em `/usr/bin/google-chrome`.
- Commits em português no formato `tipo: descrição`, terminando com as linhas de atribuição da sessão.

## Review Focus

1. **Virada do dia fora de São Paulo:** com o servidor em UTC, às `2026-11-23T02:30:00Z` (23h30 de 22/11 em São Paulo) um período que termina em `2026-11-22` ainda está vigente e não aparece em "vencidos". Testes nas Tarefas 1 e 3 (também com `TZ=Asia/Tokyo`).
2. **Duas pessoas da administração ao mesmo tempo:** duas renovações simultâneas do mesmo aluno (`Promise.all`) gravam uma e recusam a outra com a mensagem de sobreposição, sem períodos sobrepostos no banco. Teste na Tarefa 7.
3. **Anular duas vezes ou anular o que depende de outra coisa:** anular um ajuste já anulado devolve "Isso já foi anulado." (sem erro 500); anular uma linha que pertence a uma transferência ou a um trancamento pede para anular a transferência ou o trancamento. Testes na Tarefa 7.
4. **Operar sobre aluno encerrado:** matricular, registrar período, estender, trancar e transferir (de ou para) um aluno encerrado devolvem "Este aluno está encerrado. Reabra o cadastro antes." Testes nas Tarefas 6, 7 e 9.
5. **Endereços e formulários adulterados:** `?turma=xyz&periodo=qualquer&janela=99` na lista de alunos e nos contatos é ignorado sem erro; um id que não é uuid numa action volta com "Aluno não encontrado." Testes nas Tarefas 11 e 13.

---

## Estrutura de arquivos

```
src/servidor/alunos/datas.ts              datas "AAAA-MM-DD": hoje em SP, somar dias/meses, fim pelo plano, idade
src/servidor/alunos/conversao.ts          aulas → dias
src/servidor/alunos/estado.ts             fim efetivo, último período, estado do período (puro)
src/servidor/alunos/carga.ts              carregarAlunos: a fonte única de dash, listas, contatos e ficha
src/servidor/alunos/listas.ts             filtros da lista, contagens do dash, linhas de contato (puro)
src/servidor/alunos/cadastro.ts           cadastrar/editar aluno e responsável, encerrar, reabrir, excluir
src/servidor/alunos/matriculas.ts         matricular, tirar, trocar, mover alunos de uma turma
src/servidor/alunos/periodos.ts           registrar período, sugestão de renovação, estender, anular
src/servidor/alunos/trancamentos.ts       trancar, destrancar, anular
src/servidor/alunos/transferencias.ts     transferir dias, anular
src/servidor/alunos/lotes.ts              extensão em lote: prévia, confirmar, listar, anular
src/servidor/alunos/ficha.ts              ficha e histórico do aluno
src/servidor/contatos/mensagens.ts        campos {nome} {aluno} {turma} {fim}, link wa.me (puro)
src/servidor/contatos/contatos.ts         registrar contato, resultado, "não quer contato"
src/servidor/configuracoes/{planos,mensagens-prontas,unidade}.ts
src/servidor/pessoas/normalizar.ts        + normalizarInstagram
src/servidor/banco/esquema/{pessoas,periodos,estrutura,contatos,index}.ts
drizzle/0010_m2_alunos.sql                tabelas, colunas, gatilhos e sementes do M2
src/app/painel/page.tsx                   dash (administração) / estado vazio (atendente)
src/app/painel/navegacao.tsx              Início, Alunos, Contatos, Configurações, Vitrine
src/app/painel/vitrine/page.tsx           atalhos dos cadastros do M1
src/app/painel/alunos/...                 lista, novo, ficha, editar, ações da ficha, estender turma
src/app/painel/contatos/...               listas de contato e rota que abre o WhatsApp
src/app/painel/configuracoes/...          unidade, planos, mensagens prontas
src/app/painel/turmas/...                 contagem de alunos e "mover alunos"
src/app/painel/paginas-protegidas.test.ts teste estático das páginas do M2
tests/apoio/fabricas.ts                   + administração, aluno, plano, período, matrícula
tests/integracao/*.test.ts                um arquivo por serviço
```

---

### Task 1: Datas, conversão e Instagram

**Files:**
- Create: `src/servidor/alunos/datas.ts`, `datas.test.ts`, `src/servidor/alunos/conversao.ts`, `conversao.test.ts`
- Modify: `src/servidor/pessoas/normalizar.ts`, `normalizar.test.ts`, `package.json` (`teste:fuso` passa a rodar `src/servidor/vitrine src/servidor/alunos`)

**Interfaces:**
- Produces (`datas.ts`): `type DataIso = string`; `hojeEmSaoPaulo(agora?: Date): DataIso`; `somarDias(data: DataIso, dias: number): DataIso`; `diasEntre(de: DataIso, ate: DataIso): number` (= `ate − de`); `somarMeses(data: DataIso, meses: number): DataIso`; `fimPeloPlano(inicio: DataIso, duracao: { quantidade: number; unidade: "meses" | "dias" }): DataIso`; `formatarDia(data: DataIso): string` ("08/12"); `formatarDataCompleta(data: DataIso): string` ("08/12/2026"); `idadeEm(nascimento: DataIso, hoje: DataIso): number`; `ehMenor(nascimento: DataIso, hoje: DataIso): boolean`; `ehDataIso(valor: string): boolean`.
- Produces (`conversao.ts`): `diasPorAulas(aulas: number, diasPorSemana: number): number`.
- Produces (`normalizar.ts`): `normalizarInstagram(valor: string): string` (lança `Error("Instagram inválido")`).

- [ ] **Step 1: Testes de `datas.ts`:**
  - `hojeEmSaoPaulo(new Date("2026-11-23T02:30:00Z"))` → `"2026-11-22"`; `hojeEmSaoPaulo(new Date("2026-11-23T03:00:00Z"))` → `"2026-11-23"`.
  - `somarDias("2026-12-30", 3)` → `"2027-01-02"`; `somarDias("2026-03-01", -1)` → `"2026-02-28"`; `diasEntre("2026-12-01", "2026-12-20")` → `19`.
  - `somarMeses`: dia que não existe no mês de destino vira o dia 1 do mês seguinte: `somarMeses("2027-01-31", 1)` → `"2027-03-01"`; `somarMeses("2026-11-05", 1)` → `"2026-12-05"`.
  - `fimPeloPlano(inicio, d)` = `somarDias(soma, −1)`, onde `soma` = `somarMeses` ou `somarDias`: `("2026-11-05", 1 mês)` → `"2026-12-04"`; `("2027-01-31", 1 mês)` → `"2027-02-28"`; `("2028-01-31", 1 mês)` → `"2028-02-29"`; `("2026-11-30", 3 meses)` → `"2027-02-28"`; `("2026-11-05", 30 dias)` → `"2026-12-04"`.
  - `formatarDia("2026-12-08")` → `"08/12"`; `formatarDataCompleta("2026-12-08")` → `"08/12/2026"`.
  - `idadeEm("2008-11-23", "2026-11-22")` → `17`; `idadeEm("2008-11-22", "2026-11-22")` → `18`; `ehMenor` acompanha (`< 18`); nascido em 29/02/2008 faz 18 em `"2026-03-01"`.
  - `ehDataIso("2026-02-30")` → `false`; `ehDataIso("2026-02-28")` → `true`; `ehDataIso("28/02/2026")` → `false`.
- [ ] **Step 2: Testes de `conversao.ts`:** `diasPorAulas(1, 2)` → `4`; `(1, 1)` → `7`; `(2, 2)` → `7`; `(1, 3)` → `3`; `(3, 2)` → `11`; `aulas` ou `diasPorSemana` ≤ 0 ou não inteiros → lança.
- [ ] **Step 3: Testes de `normalizarInstagram`:** `"@Ana.Souza"`, `"ana.souza"`, `"https://www.instagram.com/ana.souza/"` e `"instagram.com/ana.souza?igsh=x"` → `"ana.souza"`; `"ana souza"`, `"@"`, 31 caracteres e `"https://evil.com/ana"` → lança.
- [ ] **Step 4:** `pnpm teste src/servidor/alunos src/servidor/pessoas` → FAIL.
- [ ] **Step 5:** Implementar sem biblioteca nova: aritmética de datas com `Date.UTC` sobre as partes de `"AAAA-MM-DD"`; `hojeEmSaoPaulo` com `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`. Instagram: `^[a-z0-9._]{1,30}$` depois de tirar `@`, o domínio `instagram.com` (com ou sem `www.`, `http(s)://`) e o que vier depois de `/` ou `?`.
- [ ] **Step 6:** `pnpm teste src/servidor/alunos src/servidor/pessoas && pnpm teste:fuso` → PASS nos dois fusos.
- [ ] **Step 7: Commit** `feat: regras de datas em São Paulo, conversão de aulas e Instagram`.

---

### Task 2: Esquema e migração do M2

**Files:**
- Create: `src/servidor/banco/esquema/contatos.ts`, `drizzle/0010_m2_alunos.sql` (+ snapshot e journal gerados), `tests/integracao/esquema-m2.test.ts`
- Modify: `src/servidor/banco/esquema/{pessoas,periodos,estrutura,index}.ts`, `tests/apoio/fabricas.ts`, `tests/integracao/esquema-pessoas.test.ts` e `esquema-estrutura.test.ts` (se usarem `extensoesPeriodo` ou a chave composta de `matriculas`)

**Interfaces (tabelas Drizzle; colunas `snake_case` no banco):**
- `pessoas`: + `instagram text` (check `^[a-z0-9._]{1,30}$` quando não nulo).
- `encerramentosAluno` (`encerramentos_aluno`): `id`, `alunoId → pessoas`, `tipo` enum `tipo_encerramento` (`encerramento`, `reabertura`), `data date not null`, `motivo text`, `criadoPor → pessoas not null`, `criadoEm`.
- `bloqueiosContato` (`bloqueios_contato`): `id`, `pessoaId → pessoas`, `marcadoEm timestamptz not null default now()`, `marcadoPor → pessoas not null`, `desfeitoEm`, `desfeitoPor` (os dois juntos ou nenhum); índice único parcial em `pessoa_id` onde `desfeito_em is null`.
- `planos`: `id`, `nome` (único em `lower(nome)`), `duracaoQuantidade integer > 0`, `duracaoUnidade` enum `unidade_duracao` (`meses`, `dias`), `ordem integer not null default 0`, `ativo boolean default true`, `criadoEm`.
- `periodosContratados`: + `planoId → planos` (nulo), `origem` enum `origem_periodo` (`plano`, `transferencia`) not null default `plano`, `criadoPor → pessoas` (nulo só nas linhas antigas), `anuladoEm`, `anuladoPor → pessoas`, `motivoAnulacao` (check: os três juntos ou nenhum); índice em `aluno_id`.
- `ajustesPeriodo` (`ajustes_periodo`, **substitui** `extensoes_periodo`, que é removida — não há dados reais; se o drizzle-kit perguntar se é renomeação, escolha criar): `id`, `periodoId → periodos_contratados not null`, `tipo` enum `tipo_ajuste` (`extensao`, `trancamento`, `transferencia_saida`, `transferencia_entrada`), `dias integer not null` (check: `dias < 0` se e só se `tipo = 'transferencia_saida'`; nunca 0), `quantidadeDigitada integer not null`, `unidadeDigitada` enum `unidade_ajuste` (`dias`, `aulas`), `turmaConversaoId → turmas` (obrigatória quando `unidade_digitada = 'aulas'`), `motivo text` (obrigatório e não vazio em `extensao`, `transferencia_saida` e `transferencia_entrada`), `loteId → lotes_extensao`, `transferenciaId → transferencias`, `trancamentoId → trancamentos`, `criadoPor → pessoas not null`, `criadoEm`, `anuladoEm`, `anuladoPor`, `motivoAnulacao` (os três juntos ou nenhum).
- `lotesExtensao` (`lotes_extensao`): `id`, `todoEstudio boolean not null`, `quantidadeDigitada`, `unidadeDigitada`, `motivo text not null`, `criadoPor`, `criadoEm`, anulação (3 colunas). `loteTurmas` (`lote_turmas`): `loteId`, `turmaId`, chave primária composta.
- `transferencias`: `id`, `periodoOrigemId → periodos_contratados not null`, `periodoDestinoId → periodos_contratados not null`, `dias integer > 0`, `motivo text not null`, `criadoPor`, `criadoEm`, anulação (3 colunas).
- `trancamentos`: `id`, `periodoId not null`, `inicio date not null`, `volta date` (check `volta > inicio`), `motivo text`, `criadoPor`, `criadoEm`, `destrancadoPor`, `destrancadoEm`, anulação (3 colunas).
- `matriculas`: chave primária passa a ser `id uuid default gen_random_uuid()`; + `entrada date not null`, `saida date` (check `saida >= entrada`), `criadoPor → pessoas` (nulo só nas linhas antigas), `saidaPor → pessoas`; índice único parcial `(aluno_id, turma_id)` onde `saida is null`, chamado `matriculas_aberta_unica`. A migração preenche `entrada` das linhas existentes com `criado_em::date` antes do `not null`.
- `contatos.ts`: enums `lista_contato` (`vence_em_breve`, `vencido`, `ficha`), `resultado_contato` (`vai_renovar`, `vai_pensar`, `nao_respondeu`, `nao_volta`, `nao_quer_contato`), `finalidade_mensagem` (`renovacao`, `retorno`); tabelas `mensagensProntas` (`id`, `nome` único em `lower`, `finalidade`, `texto`, `ativa`, índice único parcial `finalidade` onde `ativa`, `criadoEm`), `contatos` (`id`, `grupoId uuid not null`, `alunoId`, `pessoaContatoId`, `whatsapp text not null`, `lista`, `mensagemId → mensagens_prontas` nulo, `texto text`, `criadoPor`, `criadoEm`, `resultado` nulo, `resultadoPor`, `resultadoEm`; índices em `grupo_id` e `pessoa_contato_id`), `configuracoes` (`chave text primary key`, `valor text not null`).
- Gatilhos (escritos à mão no SQL, no estilo de `0004_consentimento_imutavel.sql`): em `ajustes_periodo` e `periodos_contratados`, `DELETE` e `TRUNCATE` são bloqueados, e `UPDATE` só é aceito quando a linha antiga tinha `anulado_em` nulo e só as três colunas de anulação mudam (mensagem: `'lançamento do período não pode ser alterado nem apagado'`).
- Sementes: `configuracoes ('unidade_ajustes', 'dias')`; `mensagens_prontas` "Renovação" (`renovacao`) e "Convite para voltar" (`retorno`), ativas, com os textos da spec (seção 8, Configurações).
- Fábricas novas em `tests/apoio/fabricas.ts`: `criarAdministracao(db)`, `criarAluno(db, parcial?: Partial<pessoas> & { nascimento?: DataIso; responsavelId?: string })` (papel `aluno`, adulto por padrão, WhatsApp aleatório), `criarPlano(db, parcial?)` (Mensal, 1 mês), `criarPeriodo(db, { alunoId, inicio, fim, criadoPor, planoId? })`, `criarMatricula(db, { alunoId, turmaId, entrada, criadoPor })`.

- [ ] **Step 1: Testes de integração** (`esquema-m2.test.ts`): as sementes existem (2 mensagens ativas, `unidade_ajustes = 'dias'`); `ajustes_periodo` recusa `dias = 0`, `dias = -3` com tipo `extensao`, `dias = 3` com tipo `transferencia_saida`, `unidade_digitada = 'aulas'` sem turma e extensão sem motivo; `UPDATE` que preenche a anulação passa uma vez e a segunda vez falha; `UPDATE` de `dias` e `DELETE` falham (mesmo para o dono da tabela); o mesmo para `periodos_contratados`; anulação com só uma das três colunas falha; duas matrículas abertas no mesmo aluno e turma falham (`matriculas_aberta_unica`), mas uma aberta e uma com saída passam; duas mensagens ativas da mesma finalidade falham; dois bloqueios de contato abertos para a mesma pessoa falham; `instagram = 'Ana Souza'` falha.
- [ ] **Step 2:** `pnpm teste:integracao tests/integracao/esquema-m2.test.ts` → FAIL.
- [ ] **Step 3:** Escrever o esquema Drizzle, gerar a migração (`--name m2_alunos`) e acrescentar à mão ao SQL o preenchimento de `matriculas.entrada`, os gatilhos e as sementes. Ajustar os testes do M0 que usavam `extensoes_periodo` ou a chave composta de `matriculas`.
- [ ] **Step 4:** `pnpm teste:integracao && pnpm tipos && pnpm lint` → PASS (inclusive `migracoes.test.ts`, que sobe tudo do zero).
- [ ] **Step 5: Commit** `feat: esquema do M2 (alunos, planos, livro de ajustes, contatos)`.

---

### Task 3: Estado do período (regras puras)

**Files:**
- Create: `src/servidor/alunos/estado.ts`, `estado.test.ts`

**Interfaces:**
- Consumes: `DataIso`, `somarDias`, `diasEntre` (Tarefa 1).
- Produces:
  - `type PeriodoParaEstado = { id: string; inicio: DataIso; fim: DataIso; diasAjustes: number }` (só períodos não anulados; `diasAjustes` = soma dos ajustes não anulados)
  - `type TrancamentoParaEstado = { id: string; periodoId: string; inicio: DataIso; volta: DataIso | null }` (só não anulados)
  - `type EstadoPeriodo = "encerrado" | "trancado" | "vigente" | "comeca_em_breve" | "vencido" | "sem_periodo"`
  - `type ResumoPeriodo = { estado: EstadoPeriodo; ultimo: (PeriodoParaEstado & { fimEfetivo: DataIso }) | null; trancamentoAberto: TrancamentoParaEstado | null }`
  - `fimEfetivo(p: PeriodoParaEstado): DataIso`
  - `ultimoPeriodo(periodos: PeriodoParaEstado[]): PeriodoParaEstado | null` (maior `inicio`)
  - `calcularEstado(entrada: { encerrado: boolean; periodos: PeriodoParaEstado[]; trancamentos: TrancamentoParaEstado[] }, hoje: DataIso): ResumoPeriodo`
  - `venceEmBreve(r: ResumoPeriodo, hoje: DataIso, janela: number): boolean` (estado `vigente` e `fimEfetivo` do último ≤ `somarDias(hoje, janela)`)
  - `vencidoDesde(r: ResumoPeriodo, hoje: DataIso, dias: number): boolean` (estado `vencido` e `fimEfetivo` do último ≥ `somarDias(hoje, −dias)`)
  - `diasRestantes(r: ResumoPeriodo, hoje: DataIso): number` (= `fimEfetivo − max(hoje, inicio do último) + 1`, 0 se não vigente)

- [ ] **Step 1: Testes** (hoje = `"2026-11-22"` salvo indicação; a ordem de prioridade é a da spec, seção 7):
  - sem períodos → `sem_periodo`; encerrado com período vigente → `encerrado`.
  - período `2026-11-01..2026-11-22` → `vigente` (o último dia conta); `..2026-11-21` → `vencido`; `2026-11-01..2026-11-20` com `diasAjustes: 3` → `vigente`, `fimEfetivo` `"2026-11-23"`.
  - vencido em `2026-10-31` + período futuro `2026-12-01..2026-12-31` → `comeca_em_breve`, e `ultimo.inicio = "2026-12-01"`.
  - vigente até `2026-11-30` + renovação `2026-12-01..2027-02-28` → `vigente`, `venceEmBreve(…, 7)` → `false` (o último termina em fevereiro).
  - `venceEmBreve(…, 7)` com hoje `2026-11-22` (limite `somarDias(hoje, 7)` = `2026-11-29`): fim `2026-11-22` → `true`; fim `2026-11-29` → `true`; fim `2026-11-30` → `false`; com janela 15, fim `2026-11-30` → `true`.
  - trancamento `inicio 2026-11-10`, `volta null` → `trancado`; com `volta 2026-11-22` → não trancado (volta ≤ hoje); com `volta 2026-11-23` → `trancado`; trancamento que começa `2026-11-25` → não trancado hoje.
  - `vencidoDesde`: fim efetivo `2026-08-24` com 90 dias → `true`; `2026-08-23` → `false`.
  - `diasRestantes`: vigente `2026-11-01..2026-11-30` → `9`; com renovação futura `2026-12-01..2026-12-10` → `10` (só o último período).
- [ ] **Step 2:** `pnpm teste src/servidor/alunos/estado.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `estado.ts`.
- [ ] **Step 4:** `pnpm teste src/servidor/alunos && pnpm teste:fuso` → PASS.
- [ ] **Step 5: Commit** `feat: estado do período calculado pelo livro de lançamentos`.

---

### Task 4: Configurações (planos, mensagens prontas, unidade)

**Files:**
- Create: `src/servidor/contatos/mensagens.ts`, `mensagens.test.ts`, `src/servidor/configuracoes/{planos,mensagens-prontas,unidade}.ts`, `tests/integracao/configuracoes.test.ts`, `src/app/painel/configuracoes/{page.tsx,acoes.ts,unidade.tsx,planos/novo/page.tsx,planos/[id]/page.tsx,planos/formulario.tsx,mensagens/nova/page.tsx,mensagens/[id]/page.tsx,mensagens/formulario.tsx}`

**Interfaces:**
- Produces (`mensagens.ts`, puro): `CAMPOS_MENSAGEM = ["nome", "aluno", "turma", "fim"] as const`; `type ValoresMensagem = Record<(typeof CAMPOS_MENSAGEM)[number], string>`; `validarTextoMensagem(texto: string): string | null` (mensagem de erro ou `null`); `preencherMensagem(texto: string, valores: ValoresMensagem): string`; `primeiroNome(nome: string): string`; `juntarLista(itens: string[]): string` (`["Bruno"]` → `"Bruno"`, `["Bruno","Lia"]` → `"Bruno e Lia"`, três → `"Bruno, Lia e Ana"`); `linkConversa(numero: string, texto?: string): string` (`https://wa.me/<numero>?text=<encodeURIComponent(texto)>`); `EXEMPLO_MENSAGEM: ValoresMensagem` = `{ nome: "Carla", aluno: "Bruno", turma: "Forró Iniciante", fim: "08/12" }`.
- Produces (`planos.ts`): `listarPlanos(db, opcoes?: { somenteAtivos?: boolean })` → `{ id; nome; duracaoQuantidade; duracaoUnidade; ordem; ativo; usado: boolean }[]` (ordem, nome); `obterPlano(db, id)`; `salvarPlano(db, dados: { id?: string; nome: string; quantidade: string | number; unidade: string; ordem: string | number; ativo: boolean }): Promise<Resultado<{ id: string }>>`; `excluirPlano(db, id): Promise<Resultado<null>>`; `formatarDuracao(q: number, u: "meses" | "dias"): string` ("1 mês", "3 meses", "15 dias", "1 dia").
- Produces (`mensagens-prontas.ts`): `listarMensagens(db)`; `obterMensagem(db, id)`; `salvarMensagem(db, dados: { id?; nome; finalidade: string; texto; ativa: boolean }): Promise<Resultado<{ id: string }>>` (ativar uma desativa, na mesma transação, a outra ativa da mesma finalidade); `mensagemAtiva(db, finalidade: "renovacao" | "retorno"): Promise<{ id: string; texto: string } | null>`; `excluirMensagem(db, id)` (só se nunca usada em `contatos`; senão `MENSAGEM_EM_USO`).
- Produces (`unidade.ts`): `obterUnidadeAjustes(db): Promise<"dias" | "aulas">`; `salvarUnidadeAjustes(db, unidade: string): Promise<Resultado<null>>`.
- Actions em `configuracoes/acoes.ts`: `salvarUnidadeAcao(estado, form)`, `salvarPlanoAcao(estado, form)`, `excluirPlanoAcao(form)`, `salvarMensagemAcao(estado, form)`, `excluirMensagemAcao(form)`.

- [ ] **Step 1: Testes de `mensagens.ts`:** `validarTextoMensagem("Oi, {nome}! {xyz}")` → `"Campo {xyz} não existe. Use {nome}, {aluno}, {turma} ou {fim}."`; texto vazio → `"Escreva a mensagem."`; com só campos válidos → `null`. `preencherMensagem("Oi, {nome}! {aluno} até {fim}.", { nome: "Carla", aluno: "Bruno e Lia", turma: "x", fim: "08/12" })` → `"Oi, Carla! Bruno e Lia até 08/12."` (campo repetido é trocado todas as vezes). `primeiroNome("Ana Souza")` → `"Ana"`; `primeiroNome("  ana  souza ")` → `"ana"` (preserva a grafia). `linkConversa("5527999990000", "Olá & até {fim}")` → `"https://wa.me/5527999990000?text=Ol%C3%A1%20%26%20at%C3%A9%20%7Bfim%7D"`; sem texto → sem `?text`.
- [ ] **Step 2: Testes de integração** (`configuracoes.test.ts`): plano "Mensal" 1 mês salva; nome repetido com outra caixa → `erros.nome = "Já existe um plano com esse nome."`; quantidade `0`, `"abc"`, `1.5` → `erros.quantidade = "Informe um número inteiro maior que zero."`; unidade `"semanas"` → `erros.unidade = "Escolha meses ou dias."`; excluir plano usado num período → `erros._ = MENSAGEM_EM_USO`; plano não usado → exclui. Mensagem com `{xyz}` → `erros.texto` com a mensagem acima; ativar uma segunda "Renovação" desativa a primeira; `mensagemAtiva(db, "retorno")` devolve a semente; `salvarUnidadeAjustes(db, "aulas")` e `obterUnidadeAjustes` → `"aulas"`; `"horas"` → `erros.unidade`.
- [ ] **Step 3:** Rodar → FAIL.
- [ ] **Step 4:** Implementar serviços, actions e telas. `/painel/configuracoes`: "Contar ajustes em" (rádios dias/aulas + "Salvar"), lista de planos (nome, duração, situação, "Editar"; vazio: "Nenhum plano cadastrado. Cadastre os planos que o estúdio vende; eles aparecem ao registrar um período.") e lista de mensagens (nome, finalidade "Renovação"/"Convite para voltar", situação). Formulário de mensagem: texto (`<textarea>`), lista dos campos disponíveis abaixo do campo e prévia com `EXEMPLO_MENSAGEM` renderizada no servidor depois de salvar com erro ou ao abrir a edição.
- [ ] **Step 5:** `pnpm teste && pnpm teste:integracao tests/integracao/configuracoes.test.ts && pnpm lint && pnpm tipos` → PASS.
- [ ] **Step 6: Commit** `feat: configurações (planos, mensagens prontas e unidade dos ajustes)`.

---

### Task 5: Cadastro de alunos e responsáveis

**Files:**
- Create: `src/servidor/alunos/cadastro.ts`, `tests/integracao/cadastro-alunos.test.ts`

**Interfaces:**
- Consumes: `normalizarWhatsapp`, `normalizarEmail`, `normalizarInstagram`, `ehMenor`, `ehDataIso` (Tarefa 1); tabelas da Tarefa 2.
- Produces:
  - `type DadosAluno = { nome: string; nascimento: string; whatsapp?: string; email?: string; instagram?: string; responsavel?: { pessoaId?: string; novo?: boolean; nome?: string; whatsapp?: string; email?: string }; confirmarWhatsappRepetido?: boolean }`
  - `type ValorCadastroAluno = { tipo: "criado"; alunoId: string } | { tipo: "pessoa-existente"; pessoaId: string; nome: string; jaAluno: boolean } | { tipo: "responsavel-existente"; pessoaId: string; nome: string } | { tipo: "whatsapp-repetido"; pessoaId: string; nome: string }`
  - `cadastrarAluno(db, dados: DadosAluno & { turmaIds?: string[] }, feitoPor: string, hoje: DataIso): Promise<Resultado<ValorCadastroAluno>>` — grava pessoa, papel `aluno`, responsável (e papel `responsavel`) e matrículas com entrada `hoje`, numa transação.
  - `tornarAluno(db, pessoaId: string): Promise<Resultado<null>>`
  - `atualizarAluno(db, alunoId: string, dados: DadosAluno, hoje: DataIso): Promise<Resultado<null>>` (troca de responsável substitui a ligação)
  - `encerrarAluno(db, a: { alunoId: string; data: string; motivo?: string; feitoPor: string }): Promise<Resultado<null>>` (encerra as matrículas abertas com `saida = data`, desativa o papel, grava `encerramentos_aluno` tipo `encerramento`)
  - `reabrirAluno(db, a: { alunoId: string; feitoPor: string; hoje: DataIso }): Promise<Resultado<null>>` (reativa o papel; grava `reabertura`)
  - `podeExcluirAluno(db, alunoId): Promise<boolean>`; `excluirAluno(db, alunoId): Promise<Resultado<null>>` (sem período, matrícula, ajuste, contato, encerramento nem dependentes; com outros papéis, só tira o papel `aluno`; com login, nunca apaga a pessoa)
  - `MENSAGEM_ENCERRADO = "Este aluno está encerrado. Reabra o cadastro antes."` e `alunoAtivoOuErro(tx, alunoId): Promise<Resultado<null>>` (usado pelas Tarefas 6 a 10)

Regras: nome, nascimento (`ehDataIso`, não futuro) obrigatórios; adulto exige WhatsApp; menor exige responsável com nome e WhatsApp (o WhatsApp do menor é opcional); e-mail que já pertence a outra pessoa → no cadastro, `pessoa-existente` (oferece `tornarAluno`), na edição, `erros.email = "Esse e-mail já pertence a {nome}."`; responsável sem `pessoaId` e sem `novo`: se o e-mail informado pertence a alguém, ou se exatamente uma pessoa tem aquele WhatsApp, devolve `responsavel-existente` sem gravar; WhatsApp do aluno igual ao de outra pessoa sem `confirmarWhatsappRepetido` → `whatsapp-repetido` sem gravar.

- [ ] **Step 1: Testes de integração** (um `it` por regra acima, com as mensagens: `"Informe o nome."`, `"Informe a data de nascimento."`, `"A data de nascimento não pode ser no futuro."`, `"Informe o WhatsApp."`, `"WhatsApp inválido. Use DDD e número."`, `"Instagram inválido."`, `"Informe o responsável."`, `"Informe o WhatsApp do responsável."`), mais: menor com responsável novo grava as duas pessoas, os dois papéis e a ligação; segundo filho com `responsavel.pessoaId` reaproveita a mesma pessoa; adulto cadastrado com duas turmas tem duas matrículas abertas com entrada `hoje`; encerrar fecha as matrículas e desativa o papel; reabrir reativa sem reabrir matrículas; `excluirAluno` recusa quem tem período (`MENSAGEM_EM_USO`) e apaga quem não tem nada; excluir professor-aluno só tira o papel `aluno`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar `cadastro.ts` (validação com zod + `errosDeZod`, erros do banco com `executarTraduzindo`). **Step 4:** Rodar → PASS.
- [ ] **Step 5: Commit** `feat: cadastro de alunos e responsáveis`.

---

### Task 6: Matrículas

**Files:**
- Create: `src/servidor/alunos/matriculas.ts`, `tests/integracao/matriculas.test.ts`

**Interfaces:**
- Consumes: `alunoAtivoOuErro`, `MENSAGEM_ENCERRADO` (Tarefa 5).
- Produces: `matricular(db, a: { alunoId; turmaId; entrada: string; feitoPor }): Promise<Resultado<{ matriculaId: string }>>`; `tirarDaTurma(db, a: { matriculaId; saida: string; feitoPor }): Promise<Resultado<null>>`; `trocarDeTurma(db, a: { matriculaId; novaTurmaId; data: string; feitoPor }): Promise<Resultado<{ matriculaId: string }>>`; `moverAlunosDaTurma(db, a: { deTurmaId; paraTurmaId; data: string; feitoPor }): Promise<Resultado<{ movidos: number }>>`; `contarMatriculasAbertas(db): Promise<Map<string, number>>`.

- [ ] **Step 1: Testes:** matricular em turma ativa → aberta; de novo na mesma turma → `erros.turmaId = "Já está nesta turma."`; turma desativada → `erros.turmaId = "Escolha uma turma ativa."`; aluno encerrado → `erros._ = MENSAGEM_ENCERRADO`; tirar com saída antes da entrada → `erros.saida = "A saída não pode ser antes da entrada."`; tirar de matrícula já fechada → `erros._ = "Essa matrícula já foi encerrada."`; depois de tirar, matricular de novo cria outra linha (as duas existem); trocar fecha uma e abre a outra com a mesma data, numa transação (se a nova turma já tem matrícula aberta do aluno, nada muda); mover três alunos (um deles já na turma de destino) → `movidos: 2`, os três saem da origem; `contarMatriculasAbertas` conta só abertas.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: matrículas com entrada e saída`.

---

### Task 7: Períodos, extensão individual e anulações

**Files:**
- Create: `src/servidor/alunos/periodos.ts`, `tests/integracao/periodos.test.ts`

**Interfaces:**
- Consumes: Tarefas 1, 3 e 5; `obterUnidadeAjustes` não é usado aqui (a tela decide o padrão).
- Produces:
  - `carregarPeriodosDoAluno(tx, alunoId): Promise<{ periodos: PeriodoParaEstado[]; trancamentos: TrancamentoParaEstado[] }>` (só não anulados; usado também pelas Tarefas 8 a 10)
  - `travarAluno(tx, alunoId): Promise<void>` (`select id from pessoas where id = $1 for update`)
  - `sugestaoDePeriodo(db, alunoId, hoje): Promise<{ planoId: string | null; inicio: DataIso; inicioMinimo: DataIso | null }>` (plano do último período; início = dia seguinte ao fim efetivo do último se ele termina hoje ou depois, senão `hoje`; `inicioMinimo` = dia seguinte ao fim efetivo do último)
  - `registrarPeriodo(db, a: { alunoId; planoId: string; inicio: string; fim: string; feitoPor }): Promise<Resultado<{ periodoId: string }>>`
  - `estender(db, a: { alunoId; quantidade: string | number; unidade: string; turmaId?: string; motivo: string; feitoPor }, hoje): Promise<Resultado<{ ajusteId: string; dias: number; fimAntes: DataIso; fimDepois: DataIso }>>`
  - `diasDoAjuste(tx, a: { alunoId; quantidade: number; unidade: "dias" | "aulas"; turmaId?: string }): Promise<Resultado<{ dias: number; turmaConversaoId: string | null }>>` (usado pelas Tarefas 9 e 10)
  - `anularAjuste(db, a: { ajusteId; motivo; feitoPor }): Promise<Resultado<null>>`; `anularPeriodo(db, a: { periodoId; motivo; feitoPor }): Promise<Resultado<null>>`

- [ ] **Step 1: Testes:**
  - registrar com plano ativo → período com `origem = 'plano'`, `criado_por` preenchido; plano desativado → `erros.planoId = "Escolha um plano ativo."`; fim antes do início → `erros.fim = "O fim precisa ser depois do início."`; aluno encerrado → `MENSAGEM_ENCERRADO`.
  - sobreposição: último vai até `2026-12-08` (com uma extensão de +7) e novo começa em `2026-12-08` → `erros.inicio = "O período atual vai até 08/12. O novo precisa começar a partir de 09/12."`; começando `2026-12-09` → ok; começando em `2027-01-10` (com intervalo) → ok.
  - duas chamadas simultâneas de `registrarPeriodo` para o mesmo aluno e o mesmo início (`Promise.all`) → uma `ok`, outra com o erro de sobreposição; no banco, um período só.
  - `sugestaoDePeriodo`: vigente até `2026-12-08` → início `2026-12-09` e o plano do último; vencido → `hoje`; sem período → `hoje`, `planoId: null`.
  - estender 5 dias → ajuste `extensao`, `dias 5`, `unidade_digitada 'dias'`, `fimDepois` = `fimAntes + 5`; estender 1 aula com uma matrícula aberta em turma de ter e qui → `dias 4`, `turma_conversao_id` = a turma; com duas matrículas e sem `turmaId` → `erros.turmaId = "Escolha a turma das aulas."`; em aulas sem matrícula → `erros.unidade = "Sem turma, informe em dias."`; sem período → `erros._ = "Este aluno ainda não tem período."`; motivo vazio → `erros.motivo = "Informe o motivo."`; quantidade `0` → `erros.quantidade = "Informe um número inteiro maior que zero."`. A extensão vai para o **último** período (com renovação futura, o fim da renovação cresce).
  - `anularAjuste` de extensão → fim volta; de novo → `erros._ = "Isso já foi anulado."`; motivo vazio → `erros.motivo = "Informe o motivo."`; ajuste com `transferenciaId` → `erros._ = "Este lançamento faz parte de uma transferência. Anule a transferência."`; com `trancamentoId` → `"Este lançamento faz parte de um trancamento. Anule o trancamento."`; ajuste de lote → pode ser anulado individualmente.
  - `anularPeriodo` sem lançamentos vivos → anulado (some de `carregarPeriodosDoAluno`); com uma extensão viva → `erros._ = "Este período tem 1 lançamento: +5 dias (feriado). Anule-o antes."` (plural: `"tem 2 lançamentos: … e … Anule-os antes."`, cada item no formato do histórico da Tarefa 12: sinal, dias, motivo entre parênteses); período de origem `transferencia` → `erros._ = "Este período veio de uma transferência. Anule a transferência."`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (toda escrita numa transação com `travarAluno`; validação de sobreposição contra o fim efetivo do último período lido dentro da transação). → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: períodos, extensão individual e anulações pelo livro de lançamentos`.

---

### Task 8: Trancamentos

**Files:**
- Create: `src/servidor/alunos/trancamentos.ts`, `tests/integracao/trancamentos.test.ts`

**Interfaces:**
- Consumes: `travarAluno`, `carregarPeriodosDoAluno` (Tarefa 7); `calcularEstado` (Tarefa 3).
- Produces: `trancar(db, a: { alunoId; inicio: string; volta?: string; motivo?: string; feitoPor }, hoje): Promise<Resultado<{ trancamentoId: string }>>`; `destrancar(db, a: { trancamentoId; volta: string; feitoPor }): Promise<Resultado<{ dias: number }>>`; `anularTrancamento(db, a: { trancamentoId; motivo; feitoPor }): Promise<Resultado<null>>`.

- [ ] **Step 1: Testes** (hoje `2026-11-22`, período `2026-11-01..2026-11-30`):
  - trancar de `2026-12-01` com volta `2026-12-20` → trancamento + ajuste `trancamento` de `19` dias ligado a ele, no último período; fim efetivo `2026-12-19`.
  - trancar aberto de `2026-11-22` → sem ajuste; estado `trancado`; `destrancar` com volta `2026-12-02` → ajuste de `10` dias, `destrancado_em` preenchido; destrancar de novo → `erros._ = "Este trancamento já foi encerrado."`; volta ≤ início → `erros.volta = "A volta precisa ser depois do início."`.
  - segundo trancamento enquanto há um aberto → `erros._ = "Já existe um trancamento aberto."`; trancamento que se sobrepõe a outro fechado → `erros.inicio = "Já existe um trancamento nesse intervalo."`.
  - início fora do último período (antes do início ou depois do fim efetivo) → `erros.inicio = "O início precisa estar dentro do período (01/11 a 30/11)."`; aluno vencido ou sem período → `erros._ = "Só é possível trancar um período vigente ou que vai começar."`; encerrado → `MENSAGEM_ENCERRADO`.
  - anular trancamento fechado → anula também o ajuste (fim volta); anular aberto → estado deixa de ser `trancado`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: trancamento do período`.

---

### Task 9: Transferências

**Files:**
- Create: `src/servidor/alunos/transferencias.ts`, `tests/integracao/transferencias.test.ts`

**Interfaces:**
- Consumes: `travarAluno`, `carregarPeriodosDoAluno`, `diasDoAjuste` (Tarefa 7); `calcularEstado`, `diasRestantes` (Tarefa 3).
- Produces: `transferir(db, a: { deAlunoId; paraAlunoId; quantidade: string | number; unidade: string; turmaId?: string; motivo: string; inicioRecebedor?: string; feitoPor }, hoje): Promise<Resultado<{ transferenciaId: string; dias: number }>>`; `anularTransferencia(db, a: { transferenciaId; motivo; feitoPor }): Promise<Resultado<null>>`.

- [ ] **Step 1: Testes** (hoje `2026-11-22`; Ana vigente `2026-11-01..2026-11-30`, 9 dias restantes):
  - para João vigente: 5 dias → Ana ganha `transferencia_saida −5`, João `transferencia_entrada +5`, as duas linhas com o mesmo `transferencia_id`; fim de Ana `2026-11-25`.
  - para Bia sem período: 5 dias com `inicioRecebedor` `2026-11-24` → período novo de Bia `origem 'transferencia'`, `plano_id` nulo, `2026-11-24..2026-11-28`, e `transferencias.periodo_destino_id` aponta para ele; sem `inicioRecebedor` → começa `hoje`.
  - 10 dias → `erros.quantidade = "Ana pode ceder até 9 dias."`; com renovação futura `2026-12-01..2026-12-10` → limite de 10 dias (só o último período).
  - Ana trancada, vencida ou sem período → `erros._ = "Só é possível transferir de um período vigente e não trancado."`; Ana para Ana → `erros.paraAlunoId = "Escolha outra pessoa."`; recebedor ou cedente encerrado → `MENSAGEM_ENCERRADO`.
  - em aulas: 1 aula da turma de ter e qui de Ana → 4 dias.
  - `anularTransferencia` com recebedor vigente → anula as duas linhas; com período criado → anula a saída e o período; se o período criado já tem outro lançamento vivo → `erros._ = "O período recebido já tem outros lançamentos. Anule-os antes."`; se anular a saída faria o período de Ana se sobrepor a um período posterior → `erros._ = "Anular agora faria o período de Ana encostar no próximo. Anule ou corrija o próximo período antes."`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (trava os dois alunos em ordem de id) → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: transferência de dias entre alunos`.

---

### Task 10: Extensão em lote

**Files:**
- Create: `src/servidor/alunos/lotes.ts`, `tests/integracao/lotes.test.ts`

**Interfaces:**
- Consumes: `calcularEstado`, `fimEfetivo` (Tarefa 3); `diasPorAulas` (Tarefa 1); `travarAluno` (Tarefa 7).
- Produces:
  - `type EscopoLote = { tipo: "turmas"; turmaIds: string[] } | { tipo: "estudio" }`
  - `type LinhaPrevia = { alunoId: string; nome: string; fimAntes: DataIso; fimDepois: DataIso; dias: number; turmaConversaoId: string | null }`
  - `previaLote(db, a: { escopo: EscopoLote; quantidade: string | number; unidade: string }, hoje): Promise<Resultado<{ linhas: LinhaPrevia[] }>>` (por nome)
  - `confirmarLote(db, a: { escopo; quantidade; unidade; motivo: string; feitoPor }, hoje): Promise<Resultado<{ loteId: string; alunos: number }>>` (recalcula a prévia dentro da transação)
  - `listarLotes(db): Promise<{ id; criadoEm: Date; criadoPor: string; turmas: string[] /* rótulos */; todoEstudio: boolean; quantidadeDigitada: number; unidadeDigitada: "dias" | "aulas"; motivo: string; alunos: number; anulado: boolean }[]>`
  - `anularLote(db, a: { loteId; motivo; feitoPor }): Promise<Resultado<{ anulados: number }>>`

- [ ] **Step 1: Testes** (hoje `2026-11-22`): turma A (ter e qui) com Ana (vigente), Bruno (vencido), Carla (trancada), Davi (encerrado) e Eva (vigente, também na turma B, de sex); lote de 1 aula nas turmas A e B → prévia só com Ana (`+4`) e Eva (`+7`, a conversão que dá mais dias), uma linha cada; confirmar grava `lotes_extensao`, `lote_turmas` (2) e 2 ajustes `extensao` com `lote_id` e motivo do lote; "estúdio todo" em aulas → `erros.unidade = "No estúdio todo, informe em dias."`; estúdio todo em 3 dias → todos os vigentes não trancados nem encerrados, com ou sem matrícula; sem turma escolhida → `erros.turmaIds = "Escolha ao menos uma turma ou o estúdio todo."`; prévia vazia → confirmar devolve `erros._ = "Nenhum aluno vigente nessas turmas."`; `anularLote` anula as linhas vivas (uma já anulada fica como estava) e devolve `anulados: 1`; anular de novo → `"Isso já foi anulado."`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: extensão em lote por turma ou estúdio todo`.

---

### Task 11: Carga única, listas, dash e contatos (consultas)

**Files:**
- Create: `src/servidor/alunos/carga.ts`, `src/servidor/alunos/listas.ts`, `listas.test.ts`, `tests/integracao/carga-alunos.test.ts`

**Interfaces:**
- Consumes: Tarefas 1, 3 e o esquema.
- Produces (`carga.ts`):
  - `type MatriculaAberta = { matriculaId; turmaId; entrada: DataIso; ritmoId; ritmo: string; moduloId; modulo: string; professorId; professor: string; dias: number[]; horarioInicio: string; rotulo: string /* "Forró Iniciante · ter e qui 19h" */ }`
  - `type PessoaDeContato = { pessoaId: string; nome: string; whatsapp: string | null; ehResponsavel: boolean; usandoNumeroDoResponsavel: boolean; naoQuerContato: boolean }`
  - `type UltimoContato = { grupoId: string; em: Date; por: string; resultado: string | null }`
  - `type AlunoCarregado = { id; nome; whatsapp: string | null; email: string | null; instagram: string | null; nascimento: DataIso; menor: boolean; encerrado: boolean; responsavel: { id; nome; whatsapp: string | null; email: string | null } | null; matriculas: MatriculaAberta[]; periodos: PeriodoParaEstado[]; trancamentos: TrancamentoParaEstado[]; planoUltimo: string | null; resumo: ResumoPeriodo; contato: PessoaDeContato; ultimoContato: UltimoContato | null }`
  - `carregarAlunos(db, hoje: DataIso, opcoes?: { ids?: string[] }): Promise<AlunoCarregado[]>` — no máximo uma consulta por tabela (pessoas com papel `aluno`, responsabilidades, matrículas abertas com turma/ritmo/módulo/professor/dias, períodos não anulados com a soma dos ajustes não anulados, trancamentos não anulados, bloqueios abertos, último contato por pessoa de contato).
  - Pessoa de contato: adulto com WhatsApp → ele; menor → responsável; adulto sem WhatsApp com responsável → responsável com `usandoNumeroDoResponsavel: true`; sem nenhum → ele, com `whatsapp: null`.
- Produces (`listas.ts`, puro):
  - `JANELAS = [7, 15, 30] as const`
  - `type FiltrosAlunos = { busca?: string; turma?: string; ritmo?: string; modulo?: string; professor?: string; periodo?: "vigente" | "vence_em_breve" | "vencido" | "trancado" | "comeca_em_breve" | "sem_periodo"; situacao: "cadastrado" | "inativo"; janela: 7 | 15 | 30 }`
  - `lerFiltrosAlunos(params: Record<string, string | string[] | undefined>): FiltrosAlunos` (valor inválido é ignorado; `situacao` padrão `cadastrado`; `janela` padrão 7; ids que não são uuid são ignorados)
  - `urlAlunos(filtros: Partial<FiltrosAlunos>): string` (ordem fixa: busca, turma, ritmo, modulo, professor, periodo, situacao, janela; omite os padrões)
  - `normalizarBusca(texto: string): string` (minúsculas, sem acento, espaços colapsados)
  - `filtrarAlunos(alunos: AlunoCarregado[], f: FiltrosAlunos, hoje: DataIso): AlunoCarregado[]` (por nome, `localeCompare("pt-BR")`; busca casa nome sem acento, dígitos do WhatsApp — com ou sem 55 — ou e-mail; filtros de turma/ritmo/módulo/professor olham as matrículas abertas)
  - `type Contagem = { id: string; rotulo: string; quantidade: number; url: string }`
  - `contarDash(alunos, hoje, janela): { vigentes: number; vencemEmBreve: number; vencidos90: number; vencidosSemContato: number; trancados: number; semPeriodo: number; por: Record<"turma" | "ritmo" | "modulo" | "professor", Contagem[]> }` (só não encerrados; "por" conta vigentes com matrícula aberta, cada aluno uma vez por grupo; `url` leva a `urlAlunos({ periodo: "vigente", turma|ritmo|modulo|professor: id })`)
  - `type FiltrosContatos = { lista: "vence_em_breve" | "vencido"; janela: 7 | 15 | 30; todos: boolean; semContato: boolean }`, `lerFiltrosContatos(params)`, `urlContatos(f: Partial<FiltrosContatos>): string`
  - `type LinhaContato = { pessoa: PessoaDeContato; alunos: AlunoCarregado[]; recente: UltimoContato | null /* < 7 dias */; ultimoContato: UltimoContato | null }`
  - `linhasDeContato(alunos, f: FiltrosContatos, hoje: DataIso, agora: Date): LinhaContato[]` — `vence_em_breve`: `venceEmBreve(resumo, hoje, janela)`, por fim efetivo crescente; `vencido`: `vencidoDesde(resumo, hoje, 90)` (ou todo `vencido` com `todos`), por fim efetivo decrescente; sem encerrados, trancados, `naoQuerContato`; `semContato`: nenhum contato da pessoa com data em São Paulo depois do fim efetivo do último período; agrupa por `pessoa.pessoaId` (irmãos numa linha); linhas com `recente` vão para o fim, na mesma ordem relativa.

- [ ] **Step 1: Testes de unidade** (`listas.test.ts`, com alunos montados em memória por uma função auxiliar do próprio teste): busca `"joao"` acha "João Souza"; `"27 99999-0000"` acha WhatsApp `5527999990000`; `"ANA@EX"` acha `ana@ex.com`; filtro `periodo: "vence_em_breve"` com janela 15; `situacao: "inativo"` traz só encerrados; `lerFiltrosAlunos({ turma: "xyz", periodo: "qualquer", janela: "99" })` → `{ situacao: "cadastrado", janela: 7 }`; `urlAlunos({ periodo: "vigente", turma: id })` → `"/painel/alunos?turma=<id>&periodo=vigente"`; `contarDash`: os números batem com `filtrarAlunos` pelas `url` geradas (para cada `Contagem` e para vigentes, vence em breve e trancados); `linhasDeContato`: irmãos com o mesmo responsável viram uma linha com `alunos.length === 2`; contatado há 3 dias vai para o fim; `naoQuerContato` some; vencido há 100 dias só aparece com `todos`; `semContato` esconde quem recebeu contato depois do vencimento e mostra quem recebeu antes.
- [ ] **Step 2: Testes de integração** (`carga-alunos.test.ts`): monta pelo banco (serviços das Tarefas 5 a 10) um aluno de cada estado, um menor com responsável, um adulto de 18 anos sem WhatsApp com responsável, um bloqueado; confere `resumo.estado`, `contato` (inclusive `usandoNumeroDoResponsavel`), `matriculas[0].rotulo`, que períodos e ajustes anulados não contam e que `vencidosSemContato` muda depois de um contato inserido direto na tabela.
- [ ] **Step 3:** Rodar → FAIL. **Step 4:** Implementar. **Step 5:** `pnpm teste && pnpm teste:fuso && pnpm teste:integracao tests/integracao/carga-alunos.test.ts` → PASS.
- [ ] **Step 6: Commit** `feat: carga única dos alunos, filtros, dash e listas de contato`.

---

### Task 12: Ficha e histórico

**Files:**
- Create: `src/servidor/alunos/ficha.ts`, `tests/integracao/ficha.test.ts`

**Interfaces:**
- Consumes: `carregarAlunos` (Tarefa 11), `podeExcluirAluno` (Tarefa 5), `formatarDia`, `formatarDuracao`.
- Produces:
  - `type AcaoAnular = { tipo: "ajuste" | "periodo" | "trancamento" | "transferencia" | "lote"; id: string }`
  - `type ItemHistorico = { em: Date; tipo: "periodo" | "ajuste" | "trancamento" | "matricula" | "saida_turma" | "encerramento" | "reabertura"; texto: string; por: string; anulado: { em: Date; por: string; motivo: string } | null; anular: AcaoAnular | null; destrancar?: string /* id do trancamento aberto */ }`
  - `obterFicha(db, alunoId: string, hoje: DataIso): Promise<{ aluno: AlunoCarregado; historico: ItemHistorico[]; matriculasEncerradas: { rotulo: string; entrada: DataIso; saida: DataIso }[]; contatos: { em: Date; por: string; mensagem: string | null; resultado: string | null; grupoId: string }[]; podeExcluir: boolean; naoQuerContato: { em: Date; por: string } | null } | null>` (`null` para id inexistente, não uuid ou pessoa sem papel `aluno`)
  - Textos do histórico (exatos): `"Período Trimestral · 01/09 a 01/12"` (sem plano: `"Período recebido · 24/11 a 28/11"`); `"+5 dias · feriado"`; `"+1 aula (4 dias) · feriado 15/11 · lote Forró Iniciante"` (lote do estúdio: `"· lote estúdio todo"`); `"Trancado de 01/12 a 20/12 (19 dias)"`, aberto: `"Trancado desde 22/11"`; `"−14 dias · transferidos para João Souza"`, `"+14 dias · recebidos de Ana Souza"`; `"Entrou em Forró Iniciante · ter e qui 19h"`, `"Saiu de Forró Iniciante · ter e qui 19h"`; `"Encerrado · mudou de cidade"` (sem motivo: `"Encerrado"`), `"Cadastro reaberto"`. Ordem: mais recente primeiro por `em` (= `criado_em`). `anular` aponta para a entidade certa: linha de lote → `ajuste` (anula só a do aluno), linha de transferência → `transferencia`, linha de trancamento → `trancamento`; já anulado → `null`.

- [ ] **Step 1: Testes:** um aluno com período, extensão, linha de lote, trancamento fechado, trancamento aberto (em outro aluno), transferência cedida, troca de turma e encerramento/reabertura → `historico` com os textos acima, na ordem; item anulado vem com `anulado` e `anular: null`; `obterFicha(db, "xyz", hoje)` e id de professor → `null`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: ficha do aluno com histórico único`.

---

### Task 13: Telas — navegação, lista, cadastro, edição e ficha

**Files:**
- Create: `src/app/painel/paginas-protegidas.test.ts`, `src/app/painel/vitrine/page.tsx`, `src/app/painel/alunos/{page.tsx,filtros.tsx,acoes.ts,formulario.tsx,estado.ts,novo/page.tsx,[id]/page.tsx,[id]/editar/page.tsx}`
- Modify: `src/app/painel/navegacao.tsx`, `src/app/painel/layout.tsx`, `src/app/painel/page.tsx` (só os atalhos saem para `/painel/vitrine`; o dash vem na Tarefa 17)

**Interfaces:**
- Consumes: Tarefas 5, 11 e 12.
- Produces:
  - Navegação para a administração: Início (`/painel`), Alunos (`/painel/alunos`), Contatos (`/painel/contatos`), Configurações (`/painel/configuracoes`), Vitrine (`/painel/vitrine`, ativo também em `/painel/eventos`, `/turmas`, `/ritmos`, `/modulos`, `/professores`). Atendente: só Início.
  - `type EstadoAluno = EstadoFormulario & { existente?: { pessoaId: string; nome: string; jaAluno: boolean }; responsavelExistente?: { pessoaId: string; nome: string }; whatsappRepetido?: { pessoaId: string; nome: string } }`
  - Actions (`alunos/acoes.ts`): `cadastrarAlunoAcao(estado: EstadoAluno, form: FormData): Promise<EstadoAluno>` (sucesso → `/painel/alunos/<id>`), `tornarAlunoAcao(form)`, `atualizarAlunoAcao(estado, form)`.
  - `paginas-protegidas.test.ts`: para todo `page.tsx` sob `src/app/painel/{alunos,contatos,configuracoes,vitrine}/`, a primeira instrução do componente exportado por padrão é `await exigirAdministracao();` (reaproveite o parse com a API do `typescript` do teste das actions, sem alterá-lo); inclui um caso em memória que reprova uma página sem a chamada.

- [ ] **Step 1:** Escrever `paginas-protegidas.test.ts` e rodar → FAIL (pastas ainda não existem: o teste exige ao menos que a checagem reprove o exemplo inválido).
- [ ] **Step 2:** Implementar navegação e `/painel/vitrine` (os cinco atalhos que hoje estão em `painel/page.tsx`).
- [ ] **Step 3: Lista** `/painel/alunos`: busca e filtros num `<form method="get">` (o componente cliente envia ao mudar um `<select>`; sem JS, botão "Filtrar"), filtros vindos de `lerFiltrosAlunos`; linhas com nome (link para a ficha), "(menor)", rótulos das turmas e o estado em texto: `"vence em 12/12"`, `"venceu em 02/11"`, `"trancado desde 22/11"`, `"começa em 01/12"`, `"sem período"`, `"encerrado"`; vazio sem filtros: "Nenhum aluno cadastrado" + "Novo aluno"; vazio com filtros: "Nenhum aluno com esses filtros." + "Limpar filtros".
- [ ] **Step 4: Formulário** (novo e editar), campos e textos da spec (seção 8): nascimento com `<input type="date">`; o bloco "Responsável" aparece quando a data indica menor (componente cliente que usa `ehMenor` com a data digitada e `hojeEmSaoPaulo()` passado pelo servidor; sem JS, o bloco fica sempre visível com a dica "Só para menores de 18 anos"); turmas ativas como caixas de seleção (só no cadastro); as respostas `pessoa-existente`, `responsavel-existente` e `whatsapp-repetido` aparecem como avisos com os botões "Tornar aluno" / "Usar {nome} como responsável" e "Cadastrar outra pessoa" / "Salvar mesmo assim" (campos ocultos `responsavelId`, `responsavelNovo`, `confirmarWhatsappRepetido`).
- [ ] **Step 5: Ficha** `/painel/alunos/[id]` (só leitura nesta tarefa; os botões de ação levam às rotas da Tarefa 14): cabeçalho (nome, idade, WhatsApp formatado com `formatarWhatsapp`, e-mail, `@instagram` com link `https://instagram.com/<usuario>` em nova aba), "Sem e-mail (pedir na ativação)", responsável, aviso "Sem WhatsApp próprio — usando o de {nome} (responsável)", "Não quer contato desde 05/11" quando houver, turmas abertas e encerradas, bloco do período (`"Trimestral · 01/09 a 01/12, estendido até 08/12"`; sem ajustes: `"… 01/09 a 01/12"`), histórico e contatos. Id inválido → `notFound()`.
- [ ] **Step 6:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` → PASS (as actions só traduzem `FormData` para os serviços já testados; os testes estáticos de actions e de páginas cobrem o acesso).
- [ ] **Step 7: Verificar** com `pnpm dev` em 375/768/1280 px: lista vazia, cheia, filtrada e sem resultado; cadastro de adulto, de menor (responsável novo e existente), com WhatsApp repetido e com erros; ficha completa. Uma conta só `atendente` em `/painel/alunos` cai em `/sem-acesso` e não vê os itens novos na navegação.
- [ ] **Step 8: Commit** `feat: telas de alunos (lista, cadastro, edição e ficha)`.

---

### Task 14: Telas — ações da ficha

**Files:**
- Create: em `src/app/painel/alunos/[id]/`: `periodo/page.tsx`, `estender/page.tsx`, `trancar/page.tsx`, `destrancar/[trancamentoId]/page.tsx`, `transferir/page.tsx`, `turmas/page.tsx`, `encerrar/page.tsx`, `anular/page.tsx`, e `src/app/painel/alunos/[id]/acoes.ts`, `src/app/painel/alunos/[id]/formularios/*.tsx` (componentes cliente dos formulários)

**Interfaces:**
- Consumes: Tarefas 5 a 9 e 12; `obterUnidadeAjustes`, `listarPlanos` (Tarefa 4).
- Produces: actions em `[id]/acoes.ts`, todas `(estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>` e redirecionando para `/painel/alunos/<id>` no sucesso: `registrarPeriodoAcao`, `estenderAcao`, `trancarAcao`, `destrancarAcao`, `transferirAcao`, `matricularAcao`, `tirarDaTurmaAcao`, `trocarDeTurmaAcao`, `encerrarAcao`, `reabrirAcao`, `excluirAlunoAcao` (sucesso → `/painel/alunos`), `anularAcao` (lê `tipo` e `alvo` do formulário e chama `anularAjuste` / `anularPeriodo` / `anularTrancamento` / `anularTransferencia`; lotes são anulados na Tarefa 15). As ações de contato da ficha entram na Tarefa 16.

Regras de tela:
- **Período** (`/periodo`): título "Registrar período" ou "Renovar" (se há período); plano (só ativos; sem planos: aviso com link para Configurações), início pré-preenchido por `sugestaoDePeriodo`, fim calculado no navegador com `fimPeloPlano` ao mudar plano ou início (e editável); `?corrigir=<periodoId>` mostra "Corrigir período" e, ao salvar, anula o antigo (motivo "Correção") e registra o novo na mesma action (se a anulação falhar, mostra o erro e não registra).
- **Estender**: quantidade, unidade (padrão `obterUnidadeAjustes`), turma (só se aulas e mais de uma matrícula aberta), motivo; a frase "Fim passa de 08/12 para 12/12" aparece abaixo do botão, calculada no navegador com `diasPorAulas` e os dias por semana de cada turma enviados pelo servidor.
- **Trancar**: início (padrão hoje), "Sei a data de volta" + volta, motivo; **Destrancar**: volta (padrão hoje) e a conta de dias.
- **Transferir**: busca do recebedor (lista de alunos não encerrados filtrada por `normalizarBusca` num `<select>` com busca simples, ou link "Cadastrar novo aluno" que volta para cá com `?para=<id>`), quantidade, unidade, turma, início para quem recebe (só aparece se o recebedor não estiver vigente), motivo, "restam 9 dias".
- **Turmas**: matricular (turmas ativas em que o aluno não está; entrada padrão hoje), e para cada matrícula aberta "Trocar" (nova turma + data) e "Tirar da turma" (data).
- **Encerrar**: data (padrão hoje), motivo opcional; na ficha de encerrado, "Reabrir cadastro". **Excluir**: só aparece quando `podeExcluir`.
- **Anular** (`/anular?tipo=<tipo>&alvo=<id>`): mostra o texto do item do histórico e pede o motivo.

- [ ] **Step 1:** Implementar actions e telas, todas com `EstadoFormulario`, erros ao lado do campo e "Salvando…".
- [ ] **Step 2:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` → PASS (testes estáticos cobrem as novas actions e páginas).
- [ ] **Step 3: Verificar** com `pnpm dev` em 375/768/1280 px: cada formulário com erro e com sucesso, a conta "Fim passa de … para …", correção de período, anulação de cada tipo (inclusive as recusas da Tarefa 7, mostradas como erro geral) e a ficha atualizada depois de cada ação.
- [ ] **Step 4: Commit** `feat: ações da ficha (período, extensão, trancamento, transferência, turmas, encerramento, anulação)`.

---

### Task 15: Telas — estender turma e ajustes nas turmas

**Files:**
- Create: `src/app/painel/alunos/estender-turma/{page.tsx,acoes.ts,formulario.tsx}`, `src/app/painel/alunos/estender-turma/lotes/page.tsx`
- Modify: `src/app/painel/turmas/page.tsx`, `src/app/painel/turmas/[id]/page.tsx`, `src/app/painel/turmas/acoes.ts` (+ `moverAlunosAcao`), `src/app/painel/alunos/page.tsx` (link "Estender turma")

**Interfaces:**
- Consumes: Tarefas 6 e 10.
- Produces (em `estender-turma/acoes.ts`): `previaLoteAcao(estado, form)` (devolve a prévia no estado, sem gravar), `confirmarLoteAcao(estado, form)` (sucesso → `/painel/alunos/estender-turma/lotes`) e `anularLoteAcao(estado, form)` (campos `loteId` e `motivo`); em `turmas/acoes.ts`, `moverAlunosAcao(estado, form)`.

- [ ] **Step 1:** Tela "Estender turma": turmas ativas como caixas + "Estúdio todo", quantidade, unidade, motivo, botão "Ver quem recebe" → prévia ("Vão receber (12)", cada linha `Ana Souza · 08/12 → 12/12 (+4 dias)`) e botão "Confirmar extensão" (envia de novo os mesmos campos; o servidor recalcula). Página de lotes com data, quem fez, turmas (ou "estúdio todo"), quantidade, motivo, número de alunos e, em cada lote vivo, um formulário "Anular lote" com motivo (`anularLoteAcao`); lote anulado aparece riscado com o motivo.
- [ ] **Step 2:** Turmas: coluna "Alunos" com `contarMatriculasAbertas` (link `urlAlunos({ turma: id })`); na edição de uma turma com matrículas abertas, o aviso "12 alunos ainda estão nesta turma." e o formulário "Mover alunos para" (turma ativa + data) — desativar continua permitido, com o aviso visível.
- [ ] **Step 3:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` → PASS.
- [ ] **Step 4: Verificar** em 375/768/1280 px: prévia vazia, prévia com alunos, erro "estúdio todo em aulas", lista de lotes com um anulado, turma com aviso e mover.
- [ ] **Step 5: Commit** `feat: extensão em lote e contagem de alunos nas turmas`.

---

### Task 16: Contatos

**Files:**
- Create: `src/servidor/contatos/contatos.ts`, `tests/integracao/contatos.test.ts`, `src/app/painel/contatos/{page.tsx,acoes.ts,abrir/route.ts}`
- Modify: `src/servidor/auth/acesso.ts` (+ `sessaoDaAdministracao(): Promise<{ pessoaId: string } | null>`, que nunca redireciona, com `sessaoEhAdministracao` passando a usá-la), `src/app/painel/alunos/[id]/acoes.ts` (+ `naoQuerContatoAcao`, `desfazerNaoQuerContatoAcao`), ficha (botões "Chamar no WhatsApp", "Não quer contato" / "Voltou a aceitar contato")

**Interfaces:**
- Consumes: `carregarAlunos` (Tarefa 11), `mensagemAtiva`, `preencherMensagem`, `juntarLista`, `primeiroNome`, `linkConversa` (Tarefa 4), `formatarDia`.
- Produces:
  - `prepararContato(db, a: { alunoIds: string[]; lista: "vence_em_breve" | "vencido" | "ficha" }, hoje): Promise<Resultado<{ pessoa: PessoaDeContato; texto: string | null; mensagemId: string | null; url: string }>>` — todos os alunos precisam ter a mesma pessoa de contato (`erros._ = "Esses alunos não têm o mesmo contato."`); bloqueio → `erros._ = "Esta pessoa pediu para não ser contatada."`; sem WhatsApp → `erros._ = "Cadastre um WhatsApp antes de chamar."`. Finalidade: `vence_em_breve` → `renovacao`, `vencido` → `retorno`, `ficha` → `renovacao` se vigente ou trancado, senão `retorno`. Valores: `nome` = `primeiroNome(pessoa.nome)`, `aluno` = `juntarLista` dos primeiros nomes, `turma` = `juntarLista` dos `ritmo + " " + modulo` distintos das matrículas abertas, `fim` = `juntarLista` dos `formatarDia(fimEfetivo)` distintos. Sem mensagem ativa → `texto: null` e `url` sem `?text`.
  - `registrarContato(db, a: { alunoIds; lista; feitoPor }, hoje): Promise<Resultado<{ url: string; grupoId: string }>>` — chama `prepararContato` e grava uma linha por aluno com o mesmo `grupo_id`, `whatsapp`, `mensagem_id` e `texto`.
  - `marcarResultado(db, a: { grupoId; resultado: string; feitoPor }): Promise<Resultado<null>>` (todas as linhas do grupo; `nao_quer_contato` também abre o bloqueio da pessoa de contato, se ainda não houver)
  - `marcarNaoQuerContato(db, a: { pessoaId; feitoPor })`, `desfazerNaoQuerContato(db, a: { pessoaId; feitoPor })`
  - Rota `POST /painel/contatos/abrir` (form com `target="_blank"`, campos `aluno` repetido e `lista`): confere que o `Origin` é o mesmo host da requisição (senão 403) e que `sessaoDaAdministracao()` não é `null` (senão 403), usa o `pessoaId` dela como `feitoPor`, chama `registrarContato` e responde `303` com `Location` = `url`; erro → `303` para `/painel/contatos?erro=<código>` com a mensagem mostrada na página. (Route handlers não passam pelo teste estático das actions: por isso a checagem de sessão e de origem é explícita e coberta pelo Step 6.)
  - Actions (`contatos/acoes.ts`): `marcarResultadoAcao(form)`.

- [ ] **Step 1: Testes de integração:** `prepararContato` de um adulto vencido → URL `https://wa.me/<whatsapp do aluno>?text=` com a semente "Convite para voltar" preenchida (confira o texto decodificado); de dois irmãos menores → número da mãe, `{nome}` = primeiro nome da mãe, `{aluno}` = `"Bruno e Lia"`; adulto de 18 anos sem WhatsApp → número do responsável; alunos com contatos diferentes → erro; pessoa bloqueada → erro; nome com `&` e acentos codificados corretamente; sem mensagem ativa → URL sem `?text`. `registrarContato` grava 2 linhas com o mesmo `grupo_id`; `marcarResultado(…, "nao_quer_contato")` marca as duas e cria o bloqueio (de novo não cria outro); `desfazerNaoQuerContato` fecha o bloqueio com `desfeito_por`; resultado `"talvez"` → `erros.resultado = "Escolha um resultado da lista."`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar o serviço → **Step 4:** PASS.
- [ ] **Step 5: Tela** `/painel/contatos`: abas "Vencem em breve (6)" e "Vencidos (11)" (links com `urlContatos`), seletor de janela (7/15/30) na primeira, "Últimos 90 dias / Todos" e "Só sem contato desde que venceu" na segunda; linhas com nome(s) ("Carla Lima, mãe de Bruno e Lia"), turmas, `"vence em 12/12"`/`"venceu em 02/11"`, "último contato: 05/11 · vai pensar · Gabriel" ou "último contato: —", "contatado há 3 dias por Gabriel" para as recentes, botão "WhatsApp" (o form da rota) e o seletor de resultado (`marcarResultadoAcao`, rótulos: "vai renovar", "vai pensar", "não respondeu", "não volta", "não quer contato"); com "não volta", link "Encerrar aluno" para a tela de encerrar. Aviso no topo quando não há mensagem ativa da finalidade: "Não há mensagem pronta de {renovação|convite para voltar} ativa. O WhatsApp vai abrir sem texto." com link para Configurações. Vazios: "Ninguém vence nos próximos 7 dias." / "Ninguém venceu nos últimos 90 dias."
- [ ] **Step 6: Verificar** `pnpm teste && pnpm lint && pnpm tipos && pnpm build`; com `pnpm dev`: tocar em "WhatsApp" abre uma aba com o `wa.me` certo e a lista mostra o contato na volta; `curl -X POST localhost:3000/painel/contatos/abrir` sem sessão → `403`; com o cookie de sessão de uma atendente → `403`; com o cookie da administração e `Origin: https://evil.com` → `403`. Telas em 375/768/1280 px.
- [ ] **Step 7: Commit** `feat: contatos para renovação e retorno pelo WhatsApp`.

---

### Task 17: Dash

**Files:**
- Modify: `src/app/painel/page.tsx`
- Create: `src/app/painel/dash/*.tsx` (componentes do dash, se ajudar)

**Interfaces:**
- Consumes: `carregarAlunos`, `contarDash`, `urlAlunos`, `urlContatos`, `lerFiltrosAlunos` (só `janela`) (Tarefa 11); `listarPlanos` (Tarefa 4).

- [ ] **Step 1:** Para a administração, `/painel` mostra o dash da spec (seção 8): saudação, busca (form GET para `/painel/alunos?busca=`), "Novo aluno", as cinco linhas com número e link (`"Períodos vigentes"` → `urlAlunos({ periodo: "vigente" })`; `"Vencem em breve"` com o seletor 7/15/30 (`?janela=` no próprio `/painel`) → `urlContatos({ lista: "vence_em_breve", janela })`; `"Vencidos sem contato"` com o texto `"(dos 11 vencidos nos últimos 90 dias)"` → `urlContatos({ lista: "vencido", semContato: true })`; `"Trancados"` → `urlAlunos({ periodo: "trancado" })`; `"Cadastrados sem período"` → `urlAlunos({ periodo: "sem_periodo" })`) e "Vigentes por" com abas Turma/Ritmo/Módulo/Professor (`?por=` no endereço; padrão turma). Vazio: sem alunos, "Cadastre o primeiro aluno" + "Novo aluno", e, sem planos, "Antes, cadastre os planos do estúdio em Configurações." Atendente: o estado vazio atual, com o texto trocado para "O painel ainda está vazio para o atendimento. A administração cuida dos cadastros por enquanto."
- [ ] **Step 2:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` → PASS.
- [ ] **Step 3: Verificar** com `pnpm dev` e o banco de exemplo da Tarefa 18 que cada número leva a uma lista com exatamente essa quantidade de linhas (contar as linhas na página aberta), em 375/768/1280 px; atendente vê o estado vazio.
- [ ] **Step 4: Commit** `feat: dash do painel`.

---

### Task 18: Verificação final do M2

**Files:**
- Modify: `README.md` (seção "M2: alunos e períodos": rotas novas do painel, como cadastrar planos, alunos, períodos e usar os contatos; checklist de produção pendente), `docs/superpowers/specs/2026-11-22-m2-painel-atendentes-design.md` (marcar os itens verificáveis do "Pronto quando"), `.github/workflows/ci.yml` (só se `teste:fuso` mudou de forma que exija)

- [ ] **Step 1:** Rodar tudo: `pnpm lint && pnpm tipos && pnpm teste && pnpm teste:fuso && pnpm teste:integracao && pnpm build`. Sem Docker local, a imagem é conferida pela CI.
- [ ] **Step 2: Percorrer as telas** com `pnpm dev` e um banco de exemplo cadastrado pelo próprio painel (2 planos; 3 turmas; 12 alunos cobrindo todos os estados, dois irmãos menores com a mesma mãe, um adulto sem WhatsApp com responsável, um bloqueado; um lote; uma transferência; um trancamento aberto; contatos com resultados), com screenshots em 375, 768 e 1280 px de: dash, lista de alunos (filtrada e vazia), cadastro (com cada aviso), ficha, cada ação da ficha, estender turma (prévia e lotes), contatos (duas abas, vazio), configurações (planos e mensagens com erro). Conferir: nada transborda na horizontal em 375 px, foco visível, áreas de toque ≥ 48 px, "Salvando…".
- [ ] **Step 3: Atendente:** com uma conta só `atendente`, todas as rotas novas (`/painel/alunos`, `/painel/alunos/<id>`, `/painel/contatos`, `/painel/configuracoes`, `/painel/vitrine`) redirecionam para `/sem-acesso`, e `POST /painel/contatos/abrir` responde 403.
- [ ] **Step 4:** Atualizar README e o "Pronto quando" do design (os itens de produção continuam pendentes) e anotar no README a pendência do M4 sobre a marca "não quer contato" (spec, seção 12).
- [ ] **Step 5: Commit** `docs: fechamento do M2 (verificação e README)`.
