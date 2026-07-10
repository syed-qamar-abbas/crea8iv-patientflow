export const HEALTHCARE_TEMPLATE_KEY = 'healthcare';

export const healthcareIndustryConfig = {
  templateKey: HEALTHCARE_TEMPLATE_KEY,
  name: 'Healthcare',
  config: {
    terms: {
      appointment: 'Appointment',
      appointments: 'Appointments',
      patient: 'Patient',
      patients: 'Patients',
      client: 'Patient',
      clients: 'Patients',
      doctor: 'Doctor',
      doctors: 'Doctors',
      staff: 'Staff',
      service: 'Treatment Service',
      services: 'Treatment Services',
      treatment: 'Treatment',
      treatments: 'Treatments',
      clinical: 'Operations',
      clinicalWorkspace: 'Operations Workspace',
      clinicalNotes: 'Operational Notes',
      recall: 'Recall',
      recalls: 'Recalls',
      visit: 'Visit',
      visits: 'Visits',
      campaign: 'Campaign',
      campaigns: 'Campaigns',
      reception: 'Reception Desk',
      packages: 'Packages',
      gallery: 'Gallery',
      feedback: 'Feedback',
      lab: 'Lab',
    },
    dashboard: {
      todayAppointments: "Today's Appointments",
      activePatients: 'Active Patients',
      activeStaff: 'Active Staff',
      scheduleTitle: "Today's Schedule",
      topStaff: 'Top Doctors',
      servicesConfigured: 'Services configured',
      portalFeatures: 'Portal Features',
    },
    modules: {
      reception: { label: 'Reception Desk', desc: 'Today appointments, invoices, check-in and handover', icon: 'WalletCards' },
      appointments: { label: 'Appointments', desc: 'Calendar, doctor availability and booking', icon: 'Calendar' },
      clients: { label: 'Patients', desc: 'Operational profiles, appointment history, dues and follow-ups', icon: 'Users' },
      clinical: { label: 'Operations', desc: 'Appointment workload and operational patient workflow', icon: 'Stethoscope' },
      staff: { label: 'Staff', desc: 'Doctor profiles, salaries, commissions and access', icon: 'UserCheck' },
      services: { label: 'Services', desc: 'Treatment categories, durations and pricing', icon: 'Stethoscope' },
      financials: { label: 'Financials', desc: 'Revenue, dues and payment summaries', icon: 'DollarSign' },
      packages: { label: 'Packages', desc: 'Clinic plans and bundled services', icon: 'Package' },
      invoices: { label: 'Invoices', desc: 'Live billing CRUD, payments, refunds and PDFs', icon: 'Receipt' },
      lab: { label: 'Lab', desc: 'External lab work and due dates', icon: 'FlaskConical' },
      inventory: { label: 'Inventory', desc: 'Stock tracking and supply movement', icon: 'Archive' },
      gallery: { label: 'Private Media', desc: 'Private operational patient documents and media', icon: 'Image' },
      feedback: { label: 'Feedback', desc: 'Patient feedback and staff performance', icon: 'MessageSquare' },
      marketing: { label: 'Marketing', desc: 'Patient engagement and campaigns', icon: 'Megaphone' },
      whatsapp: { label: 'WhatsApp Center', desc: 'Patient engagement and campaigns', icon: 'MessageCircle' },
      ai: { label: 'AI Hub', desc: 'ChatGPT, Gemini, Claude config and failover', icon: 'Bot' },
      aiReceptionist: { label: 'AI Receptionist', desc: 'AI front desk and intake workflows', icon: 'Sparkles' },
      metaLeads: { label: 'Meta Leads', desc: 'Facebook and Instagram leads to CRM workflow', icon: 'Facebook' },
      imports: { label: 'Import Center', desc: 'CSV, Excel, Google Sheets and CRM migration jobs', icon: 'Database' },
      reports: { label: 'Reports', desc: 'Live reports with zero fake collections', icon: 'FileBarChart' },
      branches: { label: 'Branches', desc: 'Branch CRUD and WhatsApp routing', icon: 'Building2' },
      audit: { label: 'Audit Trail', desc: 'Track portal activity and changes', icon: 'Shield' },
      support: { label: 'Support', desc: 'Support tickets and platform help', icon: 'LifeBuoy' },
      settings: { label: 'Settings', desc: 'Clinic profile, public site and branding', icon: 'Settings' },
    },
    dashboardModules: {
      reception: { label: 'Reception Desk', desc: 'Today appointments, invoices, check-in and handover', icon: 'WalletCards' },
      clinical: { label: 'Operations Workspace', desc: 'Appointment workload and operational patient workflow', icon: 'Stethoscope' },
      clients: { label: 'Patients', desc: 'Operational profiles, appointment history, dues and follow-ups', icon: 'Users' },
      appointments: { label: 'Appointments', desc: 'Calendar, doctor availability and booking', icon: 'Calendar' },
      invoices: { label: 'Invoices & Dues', desc: 'Live billing CRUD, payments, refunds and PDFs', icon: 'Receipt' },
      staff: { label: 'Staff & Doctors', desc: 'Doctor profiles, salaries, commissions and access', icon: 'UserCheck' },
      services: { label: 'Treatment Services', desc: 'Treatment categories, durations and pricing', icon: 'Stethoscope' },
      branches: { label: 'Branches', desc: 'Branch CRUD and WhatsApp routing', icon: 'Archive' },
      packages: { label: 'Packages', desc: 'Clinic plans and bundled services', icon: 'Package' },
      whatsapp: { label: 'WhatsApp Center', desc: 'Patient engagement and campaigns', icon: 'Megaphone' },
      ai: { label: 'AI Hub', desc: 'ChatGPT, Gemini, Claude config and failover', icon: 'Bot' },
      metaLeads: { label: 'Meta Lead Center', desc: 'Facebook and Instagram leads to CRM workflow', icon: 'Facebook' },
      imports: { label: 'Import Center', desc: 'CSV, Excel, Google Sheets and CRM migration jobs', icon: 'Database' },
      reports: { label: 'Reports', desc: 'Live reports with zero fake collections', icon: 'FileBarChart' },
      gallery: { label: 'Private Media', desc: 'Private operational patient documents and media', icon: 'Image' },
      audit: { label: 'Security Audit', desc: 'Track portal activity and changes', icon: 'Shield' },
      settings: { label: 'Branding Settings', desc: 'Clinic profile, public site and branding', icon: 'Settings' },
    },
  },
};

function mergeConfig(base, override) {
  const out = { ...base, ...(override || {}) };
  out.terms = { ...(base.terms || {}), ...((override || {}).terms || {}) };
  out.dashboard = { ...(base.dashboard || {}), ...((override || {}).dashboard || {}) };
  out.modules = { ...(base.modules || {}), ...((override || {}).modules || {}) };
  out.dashboardModules = { ...(base.dashboardModules || {}), ...((override || {}).dashboardModules || {}) };
  return out;
}

export function resolveIndustryTemplate(template) {
  const incomingConfig = template?.config || template?.configJson || {};
  return {
    templateKey: template?.templateKey || HEALTHCARE_TEMPLATE_KEY,
    name: template?.name || 'Healthcare',
    config: mergeConfig(healthcareIndustryConfig.config, incomingConfig),
  };
}

export function termFromTemplate(template, key, fallback = '') {
  const resolved = resolveIndustryTemplate(template);
  return resolved.config.terms?.[key] || fallback || healthcareIndustryConfig.config.terms[key] || key;
}
