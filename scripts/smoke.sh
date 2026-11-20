#!/usr/bin/env bash
# Teste de fumaça da imagem: sobe Postgres + imagem numa rede temporária,
# migra, sobe a aplicação e confere /api/saude.
# Uso: scripts/smoke.sh <imagem>
set -euo pipefail

imagem="${1:?Uso: scripts/smoke.sh <imagem>}"
sufixo="$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')"
rede="smoke-rede-${sufixo}"
banco="smoke-pg-${sufixo}"
app="smoke-app-${sufixo}"
esperado='{"status":"ok","banco":"ok"}'
senha="smoke-${sufixo}"
url="postgres://postgres:${senha}@${banco}:5432/postgres"

limpar() {
  docker rm -f "$app" "$banco" >/dev/null 2>&1 || true
  docker network rm "$rede" >/dev/null 2>&1 || true
}
trap limpar EXIT

docker network create "$rede" >/dev/null
docker run -d --name "$banco" --network "$rede" \
  -e POSTGRES_PASSWORD="$senha" postgres:17 >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$banco" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
    pronto=1
    break
  fi
  sleep 1
done
[ "${pronto:-0}" = 1 ] || { echo "Postgres não ficou pronto." >&2; exit 1; }

# O Postgres reinicia ao fim da inicialização; tenta a migração algumas vezes.
migrou=0
for _ in $(seq 1 5); do
  if docker run --rm --network "$rede" -e DATABASE_URL="$url" \
    "$imagem" node dist/migrar.js >&2; then
    migrou=1
    break
  fi
  sleep 2
done
[ "$migrou" = 1 ] || { echo "Migração falhou." >&2; exit 1; }

docker run -d --name "$app" --network "$rede" \
  -e DATABASE_URL="$url" \
  -e BETTER_AUTH_SECRET="smoke-segredo-com-pelo-menos-32-caracteres-${sufixo}" \
  -e BETTER_AUTH_URL="http://localhost:3000" \
  "$imagem" >/dev/null

corpo=""
for _ in $(seq 1 30); do
  corpo="$(docker exec "$app" node -e \
    'fetch("http://localhost:3000/api/saude").then(r=>r.text()).then(t=>process.stdout.write(t)).catch(()=>process.exit(1))' \
    2>/dev/null || true)"
  [ "$corpo" = "$esperado" ] && break
  sleep 1
done

if [ "$corpo" != "$esperado" ]; then
  docker logs "$app" >&2 || true
fi
echo "$corpo"
[ "$corpo" = "$esperado" ]
