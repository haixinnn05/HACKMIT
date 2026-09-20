#!/bin/sh
# Hosts such as Railway mount the data disk owned by root. Take ownership of it
# once, then run the server as an unprivileged user.
set -e
DIR="$(dirname "${MOZAIC_DB:-/data/mozaic.db}")"
mkdir -p "$DIR"
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DIR"
  exec runuser -u node -- "$@"
fi
exec "$@"
