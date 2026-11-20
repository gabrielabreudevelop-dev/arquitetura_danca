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

# Sem --exit-on-error: o pg_restore pode terminar com erros não fatais (por
# exemplo, extensões ou objetos que o banco de destino não tem) e ainda
# restaurar o essencial. O verificador é quem decide se o resultado serve; leia
# as mensagens do pg_restore acima dele.
pg_restore --no-owner --clean --if-exists --dbname "$url" "$dump"

if [ -f dist/verificar-restauracao.js ]; then
  echo "Verificando com: node dist/verificar-restauracao.js"
  node dist/verificar-restauracao.js "$url"
else
  echo "Verificando com: pnpm backup:verificar"
  pnpm backup:verificar -- "$url"
fi
