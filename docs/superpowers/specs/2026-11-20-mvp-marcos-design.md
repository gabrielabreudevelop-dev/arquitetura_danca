# MVP da Plataforma Arquitetura da Dança: marcos

Data: 2026-11-20
Situação: aprovado em 2026-11-20
Contexto completo do produto: `contexto-arquitetura-danca.md` (documento do projeto no claude.ai). Este design não repete tudo o que está lá. Ele define o recorte do MVP, a ordem de entrega e as decisões de construção.

## 1. Intenção

O estúdio quer uma plataforma web, pensada primeiro para o celular, que seja "a extensão da sala de aula e da pista". Nela o aluno revê em vídeo o passo da última aula, acompanha os eventos e encontra a turma. As atendentes trocam a planilha por um painel. O estúdio passa a ter uma base de contatos com opt-in válido, pronta para mensagens pelo WhatsApp no futuro.

O MVP é a primeira versão que vai para as mãos de todos os alunos. Antes dele, partes menores vão ao ar para o público e para a equipe.

### Por que a ordem dos marcos é esta

- **Hoje não existe nenhum vídeo gravado.** A gravação é o caminho mais longo do projeto e acontece fora do código.
- **O link de ativação é a primeira impressão do aluno.** Se ele cria o acesso e não encontra vídeos, a ativação se perde. Por isso os links só são enviados quando houver conteúdo (M4).
- **O que não depende de vídeo vai ao ar antes:** a vitrine pública (M1) e o painel das atendentes (M2).
- **Não há data fixa.** Cada marco vai ao ar quando fica pronto.

## 2. Objetivos, não objetivos e antiobjetivos

**Objetivos do MVP**
- O aluno acha o passo da última aula em poucos toques, no celular.
- A grade de horários e os eventos ficam públicos e fáceis de compartilhar no WhatsApp e no Instagram.
- As atendentes param de usar a planilha.
- Todo aluno ativo tem um registro de consentimento válido como prova para a LGPD e para a política da Meta, mesmo que tenha recusado tudo.

**Não objetivos**
- Conversa ou interação entre pessoas dentro da plataforma: dúvidas no vídeo, comentários, feed, chat, desafios. A conversa continua nos grupos de WhatsApp, onde hoje é mais fluida. Essas ideias só voltam se o uso real pedir.
- Envio de mensagens pela API do WhatsApp. O MVP só coleta e registra os opt-ins.
- Venda de cursos, aulas ao vivo, cobrança, mensalidades e pagamentos.
- Moderação de conteúdo (sem conteúdo de alunos, não há o que moderar).

**Antiobjetivos** (seria um fracasso mesmo funcionando)
- Vídeos do estúdio vazando para fora da escola.
- Aluno ativado que entra e encontra a plataforma vazia.
- Perder o registro de consentimento.
- Mensagem ou notificação para quem não pediu.
- Comparação ou constrangimento entre alunos.
- Visual genérico de template.

## 3. Restrições

- Mobile first e responsiva. Cada tela é verificada no celular, no tablet e no computador antes de ser considerada pronta.
- Interface, código comentado e documentação em português do Brasil.
- LGPD, direito de imagem (cuidado redobrado com menores) e política de mensagens do WhatsApp Business.
- Vídeos privados, entregues só com token assinado e de curta duração. Nada de links públicos.
- O registro de consentimento só recebe novas linhas, nunca é apagado e tem backup diário fora do servidor.
- Ritmos, módulos e tipos de consentimento são cadastráveis, nunca fixos no código.
- O modelo de dados permite liberar vídeos por turma, ritmo, módulo ou aluno sem reescrita.
- Fluxo de trabalho: Superpowers (brainstorming → plano → TDD → revisão) e design-craft em toda tela. Um único design system no código. Branches e pull requests. Nenhum segredo commitado.

## 4. Abordagens consideradas

### Aplicação

| Abordagem | A favor | Contra |
|---|---|---|
| **A · Next.js (TypeScript) + Postgres + Bunny Stream** (escolhida) | Uma só linguagem. Postgres serve bem ao modelo relacional (turmas, matrículas, histórico de consentimento). Páginas públicas renderizadas no servidor, com prévia de link no WhatsApp. Bunny cobra por uso, protege os vídeos com token e oferece DRM se um dia for preciso. | O painel inteiro é construído tela por tela. |
| B · Django + Postgres com o admin do Django como painel | Cadastros, filtros e importação com prévia saem quase prontos. | O admin tem cara de sistema genérico, e deixá-lo com a identidade do estúdio custa quase o mesmo que construir. |

Descartadas: ferramentas no-code (não dão conta da prova de consentimento, do vídeo protegido nem do trabalho com repositório e testes) e front com API separada (dobra o trabalho sem ganho).

