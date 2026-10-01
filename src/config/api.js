export const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '/api/v1');
const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const SESSION_KEYS = ['clinic_auth', 'clinic_token', 'clinic_refresh', 'clinic_user'];
const IMPERSONATION_BACKUP_PREFIX = 'pf_admin_return__';
const IMPERSONATION_FLAG_KEY = 'pf_impersonating';
const REFRESH_SYNC_WAIT_MS = 2000;
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 30000);

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
const _inFlightGets = new Map();
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
export function clearApiCache() {
  _apiCache.clear();
  _inFlightGets.clear();
}

export function resetStoredSessionForLogin() {
  clearSession({ includeImpersonation: true });
  localStorage.removeItem('clinic_branding');
}

function clearSession({ includeImpersonation = false } = {}) {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  if (includeImpersonation) {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(`${IMPERSONATION_BACKUP_PREFIX}${key}`));
    localStorage.removeItem(IMPERSONATION_FLAG_KEY);
  }
  clearApiCache();
}

function restoreAdminSessionFromImpersonation() {
  if (localStorage.getItem(IMPERSONATION_FLAG_KEY) === null) return false;
  const hasAdminBackup = localStorage.getItem(`${IMPERSONATION_BACKUP_PREFIX}clinic_auth`) === 'true';
  if (!hasAdminBackup) return false;

  SESSION_KEYS.forEach((key) => {
    const backupKey = `${IMPERSONATION_BACKUP_PREFIX}${key}`;
    const value = localStorage.getItem(backupKey);
    if (value !== null) {
      localStorage.setItem(key, value);
      localStorage.removeItem(backupKey);
    } else {
      localStorage.removeItem(key);
    }
  });
  localStorage.removeItem(IMPERSONATION_FLAG_KEY);
  clearApiCache();
  return true;
}

// Single in-flight refresh shared by concurrent 401s
let refreshPromise = null;

function sessionWasRotated(previousRefreshToken, previousAccessToken) {
  const currentRefreshToken = localStorage.getItem('clinic_refresh');
  const currentAccessToken = localStorage.getItem('clinic_token');
  return Boolean(
    currentRefreshToken
    && currentAccessToken
    && currentRefreshToken !== previousRefreshToken
    && currentAccessToken !== previousAccessToken
  );
}

function waitForRotatedSession(previousRefreshToken, previousAccessToken) {
  if (sessionWasRotated(previousRefreshToken, previousAccessToken)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let timer;
    const finish = (rotated) => {
      window.removeEventListener('storage', handleStorage);
      window.clearTimeout(timer);
      resolve(rotated);
    };
    const handleStorage = (event) => {
      if (
        ['clinic_refresh', 'clinic_token'].includes(event.key)
        && sessionWasRotated(previousRefreshToken, previousAccessToken)
      ) {
        finish(true);
      }
    };

    window.addEventListener('storage', handleStorage);
    timer = window.setTimeout(
      () => finish(sessionWasRotated(previousRefreshToken, previousAccessToken)),
      REFRESH_SYNC_WAIT_MS,
    );
  });
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('clinic_refresh');
      const accessToken = localStorage.getItem('clinic_token');
      if (!refreshToken) return false;
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        // Another tab may have rotated this token while this request was in
        // flight. Reuse that tab's fresh session instead of logging this tab out.
        if (!response.ok) return waitForRotatedSession(refreshToken, accessToken);
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

async function fetchWithTimeout(url, options = {}) {
  if (!API_TIMEOUT_MS || options.signal) return fetch(url, options);

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('API request timed out');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function logoutSession() {
  const refreshToken = localStorage.getItem('clinic_refresh');
  try {
    if (refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch (_) {
    // Local logout must still complete when the API is temporarily unavailable.
  } finally {
    clearSession({ includeImpersonation: true });
  }
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

  return fetchWithTimeout(`${API_URL}${endpoint}`, { ...options, headers });
}

export async function fetchApi(endpoint, options = {}) {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  const method = (options.method || 'GET').toUpperCase();
  const canShareRequest = method === 'GET' && !fetchOptions.signal;
  if (canShareRequest && _inFlightGets.has(endpoint)) {
    return _inFlightGets.get(endpoint);
  }

  const requestPromise = (async () => {
    let response = await rawFetch(endpoint, fetchOptions);

    // Access token expired? Try one silent refresh, then retry the request.
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      const refreshed = await refreshSession();
      if (refreshed) {
        response = await rawFetch(endpoint, fetchOptions);
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
        if (!suppressAuthRedirect) {
          const restoredAdmin = restoreAdminSessionFromImpersonation();
          const target = restoredAdmin ? appPath('/admin/tenants') : appPath('/login');
          const isAdminArea = typeof window !== 'undefined' && here.startsWith(appPath('/admin'));
          if (!restoredAdmin && !isAdminArea) clearSession();
          if (here !== target && !here.endsWith(restoredAdmin ? '/admin/tenants' : '/login')) {
            if (!isAdminArea || restoredAdmin) {
              window.location.href = target;
            }
          }
        }
      }
      if (response.status === 402 && data.code === 'subscription_inactive') {
        const target = appPath('/subscription-inactive');
        if (here !== target && !here.endsWith('/subscription-inactive')) window.location.href = target;
      }
      throw new Error(data.message || data.error || 'API request failed');
    }

    // Cache successful GET responses so the next visit can render instantly.
    if (method === 'GET') _apiCache.set(endpoint, data);
    else clearApiCache();

    return data;
  })();

  if (!canShareRequest) return requestPromise;

  _inFlightGets.set(endpoint, requestPromise);
  try {
    return await requestPromise;
  } finally {
    _inFlightGets.delete(endpoint);
  }
}

export async function fetchPublicApi(endpoint, options = {}) {
  const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}
