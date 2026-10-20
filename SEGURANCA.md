# Segurança

## O que está implementado (seção 20 do prompt)

| Item | Como |
|---|---|
| Hash seguro de senhas | Supabase Auth (bcrypt). O app nunca grava a senha |
| Tokens seguros | JWT de curta duração (1 hora) + token de renovação com rotação (Supabase Auth) |
| Expiração e renovação de sessão | Renovação automática só com o app aberto (`startAutoRefresh`/`stopAutoRefresh`) |
| Armazenamento seguro no aparelho | Sessão no `expo-secure-store` (Android Keystore), acessível só após o primeiro desbloqueio, sem backup em nuvem |
| Validação no app e no servidor | `src/validation/*` + `CHECK`, gatilhos e funções no banco |
| Consultas parametrizadas / SQL Injection | O app usa a API do Supabase (parâmetros nunca concatenados); funções SQL usam variáveis; a busca escapa `%` e `_` |
| XSS | React Native exibe texto puro (não interpreta HTML); comentários têm caracteres de controle removidos; links só `http(s)` |
| CSRF | Não se aplica: não há cookies de sessão; cada requisição leva o token no cabeçalho |
| Limite de requisições | Supabase Auth (login, cadastro, e-mails) + limites próprios: 10 códigos de convite errados em 15 min, 30 convites por hora, 5 exportações por hora |
| Bloqueio após tentativas | App espera cada vez mais após 5 senhas erradas; servidor limita por IP |
| HTTPS | Todo acesso ao Supabase é HTTPS/WSS |
| Sem stack trace para o usuário | `ErrorBoundary` e `utils/errors.ts` mostram mensagens amigáveis |
| Logs sem dados sensíveis | `redact()` remove e-mails, tokens e senhas; o registro local não guarda payloads |
| Segregação de ambientes | Projeto Supabase de desenvolvimento local (CLI) separado do de produção; variáveis diferentes |
| Rotação de segredos | Procedimento abaixo; a chave pública pode ser trocada no painel sem mudar o código |
| Regras de acesso no banco | RLS em todas as tabelas, permissões por coluna, funções `SECURITY DEFINER` com `search_path` vazio |
| Validação de uploads, tamanho e MIME | Não há upload na V1. O desenho para anexos (futuro) prevê bucket privado, até 10 MB, só imagens e PDF |
| Limpeza de dados no logout | `endSession` apaga cache, fila, lembretes agendados e a sessão do aparelho |
| Proteção contra replay | Cada operação tem id único; o servidor guarda os ids processados e não reaplica |
| Permissões mínimas no celular | Internet, estado da rede, notificações, reinício (para lembretes) e vibração. Câmera, microfone, localização, arquivos e telefone **bloqueados** no `app.json` |

## Nunca coloque no repositório

- senha do banco;
- chave `service_role` / `secret` do Supabase;
- tokens de API e do GitHub;
- chave privada ou senha de assinatura do Android (`.jks`, `.keystore`);
- arquivo `.env` real;
- `google-services.json` e credenciais de serviços;
- certificados privados (`.p12`, `.p8`, `.pem`);
- backups do banco (contêm dados pessoais).

O `.gitignore` bloqueia esses arquivos e o workflow **Qualidade** roda `scripts/verificar-segredos.sh` a cada envio. Rode localmente antes de publicar:

```bash
# Na raiz do projeto
bash scripts/verificar-segredos.sh
```

## Política de segredos

| Segredo | Onde fica | Quem acessa |
|---|---|---|
| URL e chave pública (publishable/anon) do Supabase | `app-mobile/.env` local e **Variables** do GitHub Actions | Pública por natureza (vai dentro do APK); a proteção é o RLS |
| Chave `service_role`/`secret` | Somente no painel do Supabase | Nunca no app, nunca no GitHub |
| Senha do banco | Gerenciador de senhas pessoal | Só o proprietário |
| Keystore Android + senhas | **Secrets** do GitHub (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) + cópia offline segura | Só o proprietário |
| Credenciais de SMTP (e-mail) | Painel do Supabase > Authentication > SMTP | Só o proprietário |

Por que a chave pública pode ir no APK: ela só permite o que as regras RLS permitem a um usuário logado. Quem extrair a chave do APK consegue no máximo criar uma conta e ver os próprios dados.

## Procedimento para revogar credenciais expostas

1. **Não apague só o commit**: o histórico do Git e cópias (forks, caches) continuam com o segredo. Considere-o comprometido.
2. **Gere um novo e invalide o antigo:**
   - Chave `secret`/`service_role` do Supabase: Painel > Project Settings > API Keys > gerar nova chave secreta e **revogar** a antiga.
   - Chave pública (publishable): crie uma nova publishable key, atualize a Variable `EXPO_PUBLIC_SUPABASE_ANON_KEY`, gere novo APK, depois desative a antiga.
   - Senha do banco: Painel > Project Settings > Database > Reset database password.
   - Token do GitHub: Settings > Developer settings > Personal access tokens > Revoke.
   - Keystore Android vazada: para APKs distribuídos fora da loja, crie uma nova chave e peça para todos desinstalarem e instalarem de novo (a assinatura muda). Na Play Store, solicite a troca da chave de upload pelo Play Console.
3. Remova o segredo do código e do histórico (ex.: `git filter-repo`) e force a atualização da branch, avisando quem tiver cópias.
4. Verifique os logs do Supabase (Logs > API/Auth) em busca de acessos estranhos no período.
5. Registre o incidente (data, o que vazou, o que foi feito) em um arquivo privado fora do repositório.

## Checklist de segurança antes de publicar

- [ ] `bash scripts/verificar-segredos.sh` passou.
- [ ] Testes do banco passaram (`cd supabase && npm test`).
- [ ] Painel do Supabase > Advisors > Security sem alertas críticos.
- [ ] "Confirm email" ligado **com** SMTP próprio, ou desligado conscientemente para um grupo pequeno e conhecido.
- [ ] Senha mínima de 8 caracteres configurada no Auth (Painel > Authentication > Policies/Providers).
- [ ] APK de distribuição assinado com a **sua** chave (não a de testes).
- [ ] Keystore guardada com cópia de segurança fora do GitHub.
- [ ] Repositório sem `.env`, keystore ou backups.
- [ ] Política de privacidade revisada (é um modelo técnico inicial).

## Limitações conhecidas

- **Chave de testes no APK padrão:** sem os Secrets de assinatura, o APK usa a chave de debug do template do React Native, que é pública. Serve para testes entre pessoas conhecidas; para distribuir, configure sua chave ([GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md)).
- **E-mail:** sem SMTP próprio, a confirmação e a recuperação de senha só funcionam para e-mails da equipe do projeto no Supabase.
- **Cadastro aberto:** qualquer pessoa com o APK pode criar conta no seu projeto (só vê os próprios dados). Para fechar, desligue "Allow new users to sign up" no Supabase depois que todos tiverem conta.
- **Sem 2FA** na V1 (planejado no roadmap).
- **Dispositivo comprometido (root):** o cache local (AsyncStorage) não é criptografado; a sessão é. Em aparelho com root, os dados em cache podem ser lidos.
