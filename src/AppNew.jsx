import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ClinicProvider } from './context/ClinicContext';
import { PORTAL_BASENAME } from './config/portalPath';
import LayoutNew from './components/layout/LayoutNew';

// Existing pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SubscriptionInactive from './pages/SubscriptionInactive';

// Platform owner portal
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLeads from './pages/admin/AdminLeads';
import AdminTenants from './pages/admin/AdminTenants';
import AdminPayments from './pages/admin/AdminPayments';
import AdminSupport from './pages/admin/AdminSupport';
import AdminPlatform from './pages/admin/AdminPlatform';
import PublicSite from './pages/PublicSite';
import Dashboard from './pages/Dashboard';
import ReceptionDesk from './pages/ReceptionDesk';
import Appointments from './pages/Appointments';
import Clients from './pages/Clients';
import ClientProfile from './pages/ClientProfile';
import ClinicalWorkspace from './pages/ClinicalWorkspace';
import Lab from './pages/Lab';
import Staff from './pages/Staff';
import Services from './pages/Services';
import Financials from './pages/Financials';
import Settings from './pages/Settings';

// New pages
import Packages from './pages/Packages';
import Invoices from './pages/Invoices';
import Prescriptions from './pages/Prescriptions';
import Inventory from './pages/Inventory';
import Gallery from './pages/Gallery';
import Feedback from './pages/Feedback';
import Marketing from './pages/Marketing';
import ManualOutreach from './pages/ManualOutreach';
import WhatsAppCenter from './pages/WhatsAppCenter';
import Reports from './pages/Reports';
import AuditTrail from './pages/AuditTrail';
import MultiBranch from './pages/MultiBranch';
import AIHub from './pages/AIHub';
import AIReceptionist from './pages/AIReceptionist';
import MetaLeadCenter from './pages/MetaLeadCenter';
import ImportCenter from './pages/ImportCenter';
import Support from './pages/Support';
import { canAccessPath } from './config/roles';
import { useClinic } from './context/ClinicContext';

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

export default function AppNew() {
  return (
    <ThemeProvider>
      <ClinicProvider>
        <BrowserRouter basename={PORTAL_BASENAME}>
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
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="reception" element={<RoleRoute path="reception"><ReceptionDesk /></RoleRoute>} />
              <Route path="appointments" element={<RoleRoute path="appointments"><Appointments /></RoleRoute>} />
              <Route path="clients" element={<RoleRoute path="clients"><Clients /></RoleRoute>} />
              <Route path="clients/:id" element={<RoleRoute path="clients"><ClientProfile /></RoleRoute>} />
              <Route path="clinical" element={<RoleRoute path="clinical"><ClinicalWorkspace /></RoleRoute>} />
              <Route path="lab" element={<RoleRoute path="lab"><Lab /></RoleRoute>} />
              <Route path="staff" element={<RoleRoute path="staff"><Staff /></RoleRoute>} />
              <Route path="services" element={<RoleRoute path="services"><Services /></RoleRoute>} />
              <Route path="financials" element={<RoleRoute path="financials"><Financials /></RoleRoute>} />
              <Route path="settings" element={<RoleRoute path="settings"><Settings /></RoleRoute>} />

              {/* New routes */}
              <Route path="packages" element={<RoleRoute path="packages"><Packages /></RoleRoute>} />
              <Route path="invoices" element={<RoleRoute path="invoices"><Invoices /></RoleRoute>} />
              <Route path="prescriptions" element={<RoleRoute path="prescriptions"><Prescriptions /></RoleRoute>} />
              <Route path="inventory" element={<RoleRoute path="inventory"><Inventory /></RoleRoute>} />
              <Route path="gallery" element={<RoleRoute path="gallery"><Gallery /></RoleRoute>} />
              <Route path="feedback" element={<RoleRoute path="feedback"><Feedback /></RoleRoute>} />
              <Route path="marketing" element={<FeatureRoute path="marketing"><Marketing /></FeatureRoute>} />
              <Route path="outreach" element={<RoleRoute path="outreach"><ManualOutreach /></RoleRoute>} />
              <Route path="whatsapp" element={<FeatureRoute path="whatsapp"><WhatsAppCenter /></FeatureRoute>} />
              <Route path="reports" element={<RoleRoute path="reports"><Reports /></RoleRoute>} />
              <Route path="audit" element={<RoleRoute path="audit"><AuditTrail /></RoleRoute>} />
              <Route path="branches" element={<RoleRoute path="branches"><MultiBranch /></RoleRoute>} />
              <Route path="ai" element={<FeatureRoute path="ai"><AIHub /></FeatureRoute>} />
              <Route path="ai-receptionist" element={<FeatureRoute path="ai-receptionist"><AIReceptionist /></FeatureRoute>} />
              <Route path="meta-leads" element={<FeatureRoute path="meta-leads"><MetaLeadCenter /></FeatureRoute>} />
              <Route path="imports" element={<FeatureRoute path="imports"><ImportCenter /></FeatureRoute>} />
              <Route path="support" element={<RoleRoute path="support"><Support /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ClinicProvider>
    </ThemeProvider>
  );
}
