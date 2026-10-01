#!/usr/bin/env node

const DEFAULT_BASE_URLS = [
  'https://patientflow.crea8ivmedia.com',
];

const baseUrls = (process.env.PF_SMOKE_BASE_URLS || process.env.PF_SMOKE_BASE_URL || DEFAULT_BASE_URLS.join(','))
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const requireAuth = process.env.PF_SMOKE_REQUIRE_AUTH === 'true';
const publicOnly = process.env.PF_SMOKE_PUBLIC_ONLY === 'true';
const timeoutMs = Number(process.env.PF_SMOKE_TIMEOUT_MS || 20000);
const authProfiles = buildAuthProfiles();

const publicRoutes = [
  '/login',
  '/dashboard',
  '/appointments',
  '/invoices',
  '/financials',
  '/staff',
];

const clinicReadEndpoints = [
  '/features',
  '/appointments?limit=5',
  '/clients?limit=5',
  '/staff',
  '/invoices?limit=5',
  `/financials/summary?${monthRangeQuery()}`,
];

const adminReadEndpoints = [
  '/admin/stats',
  '/admin/tenants',
];

const results = [];
let failed = false;

function buildAuthProfiles() {
  const profiles = [];
  const profileDefs = [
    {
      label: process.env.PF_SMOKE_LABEL || 'auth',
      email: process.env.PF_SMOKE_EMAIL || '',
      username: process.env.PF_SMOKE_USERNAME || process.env.PF_SMOKE_EMAIL || '',
      password: process.env.PF_SMOKE_PASSWORD || '',
    },
    {
      label: 'superadmin',
      email: process.env.PF_SMOKE_ADMIN_EMAIL || '',
      username: process.env.PF_SMOKE_ADMIN_USERNAME || process.env.PF_SMOKE_ADMIN_EMAIL || '',
      password: process.env.PF_SMOKE_ADMIN_PASSWORD || '',
    },
    {
      label: 'owner',
      email: process.env.PF_SMOKE_OWNER_EMAIL || '',
      username: process.env.PF_SMOKE_OWNER_USERNAME || process.env.PF_SMOKE_OWNER_EMAIL || '',
      password: process.env.PF_SMOKE_OWNER_PASSWORD || '',
    },
  ];

  for (const profile of profileDefs) {
    if (!profile.password || !(profile.username || profile.email)) continue;
    const key = `${profile.username || profile.email}:${profile.label}`;
    if (profiles.some((existing) => `${existing.username || existing.email}:${existing.label}` === key)) continue;
    profiles.push(profile);
  }

  return profiles;
}

function monthRangeQuery() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return `from=${from}&to=${to}`;
}

function record(result) {
  results.push(result);
  const label = result.ok ? 'ok' : 'fail';
  console.log(`${label.padEnd(4)} ${result.name.padEnd(28)} ${String(result.status || '').padEnd(4)} ${String(result.ms || '').padStart(5)}ms ${result.note || ''}`);
  if (!result.ok) failed = true;
}

async function fetchTimed(name, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...options.headers,
      },
    });
    const text = await response.text();
    const ms = Date.now() - started;
    return {
      name,
      status: response.status,
      ms,
      ok: response.ok,
      text,
      headers: response.headers,
      note: response.headers.get('x-patientflow-proxy-ms')
        ? `proxy=${response.headers.get('x-patientflow-proxy-ms')}ms`
        : '',
    };
  } catch (error) {
    return {
      name,
      ms: Date.now() - started,
      ok: false,
      note: error?.name === 'AbortError' ? 'timeout' : error.message,
      text: '',
      headers: new Headers(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkPublic(baseUrl) {
  for (const route of publicRoutes) {
    const result = await fetchTimed(`${new URL(baseUrl).hostname}${route}`, `${baseUrl}${route}`);
    record(result);
  }

  const nodeHealth = await fetchTimed(`${new URL(baseUrl).hostname}/node-health`, `${baseUrl}/api/v1/node-health`);
  if (nodeHealth.ok && !/"status"\s*:\s*"ok"/.test(nodeHealth.text)) {
    nodeHealth.ok = false;
    nodeHealth.note = 'unexpected node-health body';
  }
  record(nodeHealth);

  const apiHealth = await fetchTimed(`${new URL(baseUrl).hostname}/api-health`, `${baseUrl}/api/v1/health`);
  if (apiHealth.ok && !/"status"\s*:\s*"ok"/.test(apiHealth.text)) {
    apiHealth.ok = false;
    apiHealth.note = 'unexpected api-health body';
  }
  record(apiHealth);

  const preflight = await fetchTimed(`${new URL(baseUrl).hostname}/cors`, `${baseUrl}/api/v1/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: baseUrl,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });
  const allowOrigin = preflight.headers.get('access-control-allow-origin');
  preflight.ok = preflight.status === 200 && allowOrigin === baseUrl;
  preflight.note = `allow-origin=${allowOrigin || 'missing'}`;
  record(preflight);
}

async function login(baseUrl, profile) {
  if (!profile?.username || !profile?.password) return null;

  const response = await fetchTimed(`${new URL(baseUrl).hostname}/${profile.label}-login`, `${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: profile.username,
      email: profile.email || profile.username,
      password: profile.password,
    }),
  });

  let data = {};
  try {
    data = JSON.parse(response.text || '{}');
  } catch (_) {
    data = {};
  }

  response.ok = response.ok && Boolean(data.accessToken);
  response.note = response.ok
    ? `role=${data.user?.role || 'unknown'}`
    : sanitizeError(data.message || data.error || response.note || 'login failed', profile.password);
  record(response);

  if (!response.ok) return null;
  return { accessToken: data.accessToken, user: data.user || {} };
}

function sanitizeError(value, password) {
  return String(value || '').replace(password, '[redacted]').slice(0, 160);
}

async function checkAuthenticated(baseUrl, session, label) {
  const role = session.user?.role || '';
  const endpoints = role === 'superadmin' ? adminReadEndpoints : clinicReadEndpoints;

  for (const endpoint of endpoints) {
    const result = await fetchTimed(`${new URL(baseUrl).hostname}/${label}${endpoint}`, `${baseUrl}/api/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    record(result);
  }
}

for (const baseUrl of baseUrls) {
  console.log(`\nPatientFlow smoke: ${baseUrl}`);
  await checkPublic(baseUrl);

  if (!publicOnly) {
    if (!authProfiles.length && requireAuth) {
      failed = true;
      record({
        name: `${new URL(baseUrl).hostname}/auth-config`,
        ok: false,
        note: 'PF_SMOKE_* credentials missing',
      });
    }

    for (const profile of authProfiles) {
      const session = await login(baseUrl, profile);
      if (session) {
        await checkAuthenticated(baseUrl, session, profile.label);
      } else if (requireAuth) {
        failed = true;
      }
    }
  }
}

const summary = {
  checkedAt: new Date().toISOString(),
  total: results.length,
  failed: results.filter((result) => !result.ok).length,
  slow: results.filter((result) => result.ok && result.ms > 2000).map((result) => ({
    name: result.name,
    ms: result.ms,
  })),
};

console.log(`\n${JSON.stringify(summary, null, 2)}`);
process.exit(failed ? 1 : 0);
