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

# Sem --exit-on-error: o --clean --if-exists pode avisar de objetos que não
# existem num banco vazio; o verificador é quem decide se o resultado serve.
pg_restore --no-owner --clean --if-exists --dbname "$url" "$dump"

if [ -f dist/verificar-restauracao.js ]; then
  node dist/verificar-restauracao.js "$url"
else
  pnpm backup:verificar -- "$url"
fi
