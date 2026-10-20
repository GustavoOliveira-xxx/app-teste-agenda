# Checklist final

Situação real de cada item pedido no prompt (seções 38 e 40), conferida em **20/10/2026**. Nada aqui foi marcado como concluído sem verificação.

## Legenda

| Status | Significado |
|---|---|
| ✅ **Concluído** | Feito e verificado (teste automático, build no GitHub ou conferência do arquivo) |
| 🟡 **Parcialmente concluído** | Feito no código e verificado em parte; falta uma verificação ou um pedaço |
| ⏳ **Pendente** | Ainda não feito |
| ⛔ **Bloqueado** | Depende de algo fora do código (conta, pagamento, decisão do proprietário) |

**Como cada item foi verificado:**

- **Banco:** 69 testes de integração com o banco real (PGlite com as migrations), simulando cada pessoa logada ([docs/TESTES.md](docs/TESTES.md)).
- **App:** 73 testes unitários (datas, recorrência, permissões, filtros, erros, validações, fila offline, lembretes).
- **Telas:** 5 testes que abrem a versão web do app num navegador e percorrem as telas com as contas de demonstração, contra o banco real (pasta `e2e/`).
- **APK:** gerado no GitHub Actions (build 4: APK de 48 MB e AAB de 37 MB, apenas as 8 permissões aprovadas).

O que **nenhuma** verificação cobriu ainda: o app instalado num celular Android ligado ao Supabase de verdade. Isso depende de reativar o servidor (item B1 abaixo) e seguir o roteiro manual.

## Bloqueio principal

| # | Item | Status | Motivo | Risco | Próximo passo |
|---|---|---|---|---|---|
| B1 | Servidor Supabase ativo | ⛔ Bloqueado | A conta já tem 2 projetos gratuitos ativos (limite do plano), em organizações que a ferramenta não alcança; o projeto do app está pausado e a reativação foi recusada pelo Supabase | Sem servidor, o APK abre mas não consegue criar conta nem entrar | Pausar um projeto antigo e reativar o do app (5 minutos), aplicar as 6 migrations e cadastrar as 2 Variables no GitHub: [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md) partes 1 e 2 |

## Critérios de aceitação (seção 38)

