require('dotenv').config();

const http = require('http');
const https = require('https');
const express = require('express');
const helmet = require('helmet');

const DEFAULT_UPSTREAM = 'https://php-api.crea8ivmedia.com';
const UPSTREAM_API_URL = (process.env.UPSTREAM_API_URL || DEFAULT_UPSTREAM).replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS || 30000);
const BODY_LIMIT_BYTES = Number(process.env.GATEWAY_BODY_LIMIT_BYTES || 25 * 1024 * 1024);

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

function parseAllowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    'https://crea8ivmedia.com',
    'https://portal.thesmilexperts.com',
    'http://localhost:5173',
    'http://localhost:5174',
    ...configured,
  ]);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (parseAllowedOrigins().has(origin)) return true;

  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'crea8ivmedia.com'
      || host.endsWith('.crea8ivmedia.com')
      || host === 'crea8ivpatientflow.com'
      || host.endsWith('.crea8ivpatientflow.com');
  } catch (error) {
    return false;
  }
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const fallbackOrigin = process.env.CLIENT_URL || 'https://portal.thesmilexperts.com';

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

function pipeUpstreamResponse(upstreamRes, res) {
  res.statusCode = upstreamRes.statusCode || 502;

  for (const [key, value] of Object.entries(upstreamRes.headers)) {
    if (!['connection', 'keep-alive', 'transfer-encoding'].includes(key.toLowerCase()) && value !== undefined) {
      res.setHeader(key, value);
    }
  }

  res.setHeader('x-patientflow-served-by', 'node-gateway');
  upstreamRes.pipe(res);
}

app.use('/api/v1', (req, res) => {
  const targetUrl = new URL(req.originalUrl, `${UPSTREAM_API_URL}/`);
  const client = targetUrl.protocol === 'https:' ? https : http;

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
    timeout: REQUEST_TIMEOUT_MS,
  }, (upstreamRes) => pipeUpstreamResponse(upstreamRes, res));

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Upstream request timed out'));
  });

  proxyReq.on('error', (error) => {
    if (res.headersSent) {
      res.end();
      return;
    }

    const isBodyLimit = error.message === 'Request body too large';
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
