import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ClinicProvider } from './context/ClinicContext';
import { PORTAL_BASENAME } from './config/portalPath';
import { canAccessPath } from './config/roles';
import { useClinic } from './context/ClinicContext';

const LayoutNew = lazy(() => import('./components/layout/LayoutNew'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SubscriptionInactive = lazy(() => import('./pages/SubscriptionInactive'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminTenants = lazy(() => import('./pages/admin/AdminTenants'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport'));
const AdminPlatform = lazy(() => import('./pages/admin/AdminPlatform'));
const PublicSite = lazy(() => import('./pages/PublicSite'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ReceptionDesk = lazy(() => import('./pages/ReceptionDesk'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const ClinicalWorkspace = lazy(() => import('./pages/ClinicalWorkspace'));
const Lab = lazy(() => import('./pages/Lab'));
const Staff = lazy(() => import('./pages/Staff'));
const Services = lazy(() => import('./pages/Services'));
const Financials = lazy(() => import('./pages/Financials'));
const Settings = lazy(() => import('./pages/Settings'));
const Packages = lazy(() => import('./pages/Packages'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Marketing = lazy(() => import('./pages/Marketing'));
const ManualOutreach = lazy(() => import('./pages/ManualOutreach'));
const WhatsAppCenter = lazy(() => import('./pages/WhatsAppCenter'));
const Reports = lazy(() => import('./pages/Reports'));
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const MultiBranch = lazy(() => import('./pages/MultiBranch'));
const AIHub = lazy(() => import('./pages/AIHub'));
const AIReceptionist = lazy(() => import('./pages/AIReceptionist'));
const MetaLeadCenter = lazy(() => import('./pages/MetaLeadCenter'));
const ImportCenter = lazy(() => import('./pages/ImportCenter'));
const Support = lazy(() => import('./pages/Support'));

const FEATURE_ROUTES = {
  marketing: { key: 'marketingEnabled', label: 'Marketing' },
  whatsapp: { key: 'whatsappEnabled', label: 'WhatsApp Center' },
  ai: { key: 'aiEnabled', label: 'AI Hub' },
  'ai-receptionist': { key: 'aiEnabled', label: 'AI Receptionist' },
  'meta-leads': { key: 'metaLeadsEnabled', label: 'Meta Leads' },
  imports: { key: 'importsEnabled', label: 'Import Center' },
};

const MODULE_BY_PATH = {
  reception: 'reception', appointments: 'appointments', clients: 'clients', clinical: 'clinical',
  lab: 'lab', staff: 'staff', services: 'services', financials: 'financials', settings: 'settings',
  packages: 'packages', invoices: 'invoices', inventory: 'inventory', gallery: 'gallery', feedback: 'feedback',
  marketing: 'marketing', outreach: 'outreach', whatsapp: 'whatsapp', reports: 'reports', audit: 'audit', branches: 'branches',
  ai: 'ai', 'ai-receptionist': 'aiReceptionist', 'meta-leads': 'metaLeads', imports: 'imports', support: 'support',
};

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('clinic_auth') === 'true';
  if (!isAuth) return <Navigate to="/login" replace />;
  try {
    if (JSON.parse(localStorage.getItem('clinic_user') || '{}').role === 'superadmin') {
      return <Navigate to="/admin" replace />;
    }
  } catch (_) { /* the API remains the authorization boundary */ }
  return children;
}

function SuperadminRoute({ children }) {
  const isAuth = localStorage.getItem('clinic_auth') === 'true';
  if (!isAuth) return <Navigate to="/login" replace />;
  let role = '';
  try {
    role = (JSON.parse(localStorage.getItem('clinic_user') || '{}').role || '');
  } catch (_) { /* fall through */ }
  return role === 'superadmin' ? children : <Navigate to="/dashboard" replace />;
}

function RoleRoute({ path, children }) {
  const { featuresLoaded, moduleVisible } = useClinic();
  if (!featuresLoaded) return <div className="flex min-h-[55vh] items-center justify-center p-6 text-sm text-gray-400">Loading…</div>;
  if (!canAccessPath(`/${path}`)) return <Navigate to="/dashboard" replace />;
  if (!moduleVisible(MODULE_BY_PATH[path] || path)) return <Navigate to="/dashboard" replace />;
  return children;
}

function FeatureRoute({ path, children }) {
  const { features, featuresLoaded, moduleVisible } = useClinic();
  const feature = FEATURE_ROUTES[path];
  if (!canAccessPath(`/${path}`)) return <Navigate to="/dashboard" replace />;
  // Wait for /features to resolve so a direct URL load doesn't wrongly lock/redirect.
  if (feature && !featuresLoaded) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center p-6 text-sm text-gray-400">
        Loading…
      </div>
    );
  }
  if (!moduleVisible(MODULE_BY_PATH[path] || path)) return <Navigate to="/dashboard" replace />;
  if (feature && !features[feature.key]) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Feature locked</p>
          <h1 className="mt-3 text-2xl font-black">{feature.label}</h1>
          <p className="mt-2 text-sm leading-6">Contact Support to activate {feature.label} for this clinic.</p>
        </div>
      </div>
    );
  }
  return children;
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm font-semibold text-slate-400 dark:bg-slate-950 dark:text-slate-500">
      Loading…
    </div>
  );
}

function InlineRouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center p-6 text-sm font-semibold text-slate-400 dark:text-slate-500">
      Loading…
    </div>
  );
}

function PageSuspense({ children }) {
  return <Suspense fallback={<InlineRouteFallback />}>{children}</Suspense>;
}

export default function AppNew() {
  return (
    <ThemeProvider>
      <ClinicProvider>
        <BrowserRouter basename={PORTAL_BASENAME}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/public" element={<PublicSite />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/subscription-inactive" element={<SubscriptionInactive />} />
              <Route
                path="/admin"
                element={
                  <SuperadminRoute>
                    <AdminLayout />
                  </SuperadminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="tenants" element={<AdminTenants />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="platform" element={<AdminPlatform />} />
              </Route>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <LayoutNew />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* Existing routes */}
                <Route path="dashboard" element={<PageSuspense><Dashboard /></PageSuspense>} />
                <Route path="reception" element={<RoleRoute path="reception"><PageSuspense><ReceptionDesk /></PageSuspense></RoleRoute>} />
                <Route path="appointments" element={<RoleRoute path="appointments"><PageSuspense><Appointments /></PageSuspense></RoleRoute>} />
                <Route path="clients" element={<RoleRoute path="clients"><PageSuspense><Clients /></PageSuspense></RoleRoute>} />
                <Route path="clients/:id" element={<RoleRoute path="clients"><PageSuspense><ClientProfile /></PageSuspense></RoleRoute>} />
                <Route path="clinical" element={<RoleRoute path="clinical"><PageSuspense><ClinicalWorkspace /></PageSuspense></RoleRoute>} />
                <Route path="lab" element={<RoleRoute path="lab"><PageSuspense><Lab /></PageSuspense></RoleRoute>} />
                <Route path="staff" element={<RoleRoute path="staff"><PageSuspense><Staff /></PageSuspense></RoleRoute>} />
                <Route path="services" element={<RoleRoute path="services"><PageSuspense><Services /></PageSuspense></RoleRoute>} />
                <Route path="financials" element={<RoleRoute path="financials"><PageSuspense><Financials /></PageSuspense></RoleRoute>} />
                <Route path="settings" element={<RoleRoute path="settings"><PageSuspense><Settings /></PageSuspense></RoleRoute>} />

                {/* New routes */}
                <Route path="packages" element={<RoleRoute path="packages"><PageSuspense><Packages /></PageSuspense></RoleRoute>} />
                <Route path="invoices" element={<RoleRoute path="invoices"><PageSuspense><Invoices /></PageSuspense></RoleRoute>} />
                <Route path="prescriptions" element={<RoleRoute path="prescriptions"><PageSuspense><Prescriptions /></PageSuspense></RoleRoute>} />
                <Route path="inventory" element={<RoleRoute path="inventory"><PageSuspense><Inventory /></PageSuspense></RoleRoute>} />
                <Route path="gallery" element={<RoleRoute path="gallery"><PageSuspense><Gallery /></PageSuspense></RoleRoute>} />
                <Route path="feedback" element={<RoleRoute path="feedback"><PageSuspense><Feedback /></PageSuspense></RoleRoute>} />
                <Route path="marketing" element={<FeatureRoute path="marketing"><PageSuspense><Marketing /></PageSuspense></FeatureRoute>} />
                <Route path="outreach" element={<RoleRoute path="outreach"><PageSuspense><ManualOutreach /></PageSuspense></RoleRoute>} />
                <Route path="whatsapp" element={<FeatureRoute path="whatsapp"><PageSuspense><WhatsAppCenter /></PageSuspense></FeatureRoute>} />
                <Route path="reports" element={<RoleRoute path="reports"><PageSuspense><Reports /></PageSuspense></RoleRoute>} />
                <Route path="audit" element={<RoleRoute path="audit"><PageSuspense><AuditTrail /></PageSuspense></RoleRoute>} />
                <Route path="branches" element={<RoleRoute path="branches"><PageSuspense><MultiBranch /></PageSuspense></RoleRoute>} />
                <Route path="ai" element={<FeatureRoute path="ai"><PageSuspense><AIHub /></PageSuspense></FeatureRoute>} />
                <Route path="ai-receptionist" element={<FeatureRoute path="ai-receptionist"><PageSuspense><AIReceptionist /></PageSuspense></FeatureRoute>} />
                <Route path="meta-leads" element={<FeatureRoute path="meta-leads"><PageSuspense><MetaLeadCenter /></PageSuspense></FeatureRoute>} />
                <Route path="imports" element={<FeatureRoute path="imports"><PageSuspense><ImportCenter /></PageSuspense></FeatureRoute>} />
                <Route path="support" element={<RoleRoute path="support"><PageSuspense><Support /></PageSuspense></RoleRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ClinicProvider>
    </ThemeProvider>
  );
}
