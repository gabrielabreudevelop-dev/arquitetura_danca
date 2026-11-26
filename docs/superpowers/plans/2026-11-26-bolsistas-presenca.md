# Bolsistas e presença — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A administração cadastra bolsistas (dias combinados com histórico, preferência no par, ativo/inativo), faz a chamada das aulas, acompanha a frequência de cada bolsista contra o combinado e chama no WhatsApp quem não vem há X dias.

**Architecture:** Segue o M2. A **aula** (turma + data) é um registro próprio criado na primeira chamada, que pode ser "não houve aula"; presenças ficam ligadas a ela e nunca são apagadas (desmarcar preenche colunas). As regras de acordo vigente, período ativo, frequência e "sem vir" são funções puras em `src/servidor/bolsistas/regras.ts`; uma carga única (`carregarBolsistas`) alimenta lista, ficha, contatos e dash, como `carregarAlunos` no M2. Os contatos do M2 são generalizados para aceitar bolsistas: a pessoa de contato e o último contato passam a vir de um módulo compartilhado, e listas/finalidades novas entram nos enums.

**Tech Stack:** Node 26, pnpm 10.28, Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind 4, Drizzle ORM 0.45 + drizzle-kit, PostgreSQL 17 (16 local), Better Auth 1.7.27, Zod 4, Vitest, Biome. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-26-bolsistas-presenca-design.md`. Base: spec e código do M2 (`docs/superpowers/specs/2026-11-22-m2-painel-atendentes-design.md`).

## Global Constraints

- Interface, mensagens, comentários e documentação em português do Brasil; nomes do domínio em português.
- Toda tela pensada primeiro para o celular e verificada em 375, 768 e 1280 px com `anthropic-skills:design-craft` e `docs/design.md` (três tamanhos de texto, tokens, estados vazio e erro, "Salvando…" desabilitado, toque ≥ 48 px, listas empilhadas no celular e `<table>` a partir de `md`).
- TDD: teste que falha antes de cada mudança de código.
- **Só a administração.** Toda server action nova começa por `await exigirAdministracao();` e toda página nova também (testes estáticos `src/app/painel/acoes-protegidas.test.ts` e `paginas-protegidas.test.ts` — acrescente as pastas novas `bolsistas` e `chamada` à lista do teste de páginas).
- **"Hoje" em São Paulo** só por `hojeEmSaoPaulo()`; datas como `"AAAA-MM-DD"`; dia da semana 0 = domingo … 6 = sábado (mesma convenção de `turma_dias`).
- **Nada com história é apagado:** presença desmarcada, acordo alterado e mudança de situação ficam registrados com quem e quando.
- Erros de banco: sempre por `executarTraduzindo` / `transacaoComErros` (nenhum dado pessoal no log).
- Formulário com mais de um botão de envio: botão padrão seguro invisível primeiro (padrão `BotaoPadrao` de `src/app/painel/alunos/formulario.tsx`); formulários remontam após resposta do servidor (padrão `useVersao` de `src/app/painel/alunos/[id]/formularios/acompanhar.ts`) para `<select>`/caixas não voltarem ao inicial.
- Migrações novas com `script -qec 'pnpm db:gerar --name <nome>' /dev/null`, ajustadas à mão quando preciso; nunca editar migrações existentes. **O migrador do Drizzle roda todas as migrações pendentes numa transação só** (`node_modules/drizzle-orm/pg-core/dialect.js:60`): um valor acrescentado a um enum com `ALTER TYPE … ADD VALUE` não pode ser usado na mesma rodada.
- Ambiente: `node` = Node 26; Postgres local em localhost:5432 (postgres/postgres; `pg_ctlcluster 16 main start` se parado); `.env.local` já existe. Next.js 16: consultar `node_modules/next/dist/docs/` antes de usar APIs. `AGENTS.md` não é commitado. Screenshots: `node /home/claude/ferramentas/screenshot.mjs <url> <prefixo> "<cookie>"`.
- Commits `tipo: descrição` em português, terminando com as linhas de atribuição da sessão.

## Review Focus

1. **Feriado e esquecimento não viram falta:** dia com todas as aulas "não houve" e dia sem nenhuma chamada não entram no "de" da frequência nem fazem alguém aparecer em "sem vir". Testes na Tarefa 3 e na Tarefa 6.
2. **Acordo mudado no meio do mês:** um bolsista que era de terça até 15/11 e passou a quinta a partir de 16/11 tem os dias combinados contados pela versão vigente em cada data. Teste na Tarefa 3.
3. **Chamada aberta em duas telas:** duas pessoas salvam a mesma chamada; a segunda recebe o aviso "Esta chamada foi salva por outra pessoa…" e nada é sobrescrito sem confirmação. Teste na Tarefa 5.
4. **Dia ou data inválidos no endereço:** `/painel/chamada?data=2026-02-30`, data futura, turma sem aula naquele dia da semana ou id que não é uuid voltam para a escolha do dia com mensagem, sem erro 500. Testes na Tarefa 5 e na Tarefa 10.
5. **Pessoa que é aluno e bolsista:** ganha o papel a mais sem duplicar cadastro, aparece nas duas listas de contato e o aviso "já chamado hoje" vale para as duas. Testes nas Tarefas 4 e 8.

---

## Estrutura de arquivos

```
drizzle/0012_bolsistas.sql                 papel, enums, tabelas, finalidade recriada, semente
src/servidor/banco/esquema/bolsistas.ts    bolsistas, situacoes_bolsista, acordos_bolsista, aulas, presencas_aula
src/servidor/banco/esquema/{pessoas,contatos,index}.ts
src/servidor/alunos/datas.ts               + diaDaSemana
src/servidor/bolsistas/textos.ts           dias curtos/por extenso, preferência (puro)
src/servidor/bolsistas/regras.ts           acordo vigente, ativo em, frequência, sem vir (puro)
src/servidor/pessoas/cadastro-pessoa.ts    validações e responsável compartilhados (extraído de alunos/cadastro.ts)
src/servidor/bolsistas/cadastro.ts         cadastrar, editar, alterar dias, ativar/inativar
src/servidor/bolsistas/chamada.ts          turmas do dia, obter/salvar chamada, não houve aula
src/servidor/bolsistas/carga.ts            carregarBolsistas (fonte única)
src/servidor/bolsistas/listas.ts           filtros, números, linhas "sem vir" (puro)
src/servidor/bolsistas/ficha.ts            ficha e histórico
src/servidor/contatos/pessoa-de-contato.ts pessoa de contato e último contato compartilhados
src/servidor/contatos/{contatos,mensagens,valores}.ts, configuracoes/mensagens-prontas.ts
src/app/painel/bolsistas/...               lista, novo, ficha, editar, dias, situação
src/app/painel/chamada/...                 escolha do dia e chamada
src/app/painel/contatos/..., configuracoes/mensagens/..., dash/..., navegacao.tsx
tests/integracao/{esquema-bolsistas,cadastro-bolsistas,chamada,carga-bolsistas,contatos-bolsistas}.test.ts
```

---

### Task 1: Esquema e migração

**Files:**
- Create: `src/servidor/banco/esquema/bolsistas.ts`, `drizzle/0012_bolsistas.sql` (+ snapshot/journal), `tests/integracao/esquema-bolsistas.test.ts`
- Modify: `src/servidor/banco/esquema/{pessoas,contatos,index}.ts`, `src/servidor/contatos/valores.ts` (listas e resultados), `tests/apoio/fabricas.ts`

**Interfaces (banco):**
- enum `papel` + `bolsista`; `lista_contato` + `bolsista_ausente`, `ficha_bolsista`; `resultado_contato` + `vai_voltar` (esses com `ADD VALUE`, não usados na migração).
- enum `finalidade_mensagem` passa a ter `renovacao`, `retorno`, `bolsista`. **Recriar o tipo** em vez de `ADD VALUE` (a semente usa o valor na mesma rodada): criar `finalidade_mensagem_nova` com os três valores, `ALTER TABLE mensagens_prontas ALTER COLUMN finalidade TYPE finalidade_mensagem_nova USING finalidade::text::finalidade_mensagem_nova`, `DROP TYPE finalidade_mensagem`, `ALTER TYPE finalidade_mensagem_nova RENAME TO finalidade_mensagem`. O snapshot do drizzle-kit fica igual ao do esquema (um enum com três valores); rode `pnpm db:gerar` de novo e confirme "No schema changes".
- enum `preferencia_par` (`os_dois`, `conduzir`, `ser_conduzido`); `tipo_situacao_bolsista` (`ativacao`, `inativacao`); `situacao_aula` (`realizada`, `nao_houve`).
- `bolsistas`: `pessoa_id` pk → pessoas, `preferencia` not null default `os_dois`, `criado_em`.
- `situacoes_bolsista`: `id`, `pessoa_id`, `tipo`, `data date`, `motivo text`, `criado_por` not null, `criado_em`; índice `(pessoa_id, data)`.
- `acordos_bolsista`: `id`, `pessoa_id`, `dias smallint[] not null` (check: `cardinality(dias) >= 1` e todos entre 0 e 6), `vigente_desde date not null`, `criado_por` not null, `criado_em`; índice `(pessoa_id, vigente_desde)`.
- `aulas`: `id`, `turma_id` → turmas, `data date`, `situacao` not null, `motivo text` (check: obrigatório e não vazio se `nao_houve`), `versao integer not null default 1`, `criado_por`, `criado_em`, `alterado_por`, `alterado_em`; único `(turma_id, data)` chamado `aulas_turma_data_unica`.
- `presencas_aula`: `id`, `aula_id` → aulas, `pessoa_id` → pessoas, `marcada_por` not null, `marcada_em` not null default now, `desmarcada_por`, `desmarcada_em` (os dois juntos ou nenhum); único parcial `(aula_id, pessoa_id)` onde `desmarcada_em is null`, chamado `presencas_aula_viva_unica`.
- Semente: mensagem "Bolsista sem vir", finalidade `bolsista`, ativa, texto "Oi, {nome}! Sentimos sua falta nas aulas de {dias}. Tudo bem por aí?".
- `valores.ts`: `LISTAS` ganha `bolsista_ausente`, `ficha_bolsista`; `RESULTADOS` ganha `vai_voltar`.
- Fábricas: `criarBolsista(db, { dias?: number[]; desde?: DataIso; preferencia?; criadoPor; nascimento? })` (pessoa + papel ativo + `bolsistas` + situação `ativacao` na data `desde` + acordo vigente desde `desde`; padrão dias `[2]`, desde `"2026-11-01"`), `criarAula(db, { turmaId, data, situacao?, criadoPor })`, `marcarPresenca(db, { aulaId, pessoaId, por })`.

- [ ] **Step 1: Testes de integração** (`esquema-bolsistas.test.ts`): a semente existe e está ativa; `acordos_bolsista` recusa `dias = '{}'` e `'{7}'`; `aulas` recusa duas linhas para a mesma turma e data e `nao_houve` sem motivo; `presencas_aula` recusa duas vivas para a mesma aula e pessoa mas aceita uma desmarcada e uma viva; desmarcada com só uma das duas colunas falha; as duas mensagens do M2 continuam ativas e com as mesmas finalidades.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Esquema + migração (ajuste manual da finalidade como acima). **Step 4:** `pnpm teste:integracao && pnpm tipos && pnpm lint` → PASS (inclusive `migracoes.test.ts` do zero).
- [ ] **Step 5: Commit** `feat: esquema de bolsistas, aulas e presenças`.

---

### Task 2: Dias da semana e textos

**Files:**
- Create: `src/servidor/bolsistas/textos.ts`, `textos.test.ts`
- Modify: `src/servidor/alunos/datas.ts`, `datas.test.ts`

**Interfaces:**
- `diaDaSemana(data: DataIso): number` (0 = domingo).
- `diasCurtos(dias: number[]): string` → `"ter · qui"` (ordem seg→dom: 1,2,3,4,5,6,0; reaproveite as abreviações de `src/servidor/vitrine/texto.ts` se existirem).
- `diasPorExtenso(dias: number[]): string` → `[2,4]` `"terças e quintas"`; `[2]` `"terças"`; `[1,3,5]` `"segundas, quartas e sextas"`; `[6,0]` `"sábados e domingos"`.
- `ROTULOS_PREFERENCIA: Record<Preferencia, string>` = `{ os_dois: "os dois", conduzir: "prefere conduzir", ser_conduzido: "prefere ser conduzido" }`; `type Preferencia = "os_dois" | "conduzir" | "ser_conduzido"`.

- [ ] **Step 1: Testes:** `diaDaSemana("2026-11-26")` → `4`; `("2026-11-29")` → `0`; os exemplos acima; `diasCurtos([4, 2])` → `"ter · qui"`; `diasCurtos([0, 6])` → `"sáb · dom"`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** `pnpm teste src/servidor && pnpm teste:fuso` PASS (inclua `src/servidor/bolsistas` no script `teste:fuso`).
- [ ] **Step 5: Commit** `feat: dias da semana e textos dos bolsistas`.

---

### Task 3: Regras de acordo, atividade, frequência e "sem vir"

**Files:**
- Create: `src/servidor/bolsistas/regras.ts`, `regras.test.ts`

**Interfaces:**
- `type VersaoAcordo = { dias: number[]; vigenteDesde: DataIso; criadoEm: Date }`
- `type MudancaSituacao = { tipo: "ativacao" | "inativacao"; data: DataIso; criadoEm: Date }`
- `acordoVigenteEm(versoes: VersaoAcordo[], data: DataIso): number[] | null` — maior `vigenteDesde ≤ data`; empate pelo `criadoEm` mais recente.
- `ativoEm(historico: MudancaSituacao[], data: DataIso): boolean` — a última mudança com `data ≤ data` (empate por `criadoEm`) é `ativacao`; sem nenhuma até a data → `false`. Uma inativação com data D vale a partir de D (D não conta como ativo).
- `type Dia = { data: DataIso; comChamada: boolean; presente: boolean }` (comChamada = alguma aula `realizada` naquele dia; presente = presença viva em alguma aula do dia)
- `frequencia(e: { acordos: VersaoAcordo[]; historico: MudancaSituacao[]; dias: Map<DataIso, Dia> }, de: DataIso, ate: DataIso): { combinados: number; presentes: number; fora: number }` — para cada data em `[de, ate]`: conta em `combinados` se ativo na data, o dia da semana está no acordo vigente e `comChamada`; `presentes` se além disso `presente`; `fora` se ativo, `presente` e o dia não estava no acordo vigente.
- `semVir(e: mesma entrada, hoje: DataIso, janela: number): { semVir: boolean; ultimaPresenca: DataIso | null }` — intervalo `[hoje − janela + 1, hoje]`: `semVir` = ativo hoje, ao menos um dia combinado com chamada (ativo) no intervalo e nenhum dia `presente` no intervalo; `ultimaPresenca` = maior data com `presente` em todo o mapa.

- [ ] **Step 1: Testes** (hoje `2026-11-26`, qui):
  - acordo `[2]` desde 01/09 e `[4]` desde 16/11 → `acordoVigenteEm(…, "2026-11-10")` = `[2]`, `("2026-11-19")` = `[4]`, `("2026-08-31")` = `null`; duas versões com o mesmo `vigenteDesde` → a de `criadoEm` mais recente.
  - `ativoEm`: ativação 01/09, inativação 10/11, ativação 20/11 → 05/11 `true`, 10/11 `false`, 15/11 `false`, 20/11 `true`.
  - frequência de novembro (`de "2026-11-01"`, `ate "2026-11-26"`), acordo `[2]` desde 01/09 e `[4]` desde 16/11, ativo desde 01/09; `comChamada: true` em 03, 05, 10, 12, 17 e 26/11; 19/11 sem chamada (fora do mapa); 24/11 `comChamada: false` (não houve aula); `presente` em 03, 05 e 26/11 → `{ combinados: 3, presentes: 2, fora: 1 }` (combinados: 03 e 10 pelo acordo de terça, 26 pelo de quinta; 17 e 24 já não são dias do acordo; 19 não tem chamada; 05 é fora do acordo).
  - mesmo caso com inativação em 08/11 e ativação em 20/11 → `{ combinados: 2, presentes: 2, fora: 1 }` (10/11 sai da conta).
  - `semVir` com janela 15: sem presença desde 03/11 e terças com chamada no intervalo → `true`, `ultimaPresenca "2026-11-03"`; nenhum dia com chamada no intervalo → `false`; inativo hoje → `false`; reativado ontem com chamadas no intervalo só enquanto inativo → `false`; nunca veio → `true`, `ultimaPresenca null`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (iteração por dia com `somarDias`) → **Step 4:** `pnpm teste src/servidor/bolsistas && pnpm teste:fuso` PASS.
- [ ] **Step 5: Commit** `feat: regras de acordo, frequência e sem vir dos bolsistas`.

---

### Task 4: Cadastro de bolsistas

**Files:**
- Create: `src/servidor/pessoas/cadastro-pessoa.ts`, `src/servidor/bolsistas/cadastro.ts`, `tests/integracao/cadastro-bolsistas.test.ts`
- Modify: `src/servidor/alunos/cadastro.ts` (passa a usar o módulo extraído; comportamento idêntico)

**Interfaces:**
- `cadastro-pessoa.ts`: as validações de nome/nascimento/WhatsApp/e-mail/Instagram, o tratamento do responsável (`limparResponsavel`, `ligarResponsavel`, procura de responsável existente) e a detecção de e-mail/WhatsApp de outra pessoa, extraídos de `alunos/cadastro.ts` **sem mudar mensagens nem comportamento** — `tests/integracao/cadastro-alunos.test.ts` passa sem alteração.
- `bolsistas/cadastro.ts`:
  - `type DadosBolsista = DadosAluno & { dias: number[]; preferencia: string }` (`DadosAluno` do M2, sem turmas)
  - `type ValorCadastroBolsista = { tipo: "criado"; bolsistaId: string } | { tipo: "pessoa-existente"; pessoaId: string; nome: string; jaBolsista: boolean } | { tipo: "responsavel-existente"; pessoaId: string; nome: string } | { tipo: "whatsapp-repetido"; pessoaId: string; nome: string }`
  - `cadastrarBolsista(db, dados: DadosBolsista, feitoPor: string, hoje: DataIso): Promise<Resultado<ValorCadastroBolsista>>` — pessoa + papel `bolsista` ativo + `bolsistas` + situação `ativacao` em `hoje` + acordo vigente desde `hoje`, numa transação.
  - `tornarBolsista(db, a: { pessoaId; dias: number[]; preferencia: string; feitoPor }, hoje): Promise<Resultado<null>>` (pessoa já cadastrada: papel + dados + situação + acordo)
  - `atualizarBolsista(db, pessoaId, dados: DadosAluno & { preferencia: string }, hoje): Promise<Resultado<null>>` (dias mudam só por `alterarDias`)
  - `alterarDias(db, a: { pessoaId; dias: number[]; vigenteDesde: string; feitoPor }, hoje): Promise<Resultado<null>>`
  - `mudarSituacao(db, a: { pessoaId; tipo: "ativacao" | "inativacao"; data: string; motivo?: string; feitoPor }, hoje): Promise<Resultado<null>>` (atualiza `pessoa_papeis.ativo` do papel `bolsista` e grava a situação)
  - `MENSAGEM_NAO_BOLSISTA = "Bolsista não encontrado."`
  - Erros: `erros.dias = "Escolha ao menos um dia."` (vazio ou fora de 0–6); `erros.preferencia = "Escolha uma preferência."`; `erros.vigenteDesde` / `erros.data` = `"Informe uma data válida."` e `"A data não pode ser no futuro."`; `mudarSituacao` para a situação atual → `erros._ = "O bolsista já está ativo."` / `"O bolsista já está inativo."`; data antes da última mudança → `erros.data = "A data não pode ser antes da última mudança (dd/mm)."`.
  - Toda escrita trava a pessoa (`travar` do M2).

- [ ] **Step 1: Testes:** cadastro de adulto com dias `[2,4]` e preferência `conduzir` grava os quatro registros; menor exige responsável (mensagens do M2); e-mail de um aluno existente → `pessoa-existente` com `jaBolsista: false`, e `tornarBolsista` dá o papel sem duplicar a pessoa (a pessoa continua com papel `aluno`); `alterarDias` cria uma versão nova e a antiga fica; `mudarSituacao` inativar → `pessoa_papeis.ativo = false` e situação gravada; reativar; as mensagens de erro acima; `cadastro-alunos.test.ts` inalterado e verde.
- [ ] **Step 2:** FAIL → **Step 3:** extrair e implementar → **Step 4:** `pnpm teste:integracao tests/integracao/cadastro-alunos.test.ts tests/integracao/cadastro-bolsistas.test.ts && pnpm lint && pnpm tipos` PASS.
- [ ] **Step 5: Commit** `feat: cadastro de bolsistas reaproveitando o cadastro de pessoas`.

---

### Task 5: Aulas e chamada

**Files:**
- Create: `src/servidor/bolsistas/chamada.ts`, `tests/integracao/chamada.test.ts`

**Interfaces:**
- `turmasDoDia(db, data: DataIso, hoje: DataIso): Promise<Resultado<{ turmaId: string; rotulo: string; situacao: "sem_chamada" | "realizada" | "nao_houve"; presentes: number; motivo: string | null }[]>>` — turmas ativas com aquele dia da semana (mais as desativadas que já têm aula na data), por horário; data inválida/futura → `erros.data`.
- `type LinhaChamada = { pessoaId: string; nome: string; preferencia: Preferencia; presente: boolean }`
- `obterChamada(db, a: { turmaId: string; data: string }, hoje: DataIso): Promise<Resultado<{ aulaId: string | null; versao: number; situacao: "sem_chamada" | "realizada" | "nao_houve"; motivo: string | null; combinados: LinhaChamada[]; extras: LinhaChamada[]; disponiveis: { pessoaId: string; nome: string }[]; contagem: { vieram: number; conduzir: number; ser_conduzido: number; os_dois: number } }>>` — `combinados`: bolsistas ativos na data com o dia no acordo vigente na data (por nome); `extras`: os demais com presença viva nessa aula (inclui inativos com presença antiga); `disponiveis`: bolsistas ativos na data que não estão em nenhuma das listas.
- `salvarChamada(db, a: { turmaId; data; presentes: string[]; versao: number; confirmarVazia?: boolean; feitoPor }, hoje): Promise<Resultado<{ aulaId: string; versao: number }>>` — cria a aula `realizada` se não existir (versão 1), trava a aula, compara `versao` (diferente → `erros._ = MENSAGEM_CHAMADA_MUDOU`), marca os novos e desmarca os que saíram (só presenças de bolsistas: ids que não são bolsista → `erros.presentes = "Só bolsistas podem receber presença."`), incrementa a versão. Lista vazia sem `confirmarVazia` (na primeira chamada ou quando havia presentes) → `erros._ = MENSAGEM_CHAMADA_VAZIA` sem gravar. Aula `nao_houve` → `erros._ = "Esta aula está marcada como “não houve aula”. Desfaça antes."`.
- `marcarNaoHouve(db, a: { turmaId; data; motivo: string; feitoPor }, hoje)` / `desfazerNaoHouve(db, a: { turmaId; data; feitoPor }, hoje)` — com presença viva → `erros._ = "Desmarque as presenças antes de marcar “não houve aula”."`; motivo vazio → `erros.motivo = "Informe o motivo."`.
- Mensagens: `MENSAGEM_CHAMADA_MUDOU = "Esta chamada foi salva por outra pessoa. Confira a chamada atual antes de salvar."`; `MENSAGEM_CHAMADA_VAZIA = "Ninguém veio? Se não houve aula, use “Não houve aula”."`; data futura → `erros.data = "Não dá para fazer chamada de um dia que ainda não chegou."`; turma sem aula nesse dia → `erros.data = "Essa turma não tem aula nesse dia da semana."`; turma desativada sem aula na data → `erros.turmaId = "Escolha uma turma ativa."`; ids/datas inválidos → `"Turma não encontrada."` / `"Informe uma data válida."`.

- [ ] **Step 1: Testes** (hoje `2026-11-26`, turma de ter e qui): combinados pelo acordo vigente na data (bolsista de terça aparece em 24/11, não em 26/11; bolsista de quinta ao contrário); acrescentar um disponível; salvar cria a aula e as presenças; salvar de novo sem um deles desmarca (linha fica com `desmarcada_em`); remarcar cria linha nova; `versao` velha → `MENSAGEM_CHAMADA_MUDOU` e nada muda; duas `salvarChamada` simultâneas com a mesma versão (`Promise.all`) → uma ok, outra com a mensagem; vazia sem confirmação → mensagem e nenhuma aula criada; com `confirmarVazia` → aula `realizada` sem presentes; `marcarNaoHouve` com presença viva → recusa; sem presença → `nao_houve`; `salvarChamada` em aula `nao_houve` → recusa; `desfazerNaoHouve` → `realizada`; data futura, `2026-02-30`, quarta (turma ter/qui) e id inválido → as mensagens acima; contagem por preferência.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: aulas e chamada dos bolsistas`.

