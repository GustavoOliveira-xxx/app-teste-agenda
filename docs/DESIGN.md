# Design e identidade visual

O visual do app foi deixado neutro de propósito (tons de cinza, cantos discretos, fonte do sistema), para receber uma identidade própria sem precisar mexer nas telas.

## Onde fica cada coisa

| O quê | Arquivo |
|---|---|
| Cores, fonte, cantos, sombra e detalhes de estilo | `app-mobile/src/theme/marca.ts` |
| Ícone do app, ícone do Android, splash, ícone de notificação, favicon | `app-mobile/assets/` |
| Ícones do site (iPhone e computador) | `app-mobile/public/icons/` |
| Cores da splash, do ícone do Android e da barra do navegador | `app-mobile/app.json`, `app-mobile/public/manifest.webmanifest` e `app-mobile/public/index.html` |
| Nome do app | `name` em `app-mobile/app.json` e em `app-mobile/public/manifest.webmanifest` |

As telas nunca usam cores ou fontes soltas: tudo passa por `marca.ts` (via `src/theme/tokens.ts`). Trocando a marca, o app inteiro muda junto, nos temas claro e escuro.

## Como aplicar uma identidade nova

### 1. Cores

Em `marca.ts`, ajuste `cores.claro` e `cores.escuro`. Os nomes mais importantes:

- `primary`: cor da marca (botão principal, aba ativa, item escolhido, dia selecionado, links).
- `primaryText`: texto em cima da cor da marca.
- `primarySoft`: versão bem clara (ou bem escura, no tema escuro) da cor da marca, usada no fundo de itens selecionados.
- `background`, `surface`, `surfaceAlt`, `border`: fundos e linhas.
- `text`, `textMuted`: texto principal e secundário.

Depois de trocar, rode `npm test` dentro de `app-mobile`. O teste `src/theme/__tests__/marca.test.ts` confere se os textos continuam legíveis (contraste mínimo de 4,5:1, e 3:1 para a borda dos campos). Se algum falhar, ele diz qual par de cores ficou fraco.

As 10 cores que a pessoa escolhe para cada agenda ficam em `CALENDAR_COLORS`, em `src/theme/tokens.ts`. Elas são dados das agendas, não da marca, então só mude se quiser outra paleta de escolha.

### 2. Fonte

1. Coloque os arquivos `.ttf` ou `.otf` em `app-mobile/assets/fonts/`.
2. Em `marca.ts`, preencha `fonte.arquivos` (um nome para cada arquivo) e `fonte.familias` (qual nome usar em cada peso: `regular`, `medio`, `semi`, `negrito`). Há um exemplo comentado no próprio arquivo.
3. O app carrega a fonte antes de sair da splash. Pesos sem arquivo usam o `regular`.

Com `familias` vazio (`null`), o app usa a fonte do sistema: Roboto no Android, San Francisco no iPhone e a fonte padrão do navegador no computador.

### 3. Formas e detalhes

Também em `marca.ts`:

- `cantos`: arredondamento em pixels (`pequeno` para etiquetas, `medio` para botões e campos, `grande` para cartões e janelas). Use 0 para cantos retos.
- `sombra`: liga uma sombra leve em cartões e no botão "+".
- `iconesNosBotoes`: mostra ícones dentro dos botões com texto.
- `titulosDeSecaoEmMaiusculas`: deixa os títulos de seção em letras maiúsculas.

### 4. Imagens

Troque os arquivos mantendo nome e tamanho:

| Arquivo | Tamanho | Observação |
|---|---|---|
| `assets/icon.png` | 1024 x 1024 | Ícone principal (iPhone e lojas). Sem transparência. |
| `assets/android-icon-foreground.png` | 1024 x 1024 | Desenho do ícone do Android, com fundo transparente. Deixe o desenho dentro do círculo central (cerca de 66% da imagem), porque cada celular recorta de um jeito. |
| `assets/android-icon-background.png` | 1024 x 1024 | Fundo do ícone do Android. |
| `assets/android-icon-monochrome.png` | 1024 x 1024 | Versão de uma cor só, usada nos ícones temáticos do Android 13+. |
| `assets/splash-icon.png` | 512 x 512 | Imagem da tela de abertura. |
| `assets/notification-icon.png` | 96 x 96 | Silhueta branca com fundo transparente (o Android pinta com a cor de `app.json`). |
| `assets/favicon.png` | 48 x 48 | Ícone da aba do navegador. |
| `public/icons/icon-192.png` e `icon-512.png` | 192 e 512 | Ícone do site instalado. |
| `public/icons/icon-maskable-512.png` | 512 x 512 | Igual ao anterior, com o desenho dentro de 80% central e fundo preenchido. |
| `public/icons/apple-touch-icon.png` | 180 x 180 | Ícone na tela de início do iPhone. Sem transparência. |

Os ícones atuais são provisórios: um calendário simples em branco sobre cinza escuro.

### 5. Cores fora do código

Atualize para combinar com a marca:

- `app-mobile/app.json`: `android.adaptiveIcon.backgroundColor`, `web.themeColor` e `web.backgroundColor`, o `backgroundColor` da splash (claro e `dark`) e a `color` do ícone de notificação.
- `app-mobile/public/manifest.webmanifest`: `theme_color` e `background_color`.
- `app-mobile/public/index.html`: a cor de fundo enquanto o site carrega (claro e escuro).

### 6. Ver o resultado

- No computador: `cd app-mobile && npx expo start --web`.
- No celular: gere um APK novo (veja [GUIA_DE_DEPLOY.md](../GUIA_DE_DEPLOY.md)). O site para iPhone se atualiza sozinho a cada envio para o GitHub.

## Temas claro, escuro e automático

A pessoa escolhe em Perfil > Preferências > Tema (Automático, Claro ou Escuro). A escolha fica salva na conta e vale em qualquer aparelho. Antes do login, o app segue o tema do aparelho. Se o aparelho pede menos animações, diálogos e listas de opções abrem sem animação.

## Tamanhos de tela

As faixas ficam em `src/utils/layout.ts` (hook `useLayout()`):

| Largura | Navegação | Conteúdo |
|---|---|---|
| Menos de 768 (celular) | Abas embaixo | Uma coluna (centralizada em até 720 a partir de 600) |
| 768 a 1023 (tablet) | Menu lateral | Coluna centralizada de até 720 |
| 1024 ou mais (computador) | Menu lateral | No calendário, mês à esquerda e eventos do dia à direita |

Diálogos e listas de opções viram um cartão centralizado (até 520) a partir de 600 de largura.

## Acessibilidade

- Área de toque mínima de 48 (`MIN_TOUCH` em `tokens.ts`) em botões, campos e opções.
- Botões só com ícone sempre têm rótulo para leitor de tela.
- Nenhuma informação depende só de cor: etiquetas com texto, ✓ no item escolhido e nome em cada cor de agenda.
- O texto acompanha o tamanho de fonte escolhido no aparelho.

Detalhes em [ACESSIBILIDADE.md](ACESSIBILIDADE.md).

## Componentes

Ficam em `app-mobile/src/components/` e são usados por todas as telas. Os principais: `Button` (principal, secundário, perigo e discreto), `TextField`, `SelectField`, `DateTimeField`, `Card`, `Chip`, `Badge`, `ListItem`, `EventRow`, `MonthGrid`, `SegmentedControl`, `SectionHeader`, `FAB` (botão "+"), `Feedback` (mensagens rápidas e confirmações) e `Screen` (estrutura de cada tela). Ícones vêm da família Ionicons, pelo componente `Icon`.

Para a lista de telas, veja [TELAS.md](TELAS.md).
