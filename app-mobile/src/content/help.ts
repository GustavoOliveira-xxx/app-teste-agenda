// Perguntas frequentes exibidas na tela de Ajuda.
export const HELP_TOPICS: { question: string; answer: string }[] = [
  {
    question: 'Como convido alguém para a minha agenda?',
    answer:
      'Abra a aba Agendas, toque na agenda e em "Convidar pessoas". Escolha o papel e toque em "Gerar convite". Envie o código pelo WhatsApp (botão Compartilhar). A outra pessoa instala o app, cria a conta e toca em "Entrar com código de convite".',
  },
  {
    question: 'Qual a diferença entre os papéis?',
    answer:
      'Proprietário controla tudo. Administrador gerencia membros e eventos. Editor cria e edita eventos. Colaborador cria eventos e edita só os seus. Visualizador apenas vê.',
  },
  {
    question: 'Posso usar sem internet?',
    answer:
      'Sim. Você vê os eventos já sincronizados e pode criar, editar e excluir eventos. As alterações ficam guardadas no aparelho e são enviadas quando a internet voltar. Convites, membros e configurações precisam de internet.',
  },
  {
    question: 'O que é um "conflito"?',
    answer:
      'Quando você e outra pessoa alteram o mesmo evento ao mesmo tempo. Se mudaram coisas diferentes, o app junta tudo sozinho. Se mudaram a mesma coisa, ele pergunta qual versão manter (Perfil > Sincronização).',
  },
  {
    question: 'Os lembretes não tocam. O que fazer?',
    answer:
      'Confira em Perfil > Notificações se a permissão está "Permitida". No Android, desative a economia de bateria para o app (Configurações do Android > Apps > SynCK > Bateria > Sem restrições).',
  },
  {
    question: 'Como funciona um evento que se repete?',
    answer:
      'Ao criar, escolha em "Repetir" (ex.: toda semana). Ao editar ou excluir, o app pergunta se é só aquela ocorrência, aquela e as próximas, ou a série inteira.',
  },
  {
    question: 'Quem vê meus eventos privados?',
    answer:
      '"Privado" só você vê. "Ocupado" os outros veem só o horário. "Só participantes" apenas as pessoas escolhidas, o proprietário e os administradores.',
  },
  {
    question: 'Como saio de uma agenda?',
    answer:
      'Abra a agenda e toque em "Sair da agenda". Se você for o proprietário, primeiro transfira a propriedade para outra pessoa (Membros > pessoa > Tornar proprietário).',
  },
  {
    question: 'Esqueci minha senha.',
    answer:
      'Na tela de entrada toque em "Esqueci minha senha", informe o e-mail e digite o código recebido. Se o e-mail não chegar, olhe o spam e veja o TROUBLESHOOTING.md do projeto.',
  },
];
