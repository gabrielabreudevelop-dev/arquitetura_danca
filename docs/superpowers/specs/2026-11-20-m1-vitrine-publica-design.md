# M1 · Vitrine pública

Data: 2026-11-20
Situação: aguardando aprovação do dono
Parte de: `docs/superpowers/specs/2026-11-20-mvp-marcos-design.md` (seção 7, M1). Este documento detalha o M1 e registra o que mudou em relação àquele texto.

## 1. Intenção

O M1 coloca no ar a parte da plataforma que não depende de vídeo: o que o estúdio mostra ao público. O objetivo é divulgação. Os **eventos** são o destaque, porque são pagos e precisam de alcance no WhatsApp e no Instagram. A **grade de horários** informa quem já sabe qual ritmo quer dançar. A administração passa a cadastrar no painel os ritmos, módulos, professores, turmas e eventos que alimentam essas páginas e os marcos seguintes.

As informações mais atualizadas do estúdio estão no Instagram (@arquiteturadadanca), não no site. A vitrine leva para o Instagram e para o WhatsApp do estúdio.

## 2. O que mudou em relação ao design dos marcos

Decidido com o dono em 2026-11-20:
- **Professores não aparecem na parte pública.** A grade não mostra o professor nem filtra por ele. A turma continua ligada a um professor no cadastro, porque M2 e M3 precisam disso.
- **Aula experimental fica fora do M1.** O dono vai confirmar como o estúdio oferece a aula experimental. A grade apenas informa. Quando a regra vier, o botão "Agendar aula experimental" (WhatsApp com mensagem pronta citando a turma) entra como mudança pequena.
- **Eventos levam à compra pelo WhatsApp** (opção B): o evento tem preço em texto e, opcionalmente, um link de ingresso externo. O botão principal vai para o link externo, se houver, ou abre o WhatsApp do estúdio com a mensagem pronta.
- **Instagram acima do site** como link externo principal.
- **Capa do evento é opcional e pouco importante**: a arte é renovada a cada evento. Sem capa, a prévia usa uma imagem gerada.

## 3. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- Quem recebe o link de um evento no WhatsApp vê uma prévia com imagem, título e data, abre a página no celular e chega ao ingresso em um toque.
- O próximo evento aparece em destaque na página inicial.
- Quem quer dançar um ritmo encontra os dias e horários das turmas dele em poucos toques.
- A administração cadastra e corrige ritmos, módulos, professores, turmas e eventos sem ajuda técnica.
- A identidade visual passa a conversar com a do estúdio (decisão D4).

**Não objetivos (M1)**
- Aula experimental (ver seção 2).
- Venda de ingressos ou pagamento dentro da plataforma.
- Confirmação de presença e "quem vai" (M4, só para quem tem login).
- Página de professores, fotos ou apresentação deles.
- Opt-in de visitantes na página de eventos (depois do MVP).
- Login de professores (M3) e cadastro de alunos (M2).

**Antiobjetivos**
- Nome de aluno ou de professor em qualquer página pública.
- Página pública que mostre rascunho, evento não publicado ou turma desativada.
- Prévia de link quebrada ou sem imagem no WhatsApp.
- Visual de template genérico, ou uma cópia do site do estúdio.
- Uma tela do painel acessível ou uma server action executável por quem não é da administração.

## 4. Restrições

As do design dos marcos (seção 3 de lá) continuam valendo: mobile first, cada tela verificada no celular, no tablet e no computador; português do Brasil; design-craft em toda tela; TDD; branches e PRs; nenhum segredo commitado; ritmos e módulos cadastráveis, nunca fixos no código.

Do M1:
- O servidor ainda não existe. Tudo é desenvolvido e testado localmente e na CI. Os critérios que dependem de produção ficam pendentes (seção 11).
- Horários exibidos e digitados sempre no fuso `America/Sao_Paulo`, independentemente do fuso do servidor ou do navegador.
- Toda server action do painel chama `exigirPapel(["administracao"])` no início. O layout do painel não protege actions.

## 5. Abordagens consideradas (onde guardar as capas)

As capas precisam de um endereço público (a prévia do WhatsApp busca a imagem) e não devem se perder.

| Abordagem | A favor | Contra |
|---|---|---|
| **A · No Postgres** (escolhida) | Nenhuma infraestrutura nova. O backup diário do banco já cobre as capas. Funciona igual localmente, na CI e na VPS. | O banco cresce (centenas de KB por evento, alguns MB por ano). A aplicação entrega a imagem (com cache). |
| B · Em disco na VPS (volume do Coolify) | Simples; banco pequeno. | O backup atual só copia o banco: precisaria de um segundo backup, e as imagens se perderiam sem ninguém perceber. |
| C · Bunny Storage | CDN; prepara o M3. | Antecipa conta e credenciais do Bunny que ainda não existem; testes dependem de serviço externo ou simulador; capa fora do backup. |

