#!/bin/sh
# Ponto de entrada da imagem: aplica as migrações (idempotentes) e sobe o servidor.
# Se a migração falhar, o contêiner sai com erro e nunca fica saudável.
set -eu

node dist/migrar.js
exec node server.js
