# Política de Privacidade: SynCK

> **Aviso importante:** este documento é um **modelo técnico inicial**, escrito a partir de como o aplicativo funciona. Ele **pode precisar de revisão jurídica** antes de o aplicativo ser oferecido ao público em geral (por exemplo, na Google Play Store).

**Versão:** 1.1, outubro de 2026 (versão 3.0.0 do app: tarefas, planejamento e horário em comum)
**Responsável (controlador):** Gustavo Oliveira dos Santos
**Contato para assuntos de privacidade:** [defina um e-mail de contato antes de divulgar o app]

## 1. Princípios (LGPD, Lei 13.709/2018)

| Princípio | Como o app aplica |
|---|---|
| Finalidade | Os dados servem apenas para organizar agendas compartilhadas |
| Necessidade | Coletamos o mínimo: nome, e-mail e o conteúdo que você cria |
| Transparência | Esta política e a tela "Privacidade e dados" explicam tudo |
| Segurança | Senhas com hash, conexão HTTPS, regras de acesso no banco, sessão no armazenamento seguro do celular |
| Prevenção | Eventos podem ser privados; a tela bloqueada não mostra detalhes por padrão |
| Livre acesso | Você pode exportar todos os seus dados pelo app |
| Qualidade dos dados | Você corrige nome e preferências quando quiser |
| Responsabilização | Ações administrativas ficam registradas em auditoria |

## 2. Quais dados são coletados e por quê

| Dado | Por que | Base legal (sugestão, revisar) |
|---|---|---|
| Nome de exibição | Identificar você para quem divide agenda com você | Execução de contrato |
| E-mail | Login, confirmação de conta, recuperação de senha, convites por e-mail | Execução de contrato |
| Senha | Login. Guardada **apenas como hash** pelo provedor de autenticação | Execução de contrato |
| Preferências (fuso, formatos, tema, notificações, janela do seu dia, pergunta diária, compartilhar disponibilidade) | Mostrar o app do seu jeito | Execução de contrato |
| Agendas, eventos, comentários, lembretes, participantes | O próprio serviço | Execução de contrato |
| Tarefas, lembretes avulsos, listas, subtarefas, anotações, hábitos e seus registros | O próprio serviço | Execução de contrato |
| O que você planejou para o dia e os dias em que respondeu "O que você pretende fazer hoje?" | Mostrar seu plano e sugerir o que você costuma fazer | Execução de contrato |
| Votos em enquetes de horário | Marcar compromissos em grupo | Execução de contrato |
| Inscrição de notificação do navegador (endereço técnico fornecido pelo navegador) | Enviar lembretes e avisos no iPhone e no computador, se você ativar | Consentimento |
| Histórico de alterações | Transparência para o grupo e segurança | Legítimo interesse |
| Aparelho (modelo, sistema, versão do app, identificador da instalação) | Lista de aparelhos conectados e suporte | Legítimo interesse |
| Data do último acesso | Segurança e suporte | Legítimo interesse |
| Registros técnicos (logs do provedor) | Segurança e correção de falhas | Legítimo interesse |

**Não coletamos:** localização, contatos, fotos, microfone, câmera, número de telefone. O app não pede essas permissões.

## 3. Onde os dados ficam

- **Supabase** (provedor de banco de dados e autenticação), na região escolhida pelo responsável (atualmente São Paulo, `sa-east-1`).
- **No seu celular**, em cópia, para funcionar sem internet. A sessão de login fica no armazenamento seguro do Android. Ao sair da conta, os dados do aparelho são apagados.

## 4. Por quanto tempo

| Dado | Retenção |
|---|---|
| Conta e conteúdo | Enquanto a conta existir |
| Itens na lixeira (agendas, eventos, tarefas, listas, anotações e hábitos) | 30 dias, depois apagados |
| Histórico de tarefas, listas, anotações, hábitos e enquetes | Até 1 ano |
| Avisos lidos | Até 90 dias |
| Registro de operações de sincronização | 30 dias |
| Contadores de tentativas (limite de requisições) | 1 dia |
| Auditoria de ações administrativas | Enquanto o serviço existir (contém apenas identificadores, sem conteúdo) |

