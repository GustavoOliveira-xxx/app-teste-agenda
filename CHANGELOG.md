# Histórico de versões

Todas as mudanças relevantes do app ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/): `MAIOR.MENOR.CORREÇÃO`.

- **MAIOR:** mudança que exige ação de quem usa (por exemplo, reinstalar).
- **MENOR:** funcionalidade nova.
- **CORREÇÃO:** conserto sem funcionalidade nova.

O número da compilação (build) cresce a cada APK gerado e aparece em **Perfil**, no fim da tela.

## [Não lançado]

Nada ainda.

## [2.0.0] (2026-10-22)

O app agora se chama **SynCK** (um produto CK Group) e ganhou a identidade visual completa.

### Adicionado

- **Identidade SynCK:** ícone com o personagem do logo (inclusive o ícone temático do Android 13+), splash, logo no login, no menu lateral e na tela Sobre, cores claras e escuras do pacote de marca, fontes Bricolage Grotesque (títulos) e Figtree (texto) e os ícones de interface da marca.
- **Tela Hoje:** data, saudação, semana compacta, faixa de sincronização e os compromissos do dia em cartões, com o selo "Agora" no que está acontecendo.
- **Decoração animada:** esfera de vidro com névoa, anéis de órbita com satélites, mascote Kairo nos estados vazios e estrelas ao confirmar presença. Tudo proporcional ao tamanho da tela, parado em segundo plano e sem animação para quem pede "reduzir movimento".
- **Microinterações:** botões e cartões afundam com mola, o "+" gira, a pílula das abas escorrega, listas entram em cascata e o mês desliza ao trocar.
- **"Você vai?"** no evento: Vou, Talvez ou Não vou, com a resposta de cada participante.
- **Entrar com Google** (depois de ativar no Supabase, veja o GUIA_DE_DEPLOY.md, parte 9).
- **Notificações no iPhone e no computador:** lembretes e avisos chegam pelo navegador depois de ativar em Perfil > Notificações (no iPhone, com o SynCK adicionado à Tela de Início).
- **Lembretes do Android com a marca:** título que começa pelo que importa ("Em 30 min: ..."), cor e ícone do SynCK e os botões Abrir e Adiar 10 min.
- Filtros de agenda em chips no calendário e nas Agendas; cartões de agenda com papel, próximo compromisso e avatares.

### Alterado

- Navegação: Hoje, Calendário, Agendas e Perfil. Os Avisos ficam no sino da tela Hoje.
- O tema segue sempre o do aparelho (claro ou escuro); a opção de tema saiu das Preferências.
- Agendas e avatares antigos aparecem na cor SynCK mais próxima, sem mudar nada no banco.

## [1.2.0] (2026-10-21)

### Corrigido

- No computador (versão web publicada no GitHub Pages), o app mostrava "Sem internet" mesmo conectado e bloqueava criar agenda, gerar convite e outras ações. O teste de conexão agora usa um arquivo do próprio site.
- Depois de uma falha de rede passageira, o app volta a ficar online sozinho (confere de novo a cada 15 segundos).
- A versão web guarda todos os arquivos na instalação e abre sem internet desde o primeiro acesso.

### Adicionado

- Aviso de versão nova no app Android, com botão para baixar o APK.
- Arquivo de identidade visual (`src/theme/marca.ts`): cores, fonte própria, cantos, sombra e detalhes de estilo num lugar só. Passo a passo em `docs/DESIGN.md`.
- Teste automático de contraste das cores da marca.

### Alterado

- Visual neutro, pronto para receber uma identidade: tons de cinza, cantos menores, sem ícones dentro dos botões, títulos de seção sem letras maiúsculas e ícones provisórios.

## [1.1.0] (2026-10-21)

Funciona em iPhone, iPad e computador, e a tela se adapta ao tamanho.

### Adicionado

- **Versão web instalável (PWA):** abre no navegador de qualquer sistema e pode ser adicionada à tela de início (iPhone: Safari > Compartilhar > Adicionar à Tela de Início). Tem ícone próprio, abre em tela cheia, funciona sem internet depois do primeiro acesso e se atualiza sozinha.
- **Publicação automática no GitHub Pages** (workflow "Publicar versão web"), com testes de instalação e de abertura sem internet antes de publicar.
- **Layout responsivo:** menu lateral no tablet e no computador; no computador, mês e eventos do dia lado a lado; formulários e listas centralizados; diálogos no centro da tela.
- O app gira (retrato e paisagem) e aceita iPad.
- No navegador: seletor de data e hora do próprio navegador; compartilhar copia o texto quando não há folha de compartilhamento; a exportação de dados baixa um arquivo; botão para ir ao início em telas abertas por link.
- Testes de tela em tamanho de tablet e de computador.
- Passo a passo para publicar um app nativo de iPhone na App Store (exige conta paga da Apple).

### Limitações

- Na versão web, os lembretes ficam salvos mas não tocam (o app avisa). Só o app Android toca lembretes.

## [1.0.0] (2026-10-20)

Primeira versão.

### Adicionado

- **Conta:** cadastro, login, confirmação de e-mail por código (opcional), recuperação de senha por código, troca de senha, perfil com avatar de iniciais, aparelhos conectados, sair (apaga os dados do aparelho).
- **Agendas:** várias por pessoa, tipos (pessoal, compartilhada, família, profissional, projeto, viagem e personalizada), cor, fuso horário, configurações (quem convida, eventos privados, conflito de horário), arquivar, duplicar, lixeira de 30 dias. "Minha agenda" criada no cadastro.
- **Compartilhamento:** convite por código de 12 caracteres ou para e-mail cadastrado, prévia antes de aceitar, validade, limite de usos, cancelamento, troca de papel antes do aceite, limite de tentativas.
- **Papéis:** proprietário, administrador, editor, colaborador e visualizador; mudança de papel, remoção com perda de acesso imediata, saída, transferência de propriedade.
- **Eventos:** criar, editar, duplicar, cancelar, concluir, excluir e restaurar; dia inteiro; local, link e observações; participantes; privacidade (todos os membros, só participantes, privado, ocupado); comentários.
- **Recorrência:** diária, semanal com dias da semana, quinzenal, mensal, anual, fim por data ou quantidade; editar e excluir "só este", "este e os próximos" ou "todos".
- **Calendário:** mês, semana, dia e lista; filtros; busca.
- **Lembretes:** notificações locais, horário de silêncio, detalhes ocultos na tela bloqueada por padrão.
- **Offline:** cache local, fila de alterações com novas tentativas, tela de sincronização e resolução de conflitos.
- **Tempo real:** atualização automática quando outras pessoas mudam algo.
- **Avisos e histórico:** central de avisos no app e histórico de alterações por agenda.
- **Privacidade (LGPD):** exportação dos dados pessoais, exclusão de conta com explicação do impacto, política de privacidade no app.
- **Servidor:** banco PostgreSQL no Supabase com regras de acesso (RLS) em todas as tabelas, funções no servidor, auditoria e limites de requisições; dados de demonstração fictícios.
- **Qualidade:** testes automáticos do banco (PGlite) e do app (Jest), lint, formatação e checagem de tipos no GitHub Actions; verificação de segredos.
- **Distribuição:** geração de APK e AAB no GitHub Actions, com publicação na página Releases, assinatura com chave própria quando configurada e lista fechada de permissões do Android.
- **Documentação** completa em português do Brasil.

### Limitações conhecidas

Veja [README.md, Limitações conhecidas](README.md#limitações-conhecidas).
