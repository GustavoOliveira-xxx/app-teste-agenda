# Auditoria da versão 2.0.0 e plano da 3.0.0

Feita em 23/10/2026 sobre o commit `26320e0` (versão 2.0.0), antes de qualquer mudança da 3.0.0.

Como foi feita:
- leitura do código (app, banco, função de envio, testes e workflows);
- execução de todos os testes: 111 testes do app (Jest), 71 testes do banco (PGlite) e tipos e lint sem erros;
- consulta aos números do banco de produção (sem ler conteúdo pessoal): 2 contas, 2 agendas, 1 evento, nenhum evento do tipo `task` ou `reminder`, nenhum lembrete gravado e nenhuma inscrição de notificação no navegador.

Nada foi dado como pronto só porque a documentação dizia. Onde não houve teste em aparelho ou navegador real, o item aparece como **não validado**.

## 1. Matriz de funcionalidades

| # | Funcionalidade | Onde está | Estado real | Limitações encontradas | O que a 3.0.0 muda | Testes que existem | Testes que faltavam |
|---|---|---|---|---|---|---|---|
| 1 | Eventos (criar, editar, excluir, restaurar, concluir, cancelar) | `services/eventActions.ts`, `apply_event_op` | Implementada | Nenhuma relevante | Eventos ganham vínculo com tarefa (bloco de tempo) e identificador externo (importação ICS) | `04_eventos`, `05_sincronizacao`, `validation.test` | Vínculo com tarefa |
| 2 | Tipos `task` e `reminder` de evento | `events.event_type` | Parcial | São só rótulos de evento: exigem início e fim, não têm prazo sem horário, prioridade, subtarefas nem conclusão por ocorrência | Tarefas e lembretes viram registros próprios. Os tipos antigos continuam válidos para eventos já criados, mas saem da lista de tipos de evento novos | Nenhum específico | Migração e convivência |
| 3 | Lembretes de evento | tabela `reminders`, `services/localNotifications.ts` | Implementada | Pessoais, por evento, até 5 | Mantidos. Mesma regra passa a valer para tarefas e lembretes | `reminders.test` | Adiamento |
| 4 | Adiar 10 min | `snoozeReminder` | **Com defeito** | A cada sincronização todos os agendamentos são apagados e refeitos, inclusive o lembrete adiado, que some se houver sincronização nos 10 minutos seguintes | Adiamentos guardados no aparelho e reagendados a cada sincronização, sem duplicar | Nenhum | Plano de reagendamento com adiamentos |
| 5 | Notificações Android | `expo-notifications`, canais `lembretes*` | Implementada, **não validada em aparelho** | Horizonte de 30 dias e 60 agendamentos; nunca foi verificado após reinício do aparelho | Botão "Concluir" nas notificações de tarefas e lembretes | Plano puro (`planReminders`) | Roteiro manual em aparelho físico |
| 6 | Web Push (iPhone e computador) | `functions/enviar-push`, `services/webPush.ts`, `public/sw.js` | Implementada; envio testado de ponta a ponta com servidor local; **entrega real em iPhone não validada** | O agendamento só chama a função quando existe ao menos uma inscrição (hoje nenhuma); só envia lembretes de eventos e avisos | Envia também alertas de tarefas e lembretes e os avisos novos | `09_synck_push` | Alertas de tarefas |
| 7 | Offline e sincronização | `offline/*` | Implementada para eventos | A fila só conhece eventos; membros, convites e configurações exigem internet (correto) | A fila passa a aceitar tarefas, subtarefas, lembretes, conclusões, listas, anotações, hábitos e o plano do dia | `outbox.test`, `05_sincronizacao` | Operações das novas entidades |
| 8 | Permissões e RLS | `20261020000600_security.sql` | Implementada | Nenhuma falha encontrada | Toda tabela nova nasce com RLS e permissões por coluna | `02`, `06`, `07` | Tarefas privadas e atribuídas |
| 9 | Visão mensal | `components/MonthGrid.tsx` | Implementada | Só mostra eventos | Marcadores de tarefas e lembretes, filtro por tipo | Capturas e2e | Itens de tarefa no mês |
| 10 | Visão semanal | `CalendarScreen.tsx` | **Parcial** | É uma lista por dia, sem grade de horários, sem eventos lado a lado, sem linha do horário atual | Grade de horários real, arrastar para reagendar e alternativa acessível | Nenhum | Posicionamento e sobreposição |
| 11 | Visão diária | `CalendarScreen.tsx` | **Parcial** | Lista simples | Linha do tempo com horários livres, tarefas com horário, lembretes e conflitos | Nenhum | Idem |
| 12 | Fluxo de criação | `FAB` abre só "Novo evento" | Parcial | Não há tarefa nem lembrete sem horário | Botão universal e adição rápida em linguagem natural | Nenhum | Interpretador de texto |
| 13 | Recorrência | `utils/recurrence.ts` | Implementada | Só eventos; ocorrências virtuais (correto) | Tarefas recorrentes por calendário e por conclusão, cálculo da próxima data também no banco | `recurrence.test` | Próxima data de tarefa (app e banco) |
| 14 | Migrações | `supabase/migrations` | Implementada | A migration `synck` foi aplicada em produção com nome diferente do arquivo (sem efeito prático) | Nova migration incremental, sem alterar as antigas | Todas as migrations rodam nos testes | Compatibilidade com dados da 2.0 |
| 15 | Histórico de atividades | `activity_logs`, `HistoryScreen` | Implementada para agendas e eventos | Não cobre itens pessoais | Histórico de tarefas, lembretes e anotações | `07_avisos_lgpd` | Histórico de tarefas |
| 16 | Configurações da conta | `screens/settings/*` | Implementada | Sem opções de planejamento | Horário do planejador, pergunta diária, compartilhar disponibilidade, avisos de tarefas | `01_conta` | Novas preferências |
| 17 | Confirmação de presença | `EventDetailScreen` (Vou, Talvez, Não vou) | Implementada | Nenhuma | Mantida | `04_eventos` | Nenhum |
| 18 | Busca | `SearchScreen`, `search_events` | Parcial | Só eventos | Busca universal por categoria | `06_privacidade_busca` | Tarefas e anotações |
| 19 | Comentários | `comments` | Implementada para eventos | Nenhuma | Comentários em tarefas | `04_eventos` | Tarefas |
| 20 | Exportação de dados (LGPD) | `export_my_data` | Implementada | Não inclui as entidades novas | Inclui tarefas, lembretes, anotações, hábitos e votos | `07_avisos_lgpd` | Novas entidades |