## 5. Quem pode acessar

- **Você.**
- **Membros das agendas que você participa:** veem seu nome e cor do avatar, seu papel, e os eventos e tarefas conforme a privacidade de cada um. **Seu e-mail não é mostrado** a outros membros.
- **Itens sem agenda** (tarefas, listas, anotações e hábitos pessoais) e **o que você planejou para o dia** são só seus.
- **Encontrar horário em comum:** quem procura vê apenas os horários em que você está ocupado, sem título, local ou participantes. Compromissos das suas **outras** agendas só entram se você ligar **Perfil > Preferências > Compartilhar minha disponibilidade** (desligado por padrão).
- **Proprietário e administradores de uma agenda:** veem o histórico administrativo daquela agenda.
- **Responsável pelo serviço:** tem acesso técnico ao banco para manutenção e suporte, apenas quando necessário.

## 6. Como exportar seus dados

App > **Perfil > Privacidade e dados > Exportar meus dados**. O app gera um arquivo (JSON) com conta, perfil, preferências, aparelhos, participações, agendas que você possui, eventos que criou, lembretes, comentários, avisos, tarefas, listas, anotações, hábitos, plano do dia e votos em enquetes, e abre o compartilhamento do celular para você salvar.

## 7. Como excluir sua conta

App > **Perfil > Privacidade e dados > Excluir minha conta**. Antes de confirmar, o app mostra o impacto. A exclusão é imediata e definitiva.

## 8. O que acontece com eventos compartilhados após a exclusão

- **Agendas que você possui** são apagadas com todos os eventos. Se elas tiverem outras pessoas, o app pede que você **transfira a propriedade** antes (para não apagar o trabalho do grupo).
- **Eventos e tarefas que você criou em agendas de outras pessoas** permanecem para o grupo, **sem o seu nome** (aparece "Ex-membro").
- **Tarefas, listas, anotações e hábitos pessoais** são apagados.
- **Seus comentários** são apagados.
- Lembretes, alertas de tarefas, plano do dia, votos, avisos, preferências, aparelhos e inscrições de notificação do navegador são apagados.

## 9. Terceiros que processam dados

| Terceiro | Para quê |
|---|---|
| Supabase Inc. | Banco de dados, autenticação, tempo real |
| Provedor de e-mail (SMTP), se configurado | Enviar códigos de confirmação e recuperação |
| GitHub | Hospedar o código e os arquivos de instalação (não recebe dados de uso) |
| Google (Android) | Exibir notificações locais no seu celular |
| Serviço de notificação do seu navegador (Apple, Google, Mozilla ou Microsoft), se você ativar | Entregar lembretes e avisos no iPhone e no computador. A notificação leva só o título e o horário (ou "Você tem um compromisso", se os detalhes estiverem ocultos) |

Não vendemos nem compartilhamos dados para publicidade.

## 10. Notificações

- **Lembretes e alertas de tarefas** são agendados no próprio celular Android. No iPhone e no computador, são enviados pelo servidor ao navegador, se você ativar em **Perfil > Notificações**.
- **Avisos** (convites, alterações) ficam na aba Avisos do app.
- Por padrão, a notificação na tela bloqueada mostra só **"Você tem um compromisso"**. Para mostrar o título, ative em **Perfil > Notificações > Mostrar detalhes na tela bloqueada**.

## 11. Analytics

Esta versão **não usa analytics nem rastreamento**. Se isso mudar no futuro, a política será atualizada antes e haverá uma opção para desativar em **Perfil > Preferências**.

## 12. Crianças e adolescentes

O app é destinado a maiores de 18 anos ou ao uso com acompanhamento de um responsável legal. Regras específicas de consentimento para menores **não estão implementadas** nesta versão.

## 13. Seus direitos

Confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento e revogação do consentimento. Use as funções do app ou escreva para o contato acima.

## 14. Alterações nesta política

Mudanças relevantes serão avisadas no app. A versão vigente fica neste arquivo e na tela **Política de privacidade** do app.