| # | Critério | Status | Como foi verificado | Se não concluído: motivo, risco e próximo passo |
|---|---|---|---|---|
| 1 | O aplicativo abre sem erros | 🟡 Parcial | Versão web abre e percorre 16 telas sem nenhum erro de JavaScript (testes de tela); APK compila | **Motivo:** o APK não foi aberto num celular. **Risco:** erro nativo só no Android. **Próximo passo:** instalar o APK (COMO_INSTALAR.md) |
| 2 | Criar conta | 🟡 Parcial | Banco: perfil, preferências e "Minha agenda" criados no cadastro (teste); validação do formulário (teste) | **Motivo:** o cadastro em si é feito pelo Supabase Auth, que só existe no servidor real (B1). **Próximo passo:** roteiro manual M01 |
| 3 | Fazer login | 🟡 Parcial | Tela de login testada na versão web (entrada correta e senha errada com mensagem clara) | **Motivo:** feito contra o servidor de testes, não o Supabase Auth real (B1). **Próximo passo:** M02 |
| 4 | Sair | 🟡 Parcial | Código apaga sessão, cache, fila e lembretes (`services/session.ts`) | **Motivo:** sem teste automático. **Próximo passo:** M02 |
| 5 | Recuperar acesso | 🟡 Parcial | Telas e fluxo por código de 6 dígitos implementados; modelos de e-mail prontos | **Motivo:** depende do envio de e-mail pelo Supabase (B1) e, para qualquer pessoa, de SMTP próprio. **Risco:** sem SMTP, só e-mails da equipe recebem o código. **Próximo passo:** GUIA_DE_DEPLOY 1.4 e M02 |
| 6 | Criar agenda | ✅ Concluído | Banco: criação, um único proprietário, o app não escolhe outro dono (testes); tela de agendas na versão web | |
| 7 | Editar agenda | ✅ Concluído | Banco: administrador edita configurações comuns, só o proprietário as exclusivas; arquivar, lixeira, restaurar, duplicar (testes) | |
| 8 | Convidar outra pessoa | ✅ Concluído | Banco: código guardado só como hash, prévia com agenda e papel, validade, usos, e-mail, limite de tentativas (14 testes); tela gera o código (teste de tela) | |
| 9 | A outra pessoa aceitar | ✅ Concluído | Banco: aceitar dá o papel certo, idempotente, convite cancelado/expirado/esgotado recusado (testes) | A tela de aceitar ainda não foi exercitada num celular (M05) |
| 10 | Permissões funcionarem | ✅ Concluído | Banco: 5 papéis, ninguém eleva o próprio papel, visualizador não cria, colaborador edita só os seus (testes); app espelha as regras (testes) | |
| 11 | Usuário removido perder acesso | ✅ Concluído | Banco: remoção revoga na hora e para os avisos (testes) | |
| 12 | Eventos criados | ✅ Concluído | Banco: criação, autor sempre quem está logado, reenvio não duplica (testes); formulário abre na versão web | |
| 13 | Eventos editados | ✅ Concluído | Banco: edição com versão, conflito quando duas pessoas editam (testes); mesclagem automática no app (testes) | |
| 14 | Eventos excluídos | ✅ Concluído | Banco: exclusão lógica, restauração, reenvio idempotente (testes) | |
| 15 | Recorrência conforme escopo | ✅ Concluído | App: 18 testes (diária a anual, dia 31, horário de verão, exceções); banco: "só este" e "este e os próximos" (testes) | |
| 16 | Lembretes conforme escopo | 🟡 Parcial | Cálculo de quais lembretes agendar (5 testes), horário de silêncio (teste), lembretes pessoais no banco (teste) | **Motivo:** a entrega pelo Android (`expo-notifications`) só pode ser vista num celular. **Risco:** fabricantes que encerram apps em segundo plano. **Próximo passo:** M10 |
| 17 | Filtros funcionarem | ✅ Concluído | App: filtros por agenda, tipo, status, participante, cor, privacidade, recorrência e período (testes); tela abre na versão web | |
| 18 | Busca respeitar permissões | ✅ Concluído | Banco: busca não retorna o que a pessoa não pode ver e trata caracteres especiais (teste) | |
| 19 | Offline não perder alterações | 🟡 Parcial | Fila: gravação, coalescência, novas tentativas, app fechado durante envio (13 testes) | **Motivo:** o ciclo completo celular, rede, servidor (`syncEngine.ts`) não tem teste automático. **Próximo passo:** M11 |
| 20 | Sincronização lidar com reconexão | 🟡 Parcial | Novas tentativas com espera crescente (testes); sincroniza ao voltar a internet (código) | Mesmo motivo do item 19. M11 |
| 21 | Conflitos detectados ou tratados | ✅ Concluído | Banco: conflito por versão, exclusão concorrente (testes); app: mesclagem por campo e tela de resolução (testes da mesclagem) | |
| 22 | Dados privados não vazarem | ✅ Concluído | Banco: privado, só participantes, ocupado, histórico sem título, avisos (testes); tela: visualizador vê "Ocupado" e não vê o privado (teste de tela) | Cache do aparelho não é criptografado (limitação documentada em SEGURANCA.md) |
| 23 | Mensagens de erro compreensíveis | ✅ Concluído | Tradução de erros técnicos para mensagens em português (testes); senha errada na tela (teste de tela) | |
| 24 | Testes principais passarem | ✅ Concluído | 147 testes passando localmente e no GitHub Actions | |
| 25 | Documentação existir | ✅ Concluído | Os 13 documentos obrigatórios e mais 6 (lista abaixo) | |
| 26 | APK puder ser gerado | ✅ Concluído | Workflow "Gerar APK Android": build 4 aprovado, APK 48 MB, AAB 37 MB | Assinado com a chave de testes até a parte 3 do GUIA_DE_DEPLOY |
| 27 | Instalação documentada | ✅ Concluído | [COMO_INSTALAR.md](COMO_INSTALAR.md): opções A e B, 8 passos, riscos, atualizar, desinstalar, problemas comuns | |
| 28 | GitHub preparado | ✅ Concluído | Workflows Qualidade e Gerar APK Android, `.gitignore`, `.env.example`, licença MIT, README | |
| 29 | Nenhum segredo versionado | ✅ Concluído | `scripts/verificar-segredos.sh` local e no CI a cada envio; nenhum `.env`, chave ou keystore no repositório | |
| 30 | Autoria configurada | ✅ Concluído | Todos os commits com autor Gustavo Oliveira dos Santos; licença em nome do proprietário | O assistente aparece só como coautor técnico na mensagem do commit |

**Resumo:** 22 concluídos, 8 parcialmente concluídos, 0 pendentes. Os parciais dependem quase todos do mesmo bloqueio (B1) e do roteiro manual num celular.

## Entregáveis finais (seção 40)

