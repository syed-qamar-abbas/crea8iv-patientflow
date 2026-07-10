import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchApi, fetchPublicApi } from '../config/api';
import { getLogoInitials, syncBrandingMetadata } from '../utils/branding';
import { PORTAL_CLINIC_SLUG } from '../config/portalPath';
import { HEALTHCARE_TEMPLATE_KEY, resolveIndustryTemplate, termFromTemplate } from '../config/industryTemplates';

// A signed-in clinic user (not the platform superadmin) should always see
// their own clinic's saved branding, regardless of which domain they use.
function isClinicUserSession() {
  if (localStorage.getItem('clinic_auth') !== 'true') return false;
  try {
    const role = JSON.parse(localStorage.getItem('clinic_user') || '{}').role || '';
    return role !== '' && role !== 'superadmin';
  } catch (_) {
    return false;
  }
}

function currentSessionClinicId() {
  try {
    return JSON.parse(localStorage.getItem('clinic_user') || '{}').clinicId || '';
  } catch (_) {
    return '';
  }
}

// Drop null/undefined so sparse DB rows don't blank out sensible defaults.
function compact(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== null && v !== undefined));
}

function clinicBranding(obj) {
  const data = compact(obj);
  if (data.name && (!data.logo || String(data.logo).trim().toUpperCase() === 'PF')) {
    data.logo = getLogoInitials(data.name, 'CL');
  }
  return data;
}

const ClinicContext = createContext(null);

// Platform brand shown on the shared/superadmin login at crea8ivmedia.com and
// on any domain not claimed by a clinic. White-label clinic domains override
// this via the /public/branding lookup below.
const defaultClinicInfo = {
  name: 'Crea8iv PatientFlow',
  tagline: 'Clinic Management Platform',
  logo: 'PF',
  address: 'Crea8iv Media, Islamabad, Pakistan',
  phone: '+92 310 5704555',
  whatsapp: '+92 310 5704555',
  email: 'info@crea8ivmedia.com',
  website: 'crea8ivmedia.com',
  registrationNo: '',
  invoicePrefix: 'PF',
  invoiceFooter: 'Powered by Crea8iv PatientFlow.',
  paymentTerms: 'Pending balances are shown on every invoice and should be cleared before the next appointment unless approved by admin.',
  mission: 'Help clinics run premium, transparent, patient-friendly operations through one digital platform.',
  vision: 'To be the operating system modern clinics rely on every day.',
  servicesOverview: 'Appointments, operational patient profiles, billing, inventory, staff, marketing and reporting — in one portal.',
  branches: [],
  activeBranch: '',
  specialties: ['dental'],
  primaryColor: '#f97316',
  secondaryColor: '#ea580c',
};

const defaultFeatures = {
  industryTemplate: HEALTHCARE_TEMPLATE_KEY,
  operatingMode: 'operations_only',
  clinicalRecordEnabled: false,
  treatmentProcedureEntryEnabled: false,
  medicalHistoryEntryEnabled: false,
  patientImagePublicationEnabled: false,
  aiClinicalAdviceEnabled: false,
  clinicalPolicyVersion: 'operations-v1',
  marketingEnabled: false,
  metaLeadsEnabled: false,
  importsEnabled: false,
  whatsappEnabled: false,
  whatsappMarketingEnabled: false,
  whatsappAutomationEnabled: false,
  aiEnabled: false,
  aiAutoReplyEnabled: false,
  aiHumanApprovalRequired: true,
  monthlyAiTokenLimit: 0,
  monthlyWhatsAppLimit: 0,
  package: { key: 'core', name: 'Starter', pricePKR: 50000, annualPricePKR: 50000 },
  subscription: null,
};