---

### Task 6: Carga única, listas e números

**Files:**
- Create: `src/servidor/bolsistas/carga.ts`, `src/servidor/bolsistas/listas.ts`, `listas.test.ts`, `src/servidor/contatos/pessoa-de-contato.ts`, `tests/integracao/carga-bolsistas.test.ts`
- Modify: `src/servidor/alunos/carga.ts` (usa o módulo compartilhado; `carga-alunos.test.ts` inalterado e verde)

**Interfaces:**
- `pessoa-de-contato.ts`: a regra de pessoa de contato (adulto → ele; menor → responsável; adulto sem WhatsApp com responsável → responsável) e a carga do último contato por pessoa e dos bloqueios abertos, extraídas de `alunos/carga.ts`, com a mesma saída (`PessoaDeContato`, `UltimoContato`).
- `type BolsistaCarregado = { id; nome; whatsapp; email; instagram; nascimento: DataIso; menor: boolean; ativo: boolean; preferencia: Preferencia; acordos: VersaoAcordo[]; historico: MudancaSituacao[]; diasHoje: number[] | null; dias: Map<DataIso, Dia>; responsavel: AlunoCarregado["responsavel"]; contato: PessoaDeContato; ultimoContato: UltimoContato | null; mes: { combinados: number; presentes: number; fora: number }; semVir: Record<Janela, { semVir: boolean; ultimaPresenca: DataIso | null }> }`
- `carregarBolsistas(db, hoje: DataIso, opcoes?: { ids?: string[] }): Promise<BolsistaCarregado[]>` — no máximo uma consulta por tabela; `dias` cobre do primeiro dia do mês anterior a hoje − 30 (o que for mais antigo) até hoje; `mes` = `frequencia(…, primeiro dia do mês de hoje, hoje)`.
- `listas.ts`: `type FiltrosBolsistas = { busca?: string; situacao: "ativos" | "inativos"; janela: Janela }`, `lerFiltrosBolsistas(params)`, `urlBolsistas(f)`, `filtrarBolsistas(bolsistas, f)` (busca igual à de alunos, por nome), `contarBolsistas(bolsistas, janela): { ativos: number; porDia: { dia: number; quantidade: number }[]; semVir: number }` (porDia só dias com algum, ordem seg→dom; `semVir` = nº de bolsistas nas linhas de contato abaixo), `linhasBolsistasSemVir(bolsistas, janela, hoje, agora): LinhaBolsista[]` com `type LinhaBolsista = { pessoa: PessoaDeContato; bolsistas: BolsistaCarregado[]; recente: UltimoContato | null; ultimoContato: UltimoContato | null }` — `semVir[janela].semVir`, sem `naoQuerContato`, agrupado por pessoa de contato, ordem pela última presença mais antiga (nunca veio primeiro), recentes (< 7 dias) no fim.

