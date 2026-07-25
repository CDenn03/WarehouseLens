#!/usr/bin/env bash
# configure-keycloak-client.sh — Register logout redirect URIs for the frontend client.
#
# Run after `docker compose up -d keycloak` is healthy.  Idempotent — safe to re-run.
#
# Usage:
#   ./scripts/configure-keycloak-client.sh
#
# Requires: curl, python3 (for JSON parsing)

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-warehouselens}"
CLIENT_ID="${KEYCLOAK_FRONTEND_CLIENT:-warehouselens-frontend}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REDIRECT_URIS="${LOGOUT_REDIRECT_URIS:-http://localhost:3000/*}"

echo "→ Obtaining admin access token …"
TOKEN=$(curl -sf -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASS}&grant_type=password&client_id=admin-cli" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "→ Looking up client '${CLIENT_ID}' in realm '${REALM}' …"
CLIENT_UUID=$(curl -sf "${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import sys, json
clients = json.load(sys.stdin)
for c in clients:
    if c.get('clientId') == '${CLIENT_ID}':
        print(c['id']); break
else:
    print('NOT_FOUND')
")

if [ "$CLIENT_UUID" = "NOT_FOUND" ]; then
  echo "✗ Client '${CLIENT_ID}' not found in realm '${REALM}'."
  echo "  Create it first via the Keycloak admin console or the Admin API."
  exit 1
fi

echo "→ Updating client ${CLIENT_UUID} …"

# Build JSON payload with post-logout redirect URIs.
REDIRECT_JSON=$(python3 -c "
import json, sys
uris = '${REDIRECT_URIS}'.split(',')
print(json.dumps(uris))
")

curl -sf -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"attributes\": {
      \"post.logout.redirect.uris\": \"${REDIRECT_URIS}\"
    },
    \"frontchannelLogout\": true
  }" \
  && echo "✓ Client updated: post_logout_redirect_uris = ${REDIRECT_URIS}" \
  || echo "✗ Failed to update client"