O dono escolheu a **A**. Se o volume crescer, as capas podem migrar para o Bunny sem mudar as telas, porque elas sempre são servidas por uma rota da aplicação.

## 6. Dados

O modelo do M0 já tem `ritmos`, `modulos`, `turmas`, `turma_dias`, `eventos` e pessoas com papel `professor`. O M1 acrescenta (migrações novas, nunca editando as antigas):

- **`ritmos.slug`** (único, `^[a-z0-9]+(-[a-z0-9]+)*$`) para endereços legíveis (`/grade/forro`), gerado a partir do nome e editável. **`ritmos.ordem`** (inteiro) para a ordem de exibição, porque a ordem do estúdio não é alfabética (Forró, Sertanejo, Samba no pé, Samba de Gafieira, Bolero, Tango).
- **`eventos.preco`** (texto curto, opcional; ex.: "R$ 35 antecipado · R$ 40 no dia") e **`eventos.link_ingresso`** (opcional, só `https://`).
- **Capas:** tabela própria (ex.: `imagens`), com os bytes (`bytea`), tipo (`image/jpeg`), largura, altura, tamanho e data. `eventos` passa a apontar para a imagem (ex.: `capa_id`, opcional). A coluna `capa_url` do M0 deixa de ser usada e pode ser removida. Trocar a capa grava uma imagem nova e apaga a anterior (não há histórico de capas).
- **Turmas:** o modelo do M0 se mantém: uma turma tem um horário só, igual em todos os seus dias. Confirmado pelo dono: quando o mesmo ritmo e módulo acontece em dias ou horários diferentes, são turmas diferentes, com alunos diferentes (ex.: dois Forró Iniciante). Por isso a grade pode ter várias linhas com o mesmo ritmo e módulo.
- **Professores:** pessoas com o papel `professor`. Cadastro com nome (obrigatório), e-mail e WhatsApp (opcionais, normalizados pelas funções que já existem em `src/servidor/pessoas/normalizar.ts`). Sem conta de login até o M3. *Decisão de quem constrói:* se o e-mail informado já pertence a uma pessoa (ex.: alguém da administração que também dá aula), o formulário oferece dar o papel de professor a essa pessoa, em vez de criar outra. "Desativar professor" vale para o papel, não para a pessoa (ex.: um campo `ativo` na linha do papel): o professor some da escolha de turmas novas e a pessoa mantém os outros papéis e o acesso.
- **Endereços (slugs) depois de divulgados.** *Decisão de quem constrói:* o endereço do evento é editável só enquanto o evento nunca foi publicado; depois da primeira publicação, fica fixo (o formulário explica por quê), para não quebrar links já compartilhados. O endereço do ritmo é editável, com aviso de que links antigos da grade deixam de funcionar. Não há tabela de redirecionamentos no M1.

Nada é apagado de verdade quando já está em uso: ritmo, módulo, professor e turma são **desativados** (`ativo`/`ativa`). Exclusão só para o que nunca foi usado (ritmo, módulo ou professor sem turma; evento em rascunho). Evento publicado pode voltar a rascunho.

## 7. Painel da administração

Acesso: só `administracao`. Atendentes continuam vendo apenas o painel inicial (sem os links de cadastro).

Telas (lista + formulário de criar/editar, no padrão de `docs/design.md`):
- **Ritmos:** nome, endereço (slug), ordem, ativo.
- **Módulos:** nome, ordem, ativo.
- **Professores:** nome, e-mail, WhatsApp, ativo (papel `professor`).
- **Turmas:** ritmo, módulo, professor (só ativos), dias da semana (um ou mais), horário de início e fim, link do grupo de WhatsApp (validado na aplicação: `https://chat.whatsapp.com/` seguido de um código), ativa.
- **Eventos:** título, endereço (slug, gerado do título e editável), início (data e hora), fim (opcional), local, descrição (texto simples com quebras de linha), preço, link de ingresso, capa (enviar, trocar, remover), publicado.

Regras:
- Validação no servidor com zod, mensagens específicas ao lado do campo ("Esse endereço já está em uso", "O fim precisa ser depois do início"). Erros do banco (unicidade, checagens) viram mensagens legíveis, nunca texto cru.
- Depois de salvar, as páginas públicas afetadas são atualizadas na hora.
- Listas do painel funcionam no celular (linhas empilhadas) e no computador (tabela).

