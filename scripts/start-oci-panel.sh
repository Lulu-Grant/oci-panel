#!/bin/zsh
set -euo pipefail

APP_DIR="/Users/apple/.openclaw/workspace/oci-panel"
LOG_DIR="$APP_DIR/.runtime"
mkdir -p "$LOG_DIR"

cd "$APP_DIR"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOSTNAME="0.0.0.0"
export PORT="3000"
export NODE_ENV="production"

npm run start >> "$LOG_DIR/oci-panel.out.log" 2>> "$LOG_DIR/oci-panel.err.log"
