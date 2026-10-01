require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const VERIFIED_PATIENTFLOW_UPSTREAM = 'https://restore-api.crea8ivmedia.com/api/v1';
const LEGACY_DAC_COMPAT_UPSTREAMS = new Set([
  'https://crea8ivmedia-com-356543.hostingersite.com/api/v1',
  'https://php-api.crea8ivmedia.com/api/v1',
]);
const DEFAULT_UPSTREAM = VERIFIED_PATIENTFLOW_UPSTREAM;
const DEFAULT_PORTAL_BASE_PATH = '/';
const UPSTREAM_API_URL = resolveUpstreamApiUrl();
const REQUEST_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS || 30000);
const BODY_LIMIT_BYTES = Number(process.env.GATEWAY_BODY_LIMIT_BYTES || 25 * 1024 * 1024);
const PORTAL_BASE_PATH = normalizeBasePath(process.env.PORTAL_BASE_PATH || DEFAULT_PORTAL_BASE_PATH);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = resolveDistDir();
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const PORT = process.env.PORT || 4000;
const CORS_RESPONSE_HEADER_NAMES = new Set([
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-expose-headers',
  'access-control-max-age',
  'vary',
]);
const ALLOWED_ORIGINS = parseAllowedOrigins();
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
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

function normalizeBasePath(value) {
  const trimmed = String(value || '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveUpstreamApiUrl() {
  const explicit = normalizeUrl(process.env.PATIENTFLOW_UPSTREAM_API_URL);
  if (explicit) return explicit;

  const configured = normalizeUrl(process.env.UPSTREAM_API_URL);
  if (!configured || LEGACY_DAC_COMPAT_UPSTREAMS.has(configured)) {
    return VERIFIED_PATIENTFLOW_UPSTREAM;
  }

  return configured;
}

function resolveDistDir() {
  const candidates = [
    process.env.PORTAL_DIST_DIR ? path.resolve(REPO_ROOT, process.env.PORTAL_DIST_DIR) : null,
    path.resolve(REPO_ROOT, 'dist'),
    path.resolve(REPO_ROOT, 'dist-node-root'),
    path.resolve(REPO_ROOT, 'dist-node-clinic'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) || candidates[0];
}

function parseAllowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    'https://crea8ivmedia.com',
    'https://thesmilexperts.com',
    'https://www.thesmilexperts.com',
    'https://portal.thesmilexperts.com',
    'https://portal.smileexperts.com',
    'http://localhost:5173',
    'http://localhost:5174',
    ...configured,
  ]);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'crea8ivmedia.com'
      || host.endsWith('.crea8ivmedia.com')
      || host === 'crea8ivpatientflow.com'
      || host.endsWith('.crea8ivpatientflow.com')
      || host === 'thesmilexperts.com'
      || host === 'www.thesmilexperts.com'
      || host === 'portal.thesmilexperts.com'
      || host === 'portal.smileexperts.com';
  } catch (error) {
    return false;
  }
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const fallbackOrigin = process.env.CLIENT_URL || 'https://patientflow.crea8ivmedia.com';

  res.setHeader('Access-Control-Allow-Origin', isOriginAllowed(origin) ? origin : fallbackOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

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
  headers['x-patientflow-node-webapp'] = '1';
  return headers;
}

function pipeUpstreamResponse(req, upstreamRes, res) {
  const startedAt = req.patientflowStartedAt || process.hrtime.bigint();
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  res.statusCode = upstreamRes.statusCode || 502;

  for (const [key, value] of Object.entries(upstreamRes.headers)) {
    const lowerKey = key.toLowerCase();
    if (
      !['connection', 'keep-alive', 'transfer-encoding'].includes(lowerKey)
      && !CORS_RESPONSE_HEADER_NAMES.has(lowerKey)
      && value !== undefined
    ) {
      res.setHeader(key, value);
    }
  }

  setCorsHeaders(req, res);
  res.setHeader('x-patientflow-served-by', 'node-webapp');
  res.setHeader('x-patientflow-proxy-ms', durationMs.toFixed(1));
  res.setHeader('Server-Timing', `pfproxy;dur=${durationMs.toFixed(1)}`);
  upstreamRes.pipe(res);
}

function sendProxyError(req, res, error) {
  if (res.headersSent) {
    res.end();
    return;
  }

  const isBodyLimit = error.message === 'Request body too large';
  const startedAt = req?.patientflowStartedAt || process.hrtime.bigint();
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  if (req) setCorsHeaders(req, res);
  res.setHeader('x-patientflow-proxy-ms', durationMs.toFixed(1));
  res.setHeader('Server-Timing', `pfproxy;dur=${durationMs.toFixed(1)}`);
  res.status(isBodyLimit ? 413 : 502).json({
    error: isBodyLimit ? 'Request body too large' : 'Upstream API unavailable',
    code: isBodyLimit ? 'body_too_large' : 'upstream_unavailable',
  });
}