- [ ] **Step 1: Testes de unidade** (`listas.test.ts`): `contarBolsistas` bate com `filtrarBolsistas` e com a soma de `bolsistas.length` das linhas; irmãos menores com o mesmo responsável em uma linha; ordem; recentes no fim; bloqueado fora; `lerFiltrosBolsistas({ situacao: "x", janela: "9" })` → padrões (`ativos`, 15).
- [ ] **Step 2: Testes de integração** (`carga-bolsistas.test.ts`): um bolsista com acordo mudado, inativação no meio do mês, aula `nao_houve` e dia sem chamada → `mes` igual ao calculado à mão; pessoa aluno + bolsista aparece em `carregarAlunos` e em `carregarBolsistas` com a mesma `contato.pessoaId`; `carga-alunos.test.ts` inalterado verde.
- [ ] **Step 3:** FAIL → **Step 4:** implementar → **Step 5:** `pnpm teste && pnpm teste:fuso && pnpm teste:integracao tests/integracao/carga-alunos.test.ts tests/integracao/carga-bolsistas.test.ts` PASS.
- [ ] **Step 6: Commit** `feat: carga única dos bolsistas e listas`.

---

### Task 7: Ficha do bolsista

**Files:**
- Create: `src/servidor/bolsistas/ficha.ts`, `tests/integracao/ficha-bolsista.test.ts`