### Hospedagem

A primeira proposta era Supabase + Vercel. O usuário pediu para considerar uma VPS.

| Opção | A favor | Contra |
|---|---|---|
| **V1 · Tudo numa VPS em São Paulo, com Coolify** (escolhida) | Cerca de US$ 15 por mês mais o Bunny. Nenhuma dependência de fornecedor além do Bunny. Dados no Brasil. | Atualizações, segurança, monitoramento e backups ficam com o responsável pela aplicação. |
| V2 · Supabase auto-hospedado na VPS | Mantém o desenho com Supabase. | Vários serviços para manter numa VPS só, com suporte apenas da comunidade. |
| V3 · Next.js na VPS + Supabase gerenciado | Banco e backups gerenciados. Sem custo nem restrição da Vercel. | Cerca de US$ 35 por mês e dependência do Supabase. |

O usuário escolheu a **A** com hospedagem **V1**.

## 5. Decisões de construção

Decididas com o usuário:
- **Stack:** Next.js (App Router, TypeScript) e PostgreSQL em containers numa VPS em São Paulo, com deploy, certificados e backups pelo Coolify. Login feito dentro da própria aplicação, sem serviço externo de autenticação. Vídeos no Bunny Stream.
- **Contas e titularidade:** a aplicação e as contas de infraestrutura (VPS, Bunny, armazenamento de backup, e-mail) ficam no nome do usuário. Perante a LGPD, o estúdio tende a ser o controlador dos dados dos alunos e o usuário o operador. Recomenda-se um contrato simples entre os dois.
- **Período contratado:** um período por aluno (não por turma). Quando ele vence, a regra da decisão D3 vale para todos os vídeos do aluno.
- **Importação da planilha:** fica para o fim do projeto (M4), antes do envio dos links para todos. Até lá, as atendentes cadastram à mão.
- **Menores de idade:** a atendente informa a data de nascimento. Se o aluno for menor, ela cadastra também o responsável (nome, WhatsApp, e-mail). O link de ativação vai para o responsável. É ele quem aceita os termos, escolhe os opt-ins (inclusive o uso de imagem) e cria o acesso que o aluno usa para assistir. O registro de consentimento fica no nome e no contato do responsável. Ao completar 18 anos, o aluno é convidado a revisar as preferências no próprio nome.
- **Comunidade no MVP:** só o link do grupo de WhatsApp da turma e o botão de compartilhar (evento e vídeo) no WhatsApp. O link de um vídeo continua exigindo login.
- **Consentimentos pedidos no lançamento:** WhatsApp para avisos de serviço, WhatsApp para novidades, aparecer no "quem vai" dos eventos e uso de imagem. Todos desligados por padrão. Perfil visível, e-mail e notificações entram como tipos novos quando essas funções existirem.

Propostas minhas, que o usuário pode corrigir:
- **Piloto antes do envio geral:** no M4, os links vão primeiro para uma turma piloto, cadastrada à mão. O envio para todos só acontece depois de corrigir o que o piloto mostrar.
- **O link de ativação nasce no M4.** No M2 os alunos ficam como "cadastrado". A geração do link, o envio e o formulário de ativação entram juntos no M4.
- **Envio do link sem API:** botão que abre o WhatsApp comum do estúdio com a mensagem pronta (link wa.me), botão de copiar e QR code para o balcão. Não se usa template da API, porque ainda não há opt-in.
- **Login do aluno:** e-mail e senha criados na ativação, com recuperação de senha por e-mail.
- **Quem tem login:** o login pertence a um adulto. O aluno adulto tem o próprio login. No caso de menores, quem tem o login é o responsável, e uma mesma conta de responsável pode estar ligada a vários filhos, com troca entre eles na tela. Se o responsável também for aluno, a mesma conta mostra os vídeos dele e os dos filhos. Cada adulto precisa de um e-mail próprio, e o e-mail não se repete entre contas. Ao completar 18 anos, o aluno recebe um convite para criar o próprio login e assumir os próprios consentimentos.
- **Publicar vídeo exige confirmar a autorização de imagem** de todos que aparecem nele. O sistema registra quem confirmou e quando.
- **Quem aparece em cada vídeo:** o vídeo registra as pessoas que aparecem nele (por padrão, o professor). Se alguém que aparece num vídeo retirar a autorização de uso de imagem, o vídeo sai do ar automaticamente e o professor e a administração são avisados no painel.
- **Proteção contra vazamento no MVP:** login individual e tokens curtos. Limite de sessões simultâneas e marca d'água com a identidade de quem assiste ficam para depois, se aparecer vazamento.
- **Backups:** dump diário do Postgres enviado para armazenamento compatível com S3 fora da VPS, com retenção de pelo menos 30 dias, alerta em caso de falha e restauração testada antes de o M0 terminar e de novo antes do M4.

