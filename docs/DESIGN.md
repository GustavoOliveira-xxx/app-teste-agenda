# Design

Este documento descreve o sistema visual do Agenda Compartilhada: princípios, cores, temas claro e escuro, tipografia, espaçamentos, bordas, tamanhos de toque, componentes, ícones, padrões de mensagens e o tom dos textos. Ele responde à seção 24 do prompt ("Design e UX").

Todos os valores foram lidos do código: `app-mobile/src/theme/tokens.ts` (as "variáveis de design", chamadas de tokens), `app-mobile/src/theme/ThemeProvider.tsx`, os componentes em `app-mobile/src/components/` e os textos em `app-mobile/src/i18n/pt-BR.ts`. Os contrastes foram calculados com a fórmula da WCAG 2 a partir desses valores (não foram medidos na tela de um celular). Ainda não existem capturas de tela.

Para a lista de telas, veja [TELAS.md](TELAS.md). Para as decisões técnicas, [DECISOES.md](../DECISOES.md).

## Princípios aplicados

| Princípio pedido | Como aparece no app |
|---|---|
| Limpo | Fundo cinza bem claro (ou quase preto no tema escuro), conteúdo em cartões com borda fina em vez de sombra, um botão principal por tela fixo no rodapé ("Salvar", "Criar agenda") |
| Moderno | Cantos arredondados (12 e 16), etiquetas e filtros em formato de pílula, ícones de contorno da família Ionicons |
| Neutro e não romântico | Cor principal azul (`#3358D4`); nenhum coração ou símbolo de casal; os textos falam em "casal, família, amigos ou equipe"; tipos de agenda neutros (Pessoal, Compartilhada, Família, Profissional, Projeto, Viagem, Personalizada) |
| Acolhedor | Tratamento por "você", frases curtas, mensagens que explicam o problema e dizem o que fazer (veja [Textos e tom](#textos-e-tom)) |
| Utilizável por casais, famílias e equipes | Papéis com nome e explicação visível ("Só visualiza. Não altera nada na agenda."), cor por agenda, nome da agenda em cada evento |
| Acessível | Contraste calculado dos textos acima de 4,5:1 nos dois temas; rótulos para leitor de tela em botões só com ícone; informação nunca só por cor (etiquetas com texto, ✓ na opção escolhida, nome em cada cor); áreas de toque de 48 dp na maioria dos controles. Há exceções, listadas em [Limitações](#limitações) |
| Consistente | Um único arquivo de tokens e 25 componentes reutilizados em todas as telas |
| Responsivo | Layout em colunas flexíveis; etiquetas e filtros quebram linha; o texto acompanha o tamanho de fonte escolhido no celular; respeita as áreas seguras (entalhe e barra de gestos) |
| Confortável em tela pequena | Botão principal no rodapé ao alcance do polegar; botão redondo "+" no canto inferior direito; campos avançados do evento escondidos em "Mais opções"; app só em retrato |

## Cores

### Tokens de cor

Cada cor tem um nome (token) e um valor para cada tema. As telas nunca usam o valor direto: pedem o token ao tema (`useAppTheme().colors`).

| Token | Para que serve | Claro | Escuro |
|---|---|---|---|
| `background` | Fundo das telas | `#F7F8FA` | `#111318` |
| `surface` | Cartões, cabeçalho, barra de abas, campos, diálogos | `#FFFFFF` | `#1A1D24` |
| `surfaceAlt` | Fundo do seletor Mês/Semana/Dia/Lista, linha pressionada, etiqueta neutra | `#EEF1F5` | `#242833` |
| `border` | Bordas de cartões e divisórias | `#D5DAE1` | `#363C4A` |
| `inputBorder` | Contorno de campos de formulário e interruptor desligado (mínimo de 3:1) | `#858D9B` | `#646C7E` |
| `text` | Texto principal | `#1A1D23` | `#ECEEF2` |
| `textMuted` | Texto secundário, ícones e abas inativas | `#555B68` | `#AAB1BE` |
| `primary` | Destaque: botão principal, aba ativa, item escolhido, links | `#3358D4` | `#8EA6F0` |
| `primaryText` | Texto e ícone sobre `primary` | `#FFFFFF` | `#0E1426` |
| `primarySoft` | Fundo de filtro escolhido, etiqueta de destaque, caixa do código de convite | `#E6ECFC` | `#26304D` |
| `danger` | Erros, excluir, "Cancelado" | `#C2261F` | `#FF8A80` |
| `dangerText` | Texto sobre `danger` (botão de perigo) | `#FFFFFF` | `#2A0B09` |
| `dangerSoft` | Fundo de etiqueta de erro | `#FDECEB` | `#3D1F1E` |
| `success` | Sucesso, mensagem rápida de confirmação, "Aceito", "Concluído" | `#1F7A45` | `#7CD49B` |
| `successSoft` | Fundo de etiqueta de sucesso | `#E5F4EA` | `#1C3326` |
| `warning` | Sem internet, "Aguardando envio", conflitos | `#8A5300` | `#FFC266` |
| `warningSoft` | Fundo da faixa "Sem internet" e de etiquetas de aviso | `#FFF3DC` | `#3A2C14` |
| `focus` | Borda do campo em foco, contorno da cor escolhida | `#1F3FA8` | `#C3D0FA` |
| `overlay` | Véu escuro atrás de diálogos e listas de opções | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.6)` |
| `today` | Anel em volta do dia de hoje no mês | `#3358D4` | `#8EA6F0` |

### Contraste calculado

Razão de contraste (quanto maior, mais legível). A WCAG pede pelo menos 4,5:1 para texto comum.

| Combinação | Claro | Escuro |
|---|---|---|
| `text` sobre `background` | 15,89:1 | 16,00:1 |
| `text` sobre `surface` | 16,88:1 | 14,52:1 |
| `textMuted` sobre `background` | 6,41:1 | 8,62:1 |
| `textMuted` sobre `surfaceAlt` | 6,01:1 | 6,83:1 |
| `primary` sobre `surface` (botão secundário, links) | 6,02:1 | 7,12:1 |
| `primaryText` sobre `primary` (botão principal) | 6,02:1 | 7,73:1 |
| `primary` sobre `primarySoft` (filtro escolhido) | 5,10:1 | 5,50:1 |
| `danger` sobre `surface` | 5,85:1 | 7,39:1 |
| `success` sobre `successSoft` | 4,70:1 | 7,57:1 |
| `warning` sobre `warningSoft` (faixa sem internet) | 5,76:1 | 8,49:1 |
| Texto da mensagem rápida (cor `background`) sobre `success` | 5,03:1 | 10,39:1 |
| `dangerText` sobre `danger` (botão de perigo) | 5,85:1 | 8,00:1 |
| `inputBorder` sobre `surface` (contorno de campo, mínimo 3:1) | 3,34:1 | 3,20:1 |

## Temas claro, escuro e automático

- **Onde se escolhe:** Perfil > Preferências > Tema, com as opções "Automático (do celular)", "Claro" e "Escuro". A escolha fica salva na conta (no servidor), então vale em qualquer aparelho em que a pessoa entrar.
- **Automático é o padrão.** Antes do login (telas de boas-vindas, cadastro etc.), o app sempre segue o tema do celular.
- **Como funciona:** `ThemeProvider` decide se o tema é escuro (`dark`) quando a preferência é "Escuro", ou quando é "Automático" e o celular está no modo escuro. Ele entrega a paleta certa para todas as telas.
- **Também acompanham o tema:** o cabeçalho e a barra de abas (via tema de navegação em `src/app/_layout.tsx`), a cor dos ícones da barra de status do Android e a splash (fundo `#F7F8FA` no claro e `#111318` no escuro, em `app.json`).
- **Movimento reduzido:** `ThemeProvider` também lê se o celular pede menos animações (`reduceMotion`). Com isso ligado, diálogos, listas de opções e o seletor de data do iOS abrem sem animação.

## Tipografia

O app usa a **fonte padrão do sistema** (no Android, normalmente a Roboto). Não há fonte própria carregada. A única exceção é a tela Diagnóstico, que usa fonte monoespaçada para os dados técnicos.

| Estilo (`variant`) | Tamanho | Altura da linha | Peso | Onde aparece |
|---|---|---|---|---|
| `display` | 28 | 36 | 800 | Nome do app em Boas-vindas, código do convite recém-criado |
| `title` | 22 | 30 | 700 | Títulos de tela e de cartões (nome da agenda, título do evento) |
| `heading` | 18 | 26 | 700 | Títulos de seção, diálogos, estados vazios e de erro, período do calendário |
| `body` | 16 | 24 | normal | Texto padrão e campos de formulário |
| `label` | 14 | 20 | 600 | Rótulos de campos, datas nas listas |
| `small` | 14 | 20 | normal | Textos de apoio, dicas, horários nas listas |
| `caption` | 12 | 16 | normal | Etiquetas, cabeçalho dos dias da semana |

Outros tamanhos usados em componentes: texto dos botões 16 com peso 600; rótulos da barra de abas 12 com peso 600; títulos de seção (`SectionHeader`) 13 em maiúsculas com espaçamento entre letras de 0,6.

**Tamanho de fonte do celular:** todo texto passa por `AppText`, que respeita o tamanho escolhido nas configurações do Android. Alguns pontos limitam o aumento para não quebrar o layout: iniciais do avatar (até 1,2 vez), números e nomes dos dias na grade do mês (até 1,3 e 1,2 vez), o "+" de mais eventos no dia (sem aumento) e o seletor Mês/Semana/Dia/Lista (até 1,4 vez).

**Hierarquia para leitor de tela:** textos `display`, `title` e `heading`, e os títulos de seção, são anunciados como cabeçalho (`accessibilityRole="header"`).

## Espaçamento

Escala em `spacing` (valores em dp, a unidade de tela do Android):

| Token | Valor | Uso típico no código |
|---|---|---|
| `xxs` | 2 | Definido, ainda não usado |
| `xs` | 4 | Espaço entre ícone e texto em etiquetas, entre filtros |
| `sm` | 8 | Espaço entre botões e itens de lista, faixa sem internet |
| `md` | 12 | Espaço dentro de cartões, margem interna de campos e mensagens rápidas |
| `lg` | 16 | Margem lateral das telas e espaço entre blocos; margem interna de cartões |
| `xl` | 20 | Margem interna de diálogos, de Boas-vindas e do rodapé da apresentação |
| `xxl` | 24 | Margem interna dos estados vazio e de erro |
| `xxxl` | 32 | Definido, ainda não usado |
| `huge` | 40 | Espaço extra no fim das telas roláveis (somado à área segura de baixo) |

## Bordas, cantos e sombras

| Token | Valor | Onde |
|---|---|---|
| `radius.sm` | 8 | Itens do seletor Mês/Semana/Dia/Lista |
| `radius.md` | 12 | Botões, campos, linhas de evento, mensagens rápidas, caixa do código de convite |
| `radius.lg` | 16 | Cartões, diálogos, topo das listas de opções que sobem de baixo |
| `radius.pill` | 999 | Etiquetas, filtros, botões só com ícone, círculo do dia no mês |

Espessuras de borda: cartões e linhas de evento usam a linha mais fina possível (`hairlineWidth`); campos e botões, 1; campo em foco ou com erro, 2; cor escolhida no seletor de cores, 3.

**Sombra:** um único token, `shadow` (no Android, `elevation: 2`; em outras plataformas, sombra preta com 8% de opacidade, raio 8 e deslocamento vertical 2). Só o botão redondo "+" usa sombra; o resto da interface separa áreas com bordas.

## Tamanhos de toque

A constante `MIN_TOUCH` vale **48 dp**, o mínimo recomendado pelo Android.

| Componente | Área de toque |
|---|---|
| `Button`, `TextField`, `SelectField`, `DateTimeField`, `SwitchRow`, campo de busca das listas de opções, ação da mensagem rápida | Altura mínima 48 |
| `IconButton` (botões só com ícone, como buscar, filtros e setas) | 48 x 48, mais 4 de folga em volta |
| `ListItem` (linhas de menu, membros, avisos) | Altura mínima 56 |
| `EventRow` (linha de evento) | Altura mínima 64 |
| Opção de `OptionSheet` | Altura mínima 52 |
| Botão redondo "+" (`FAB`) | 60 x 60 |
| Barra de abas | Altura mínima 60 |
| `Chip` (filtros, dias da semana, lembretes) | Altura 40 mais 4 de folga em volta (48 na prática) |
| Dia da grade do mês | Altura mínima 52; largura de 1/7 da área útil |
| Bolinha de cor do `ColorPicker` | 48 x 48 |
| Item do `SegmentedControl` (Mês/Semana/Dia/Lista) | Altura mínima 48 |
| Pergunta da Ajuda | Altura mínima 48 |

## Estados de interação

| Estado | Como aparece |
|---|---|
| Pressionado | Botões ficam com 85% de opacidade; botões só com ícone, 60%; linhas de lista e de evento ganham fundo `surfaceAlt` |
| Desabilitado | Botões e campos de seleção com 55% de opacidade, botões só com ícone com 40%, linhas de lista com 50%, opções de lista com 45%; o leitor de tela anuncia "desativado" |
| Carregando | O botão troca o ícone por um indicador giratório e fica bloqueado; o leitor de tela anuncia "ocupado" |
| Foco (campo de texto) | Borda de 2 dp na cor `focus` |
| Erro (campo) | Borda de 2 dp em `danger` e a mensagem embaixo do campo, anunciada ao leitor de tela |
| Selecionado | Filtros: borda e texto em `primary`, fundo `primarySoft` e um ✓; cores: contorno `focus` e ✓; opções de lista: texto em negrito e ícone de ✓; seletor Mês/Semana: fundo `surface`, texto em `primary` e negrito; dia do mês: círculo preenchido em `primary` |
| Hoje | Anel de 2 dp na cor `today` em volta do número do dia; na semana, o título do dia ganha "· Hoje" em `primary` |

## Biblioteca de componentes

Todos em `app-mobile/src/components/`.

| Componente | Para que serve |
|---|---|
| `AppErrorBoundary` | Tela de erro inesperado, com "Tentar de novo" e sem detalhes técnicos; registra o erro no diagnóstico |
| `AppText` | Texto padrão com os estilos da tipografia e os tons (normal, secundário, destaque, perigo, sucesso, aviso, invertido) |
| `Avatar` | Círculo colorido com as iniciais do nome (o app não pede acesso a fotos) |
| `Badge` | Etiqueta em pílula com texto e ícone opcional, em 5 tons (neutro, destaque, perigo, sucesso, aviso) |
| `Button` | Botão com 4 variantes: principal, secundário, perigo e discreto (`ghost`); aceita ícone, carregando e desabilitado |
| `Card` | Caixa com fundo `surface`, borda fina e cantos de 16 |
| `Chip` | Opção marcável em pílula (filtros, dias da semana, lembretes), com ✓ quando marcada e bolinha de cor opcional |
| `ColorPicker` | Escolha de cor entre as 10 cores da paleta, com nome de cada cor para o leitor de tela e opção "nenhuma" |
| `DateTimeField` | Campo de data ou hora que abre o seletor nativo do Android |
| `EventRow` | Linha de evento: barra colorida, horário, título, agenda e local, e etiquetas de estado |
| `FAB` | Botão redondo flutuante "+" no canto inferior direito |
| `Feedback` | Fornece o diálogo de confirmação (`confirm`) e as mensagens rápidas (`toast`) para o app inteiro |
| `Icon` | Ícone da família Ionicons, escondido do leitor de tela (quem descreve a ação é o texto ao lado) |
| `IconButton` | Botão só com ícone, 48 x 48, com rótulo obrigatório para o leitor de tela |
| `ListItem` | Linha de lista tocável com ícone, título, subtítulo e seta |
| `MonthGrid` | Grade do mês com pontinhos de cor dos eventos; cada dia é lido por voz com a data e a quantidade de eventos |
| `OfflineBanner` | Faixa "Sem internet" no topo, com o número de alterações aguardando envio |
| `OptionSheet` | Lista de opções que sobe da parte de baixo, com busca opcional (usada nos fusos horários) |
| `Screen` | Estrutura padrão de tela: fundo, margens, rolagem, puxar para atualizar, rodapé fixo, faixa sem internet e ajuste ao teclado |
| `SectionHeader` | Título de seção em maiúsculas, em cor secundária |
| `SegmentedControl` | Seletor de opções lado a lado (Mês/Semana/Dia/Lista, Próximos/Passados) |
| `SelectField` | Campo que mostra o valor atual e abre um `OptionSheet` ao tocar |
| `StateViews` | Três estados prontos: `LoadingState` (carregando), `EmptyState` (vazio) e `ErrorState` (erro) |
| `SwitchRow` | Linha com texto, dica opcional e chave liga e desliga |
| `TextField` | Campo de texto com rótulo, dica, erro, borda de foco e botão de mostrar ou esconder senha |

Dois componentes vivem junto das telas porque só são usados ali: `screens/calendars/CalendarFormFields.tsx` (campos de agenda, usados em "Nova agenda" e "Configurações da agenda") e `screens/events/ReminderPicker.tsx` (lembretes, até 5, com valores prontos de 0, 5, 10, 15, 30, 60, 120 e 1.440 minutos, mais um campo personalizado).

### Linha de evento (`EventRow`) em detalhe

É o elemento mais repetido do app, por isso vale descrever:

- À esquerda, uma barra de 6 dp com a cor do evento (ou a da agenda). Evento cancelado: barra com 40% de opacidade e título riscado em cor secundária.
- Texto: horário (pequeno, secundário), título em negrito (até 2 linhas), agenda e local separados por "·".
- Etiquetas: "Cancelado" (perigo), "Repete" (ícone de repetição), "Ocupado" (olho cortado), "Privado" (cadeado), "Restrito" (pessoas), "Aguardando envio" (aviso, nuvem com seta) e "Conflito de horário" (aviso, triângulo).
- Para o leitor de tela, a linha inteira é lida como uma frase só, juntando título, horário, agenda, local e todas as etiquetas.

## Cores das agendas e dos avatares

As agendas e os eventos usam a paleta `CALENDAR_COLORS`. Cada cor tem um nome, que o leitor de tela fala no seletor e que aparece como "Personalizada" quando a cor não é da lista.

| Cor | Nome | Texto usado por cima | Contraste desse texto | Contraste com o fundo claro (`#FFFFFF`) | Contraste com o fundo escuro (`#1A1D24`) |
|---|---|---|---|---|---|
| `#3358D4` | Azul | branco | 6,02:1 | 6,02:1 | 2,80:1 |
| `#E5484D` | Vermelho | quase preto | 4,75:1 | 3,91:1 | 4,31:1 |
| `#30A46C` | Verde | quase preto | 5,89:1 | 3,16:1 | 5,34:1 |
| `#F76B15` | Laranja | quase preto | 6,25:1 | 2,97:1 | 5,68:1 |
| `#8E4EC6` | Roxo | branco | 5,18:1 | 5,18:1 | 3,26:1 |
| `#0090FF` | Azul-claro | quase preto | 5,69:1 | 3,26:1 | 5,17:1 |
| `#D6409F` | Rosa | quase preto | 4,51:1 | 4,12:1 | 4,09:1 |
| `#12A594` | Turquesa | quase preto | 6,05:1 | 3,07:1 | 5,49:1 |
| `#AD7F58` | Marrom | quase preto | 5,27:1 | 3,53:1 | 4,78:1 |
| `#5B5BD6` | Índigo | branco | 5,37:1 | 5,37:1 | 3,14:1 |

- **Seletor de cores (`ColorPicker`):** 10 bolinhas de 48 dp. A escolhida ganha contorno de 3 dp na cor `focus` e um ✓. No evento e nos filtros existe a opção "nenhuma" (ícone de proibido), que significa "Cor da agenda" ou "Qualquer cor".
- **Texto sobre cor:** a função `readableTextOn` calcula o contraste com branco e com quase preto (`#111318`) e escolhe o maior. Todas as 10 cores ficam com 4,5:1 ou mais.
- **Cores iniciais:** uma agenda nova começa em Verde (`#30A46C`). A agenda "Minha agenda", criada pelo banco no cadastro, começa em Azul (`#3358D4`).
- **Avatares:** usam as mesmas 10 bolinhas para a pessoa escolher a cor em Perfil > Editar perfil. A cor inicial é sorteada pelo servidor de forma estável a partir do id da pessoa, usando a mesma paleta.
- **Não depender só da cor:** o nome da agenda aparece em cada linha de evento e nos detalhes; os filtros de agenda mostram nome e bolinha de cor; o dia do mês diz por voz quantos eventos tem.

## Ícones

- **Biblioteca:** Ionicons, via `@expo/vector-icons`, sempre pelo componente `Icon`.
- **Acessibilidade:** `Icon` é escondido do leitor de tela. Quem descreve a ação é o texto ao lado ou o rótulo obrigatório do `IconButton`.
- **Estilo:** versões de contorno (`-outline`) na maior parte do app; versões preenchidas indicam algo ativo (funil preenchido quando há filtros, ✓ em círculo na opção escolhida e no convite aceito). A aba Agenda usa o ícone `calendar` preenchido, enquanto as outras abas usam contorno.
- **Tamanhos:** 14 nas etiquetas, 16 no ✓ dos filtros, 18 a 20 em setas, campos e botões, 22 por padrão, 24 nos botões só com ícone, 30 no botão "+", 32 no topo da tela Sincronização, 48 nos estados vazio e de erro, 56 na tela de erro inesperado e em "Servidor não configurado", 64 na apresentação e 72 em "Convite aceito".

Ícones com significado fixo:

| Ícone | Significado |
|---|---|
| `calendar`, `albums-outline`, `notifications-outline`, `person-circle-outline` | Abas Agenda, Agendas, Avisos e Perfil |
| `cloud-offline-outline`, `cloud-upload-outline`, `cloud-done-outline` | Sem internet, alterações pendentes, tudo sincronizado |
| `search`, `funnel` / `funnel-outline` | Buscar, filtros (preenchido quando há filtros ativos) |
| `repeat` | Evento que se repete |
| `lock-closed-outline`, `eye-off-outline`, `people-outline` | Privado, "Ocupado", restrito a participantes |
| `warning-outline` | Conflito de horário |
| `key-outline` | Código de convite, tornar proprietário |
| `trash-outline` | Excluir, lixeira |
| `alert-circle-outline` | Erro ou item não encontrado |

## Padrões de feedback

Tudo vem de `components/Feedback.tsx`, que fica na raiz do app e serve todas as telas.

### Mensagem rápida (`toast`)

- Aparece na parte de baixo, 80 dp acima da área segura (o suficiente para ficar acima da barra de abas), com cantos de 12 e margem de 16 nas laterais.
- Tons: **sucesso** (fundo `success`, é o padrão), **erro** (fundo `danger`) e **informação** (fundo `text`; existe, mas nenhuma tela usa ainda).
- Some sozinha em 3,5 segundos, ou em 7 segundos quando traz uma ação (por exemplo, **Desfazer** depois de excluir um evento).
- É anunciada ao leitor de tela no momento em que aparece.
- Exemplos reais: "Agenda criada!", "Evento atualizado.", "Copiado!", "Conflito resolvido.", "Esta ação precisa de internet. Conecte-se e tente de novo."

### Diálogo de confirmação (`confirm`)

- Janela no centro, sobre o véu `overlay`, com título, explicação e botões empilhados.
- Ação destrutiva: botão vermelho com o verbo da ação ("Remover da agenda", "Mover para a lixeira", "Sair mesmo assim") e "Cancelar" discreto embaixo.
- Confirmação forte: pode exigir digitar uma palavra; o botão só libera quando o texto é exatamente essa palavra. Usado para "Excluir definitivamente" uma agenda (palavra EXCLUIR). A exclusão de conta pede a mesma palavra, mas num campo da própria tela.
- Escolhas: em vez de confirmar e cancelar, pode oferecer várias opções. É assim que aparece "Somente esta ocorrência", "Esta e as próximas" e "Todas as ocorrências da série".
- O botão Voltar do Android fecha o diálogo como "Cancelar".
- Onde é usado: sair da conta, sair da agenda, mover para a lixeira, arquivar, excluir de vez, remover membro, transferir propriedade, cancelar convite, excluir evento, apagar comentário, descartar alteração pendente e desconectar outros aparelhos.

### Mensagens nos formulários

- Cada campo mostra seu erro logo abaixo, em vermelho, com borda vermelha; o leitor de tela anuncia a mensagem.
- Mensagens gerais (por exemplo, "E-mail ou senha incorretos.") aparecem em vermelho acima do botão.
- Avisos que não impedem salvar aparecem em `warning`, como "Atenção: este horário conflita com ...".

### Ações que dependem do servidor

`hooks/useAction.ts` padroniza: confere a internet antes ("Esta ação precisa de internet..."), mostra o carregando no botão, exibe a mensagem de sucesso e traduz qualquer erro do servidor para uma frase amigável (`utils/errors.ts`).

## Estados da interface

| Estado pedido | Como aparece | Texto real |
|---|---|---|
| Vazio | `EmptyState`: ícone de 48 em cor secundária, título, explicação e, às vezes, um botão | "Nenhuma agenda ainda" / "Crie uma agenda e convide quem você quiser." com o botão "Nova agenda"; "Sua agenda está vazia" / "Toque em "+" para criar o primeiro evento."; "Nenhum aviso por aqui."; "Nenhuma atividade registrada." |
| Carregando | `LoadingState`: indicador giratório grande em `primary` e texto; botões com indicador; puxar para atualizar | "Carregando..." |
| Erro | `ErrorState`: ícone de alerta em `danger`, título, explicação e "Tentar de novo"; `AppErrorBoundary` para falhas inesperadas | "Algo deu errado"; "Sem conexão com o servidor. Verifique sua internet e tente de novo." |
| Sucesso | Mensagem rápida verde; etiquetas em `success`; tela "Convite aceito" com ✓ grande | "Tudo certo!"; "Senha alterada."; "Aceito" |
| Desabilitado | Opacidade reduzida e estado anunciado (veja [Estados de interação](#estados-de-interação)) | "Sincronizar agora" sem internet; "Excluir minha conta para sempre" antes de digitar EXCLUIR |
| Offline | `OfflineBanner` em `warningSoft` com ícone de nuvem cortada; ícone de nuvem no topo da Agenda | "Sem internet. Você está vendo os dados guardados neste aparelho." |
| Sincronizando | Indicador de puxar para atualizar; status na tela Sincronização; etiquetas na fila | "Sincronizando..."; "Enviando"; "Aguardando envio"; "Tudo sincronizado" |
| Conflito | De horário: etiqueta e aviso no formulário. De edição: etiqueta na fila e tela de comparação | "Conflito de horário"; "Atenção: este horário conflita com {n} eventos."; "Conflito de edição"; "Sua versão" / "Versão atual (servidor)" |

## Textos e tom

Todos os textos ficam em `app-mobile/src/i18n/pt-BR.ts` e são lidos pela função `t()`, que troca `{nome}` pelo valor (exemplo: `t('sync.pending', { n: 3 })` vira "3 alteração(ões) aguardando envio").

Regras que os textos seguem:

1. **Falar com a pessoa, por "você", em frases curtas.** "Você pode apenas visualizar este evento."
2. **Botões com verbo que diz o que acontece.** "Criar agenda", "Gerar convite", "Aceitar e entrar", "Tentar de novo"; evitar "OK".
3. **Erro = o que aconteceu + como resolver.** "Este convite expirou. Peça um novo para quem convidou."
4. **Antes de destruir, dizer a consequência.** "Todos os membros perdem o acesso imediatamente. A agenda fica 30 dias na lixeira e pode ser restaurada por você."
5. **Não revelar informação sensível.** O login diz só "E-mail ou senha incorretos."; a notificação na tela bloqueada diz só "Você tem um compromisso" (a menos que a pessoa escolha mostrar detalhes).
6. **Linguagem neutra e inclusiva.** "Você foi convidado(a)", plurais como "alteração(ões)" e "evento(s)", exemplos que servem para qualquer grupo.
7. **Dar exemplos nos campos.** "Ex.: Casa, Viagem para a praia, Equipe"; "O código tem 12 letras ou números (ex.: AB12-CD34-EF56)."
8. **Datas no formato da pessoa.** Dia, mês e ano seguem a preferência (dd/MM/aaaa, aaaa-MM-dd ou MM/dd/aaaa; 24 ou 12 horas); dias e meses em português, com inicial maiúscula só no começo da frase.

Exemplos reais por situação:

| Situação | Texto |
|---|---|
| Boas-vindas | "Organize compromissos com quem importa: casal, família, amigos ou equipe." |
| Sem internet numa ação | "Esta ação precisa de internet. Conecte-se e tente de novo." |
| Salvo sem internet | "Salvo neste aparelho. Será enviado quando houver internet." |
| Senha fraca | "Senha fraca. Use pelo menos 8 caracteres, com letras e números." |
| Muitas tentativas | "Muitas tentativas. Aguarde {s} segundos e tente de novo." |
| Permissão negada | "Você não tem permissão para fazer isso." |
| Convite de outra pessoa | "Este convite foi enviado para outro e-mail." |
| Conflito de edição | "Outra pessoa alterou "{título}" enquanto você também alterava. Escolha o que manter." |
| Sair com alterações pendentes | "Há {n} alteração(ões) ainda não enviada(s). Se sair agora, elas serão perdidas. Conecte-se à internet para sincronizar antes." |
| Notificações bloqueadas | "As notificações estão bloqueadas para este app. Para receber lembretes, permita notificações nas configurações do Android." |
| Tipo de agenda | "O tipo é só uma etiqueta. Você pode usar a agenda como quiser." |
| Proprietário tentando sair | "Como proprietário, transfira a propriedade ou mova a agenda para a lixeira antes de sair." |

## Limitações

Itens da seção 24 que não foram feitos, ou foram feitos só em parte:

1. **Cores das agendas iguais nos dois temas:** algumas barras e pontinhos ficam pouco visíveis contra o fundo (Azul 2,80:1 no escuro; Laranja 2,97:1 e Turquesa 3,07:1 no claro; o ideal para elementos gráficos é 3:1). A informação também aparece em texto (nome da agenda).
2. **Movimento reduzido parcial:** diálogos e listas de opções respeitam a preferência; a transição entre telas segue o padrão do Android.
3. **Foco visível:** só os campos de texto mostram foco. Botões, filtros e linhas não têm indicador próprio para quem navega por teclado ou por acesso com interruptor.
4. **Áreas de toque:** em telas com menos de 368 dp de largura, os dias da grade do mês ficam com pouco menos de 48 dp de largura (a altura é 52).
5. **Calendário semanal e diário sem grade de horários:** as duas visões são listas por dia.
6. **Um idioma só:** a estrutura está pronta para outros idiomas, mas só existe português do Brasil; o seletor de idioma tem uma opção.
7. **Tela grande e paisagem:** o app é só em retrato e não tem layout próprio para tablets.
8. **Sem capturas ou protótipo visual:** este documento descreve o que está no código; o visual ainda não foi conferido num celular físico.
