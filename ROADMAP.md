# Roadmap

O que fica para depois da primeira versão, com o impacto de cada item. A arquitetura já foi pensada para eles: o app fala com o servidor por uma única camada (`app-mobile/src/services`), o banco é SQL padrão versionado e todas as datas são guardadas em UTC com fuso IANA (o mesmo formato usado por Google, Apple e Outlook).

## Prioridades sugeridas

| Prioridade | Item | Por quê |
|---|---|---|
| **Alta** | Envio de e-mail de convite e SMTP próprio | Convidar por e-mail sem depender do código |
| **Alta** | Push remoto (Firebase Cloud Messaging) | Avisar na hora quando alguém muda um evento, mesmo com o app fechado |
| **Alta** | Lembretes na versão web (Web Push) | Lembretes que tocam no iPhone (app instalado na tela de início, iOS 16.4 ou mais novo) e no computador |
| **Alta** | Exportação ICS (e assinatura de calendário) | Ver os eventos no Google Agenda ou no calendário do iPhone sem integração complexa |
| **Alta** | Publicação na Play Store | Instalação e atualização mais fáceis e confiáveis |
| Média | Login com Google | Cadastro em um toque |
| Média | Autenticação em dois fatores (2FA) | Mais segurança para quem quiser |
| Média | Exportação CSV | Planilhas e relatórios |
| Média | Anexos | Receitas, ingressos, comprovantes |
| Média | Links públicos com expiração | Compartilhar um evento com quem não usa o app |
| Média | iOS (iPhone) | Atender quem tem iPhone |
| Baixa | Google Calendar (sincronização nos dois sentidos) | Complexa; a exportação ICS resolve boa parte |
| Baixa | Outlook / Apple Calendar (sincronização) | Idem |
| Baixa | Localização e mapas | O campo de local em texto já atende |
| Baixa | Login com Apple | Obrigatório só se houver login social no iOS |
| Baixa | PDF | Impressão de agenda; pouco pedido |

## Detalhamento das integrações

Legenda de custo: **gratuito** (dentro dos planos gratuitos para grupos pequenos), **baixo** (alguns dólares por mês ou taxa única), **variável** (depende do volume).

### Google Calendar (sincronização)

- **Dependências:** projeto no Google Cloud, OAuth com escopo de calendário, Edge Function no Supabase para trocar e renovar tokens, tarefa periódica para sincronizar.
- **Riscos:** verificação do app pelo Google (escopos sensíveis exigem análise), conflitos entre as duas fontes, eventos recorrentes com regras diferentes, tokens expirados.
- **Permissões no celular:** nenhuma (é pelo servidor).
- **Privacidade:** o app passa a ler e gravar no calendário pessoal da pessoa; consentimento explícito, possibilidade de desconectar e apagar tokens; atualizar a política de privacidade.
- **Banco:** tabela `external_accounts` (tokens criptografados, só no servidor) e `external_event_links` (ligação entre o evento daqui e o de lá).
- **Custo:** gratuito na API; Edge Functions dentro do plano gratuito para volume baixo.
- **Prioridade:** baixa (a exportação ICS cobre o caso principal com muito menos risco).

### Apple Calendar

- **Dependências:** não há API de servidor; seria pelo calendário do aparelho (`expo-calendar`) ou por assinatura ICS.
- **Riscos:** acesso ao calendário do celular é sensível; duplicação de eventos.
- **Permissões:** `READ_CALENDAR`/`WRITE_CALENDAR` (Android) e acesso ao Calendário (iOS) se for pelo aparelho; nenhuma se for por assinatura ICS.
- **Privacidade:** dados do calendário pessoal ficam no aparelho; deixar claro o que é copiado.
- **Banco:** nenhum, se for por ICS.
- **Custo:** gratuito.
- **Prioridade:** baixa (usar a assinatura ICS).

### Outlook

- **Dependências:** Microsoft Graph, registro de app no Azure, OAuth, Edge Function.
- **Riscos e privacidade:** iguais aos do Google Calendar.
- **Permissões:** nenhuma no celular.
- **Banco:** as mesmas tabelas do Google Calendar.
- **Custo:** gratuito para contas pessoais.
- **Prioridade:** baixa.

### Exportação ICS

