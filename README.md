# Arquitetura da Dança

Plataforma web responsiva, pensada primeiro para o celular, do estúdio de dança: alunos matriculados reveem em vídeo os passos ensinados pelos professores (por ritmo e módulo), acompanham eventos e participam da comunidade. A grade de horários e a divulgação de eventos ficam abertas ao público. A equipe gerencia alunos, turmas, períodos contratados e consentimentos de contato num painel, que substitui a planilha atual. O M0 entrega a base (banco, autenticação da equipe, painel inicial, backups e operação em produção), o M1 a vitrine pública, o M2 o painel de alunos e períodos e o marco "Bolsistas e presença" o cadastro de bolsistas, a chamada das aulas e a lista de quem não está vindo.

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
- `src/servidor/`: código de servidor (`banco`, `auth`, `equipe`, `pessoas`, `alunos`, `bolsistas`, `contatos`, `configuracoes`, `cadastros`, `vitrine`, ambiente e saúde).
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

## Bolsistas e presença

Marco combinado entre o M2 e o M3 (`docs/superpowers/specs/2026-11-26-bolsistas-presenca-design.md`). Bolsistas são pessoas que frequentam as aulas sem pagar, para aumentar a turma e ajudar a formar pares. A administração cadastra cada bolsista, combina os dias da semana em que ele vem, faz a chamada das aulas no painel e chama no WhatsApp quem não está vindo. Só a administração usa este marco: a atendente cai em `/sem-acesso` em `/painel/bolsistas` (e todas as páginas abaixo dela), `/painel/chamada` (e a chamada de cada turma) e, como no M2, em `/painel/contatos` e `/painel/configuracoes`; `POST /painel/contatos/abrir` responde 403 para ela. Em `/painel` ela continua entrando, mas vê só o início vazio do atendimento, sem os números de bolsistas e sem links novos na navegação. O bolsista não tem login nem QR code. Nenhum dado de bolsista aparece em página pública (conferido por inspeção do código: nada fora de `src/app/painel` lê bolsistas, aulas ou presenças).

**Rotas do painel (só administração)**

- `/painel/bolsistas`: ativos por dia combinado e "sem vir" (7, 15 ou 30 dias, padrão 15; o número abre a aba de contatos), com busca por nome e filtro ativos/inativos. Cada linha mostra dias, preferência no par e a frequência do mês ("nov: 5 de 8 · +1 fora"). `/novo` cadastra.
- `/painel/bolsistas/[id]`: ficha com preferência, dias combinados (e os anteriores), frequência por mês, presenças recentes, contatos e histórico ("Ativado desde…", mudanças de dias, inativações). Ações em páginas próprias: `/editar`, `/dias` (alterar dias) e `/situacao` (inativar ou reativar).
- `/painel/chamada?data=AAAA-MM-DD`: escolha do dia (padrão hoje) com as turmas ativas daquele dia da semana e a situação de cada aula. `/painel/chamada/[turmaId]?data=AAAA-MM-DD` é a chamada de uma aula.
- `/painel/contatos?lista=bolsista_ausente&janela=7|15|30`: aba "Bolsistas sem vir", com os mesmos componentes dos contatos do M2.
- `/painel/configuracoes`: a mensagem pronta "Bolsista sem vir" (só os campos `{nome}` e `{dias}`; a de bolsista recusa `{aluno}`, `{fim}` e `{turma}`, e as do M2 recusam `{dias}`).
- `/painel` (início): mais dois números, "Bolsistas ativos" (abre a lista de bolsistas) e "Bolsistas sem vir há 15 dias" (abre a aba de contatos). Cada número é igual à lista que abre.

**Como usar**

