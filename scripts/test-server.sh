#!/bin/sh
# Build de production isolé (dossier .next-test) servi sur le port 3100, pour les tests automatisés.
set -e
cd "$(dirname "$0")/.."
pkill -f "next start -p 3100" 2>/dev/null || true
fuser -k 3100/tcp 2>/dev/null || true
sleep 1
NEXT_DIST_DIR=.next-test npx next build > /tmp/chuilacarte-build.log 2>&1 || { tail -40 /tmp/chuilacarte-build.log; exit 1; }
NEXT_DIST_DIR=.next-test nohup npx next start -p 3100 > /tmp/chuilacarte-test-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3100/api/config && break; sleep 1; done
echo "serveur de test prêt sur http://localhost:3100"
