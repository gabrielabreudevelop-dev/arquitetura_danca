# Design da plataforma

A identidade vem do site do estúdio: rosa, amarelo e laranja sobre branco, Raleway e Dancing Script.

O logo original ainda não chegou. Até lá, a marca é o nome do estúdio em Dancing Script (`Marca`, em `src/app/marca.tsx`). Nome, contatos, endereço e horário ficam num lugar só: `ESTUDIO`, em `src/estudio.ts`.

Este documento descreve as regras. Os valores valem no código: os tokens ficam em `src/app/globals.css` e as fontes em `src/app/layout.tsx`. Se os dois discordarem, o código vence e este documento é corrigido.

## Pelo que queremos ser lembrados

> A extensão da sala de aula e da pista: onde você revê o passo e encontra sua turma.

Esse é o diferencial. Não somos um curso online nem uma rede social. Somos o lugar onde o que aconteceu na aula continua: o passo que o professor mostrou, a turma com quem você dança e o próximo evento do estúdio. Toda tela responde primeiro a "o que eu vim fazer aqui?" e só depois enfeita.

Quem usa:
- **Alunos**, quase sempre no celular, com pouco tempo: entre uma aula e outra, no ônibus, na beira da pista. Precisam achar o passo da última aula em poucos toques.
- **Equipe do estúdio**, no computador da recepção, cadastrando alunos e turmas no lugar da planilha. Precisa de clareza e de listas, não de enfeite.

## Voz

- Voz calorosa e direta. Falamos com "você", em frases curtas, como alguém da recepção que conhece o aluno pelo nome e sorri ao atender.
- Verbos que dizem o que acontece: "Entrar", "Sair", "Voltar ao início". O botão mantém o mesmo nome do começo ao fim do fluxo.
- Texto específico em vez de esperto: "E-mail ou senha incorretos", não "Ops! Algo deu errado".
- Frases com inicial maiúscula só na primeira palavra. Nada de CAIXA ALTA.
- Quando algo ainda não existe, dizemos o que vai existir e quando ("Essas telas chegam nos próximos marcos"), sem fingir que existe.
- Sem exclamações em série, sem emojis e sem jargão técnico na interface.

## Paleta

Só existem estas cores. As cores padrão do Tailwind foram zeradas: `bg-white` ou `text-red-500` não geram CSS. Contrastes calculados pela fórmula da WCAG.

| Token | Hex | Papel | Contraste |
|---|---|---|---|
| `fundo` | `#FFFFFF` | Fundo de todas as telas. | — |
| `fundo-suave` | `#F2F2F2` | Faixas e áreas de apoio. Texto `texto-suave` sobre ele passa (6,7 : 1). | — |
| `texto` | `#1F1F1F` | Texto, contorno de foco e texto sobre fita e rosa suave. | 16,5 : 1 |
| `texto-suave` | `#555555` | Texto secundário. É assim que um texto fica subordinado: cor mais suave, não tamanho menor. | 7,5 : 1 |
| `borda` | `#8C8C8C` | Contorno de campos, o mínimo para componentes. | 3,4 : 1 |
| `linha` | `#DCDCDC` | Divisórias e filetes. Decorativa, sem texto. | 1,4 : 1 |
| `marca` | `#C25B8F` | Rosa da marca. **Decorativa**: filetes, realces, grandes áreas. Nunca como fundo de texto branco (4,0 : 1), nunca como texto pequeno. | 4,0 : 1 |
| `acao` | `#A8457A` | Fundo do botão principal, com texto branco. | 5,5 : 1 |
| `acao-escura` | `#8E3A67` | Hover do botão principal. | 7,1 : 1 |
| `link` | `#7F2F57` | Links e texto de ação em rosa. Também sobre `rosa-suave` (7,3 : 1). | 8,6 : 1 |
| `rosa-suave` | `#F8E9F1` | Fundo de destaque leve, com texto `texto` (14,1 : 1). | — |
| `amarelo` | `#F5E056` | **Só como fundo ou realce**, com texto `texto` por cima. Nunca como texto. | 1,3 : 1 |
| `laranja` | `#F58C23` | Fim da fita. Só como fundo ou realce, com texto `texto` (6,8 : 1). Nunca como texto. | 2,4 : 1 |
| `palco` | `#1A1A1A` | Fundo escuro da `faixa-esgotado` e de áreas de palco, com texto branco. | 17,4 : 1 |
| `erro` | `#B3261E` | Mensagens e campos com erro. | 6,5 : 1 |
| `sucesso` | `#1F6B43` | Confirmações ("Salvo", "Link enviado"). | 6,5 : 1 |

Contraste é sempre com `fundo`, salvo onde o papel diz outra coisa. Só existe modo claro. O modo escuro não está desenhado e por isso não existe.