function createProxyRequest(req, res, targetUrl, headers) {
  const client = targetUrl.protocol === 'https:' ? https : http;
  const agent = targetUrl.protocol === 'https:' ? HTTPS_AGENT : HTTP_AGENT;
  const proxyReq = client.request({
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || undefined,
    method: req.method,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers,
    agent,
    timeout: REQUEST_TIMEOUT_MS,
  }, (upstreamRes) => pipeUpstreamResponse(req, upstreamRes, res));

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Upstream request timed out'));
  });

  proxyReq.on('error', (error) => sendProxyError(req, res, error));
  return proxyReq;
}

function shouldRewriteLoginPayload(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  return req.method === 'POST'
    && req.path === '/auth/login'
    && contentType.includes('application/json');
}

function normalizeLoginPayload(buffer) {
  try {
    const payload = JSON.parse(buffer.toString('utf8'));
    if (
      payload
      && typeof payload === 'object'
      && !Array.isArray(payload)
      && !payload.email
      && typeof payload.username === 'string'
      && payload.username.trim()
    ) {
      payload.email = payload.username.trim().toLowerCase();
    }

    return Buffer.from(JSON.stringify(payload));
  } catch (error) {
    return buffer;
  }
}

function proxyApi(req, res) {
  req.patientflowStartedAt = process.hrtime.bigint();
  const targetUrl = new URL(req.originalUrl, `${UPSTREAM_API_URL}/`);
  const headers = buildProxyHeaders(req, targetUrl);

  if (shouldRewriteLoginPayload(req)) {
    const chunks = [];
    let bytesReceived = 0;

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > BODY_LIMIT_BYTES) {
        sendProxyError(req, res, new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (res.headersSent) return;
      const requestBody = normalizeLoginPayload(Buffer.concat(chunks));
      headers['content-length'] = String(requestBody.length);
      const proxyReq = createProxyRequest(req, res, targetUrl, headers);
      proxyReq.end(requestBody);
    });

    req.on('error', (error) => sendProxyError(req, res, error));
    return;
  }

  let bytesReceived = 0;
  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
    if (bytesReceived > BODY_LIMIT_BYTES) {
      req.destroy(new Error('Request body too large'));
    }
  });

  const proxyReq = createProxyRequest(req, res, targetUrl, headers);
  req.pipe(proxyReq);
}

app.use('/api/v1', (req, res, next) => {
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
    mode: 'node-webapp',
    portalBasePath: PORTAL_BASE_PATH,
    portalDistReady: fs.existsSync(INDEX_HTML),
    upstream: new URL(UPSTREAM_API_URL).host,
    timestamp: new Date().toISOString(),
  });
});

function patientflowLocalDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function patientflowMonthRange() {
  const now = new Date();
  return {
    from: patientflowLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: patientflowLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function asArray(value, key) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value[key])) return value[key];
  return [];
}

function firstNumber(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return Number(value || 0);
  }
  return 0;
}

async function fetchUpstreamJson(endpoint, req, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(endpoint.replace(/^\/+/, ''), `${UPSTREAM_API_URL}/`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: req.headers.authorization || '',
        Cookie: req.headers.cookie || '',
        Origin: req.headers.origin || process.env.CLIENT_URL || 'https://patientflow.crea8ivmedia.com',
        'X-Forwarded-Host': req.headers.host || '',
        'X-Forwarded-Proto': req.protocol || 'https',
        'X-PatientFlow-Node-WebApp': '1',
      },
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeDashboardPayload(results, from, to) {
  const today = patientflowLocalDate(new Date());
  const appointmentsData = results.appointments?.data;
  const clientsData = results.clients?.data;
  const staffData = results.staff?.data;
  const servicesData = results.services?.data;
  const invoicesData = results.invoices?.data;
  const financialsData = results.financials?.ok ? results.financials.data : null;

  const appointments = asArray(appointmentsData, 'appointments');
  const clients = asArray(clientsData, 'clients');
  const staff = asArray(staffData, 'staff');
  const services = asArray(servicesData, 'services');
  const invoices = asArray(invoicesData, 'invoices');
  const todayAppointments = appointments
    .filter((appointment) => appointment?.date === today)
    .sort((a, b) => String(a?.startTime || '').localeCompare(String(b?.startTime || '')))
    .slice(0, 12);

  const activeStaff = staff.filter((member) => member?.status === 'active');
  const topStaff = activeStaff
    .slice()
    .sort((a, b) => Number(b?.rating || 0) - Number(a?.rating || 0) || String(a?.name || '').localeCompare(String(b?.name || '')))
    .slice(0, 5)
    .map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      designation: member.designation,
      status: member.status,
      rating: Number(member.rating || 0),
    }));

  return {
    range: { from, to },
    today,
    appointments: {
      today: todayAppointments,
      todayCount: firstNumber(appointmentsData?.todayCount, todayAppointments.length),
    },
    clients: {
      activeCount: firstNumber(clientsData?.activeCount, clientsData?.total, clients.filter((client) => client?.status !== 'inactive').length),
      stageCounts: clientsData?.stageCounts ?? null,
    },
    staff: {
      activeCount: firstNumber(staffData?.activeCount, activeStaff.length),
      top: topStaff,
    },
    services: {
      count: firstNumber(servicesData?.count, servicesData?.total, services.length),
    },
    invoices: {
      pendingCount: firstNumber(
        invoicesData?.pendingCount,
        invoicesData?.stats?.pending,
        invoices.filter((invoice) => ['pending', 'partial'].includes(invoice?.status)).length
      ),
    },
    financials: financialsData || null,
    partial: Object.values(results).some((result) => !result?.ok),
  };
}

