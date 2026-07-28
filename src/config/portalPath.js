// Path-based clinic portals: crea8ivmedia.com/clinic/<slug>/...
//
// The clinic build is served under BASE_URL '/clinic/'. We let each clinic have
// a branded link of the form /clinic/<slug>/login by treating the first path
// segment after the base as a clinic slug — UNLESS it's one of the app's own
// top-level routes (login, dashboard, admin, …). React Router then runs with
// basename '/clinic/<slug>' so every in-app link keeps the slug, and the login
// screen brands itself for that clinic.
//
// Custom-domain builds (BASE_URL '/') never use slug routing — those portals are
// already identified by their domain.

const RESERVED_FIRST_SEGMENTS = new Set([
  // public / auth
  'login', 'forgot-password', 'reset-password', 'subscription-inactive', 'public',
  // superadmin
  'admin',
  // app routes
  'dashboard', 'reception', 'appointments', 'clients', 'clinical', 'lab', 'staff',
  'services', 'financials', 'settings', 'packages', 'invoices', 'inventory', 'gallery',
  'feedback', 'marketing', 'whatsapp', 'reports', 'audit', 'branches', 'ai',
  'ai-receptionist', 'meta-leads', 'imports', 'support', 'prescriptions',
  // build assets (served as files, but guard anyway)
  'assets', 'index.html',
]);

function compute() {
  const rawBase = import.meta.env.BASE_URL || '/';
  const base = rawBase.replace(/\/+$/, ''); // '/clinic' or '' (custom-domain)
  const defaultBasename = base || '/';

  // Slug routing only applies to the sub-path build (e.g. /clinic/).
  if (!base || typeof window === 'undefined') {
    return { basename: defaultBasename, clinicSlug: null };
  }

  const path = window.location.pathname;
  if (path !== base && !path.startsWith(base + '/')) {
    return { basename: defaultBasename, clinicSlug: null };
  }

  const rest = path.slice(base.length + 1); // strip '/clinic/'
  const first = (rest.split('/')[0] || '').toLowerCase();
  if (first && !RESERVED_FIRST_SEGMENTS.has(first)) {
    return { basename: base + '/' + first, clinicSlug: first };
  }
  return { basename: defaultBasename, clinicSlug: null };
}

// Computed once from the initial URL — stable for the life of the page, which is
// exactly what BrowserRouter's basename needs.
const resolved = compute();

export const PORTAL_BASENAME = resolved.basename;
export const PORTAL_CLINIC_SLUG = resolved.clinicSlug;
