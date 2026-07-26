#!/bin/sh
# Container entrypoint: optionally migrate, then exec the real command.
#
# Migrations are opt-in via RUN_MIGRATIONS=1 rather than unconditional, because
# the backend and the worker share this image.  If both ran `alembic upgrade
# head` on boot they would race for the same DDL lock, and whichever lost could
# fail its healthcheck.  Only the backend sets the flag.
#
# Production deploys should leave RUN_MIGRATIONS unset and run migrations as a
# deliberate step, so a schema change is never applied by whichever replica
# happens to start first.
set -e

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "entrypoint: applying database migrations..."
  alembic upgrade head
  echo "entrypoint: migrations up to date."
fi

exec "$@"
