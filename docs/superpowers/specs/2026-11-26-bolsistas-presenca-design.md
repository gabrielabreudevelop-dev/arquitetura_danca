# Bolsistas e presença

Data: 2026-11-26
Situação: aprovado em 2026-11-26
Parte de: `docs/superpowers/specs/2026-11-20-mvp-marcos-design.md` (marco combinado em 2026-11-20 entre o M2 e o M3). Base de código: `main` depois do merge do M2 (PR #2, `29638d6`). Reaproveita o desenho e o código do M2 (`docs/superpowers/specs/2026-11-22-m2-painel-atendentes-design.md`).

## 1. Intenção

O estúdio tem **bolsistas**: pessoas que frequentam as aulas sem pagar, para **aumentar o número de pessoas na turma** e **ajudar a formar pares**. O estúdio precisa saber **quantos bolsistas estão ativos** e **se estão vindo às aulas**, para ter controle da quantidade e da disposição deles. Cada bolsista combina com o estúdio os **dias da semana** em que vem, mas pode ir a outras aulas.

Este marco cria o cadastro do bolsista, a **chamada** das aulas (a administração marca quem veio), a frequência de cada bolsista contra o que combinou e uma **lista para chamar no WhatsApp** quem não está vindo, como a do M2.

## 2. O que mudou em relação ao pedido original (2026-11-20)

Decidido com o dono em 2026-11-26:
- **Sem QR code e sem lista em papel:** a presença é marcada pela administração no painel.
- Por consequência, **o bolsista não tem login neste marco** (o pedido original previa uma área própria para marcar presença). O acesso dele aos vídeos fica para quando os vídeos existirem (M3/M4).
- **O acordo é por dia da semana**, não por turma: um bolsista de terça pode ir a qualquer aula de terça.
- **Preferência no par:** campo no cadastro, padrão "os dois", que pode ser "prefere conduzir" ou "prefere ser conduzido".
- **Quem não está vindo vai para uma lista de contato pelo WhatsApp**, com o mesmo funcionamento dos contatos do M2.

## 3. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- A administração cadastra bolsistas, combina os dias de cada um e ativa ou inativa o bolsista.
- Na recepção, a administração faz a chamada de uma aula em poucos toques, vendo primeiro os bolsistas combinados para aquele dia e o equilíbrio de preferências ("conduzir 2 · ser conduzido 1 · os dois 2").
- O painel mostra quantos bolsistas estão ativos, quantos têm cada dia combinado e a frequência de cada um no mês contra o combinado.
- A administração chama pelo WhatsApp, com mensagem pronta, quem não vem há X dias, sem chamar duas vezes e sem chamar quem pediu para não ser chamado.

**Não objetivos (deste marco)**
- Login do bolsista, QR code, área própria do bolsista.
- Presença dos alunos pagantes (a estrutura fica pronta para isso, mas as telas não).
- Planos por quantidade de aulas (continua para quando o estúdio quiser presença de alunos).
- Acesso aos vídeos (M3/M4).
- Regras de política (ex.: mínimo de presenças por mês para manter a bolsa). Ficam para a conversa com a dona do estúdio.
- Acesso das atendentes (continua só administração, como no M2).

**Antiobjetivos**
- Frequência que conta como falta um dia em que não houve aula (feriado, aula cancelada) ou em que ninguém fez a chamada.
- Mensagem de "sentimos sua falta" para quem está vindo, para quem foi inativado ou para quem pediu para não ser contatado.
- Presença marcada numa data futura ou numa aula que não existe (turma sem aula naquele dia da semana).
- Histórico apagado: presença desmarcada, acordo alterado ou bolsista inativado que some em vez de ficar registrado.
- Uma tela ou action deste marco acessível por quem não é da administração.
- Dados de bolsistas em log, página pública ou repositório.

## 4. Restrições

As do M2 continuam valendo (mobile first em 375/768/1280 px, português do Brasil, design-craft e `docs/design.md`, TDD, migrações novas, "hoje" em `America/Sao_Paulo`, `await exigirAdministracao();` no início de toda action e toda página nova, testes estáticos de acesso, nada é apagado quando tem história, erros de banco sem dados pessoais no log, formulários com mais de um botão de envio com um botão padrão seguro primeiro).

## 5. Abordagens consideradas (como guardar a presença)

| Abordagem | A favor | Contra |
|---|---|---|
| A · Presença direto em "turma + data" | Uma tabela só, rápido. | Não registra que a aula não aconteceu: feriado conta como falta; a frequência conta terças do calendário. |
| **B · Aula como registro próprio** (escolhida) | A aula (turma + data) existe ao salvar a primeira chamada e pode ser marcada "não houve aula". A frequência só conta dias em que houve chamada. A chamada fica guardada com quem marcou. A mesma estrutura serve para a presença de alunos e planos por aulas no futuro. | Uma tabela e uma ação a mais. |
| C · Reaproveitar `presencas` dos eventos | — | Significado diferente ("vou" × "esteve"). Descartada. |

O dono escolheu a **B**.

## 6. Dados

Nomes exatos ficam com quem constrói (seção 12).

- **Papel `bolsista`**: novo valor do enum `papel` (migração). O bolsista é uma **pessoa** com esse papel; uma pessoa que já é aluno, professor ou da equipe ganha o papel a mais, sem duplicar o cadastro (mesma regra do M1/M2 para e-mail já cadastrado).
- **Ativo/inativo**: o papel `bolsista` ativo ou inativo (`pessoa_papeis.ativo`). Só a administração muda. Cada mudança fica num **histórico** (tipo ativação/inativação, data, motivo opcional, quem fez, quando), mostrado na ficha. Inativar não apaga presenças nem acordo.
- **Dados do bolsista**: **preferência** (`os_dois` padrão, `conduzir`, `ser_conduzido`).
- **Acordo de dias**: cada versão do acordo é uma linha com os **dias da semana** (0–6, ao menos um), **vigente desde** (data), quem registrou e quando. O acordo vigente numa data é a versão de maior "vigente desde" ≤ data (empate: a registrada por último). Alterar os dias cria uma versão nova; as antigas ficam.
- **Aulas**: turma + data (única por turma e data), situação (`realizada` ou `nao_houve`), motivo (obrigatório em `nao_houve`), quem registrou, quando, e quem mudou a situação por último e quando. Só existe aula numa data cujo dia da semana está nos dias da turma e que não é futura (hoje em São Paulo); a turma precisa estar ativa para criar aula nova (aulas antigas de turma desativada continuam). A aula nasce como `realizada` ao salvar a primeira chamada, ou como `nao_houve` ao marcar "não houve aula".
- **Presenças em aula**: aula, pessoa, quem marcou e quando; **desmarcar** preenche quem desmarcou e quando (a linha fica). No máximo uma presença viva por aula e pessoa; marcar de novo depois de desmarcar cria outra linha. Neste marco, só bolsistas recebem presença (regra da aplicação; a tabela não restringe o papel, para servir a alunos depois).
- **Contatos**: reaproveita as tabelas do M2. A lista de contato ganha o valor `bolsista_ausente`; a mensagem pronta ganha a finalidade `bolsista`, com uma semente editável.

## 7. Regras

### Bolsistas combinados para uma aula
Para a aula de uma turma numa data: os bolsistas **ativos** cujo acordo **vigente naquela data** inclui o dia da semana da data. Os outros bolsistas ativos podem ser acrescentados ("Vieram sem estar no acordo"). Bolsistas inativos não aparecem para acrescentar; uma presença antiga de quem foi inativado continua visível na chamada daquela aula.

### Chamada
- Salvar a chamada grava o conjunto de presenças da aula: marca os novos e desmarca os que saíram, numa transação, com a aula travada (`FOR UPDATE`) para duas pessoas não salvarem ao mesmo tempo sem saber. *Decisão de quem constrói:* a tela envia a versão da chamada que mostrou; se outra pessoa salvou depois, a tela avisa e mostra a chamada atual antes de sobrescrever.
- **Chamada vazia** (*decisão minha*): salvar a primeira chamada de uma aula com ninguém marcado pede confirmação ("Ninguém veio? Se não houve aula, use “Não houve aula”."); confirmado, a aula fica `realizada` com zero presentes e conta para a frequência. Desmarcar todos numa aula que já existe também pede a mesma confirmação.
- "Não houve aula" (com motivo) só quando a aula não tem presença viva; caso contrário, a mensagem pede para desmarcar antes. "Houve aula" desfaz (volta a `realizada`).
- A chamada mostra no topo: "Vieram N · conduzir X · ser conduzido Y · os dois Z" (contagem das presenças vivas pela preferência atual de cada bolsista).

### Frequência de um bolsista num período (mês do painel ou intervalo)
- **Dia combinado com chamada**: data no período, ≤ hoje, cujo dia da semana está no acordo vigente naquela data, e em que houve **pelo menos uma aula `realizada`** (de qualquer turma). Dias sem chamada nenhuma ou só com aulas `nao_houve` **não contam** (nem como falta).
- **Presente num dia**: tem presença viva em alguma aula daquele dia.
- Exibição: "**nov: 5 de 8**" (dias combinados com chamada em que esteve presente / dias combinados com chamada) e "**+1 fora do acordo**" (dias com presença que não eram combinados), quando houver.
- Só conta o tempo em que o bolsista estava ativo (dias em que estava inativo ficam fora da conta), pelo histórico de ativação. A mesma regra de dias (combinado, com chamada, ativo) vale para a lista "sem vir": uma função só calcula as duas coisas (*decisão minha*).

### Lista "sem vir"
- Entra o bolsista **ativo** que, nos últimos **X dias** (filtro 7, 15 ou 30; padrão 15, até hoje), teve **pelo menos um dia combinado com chamada em que estava ativo** e **nenhuma presença** em nenhum dia do intervalo. Assim, se ninguém fez chamada, ninguém aparece.
- Ficam de fora: inativos, quem tem a pessoa de contato marcada "não quer contato" (M2).
- Ordem: quem está há mais tempo sem vir primeiro (última presença mais antiga; nunca veio no topo). Contatados recentemente vão para o fim (regra do M2).
- Cada linha: nome, dias combinados ("ter · qui"), última presença ("última vez em 05/11" ou "nunca veio"), frequência do mês, último contato, botão WhatsApp e resultado (mesmos do M2).
- Botão WhatsApp, registro do contato, "não quer contato", aviso de contato concorrente e pessoa de contato (responsável, se menor): **iguais ao M2**, com a lista `bolsista_ausente`. "Contatado recentemente" e o aviso concorrente olham a **pessoa de contato em qualquer lista** (como no M2): quem é aluno vencido e bolsista sem vir pode estar nas duas listas, mas o aviso de "já chamado hoje" vale para as duas (*decisão minha*). Bolsistas menores com o mesmo responsável viram **uma linha**, como os irmãos do M2; `{dias}` junta os dias de todos.
- **Resultados do contato de bolsista** (*decisão minha*): "vai voltar" (valor novo no enum), "vai pensar", "não respondeu", "não volta" (sugere **inativar o bolsista**, com link, sem inativar sozinho) e "não quer contato". "Vai renovar" não aparece nessa lista.
- **Mensagem pronta "bolsista"**: aceita só os campos `{nome}` (primeiro nome de quem recebe) e `{dias}` (dias combinados por extenso, "terças e quintas"); o botão da ficha do bolsista também usa essa finalidade. Semente editável: "Oi, {nome}! Sentimos sua falta nas aulas de {dias}. Tudo bem por aí?". Os campos aceitos dependem da finalidade (a de bolsista não aceita `{fim}` nem `{turma}`; as do M2 não aceitam `{dias}`), com o mesmo erro ao salvar do M2.

## 8. Telas

Acesso: só administração. Padrões do M2 (servidor monta as páginas, filtros no endereço, formulários com erros ao lado do campo, "Salvando…", listas empilhadas no celular e tabela no computador, estados vazio e erro).

**Navegação**: acrescenta **Bolsistas** e **Chamada**.

### Bolsistas (`/painel/bolsistas`)
```
Bolsistas                          [+ Novo bolsista]
Ativos 14 · ter 6 · qua 3 · qui 7 · sex 2
Sem vir há 15 dias ▾: 3 →  (chamar no WhatsApp)
Busca [        ]   Situação: ativos ▾
Bruno Lima     ter·qui   prefere conduzir   nov: 5 de 8
Carla Souza    qua       os dois            nov: 0 de 4
```
- Números no topo: ativos; ativos com cada dia no acordo vigente hoje (só dias com algum); "sem vir" com o filtro (link para a lista de contato).
- Lista com busca (como a de alunos) e situação (ativos, inativos).
- Vazio: convite para cadastrar o primeiro bolsista.

### Novo bolsista e editar
Mesmos campos e regras do cadastro de aluno do M2 (nome, nascimento, WhatsApp, e-mail e Instagram opcionais, responsável para menor, aviso de WhatsApp repetido, oferta de dar o papel a pessoa já cadastrada), sem turmas, mais **dias combinados** (caixas seg a dom, ao menos um; no cadastro, vigente desde hoje) e **preferência** (os dois / prefere conduzir / prefere ser conduzido).

### Ficha do bolsista (`/painel/bolsistas/[id]`)
```
Bruno Lima · 24 anos · (27) 9… · ativo            [Editar] [Inativar]
Preferência: prefere conduzir
Dias combinados: ter · qui (desde 01/11)           [Alterar dias]
  antes: ter (01/09 a 31/10)
Frequência: nov 5 de 8 · +1 fora · out 7 de 8
Presenças recentes
  26/11 Forró Iniciante · ter 19h
  21/11 Bolero Inic. · qui 20h
Contatos (como no M2)        [Chamar no WhatsApp] [Não quer contato]
Histórico: ativado 01/09 · Gabriel …
```
- **Alterar dias**: dias + "vigente desde" (padrão hoje; pode ser no passado para corrigir; nunca no futuro).
- **Inativar / Reativar**: data (padrão hoje; pode ser no passado, nunca no futuro, e não antes da última mudança de situação), motivo opcional.
- Chamadas de qualquer dia passado podem ser feitas ou corrigidas, sem limite (*decisão minha*: é como se corrige esquecimento; tudo fica no histórico com quem fez).
- Frequência dos últimos meses (mês atual e anteriores com presença ou dia combinado).

### Chamada (`/painel/chamada`)
```
Chamada · ter, 26/11  [‹ dia anterior]  [hoje]
Turmas de terça:
  Forró Iniciante · 19h        3 presentes      →
  Samba Interm. · 20h          ainda sem chamada →

Forró Iniciante · ter 19h · 26/11                  [Não houve aula]
Vieram 3 · conduzir 1 · ser conduzido 1 · os dois 1
Combinados para terça
  [x] Bruno Lima        prefere conduzir
  [ ] Carla Souza       os dois
Vieram sem estar no acordo
  [x] Diego Alves       prefere ser conduzido   [+ Adicionar bolsista ▾]
[ Salvar chamada ]
```
- Primeiro, a escolha do dia (padrão hoje; dias passados; sem futuro) e das turmas ativas daquele dia da semana, com a situação de cada aula (sem chamada, N presentes, não houve aula).
- Depois, a chamada da aula (seção 7). Datas fora dos dias da turma ou futuras: mensagem e volta para a escolha.
- "Não houve aula" pede o motivo; a aula aparece como "não houve aula · feriado" com "Desfazer".

### Contatos (M2)
- `/painel/contatos` ganha a aba **Bolsistas sem vir** (filtro 7/15/30), com os mesmos componentes.
- **Configurações › Mensagens prontas** aceita a finalidade "Bolsista sem vir".

### Dash (`/painel`)
- Acrescenta "Bolsistas ativos N →" (lista de bolsistas) e "Bolsistas sem vir há 15 dias N →" (aba de contato). Cada número igual à lista que abre (regra do M2).

## 9. O que fica pronto para depois
- Presença de alunos: a mesma aula e a mesma tabela de presenças; bastam telas e regras.
- Planos por quantidade de aulas: contar presenças por período.
- Login do bolsista e acesso aos vídeos: o papel e o cadastro já existem.

## 10. Pronto quando

Verificável localmente e na CI. Verificado em 2026-11-27 (branch `bolsistas-presenca`) com `pnpm lint`, `pnpm tipos`, `pnpm teste`, `pnpm teste:fuso`, `pnpm teste:integracao` e `pnpm build` verdes e com as telas percorridas num banco de exemplo em 375, 768 e 1280 px; o item "CI verde" fica para o push da branch.

- [x] A administração cadastra, edita, ativa e inativa bolsistas (com responsável para menor), muda os dias combinados com histórico e a preferência (testado).
- [x] A chamada lista os combinados certos para cada aula pelo acordo vigente na data, aceita acrescentar outros, salva marcando e desmarcando com histórico, recusa data futura e dia sem aula da turma, e "não houve aula" funciona como descrito (testado, inclusive duas pessoas salvando ao mesmo tempo).
- [x] A frequência e a lista "sem vir" seguem a seção 7, incluindo feriado (`nao_houve`), dia sem chamada, mudança de acordo no meio do mês e período inativo (testes de unidade e de integração; "hoje" em São Paulo, também com o processo em outro fuso).
- [x] Contatos de bolsistas funcionam como os do M2 (registro, resultado, "não quer contato", aviso concorrente, mensagem com `{nome}` e `{dias}`), e a lista "sem vir" recusa, no momento de abrir o WhatsApp, quem voltou a vir na janela da tela (corrigido no fechamento; `tests/integracao/contatos-bolsistas.test.ts` e `src/servidor/contatos/pedido-abrir.test.ts`) (testado).
- [x] Dash: os números de bolsistas batem com as listas que abrem (testado).
- [x] Toda action e página nova passa pelos testes estáticos de acesso (`src/app/painel/acoes-protegidas.test.ts`, que percorre todo o `src/`, e `src/app/painel/paginas-protegidas.test.ts`, com as pastas `bolsistas` e `chamada`); uma pessoa só atendente não acessa nada deste marco (testado).
- [x] Telas verificadas em 375, 768 e 1280 px, com estados vazio, erro e enviando.
- [ ] CI verde (confirmar no push da branch).

Pendente em produção (dono, continua pendente): cadastrar os bolsistas reais e os dias combinados; fazer a primeira chamada.

Mudança durante a construção: só um dia em que a chamada foi **salva** conta como "dia com chamada" (aulas ganharam `chamada_salva_em` e `chamada_salva_por`, migração 0013), para que marcar e desfazer "não houve aula" não vire falta; marcar "não houve aula" numa aula que já tinha chamada salva (esvaziada) limpa esse registro.

## 11. Decisões em aberto (com a dona do estúdio)
- Se há mínimo de presenças para manter a bolsa (hoje: nenhuma regra automática).
- Se os bolsistas passam a ter acesso aos vídeos (quando houver vídeos).

## 12. O que fica com quem constrói
- Nomes de tabelas, colunas, enums, rotas e componentes.
- Onde guardar preferência e histórico de ativação (tabela do bolsista, `pessoa_papeis` ou tabela de histórico genérica), desde que nada se perca.
- Como calcular frequência e "sem vir" (consulta ou função na aplicação, como no M2), com uma fonte só para painel, ficha, contatos e dash.
- Como reaproveitar o cadastro de pessoa do M2 (mesmo serviço com o papel como parâmetro, ou serviço próprio que reusa as validações).
- Mecanismo de aviso de chamada salva por outra pessoa.
- Desenho detalhado das telas, seguindo `docs/design.md` e o design-craft.
