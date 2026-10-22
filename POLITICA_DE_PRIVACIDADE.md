# Política de Privacidade: SynCK

> **Aviso importante:** este documento é um **modelo técnico inicial**, escrito a partir de como o aplicativo funciona. Ele **pode precisar de revisão jurídica** antes de o aplicativo ser oferecido ao público em geral (por exemplo, na Google Play Store).

**Versão:** 1.0, outubro de 2026
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
| Preferências (fuso, formatos, tema, notificações) | Mostrar o app do seu jeito | Execução de contrato |
| Agendas, eventos, comentários, lembretes, participantes | O próprio serviço | Execução de contrato |
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
| Itens na lixeira (agendas e eventos) | 30 dias, depois apagados |
| Avisos lidos | Até 90 dias |
| Registro de operações de sincronização | 30 dias |
| Contadores de tentativas (limite de requisições) | 1 dia |
| Auditoria de ações administrativas | Enquanto o serviço existir (contém apenas identificadores, sem conteúdo) |

## 5. Quem pode acessar

- **Você.**
- **Membros das agendas que você participa:** veem seu nome e cor do avatar, seu papel, e os eventos conforme a privacidade de cada evento. **Seu e-mail não é mostrado** a outros membros.
- **Proprietário e administradores de uma agenda:** veem o histórico administrativo daquela agenda.
- **Responsável pelo serviço:** tem acesso técnico ao banco para manutenção e suporte, apenas quando necessário.

## 6. Como exportar seus dados

App > **Perfil > Privacidade e dados > Exportar meus dados**. O app gera um arquivo (JSON) com conta, perfil, preferências, aparelhos, participações, agendas que você possui, eventos que criou, lembretes, comentários e avisos, e abre o compartilhamento do celular para você salvar.

## 7. Como excluir sua conta

App > **Perfil > Privacidade e dados > Excluir minha conta**. Antes de confirmar, o app mostra o impacto. A exclusão é imediata e definitiva.

## 8. O que acontece com eventos compartilhados após a exclusão

- **Agendas que você possui** são apagadas com todos os eventos. Se elas tiverem outras pessoas, o app pede que você **transfira a propriedade** antes (para não apagar o trabalho do grupo).
- **Eventos que você criou em agendas de outras pessoas** permanecem para o grupo, **sem o seu nome** (aparece "Ex-membro").
- **Seus comentários** são apagados.
- Lembretes, avisos, preferências e aparelhos são apagados.

## 9. Terceiros que processam dados

| Terceiro | Para quê |
|---|---|
| Supabase Inc. | Banco de dados, autenticação, tempo real |
| Provedor de e-mail (SMTP), se configurado | Enviar códigos de confirmação e recuperação |
| GitHub | Hospedar o código e os arquivos de instalação (não recebe dados de uso) |
| Google (Android) | Exibir notificações locais no seu celular |

Não vendemos nem compartilhamos dados para publicidade.

## 10. Notificações

- **Lembretes** são agendados no próprio celular.
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