### Capa
- Aceita JPEG, PNG e WebP de até 10 MB. Outros formatos ou arquivos maiores: mensagem clara.
- No envio, a imagem é processada no servidor: orientação corrigida, metadados removidos, redimensionada para no máximo 1200 px no lado maior, **mantendo a proporção** (a arte costuma vir no formato de post do Instagram), salva como JPEG com qualidade ajustada para ficar perto de 300 KB.
- Servida em uma rota pública própria, com endereço que muda quando a capa muda e cabeçalho de cache longo.
- Só capas de eventos publicados são servidas publicamente. (Rascunho: só para a administração.)

## 8. Páginas públicas

Sem login. Renderizadas no servidor. Nenhum nome de aluno ou de professor. Só conteúdo ativo e publicado.

### Página inicial (`/`)
1. Cabeçalho com a marca e "Entrar" (discreto, para a equipe).
2. **Próximo evento em destaque:** o primeiro evento publicado que ainda não passou (regra de "evento passado" em Eventos, abaixo), pela data de início. Capa (se houver), título, data e hora, local, preço e o botão "Garantir meu ingresso" (mesma regra da página do evento), mais o link para a página do evento. Se não houver evento, a seção não aparece.
3. **Ritmos:** a lista dos ritmos ativos que têm turma ativa, cada um levando à grade daquele ritmo.
4. Outros eventos, se houver mais de um: link "Ver todos os eventos".
5. Rodapé: Instagram (@arquiteturadadanca) em primeiro, WhatsApp do estúdio (contato geral, sem mensagem pronta), endereço e funcionamento.

```
[marca]                         Entrar
[capa do evento, proporção original]
Próximo evento
Baile de Dezembro
sáb, 13 de dezembro · 21h · Salão do estúdio
R$ 35 antecipado · R$ 40 no dia
[ Garantir meu ingresso ]   Ver detalhes
────────────────
Ritmos
Forró · Sertanejo · Samba no pé · Gafieira · Bolero · Tango   → grade
────────────────
Instagram @arquiteturadadanca · WhatsApp (27) 99989-1561
R. Antônio Guilherme do Nascimento, 173 · Jardim Camburi, Vitória/ES
```

### Grade de horários (`/grade` e `/grade/[ritmo]`)
- Organizada **por ritmo**: no topo, os ritmos (ativos e com turma ativa), na ordem cadastrada. `/grade` abre no primeiro ritmo; `/grade/[ritmo]` abre no escolhido.
- Filtros por **módulo** e **dia da semana**, guardados no endereço (`?modulo=…&dia=…`), para a grade filtrada poder ser compartilhada.
- Cada turma mostra módulo, dias (abreviados: "ter e qui") e horário ("19h–20h"; "19h30–20h30"). Ordenadas por módulo (ordem cadastrada) e depois por dia e horário.
- No celular, uma lista. No computador, uma tabela (módulo, dias, horário).
- Filtro sem resultado: "Nenhuma turma de Forró com esses filtros." e um link "Limpar filtros". Ritmo inexistente ou desativado: página 404 com link para a grade.
- Sem nenhuma turma cadastrada: estado vazio dizendo que a grade será publicada em breve e apontando para o Instagram.

```
Grade de horários
[Forró] Sertanejo  Samba no pé  Gafieira  Bolero  Tango
Módulo ▾   Dia ▾
────────────────
Iniciante        ter e qui · 19h–20h
Iniciante        sáb · 10h–11h
Intermediário    seg e qua · 20h–21h
```

### Eventos (`/eventos` e `/eventos/[slug]`)
- `/eventos`: próximos eventos publicados, do mais próximo ao mais distante. Vazio: "Nenhum evento marcado agora" e o Instagram como lugar para acompanhar novidades.
- `/eventos/[slug]`: capa (proporção original), título, data e hora (com fim, se houver), local, preço, descrição, e:
  - **"Garantir meu ingresso"**: abre o `link_ingresso`, se houver; senão, o WhatsApp do estúdio (`wa.me`) com a mensagem pronta "Olá! Quero garantir meu ingresso para o {título} ({data}). Vi no site do estúdio.";
  - **"Compartilhar no WhatsApp"**: `wa.me/?text=` com título, data e o endereço da página;
  - **"Copiar link"**: copia o endereço e confirma ("Link copiado") perto do botão; se o navegador não permitir, mostra o endereço selecionável.
- **Quando um evento passa.** *Decisão de quem constrói:* com fim cadastrado, quando o fim passa; sem fim, quando acaba o dia do início (à meia-noite, horário de São Paulo). Assim o "R$ 40 no dia" continua valendo durante o evento. A mesma regra serve ao destaque, à lista e à página.
- Evento que já passou continua acessível pelo link, com o aviso "Este evento já aconteceu", sem o botão de ingresso. Não aparece na lista nem no destaque.
- Evento inexistente ou em rascunho: 404.

