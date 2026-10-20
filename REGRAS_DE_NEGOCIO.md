# Regras de negócio

Cada regra da seção 19 do prompt, onde ela é garantida e qual teste automático a comprova.

**Legenda de onde a regra vive**
- **RLS**: regra de acesso no banco (não dá para burlar pelo app).
- **Função**: função SQL do servidor (`supabase/migrations/20261020000500_rpc.sql`).
- **Gatilho**: trigger no banco.
- **App**: validação ou comportamento no aplicativo.

**Testes**: arquivos em `supabase/tests/` (banco) e `app-mobile/src/**/__tests__/` (app). O número entre parênteses é o nome do arquivo.

| # | Regra | Onde | Teste |
|---|---|---|---|
| 1 | Apenas usuários autenticados acessam agendas privadas | RLS (políticas `to authenticated`), permissões revogadas de `anon` | "usuário anônimo não acessa nenhum dado" (01) |
| 2 | Só visualiza a agenda após aceitar o convite | RLS (`private.calendar_role` exige membro ativo); prévia não dá acesso | "prévia mostra agenda e papel" (03) |
| 3 | Proprietário não sai sem transferir ou excluir | Função `leave_calendar` (`OWNER_CANNOT_LEAVE`) | "proprietário não sai sem transferir" (02) |
| 4 | Usuário removido perde acesso imediatamente | RLS depende de `status = 'active'`; app apaga cache | "remover membro revoga o acesso imediatamente" (02) |
| 5 | Convites podem expirar | Função `accept_invitation_internal` | "convite cancelado e convite expirado" (03) |
| 6 | Convites cancelados não são reutilizáveis | Função (`INVITE_CANCELLED`) | (03) |
| 7 | Eventos privados não aparecem para quem não tem autorização | RLS `events_select` + `list_events` | "privado: só quem criou vê" (06) |
| 8 | Toda autorização é verificada no backend | RLS em todas as tabelas; app só esconde botões | todos os testes de banco |
| 9 | Usuários não elevam os próprios privilégios | Permissão de coluna (`role` não é atualizável), gatilho de proteção, função recusa `CANNOT_CHANGE_OWN_ROLE` | "ninguém eleva o próprio papel" (02) |
| 10 | Removidos deixam de receber notificações | Gatilhos só avisam membros ativos | "removido ... deixa de receber avisos" (07) |
| 11 | Eventos excluídos não aparecem na agenda | `deleted_at` + filtro em `list_events` e RLS | "excluir é lógico" (04) |
| 12 | Operações destrutivas exigem confirmação | App: diálogo de confirmação; exclusões definitivas pedem digitar EXCLUIR | revisão manual (docs/TESTES.md) |
| 13 | Backend rejeita alterações não autorizadas mesmo forçadas | RLS + permissões por coluna | "visualizador não ... mesmo tentando direto na tabela" (04) |
| 14 | Mudanças em eventos compartilhados geram histórico | Gatilho `events_after_write` | "cancelado continua no histórico" (04) |
| 15 | Horários respeitam o fuso configurado | Instantes em UTC + fuso IANA; app converte | testes de datas (app: dates.test.ts) |
| 16 | Recorrentes suportam ocorrência individual e série | `recurrence_exceptions` + `split_series` | (05) e recurrence.test.ts |
| 17 | Sincronização evita duplicações por reenvio | `sync_operations` + id do evento gerado no aparelho | "reenvio da mesma criação não duplica" (05) |
| 18 | Convites são idempotentes | Aceitar de novo não gasta uso | "aceitar de novo é idempotente" (03) |
| 19 | Exclusão de conta informa o impacto | Função `account_deletion_impact` + tela | "exclusão de conta ... informa o impacto" (07) |
| 20 | Dados privados ficam inacessíveis após revogação | RLS imediato; app apaga cache da agenda | (02) |
| 21 | Mensagens de erro não revelam informações sensíveis | Códigos curtos no banco; app traduz (`utils/errors.ts`) | errors.test.ts |
| 22 | Endpoints sensíveis têm limite de requisições | Convites (10 erros/15 min, 30 criações/hora), exportação (5/hora); Auth com limites do Supabase | "códigos errados demais bloqueiam" (03) |
| 23 | Operações que exigem rede informam o usuário | App: `useAction` mostra "precisa de internet" | revisão manual |
| 24 | Alterações administrativas são registradas | `audit_logs` (papéis, remoção, transferência, convites, exportação, exclusão) | "mudanças administrativas são auditadas" (07) |
| 25 | Concorrência não deixa o evento inconsistente | Controle de versão em `apply_event_op` | "duas pessoas editam o mesmo evento" (05) |
| 26 | Agenda ativa tem proprietário válido | Índice único "um proprietário ativo"; transferência atômica | "a agenda nova tem exatamente um proprietário" (02) |
| 27 | Sem permissão de convite, não convida | Função `create_invitation` + configurações da agenda | "quem pode convidar" (03) |
| 28 | O papel é visível ao próprio participante | `list_my_calendars.my_role` e lista de membros | "lista de membros mostra papéis" (02) |
| 29 | Criador não esconde evento de quem administra, salvo regra explícita | Configuração "Permitir eventos privados" (desligável) | "agenda que não permite privados recusa" (06) |
| 30 | Conflito de horário é avisado sem impedir, salvo configuração | App avisa; política "bloquear" validada no gatilho | "política de conflito" (04), filters.test.ts |
| 31 | Cancelado fica no histórico mas não é compromisso ativo | Status `cancelled`, riscado na tela, sem lembretes | (04) |
| 32 | Alterar uma ocorrência preserva a série e registra exceção | `recurrence_exceptions` | "exceção de recorrência" (05) |
| 33 | Menores de idade: regras adicionais ou limitação documentada | **Limitação documentada**: uso destinado a maiores de 18 anos ou com responsável ([POLITICA_DE_PRIVACIDADE.md](POLITICA_DE_PRIVACIDADE.md)) | não se aplica |
| 34 | Links públicos opt-in, revogáveis e expiráveis | **Não implementado** (agendas são sempre privadas); desenho no ROADMAP | não se aplica |
| 35 | Nenhuma informação de autenticação em texto puro | Senhas com bcrypt (Supabase Auth); códigos de convite só como hash; sessão no Keystore | "guardado só como hash" (03) |

