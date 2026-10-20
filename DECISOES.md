# Registro de decisões

Cada decisão segue o formato: **contexto**, **opções**, **decisão**, **motivo** e **consequências**. Quando uma decisão mudar, ela não é apagada: uma nova entrada é criada dizendo qual substitui.

Índice:
- [D01 Stack mobile](#d01-stack-mobile)
- [D02 Backend](#d02-backend)
- [D03 TypeScript](#d03-typescript)
- [D04 Navegação com Expo Router](#d04-navegação-com-expo-router)
- [D05 Onde ficam as permissões](#d05-onde-ficam-as-permissões)
- [D06 Datas e fusos horários](#d06-datas-e-fusos-horários)
- [D07 Recorrência](#d07-recorrência)
- [D08 Offline, fila e conflitos](#d08-offline-fila-e-conflitos)
- [D09 Lembretes e notificações](#d09-lembretes-e-notificações)
- [D10 Convites](#d10-convites)
- [D11 Privacidade de eventos](#d11-privacidade-de-eventos)
- [D12 Exclusão lógica e lixeira](#d12-exclusão-lógica-e-lixeira)
- [D13 Armazenamento seguro da sessão](#d13-armazenamento-seguro-da-sessão)
- [D14 Geração do APK](#d14-geração-do-apk)
- [D15 Estado global](#d15-estado-global)
- [D16 Tabelas do prompt que foram adaptadas](#d16-tabelas-do-prompt-que-foram-adaptadas)
- [D17 E-mail e confirmação de conta](#d17-e-mail-e-confirmação-de-conta)
- [D18 Autoria, licença e repositório](#d18-autoria-licença-e-repositório)
- [D19 Agenda pessoal criada no cadastro](#d19-agenda-pessoal-criada-no-cadastro)
- [D20 Testes do banco com PGlite](#d20-testes-do-banco-com-pglite)

---

## D01 Stack mobile

**Contexto.** O proprietário conhece HTML, CSS, JavaScript e MySQL. Prioridade Android, iOS depois.

**Opções avaliadas.**

| Critério | React Native + Expo | Flutter | PWA (site instalável) |
|---|---|---|---|
| Linguagem | JavaScript/TypeScript (já conhecida) | Dart (nova) | JavaScript |
| Curva de aprendizado | Baixa para quem sabe JS | Média/alta | Baixa |
| Recursos nativos (notificações, armazenamento seguro) | Completos via módulos Expo | Completos | Limitados |
| Notificações | Locais e push | Locais e push | Push na web é limitado e inconsistente no Android, ausente em muitos cenários |
| Funcionamento offline | Completo | Completo | Possível com Service Worker, mas mais frágil |
| Instalação no celular | APK ou Play Store | APK ou Play Store | "Adicionar à tela inicial", sem loja |
| Geração de APK | Grátis (Gradle no GitHub Actions) ou EAS | Grátis (Gradle) | Não se aplica |
| Expo Application Services (EAS) | Opcional (build na nuvem, atualizações) | Não se aplica | Não se aplica |
| Dependência de serviços externos | Nenhuma obrigatória | Nenhuma | Nenhuma |
| Limitações da abordagem gerenciada | Pastas nativas são geradas (`prebuild`); código nativo próprio exige "development build" | Não se aplica | Não se aplica |
| Migrar para nativo depois | Possível (`expo prebuild` gera projeto Android/iOS editável) | Não se aplica | Reescrita |
| Comunidade e documentação | Muito grandes | Grandes | Grandes |
| Aparência de aplicativo | Nativa | Nativa | Próxima, mas é um site |

**Decisão.** React Native com Expo (SDK 58).

**Motivo.** Melhor equilíbrio entre o que você já sabe (JavaScript), recursos nativos completos, geração gratuita de APK e caminho aberto para iOS. Flutter exigiria aprender Dart. A PWA não oferece notificações confiáveis no Android nem armazenamento seguro de credenciais.

**Consequências.** As pastas `android/` e `ios/` não ficam no repositório: são geradas a partir de `app.json` (Continuous Native Generation). Bibliotecas com código nativo exigem novo build do APK (não funcionam no aplicativo Expo Go sem isso).

## D02 Backend

**Contexto.** Precisa de autenticação, banco relacional, regras de autorização, tempo real e custo zero no início, mantido por um iniciante.

**Opções avaliadas.**

| Critério | Supabase | Firebase | API própria (Node + MySQL) |
|---|---|---|---|
| Autenticação | Pronta (e-mail/senha, OTP, Google, Apple) | Pronta | Fazer do zero (hash, tokens, renovação, recuperação) |
| Banco | PostgreSQL (SQL, relacional) | Firestore (NoSQL, documentos) | MySQL |
| Regras de autorização | Row Level Security em SQL, no banco | Security Rules (linguagem própria) | Middlewares escritos à mão |
| Notificações | Não envia push (integra com Expo/FCM) | FCM integrado | Integrar FCM |
| Arquivos | Storage com regras | Storage com regras | Integrar S3 ou similar |
| Tempo real | Realtime (respeita RLS) | Nativo | Fazer com WebSocket |
| Custo inicial | Plano gratuito | Plano gratuito | Hospedagem (geralmente paga após período grátis) |
| Limites do gratuito | 2 projetos ativos, pausa após 7 dias sem uso, banco pequeno | Cotas de leitura/escrita | Depende da hospedagem |
| Facilidade para iniciante | Alta (painel web, SQL familiar) | Média (modelo NoSQL) | Baixa (muita coisa para manter) |
| Migração futura | Fácil: é Postgres padrão, `pg_dump` | Difícil (formato próprio) | Não se aplica |

**Custos qualitativos da API própria:** precisaria de hospedagem do servidor Node, banco MySQL gerenciado, serviço de e-mail, serviço de push e monitoramento. Credenciais: senha do banco, segredo de assinatura de tokens, chave do serviço de e-mail, chave do FCM. Backup por `mysqldump` agendado; deploy por Docker ou plataforma (Render, Railway, Fly); rollback por versão anterior da imagem; monitoramento por Sentry ou similar. É bem mais trabalho para manter sozinho.

**Decisão.** Supabase.

**Motivo.** Entrega autenticação segura, banco SQL e regras de acesso no próprio banco, sem servidor para manter. O SQL do Postgres é muito parecido com o MySQL.

**Como evitar dependência excessiva.**
1. Todo o banco é SQL padrão versionado em `supabase/migrations/`.
2. As regras de negócio críticas ficam em funções SQL (`public.accept_invitation`, `public.apply_event_op`, etc.), que poderiam ser chamadas por uma API própria no futuro.
3. O app só fala com o backend por `app-mobile/src/services/`. Trocar de backend significa reescrever essa pasta.
4. O que é específico do Supabase (`auth.uid()`, `auth.users`, publicação `supabase_realtime`) está isolado e documentado em [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md).

## D03 TypeScript

**Decisão.** Usar TypeScript no app e JavaScript simples (módulos `.mjs`) nos testes do banco.

**Motivo.** TypeScript é JavaScript com "etiquetas" de tipo. Exemplo: se uma função espera uma data e você passa um número, o editor sublinha em vermelho antes de rodar. Isso evita uma categoria inteira de erros, o que importa muito em datas, permissões e sincronização.

## D04 Navegação com Expo Router

**Decisão.** Expo Router (padrão atual do Expo). As rotas ficam em `src/app/` e são finas: cada arquivo só aponta para a tela real em `src/screens/`.

**Motivo.** Funciona como páginas de um site (cada arquivo é um endereço), o que é intuitivo para quem vem de HTML. Separar rota e tela mantém a estrutura pedida no prompt (`screens/`, `navigation/`).

## D05 Onde ficam as permissões

**Decisão.** Toda autorização é verificada **no banco**, com Row Level Security (RLS) e funções `SECURITY DEFINER` que conferem o papel de quem chama. O app também esconde botões que a pessoa não pode usar, mas isso é só conforto visual.

**Motivo.** Regras 8, 9 e 13 do prompt: o backend precisa recusar alterações não autorizadas mesmo que o cliente seja modificado.

**Consequências.** Inserir membros diretamente na tabela é proibido; só funções como `accept_invitation` conseguem. Isso também impede adicionar alguém "em silêncio" (regra 8 dos convites).

## D06 Datas e fusos horários

**Decisão.**
- Eventos com horário: início e fim guardados como `timestamptz` (instante absoluto, em UTC) **mais** o fuso IANA do evento (ex.: `America/Sao_Paulo`).
- Eventos de dia inteiro: guardados como datas locais (`start_date`, `end_date`, tipo `date`, sem fuso). Os campos `starts_at`/`ends_at` também são preenchidos, apenas para buscas por período.
- O aparelho converte para o fuso de exibição escolhido pela pessoa (padrão: fuso do aparelho).

**Motivo.** Um instante em UTC nunca é ambíguo. O fuso do evento permite recalcular repetições corretamente no horário de verão. Datas sem horário guardadas como data local evitam o clássico "aniversário aparece no dia anterior".

**Consequências.** Viajar não muda eventos com horário (eles aparecem na hora local do destino); eventos de dia inteiro continuam no mesmo dia em qualquer fuso. Detalhes e exemplos em [ARQUITETURA.md](ARQUITETURA.md#datas-e-fusos-horários).

## D07 Recorrência

**Decisão.** Guardar a **regra** (`recurrence_rule`, no padrão RRULE da RFC 5545, subconjunto suportado) no evento e as **exceções** (`recurrence_exceptions`, chaveadas pela data local da ocorrência). Ocorrências são **virtuais**: calculadas no aparelho só dentro da janela que está na tela.

**Opções.** (a) gerar todas as ocorrências no banco; (b) regra + ocorrências virtuais + exceções; (c) materialização sob demanda.

**Motivo.** A opção (b) não cria infinitas linhas no banco (o prompt proíbe), é o padrão usado por Google Calendar e pelo formato ICS (facilita exportar no futuro) e funciona offline.

**Detalhes.**
- Suportado: diário, semanal, quinzenal (semanal a cada 2), mensal, anual, dias da semana específicos, intervalo, data final, quantidade, sem fim.
- Mensal no dia 31: segue a RFC 5545, ou seja, **só ocorre nos meses que têm dia 31** (mesmo comportamento do Google Calendar). Anual em 29/02: só em anos bissextos.
- "Só esta": cria exceção. "Esta e as próximas": a série original termina no dia anterior e uma nova série começa (operação atômica no servidor). "Todas": altera a regra base, preservando exceções.
- Exceções são chaveadas pela **data local** da ocorrência original, porque a menor frequência suportada é diária (no máximo uma ocorrência por dia). Assim, mudar o horário da série não "perde" as exceções.

## D08 Offline, fila e conflitos

**Decisão.**
- Leitura offline: cache local (AsyncStorage) de agendas, membros e eventos já sincronizados.
- Escrita de eventos: **sempre** passa por uma fila local (outbox), mesmo online. Se houver internet, a fila é enviada na hora.
- Cada operação tem `id` único (UUID), data local, tipo, entidade, payload, status, tentativas, erro e data da última tentativa (exatamente os campos da seção 15).
- O servidor registra cada `id` de operação processado (`sync_operations`). Reenvio da mesma operação devolve o mesmo resultado, sem duplicar (regra 17).
- Eventos novos já nascem com ID gerado no aparelho, então reenviar uma criação não cria duplicata.
- Conflitos: cada evento tem `version`. A edição envia a versão em que se baseou. Se o servidor tiver outra versão:
  1. o app tenta **mesclar** (se você mudou o local e a outra pessoa mudou o título, os dois ficam);
  2. se os mesmos campos foram alterados, o app **pergunta** qual manter.

**Por que não "a última gravação vence".** Ela apaga silenciosamente o trabalho de outra pessoa. Exemplo: você muda o horário offline; sua namorada muda o local online; quando você reconecta, "última vence" perderia o local novo. Com versão e mesclagem, os dois campos são preservados.

**Ações que exigem internet** (convites, membros, papéis, exclusão de conta, exportação) não entram na fila: o app avisa que precisa de conexão (regra 23).

## D09 Lembretes e notificações

**Decisão (V1).**
- **Lembretes**: notificações **locais**, agendadas no próprio aparelho com `expo-notifications`. Funcionam offline e não precisam de Firebase.
- **Avisos de colaboração** (convite aceito, evento alterado, membro removido, comentário): gravados no banco por gatilhos (triggers) e mostrados na **central de avisos** do app, em tempo real quando o app está aberto.
- **Push remoto** (aviso com o app fechado): fica para a próxima versão, porque exige projeto Firebase, credencial FCM e uma função no servidor. A tabela `devices` já guarda o campo `push_token` para isso.

**Tratamentos.** Reagendamento completo a cada sincronização (cancela e recria) evita duplicidade e cobre evento alterado, cancelado, série recorrente, troca de fuso e troca de aparelho. Horário de silêncio e "mostrar detalhes na tela bloqueada" são respeitados. Por padrão a notificação mostra só "Você tem um compromisso" (privacidade).

## D10 Convites

**Decisão.**
- Código aleatório gerado **no servidor** (60 bits, formato `XXXX-XXXX-XXXX`, sem letras ambíguas).
- No banco fica só o **hash SHA-256** do código (regra 35: nada de autenticação em texto puro). O código aparece uma única vez, para ser compartilhado. Perdeu? Cancele e gere outro.
- Prévia antes de aceitar: nome da agenda, cor, papel e quem convidou (regras 3 e 4).
- Limite de tentativas: 10 códigos errados em 15 minutos bloqueiam novas tentativas temporariamente.
- Convite para um e-mail substitui um convite pendente anterior para o mesmo e-mail (evita duplicados, regra 7).
- Convite por e-mail só pode ser aceito por conta com e-mail **confirmado**.

## D11 Privacidade de eventos

| Nível | Quem vê tudo | Quem vê só "Ocupado" |
|---|---|---|
| `members` (padrão) | Todos os membros ativos | Ninguém |
| `participants` | Criador, participantes escolhidos, proprietário e administradores | Ninguém (os demais não veem) |
| `private` | Só o criador (quando a agenda permite eventos privados) | Ninguém |
| `busy` | Criador, proprietário e administradores | Demais membros veem título "Ocupado" e horário |

Regra 29 (criador não esconde evento de quem administra, salvo regra explícita): a "regra explícita" é a configuração da agenda **Permitir eventos privados**, ligada por padrão e desligável pelo proprietário.

## D12 Exclusão lógica e lixeira

**Decisão.** Eventos e agendas excluídos ganham `deleted_at` e somem das telas. Agendas ficam 30 dias na lixeira e podem ser restauradas pelo proprietário. Eventos podem ser restaurados por quem pode editá-los. A exclusão definitiva é feita pela função `public.purge_trash()`, que pode ser agendada no Supabase (pg_cron) ou executada manualmente.

## D13 Armazenamento seguro da sessão

**Decisão.** Tokens no `expo-secure-store` (Android Keystore), divididos em pedaços, porque a sessão do Supabase pode passar de 2 KB (limite recomendado por valor). No navegador (usado só para testes), cai para `localStorage`.

## D14 Geração do APK

**Opções.** EAS Build (nuvem da Expo, exige conta e token), build local com Android Studio (exige computador potente e muita configuração), ou GitHub Actions com Gradle.

**Decisão.** GitHub Actions com Gradle (`expo prebuild` + `./gradlew assembleRelease bundleRelease`).

**Motivo.** Grátis, não exige conta extra, não exige Android Studio. O APK fica disponível para download na aba Actions e, ao rodar o workflow manualmente, também na página **Releases**, com link direto para baixar no celular.

**Assinatura.** Sem segredos configurados, o APK é assinado com a chave de debug do template (boa para testes, **não** para distribuição ampla). Com os segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, o workflow assina com a sua chave. Passo a passo em [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md).

## D15 Estado global

**Decisão.** `zustand` (biblioteca pequena de estado global) + cache próprio.

**Motivo.** Menos conceitos que Redux, sem "mágica". Cada store é um arquivo simples com dados e funções.

## D16 Tabelas do prompt que foram adaptadas

| Tabela pedida | O que foi feito | Por quê |
|---|---|---|
| `users` | Usa `auth.users` do Supabase | Senhas com hash bcrypt, confirmação e recuperação prontas |
| `sessions` | Usa `auth.sessions` do Supabase | O Supabase já controla sessões e revogação |
| `event_recurrences` | Virou a coluna `events.recurrence_rule` | Relação 1 para 1; RRULE é padrão de mercado |
| `attachments` | Não criada na V1 | Anexos estão fora do escopo; o desenho está no [ROADMAP.md](ROADMAP.md) |
| `deleted_records` | Não criada | Exclusão lógica (`deleted_at`) e sincronização por janela completa já cobrem; seria necessária só em sincronização incremental |
| Demais | Criadas como pedido | Ver [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md) |

## D17 E-mail e confirmação de conta

**Contexto.** Desde 2024 o servidor de e-mail gratuito do Supabase só envia mensagens para endereços da equipe do projeto e tem limite baixo por hora.

**Decisão.** O app suporta os dois modos:
- confirmação **desligada**: cadastro entra direto (recomendado para começar com poucas pessoas conhecidas);
- confirmação **ligada** com SMTP próprio (ex.: Resend, gratuito para volume baixo): o app pede o código de 6 dígitos.

Recuperação de senha também usa código de 6 dígitos digitado no app (evita configurar links profundos). Os modelos de e-mail precisam conter `{{ .Token }}`; passo a passo no [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md).

**Consequência.** Sem SMTP próprio, a recuperação de senha só chega para e-mails da equipe do Supabase. Documentado em [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## D18 Autoria, licença e repositório

- Autor: **Gustavo Oliveira dos Santos**, e-mail de commits informado pelo proprietário.
- Repositório: `GustavoOliveira-xxx/app-teste-agenda` (já existente).
- Licença: **MIT**.
- Os commits são de autoria do proprietário. O assistente de IA aparece apenas como coautor técnico na mensagem do commit (linha `Co-Authored-By`), conforme a ferramenta utilizada.

## D19 Agenda pessoal criada no cadastro

**Decisão.** Ao criar a conta, o banco cria automaticamente a agenda "Minha agenda" (tipo pessoal).

**Motivo.** A pessoa já começa com um lugar para criar eventos, sem tela vazia e sem passo extra.

## D20 Testes do banco com PGlite

**Decisão.** Testar migrations, RLS e funções com PGlite (PostgreSQL real compilado para WebAssembly, roda dentro do Node), simulando o `auth.uid()` do Supabase.

**Motivo.** Permite testar permissões de verdade (usuário A não vê dados de B, visualizador não edita, removido perde acesso) sem Docker e sem acessar o projeto de produção. Roda no GitHub Actions em segundos.