## 6. Trilhas fora do código (começam já, em paralelo)

| Trilha | O que é | Precisa estar pronta antes de |
|---|---|---|
| T1 · Gravação | Os professores gravam no celular seguindo um guia curto (formato, enquadramento, um passo por vídeo) e guardam os arquivos até o M3. | M3 (envio do primeiro lote) |
| T2 · Identidade visual | Nome, logo, cores e fotos reais do estúdio. | M1 |
| T3 · Autorizações de imagem | Termo assinado por quem aparece nos vídeos: professores e alunos que participem das gravações (o responsável, no caso de menores). | Publicação de cada vídeo (M3) |
| T4 · Textos legais | Termos de uso, política de privacidade e o texto de cada opt-in, cada um com versão. Recomenda-se revisão jurídica. | M4 |

## 7. Marcos

### M0 · Base
- **Servidor:** VPS em São Paulo com acesso SSH só por chave, firewall liberando apenas as portas necessárias e atualizações de segurança automáticas. Coolify instalado.
- **Ambientes:** homologação e produção na VPS. Deploy automático a partir do repositório e certificados SSL automáticos. Segredos só em variáveis de ambiente.
- **Banco:** Postgres em container, com migrações versionadas no repositório e aplicáveis do zero.
- **Backups:** conforme a seção 5, com uma restauração feita e verificada.
- **Monitoramento:** alerta quando a aplicação sai do ar ou o backup falha.
- **Código:** projeto Next.js + TypeScript, com lint, checagem de tipos e testes rodando na integração contínua a cada pull request.
- **Identidade:** `docs/design.md` conforme o design-craft (voz, paleta em hex, duas fontes, escala de espaçamento, elemento-assinatura, lista de "nunca fazer"). Se a T2 não tiver entregado o material, a identidade é provisória e marcada como tal.
- **Modelo de dados núcleo:**
  - pessoas, contas de login e papéis: administração, atendente, professor, aluno, responsável (com ligação responsável ↔ filhos);
  - ritmos, módulos, professores;
  - turmas (ritmo + módulo + professor + dias + horário + link do grupo de WhatsApp);
  - matrícula aluno ↔ turma, com um aluno podendo estar em várias turmas;
  - período contratado do aluno e extensões;
  - tipos de consentimento (lista extensível) e registros de consentimento, que só recebem novas linhas;
  - vídeos, pessoas que aparecem em cada vídeo e concessões de acesso (por turma, ritmo, módulo ou aluno);
  - eventos e confirmações de presença.
- **Acesso da equipe:** login da equipe e controle de acesso por papel.

**Pronto quando:** a produção está no ar com HTTPS; a administração entra no painel; as migrações sobem do zero num banco vazio; a integração contínua passa; um backup foi restaurado com sucesso num banco separado.

### M1 · Vitrine pública
- A administração cadastra ritmos, módulos, professores, turmas e eventos (com imagem de capa).
- Grade de horários pública, com filtros por ritmo, módulo, professor e dia.
- Lista pública de eventos e página de cada evento, com prévia de link (Open Graph) para o WhatsApp e o Instagram, botão de compartilhar no WhatsApp e botão de copiar link.
- Próximo evento em destaque na página inicial pública.
- A página pública nunca mostra nomes de alunos.

**Pronto quando:** a grade real do estúdio está cadastrada e aparece sem login; o link de um evento colado no WhatsApp mostra a prévia; as telas foram verificadas no celular, no tablet e no computador, com estados vazio, carregando e erro desenhados.

### M2 · Painel das atendentes
- Cadastro e edição de aluno: nome, WhatsApp, e-mail, data de nascimento, responsável (se menor) e turmas.
- Período contratado: início, fim, extensões (dias, motivo, quem fez, quando) e histórico. A data de fim exibida já considera as extensões.
- Situação do aluno (cadastrado → link enviado → ativo → inativo). No M2 todos ficam como "cadastrado".
- Busca e filtros por turma, ritmo, módulo, professor e situação.
- Dash v1, em que cada número abre a lista correspondente:
  - alunos com período vigente, no total e por turma, ritmo, módulo e professor;
  - períodos que vencem nos próximos dias.

**Pronto quando:** as atendentes cadastram no painel os alunos novos e as mudanças do dia a dia, e a turma piloto está cadastrada. Os alunos atuais entram pela importação no M4.

