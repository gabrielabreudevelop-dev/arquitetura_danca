# M2 · Painel das atendentes

Data: 2026-11-22
Situação: aprovado em 2026-11-22
Parte de: `docs/superpowers/specs/2026-11-20-mvp-marcos-design.md` (seção 7, M2). Este documento detalha o M2 e registra o que mudou em relação àquele texto. Base de código: `main` depois do merge do M1 (PR #1, `c322580`).

## 1. Intenção

O M2 tira o controle de alunos da planilha e o leva para o painel. A administração cadastra o aluno (e o responsável, se ele for menor), coloca-o nas turmas, registra o período contratado e tudo o que mexe nele: renovação, extensão individual ou da turma inteira, trancamento e transferência de dias para outra pessoa. Um dash mostra quantos alunos estão com o período em dia e quem está para vencer ou já venceu, e cada número abre a lista correspondente.

O painel também ajuda a **trazer o aluno de volta**: listas de quem vence em breve e de quem já venceu, com um botão que abre o WhatsApp do estúdio com uma mensagem pronta e registra o contato e o resultado. Isso responde a um pedido do dono: tentar chamar de novo, pelo WhatsApp, quem parou de vir.

Nada aqui depende de vídeo. Os alunos continuam sem login até o M4; no M2 todo aluno fica com a situação "cadastrado" (ou "inativo", se for encerrado).

## 2. O que mudou em relação ao design dos marcos

Decidido com o dono entre 2026-11-20 e 2026-11-22:
- **Só a administração usa o M2.** Ainda não está claro o que diferencia a atendente da administração. O papel `atendente` continua existindo, sem mudança: quem só tem esse papel continua vendo o painel inicial vazio. Se for preciso, um marco futuro cria ou ajusta papéis. O nome "Painel das atendentes" fica por continuidade.
- **Contato para renovação e retorno pelo WhatsApp** entra no M2 (não estava no texto dos marcos), com envio manual e registro de cada contato.
- **Planos configuráveis** (nome e duração) no lugar de datas sempre digitadas à mão.
- **Extensão de uma turma inteira (em lote)** entra no M2. No texto dos marcos estava "depois do MVP".
- **Trancamento** e **transferência de dias** para outra pessoa entram no M2.
- **Ajustes contados em dias ou em aulas**, com a unidade padrão configurável.
- **Instagram** como dado opcional do aluno.
- O filtro e o dash usam o **estado do período** (vigente, vence em breve, vencido, trancado, sem período). A "situação" de ativação (cadastrado → link enviado → ativo) só ganha sentido no M4.

## 3. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- A administração cadastra no painel os alunos novos e as mudanças do dia a dia (turma, renovação, extensão, trancamento, transferência) sem usar a planilha.
- A data de fim exibida sempre está certa e é explicável: a ficha mostra de onde veio cada dia a mais ou a menos.
- Em poucos toques, a administração sabe quem vence nos próximos dias e quem venceu, e chama essas pessoas pelo WhatsApp com uma mensagem pronta, sem chamar duas vezes a mesma pessoa e sem chamar quem pediu para não ser chamado.
- O dash mostra quantos alunos estão com o período vigente, no total e por turma, ritmo, módulo e professor; cada número abre a lista.
- A turma piloto do M4 pode ser cadastrada à mão.

**Não objetivos (M2)**
- Acesso das atendentes (ver seção 2).
- Link de ativação, login de aluno, consentimentos, preferências e opt-ins (M4).
- Envio pela API do WhatsApp (depois do MVP, só para quem der opt-in de novidades).
- Importação da planilha (M4).
- Planos por quantidade de aulas e qualquer registro de presença (marco "Bolsistas e presença").
- Bolsistas: papel, área própria e regras (marco "Bolsistas e presença").
- Cobrança, valores dos planos e pagamentos.
- Limites de política do estúdio (ex.: máximo de dias de trancamento por ano). Ficam para a conversa com a dona do estúdio.

**Antiobjetivos**
- Uma data de fim exibida que não bate com o histórico da ficha.
- Mensagem para quem pediu para não receber, ou a mesma pessoa chamada por duas pessoas da equipe no mesmo dia sem que uma saiba da outra.
- Histórico apagado: período, ajuste, matrícula ou contato que some em vez de ser anulado ou encerrado.
- Uma tela do M2 acessível, ou uma server action executável, por quem não é da administração.
- Dados de alunos (nome, WhatsApp, Instagram) em qualquer página pública, log ou repositório.

## 4. Restrições

As do design dos marcos e do M1 continuam valendo: mobile first (verificar em 375, 768 e 1280 px), português do Brasil, design-craft e `docs/design.md` em toda tela, TDD, branches e PRs, nenhum segredo commitado, migrações novas sem editar as antigas, horários e datas no fuso `America/Sao_Paulo`.

Do M2:
- **Toda server action nova começa com `await exigirAdministracao();`.** O teste estático `src/app/painel/acoes-protegidas.test.ts` continua igual e cobre os arquivos novos. Toda página nova do M2 chama `exigirAdministracao()` (o layout do painel aceita atendentes, então ele não basta).
- **"Hoje" é o dia em São Paulo.** Todo cálculo de estado do período usa a data de hoje em `America/Sao_Paulo`, nunca a do servidor.
- **Datas de período são dias inteiros.** Início e fim contam como dias de aula (o período de 01/11 a 30/11 tem 30 dias; no dia 30/11 ainda está vigente).
- **Nada é apagado quando já tem história.** Período e ajustes são anulados (com quem, quando e motivo), matrículas são encerradas (data de saída), alunos são encerrados. Exclusão só para cadastro feito por engano, sem nenhuma história.
- **Dados reais só depois do backup.** A pendência do dono "backup fora da VPS e primeira restauração" vale antes do primeiro aluno real em produção. O M2 é desenvolvido e testado localmente e na CI.
- Mensagens prontas, planos e a unidade dos ajustes são configuráveis no painel, nunca fixos no código (as duas mensagens iniciais e nenhum plano entram como sementes da migração, editáveis).

## 5. Abordagens consideradas (como guardar o período e as mudanças nele)

A data de fim exibida depende de extensões individuais, extensões em lote, trancamentos, transferências e anulações. É a parte que mais pode dar errado.

| Abordagem | A favor | Contra |
|---|---|---|
| **A · Livro de lançamentos** (escolhida) | O período guarda só início, fim original e plano. Cada mudança é uma linha (dias positivos ou negativos) com quem fez, quando, lote ou transferência ligada e anulação. A data de fim exibida é sempre **calculada**. Uma fonte de verdade só; o histórico da ficha sai pronto; anular é marcar a linha. Segue o espírito do registro de consentimentos. | Consultas um pouco mais elaboradas (uma consulta de estado por aluno). Na escala do estúdio (centenas de alunos), não pesa. |
| B · Fim efetivo gravado no período + log | Consultas do dash triviais. | Duas fontes de verdade; toda anulação, lote e transferência precisa atualizar as duas juntas, e um erro deixa a data diferente do histórico sem ninguém perceber. |
| C · Nova versão do período a cada mudança | — | Histórico espalhado; "qual é o período atual?" vira pergunta difícil. Descartada. |

O dono escolheu a **A**.

## 6. Dados

O M0 já tem `pessoas`, `pessoa_papeis`, `responsabilidades`, `periodos_contratados`, `extensoes_periodo` e `matriculas`. O M2 muda e acrescenta (nomes exatos ficam com quem constrói; ver seção 12):

### Pessoas e alunos
- **`pessoas.instagram`** (texto, opcional): guardado como nome de usuário sem `@` nem link, normalizado (minúsculas; letras, números, `.` e `_`, até 30 caracteres, a regra do Instagram). O formulário aceita `@usuario`, `usuario` ou o link do perfil. Exibido como `@usuario`, com link para `https://instagram.com/usuario`.
- **Aluno** é a pessoa com o papel `aluno`. **Encerrar** o aluno desativa esse papel (`ativo = false`) e encerra as matrículas abertas; **reabrir** o reativa. Cada encerramento e reabertura fica num histórico próprio (data, motivo opcional, quem fez, quando), mostrado na ficha. A situação exibida no M2 é "cadastrado" (papel ativo) ou "inativo" (encerrado).
- **Responsável**: pessoa com o papel `responsavel`, ligada ao aluno por `responsabilidades`. Uma pessoa pode ser responsável por vários alunos e também ser aluna.
- **Menor de idade**: quem tem menos de 18 anos hoje (calculado pela data de nascimento, nunca guardado).
- **Não quer contato**: marca na **pessoa que recebe as mensagens** (o aluno adulto, ou o responsável de um menor), com quando e quem marcou. Desfazer ("voltou a aceitar contato") também fica registrado (data e quem). Essa marca é interna da equipe e **não é** um registro de consentimento (esses nascem no M4). O M4 deve levar a marca em conta (seção 12).

### Planos e configurações
- **`planos`**: nome (único, sem diferenciar maiúsculas), duração (quantidade inteira maior que zero e unidade `meses` ou `dias`), ordem de exibição e ativo. Plano usado em algum período é desativado, nunca apagado. Nenhum plano é semeado: a administração cadastra os do estúdio.
- **Configurações** do estúdio (chave e valor, ou uma linha única): no M2, só a **unidade padrão dos ajustes** (`dias` ou `aulas`, padrão `dias`).
- **`mensagens_prontas`**: nome, finalidade (`renovacao` ou `retorno`), texto e ativa. Duas sementes editáveis, uma por finalidade (seção 9).

### Período e livro de lançamentos
- **`periodos_contratados`** ganha: **plano** (opcional: o período recebido por transferência não tem plano), **origem** (`plano` ou `transferencia`), **quem registrou** e **anulação** (quando, quem e motivo, os três juntos ou nenhum). `inicio` e `fim` continuam; `fim` passa a significar o **fim original**. O período nunca é editado: correção é anular e registrar outro (a tela pode oferecer "Corrigir", que anula e abre o formulário preenchido). *Decisão minha:* **um período só pode ser anulado (ou corrigido) quando não tem nenhum lançamento vivo** (linha do livro não anulada, trancamento aberto ou transferência não anulada). Caso contrário, a mensagem lista o que precisa ser anulado antes ("Este período tem 2 lançamentos: +4 dias (lote feriado 15/11) e −14 dias (transferidos para João). Anule-os antes."). Assim nenhum dia some sem aparecer no histórico, e a outra ponta de uma transferência nunca fica valendo sozinha.
- **Livro de ajustes**: a tabela `extensoes_periodo` evolui (migração que renomeia e acrescenta colunas; não há dados reais) para guardar todo lançamento sobre um período:
  - tipo: `extensao`, `trancamento`, `transferencia_saida`, `transferencia_entrada`;
  - dias (inteiro diferente de zero; negativo só em `transferencia_saida`, positivo nos demais);
  - o que foi digitado: quantidade e unidade (`dias` ou `aulas`) e, se em aulas, a turma usada na conversão;
  - motivo (obrigatório em extensão e transferência; no trancamento, opcional);
  - ligações opcionais: lote, transferência ou trancamento de origem;
  - quem fez e quando;
  - anulação (quando, quem e motivo, os três juntos ou nenhum).
  Linhas do livro não são editadas nem apagadas; só os campos de anulação são preenchidos, uma vez. *Decisão de quem constrói:* reforçar isso com gatilho no banco (como nos consentimentos) ou só na aplicação.
- **Lotes de extensão**: quem fez, quando, dias ou aulas digitados, motivo, escopo (uma ou mais turmas, ou "estúdio todo") e anulação. Cada aluno atingido ganha a própria linha no livro, ligada ao lote. Anular o lote anula todas as linhas dele (as já anuladas individualmente ficam como estão).
- **Transferências**: período de quem cede, período de quem recebe, dias, motivo, quem fez, quando e anulação. Gera duas linhas no livro (saída e entrada) ou uma saída e um período novo para quem recebe (seção 7). Anular a transferência anula as duas pontas (a linha de entrada ou o período criado).
- **Trancamentos**: período, data de início, data de volta (opcional enquanto aberto), quem fez, quando, quem destrancou e quando, e anulação. Ao fechar (com volta conhecida no cadastro ou no "Destrancar"), gera uma linha do tipo `trancamento` no livro.

### Matrículas
- **`matriculas`** passa a ter identificador próprio, **data de entrada** (obrigatória, padrão hoje), **data de saída** (opcional, não antes da entrada), quem registrou a entrada e quem registrou a saída. No máximo uma matrícula aberta (sem saída) por aluno e turma. Voltar para a mesma turma cria uma matrícula nova. A migração preenche a entrada das linhas existentes com a data de `criado_em`.

### Contatos
- **`contatos`**: aluno, pessoa que recebeu (aluno ou responsável), WhatsApp usado (cópia do número na hora), lista de origem (`vence_em_breve`, `vencido` ou `ficha`), mensagem pronta usada (opcional) e o texto gerado, quem fez e quando; **resultado** (opcional: `vai_renovar`, `vai_pensar`, `nao_respondeu`, `nao_volta`, `nao_quer_contato`), com quem marcou e quando. O resultado pode ser trocado; a troca guarda o último valor (quem e quando). Contato não é apagado.

## 7. Regras de cálculo

### Fim efetivo
- **Fim efetivo de um período** = fim original + soma dos dias das linhas não anuladas do livro desse período. Período anulado não conta para nada.
- **Último período do aluno**: o período não anulado de maior início. Todos os ajustes novos (extensão, trancamento, dias cedidos ou recebidos) vão para o último período. *Decisão de quem constrói:* assim, uma renovação feita com antecedência não fica "atrás" de uma extensão do período anterior: o dia a mais empurra o fim do período que de fato termina por último.
- **Período vazio** (*decisão de quem constrói*, R14 da revisão final): o fim efetivo não tem limite no início. Quem cede todos os dias que restam deixa o período "vazio", com fim efetivo na véspera do início (é o que a tela e o histórico mostram); período vazio nunca é vigente e, para o estado, conta como vencido (mesmo com início no futuro). Toda anulação de linha de dias positivos (extensão avulsa, linha ou lote inteiro de extensão, trancamento, entrada ou período recebido por transferência) é recusada se deixaria o fim efetivo antes da véspera do início, com mensagem que diz qual transferência anular antes ("Os dias deste lançamento já foram cedidos. Anule antes a transferência para Carla Souza."); no lote, nada é anulado e a mensagem diz qual aluno impede. No mesmo início, o último período é o que não está vazio.
- **Limites** (*decisão de quem constrói*, R15 da revisão final): cada lançamento (estender, lote, transferência) aceita até 3650 dias ou 520 aulas ("Informe no máximo 3650 dias." / "Informe no máximo 520 aulas." ao lado do campo); a volta do trancamento fica até 3650 dias depois do início; datas de período, matrícula, trancamento e nascimento ficam entre 01/01/1900 e 31/12/2100 ("Informe uma data válida."). O banco reforça com `CHECK` de no máximo 36500 dias por linha do livro e por transferência.
- **Períodos não se sobrepõem.** Um período novo precisa começar depois do fim efetivo do último período (pode haver intervalo entre os dois). Tentativa de sobreposição: mensagem ao lado do campo ("O período atual vai até 08/12. O novo precisa começar a partir de 09/12.").
- **Anulações que quebrariam as regras são bloqueadas** (*decisão minha*), com mensagem que diz o que fazer antes:
  - anular uma linha de dias negativos (`transferencia_saida`) de um período que já tem outro depois dele, se isso fizer os dois se sobreporem;
  - anular uma transferência que criou um período no qual já há outros lançamentos vivos (eles são anulados antes);
  - anular um período com lançamentos vivos (seção 6).
  Anular uma linha de dias positivos nunca causa sobreposição e é sempre permitido.
- **Fim calculado pelo plano**: fim = início + duração − 1 dia (1 mês a partir de 05/11 vai até 04/12; a partir de 31/01, até 28 ou 29/02, com o fim do mês ajustado). O fim pode ser trocado à mão antes de salvar (acordos especiais); o período guarda o fim salvo.

### Estado do período de um aluno (hoje, em São Paulo)
Em ordem de prioridade:
1. **Encerrado**: o aluno foi encerrado. Fica fora do dash e das listas de contato (aparece na lista de alunos com o filtro de situação "inativo").
2. **Trancado**: há um trancamento não anulado com início ≤ hoje e (volta vazia ou volta > hoje).
3. **Vigente**: hoje está entre o início e o fim efetivo de algum período não anulado. **Vence em breve** é um **subconjunto** do vigente (não uma categoria separada): o vigente cujo fim efetivo do último período cai nos próximos N dias (N = 7, 15 ou 30, escolhido no filtro; padrão 7). Quem já renovou não aparece, porque o fim do último período está longe. No dash, "Vencem em breve" é mostrado como parte dos vigentes; no filtro da lista, "Vigente" traz todos e "Vence em breve" só a parte.
4. **Começa em breve**: não está vigente e o último período começa no futuro, tenha ou não um período anterior já vencido (*decisão minha*: quem venceu e já renovou com início futuro não recebe mensagem de "retorno").
5. **Vencido**: não está vigente e o fim efetivo do último período já passou.
6. **Sem período**: nenhum período não anulado.

Bolsistas (próximo marco) não têm período: a regra "sem período" e as listas baseadas em período os deixam de fora sem nenhuma exceção no código do M2.

### Conversão de aulas em dias
- Ajustes podem ser digitados em dias ou em aulas. O livro sempre guarda dias; a quantidade e a unidade digitadas ficam para exibição ("+2 aulas (7 dias) · feriado").
- **1 aula vale 7 ÷ (dias por semana da turma afetada)**, e o total é **arredondado para cima**: dias = teto(7 × aulas ÷ dias da turma). Ex.: turma de terça e quinta, 1 aula = teto(3,5) = 4 dias; turma só de sexta, 1 aula = 7 dias. Escolhido pelo dono.
- Ajuste individual em aulas: o formulário pergunta "aulas de qual turma?" se o aluno tem mais de uma matrícula aberta; com uma só, ela é usada direto. Sem matrícula aberta, só dias.
- Extensão em lote em aulas: cada aluno usa a turma do lote em que está matriculado; se estiver em mais de uma turma do lote, ganha **uma** extensão, com a conversão que der mais dias. "Estúdio todo" aceita só dias.
- Trancamento é sempre por datas (sem conversão).
- Transferência em aulas usa uma turma de quem cede (mesma pergunta do ajuste individual).

### Trancamento
- Só para aluno com período vigente (ou que começa em breve). Data de início: hoje ou outra data dentro do período. Um trancamento aberto por vez; trancamentos não se sobrepõem.
- **Com volta conhecida**: gera na hora a linha do livro com dias = volta − início. Ex.: de 01/12, volta em 20/12 = 19 dias. Até a volta, o estado é "trancado".
- **Aberto (volta desconhecida)**: o estado fica "trancado"; ao clicar em "Destrancar" e informar a data de volta (padrão hoje), gera a linha com dias = volta − início.
- Anular o trancamento anula a linha do livro (se houver).

### Transferência
- Quem cede precisa estar com período vigente e não trancado. Dias cedidos: de 1 até os dias restantes **do último período**, isto é, fim efetivo do último período − max(hoje, início do último período) + 1 (*decisão minha*: com renovação antecipada, só se cede o que cabe no período futuro, e o fim efetivo nunca fica antes do início).
- Quem cede ganha uma linha `transferencia_saida` (dias negativos).
- Quem recebe precisa estar cadastrado (dá para cadastrar na hora, pelo mesmo formulário de aluno). Se estiver vigente: linha `transferencia_entrada` no último período dele. Se não estiver: um período novo de origem `transferencia`, sem plano, com início escolhido (padrão hoje) e fim = início + dias − 1.
- A ficha das duas pessoas mostra a ligação ("−14 dias · transferidos para João", "+14 dias · recebidos de Ana").

## 8. Telas do painel

Acesso: só administração. Padrão do M1: o servidor monta as páginas, filtros e busca ficam no endereço, formulários com validação no servidor (zod) e mensagens específicas ao lado do campo, botão "Salvando…" desabilitado durante o envio, erros do banco traduzidos (`executarTraduzindo`, `ehUuid`, `MENSAGEM_EM_USO`, `lerTexto`, componentes de `src/app/painel/_formulario/`). Listas empilhadas no celular e em tabela no computador. Estados vazio e erro desenhados.

**Navegação**: Início (dash), Alunos, Contatos, Configurações, mais os cadastros da vitrine do M1. *Decisão de quem constrói:* agrupar os cadastros da vitrine para a navegação caber no celular, seguindo o design-craft.

### Início (`/painel`): o dash
Para a administração, o painel inicial passa a ser o dash. Quem só é atendente continua vendo o estado vazio atual (com o texto ajustado para não prometer telas para atendentes).
```
Olá, Gabriel
[ Buscar aluno por nome, WhatsApp ou e-mail ]   [+ Novo aluno]

Períodos vigentes             84 →
Vencem em breve (7 dias ▾)     6 →    [7 · 15 · 30 dias]
Vencidos sem contato           5 →    (dos 11 vencidos nos últimos 90 dias)
Trancados                      2 →
Cadastrados sem período        1 →

Vigentes por  [Turma] [Ritmo] [Módulo] [Professor]
Forró Iniciante · ter e qui 19h    12 →
```
- Cada número leva à lista de alunos (ou de contatos) já filtrada.
- **Vencidos sem contato** (*decisão minha*): alunos vencidos nos últimos 90 dias, que aparecem na lista "Vencidos" (portanto sem encerrados, trancados e "não quer contato"), cuja pessoa de contato **não recebeu nenhum contato desde a data em que o período venceu**. O número abre Contatos › Vencidos com o filtro "sem contato desde que venceu" ligado. O texto ao lado mostra o total de vencidos da lista.
- "Vigentes por" conta alunos com período vigente e matrícula aberta na turma (por ritmo, módulo ou professor da turma). Um aluno em duas turmas do mesmo ritmo conta uma vez naquele ritmo.
- Vazio (nenhum aluno): convite para cadastrar o primeiro aluno e, se não houver plano, para cadastrar os planos.

### Alunos (`/painel/alunos`)
```
[ Buscar…                ]  Turma ▾ Ritmo ▾ Módulo ▾ Professor ▾ Período ▾ Situação ▾
Ana Souza            Forró Inic. · Bolero Inic.    vence em 12/12
Bruno Lima (menor)   Samba Interm.                 venceu em 02/11
```
- Busca por nome (sem diferenciar acentos nem maiúsculas: "joao" acha "João"), por WhatsApp (só os dígitos, com ou sem DDD) e por e-mail.
- Filtros: turma, ritmo, módulo, professor (pelas matrículas abertas), estado do período (vigente, vence em breve, vencido, trancado, começa em breve, sem período) e situação (cadastrado, inativo; padrão: cadastrado).
- Sem resultado: "Nenhum aluno com esses filtros." e "Limpar filtros".

### Novo aluno e editar (`/painel/alunos/novo`, `/painel/alunos/[id]/editar`)
```
Nome*            [                    ]
Nascimento*      [dd/mm/aaaa]   → menor de idade? mostra "Responsável"
WhatsApp*        [(27)           ]
E-mail           [                    ]
Instagram        [@                   ]
Responsável      [buscar por WhatsApp/e-mail] ou [cadastrar novo]
Turmas           [ ] Forró Iniciante · ter e qui 19h  …
[ Salvar ]
```
- Obrigatórios: nome, nascimento e WhatsApp. Opcionais: e-mail e Instagram. Para menor: o responsável é obrigatório (nome e WhatsApp obrigatórios; e-mail opcional); o WhatsApp do próprio menor fica opcional.
- **Um responsável por aluno no M2** (*decisão minha*; o banco aceita mais, a aplicação limita a um, e trocar de responsável é possível na edição). É ele quem recebe as mensagens enquanto o aluno for menor.
- Responsável: o formulário procura pelo WhatsApp ou pelo e-mail digitado e oferece ligar a pessoa que já existe ("Carla Lima já está cadastrada — usar como responsável?"); senão, cadastra uma nova. Uma pessoa existente que vira responsável ganha o papel `responsavel`.
- WhatsApp normalizado pelas funções de `src/servidor/pessoas/normalizar.ts`. Se o número já pertence a outra pessoa, aviso **sem bloquear** ("Já existe Ana Souza com esse WhatsApp — abrir a ficha?"), porque irmãos podem usar o número da mãe.
- E-mail repetido é bloqueado pelo banco (já é único): "Esse e-mail já pertence a Fulano." com link para a ficha.
- E-mail já cadastrado de alguém da equipe ou de um professor: o formulário oferece dar o papel de aluno a essa pessoa (mesma regra dos professores no M1).
- Turmas no cadastro: só ativas; cada uma marcada vira matrícula com entrada hoje.

### Ficha do aluno (`/painel/alunos/[id]`)
```
Ana Souza · 34 anos · (27) 9…  · ana@… · @anasouza       [Editar]
Sem e-mail (pedir na ativação)   ← só quando faltar
Responsável: Carla Lima · (27) 9…                        ← se menor

Turmas                                      [Matricular]
  Forró Iniciante · ter e qui 19h  desde 03/03   [Trocar] [Tirar da turma]
  Saiu de: Bolero Inic. (03/03 a 10/06)

Período: Trimestral · 01/09 a 01/12, estendido até 08/12
  [Renovar] [Estender] [Trancar] [Transferir]

Histórico (mais recente primeiro)
  15/11  +1 aula (4 dias) · feriado 15/11 · lote Forró Iniciante · Gabriel   [Anular]
  01/09  Período Trimestral 01/09–01/12 · Gabriel
  01/06  Período Trimestral 01/06–31/08 · Gabriel

Contatos
  05/11  Convite para voltar · Gabriel · vai pensar
[Chamar no WhatsApp]   [Não quer contato]   [Encerrar aluno]
```
- O histórico junta períodos, ajustes (extensão, lote, trancamento, transferência), anulações (riscadas, com motivo, quem e quando), matrículas e encerramentos, em ordem de data, com quem fez.
- Ações abrem formulários próprios (página ou bloco que se abre na ficha; *decisão de quem constrói*), com a conta mostrada antes de salvar ("Fim passa de 08/12 para 12/12").
- **Renovar**: plano anterior já escolhido; início = dia seguinte ao fim efetivo do último período, se vigente, ou hoje, se vencido; fim calculado e editável.
- **Registrar período** (aluno sem período): plano, início (padrão hoje), fim calculado.
- **Estender**: quantidade, unidade (padrão da configuração), turma (se em aulas e houver mais de uma), motivo.
- **Trancar / Destrancar**, **Transferir**, **Anular** (motivo obrigatório): regras da seção 7.
- **Matricular** (turma ativa, entrada padrão hoje), **Tirar da turma** (data de saída padrão hoje), **Trocar** (saída de uma e entrada na outra na mesma data).
- **Encerrar aluno** (data padrão hoje, motivo opcional): encerra as matrículas abertas nessa data e desativa o papel `aluno`. **Reabrir**: reativa o papel (as matrículas não voltam sozinhas).
- **Excluir** só aparece para cadastro sem nenhum período, matrícula, ajuste, contato ou encerramento, que não é responsável de ninguém. Se a pessoa tem outros papéis, só o papel de aluno sai.

### Estender turma (`/painel/alunos/estender-turma` ou equivalente)
```
Turmas   [x] Forró Iniciante · ter e qui 19h   [ ] Bolero Inic. …   [ ] Estúdio todo
Quantidade* [ 1 ] [aulas ▾]     Motivo*  [ Feriado 15/11 ]
Vão receber (12): Ana Souza (até 08/12 → 12/12, +4 dias), Bruno Lima …
[ Confirmar extensão ]
```
- Recebe quem está **vigente** hoje e tem matrícula aberta numa das turmas escolhidas (ou todos os vigentes, no "estúdio todo"). Trancados, encerrados, vencidos e quem não tem período ficam de fora.
- A prévia mostra cada aluno, o fim atual, o novo fim e os dias. Confirmar grava o lote e as linhas numa transação. A lista de lotes (com "Anular lote") fica acessível a partir dessa tela.

### Contatos (`/painel/contatos`)
```
Contatos                                    
[Vencem em breve (6)]  [Vencidos (11)]      Vencidos: [últimos 90 dias ▾ | todos]

Ana Souza       Forró Inic.    venceu 02/11   [WhatsApp]
                último contato: —
Bruno Lima (menor → Carla, mãe)  Samba    venceu 20/10   [WhatsApp]
                último contato: 05/11 · vai pensar   [resultado ▾]
```
- **Vencem em breve**: vigentes cujo fim efetivo cai nos próximos 7, 15 ou 30 dias, do que vence primeiro ao último. Mensagem pronta de finalidade `renovacao`.
- **Vencidos**: vencidos nos últimos 90 dias (ou todos), do mais recente ao mais antigo. Mensagem de finalidade `retorno`.
- Ficam de fora: encerrados, trancados e alunos cuja pessoa de contato está marcada como "não quer contato".
- **Uma linha por pessoa de contato** (*decisão minha*): irmãos menores com o mesmo responsável, na mesma lista, viram uma linha só ("Carla Lima, mãe de Bruno e Lia"), com uma mensagem só (`{aluno}` = "Bruno e Lia"; `{turma}` e `{fim}` juntam os valores de cada um). Tocar no WhatsApp grava um contato para cada aluno da linha, com o mesmo horário. O resultado marcado vale para todos eles.
- As regras de "contatado recentemente" olham para a **pessoa de contato**: quem recebeu contato nos últimos 7 dias desce para o fim da lista, com o aviso "contatado há 3 dias por Fulano".
- Filtro "sem contato desde que venceu" na lista de vencidos (é o que o número do dash abre).
- **Pessoa de contato**: o próprio aluno, se adulto; o responsável, se menor. *Decisão minha:* o aluno que fez 18 anos e não tem WhatsApp próprio continua sendo contatado pelo número do responsável, com o aviso "sem WhatsApp próprio — usando o de Carla (responsável)" na linha e na ficha, até alguém cadastrar o número dele.
- **Botão WhatsApp**: registra o contato (quem, quando, número, mensagem e texto gerado) e abre `https://wa.me/<número>?text=<mensagem>` do WhatsApp do estúdio. Se o aluno for menor, o número e a saudação são do responsável. *Decisão de quem constrói:* como garantir que o registro aconteça mesmo com bloqueio de janelas no navegador (ex.: registrar no servidor e então redirecionar para o `wa.me`).
- **Resultado** com um toque em cada linha. "Não quer contato" marca a pessoa de contato e tira o aluno das listas. "Não volta" sugere encerrar o aluno (link para a ação, sem encerrar sozinho).
- Se não houver mensagem pronta ativa da finalidade, o botão abre o WhatsApp sem texto e a tela avisa.

### Configurações (`/painel/configuracoes`)
```
Configurações
  Contar ajustes em   (•) dias   ( ) aulas
  Planos                         [+ Novo plano]
    Mensal        1 mês     ativo
    Trimestral    3 meses   ativo
  Mensagens prontas
    Renovação · Convite para voltar     [+ Nova mensagem]
```
- **Planos**: nome, duração (quantidade e meses ou dias), ordem, ativo. Exclusão só se nunca usado.
- **Mensagens prontas**: nome, finalidade, texto, ativa. Campos que se preenchem sozinhos: `{nome}` (primeiro nome de quem recebe), `{aluno}` (primeiro nome do aluno), `{turma}` (ritmo e módulo da turma do aluno; se várias, separadas por " e "), `{fim}` (fim efetivo do período, "08/12"). Campo desconhecido no texto: erro ao salvar ("Campo {xyz} não existe. Use {nome}, {aluno}, {turma} ou {fim}."). Prévia com um exemplo ao lado do campo.
- Sementes (editáveis): "Renovação" — "Oi, {nome}! Tudo bem? O período de {aluno} na Arquitetura da Dança vai até {fim}. Quer renovar para continuar dançando com a turma de {turma}?"; "Convite para voltar" — "Oi, {nome}! Sentimos falta de {aluno} na pista. Que tal voltar para a turma de {turma}? Estamos te esperando." *Decisão de quem constrói:* o texto final das sementes, na voz de `docs/design.md`.

### Turmas (ajuste no M1)
- A lista e a ficha da turma mostram quantos alunos estão matriculados (link para `/painel/alunos?turma=…`).
- Desativar uma turma com matrículas abertas avisa ("12 alunos ainda estão nesta turma") e oferece movê-los para outra turma (troca em lote com a mesma data). Nada é fechado sozinho.

## 9. Mensagens e WhatsApp

- Envio sempre manual, pelo WhatsApp comum do estúdio, com o texto pronto (o mesmo padrão `wa.me` da vitrine). Nada de API, templates da Meta ou envio automático no M2.
- O texto pode ser mudado no próprio WhatsApp antes de enviar; o painel guarda o texto gerado, não o enviado.
- A marca "não quer contato" é a única barreira automática do M2. Ela vale para a pessoa que recebe (o responsável, no caso de menores, ou do adulto sem WhatsApp próprio), então vale para todos os filhos dela.

## 10. Portas abertas para "Bolsistas e presença"

- Matrículas com entrada e saída: a presença em aula poderá ser conferida contra "quem estava na turma naquele dia".
- Dash e contatos se baseiam em **período**, não no papel de aluno: o bolsista, sem período, fica de fora sozinho e depois ganha uma linha própria no dash.
- Nada no M2 exige que todo aluno tenha período ou que toda matrícula tenha período vigente.
- O papel `bolsista` (novo valor do enum `papel`), o login dele e a regra "inativado só pela administração" entram com o próprio marco.
- Planos por quantidade de aulas: o plano poderá ganhar um campo opcional "quantidade de aulas" quando houver presença, sem refazer o livro (que continua em dias).

## 11. Pronto quando

Verificável no M2 (localmente e na CI):
- [x] A administração cadastra, edita, encerra, reabre e (quando permitido) exclui alunos, com responsável para menores, e matricula, troca e tira de turmas (testado).
- [x] Períodos: registrar, renovar, estender (dias e aulas, individual e em lote), trancar (com volta e aberto), destrancar, transferir (para vigente e para quem não tem período) e anular cada um; a data de fim exibida sempre bate com o histórico (testes de unidade das regras da seção 7, incluindo fim de mês, arredondamento e sobreposição, e de integração com o banco).
- [x] Estado do período correto para cada caso da seção 7 com "hoje" em São Paulo (testes também com o processo em outro fuso, como no M1).
- [x] Dash: cada número bate com a lista que ele abre (testado).
- [x] Contatos: listas certas, registro ao tocar no WhatsApp, resultado, "não quer contato" tirando o aluno das listas, contatados recentes no fim (testado); link `wa.me` com o número e o texto certos, incluindo menor → responsável.
- [x] Configurações: planos, mensagens prontas (com validação dos campos) e unidade dos ajustes.
- [x] Toda server action nova passa pelo teste estático de `exigirAdministracao()`; uma pessoa só atendente não acessa nenhuma tela do M2 (testado).
- [x] Telas verificadas em 375, 768 e 1280 px, com estados vazio, erro e enviando (percurso de 2026-11-25 com banco de exemplo: nada transborda em 375 px, foco visível, áreas de toque de 48 px, "Salvando…").
- [ ] CI verde: lint, tipos, unidade, integração, build e imagem Docker.

Pendentes até o servidor existir (dono):
- [ ] Backup fora da VPS e primeira restauração antes do primeiro aluno real.
- [ ] As atendentes (hoje, a administração) cadastram em produção os alunos novos e as mudanças do dia a dia, e a turma piloto está cadastrada.

## 12. O que fica com quem constrói

- Nomes exatos de tabelas, colunas, enums, rotas e componentes, dentro das convenções do repositório.
- Como calcular o estado do período (view no Postgres, consulta com CTE ou função na aplicação), desde que uma fonte só alimente dash, listas e ficha, e que testes cubram as regras da seção 7.
- Gatilhos no banco para a imutabilidade do livro, dos lotes e das transferências (além da aplicação).
- Busca sem acento (extensão `unaccent` ou coluna normalizada).
- Forma das ações da ficha (páginas próprias ou blocos), agrupamento da navegação, desenho detalhado de cada tela, seguindo `docs/design.md` e o design-craft.
- Mecanismo do botão WhatsApp que garante o registro do contato.
- Texto final das mensagens semeadas.
- Ajustar o README (rotas do painel, como cadastrar alunos) e o estado vazio da atendente.
- Anotar para o M4: na ativação, a marca "não quer contato" precisa ser considerada junto com os opt-ins (ex.: não pré-marcar nada, como já previsto, e avisar a equipe se a pessoa der opt-in depois de ter pedido para não ser contatada).