export function ClinicProvider({ children }) {
  const [activeSpecialty, setActiveSpecialty] = useState('all');
  // True once /public/branding confirms a clinic owns this domain. While false
  // (e.g. the platform domain crea8ivmedia.com) the portal shows PatientFlow.
  const [clinicMatched, setClinicMatched] = useState(false);
  const [features, setFeatures] = useState(defaultFeatures);
  const [industryTemplate, setIndustryTemplate] = useState(() => resolveIndustryTemplate());
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [clinicInfo, setClinicInfo] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('clinic_branding') || 'null');
      // Trust the cache only when (a) a clinic user is signed in, or (b) this
      // domain was previously confirmed as a white-label clinic domain.
      // Otherwise (e.g. logged-out platform login) show the platform brand.
      const sessionClinicId = currentSessionClinicId();
      const trusted = saved && (
        (isClinicUserSession() && saved._clinicId && saved._clinicId === sessionClinicId) ||
        saved._matchedDomain === window.location.hostname
      );
      if (!trusted) return defaultClinicInfo;
      return { ...defaultClinicInfo, ...saved, specialties: ['dental'] };
    } catch (_) {
      return defaultClinicInfo;
    }
  });

  useEffect(() => {
    localStorage.setItem('clinic_branding', JSON.stringify(clinicInfo));
    const root = document.documentElement;
    if (clinicInfo.primaryColor) root.style.setProperty('--primary', clinicInfo.primaryColor);
    if (clinicInfo.secondaryColor) root.style.setProperty('--secondary', clinicInfo.secondaryColor);
    if (clinicInfo.font) root.style.setProperty('--font-family', clinicInfo.font);
    syncBrandingMetadata(clinicInfo);
  }, [clinicInfo]);

  useEffect(() => {
    // White-label: ask the API which clinic owns this domain and brand the
    // portal (incl. the login screen) accordingly. The domain is sent
    // explicitly so it works even when the API lives on a different host
    // (e.g. portal.thesmilexperts.com talking to app.crea8ivmedia.com).
    // Path-based portal link (/clinic/<slug>/…) brands by slug; otherwise the
    // clinic is identified by the domain (custom domain / subdomain portals).
    const domain = window.location.hostname;
    const q = PORTAL_CLINIC_SLUG
      ? `slug=${encodeURIComponent(PORTAL_CLINIC_SLUG)}`
      : `domain=${encodeURIComponent(domain)}`;
    fetchPublicApi(`/public/branding?${q}`)
      .then((data) => {
        if (data?.matched && data.clinic) {
          setClinicMatched(true);
          setClinicInfo((current) => ({
            ...current,
            ...clinicBranding(data.clinic),
            _matchedDomain: window.location.hostname,
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // featuresLoaded gates FeatureRoute so a direct URL load to a plan-gated
    // route doesn't flash/redirect before /features resolves.
    if (!isClinicUserSession()) { setFeaturesLoaded(true); return; }
    // Terminal screens (subscription-inactive, login) must not hit tenant APIs
    // — those would 402 and bounce the page back to itself in a loop.
    if (typeof window !== 'undefined' && /\/(subscription-inactive|login|forgot-password|reset-password)$/.test(window.location.pathname)) {
      setFeaturesLoaded(true); return;
    }
    fetchApi('/features')
      .then((data) => {
        setFeatures((current) => ({ ...current, ...data }));
        setIndustryTemplate(resolveIndustryTemplate(data?.industryConfig));
        if (data?.clinic) {
          setClinicMatched(true);
          setClinicInfo((current) => ({ ...current, ...clinicBranding(data.clinic), _clinicId: data.clinic.id }));
        }
      })
      .catch(() => {})
      .finally(() => setFeaturesLoaded(true));
  }, []);

  useEffect(() => {
    // Signed-in clinic users: hydrate from the server-saved clinic settings
    // (the Clinic table) so edits persist across logins on ANY domain —
    // including the shared platform domain where /public/branding matches
    // nothing. Roles without access to this endpoint just keep domain branding.
    if (!isClinicUserSession()) return;
    if (typeof window !== 'undefined' && /\/(subscription-inactive|login|forgot-password|reset-password)$/.test(window.location.pathname)) return;
    fetchApi('/settings/public-site')
      .then((data) => {
        if (data?.clinic) {
          setClinicMatched(true);
          setClinicInfo((current) => ({ ...current, ...clinicBranding(data.clinic), _clinicId: data.clinic.id }));
        }
      })
      .catch(() => {});
  }, []);

  const updateClinicInfo = (updates) => {
    setClinicInfo((current) => ({ ...current, ...updates }));
  };

  const term = (key, fallback = '') => termFromTemplate(industryTemplate, key, fallback);

  const value = useMemo(() => ({
    activeSpecialty,
    setActiveSpecialty,
    clinicInfo,
    features,
    industryTemplate,
    term,
    featuresLoaded,
    updateClinicInfo,
    clinicMatched,
    isPlatform: !clinicMatched,
  }), [activeSpecialty, clinicInfo, clinicMatched, features, featuresLoaded, industryTemplate]);

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  return useContext(ClinicContext);
}