### Prévia de link (Open Graph)
- Toda página pública tem título, descrição e imagem de prévia. Endereços absolutos a partir da URL pública da aplicação (`BETTER_AUTH_URL`, que já é obrigatória e é a URL pública).
- Página do evento: `og:title` = título, `og:description` = data, local e preço, `og:image` = a capa (com largura e altura reais), `og:type` = `website`, `og:locale` = `pt_BR`, além de `twitter:card` `summary_large_image`.
- **Sem capa**, a imagem é gerada (1200×630) com o título, a data e as cores do estúdio. A página inicial e a grade usam uma imagem padrão gerada da mesma forma, com o nome do estúdio.

## 9. Identidade visual

A identidade provisória do M0 (`docs/design.md`, tokens em `globals.css`) é substituída pela identidade derivada do site do estúdio, conforme `claude/estado-do-projeto.md` (documento do Project) e mantendo as regras do design-craft:
- **Cores:** marca `#c25b8f` (não usar com texto branco por cima), ação `#b84d83`/`#a8457a` para botões com texto branco, rosa suave `#f8e9f1`, laranja `#f58c23`, amarelo `#f5e056` (só fundo ou realce, nunca texto sobre branco), texto `#1f1f1f`/`#555`, fundos `#fff`/`#f2f2f2`, linha `#dcdcdc`, palco `#1a1a1a`. Erro e sucesso definidos com contraste mínimo de 4,5:1. Conferir o contraste de cada par usado e registrar na tabela da paleta.
- **Fontes:** Raleway (texto e títulos) e Dancing Script (só para frases de assinatura, como o slogan), servidas localmente por pacotes `@fontsource`, sem depender de rede no build. Archivo e Atkinson saem.
- **Três tamanhos de texto**, escala de espaçamento e regras de "nunca fazer" continuam, revisadas para a nova identidade. A ousadia fica concentrada num lugar só. O elemento-assinatura passa a vir da identidade do estúdio (por exemplo, o degradê amarelo→rosa usado com parcimônia); a regra "sem degradês" é revista para permitir só esse uso.
- **Marca:** até o estúdio enviar o logo original, a marca é o nome do estúdio em Dancing Script. O logo entra quando os arquivos chegarem.
- Botões com altura mínima de 48 px, raio pequeno (4 a 6 px), sombra suave só onde ajudar a ler.
- As telas do M0 (entrar, painel, sem acesso) passam para a identidade nova.

## 10. Acertos herdados do M0

Anotados nas revisões do M0 para o M1:
- Validar o link do grupo de WhatsApp da turma na aplicação.
- Toda server action do painel chama `exigirPapel`.
- Unificar o `createAuthClient` (hoje duplicado em `entrar` e `sair`); o botão "Saindo…" volta ao normal se o `signOut` falhar, com mensagem; erro de rede no login aparece como erro de conexão, não como "senha incorreta".
- Revisar os endpoints padrão do Better Auth expostos e permitir explicitamente só os usados (entrar, sair, sessão).
- Polimento de UI: link "Pular para o conteúdo" nas páginas; h1 do painel com quebra de palavras longas.

## 11. Pronto quando

Verificável no M1 (localmente e na CI):
- [ ] A administração cadastra, edita, desativa e (quando permitido) exclui ritmos, módulos, professores, turmas e eventos; uma pessoa só atendente não acessa as telas nem consegue executar as actions (testado).
- [ ] A grade e os eventos aparecem sem login, só com conteúdo ativo e publicado, sem nomes de pessoas (testado).
- [ ] A página de um evento traz as tags Open Graph completas, com imagem acessível pela rota pública, com e sem capa (testado).
- [ ] Cada tela pública e do painel foi verificada no celular, no tablet e no computador, com os estados vazio, carregando e erro desenhados.
- [ ] CI verde: lint, tipos, unidade, integração, build e imagem Docker.

Pendentes até o servidor existir (dono):
- [ ] A grade real do estúdio está cadastrada em produção e aparece sem login.
- [ ] O link de um evento colado no WhatsApp mostra a prévia com imagem.

## 12. O que fica com quem constrói

- Nomes exatos de tabelas, colunas, rotas do painel e componentes, dentro das convenções do repositório.
- Biblioteca de processamento de imagem (ex.: `sharp`) e de geração da imagem de prévia (ex.: `next/og`), e o ajuste de limite de tamanho do envio nas server actions.
- Estratégia de cache e atualização das páginas públicas depois de salvar.
- Como testar as telas (unidade, integração com banco, e se vale incluir testes de ponta a ponta no navegador).
- O desenho detalhado de cada tela, seguindo `docs/design.md` e o design-craft.
- Onde ficam os dados fixos do estúdio (Instagram, WhatsApp, endereço, funcionamento): um único arquivo no código, ao lado do nome do estúdio.
