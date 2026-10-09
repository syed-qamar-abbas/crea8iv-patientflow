require('dotenv').config();

const http = require('http');
const https = require('https');
const express = require('express');
const helmet = require('helmet');

const DEFAULT_UPSTREAM = 'https://php-api.crea8ivmedia.com';
const UPSTREAM_API_URL = (process.env.UPSTREAM_API_URL || DEFAULT_UPSTREAM).replace(/\/+$/, '');
const CANONICAL_PATIENTFLOW_ORIGIN = normalizeOrigin(process.env.PATIENTFLOW_CANONICAL_ORIGIN, 'https://patientflow.crea8ivmedia.com');
const LEGACY_PATIENTFLOW_HOSTS = parseLegacyPatientflowHosts();
const REQUEST_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS || 30000);
const BODY_LIMIT_BYTES = Number(process.env.GATEWAY_BODY_LIMIT_BYTES || 25 * 1024 * 1024);
const HTTP_AGENT = new http.Agent({
  keepAlive: true,
  maxSockets: Number(process.env.GATEWAY_MAX_SOCKETS || 80),
  keepAliveMsecs: Number(process.env.GATEWAY_KEEP_ALIVE_MS || 10000),
});
const HTTPS_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: Number(process.env.GATEWAY_MAX_SOCKETS || 80),
  keepAliveMsecs: Number(process.env.GATEWAY_KEEP_ALIVE_MS || 10000),
});

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(redirectLegacyPatientflowHost);

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeOrigin(value, fallback) {
  const raw = normalizeUrl(value || fallback);
  if (!raw) return fallback;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function parseLegacyPatientflowHosts() {
  const canonicalHost = new URL(CANONICAL_PATIENTFLOW_ORIGIN).hostname.toLowerCase();
  return new Set([
    'portal.thesmilexperts.com',
    'portal.smileexperts.com',
    ...(process.env.PATIENTFLOW_LEGACY_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ].filter((host) => host && host !== canonicalHost));
}

function isLegacyPatientflowOrigin(origin) {
  try {
    return LEGACY_PATIENTFLOW_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch (error) {
    return false;
  }
}

function redirectLegacyPatientflowHost(req, res, next) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  if (!LEGACY_PATIENTFLOW_HOSTS.has(host)) {
    next();
    return;
  }

  const target = new URL(req.originalUrl || req.url || '/', CANONICAL_PATIENTFLOW_ORIGIN);
  res.redirect(308, target.toString());
}

function parseAllowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && !isLegacyPatientflowOrigin(origin));

  return new Set([
    'https://crea8ivmedia.com',
    CANONICAL_PATIENTFLOW_ORIGIN,
    'https://venndental.com',
    'https://www.venndental.com',
    'http://localhost:5173',
    'http://localhost:5174',
    ...configured,
  ]);
}
const ALLOWED_ORIGINS = parseAllowedOrigins();

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'crea8ivmedia.com'
      || host.endsWith('.crea8ivmedia.com')
      || host === 'crea8ivpatientflow.com'
      || host.endsWith('.crea8ivpatientflow.com')
      || host === 'venndental.com'
      || host === 'www.venndental.com';
  } catch (error) {
    return false;
  }
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const fallbackOrigin = process.env.CLIENT_URL || CANONICAL_PATIENTFLOW_ORIGIN;

  res.setHeader('Access-Control-Allow-Origin', isOriginAllowed(origin) ? origin : fallbackOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

app.use((req, res, next) => {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.get('/api/v1/node-health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'node-gateway',
    upstream: new URL(UPSTREAM_API_URL).host,
    canonicalHost: new URL(CANONICAL_PATIENTFLOW_ORIGIN).hostname.toLowerCase(),
    legacyHostsRedirected: Array.from(LEGACY_PATIENTFLOW_HOSTS),
    timestamp: new Date().toISOString(),
  });
});

function buildProxyHeaders(req, targetUrl) {
  const hopByHopHeaders = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'host',
  ]);

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  headers.host = targetUrl.host;
  headers['x-forwarded-host'] = req.headers.host || '';
  headers['x-forwarded-proto'] = req.protocol || 'https';
  headers['x-patientflow-node-gateway'] = '1';
  return headers;
}

function pipeUpstreamResponse(req, upstreamRes, res) {
  const startedAt = req.patientflowStartedAt || process.hrtime.bigint();
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  res.statusCode = upstreamRes.statusCode || 502;

  for (const [key, value] of Object.entries(upstreamRes.headers)) {
    if (!['connection', 'keep-alive', 'transfer-encoding'].includes(key.toLowerCase()) && value !== undefined) {
      res.setHeader(key, value);
    }
  }

  res.setHeader('x-patientflow-served-by', 'node-gateway');
  res.setHeader('x-patientflow-proxy-ms', durationMs.toFixed(1));
  res.setHeader('Server-Timing', `pfproxy;dur=${durationMs.toFixed(1)}`);
  upstreamRes.pipe(res);
}

app.use('/api/v1', (req, res) => {
  req.patientflowStartedAt = process.hrtime.bigint();
  const targetUrl = new URL(req.originalUrl, `${UPSTREAM_API_URL}/`);
  const client = targetUrl.protocol === 'https:' ? https : http;
  const agent = targetUrl.protocol === 'https:' ? HTTPS_AGENT : HTTP_AGENT;

  let bytesReceived = 0;
  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
    if (bytesReceived > BODY_LIMIT_BYTES) {
      req.destroy(new Error('Request body too large'));
    }
  });

  const proxyReq = client.request({
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || undefined,
    method: req.method,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers: buildProxyHeaders(req, targetUrl),
    agent,
    timeout: REQUEST_TIMEOUT_MS,
  }, (upstreamRes) => pipeUpstreamResponse(req, upstreamRes, res));

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Upstream request timed out'));
  });

  proxyReq.on('error', (error) => {
    if (res.headersSent) {
      res.end();
      return;
    }

    const isBodyLimit = error.message === 'Request body too large';
    const durationMs = Number(process.hrtime.bigint() - req.patientflowStartedAt) / 1e6;
    res.setHeader('x-patientflow-proxy-ms', durationMs.toFixed(1));
    res.setHeader('Server-Timing', `pfproxy;dur=${durationMs.toFixed(1)}`);
    res.status(isBodyLimit ? 413 : 502).json({
      error: isBodyLimit ? 'Request body too large' : 'Upstream API unavailable',
      code: isBodyLimit ? 'body_too_large' : 'upstream_unavailable',
    });
  });

  req.pipe(proxyReq);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