## Regras adicionais propostas e implementadas

| # | Regra | Por quê |
|---|---|---|
| A1 | Quem convida não concede papel igual ou maior que o seu (exceto o proprietário) | Evita escalada de privilégio indireta |
| A2 | Administrador só gerencia papéis abaixo de administrador | Um admin não remove outro admin |
| A3 | Convite por e-mail só pode ser aceito pelo dono daquele e-mail, e com e-mail confirmado | Impede alguém criar conta com o e-mail de outra pessoa para "roubar" o convite |
| A4 | Novo convite para o mesmo e-mail cancela o pendente anterior | Evita convites duplicados |
| A5 | Agenda arquivada é somente leitura; na lixeira, ninguém além do dono a vê | Comportamento previsível de "arquivar" e "lixeira" |
| A6 | Eventos não mudam de agenda | Evita que alguém leve um evento para uma agenda onde outras pessoas não deveriam vê-lo |
| A7 | Editor não pode tornar privado o evento de outra pessoa | Ele perderia o acesso e "sumiria" com o evento |
| A8 | O criador de um evento é sempre quem está logado | O app não consegue forjar autoria |
| A9 | Lembretes e preferências são pessoais | Cada pessoa decide seus avisos |
| A10 | Comentários exigem papel colaborador ou acima | Visualizador "não altera conteúdo" |
| A11 | Seed de demonstração só roda em banco sem usuários | Proteção contra contas de teste em produção |
| A12 | Ao sair da conta, todos os dados locais são apagados | Privacidade em aparelho compartilhado |
| A13 | Máximo de 5 lembretes por evento, 100 participantes e 20 aparelhos por pessoa | Limites razoáveis contra abuso |

## Papéis e permissões (resumo)

| Ação | Proprietário | Administrador | Editor | Colaborador | Visualizador |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver eventos permitidos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Criar eventos | ✓ | ✓ | ✓ | ✓ | |
| Editar eventos de outras pessoas | ✓ | ✓ | ✓ (se a agenda permitir) | | |
| Editar os próprios eventos | ✓ | ✓ | ✓ | ✓ | |
| Comentar | ✓ | ✓ | ✓ | ✓ | |
| Convidar | ✓ | ✓ (se permitido) | se permitido | se permitido | |
| Mudar papéis / remover membros | todos | abaixo de admin | | | |
| Configurações comuns (nome, cor, conflitos) | ✓ | ✓ | | | |
| Configurações exclusivas (papel padrão, privados, quem convida) | ✓ | | | | |
| Arquivar, lixeira, excluir agenda, transferir | ✓ | | | | |
| Ver histórico administrativo | ✓ | ✓ | | | |
| Sair da agenda | após transferir | ✓ | ✓ | ✓ | ✓ |

## Status e validações de convites

Status: `pending` (pendente), `accepted` (aceito), `declined` (recusado), `cancelled` (cancelado), `expired` (expirado), `exhausted` (esgotado). "Expirado" e "esgotado" também são calculados na hora da consulta, mesmo que o status salvo ainda seja "pendente".

## Validações de evento (app e servidor)

- Título obrigatório (1 a 150 caracteres, espaços nas pontas removidos).
- Data e hora válidas; término depois do início; duração máxima de 366 dias.
- URL só `http://` ou `https://` (bloqueia `javascript:`).
- Local até 200, endereço até 300, descrição até 5.000 caracteres.
- Recorrência: intervalo 1 a 99, até 999 repetições, data final depois do início, semanal com pelo menos um dia, nunca UNTIL e COUNT juntos.
- Participantes precisam ser membros ativos da agenda.