- **Dependências:** gerar arquivos `.ics` (RFC 5545). O modelo de recorrência já usa o mesmo formato (RRULE), então a conversão é direta. Para "assinar" o calendário, uma Edge Function que responde um link secreto por agenda.
- **Riscos:** o link de assinatura dá acesso de leitura a quem o tiver; precisa ser revogável e respeitar a privacidade dos eventos (privados e "ocupado" não podem vazar).
- **Permissões:** nenhuma (o compartilhamento usa a folha de compartilhar do sistema).
- **Privacidade:** o arquivo sai do app; mostrar aviso. O link de assinatura deve ser opt-in, com expiração.
- **Banco:** tabela `calendar_feeds` (hash do token, validade, revogação).
- **Custo:** gratuito.
- **Prioridade:** alta.

### Exportação CSV

- **Dependências:** nenhuma biblioteca obrigatória; geração no app.
- **Riscos:** fórmulas maliciosas em planilhas ("CSV injection"): escapar campos que começam com `=`, `+`, `-`, `@`.
- **Permissões:** nenhuma.
- **Privacidade:** igual à exportação ICS.
- **Banco:** nenhum.
- **Custo:** gratuito.
- **Prioridade:** média.

### Exportação JSON

- **Situação:** **parcialmente pronta.** A exportação de dados pessoais (LGPD) já gera um JSON completo em **Perfil > Privacidade e dados**. Falta a exportação por agenda.
- **Dependências:** reaproveitar a função `export_my_data`.
- **Riscos, permissões, privacidade:** os mesmos da exportação CSV.
- **Banco:** nenhum.
- **Custo:** gratuito.
- **Prioridade:** baixa (o principal já existe).

### PDF

- **Dependências:** `expo-print` (gera PDF a partir de HTML).
- **Riscos:** aumento do tamanho do app; diferenças de layout entre aparelhos.
- **Permissões:** nenhuma.
- **Privacidade:** o arquivo sai do app.
- **Banco:** nenhum.
- **Custo:** gratuito.
- **Prioridade:** baixa.

### Compartilhamento por WhatsApp

- **Situação:** **pronto de forma genérica.** O código de convite e os detalhes de um evento já são compartilhados pela folha de compartilhar do Android, que inclui o WhatsApp.
- **Próximo passo:** links que abrem o app direto no convite (deep link `agendacompartilhada://` já registrado; para funcionar a partir de um link `https`, configurar App Links com um domínio próprio).
- **Riscos:** quem recebe o link pode repassá-lo; por isso o convite tem validade, limite de usos e prévia antes de aceitar.
- **Permissões:** nenhuma.
- **Banco:** nenhum (usa `invitations`).
- **Custo:** gratuito (domínio próprio: baixo).
- **Prioridade:** média.

### E-mail

- **Situação:** o convite por e-mail fica registrado e aparece para a pessoa no app, mas **nenhum e-mail é enviado**.
- **Dependências:** SMTP ou API de e-mail (Resend, Brevo), Edge Function disparada ao criar o convite, modelo de e-mail.
- **Riscos:** spam e abuso (limitar convites por hora, já existe no banco), entregabilidade (configurar SPF/DKIM no domínio).
- **Permissões:** nenhuma.
- **Privacidade:** o e-mail da pessoa convidada é enviado ao provedor de e-mail; citar na política.
- **Banco:** colunas de controle de envio em `invitations` (data, status do envio).
- **Custo:** gratuito até um limite diário; depois, baixo.
- **Prioridade:** alta.

### Links públicos com expiração

- **Dependências:** Edge Function ou página web que mostra um evento ou uma agenda a partir de um token.
- **Riscos:** vazamento de dados; o link precisa ser opt-in, revogável, com validade e respeitar a privacidade de cada evento (regra 34).
- **Permissões:** nenhuma.
- **Privacidade:** alto impacto; desligado por padrão e com aviso claro.
- **Banco:** tabela `public_links` (hash do token, escopo, validade, revogação, contador de acessos).
- **Custo:** gratuito (hospedagem da página: gratuita em planos básicos).
- **Prioridade:** média.

### Anexos

- **Dependências:** Supabase Storage (bucket privado), `expo-document-picker` ou `expo-image-picker`, geração de miniaturas.
- **Riscos:** arquivos maliciosos ou grandes; limite de 10 MB, apenas imagens e PDF, nome aleatório no servidor, links temporários (signed URLs).
- **Permissões:** o seletor de arquivos do sistema não exige permissão; a câmera exigiria `CAMERA` (preferir não pedir).
- **Privacidade:** documentos podem conter dados sensíveis (receitas médicas); seguir a privacidade do evento.
- **Banco:** tabela `attachments` (evento, caminho, tipo, tamanho, quem enviou) e regras de acesso no Storage iguais às do evento.
- **Custo:** 1 GB de armazenamento no plano gratuito; depois, variável.
- **Prioridade:** média.

### Localização e mapas

