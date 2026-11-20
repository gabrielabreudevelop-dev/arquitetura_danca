# Design da plataforma

**Identidade provisória — substituir quando o estúdio entregar logo, cores e fotos (trilha T2, decisão D4).**

O nome "Arquitetura da Dança" também é provisório. Ele aparece no código em um lugar só: `NOME_ESTUDIO`, em `src/app/marca.tsx`.

Este documento descreve as regras. Os valores valem no código: os tokens ficam em `src/app/globals.css` e as fontes em `src/app/layout.tsx`. Se os dois discordarem, o código vence e este documento é corrigido.

## Pelo que queremos ser lembrados

> A extensão da sala de aula e da pista: onde você revê o passo e encontra sua turma.

Esse é o diferencial. Não somos um curso online nem uma rede social. Somos o lugar onde o que aconteceu na aula continua: o passo que o professor mostrou, a turma com quem você dança e o próximo evento do estúdio. Toda tela responde primeiro a "o que eu vim fazer aqui?" e só depois enfeita.

Quem usa:
- **Alunos**, quase sempre no celular, com pouco tempo: entre uma aula e outra, no ônibus, na beira da pista. Precisam achar o passo da última aula em poucos toques.
- **Equipe do estúdio**, no computador da recepção, cadastrando alunos e turmas no lugar da planilha. Precisa de clareza e de listas, não de enfeite.

## Voz

- Falamos com "você", em frases curtas e diretas, como alguém da recepção que conhece o aluno pelo nome.
- Verbos que dizem o que acontece: "Entrar", "Sair", "Voltar ao início". O botão mantém o mesmo nome do começo ao fim do fluxo.
- Texto específico em vez de esperto: "E-mail ou senha incorretos", não "Ops! Algo deu errado".
- Frases com inicial maiúscula só na primeira palavra. Nada de CAIXA ALTA, exceto na marca.
- Quando algo ainda não existe, dizemos o que vai existir e quando ("Essas telas chegam nos próximos marcos"), sem fingir que existe.
- Sem exclamações em série, sem emojis e sem jargão técnico na interface.

## Paleta

Só existem estas seis cores. As cores padrão do Tailwind foram zeradas: `bg-white` ou `text-red-500` não geram CSS.

| Token | Hex | Papel | Contraste com `fundo` |
|---|---|---|---|
| `fundo` | `#F6F1E9` | Fundo de todas as telas. Um bege claro, de piso de madeira e papel, no lugar do branco. | — |
| `texto` | `#1B1813` | Texto, botão principal e contorno de foco. Quase preto e quente. | 15,7 : 1 |
| `destaque` | `#F5B700` | Amarelo da fita de marcação. **Só como fundo**, sempre com texto na cor `texto` por cima (9,8 : 1). Nunca como cor de texto. | 1,6 : 1 |
| `borda` | `#8A7F70` | Contorno de campos (3,5 : 1, o mínimo para componentes). Divisórias usam `borda/40`. | 3,5 : 1 |
| `erro` | `#B3261E` | Mensagens e campos com erro. | 5,8 : 1 |
| `sucesso` | `#1F6B43` | Confirmações ("Salvo", "Link enviado"). | 5,8 : 1 |

Texto secundário usa `text-texto/70` (6,2 : 1). É assim que um texto fica subordinado: com cor mais suave, não com tamanho menor.

Só existe modo claro. O modo escuro não está desenhado e por isso não existe.

## Fontes

Duas famílias, cada uma com um papel. As duas vêm de pacotes `@fontsource-variable` (licença OFL) e são carregadas com `next/font/local`, sem depender de rede no build.

- **Títulos: Archivo**, na largura condensada (`wdth` 75) e peso 600. Tem a firmeza de uma planta de arquitetura e cabe frases grandes na tela do celular. Uso: `h1`, `h2`, `h3` (já aplicada pela base do CSS) e a marca (`font-titulo`).
- **Texto: Atkinson Hyperlegible Next**, peso 400 e, para rótulos e nomes, 600. Foi desenhada para leitura fácil, com letras que não se confundem (I, l, 1; O, 0). Serve tanto ao aluno no celular quanto à atendente na recepção. É a fonte padrão do corpo.

## Tamanhos de texto

Exatamente três. Os tamanhos padrão do Tailwind foram zerados: `text-xl` não gera CSS.

| Token | Valor | Altura de linha | Uso |
|---|---|---|---|
| `text-pequeno` | 14 px | 1,45 | Apoio: descrições curtas, ajuda abaixo de formulários, datas. |
| `text-base` | 17 px | 1,55 | Todo o resto: parágrafos, rótulos, campos, botões, a marca, subtítulos (`h2` em `text-base`). |
| `text-titulo` | 36 a 56 px, fluido | 1,05 | O título da tela. Um por tela. |