**Interfaces:**
- `obterFichaBolsista(db, pessoaId: string, hoje: DataIso): Promise<{ bolsista: BolsistaCarregado; versoes: { dias: number[]; desde: DataIso; ate: DataIso | null }[]; meses: { mes: string /* "nov" */; combinados: number; presentes: number; fora: number }[]; presencas: { data: DataIso; rotulo: string }[] /* últimas 20 */; historico: { em: Date; texto: string; por: string }[]; contatos: { em: Date; por: string; mensagem: string | null; resultado: string | null; grupoId: string }[]; naoQuerContato: { em: Date; por: string } | null } | null>` — `meses`: mês atual e os anteriores (até 6) com dia combinado ou presença; histórico: "Ativado", "Inativado · motivo", "Dias: ter · qui (desde 01/11)", em ordem decrescente (mudança de preferência não tem histórico); `null` para id inválido ou pessoa sem papel `bolsista`.

- [ ] **Step 1: Testes:** versões com `ate` = véspera da próxima; meses; presenças com rótulo "Forró Iniciante · ter 19h"; histórico; `null` para aluno sem papel de bolsista.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: ficha do bolsista`.

---

### Task 8: Contatos de bolsistas e mensagem por finalidade

**Files:**
- Create: `tests/integracao/contatos-bolsistas.test.ts`
- Modify: `src/servidor/contatos/{contatos,mensagens,pedido-abrir}.ts`, `src/servidor/configuracoes/mensagens-prontas.ts`, testes de unidade correspondentes

**Interfaces:**
- `mensagens.ts`: `CAMPOS_POR_FINALIDADE: Record<Finalidade, readonly string[]>` = `{ renovacao: ["nome","aluno","turma","fim"], retorno: [mesmos], bolsista: ["nome","dias"] }`; `validarTextoMensagem(texto, finalidade)` → `"Campo {xyz} não existe. Use {nome} ou {dias}."` para bolsista (lista dos campos da finalidade, juntada com ", " e " ou "); `EXEMPLO_MENSAGEM` ganha `dias: "terças e quintas"`.
- `mensagens-prontas.ts`: `Finalidade = "renovacao" | "retorno" | "bolsista"`; validação passa a finalidade.
- `contatos.ts`: `prepararContato` / `registrarContato` aceitam `lista` `bolsista_ausente` e `ficha_bolsista` com `alunoIds` = ids de bolsistas (carregados por `carregarBolsistas`): inativo → `erros._ = "Este bolsista está inativo. Reative antes."`; finalidade `bolsista`; valores `{ nome: primeiroNome(pessoa), dias: diasPorExtenso(união dos dias vigentes hoje) }`. O resto (bloqueio, sem WhatsApp, trava da pessoa, aviso "recente" entre listas por pessoa de contato) é o mesmo código do M2.
- `marcarResultado`: `vai_voltar` aceito para contatos de bolsista; `vai_renovar` recusado para eles (`erros.resultado = "Escolha um resultado da lista."`).
- `pedido-abrir.ts`: aceita as listas novas; volta de erro da ficha do bolsista para `/painel/bolsistas/<id>?erro=…`, da lista para a aba de bolsistas.

- [ ] **Step 1: Testes:** URL `wa.me` com a semente preenchida (`"Oi, Bruno! Sentimos sua falta nas aulas de terças e quintas. Tudo bem por aí?"`); menor → responsável; irmãos bolsistas → `{dias}` com a união; inativo recusado; aluno vencido chamado hoje por outra pessoa da equipe → contato como bolsista volta com `MENSAGEM_RECENTE`; mensagem de bolsista com `{fim}` recusada; mensagem de renovação com `{dias}` recusada; `vai_voltar` ok / `vai_renovar` recusado; testes do M2 (`contatos.test.ts`, `pedido-abrir.test.ts`, `mensagens.test.ts`, `configuracoes.test.ts`) verdes, ajustados só onde a assinatura de `validarTextoMensagem` mudou.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** `pnpm teste && pnpm teste:integracao` PASS.
- [ ] **Step 5: Commit** `feat: contatos de bolsistas e campos de mensagem por finalidade`.

---

### Task 9: Telas — bolsistas

**Files:**
- Create: `src/app/painel/bolsistas/{page.tsx,acoes.ts,formulario.tsx,novo/page.tsx,[id]/page.tsx,[id]/editar/page.tsx,[id]/dias/page.tsx,[id]/situacao/page.tsx,[id]/acoes.ts}` (+ componentes cliente onde precisar)
- Modify: `src/app/painel/navegacao.tsx` (Bolsistas, Chamada), `src/app/painel/paginas-protegidas.test.ts` (pastas `bolsistas`, `chamada`)

**Interfaces:** consome Tarefas 4, 6, 7 e as ações de contato da ficha do aluno como modelo (Tarefa 16 do M2). Actions: `cadastrarBolsistaAcao`, `tornarBolsistaAcao`, `atualizarBolsistaAcao`, `alterarDiasAcao`, `mudarSituacaoAcao`, `naoQuerContatoBolsistaAcao`, `desfazerNaoQuerContatoBolsistaAcao` — `(EstadoFormulario-like, FormData) => Promise<…>`, como as do M2.

- [ ] **Step 1:** Telas conforme a spec seção 8 (lista com números, filtros e vazio; formulário igual ao de aluno, sem turmas, com caixas dos dias seg→dom e rádio de preferência; ficha com dias e versões, frequência por mês, presenças recentes, contatos, histórico e botões Editar / Alterar dias / Inativar ou Reativar / Chamar no WhatsApp (rota `POST /painel/contatos/abrir` com `lista=ficha_bolsista`, `visto` e `confirmar` como na ficha do aluno) / Não quer contato).
- [ ] **Step 2:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` PASS.
- [ ] **Step 3: Verificar** em 375/768/1280: lista vazia e cheia, cadastro com erros e com pessoa existente, ficha, alterar dias, inativar; atendente → `/sem-acesso`.
- [ ] **Step 4: Commit** `feat: telas de bolsistas`.

