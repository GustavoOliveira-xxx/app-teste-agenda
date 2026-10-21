# Solução de problemas

Organizado por onde o problema aparece. Procure pela mensagem exata (Ctrl+F) que o app ou o GitHub mostrou.

- [No app (celular)](#no-app-celular)
- [Instalação do APK](#instalação-do-apk)
- [Versão web (iPhone, iPad e computador)](#versão-web-iphone-ipad-e-computador)
- [Servidor (Supabase)](#servidor-supabase)
- [GitHub Actions](#github-actions)
- [Desenvolvimento (computador)](#desenvolvimento-computador)
- [Como coletar informações para pedir ajuda](#como-coletar-informações-para-pedir-ajuda)

## No app (celular)

### "Servidor não configurado"

**Causa:** o APK foi gerado sem as Variables `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
**Solução:** cadastre as duas no GitHub ([GUIA_DE_DEPLOY.md, parte 2](GUIA_DE_DEPLOY.md#parte-2-ligar-o-github-ao-servidor)), gere um APK novo e instale por cima.

### "Sem conexão com o servidor" ou "O servidor demorou para responder"

1. Confira a internet do celular (abra um site qualquer).
2. Se a internet está boa e o erro continua para todos: o servidor pode estar pausado (veja abaixo).
3. Se só acontece com você: feche e abra o app; em **Perfil > Sincronização**, toque em **Sincronizar agora**.

### Servidor pausado ou fora do ar

O plano gratuito do Supabase pausa projetos após cerca de 7 dias sem uso. A pessoa responsável deve entrar em <https://supabase.com/dashboard>, abrir o projeto e clicar em **Restore project**. Os dados são mantidos. Se o painel disser que o limite de projetos ativos foi atingido, siga o [GUIA_DE_DEPLOY.md, passo 1.1](GUIA_DE_DEPLOY.md#11-liberar-uma-vaga-de-projeto-situação-atual-da-sua-conta).

### Problemas de conta

| Mensagem | O que fazer |
|---|---|
| "E-mail ou senha incorretos." | Confira maiúsculas e minúsculas. Use **Esqueci minha senha**. |
| "Muitas tentativas. Aguarde ... segundos" | Proteção contra adivinhação de senha. Espere o tempo indicado. |
| "Muitas tentativas em pouco tempo" / "Limite de envio de e-mails atingido" | Limite do servidor. Aguarde alguns minutos. |
| "Confirme seu e-mail antes de entrar" | Digite o código de 6 dígitos que chegou por e-mail (veja também o spam). Se não chega, veja [e-mails não chegam](#e-mails-de-confirmação-ou-de-recuperação-não-chegam). |
| "Já existe uma conta com este e-mail" | Toque em **Já tenho conta** ou recupere a senha. |
| "Código inválido ou expirado" | Peça um código novo; use sempre o último e-mail recebido. |
| "Novos cadastros estão desativados no servidor" | A pessoa responsável desligou "Allow new users to sign up" no Supabase. Peça para ligar. |
| "Sua sessão expirou. Entre de novo." | Entre de novo. As alterações feitas offline continuam na fila e são enviadas depois do login, se for a mesma conta. |

### Problemas com convites

| Mensagem | O que fazer |
|---|---|
| "Código de convite não encontrado" | Confira o código (12 caracteres; o app ignora espaços, traços e maiúsculas). |
| "Este convite expirou" / "foi cancelado" / "já foi usado" / "atingiu o limite de pessoas" | Peça um convite novo para quem convidou. |
| "Essa pessoa já participa da agenda" | Nada a fazer: ela já tem acesso. |
| "Muitas tentativas em pouco tempo" ao digitar códigos | Após 10 códigos errados em 15 minutos, o servidor bloqueia por um tempo. Aguarde. |
| Convite por e-mail não chegou por e-mail | Esta versão **não envia e-mail** de convite: a pessoa vê o convite em **Agendas > Convites recebidos** ao entrar com aquele e-mail. Prefira o código. |

### Problemas com eventos e permissões

| Mensagem | Causa e solução |
|---|---|
| "Você não tem permissão para fazer isso." | Seu papel nesta agenda não permite a ação (por exemplo, visualizador não cria eventos). Peça a um administrador para mudar seu papel. Tabela de papéis em [REGRAS_DE_NEGOCIO.md](REGRAS_DE_NEGOCIO.md). |
| "Esta agenda não permite dois eventos no mesmo horário." | A agenda está configurada para bloquear conflitos de horário. Escolha outro horário ou peça para mudar a configuração da agenda. |
| "Esta agenda não permite eventos privados." | Configuração da agenda. Use outra privacidade. |
| "A agenda está arquivada ou na lixeira e não aceita alterações." | Restaure ou desarquive a agenda nas configurações dela. |
| "O proprietário precisa transferir a propriedade antes de sair." | Em **Membros**, transfira a propriedade para outra pessoa e depois saia. |
| "Não encontrado. Talvez tenha sido excluído ou você não tenha mais acesso." | O item foi excluído ou você foi removido da agenda. Puxe a tela para baixo para atualizar. |
| Um evento aparece só como "Ocupado" | O evento tem privacidade "ocupado": você vê o horário, mas não os detalhes. É intencional. |
| Evento no horário errado | Confira o fuso em **Perfil > Preferências** e o fuso do evento. Eventos guardam o fuso em que foram criados e são mostrados no fuso escolhido nas preferências. |

### Alterações não sincronizam

Abra **Perfil > Sincronização**:

- **"Aguardando" / "Enviando":** normal; serão enviadas quando houver internet. As tentativas automáticas esperam cada vez mais (de 5 segundos até 15 minutos) e param depois de 8 falhas.
- **"Falhou":** toque na alteração para ver o motivo. Use **Tentar de novo** ou **Descartar** (o evento volta a ficar como está no servidor).
- **"Conflito":** outra pessoa alterou o mesmo evento ao mesmo tempo. Toque em **Resolver** e escolha **Manter a minha versão** ou **Manter a versão atual**. Se a outra pessoa excluiu o evento, escolha **Recriar o evento com as minhas alterações** ou **Aceitar a exclusão**.
- **"Sua sessão expirou. Entre de novo para enviar as alterações."**: entre de novo com a mesma conta.

**Atenção:** sair da conta ou desinstalar o app apaga as alterações que ainda não foram enviadas.

### Notificações (lembretes) não aparecem

1. Android: **Configurações > Apps > Agenda Compartilhada > Notificações**: ativadas.
2. No app: **Perfil > Notificações**: lembretes ligados; confira o horário de silêncio.
3. O evento tem lembrete? Lembretes são **pessoais**: cada pessoa define os seus no evento.
4. Bateria: desative a otimização de bateria para o app (Configurações > Bateria > Uso de bateria por app > Sem restrições). Em Xiaomi, Samsung e Motorola, procure também "Início automático" ou "Apps em suspensão".
5. Depois de reiniciar o celular, abra o app uma vez para reagendar os lembretes.
6. O celular agenda os lembretes dos **próximos 30 dias**, a partir do que já sincronizou. Abrir o app de vez em quando mantém tudo em dia.

### O app fechou ou mostrou "Algo deu errado"

Toque em **Tentar de novo**. Se repetir, abra **Perfil > Diagnóstico (desenvolvimento)**, toque em **Copiar** e envie o texto para quem cuida do app (não contém senhas nem tokens).

## Instalação do APK

Veja a tabela de [problemas comuns do COMO_INSTALAR.md](COMO_INSTALAR.md#problemas-comuns) (APK incompatível, espaço, instalação bloqueada, versão antiga, conflito de assinatura).

## Versão web (iPhone, iPad e computador)

| Problema | O que fazer |
|---|---|
| **Página não encontrada (404)** no endereço do site | O site ainda não foi publicado: ligue o GitHub Pages e rode o workflow **Publicar versão web** ([GUIA_DE_DEPLOY.md, parte 6](GUIA_DE_DEPLOY.md#parte-6-versão-web-iphone-ipad-computador-e-qualquer-sistema)). |
| **"Servidor não configurado"** no site | Faltam as Variables do Supabase (parte 2.1 do guia). Cadastre e rode o workflow de novo. |
| **iPhone: não aparece "Adicionar à Tela de Início"** | Abra o link no Safari (links abertos dentro do WhatsApp ou do Instagram usam um navegador interno: toque em "Abrir no Safari"). A opção fica no botão **Compartilhar**, rolando a lista. |
| **Computador: não aparece a opção de instalar** | Use Chrome ou Edge. O Firefox de computador não instala sites como app (use pelos favoritos). O Safari do Mac usa **Arquivo > Adicionar ao Dock**. |
| **Lembrete não tocou** | Esperado nesta versão: no navegador os lembretes ficam salvos, mas não tocam (só no app Android). Veja o [ROADMAP.md](ROADMAP.md). |
| **Uma novidade não apareceu depois de publicada** | O app atualiza ao abrir. Feche completamente (no iPhone, deslize o app para cima na troca de apps) e abra de novo; se preciso, repita uma vez. |
| **Saí do app e meus dados sumiram / pede login de novo** | A versão web guarda a sessão no navegador. Limpar os dados do navegador, usar janela anônima ou o iPhone apagar dados de sites pouco usados faz sair da conta. Os dados continuam no servidor: entre de novo. Use o ícone instalado na tela de início para evitar isso. |
| **Abri um link e não aparece "voltar"** | Toque no ícone de **casa** no canto de cima para ir ao início. |
| **Usei um domínio próprio e o site ficou em branco** | Rode o workflow **Publicar versão web** de novo depois de configurar o domínio: ele passa a gerar o site na raiz. |

## Servidor (Supabase)

### Erro ao aplicar as migrations

| Mensagem | Causa e solução |
|---|---|
| `relation "..." already exists` ou `type "..." already exists` | O banco não estava limpo (tabelas de um teste antigo) ou o arquivo foi rodado duas vezes. Use um projeto novo, ou apague as tabelas antigas se tiver certeza de que não servem. |
| `function ... does not exist` ou `relation ... does not exist` | Arquivos fora de ordem ou algum foi pulado. Aplique na ordem 0100, 0200, ..., 0600. |
| `syntax error at or near ...` logo no começo | O texto foi colado incompleto. Use o botão **Copy raw file** do GitHub e cole de novo. |
| `permission denied` | Rode pelo **SQL Editor** do painel (que usa o usuário administrador), não por outro cliente com usuário limitado. |

### E-mails de confirmação ou de recuperação não chegam

- Sem SMTP próprio, o Supabase só envia para e-mails da equipe do projeto e com limite baixo por hora. Configure um SMTP ([GUIA_DE_DEPLOY.md, passo 1.4](GUIA_DE_DEPLOY.md#14-e-mails-códigos-de-confirmação-e-de-recuperação-de-senha)) ou desligue **Confirm email**.
- O e-mail chega com link em vez de código: o modelo não foi trocado. Cole os modelos de `supabase/templates/`, que usam `{{ .Token }}`.
- Veja o motivo em **Logs > Auth** no painel.

### Mudanças de outras pessoas não aparecem sozinhas

O tempo real depende da publicação `supabase_realtime`. Em **Database > Publications**, confira se `supabase_realtime` inclui `activity_logs`, `notifications` e `calendar_members` (a migration 0600 faz isso). Enquanto isso, puxar a tela para baixo atualiza.

### Alertas no Security Advisor

- "RLS disabled" em alguma tabela: a migration 0600 não foi aplicada por inteiro. Rode de novo.
- Avisos de configuração do Auth (proteção contra senhas vazadas, MFA): recomendações de configuração do painel, não do código. Leia e decida.

### Ver os registros do servidor

**Logs** (menu da esquerda) > **API** (requisições do app), **Auth** (logins e e-mails) ou **Postgres** (erros do banco).

## GitHub Actions

### Como identificar uma build aprovada

Aba **Actions**: **✓ verde** = aprovada; **X vermelho** = falhou; **círculo amarelo** = rodando; **cinza** = cancelada (normal quando um envio mais novo substitui o anterior).

### "Qualidade" falhou

Clique na execução e veja qual job ficou vermelho:

| Job | Significa | Como corrigir |
|---|---|---|
| Verificar segredos | Um arquivo proibido ou algo parecido com uma senha ou chave foi enviado | Veja a linha apontada. Se era um segredo de verdade, **considere-o vazado** e siga [SEGURANCA.md](SEGURANCA.md#procedimento-para-revogar-credenciais-expostas). Remover o arquivo não basta. |
| Banco de dados | Um teste de permissão ou regra falhou | Rode `npm test` na pasta `supabase` e leia o teste que falhou |
| App | Tipos, lint, formatação, testes ou empacotamento falharam | Rode `npm run check` na pasta `app-mobile`. Formatação: `npm run format` corrige sozinho |
| Telas (versão web) | Uma tela não mostrou o que devia, deu erro de JavaScript ou o servidor de testes recusou uma chamada | Baixe **Artifacts > capturas-das-telas** da execução para ver a tela no momento da falha. Rode localmente em `e2e` (`npm run preparar` e `npm test`) |

### "Gerar APK Android" falhou

| Passo com X | Causa provável | Solução |
|---|---|---|
| Instalar dependências | `package-lock.json` desatualizado | Na pasta `app-mobile`, rode `npm install` e envie o `package-lock.json` atualizado |
| Gerar o projeto Android nativo | Erro em `app.json` ou em um plugin | Leia a mensagem; valide o JSON (vírgulas, aspas) |
| Compilar (Gradle) | Falha de rede ao baixar dependências, ou incompatibilidade de biblioteca | Rode de novo **uma vez** (botão **Re-run jobs**). Se falhar de novo, é real: leia as linhas com `FAILURE` e `What went wrong` |
| Assinar com a chave própria | Secrets errados | "Keystore was tampered with, or password was incorrect": senha errada. "alias ... does not exist": confira `ANDROID_KEY_ALIAS`. Base64 inválido: gere o `.b64` de novo (uma linha só) |
| Conferir permissões | Uma biblioteca nova trouxe uma permissão fora da lista aprovada | Bloqueie em `app-mobile/app.json` (`blockedPermissions`) ou, se for necessária, registre o motivo em [DECISOES.md](DECISOES.md) e libere no workflow |
| Publicar na página Releases | Já existe uma release com essa tag (acontece ao usar **Re-run** numa execução que já publicou) | Em vez de **Re-run**, use **Run workflow** de novo (gera um número novo) ou apague a release antiga |

### "Publicar versão web" falhou

| Passo com X | Causa provável | Solução |
|---|---|---|
| Gerar o site | Erro de código ou de configuração do app | O mesmo erro aparece no job "App" do workflow Qualidade; corrija lá |
| Testar a versão instalável | O site gerado não abre, não pode ser instalado ou não funciona sem internet | Rode localmente na pasta `e2e`: `npm run preparar:site` e `npm run test:site`. A versão antiga do site continua no ar |
| Publicar no GitHub Pages | Pages não ligado com a fonte "GitHub Actions", ou a branch não é a principal | Settings > Pages > Source: GitHub Actions. Em Settings > Environments > github-pages, confira se a branch principal é permitida |

### Aviso "Servidor não configurado" ou "Chave de testes"

São avisos, não erros: veja [GUIA_DE_DEPLOY.md, parte 2.2](GUIA_DE_DEPLOY.md#22-gerar-e-publicar-o-apk).

## Desenvolvimento (computador)

| Problema | Solução |
|---|---|
| `npx expo install` falha por rede ("fetch failed" em api.expo.dev) | Rode com `EXPO_OFFLINE=1 npx expo install pacote` (usa a tabela de versões local do SDK) |
| Metro mostra código antigo ou erro estranho de cache | `npx expo start -c` (limpa o cache) |
| "Port 8081 is already in use" | Feche outro Metro aberto ou aceite usar outra porta |
| Expo Go diz que o projeto usa um SDK incompatível | O Expo Go da loja só roda a versão mais recente do SDK. Use um build de desenvolvimento: `npx expo run:android` (precisa do Android Studio) |
| Emulador ou celular não aparece | `adb devices` deve listar o aparelho. No celular: depuração USB ligada e autorizar o computador. No emulador: abra pelo Android Studio > Device Manager |
| `SDK location not found` ao compilar | Crie a variável de ambiente `ANDROID_HOME` apontando para o Android SDK (veja [GUIA_DE_DESENVOLVIMENTO.md](GUIA_DE_DESENVOLVIMENTO.md)) |
| Erros de tipo após atualizar bibliotecas | `npm run typecheck` mostra a linha; confira o changelog da biblioteca |
| `expo prebuild` alterou o `package.json` | O comando troca os scripts `android`/`ios`. Desfaça com `git checkout app-mobile/package.json` e apague a pasta `app-mobile/android` (ela é gerada e está no `.gitignore`) |
| O app abre "Servidor não configurado" no desenvolvimento | Falta o arquivo `app-mobile/.env` (copie de `.env.example`) e reinicie o Metro com `-c` |

## Como coletar informações para pedir ajuda

1. No app: **Perfil > Diagnóstico (desenvolvimento)** > **Copiar**. Traz versão, build, aparelho, fuso, estado da sincronização e os últimos erros (sem senhas, tokens ou conteúdo de eventos).
2. No GitHub: o link da execução que falhou (aba Actions).
3. No Supabase: o trecho do **Logs** do horário do problema.
4. O que você fez, o que esperava e o que aconteceu.

**Nunca** envie senhas, a chave `secret`/`service_role`, a senha do banco ou o arquivo `.jks` para pedir ajuda.