Hierarquia além disso se faz com peso (400 ou 600), com cor (`texto` ou `texto/70`) e com espaço, nunca com um quarto tamanho. Campos usam `text-base` (17 px), acima dos 16 px que evitam o zoom automático do iPhone.

## Espaçamento

Base de 4 px (`--spacing: 0.25rem`). Usamos só estes passos, cada um pelo menos 25% maior que o anterior:

| Classe | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24 |
|---|---|---|---|---|---|---|---|---|---|
| px | 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 96 |

Regras:
- Mais espaço entre grupos do que dentro deles. Rótulo e campo: `gap-2`. Entre campos: `gap-6`. Entre blocos da tela: `gap-8` ou `gap-12`.
- Margem lateral: `px-6` no celular, `md:px-12` a partir do tablet. Largura máxima: `max-w-md` em formulários, `max-w-5xl` em telas de conteúdo, `max-w-prose` em parágrafos.
- Áreas de toque com pelo menos 48 px de altura (`min-h-12`), acima do mínimo de 44 px. Links de texto ganham área com `min-h-12` e `px-2 -mx-2`, sem mudar de lugar.

## Elemento-assinatura: a fita

Nos estúdios, a fita colorida colada no chão marca onde cada um fica. Aqui ela marca o que importa na tela: a classe `fita` põe uma faixa amarela (`destaque`) atrás de poucas palavras, como em "Onde você **revê o passo** e encontra sua turma".

- No máximo uma fita por tela, sobre duas a quatro palavras.
- É o único lugar onde a interface ousa. O resto fica quieto para a fita aparecer.
- Telas de tarefa (entrar, painel, formulários) normalmente não têm fita: ali a ação é o destaque.
- Quando chegarem as fotos reais do estúdio, a fita pode marcar uma palavra sobre a foto, nunca a foto inteira.

## Componentes básicos

- **Botão principal:** `bg-texto text-fundo`, `font-semibold`, `min-h-12`, largura total no celular. Um por tela.
- **Botão secundário:** contorno `border-texto`, fundo transparente.
- **Link:** sublinhado em `decoration-borda`, que escurece ao passar o mouse.
- **Campo:** rótulo acima (`font-semibold`), borda `borda`, fundo transparente, `min-h-12`. Com erro, `aria-invalid` deixa a borda em `erro`.
- **Foco:** contorno de 2 px na cor `texto`, afastado 3 px, em todo elemento focável pelo teclado.
- **Cantos:** `rounded-sm` (4 px) em campos e botões; o resto é reto.

## Estados

Todo estado tem desenho e texto próprios:
- **Carregando:** o botão diz o que está acontecendo ("Entrando…", "Saindo…") e fica desativado; o formulário recebe `aria-busy`.
- **Erro:** mensagem em `erro`, acima do botão, com `role="alert"`, dizendo o que houve e, quando der, o que fazer ("Aguarde um minuto e tente de novo").
- **Vazio:** um título curto dizendo que ainda não há nada e um parágrafo dizendo o que vai aparecer ali e como chegar lá.
- **Sucesso:** mensagem em `sucesso`, curta, perto de onde a ação aconteceu.

## Fotos e vídeos

Só fotos e vídeos reais do estúdio, de alunos que autorizaram o uso de imagem. Nenhuma imagem de banco de imagens, ilustração genérica ou ícone decorativo no lugar delas. Enquanto as fotos não chegam (trilha T2), as telas ficam sem imagem. O lugar reservado para a primeira foto é a tela inicial, ao lado da frase principal no computador e abaixo dela no celular.

## Nunca fazer

- Usar cor, tamanho de texto ou família fora dos tokens. Se faltar um, discutir e acrescentar aqui e em `globals.css`.
- Mais de uma fita por tela, ou fita em texto longo.
- Cards como primeira opção. Antes vêm listas, tabelas e divisórias.
- Degradês, brilhos, sombras decorativas, texto em degradê ou roxo de "app de IA".
- Selos, pílulas com ícone, um ícone por linha, bordas coloridas na lateral de blocos.
- Números decorativos no painel. Número só aparece quando leva a uma lista ou a uma ação.
- Texto cinza sobre fundo colorido, ou texto amarelo (`destaque`) sobre o fundo claro.
- Ranking, curtidas expostas ou qualquer coisa que compare alunos.
- Imagens genéricas de dança no lugar de fotos do estúdio.
- Pré-marcar qualquer opção de consentimento.
- Área de toque menor que 44 px.