- **Situação:** o evento já tem campo de **local em texto**.
- **Dependências:** abrir o endereço no app de mapas (sem biblioteca, por link); mapa dentro do app exigiria `react-native-maps` e chave de API.
- **Riscos:** custo de API de mapas; tentação de pedir localização da pessoa (não é necessário).
- **Permissões:** nenhuma para abrir o endereço no app de mapas; `ACCESS_FINE_LOCATION` só se houver "perto de mim" (não recomendado).
- **Privacidade:** endereços podem revelar rotina; seguir a privacidade do evento.
- **Banco:** colunas opcionais de latitude e longitude em `events`.
- **Custo:** gratuito por link; variável com API de mapas.
- **Prioridade:** baixa.

### Login com Google

- **Dependências:** provedor Google no Supabase Auth, projeto no Google Cloud, `expo-auth-session` ou Google Sign-In nativo, App Links.
- **Riscos:** configuração de impressões digitais (SHA-1) da chave de assinatura; contas duplicadas (mesmo e-mail com senha e com Google).
- **Permissões:** nenhuma.
- **Privacidade:** o Google informa nome, e-mail e foto; citar na política.
- **Banco:** nenhum (o Supabase Auth guarda as identidades).
- **Custo:** gratuito.
- **Prioridade:** média.

### Login com Apple

- **Dependências:** Apple Developer, provedor Apple no Supabase, `expo-apple-authentication`.
- **Riscos:** obrigatório na App Store se houver outro login social no iOS; e-mail "oculto" da Apple.
- **Permissões:** nenhuma.
- **Privacidade:** a pessoa pode esconder o e-mail real.
- **Banco:** nenhum.
- **Custo:** incluso na anuidade da Apple.
- **Prioridade:** baixa (só junto com iOS).

### Autenticação em dois fatores (2FA)

- **Dependências:** MFA do Supabase Auth (TOTP, aplicativo autenticador), telas de cadastro e verificação do fator.
- **Riscos:** perda do celular com o autenticador; precisa de procedimento de recuperação.
- **Permissões:** nenhuma.
- **Privacidade:** melhora a proteção.
- **Banco:** nenhum (gerenciado pelo Supabase Auth); regras RLS podem exigir nível `aal2` para ações sensíveis.
- **Custo:** TOTP gratuito; SMS pago.
- **Prioridade:** média.

## Outros itens planejados

| Item | Situação atual | Próximo passo |
|---|---|---|
| Push remoto | Lembretes locais e central de avisos no app | FCM + tabela de tokens (já existe `devices`) + Edge Function ou gatilho que envia ao criar um aviso. Exige liberar a permissão de push do Google (hoje bloqueada, ver [DECISOES.md, D22](DECISOES.md#d22-lista-fechada-de-permissões-do-android)) |
| Lembretes na versão web | Os lembretes ficam salvos, mas não tocam no navegador; o app avisa isso | Web Push: chaves VAPID (segredo só no servidor), tabela de inscrições por aparelho, Edge Function que envia, e agendamento (`pg_cron`) que dispara os lembretes no horário. Custo: gratuito para volume baixo. Privacidade: o endereço de push do navegador é um dado do aparelho; apagar ao sair |
| App nativo de iPhone | Código compatível, não compilado; no iPhone usa-se a versão web instalável | Conta Apple Developer (paga), EAS Build, TestFlight, testes de notificações e do cofre de senhas no iPhone ([GUIA_DE_DEPLOY.md, parte 7](GUIA_DE_DEPLOY.md#parte-7-app-nativo-para-iphone-app-store)) |
| Play Store | AAB gerado | Ficha da loja, teste fechado ([GUIA_DE_DEPLOY.md, parte 5](GUIA_DE_DEPLOY.md#parte-5-google-play-store)) |
| Foto de perfil | Avatar com iniciais e cor | Storage + seletor de imagem do sistema |
| Carência na exclusão de conta | Exclusão imediata | Agendar a exclusão (o campo já existe no banco) e permitir cancelar |
| Outros idiomas | Só pt-BR, com estrutura de tradução pronta | Arquivos `en.ts`, `es.ts` e seleção em Preferências |
| Testes de interface no Android | Testes de tela na versão web (`e2e/`) e roteiro manual em [docs/TESTES.md](docs/TESTES.md) | Maestro ou Detox no GitHub Actions com emulador |
| Monitoramento de erros | Registro local em Diagnóstico | Sentry (plano gratuito), sem dados pessoais |
| Menores de idade | Uso indicado para maiores de 18 | Regras de consentimento do responsável |
| Visibilidade "personalizada" de eventos | 4 níveis fixos | Regras por agenda |