---

### Task 10: Telas — chamada

**Files:**
- Create: `src/app/painel/chamada/{page.tsx,acoes.ts,formulario.tsx,[turmaId]/page.tsx}` (endereço da chamada: `/painel/chamada/<turmaId>?data=AAAA-MM-DD`; a escolha do dia: `/painel/chamada?data=…`)

**Interfaces:** consome a Tarefa 5. Actions: `salvarChamadaAcao`, `naoHouveAcao`, `desfazerNaoHouveAcao`.

- [ ] **Step 1:** Escolha do dia ("‹ dia anterior", "hoje", sem futuro) com as turmas do dia e a situação de cada uma; chamada com contagem no topo, combinados, extras, seletor "Adicionar bolsista" (lista de `disponiveis` com busca), "Salvar chamada" (botão padrão), confirmação de chamada vazia (segundo envio com `confirmarVazia=1`), aviso de chamada salva por outra pessoa (mostra a atual e permite salvar de novo), "Não houve aula" com motivo e "Desfazer". Endereço inválido → volta à escolha com a mensagem (sem 500).
- [ ] **Step 2:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` PASS.
- [ ] **Step 3: Verificar** em 375/768/1280: dia sem turmas, turmas com e sem chamada, chamada com combinados e extras, vazia com confirmação, conflito em duas abas, não houve aula; `?data=2026-02-30`, futuro e quarta para turma ter/qui.
- [ ] **Step 4: Commit** `feat: tela de chamada`.

---

### Task 11: Contatos, configurações e dash

**Files:**
- Modify: `src/app/painel/contatos/{page.tsx,formularios.tsx,acoes.ts,textos.ts}`, `src/app/painel/configuracoes/mensagens/formulario.tsx`, `src/app/painel/dash/{numeros.tsx,endereco.ts}`, `src/app/painel/page.tsx`, `src/servidor/alunos/listas.ts` (`urlContatos`/`lerFiltrosContatos` com a aba `bolsista_ausente`)

- [ ] **Step 1:** Aba "Bolsistas sem vir" em `/painel/contatos` (filtro 7/15/30, total de bolsistas, linhas da Tarefa 6 com dias, última presença, frequência do mês, último contato, WhatsApp, resultados de bolsista — "vai voltar", "vai pensar", "não respondeu", "não volta" com link "Inativar bolsista", "não quer contato"); finalidade "Bolsista sem vir" no formulário de mensagens com a lista de campos da finalidade; dash com "Bolsistas ativos N →" (`urlBolsistas`) e "Bolsistas sem vir há 15 dias N →" (aba), números iguais às listas (teste de unidade de `endereco`/contagem, como no M2).
- [ ] **Step 2:** `pnpm teste && pnpm lint && pnpm tipos && pnpm build` PASS.
- [ ] **Step 3: Verificar** em 375/768/1280 e conferir que cada número do dash bate com a lista aberta.
- [ ] **Step 4: Commit** `feat: contatos de bolsistas, mensagem e números no dash`.

---

### Task 12: Verificação final

**Files:** Modify: `README.md` (seção "Bolsistas e presença": rotas, como cadastrar, combinar dias, fazer a chamada, usar a lista de contato; pendências de produção), `docs/superpowers/specs/2026-11-26-bolsistas-presenca-design.md` (marcar o "Pronto quando" verificado).

- [ ] **Step 1:** `pnpm lint && pnpm tipos && pnpm teste && pnpm teste:fuso && pnpm teste:integracao && pnpm build` → tudo verde.
- [ ] **Step 2:** Percorrer todas as telas novas e as alteradas com um banco de exemplo (8 bolsistas cobrindo acordo mudado, inativo, menor com responsável, aluno + bolsista, sem vir, nunca veio; duas semanas de chamadas com um feriado e um dia esquecido), em 375/768/1280; atendente sem acesso. Sem corrigir código: achados vão para o relatório.
- [ ] **Step 3:** README e "Pronto quando" (produção continua pendente).
- [ ] **Step 4: Commit** `docs: fechamento de bolsistas e presença`.
