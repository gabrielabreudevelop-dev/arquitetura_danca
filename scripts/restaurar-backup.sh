#!/usr/bin/env bash
# Restaura um dump do Postgres (formato custom, .dmp) num banco VAZIO e
# confere o resultado com o verificador.
# Uso: scripts/restaurar-backup.sh <arquivo.dmp> <url-do-banco-vazio>
# Atenção: a versão do pg_restore deve ser igual ou maior que a do servidor
# que gerou o dump (produção usa Postgres 17).
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Uso: $0 <arquivo.dmp> <url-do-banco-vazio>" >&2
  exit 2
fi

dump="$1"
url="$2"

[ -f "$dump" ] || { echo "Arquivo de dump não encontrado: $dump" >&2; exit 2; }
[ -n "$url" ] || { echo "URL do banco não informada." >&2; exit 2; }

# Roda sempre da raiz do projeto: o verificador lê drizzle/meta/_journal.json.
cd "$(dirname "$0")/.."

# Recusa alvo que já tenha tabelas: a restauração só vale num banco vazio.
tabelas="$(psql "$url" -v ON_ERROR_STOP=1 -tA \
  -c "select count(*) from information_schema.tables where table_schema = 'public'")" \
  || { echo "Não foi possível consultar o banco de destino." >&2; exit 2; }
if [ "$tabelas" != "0" ]; then
  echo "O banco de destino não está vazio (${tabelas} tabela(s) no schema public). Use um banco novo e vazio." >&2
  exit 2
fi

# Sem --exit-on-error e sem --clean: o pg_restore pode sair com código 1 por
# erros não fatais (objetos ignorados) e ainda restaurar o essencial. O
# verificador decide se o resultado serve; o código de saída dele é o do script.
if ! pg_restore --no-owner --no-privileges --dbname "$url" "$dump"; then
  echo "pg_restore terminou com erros; o verificador decide se a restauração vale." >&2
fi

if [ -f package.json ] && command -v pnpm >/dev/null 2>&1; then
  echo "Verificando com: pnpm backup:verificar --"
  exec pnpm backup:verificar -- "$url"
else
  echo "Verificando com: node dist/verificar-restauracao.js"
  exec node dist/verificar-restauracao.js "$url"
fi