app.get('/api/v1/dashboard/summary', async (req, res) => {
  const startedAt = process.hrtime.bigint();
  setCorsHeaders(req, res);

  if (!req.headers.authorization && !req.headers.cookie) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || '')) ? String(req.query.from) : patientflowMonthRange().from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || '')) ? String(req.query.to) : patientflowMonthRange().to;

  try {
    const fastSummary = await fetchUpstreamJson(
      `/dashboard/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      req
    );
    if (fastSummary.ok && fastSummary.data) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      res.setHeader('x-patientflow-summary-ms', durationMs.toFixed(1));
      res.setHeader('x-patientflow-summary-source', 'upstream');
      res.setHeader('Server-Timing', `pfsummary;dur=${durationMs.toFixed(1)}`);
      res.json(fastSummary.data);
      return;
    }
    if (fastSummary.status === 401 || fastSummary.status === 403) {
      res.status(fastSummary.status).json(fastSummary.data || { error: 'Invalid or expired token' });
      return;
    }

    const [appointments, clients, staff, services, invoices, financials] = await Promise.all([
      fetchUpstreamJson(`/appointments?from=${encodeURIComponent(patientflowLocalDate(new Date()))}&to=${encodeURIComponent(patientflowLocalDate(new Date()))}&limit=50`, req),
      fetchUpstreamJson('/clients?limit=1', req),
      fetchUpstreamJson('/staff', req),
      fetchUpstreamJson('/services', req),
      fetchUpstreamJson('/invoices?limit=100', req),
      fetchUpstreamJson(`/financials/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, req),
    ]);

    if ([appointments, clients, staff, services, invoices].every((result) => result.status === 401 || result.status === 403)) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const summary = summarizeDashboardPayload({ appointments, clients, staff, services, invoices, financials }, from, to);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    res.setHeader('x-patientflow-summary-ms', durationMs.toFixed(1));
    res.setHeader('Server-Timing', `pfsummary;dur=${durationMs.toFixed(1)}`);
    res.json(summary);
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    res.setHeader('x-patientflow-summary-ms', durationMs.toFixed(1));
    res.setHeader('Server-Timing', `pfsummary;dur=${durationMs.toFixed(1)}`);
    res.status(502).json({ error: 'Dashboard summary unavailable', code: 'summary_unavailable' });
  }
});

app.use('/api/v1', proxyApi);

function setStaticHeaders(res, filePath) {
  if (/\/assets\//.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }
  if (/(?:^|\/)(?:index\.html|sw\.js|manifest\.webmanifest)$/.test(filePath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}

function sendPortalIndex(req, res) {
  if (!fs.existsSync(INDEX_HTML)) {
    res.status(503).json({
      error: 'Portal build not found',
      expected: path.relative(process.cwd(), INDEX_HTML),
    });
    return;
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(INDEX_HTML);
}

const staticOptions = {
  index: false,
  setHeaders: setStaticHeaders,
};

if (PORTAL_BASE_PATH === '/') {
  app.use(express.static(DIST_DIR, staticOptions));
  app.get('*', sendPortalIndex);
} else {
  app.use(PORTAL_BASE_PATH, express.static(DIST_DIR, staticOptions));
  app.get(PORTAL_BASE_PATH, sendPortalIndex);
  app.get(`${PORTAL_BASE_PATH}/*`, sendPortalIndex);
  app.get('/', (req, res) => res.redirect(302, PORTAL_BASE_PATH));
}

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`PatientFlow Node web app listening on port ${PORT}`);
  console.log(`Portal base path: ${PORTAL_BASE_PATH}`);
  console.log(`Portal dist: ${DIST_DIR}`);
});