1. **Cadastrar:** em Bolsistas, "Novo bolsista": nome, nascimento, WhatsApp, e-mail e Instagram opcionais, dias combinados (ao menos um) e preferência no par (os dois, prefere conduzir ou prefere ser conduzido). Para menor de 18 anos, informe o responsável (as mensagens vão para ele; irmãos com o mesmo responsável viram uma linha só nos contatos). Quem já está cadastrado (por e-mail), por exemplo um aluno, vira bolsista pelo botão "Tornar bolsista", sem duplicar o cadastro.
2. **Combinar dias:** na ficha, "Alterar dias" cria uma versão nova do acordo, vigente desde a data escolhida (hoje por padrão; pode ser no passado para corrigir, nunca no futuro). As versões antigas ficam e a frequência de cada data usa o acordo que valia nela. "Inativar" e "Reativar" têm data e motivo opcional; inativo sai da chamada e da lista de contato, mas as presenças e o histórico ficam.
3. **Fazer a chamada:** em Chamada, escolha o dia e a turma. Aparecem primeiro os bolsistas combinados para aquele dia da semana (acordo vigente na data); quem veio sem estar no acordo entra por "Adicionar bolsista". O topo mostra "Vieram N · conduzir X · ser conduzido Y · os dois Z" (ou "Ninguém marcado"). "Salvar chamada" marca e desmarca de uma vez; se outra pessoa salvou antes, a tela avisa e mostra a chamada atual. Chamada vazia pede confirmação. "Não houve aula" (com motivo, só sem presenças) tira o dia da frequência de todos e pode ser desfeito; desfeito, a aula volta a ficar "sem chamada" até alguém salvar a chamada. O serviço aceita fazer ou corrigir a chamada de qualquer dia passado (só recusa data futura e dia da semana em que a turma não tem aula; aula nova só em turma ativa).
4. **Usar a lista de contato:** em Contatos > "Bolsistas sem vir", escolha 7, 15 ou 30 dias. Aparece quem está ativo, teve ao menos um dia combinado com chamada no período e não veio a nenhum dia dele; ficam de fora inativos e quem pediu para não ser contatado. Se o bolsista voltou a vir depois que a tela foi aberta (uma chamada salva noutra aba), o WhatsApp não abre e a aba avisa "Este bolsista voltou a vir. A lista foi atualizada."; pela ficha do bolsista dá para chamar qualquer bolsista ativo. Toque em "WhatsApp" (o contato é registrado ao tocar) e depois marque o resultado: vai voltar, vai pensar, não respondeu, não volta (aparece o atalho "Inativar bolsista", que a equipe decide usar) ou não quer contato. Quem foi chamado hoje por outra pessoa gera um aviso antes de chamar de novo.

**Regra de "dia com chamada"**

**Dia combinado** = data até hoje (São Paulo) cujo dia da semana está no acordo vigente nela, num tempo em que o bolsista estava ativo. **Dia combinado com chamada** = dia combinado em que a chamada de alguma aula (de qualquer turma) foi **salva** (aula `realizada` com `chamada_salva_em` preenchida, migração 0013). Só o dia combinado com chamada conta na frequência ("5 de 8") e na lista "sem vir": feriado marcado "não houve aula", "não houve aula" desfeito (marcar "não houve aula" limpa a chamada salva da aula) e dia em que ninguém fez a chamada não viram falta. Presença em dia fora do acordo aparece à parte ("+1 fora"). As funções `frequencia` e `semVir` de `src/servidor/bolsistas/regras.ts` usam a mesma regra de dia combinado com chamada; a carga dos bolsistas (`carregarBolsistas`) as usa para a frequência do mês da lista de bolsistas e da aba de contatos e para a lista "sem vir", e a ficha usa `frequencia` para cada mês. Os números do topo da lista de bolsistas, da aba "Bolsistas sem vir" e do início vêm todos de `contarBolsistas`.

**Pendente em produção (dono do projeto)**

- [ ] Cadastrar os bolsistas reais e os dias combinados de cada um.
- [ ] Conferir a mensagem pronta "Bolsista sem vir" em Configurações e ajustar o texto.
- [ ] Fazer a primeira chamada de verdade e conferir a frequência na ficha.
- [ ] Combinar com a dona do estúdio se há mínimo de presenças para manter a bolsa (hoje não há regra automática).

**Pendências conhecidas (baixa prioridade)**

- `/painel/chamada/<turmaId>` sem `?data=` (endereço digitado à mão) usa hoje; se a turma não tem aula hoje, volta para a escolha do dia com "Essa turma não tem aula nesse dia da semana.", sem dizer que o dia considerado foi hoje.

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
