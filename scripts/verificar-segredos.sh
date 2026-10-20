#!/usr/bin/env bash
# Procura segredos que NUNCA deveriam estar no repositório (seção 20 do prompt).
# Uso (na raiz do projeto): bash scripts/verificar-segredos.sh
# Sai com erro (código 1) se encontrar algo suspeito.
set -euo pipefail

falhou=0

# 1) Arquivos que não podem ser versionados
proibidos=$(git ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.[^e][^x]|\.jks$|\.keystore$|\.p12$|\.p8$|\.pem$|\.key$|google-services\.json$|GoogleService-Info\.plist$|credentials\.json$' || true)
if [ -n "$proibidos" ]; then
  echo "ERRO: arquivos sensíveis versionados:"
  echo "$proibidos"
  falhou=1
fi

# 2) Padrões de chaves e tokens dentro dos arquivos versionados
padroes=(
  'sb_secret_[A-Za-z0-9_-]{10,}'                # chave secreta nova do Supabase
  'service_role["'"'"']?\s*[:=]\s*["'"'"']?eyJ'  # chave service_role antiga
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'ghp_[A-Za-z0-9]{30,}'                        # token pessoal do GitHub
  'github_pat_[A-Za-z0-9_]{30,}'
  'AKIA[0-9A-Z]{16}'                            # chave AWS
  'postgres(ql)?://[^:@/\s]+:[^@\s]+@'          # URL de banco com senha
)
for padrao in "${padroes[@]}"; do
  # git grep: código 0 = encontrou, 1 = não encontrou, outro = erro de execução.
  status=0
  achados=$(git grep -nIE -e "$padrao" -- ':!scripts/verificar-segredos.sh' ':!**/package-lock.json') || status=$?
  if [ "$status" -eq 0 ]; then
    echo "ERRO: possível segredo encontrado (padrão: $padrao):"
    echo "$achados"
    falhou=1
  elif [ "$status" -ne 1 ]; then
    echo "ERRO: falha ao procurar o padrão $padrao"
    falhou=1
  fi
done

if [ "$falhou" -eq 0 ]; then
  echo "OK: nenhum segredo encontrado nos arquivos versionados."
fi
exit "$falhou"
