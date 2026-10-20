# Histórico de versões

Todas as mudanças relevantes do app ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/): `MAIOR.MENOR.CORREÇÃO`.

- **MAIOR:** mudança que exige ação de quem usa (por exemplo, reinstalar).
- **MENOR:** funcionalidade nova.
- **CORREÇÃO:** conserto sem funcionalidade nova.

O número da compilação (build) cresce a cada APK gerado e aparece em **Perfil**, no fim da tela.

## [Não lançado]

Nada ainda.

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
