// Resumo da política de privacidade mostrado no app. O texto completo está
// em POLITICA_DE_PRIVACIDADE.md (modelo técnico inicial, sujeito a revisão jurídica).
export const PRIVACY_POLICY_VERSION = '1.0 (outubro de 2026)';

export const PRIVACY_POLICY: { title: string; body: string }[] = [
  {
    title: 'Aviso',
    body: 'Este é um modelo técnico inicial e pode precisar de revisão jurídica antes de uso público em larga escala.',
  },
  {
    title: 'Quais dados coletamos',
    body: 'Nome, e-mail, senha (guardada apenas como hash pelo provedor de autenticação), preferências (fuso, formatos, tema, notificações), agendas, eventos, comentários, lembretes, histórico de alterações e informações básicas do aparelho (modelo, sistema e versão do app) para a lista de aparelhos conectados.',
  },
  {
    title: 'Para que usamos',
    body: 'Somente para o funcionamento da agenda compartilhada: identificar você, mostrar seus compromissos às pessoas que você escolheu, enviar lembretes e manter a segurança da conta. Não vendemos dados e não usamos para publicidade.',
  },
  {
    title: 'Onde ficam',
    body: 'No banco de dados do Supabase (provedor de infraestrutura) e, em cópia, no seu aparelho para funcionar offline. A sessão de login fica no armazenamento seguro do Android.',
  },
  {
    title: 'Quem pode ver',
    body: 'Membros de uma agenda veem o nome e a cor do avatar uns dos outros, e os eventos conforme a privacidade de cada evento. Seu e-mail não é mostrado aos outros membros.',
  },
  {
    title: 'Por quanto tempo',
    body: 'Enquanto a conta existir. Itens na lixeira são apagados após 30 dias. Avisos lidos podem ser apagados após 90 dias.',
  },
  {
    title: 'Seus direitos (LGPD)',
    body: 'Você pode ver e corrigir seus dados no app, exportar tudo (Perfil > Privacidade e dados > Exportar) e excluir a conta a qualquer momento.',
  },
  {
    title: 'Exclusão da conta',
    body: 'Suas agendas pessoais e comentários são apagados. Eventos que você criou em agendas de outras pessoas continuam lá para o grupo, sem o seu nome.',
  },
  {
    title: 'Terceiros',
    body: 'Supabase (banco de dados e autenticação) e, se configurado, um serviço de envio de e-mail. Não há analytics nem rastreamento nesta versão.',
  },
  {
    title: 'Notificações',
    body: 'Lembretes são agendados no próprio aparelho. Por padrão, a tela bloqueada mostra só "Você tem um compromisso"; você pode mudar isso em Notificações.',
  },
  {
    title: 'Idade',
    body: 'O app é destinado a maiores de 18 anos ou ao uso com acompanhamento de um responsável.',
  },
];
