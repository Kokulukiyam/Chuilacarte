#!/bin/sh
# Build de production isolé servi sur un port de test, pour les tests automatisés.
# Usage : scripts/test-server.sh [port]   (défaut 3100 ; dossier de build .next-test-<port>)
set -e
cd "$(dirname "$0")/.."
PORT="${1:-3100}"
DIST=".next-test-$PORT"
fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 1
NEXT_DIST_DIR="$DIST" npx next build > "/tmp/chuilacarte-build-$PORT.log" 2>&1 || { tail -40 "/tmp/chuilacarte-build-$PORT.log"; exit 1; }
NEXT_DIST_DIR="$DIST" nohup npx next start -p "$PORT" > "/tmp/chuilacarte-test-server-$PORT.log" 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null "localhost:$PORT/api/config" && break; sleep 1; done
echo "serveur de test prêt sur http://localhost:$PORT"