### M3 · Professores e vídeos
- A administração convida os professores. Cada professor entra com o próprio login.
- O professor envia vídeos direto para o Bunny Stream, pelo celular ou pelo computador, com envio que retoma se a conexão cair.
- Organização por ritmo → módulo → passo (título, descrição curta, ordem). O professor só publica nos ritmos que ensina.
- Vídeo em rascunho ou publicado. Para publicar, é preciso registrar quem aparece e confirmar a autorização de imagem.
- Proteção: autenticação por token no player e na entrega (CDN). O servidor só gera um token curto depois de conferir o direito de acesso de quem pede.
- Concessões de acesso aplicadas segundo a regra inicial (decisão D1).

**Pronto quando:** cada professor publicou o primeiro lote; um vídeo não toca sem token válido; um link copiado deixa de funcionar quando o token expira.

### M4 · Lançamento para os alunos (MVP)
- Geração do link individual de ativação: único, com validade e reenviável. Envio pelo WhatsApp comum (mensagem pronta), copiar link ou QR code.
- Formulário de ativação no celular: conferir os dados, aceitar os termos e a política (registrando a versão), escolher os opt-ins (nenhum pré-marcado) e criar o acesso. Caminho do responsável para menores.
- Registro de cada aceite e cancelamento: tipo, canal e contato, ação, data e hora, versão do texto, origem (ativação ou preferências), IP, navegador e quem deu (aluno ou responsável).
- Página de preferências, sempre disponível, para mudar o que foi aceito.
- Área do aluno:
  - página inicial com o próximo evento em destaque e os passos das suas turmas;
  - navegação ritmo → módulo → professor → passo, com filtros por professor e módulo;
  - player ocupando bem a tela do celular;
  - botão de compartilhar o vídeo no WhatsApp (o link exige login);
  - link para o grupo de WhatsApp de cada turma.
- Eventos para quem está logado: confirmar presença e ver "quem vai", só com quem deu opt-in.
- Fim do período contratado, conforme a decisão D3.
- Dash v2:
  - ativações pendentes, com botão de reenviar;
  - quantos aceitaram cada tipo de opt-in;
  - próximos eventos e número de confirmações;
  - vídeos mais assistidos (contagem própria a cada reprodução).
- Exportar a lista de contatos com opt-in de novidades, respeitando os consentimentos registrados.
- Importação da planilha atual (CSV ou XLSX), com prévia que aponta erros e duplicados antes de salvar. O mapeamento de colunas parte do cabeçalho da planilha, sem dados de alunos no repositório.
- Ordem do lançamento:
  1. links para a turma piloto e correções;
  2. importação dos alunos atuais;
  3. links para todos.

**Pronto quando:** a turma piloto ativou sem ajuda da recepção; os alunos atuais foram importados e revisados; todo aluno ativado tem registro de consentimento; o aluno chega ao passo da última aula em poucos toques no celular; os links foram enviados para todos.

### Depois do MVP (sem ordem definida)
Galeria de fotos e vídeos dos eventos; perfil e progresso pessoal; minha agenda; extensão de período em lote; envios pela API do WhatsApp com cancelamento automático vindo da mensagem; opt-in de visitantes na página de eventos; avisos por e-mail e notificação no celular; limite de sessões e marca d'água nos vídeos; dúvidas no vídeo e desafio do passo, só se o uso pedir.

## 8. Decisões em aberto, com prazo

| # | Decisão | Até | Proposta atual |
|---|---|---|---|
| D1 | Quais vídeos cada aluno vê | Fim do M3 | Os vídeos do ritmo e do módulo das turmas dele, de todos os professores |
| D2 | Conteúdo mínimo para lançar | Antes de a gravação começar (T1), porque os professores precisam saber a meta antes de gravar | A definir com os professores |
| D3 | O que acontece no fim do período contratado | Início do M4 | O aluno passa para inativo e perde o acesso aos vídeos até renovar |
| D4 | Identidade visual (nome, logo, cores, fotos) | Início do M1 | — |
| D5 | Cabeçalho da planilha atual | Início do M4 | — |
| D6 | Textos legais e de cada opt-in | Início do M4 | — |
| D7 | Quais ritmos o estúdio ensina e se há danças a dois | Antes de a gravação começar | Influencia o guia de gravação (enquadramento vertical ou horizontal) |

## 9. O que fica com quem construir

- Provedor e plano da VPS em São Paulo (com pelo menos 2 vCPU e 4 GB de RAM, mínimo do Coolify), provedor do armazenamento de backup e provedor de e-mail para a recuperação de senha.
- Biblioteca de autenticação, ORM e ferramenta de migrações.
- Estrutura de pastas, bibliotecas de UI, de formulários e de testes, dentro do design system único.
- Esquema exato das tabelas e onde aplicar as regras de acesso (na aplicação, em políticas RLS do Postgres ou nas duas), desde que respeite as restrições acima.
- Forma de calcular a situação do aluno a partir da ativação e do período contratado.
- Detalhes do guia de gravação, depois da D7.
