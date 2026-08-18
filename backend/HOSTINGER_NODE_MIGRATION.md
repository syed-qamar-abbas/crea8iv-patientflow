# PatientFlow Hostinger Node Migration

This repository now has a production-safe Node gateway and a full Node web-app entrypoint for the first migration milestone.

## Goal

Run a Hostinger Node.js app without changing the live database or replacing the stable PHP API yet. The Node app can serve the React portal and proxy `/api/v1` to the current stable PHP API. This gives us a live Node runtime, health checks, logs, and a reversible path to move API modules one-by-one.

## Hostinger staging app

Create the first Node app as staging, not production.

### Full portal on Node, same `/clinic` links

- App type: Express.js or Other
- Root directory: repository root
- Node version: `20.x`
- Install command: `npm ci && npm --prefix backend ci`
- Build command: `npm run build:node-clinic`
- Start command: `npm run start:node-webapp`
- Health URL: `/api/v1/node-health`

Environment variables:

```text
NODE_ENV=production
PORT=<Hostinger provided port>
PORTAL_BASE_PATH=/clinic
PORTAL_DIST_DIR=dist
UPSTREAM_API_URL=https://php-api.crea8ivmedia.com
CLIENT_URL=https://portal.thesmilexperts.com
CORS_ALLOWED_ORIGINS=https://crea8ivmedia.com,https://portal.thesmilexperts.com
GATEWAY_TIMEOUT_MS=30000
GATEWAY_BODY_LIMIT_BYTES=26214400
```

### API-only gateway

Use this only if we want a separate staging API app before moving the full portal.

- App type: Express.js or Other
- Root directory: `backend`
- Node version: `20.x`
- Install command: `npm ci`
- Build command: leave empty
- Start command: `npm run start:gateway`
- Health URL: `/api/v1/node-health`

Environment variables:

```text
NODE_ENV=production
PORT=<Hostinger provided port>
UPSTREAM_API_URL=https://php-api.crea8ivmedia.com
CLIENT_URL=https://portal.thesmilexperts.com
CORS_ALLOWED_ORIGINS=https://crea8ivmedia.com,https://portal.thesmilexperts.com
GATEWAY_TIMEOUT_MS=30000
GATEWAY_BODY_LIMIT_BYTES=26214400
```

## Optional Codex Hostinger MCP config

`~/.codex/config.toml` uses TOML, not JSON. Add Hostinger MCP servers in this shape, using a real Hostinger API token:

```toml
[mcpServers.hostinger-hosting]
command = "npx"
args = ["--package=hostinger-api-mcp@latest", "hostinger-hosting-mcp"]

[mcpServers.hostinger-hosting.env]
HOSTINGER_API_TOKEN = "replace-with-real-token"

[mcpServers.hostinger-domains]
command = "npx"
args = ["--package=hostinger-api-mcp@latest", "hostinger-domains-mcp"]

[mcpServers.hostinger-domains.env]
HOSTINGER_API_TOKEN = "replace-with-real-token"

[mcpServers.hostinger-dns]
command = "npx"
args = ["--package=hostinger-api-mcp@latest", "hostinger-dns-mcp"]

[mcpServers.hostinger-dns.env]
HOSTINGER_API_TOKEN = "replace-with-real-token"
```

Only add billing, VPS, reach, or ecommerce MCP servers when that specific access is needed.

## Verification

After deployment, verify these URLs:

```text
https://<node-staging-domain>/api/v1/node-health
https://<node-staging-domain>/api/v1/health
https://<node-staging-domain>/clinic/login
```

The first endpoint proves the Node app is running. The second endpoint proves the Node app can safely reach the current PHP API. The third URL proves the React portal is being served by Node.

## Migration phases

1. Full Node web app live on staging with the same `/clinic` links.
2. Compare PHP vs Node responses for health, auth, patients, appointments, invoices, and financials.
3. Move read-only modules first, such as status and dashboard summaries.
4. Move financial and invoice modules only after parity tests match the PHP ledger results.
5. Switch frontend API URL to the Node staging app for internal testing.
6. Promote Node app to production only after rollback is confirmed.

## Rollback

No data is copied or deleted in this milestone. If staging fails, remove the Node app or point the frontend back to `https://crea8ivmedia.com/app/api/v1`.