## 2. Divergências entre documentação e código

- `ARQUITETURA.md` ainda dizia "push remoto planejado", mas a 2.0.0 já tem Web Push no navegador. O app Android usa notificações locais (não há push remoto para Android, por decisão de custo e privacidade).
- `MODELO_DE_DADOS.md` não citava `push_subscriptions` nem `private.web_push_config`.
- O comentário de `TabBar.tsx` fala em quatro abas; a 3.0.0 passa a ter cinco.

## 3. Riscos mapeados

| Risco | Como foi tratado |
|---|---|
| Perder ou duplicar dados da 2.0 | Nada é apagado nem convertido automaticamente. Eventos antigos dos tipos tarefa e lembrete continuam eventos (não havia nenhum em produção) |
| Lembrete antigo disparar duas vezes | Lembretes de evento continuam na tabela `reminders`; alertas de tarefa ficam em `task_alerts`, com identificadores diferentes nas notificações |
| App 2.0 desatualizado falar com o banco novo | Só foram adicionadas colunas opcionais e funções novas. `list_events` ganhou colunas no fim, o que o app antigo ignora |
| Tarefa privada vazar para quem divide outra agenda | Tarefa pessoal só é vista pela dona; tarefa em agenda segue a privacidade escolhida; testes cobrem leitura direta pela API |
| Concluir a mesma ocorrência em dois aparelhos | Conclusão por ocorrência com chave única no banco; a próxima data só avança uma vez |
| Custos | Nenhum serviço pago novo; tudo roda no plano gratuito do Supabase e no GitHub |

## 4. Critérios de aceite usados

Os 10 cenários do pedido da 3.0.0. O resultado de cada um está em [`docs/VALIDACAO_3.0.md`](VALIDACAO_3.0.md), marcado como aprovado só quando houve teste que o demonstre; o restante fica como pendente.

## 5. Plano por etapas

| Etapa | Conteúdo |
|---|---|
| A | Esta auditoria |
| B | Migration `20261023000800_tarefas.sql`: listas, tarefas e lembretes, subtarefas, participantes, conclusões, alertas, plano do dia, anotações, hábitos, enquetes, histórico, disponibilidade, vínculo evento e tarefa |
| C e D | Fila offline genérica, telas de tarefas e lembretes, notificações locais e no navegador |
| E | Botão universal, adição rápida, nova tela Hoje com a pergunta diária, grade semanal e diária |
| F, G e H | Tarefas compartilhadas, planejador, encontrar horário, enquetes, resumo da semana, anotações, busca universal, ICS |
| I | Testes, documentação, versão 3.0.0, APK e site |
