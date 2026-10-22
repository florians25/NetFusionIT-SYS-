#!/usr/bin/env bash
set -euo pipefail
cd /workspace/NetFusionIT-SYS-
export NODE_ENV=development
export NPM_CONFIG_CACHE=/workspace/.npm-cache
export UI5_DATA_DIR=/workspace/.ui5-cache
node -e 'if (process.versions.node.split(".")[0] !== "24") throw new Error("Node.js 24 LTS erforderlich")'
java -version
npm ci --include=dev --no-audit --no-fund
npm run einvoice:setup
npm run build
npm run dev:setup
