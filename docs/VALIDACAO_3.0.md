# Validação da versão 3.0.0

Resultado dos 10 cenários de aceite do pedido da 3.0.0. Um cenário só aparece como **aprovado** quando há teste que o demonstre. O que depende de aparelho físico ou de duas pessoas usando ao mesmo tempo fica como **pendente**, com o roteiro para testar.

Situação em 24/10/2026:

| Situação | Quantos |
|---|---|
| Aprovado | 3 (5, 7 e 9) |
| Aprovado em parte (falta o aparelho) | 6 (1, 2, 3, 4, 6 e 10) |
| Pendente | 1 (8) |

Testes automatizados que sustentam esta tabela:

- **Banco** (`supabase/tests`, PGlite com as mesmas migrations aplicadas em produção): 92 testes, todos passando.
- **App** (`app-mobile`, Jest): 190 testes, todos passando.
- **Telas** (`e2e/telas.test.mjs`, versão web num navegador): 8 testes, todos passando, com capturas em `e2e/saida/` (no GitHub: aba Actions, execução do workflow Qualidade, item "capturas-das-telas").

## Cenário 1: uso individual

> Uma pessoa cria tarefas, define prazos, recebe lembretes e conclui atividades sem precisar transformar tudo em evento.

**Aprovado em parte.**

- Banco: `tarefa simples exige só o título e nasce pendente`, `alertas, "meu dia" e dias planejados são pessoais`.
- App: `taskAlerts.test.ts` confere o horário de cada alerta (prazo com hora ou 9h do dia) e que concluídas não avisam.
- Tela: o teste `3.0: tarefas, criação universal...` digita "Comprar pão amanhã", a tarefa aparece em "Próximos 7 dias" e na busca.

**Pendente:** receber o alerta no celular Android e concluir pela notificação (roteiro A abaixo).

## Cenário 2: planejamento diário

> Uma pessoa abre a tela Hoje e identifica compromissos, tarefas pendentes e avisos relevantes em uma única experiência.

**Aprovado em parte.**

- Tela: os testes entram como proprietária e como visualizadora; a pergunta "O que você pretende fazer hoje?" aparece sozinha na primeira abertura (capturas `00-plano-do-dia-*.png`) e a tela Hoje mostra a semana, a sincronização, os compromissos e o movimento nas agendas (`03-hoje.png`, `18-computador-hoje.png`).
- App: `pergunta só na primeira abertura do dia`, `sugere hábitos do dia, repetições próximas e o que costuma fazer`.

**Pendente:** conferir no Android (roteiro A).

## Cenário 3: colaboração

> Duas pessoas compartilham uma agenda, atribuem tarefas, realizam alterações e acompanham a conclusão de atividades respeitando permissões.

**Aprovado em parte.**

- Banco: `tarefa compartilhada: papéis, privacidade e responsável` (o responsável conclui, quem só visualiza não edita), `subtarefas: responsável marca, só quem edita cria ou apaga`, `comentários e histórico de tarefas respeitam a privacidade`, `membro removido perde na hora tarefas, atribuições, alertas e planos da agenda`, `enquete de horário: votos, encerramento e evento só depois da confirmação`.

**Pendente:** duas pessoas, em dois aparelhos, atribuindo e concluindo uma tarefa e vendo o aviso chegar (roteiro B).

## Cenário 4: calendário

> O usuário visualiza compromissos em uma grade horária, identifica conflitos e consegue reorganizar atividades.

**Aprovado em parte.**

- App: `posiciona e coloca lado a lado o que é ao mesmo tempo`, `evento que atravessa a meia-noite aparece nos dois dias`.
- Banco: mover uma ocorrência usa a mesma operação de "só esta ocorrência" da 2.0, coberta por `04_eventos`.

**Pendente:** arrastar um evento na grade semanal e diária no Android e no navegador, e usar os botões de mover (roteiro A, passo 6).

## Cenário 5: recorrência

> Uma tarefa recorrente pode ser concluída sem apagar ou invalidar indevidamente a série e seu histórico.

**Aprovado.**

- Banco: `recorrência por calendário: concluir avança uma vez, mesmo em dois aparelhos`, `recorrência depois da conclusão conta a partir do dia em que foi feita`, `próxima data da série: mesmos casos do app` (24 casos).
- App: os mesmos 24 casos em `taskRecurrence.test.ts`, e `concluir recorrente avança o prazo; desfazer volta` sem internet.

## Cenário 6: offline

> Uma pessoa edita registros sem internet e as alterações são sincronizadas corretamente quando a conexão retorna.

**Aprovado em parte.**

- App: `tarefa criada sem internet aparece na hora, com etapas e avisos`, `fila: só a lista de avisos mais recente vale; uma operação por item de cada vez`, `mesclagem de tarefas: prazo é um bloco; campos diferentes se juntam`.
- Banco: `reenvio da mesma operação não duplica e devolve o estado atual`, `conflitos: versão antiga e tarefa excluída por outra pessoa`.

