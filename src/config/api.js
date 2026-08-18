export const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '/api/v1');
const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function appPath(path) {
  return `${APP_BASE}${path.startsWith('/') ? path : `/${path}`}` || '/';
}

// ---------------------------------------------------------------------------
// Stale-while-revalidate cache for GET responses.
// Pages seed their initial state from peekApiCache(endpoint) so a revisited
// screen renders INSTANTLY from the last-seen data, while fetchApi refreshes it
// in the background. In-memory only (per tab) — cleared on logout.
// ---------------------------------------------------------------------------
const _apiCache = new Map();
export function peekApiCache(endpoint) {
  return _apiCache.has(endpoint) ? _apiCache.get(endpoint) : undefined;
}
// Most-recent cached response whose endpoint starts with `prefix` — lets a page
// seed from its last-seen list even if the exact query (page/search/filter) differs.
export function peekApiCacheByPrefix(prefix) {
  let found;
  for (const [key, value] of _apiCache) { if (key.startsWith(prefix)) found = value; }
  return found;
}
export function clearApiCache() { _apiCache.clear(); }

function clearSession() {
  localStorage.removeItem('clinic_auth');
  localStorage.removeItem('clinic_token');
  localStorage.removeItem('clinic_refresh');
  localStorage.removeItem('clinic_user');
  clearApiCache();
}

// Single in-flight refresh shared by concurrent 401s
let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('clinic_refresh');
      if (!refreshToken) return false;
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const data = await response.json();
        localStorage.setItem('clinic_token', data.accessToken);
        // Backend rotates refresh tokens — store the new one
        if (data.refreshToken) {
          localStorage.setItem('clinic_refresh', data.refreshToken);
        }
        return true;
      } catch (_) {
        return false;
      } finally {
        // Allow the next refresh attempt after this one settles
        setTimeout(() => { refreshPromise = null; }, 0);
      }
    })();
  }
  return refreshPromise;
}

async function rawFetch(endpoint, options) {
  const token = localStorage.getItem('clinic_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Remove Content-Type if body is FormData (browser will set it with boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
}

export async function fetchApi(endpoint, options = {}) {
  let response = await rawFetch(endpoint, options);

  // Access token expired? Try one silent refresh, then retry the request.
  if (response.status === 401 && !endpoint.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await rawFetch(endpoint, options);
    }
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    // Don't redirect AWAY from a page TO itself — that turns a single 401/402
    // background fetch into a navigation loop that blocks clicks.
    const here = typeof window !== 'undefined' ? window.location.pathname : '';
    if (response.status === 401) {
      clearSession();
      const target = appPath('/login');
      if (here !== target && !here.endsWith('/login')) window.location.href = target;
    }
    if (response.status === 402 && data.code === 'subscription_inactive') {
      const target = appPath('/subscription-inactive');
      if (here !== target && !here.endsWith('/subscription-inactive')) window.location.href = target;
    }
    throw new Error(data.message || data.error || 'API request failed');
  }

  // Cache successful GET responses so the next visit can render instantly.
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET') _apiCache.set(endpoint, data);

  return data;
}

export async function fetchPublicApi(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}