| Entregável | Status | Onde |
|---|---|---|
| Aplicativo mobile completo | 🟡 Parcial | `app-mobile/`. Todas as telas da seção 23 existem; semana e dia são listas, sem grade de horários ([docs/TELAS.md](docs/TELAS.md)) |
| Backend completo | ✅ Concluído | `supabase/migrations/` (tabelas, regras de acesso, funções, gatilhos, auditoria) |
| Banco ou configuração do serviço gerenciado | ⛔ Bloqueado | Configuração descrita no GUIA_DE_DEPLOY; aplicação no projeto real depende de B1 |
| Migrations | ✅ Concluído | 6 arquivos em `supabase/migrations/` |
| Seeds | ✅ Concluído | `supabase/seed.sql` (dados fictícios; não roda em banco com usuários) |
| Modelo de dados | ✅ Concluído | [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md) |
| Testes | ✅ Concluído | `supabase/tests/`, `app-mobile/src/**/__tests__/`, `e2e/` |
| Configuração de ambiente | ✅ Concluído | `app-mobile/.env.example`, [GUIA_DE_DESENVOLVIMENTO.md](GUIA_DE_DESENVOLVIMENTO.md) |
| `.env.example` | ✅ Concluído | Raiz e `app-mobile/` |
| `.gitignore` | ✅ Concluído | Raiz, `app-mobile/`, `supabase/`, `e2e/` |
| Documentação completa | ✅ Concluído | Lista abaixo |
| Política inicial de privacidade | ✅ Concluído | [POLITICA_DE_PRIVACIDADE.md](POLITICA_DE_PRIVACIDADE.md) e no app. Modelo técnico: precisa de revisão jurídica e de um e-mail de contato |
| APK | 🟡 Parcial | Gerado no Actions (Artifacts). Ainda não publicado em Releases: faz mais sentido publicar depois de ligar o servidor (B1), senão o APK abre em "Servidor não configurado" |
| AAB | ✅ Concluído | Gerado junto com o APK |
| Instruções de instalação | ✅ Concluído | [COMO_INSTALAR.md](COMO_INSTALAR.md) |
| Instruções de atualização | ✅ Concluído | COMO_INSTALAR.md ("Como atualizar") e GUIA_DE_DEPLOY.md (parte 4) |
| Instruções de publicação | ✅ Concluído | GUIA_DE_DEPLOY.md (partes 2, 5 e 6) |
| Configuração de CI/CD | ✅ Concluído | `.github/workflows/qualidade.yml` e `android.yml` |
| Link do GitHub | ✅ Concluído | <https://github.com/GustavoOliveira-xxx/app-teste-agenda> |
| Checklist final | ✅ Concluído | Este arquivo |
| Limitações conhecidas | ✅ Concluído | [README.md](README.md#limitações-conhecidas) e cada documento |
| Roadmap | ✅ Concluído | [ROADMAP.md](ROADMAP.md) |

## Documentos

| Obrigatórios (seção 36) | Extras |
|---|---|
| [README.md](README.md), [COMO_INSTALAR.md](COMO_INSTALAR.md), [ARQUITETURA.md](ARQUITETURA.md), [DECISOES.md](DECISOES.md), [REGRAS_DE_NEGOCIO.md](REGRAS_DE_NEGOCIO.md), [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md), [SEGURANCA.md](SEGURANCA.md), [POLITICA_DE_PRIVACIDADE.md](POLITICA_DE_PRIVACIDADE.md), [GUIA_DE_DESENVOLVIMENTO.md](GUIA_DE_DESENVOLVIMENTO.md), [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [ROADMAP.md](ROADMAP.md), [CHANGELOG.md](CHANGELOG.md) | [PLANEJAMENTO.md](PLANEJAMENTO.md), [CHECKLIST.md](CHECKLIST.md), [docs/TELAS.md](docs/TELAS.md), [docs/DESIGN.md](docs/DESIGN.md), [docs/ACESSIBILIDADE.md](docs/ACESSIBILIDADE.md), [docs/TESTES.md](docs/TESTES.md) |

## Outros pontos parciais que não bloqueiam o uso

| Item | Motivo | Risco | Próximo passo |
|---|---|---|---|
| Chave de assinatura própria | Precisa ser criada e guardada pelo proprietário (não pode ser gerada e guardada por terceiros) | APK de testes usa chave pública: outra pessoa poderia publicar uma "atualização" falsa | GUIA_DE_DEPLOY parte 3 |
| E-mail (SMTP) | Escolha e cadastro de um provedor de e-mail são do proprietário | Recuperação de senha não chega para todos | GUIA_DE_DEPLOY 1.4 |
| E-mail de contato da política de privacidade | Decisão do proprietário | Política incompleta para a Play Store | Definir e preencher em POLITICA_DE_PRIVACIDADE.md (a política dentro do app aponta para esse arquivo) |
| Calendário semanal e diário com grade de horários | Escolha de escopo: listas por dia são mais simples e acessíveis | Menos visual para quem tem muitos eventos no mesmo dia | ROADMAP |
| Acessibilidade com TalkBack | Precisa de celular físico | Problemas só percebidos com leitor de tela | Roteiro em [docs/ACESSIBILIDADE.md](docs/ACESSIBILIDADE.md) |
| iOS | Exige conta Apple paga | Nenhum para Android | GUIA_DE_DEPLOY parte 6 |
| Play Store | Exige conta Google paga e teste fechado | Nenhum para distribuição por APK | GUIA_DE_DEPLOY parte 5 |