**Pendente:** modo avião no Android, editar, voltar a conexão e conferir em outro aparelho (roteiro A, passo 7).

## Cenário 7: privacidade

> Um participante sem autorização não consegue acessar tarefas e eventos privados por consultas diretas ao backend.

**Aprovado.**

- Banco, com consultas diretas às tabelas como cada usuário: `tarefa pessoal é invisível para quem divide outra agenda; escrita direta é proibida`, `tarefa compartilhada: papéis, privacidade e responsável` (tarefa privada e "só participantes"), `encontrar horário: só horários, nunca títulos, e outras agendas só com autorização`, e os testes de eventos privados da 2.0 (`06_privacidade_busca`).
- Tela: `visualizador: vê "Ocupado" no lugar de detalhes e não vê eventos privados`.
- Produção: o verificador de segurança do Supabase não acusou tabela nova sem regra de acesso.

## Cenário 8: notificações

> Lembretes agendados funcionam nos ambientes efetivamente suportados, inclusive nas condições de aplicativo fechado que forem tecnicamente viáveis.

**Pendente.**

O que está testado: o cálculo de quando cada aviso toca (eventos e tarefas), o limite de agendamentos, o adiamento que não some mais na sincronização e a função do navegador (verificação de tipos com Deno; publicada na versão 2). O que falta é ver tocar de verdade:

- Android com o app fechado e depois de reiniciar o celular (roteiro A, passo 4);
- iPhone com o SynCK na Tela de Início e notificações ligadas em Perfil > Notificações (roteiro C).

## Cenário 9: atualização

> Os dados existentes da versão 2.0.0 são preservados após a atualização para 3.0.0.

**Aprovado.**

- Banco: `compatibilidade com a 2.0: eventos antigos e chamadas antigas continuam funcionando`.
- Produção, antes e depois da migration: 2 contas, 2 agendas, 1 evento e 3 participações, os mesmos números. Nenhuma tabela antiga perdeu coluna.

## Cenário 10: distribuição

> O APK gerado possui a versão e a assinatura corretas e pode ser instalado ou atualizado de acordo com o ambiente de testes disponível.

**Aprovado em parte.**

- O workflow Android gera o APK com a versão 3.0.0, o número da compilação crescente e a mesma chave de assinatura da 2.0 (guardada nos segredos do GitHub), e publica em Releases.

**Pendente:** instalar por cima da 2.0 num Android e conferir que a conta e as agendas continuam lá (roteiro A, passo 1).

---

## Roteiros para testar no aparelho

### Roteiro A: um Android

1. Com a 2.0 instalada e logada, baixe o APK da 3.0.0 em Releases e instale por cima. Abra: a conta, as agendas e os eventos devem estar lá. Em Perfil, no fim, deve aparecer "3.0.0".
2. Na primeira abertura do dia aparece "O que você pretende fazer hoje?". Acrescente "Ligar para o banco às 15h" e toque em "Começar o dia".
3. Na aba Tarefas, crie "Pagar luz todo dia 10 #casa" pela adição rápida. Confira que vira tarefa que se repete.
4. Crie uma tarefa com prazo daqui a 5 minutos e alerta na hora do prazo. Feche o app (tire da lista de recentes). O aviso deve tocar com os botões Concluir e Adiar. Toque em Adiar, depois abra e feche o app: o aviso adiado deve voltar em 10 minutos. Repita depois de reiniciar o celular.
5. Conclua a tarefa que se repete: o prazo vai para o próximo dia 10 e o histórico mostra a conclusão.
6. Em Calendário, visão Semana, segure um evento e arraste para outro horário. Teste também os botões de mover.
7. Ligue o modo avião, crie e conclua tarefas, desligue o modo avião e confira em Perfil > Sincronização que nada ficou pendente.

### Roteiro B: duas pessoas

1. A convida B para uma agenda compartilhada como Editor.
2. A cria uma tarefa e atribui a B. B recebe o aviso "Nova tarefa para você".
3. B conclui; A recebe "Tarefa concluída" e vê no histórico quem concluiu.
4. A cria uma tarefa privada na mesma agenda: B não pode vê-la.
5. Em Agendas > a agenda > Encontrar horário em comum, A procura um horário com B e cria uma enquete. B vota; A encerra e o evento aparece para os dois.

### Roteiro C: iPhone ou computador

1. Abra o site, adicione à Tela de Início (iPhone) e entre.
2. Em Perfil > Notificações, ligue as notificações do navegador.
3. Crie uma tarefa com prazo daqui a 5 minutos e alerta na hora do prazo. Feche o site. O aviso deve chegar em até 1 minuto depois do horário.