## Fontes

Duas famílias, cada uma com um papel. As duas vêm de pacotes `@fontsource-variable` (licença OFL) e são carregadas com `next/font/local`, sem depender de rede no build.

- **Raleway** (variável), para texto e títulos. Peso 400 no corpo, 600 em rótulos, nomes e botões, 700 nos títulos (`h1`, `h2`, `h3`, já aplicado pela base do CSS). Geométrica e aberta, a mesma do site do estúdio. Classes: `font-texto` (padrão) e `font-titulo`.
- **Dancing Script** (variável), só para a assinatura: a marca e frases de assinatura como o slogan. Nunca em parágrafos, rótulos ou botões. Classe: `font-assinatura`. Sem `uppercase`.

## Tamanhos de texto

Exatamente três. Os tamanhos padrão do Tailwind foram zerados: `text-xl` não gera CSS.

| Token | Valor | Altura de linha | Uso |
|---|---|---|---|
| `text-pequeno` | 14 px | 1,45 | Apoio: descrições curtas, ajuda abaixo de formulários, datas. |
| `text-base` | 17 px | 1,55 | Todo o resto: parágrafos, rótulos, campos, botões, a marca, subtítulos (`h2` em `text-base`). |
| `text-titulo` | 36 a 56 px, fluido | 1,05 | O título da tela. Um por tela. |

Hierarquia além disso se faz com peso (400, 600 ou 700), com cor (`texto` ou `texto-suave`) e com espaço, nunca com um quarto tamanho. Campos usam `text-base` (17 px), acima dos 16 px que evitam o zoom automático do iPhone.

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

Nos estúdios, a fita colorida colada no chão marca onde cada um fica. Aqui ela marca o que importa na tela: a classe `fita` põe uma faixa em degradê amarelo para laranja (`#F5DB53` → `#F58C23`) atrás de poucas palavras, como em "Onde você **revê o passo** e encontra sua turma". O texto sobre ela é sempre `texto`.

- No máximo uma fita por tela, sobre duas a quatro palavras.
- É a única ousadia da interface e o único degradê do produto. O resto fica quieto para a fita aparecer.
- Telas de tarefa (entrar, painel, formulários) normalmente não têm fita: ali a ação é o destaque.
- Quando chegarem as fotos reais do estúdio, a fita pode marcar uma palavra sobre a foto, nunca a foto inteira.

## Faixa "Esgotado"

A classe `faixa-esgotado` (fundo `palco`, texto branco, `font-semibold`) avisa que uma turma ou um evento lotou. É a **única exceção** à regra de "sem selos": diz um fato que muda o que a pessoa vai fazer. Não vira modelo para outros selos.

## Componentes básicos

- **Botão principal:** `bg-acao text-fundo hover:bg-acao-escura`, `font-semibold`, `min-h-12`, largura total no celular. Um por tela.
- **Botão secundário:** contorno `border-acao`, texto `link`, fundo transparente; no hover vira `bg-acao text-fundo`.
- **Link:** texto `link` com sublinhado em `decoration-link`, que engrossa ao passar o mouse.
- **Campo:** rótulo acima (`font-semibold`), borda `borda`, fundo transparente, `min-h-12`. Com erro, `aria-invalid` deixa a borda em `erro`.
- **Foco:** contorno de 2 px na cor `texto`, afastado 3 px, em todo elemento focável pelo teclado.
- **Cantos:** `rounded-sm` (4 px) em campos e botões; o resto é reto.
- **Pular para o conteúdo:** primeiro elemento do `body`, visível só no foco do teclado, aponta para `#conteudo`. Todo `<main>` leva `id="conteudo"`.

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
- Amarelo ou laranja como cor de texto, ou texto branco sobre `marca`. Texto branco só sobre `acao`, `acao-escura`, `palco` e `erro`/`sucesso`.
- Mais de uma fita por tela, ou fita em texto longo.
- Um segundo degradê. A fita é o único.
- Cards como primeira opção. Antes vêm listas, tabelas e divisórias.
- Brilhos, sombras decorativas, texto em degradê ou roxo de "app de IA".
- Selos, pílulas com ícone, um ícone por linha, bordas coloridas na lateral de blocos. Única exceção: a `faixa-esgotado`.
- Dancing Script fora da marca e das frases de assinatura.
- Números decorativos no painel. Número só aparece quando leva a uma lista ou a uma ação.
- Texto cinza sobre fundo colorido.
- Ranking, curtidas expostas ou qualquer coisa que compare alunos.
- Imagens genéricas de dança no lugar de fotos do estúdio.
- Pré-marcar qualquer opção de consentimento.
- Área de toque menor que 44 px.
