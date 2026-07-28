export const TEMPLATE_SCHEMA_VERSION = 2;
export const HEALTHCARE_TEMPLATE_KEY = 'healthcare';

const coreModules = {
  reception: { label: 'Reception Desk', desc: 'Today schedule, invoices, check-in and handover', icon: 'WalletCards', visible: true },
  appointments: { label: 'Appointments', desc: 'Calendar, availability and booking', icon: 'Calendar', visible: true },
  clients: { label: 'Patients', desc: 'Operational profiles, history, dues and follow-ups', icon: 'Users', visible: true },
  clinical: { label: 'Operations', desc: 'Operational workload and service workflow', icon: 'Stethoscope', visible: true },
  staff: { label: 'Staff', desc: 'Team profiles, compensation and access', icon: 'UserCheck', visible: true },
  services: { label: 'Services', desc: 'Service categories, durations and pricing', icon: 'Stethoscope', visible: true },
  financials: { label: 'Financials', desc: 'Revenue, dues and payment summaries', icon: 'DollarSign', visible: true },
  packages: { label: 'Packages', desc: 'Plans and bundled services', icon: 'Package', visible: true },
  invoices: { label: 'Invoices', desc: 'Billing, payments, refunds and PDFs', icon: 'Receipt', visible: true },
  lab: { label: 'Lab', desc: 'External lab work and due dates', icon: 'FlaskConical', visible: true },
  inventory: { label: 'Inventory', desc: 'Stock tracking and supply movement', icon: 'Archive', visible: true },
  gallery: { label: 'Private Media', desc: 'Private operational documents and media', icon: 'Image', visible: true },
  feedback: { label: 'Feedback', desc: 'Customer feedback and team performance', icon: 'MessageSquare', visible: true },
  marketing: { label: 'Marketing', desc: 'Engagement and campaigns', icon: 'Megaphone', visible: true },
  outreach: { label: 'Manual Outreach', desc: 'Manual WhatsApp reminders, follow-ups and broadcast lists', icon: 'MessageCircle', visible: true },
  whatsapp: { label: 'WhatsApp Center', desc: 'Conversations, reminders and campaigns', icon: 'MessageCircle', visible: true },
  ai: { label: 'AI Hub', desc: 'AI provider configuration and failover', icon: 'Bot', visible: true },
  aiReceptionist: { label: 'AI Receptionist', desc: 'AI front desk and intake workflows', icon: 'Sparkles', visible: true },
  metaLeads: { label: 'Meta Leads', desc: 'Facebook and Instagram leads to CRM workflow', icon: 'Facebook', visible: true },
  imports: { label: 'Import Center', desc: 'CSV, Excel, Sheets and CRM migration jobs', icon: 'Database', visible: true },
  reports: { label: 'Reports', desc: 'Live operational and financial reports', icon: 'FileBarChart', visible: true },
  branches: { label: 'Branches', desc: 'Location management and message routing', icon: 'Building2', visible: true },
  audit: { label: 'Audit Trail', desc: 'Track portal activity and changes', icon: 'Shield', visible: true },
  support: { label: 'Support', desc: 'Support tickets and platform help', icon: 'LifeBuoy', visible: true },
  settings: { label: 'Settings', desc: 'Business profile, public site and branding', icon: 'Settings', visible: true },
};

const baseConfig = {
  schemaVersion: TEMPLATE_SCHEMA_VERSION,
  vertical: 'healthcare',
  primaryGoal: { key: 'book_appointment', label: 'Book Appointment', eventType: 'appointment' },
  terms: {
    business: 'Clinic', clinic: 'Clinic', appointment: 'Appointment', appointments: 'Appointments',
    patient: 'Patient', patients: 'Patients', client: 'Patient', clients: 'Patients',
    doctor: 'Doctor', doctors: 'Doctors', staff: 'Staff', service: 'Treatment Service',
    services: 'Treatment Services', treatment: 'Treatment', treatments: 'Treatments',
    clinical: 'Operations', clinicalWorkspace: 'Operations Workspace', clinicalNotes: 'Operational Notes',
    recall: 'Recall', recalls: 'Recalls', visit: 'Visit', visits: 'Visits', campaign: 'Campaign',
    campaigns: 'Campaigns', reception: 'Reception Desk', packages: 'Packages', gallery: 'Private Media',
    feedback: 'Feedback', lab: 'Lab', lead: 'Lead', leads: 'Leads', project: 'Case', projects: 'Cases',
  },
  capabilities: {
    appointments: true, meetings: false, pipeline: false, projects: false, properties: false,
    lab: true, stockInventory: true, privateMedia: true, packages: true, invoicing: true,
    dentalContext: false, aestheticContext: false, specialtySwitcher: false,
    clinicalRecordEntry: false, procedureEntry: false, medicalHistoryEntry: false, publicPatientMedia: false,
  },
  navigation: {
    groups: [
      { key: 'main', label: 'Main Menu', modules: ['dashboard', 'reception', 'appointments', 'clients', 'clinical', 'staff', 'services', 'financials'] },
      { key: 'billing', label: 'Billing & Packages', modules: ['packages', 'invoices', 'prescriptions'] },
      { key: 'operations', label: 'Operations', modules: ['lab', 'inventory', 'gallery', 'feedback'] },
      { key: 'growth', label: 'Growth', modules: ['marketing', 'outreach', 'whatsapp', 'ai', 'aiReceptionist', 'metaLeads', 'imports', 'reports', 'branches'] },
      { key: 'admin', label: 'Admin', modules: ['audit', 'support', 'settings'] },
    ],
  },
  scheduling: {
    defaultEventType: 'appointment',
    eventTypes: [
      { key: 'appointment', label: 'Appointment' },
      { key: 'consultation', label: 'Consultation' },
      { key: 'follow_up', label: 'Follow-up' },
    ],
  },
  profile: {
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'notes', label: 'Operational Notes', type: 'textarea' },
    ],
  },
  workflow: { key: 'appointment_flow', stages: ['new', 'confirmed', 'checked_in', 'completed', 'cancelled'] },
  dashboard: {
    todayAppointments: "Today's Appointments", activePatients: 'Active Patients', activeStaff: 'Active Staff',
    scheduleTitle: "Today's Schedule", topStaff: 'Top Doctors', servicesConfigured: 'Services configured',
    portalFeatures: 'Portal Features', primaryAction: 'Book Appointment',
  },
  modules: coreModules,
  dashboardModules: coreModules,
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeTemplateConfig(base, override) {
  if (!isPlainObject(base)) return override === undefined ? base : override;
  const result = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    result[key] = isPlainObject(value) && isPlainObject(base[key])
      ? mergeTemplateConfig(base[key], value)
      : value;
  });
  return result;
}

function template(templateKey, name, override = {}) {
  return { templateKey, name, config: mergeTemplateConfig(baseConfig, override) };
}

const healthcareLegacy = template(HEALTHCARE_TEMPLATE_KEY, 'Healthcare (Legacy)', {});

const dentalClinic = template('dental_clinic', 'Dental Clinic', {
  vertical: 'dental',
  terms: { business: 'Dental Clinic', clinic: 'Clinic', doctor: 'Dentist', doctors: 'Dentists', service: 'Dental Service', services: 'Dental Services', treatment: 'Treatment', treatments: 'Treatments' },
  capabilities: { dentalContext: true },
  profile: { fields: [
    { key: 'name', label: 'Patient Name', type: 'text', required: true },
    { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'appointmentConcern', label: 'Appointment Concern', type: 'textarea' },
    { key: 'notes', label: 'Operational Notes', type: 'textarea' },
  ] },
  modules: { clinical: { label: 'Dental Operations', desc: 'Dental appointment workload and operational patient workflow' }, lab: { visible: true }, inventory: { label: 'Dental Inventory', visible: true } },
  dashboard: { topStaff: 'Top Dentists', primaryAction: 'Book Dental Appointment' },
});

const aestheticClinic = template('aesthetic_clinic', 'Aesthetic Clinic', {
  vertical: 'aesthetics',
  terms: { business: 'Aesthetic Clinic', clinic: 'Clinic', doctor: 'Practitioner', doctors: 'Practitioners', service: 'Aesthetic Service', services: 'Aesthetic Services', treatment: 'Treatment', treatments: 'Treatments', recall: 'Next Session', recalls: 'Next Sessions' },
  capabilities: { aestheticContext: true, lab: false },
  scheduling: { eventTypes: [{ key: 'consultation', label: 'Consultation' }, { key: 'treatment_session', label: 'Treatment Session' }, { key: 'follow_up', label: 'Follow-up' }] },
  profile: { fields: [
    { key: 'name', label: 'Client Name', type: 'text', required: true },
    { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'concern', label: 'Aesthetic Concern', type: 'textarea' },
    { key: 'treatmentArea', label: 'Treatment Area', type: 'text' },
    { key: 'notes', label: 'Operational Notes', type: 'textarea' },
  ] },
  modules: { clinical: { label: 'Aesthetic Operations', desc: 'Consultations, sessions and follow-up workflow' }, lab: { visible: false }, inventory: { label: 'Product Inventory' } },
  dashboard: { todayAppointments: "Today's Consultations & Sessions", topStaff: 'Top Practitioners', primaryAction: 'Book Consultation' },
});

const dentalAesthetic = template('dental_aesthetic_clinic', 'Dental & Aesthetic Clinic', {
  vertical: 'dental_aesthetics',
  terms: { business: 'Dental & Aesthetic Clinic', doctor: 'Practitioner', doctors: 'Practitioners', service: 'Treatment Service', services: 'Treatment Services' },
  capabilities: { dentalContext: true, aestheticContext: true, specialtySwitcher: true },
  scheduling: { eventTypes: [{ key: 'dental_appointment', label: 'Dental Appointment' }, { key: 'aesthetic_consultation', label: 'Aesthetic Consultation' }, { key: 'treatment_session', label: 'Treatment Session' }, { key: 'follow_up', label: 'Follow-up' }] },
  profile: { fields: [
    { key: 'name', label: 'Patient Name', type: 'text', required: true },
    { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'specialty', label: 'Service Area', type: 'select', options: ['dental', 'aesthetics', 'both'] },
    { key: 'appointmentConcern', label: 'Appointment Concern', type: 'textarea' },
    { key: 'notes', label: 'Operational Notes', type: 'textarea' },
  ] },
  modules: { clinical: { label: 'Treatment Operations', desc: 'Dental and aesthetic appointment workflow' } },
  dashboard: { topStaff: 'Top Practitioners', primaryAction: 'Book Appointment' },
});

const interiorsArchitects = template('interiors_architects', 'Interiors & Architects', {
  vertical: 'professional_services',
  primaryGoal: { key: 'schedule_consultation', label: 'Schedule Consultation', eventType: 'consultation' },
  terms: { business: 'Design Studio', clinic: 'Studio', appointment: 'Consultation', appointments: 'Consultations', patient: 'Client', patients: 'Clients', client: 'Client', clients: 'Clients', doctor: 'Architect / Designer', doctors: 'Architects & Designers', service: 'Project Type', services: 'Project Types', treatment: 'Project', treatments: 'Projects', clinical: 'Projects', clinicalWorkspace: 'Project Workspace', clinicalNotes: 'Project Notes', recall: 'Proposal Follow-up', recalls: 'Proposal Follow-ups', visit: 'Site Visit', visits: 'Site Visits', project: 'Project', projects: 'Projects' },
  capabilities: { meetings: true, pipeline: true, projects: true, lab: false, stockInventory: false, packages: false },
  scheduling: { defaultEventType: 'consultation', eventTypes: [{ key: 'consultation', label: 'Consultation' }, { key: 'site_visit', label: 'Site Visit' }, { key: 'design_review', label: 'Design Review' }] },
  workflow: { key: 'design_project_pipeline', stages: ['inquiry', 'qualified', 'consultation', 'site_visit', 'proposal', 'won', 'in_progress', 'delivered', 'lost'] },
  profile: { fields: [
    { key: 'name', label: 'Client Name', type: 'text', required: true }, { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' }, { key: 'propertyType', label: 'Property Type', type: 'text' },
    { key: 'location', label: 'Project Location', type: 'text' }, { key: 'coveredArea', label: 'Covered Area', type: 'text' },
    { key: 'budgetRange', label: 'Estimated Budget', type: 'money_range' }, { key: 'preferredStyle', label: 'Preferred Style', type: 'text' },
    { key: 'targetDate', label: 'Target Date', type: 'date' }, { key: 'notes', label: 'Project Notes', type: 'textarea' },
  ] },
  modules: { reception: { label: 'Meeting Desk' }, appointments: { label: 'Consultations' }, clients: { label: 'Clients' }, clinical: { label: 'Project Pipeline', icon: 'ClipboardList' }, staff: { label: 'Architects & Designers' }, services: { label: 'Project Types' }, lab: { visible: false }, inventory: { visible: false }, packages: { visible: false }, gallery: { label: 'Project Media' }, settings: { desc: 'Studio profile, public site and branding' } },
  dashboard: { todayAppointments: 'Consultations Today', activePatients: 'Active Clients', activeStaff: 'Active Designers', scheduleTitle: "Today's Consultations", topStaff: 'Top Designers', servicesConfigured: 'Project types configured', primaryAction: 'Schedule Consultation' },
});

const realEstate = template('real_estate', 'Real Estate', {
  vertical: 'real_estate',
  primaryGoal: { key: 'schedule_meeting', label: 'Schedule Meeting', eventType: 'meeting' },
  terms: { business: 'Real Estate Business', clinic: 'Agency', appointment: 'Meeting', appointments: 'Meetings', patient: 'Lead', patients: 'Leads', client: 'Lead', clients: 'Leads', doctor: 'Agent', doctors: 'Agents', service: 'Property', services: 'Properties', treatment: 'Property', treatments: 'Properties', clinical: 'Deals', clinicalWorkspace: 'Deal Pipeline', clinicalNotes: 'Lead Notes', recall: 'Lead Follow-up', recalls: 'Lead Follow-ups', visit: 'Property Viewing', visits: 'Property Viewings' },
  capabilities: { meetings: true, pipeline: true, properties: true, lab: false, stockInventory: false, packages: false },
  scheduling: { defaultEventType: 'meeting', eventTypes: [{ key: 'meeting', label: 'Office Meeting' }, { key: 'property_viewing', label: 'Property Viewing' }, { key: 'call', label: 'Phone / Video Call' }] },
  workflow: { key: 'real_estate_pipeline', stages: ['new', 'contacted', 'qualified', 'meeting', 'viewing', 'negotiation', 'won', 'lost'] },
  profile: { fields: [
    { key: 'name', label: 'Lead Name', type: 'text', required: true }, { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' }, { key: 'intent', label: 'Looking To', type: 'select', options: ['buy', 'rent', 'sell', 'invest'] },
    { key: 'propertyType', label: 'Property Type', type: 'text' }, { key: 'preferredLocation', label: 'Preferred Location', type: 'text' },
    { key: 'budgetRange', label: 'Budget Range', type: 'money_range' }, { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
    { key: 'leadSource', label: 'Lead Source', type: 'text' }, { key: 'notes', label: 'Lead Notes', type: 'textarea' },
  ] },
  modules: { reception: { label: 'Lead Desk' }, appointments: { label: 'Meetings & Viewings' }, clients: { label: 'Leads' }, clinical: { label: 'Deal Pipeline', icon: 'ClipboardList' }, staff: { label: 'Agents' }, services: { label: 'Properties' }, lab: { visible: false }, inventory: { label: 'Property Listings', desc: 'Available, reserved and sold property listings', visible: true }, packages: { visible: false }, gallery: { label: 'Property Media' }, feedback: { label: 'Client Feedback' }, settings: { desc: 'Agency profile, public site and branding' } },
  dashboard: { todayAppointments: 'Meetings & Viewings Today', activePatients: 'Active Leads', activeStaff: 'Active Agents', scheduleTitle: "Today's Meetings", topStaff: 'Top Agents', servicesConfigured: 'Properties listed', primaryAction: 'Schedule Meeting' },
});

const marketingAgency = template('marketing_agency', 'Marketing Agency', {
  vertical: 'professional_services',
  primaryGoal: { key: 'schedule_discovery', label: 'Schedule Discovery Meeting', eventType: 'discovery_meeting' },
  terms: { business: 'Marketing Agency', clinic: 'Agency', appointment: 'Meeting', appointments: 'Meetings', patient: 'Client', patients: 'Clients', client: 'Client', clients: 'Clients', doctor: 'Account Manager', doctors: 'Account Managers', service: 'Service', services: 'Services', treatment: 'Project', treatments: 'Projects', clinical: 'Client Delivery', clinicalWorkspace: 'Client Delivery', clinicalNotes: 'Project Notes', recall: 'Renewal Follow-up', recalls: 'Renewal Follow-ups', visit: 'Meeting', visits: 'Meetings', project: 'Project', projects: 'Projects' },
  capabilities: { meetings: true, pipeline: true, projects: true, lab: false, stockInventory: false },
  scheduling: { defaultEventType: 'discovery_meeting', eventTypes: [{ key: 'discovery_meeting', label: 'Discovery Meeting' }, { key: 'strategy_call', label: 'Strategy Call' }, { key: 'review_meeting', label: 'Performance Review' }] },
  workflow: { key: 'agency_sales_pipeline', stages: ['lead', 'discovery', 'proposal', 'negotiation', 'onboarding', 'active', 'renewal', 'closed'] },
  profile: { fields: [
    { key: 'name', label: 'Client / Company Name', type: 'text', required: true }, { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' }, { key: 'industry', label: 'Industry', type: 'text' },
    { key: 'monthlyBudget', label: 'Monthly Marketing Budget', type: 'money' }, { key: 'requestedChannels', label: 'Requested Channels', type: 'multi_select', options: ['Meta Ads', 'Google Ads', 'SEO', 'Social Media', 'Web Development', 'Creative'] },
    { key: 'targetKpis', label: 'Target KPIs', type: 'textarea' }, { key: 'notes', label: 'Account Notes', type: 'textarea' },
  ] },
  modules: { reception: { label: 'Meeting Desk' }, appointments: { label: 'Meetings' }, clients: { label: 'Clients' }, clinical: { label: 'Client Pipeline', icon: 'ClipboardList' }, staff: { label: 'Agency Team' }, services: { label: 'Services' }, lab: { visible: false }, inventory: { visible: false }, gallery: { label: 'Creative Library' }, packages: { label: 'Retainers & Packages' }, marketing: { label: 'Client Campaigns' }, settings: { desc: 'Agency profile, public site and branding' } },
  dashboard: { todayAppointments: 'Meetings Scheduled', activePatients: 'Active Clients', activeStaff: 'Active Team', scheduleTitle: "Today's Meetings", topStaff: 'Top Account Managers', servicesConfigured: 'Services configured', primaryAction: 'Schedule Discovery Meeting' },
});

export const BUILT_IN_INDUSTRY_TEMPLATES = Object.freeze({
  healthcare: healthcareLegacy,
  dental_clinic: dentalClinic,
  aesthetic_clinic: aestheticClinic,
  dental_aesthetic_clinic: dentalAesthetic,
  interiors_architects: interiorsArchitects,
  real_estate: realEstate,
  marketing_agency: marketingAgency,
});

export const healthcareIndustryConfig = healthcareLegacy;

export function resolveIndustryTemplate(templateInput) {
  const input = typeof templateInput === 'string' ? { templateKey: templateInput } : (templateInput || {});
  const templateKey = input.templateKey || HEALTHCARE_TEMPLATE_KEY;
  const builtin = BUILT_IN_INDUSTRY_TEMPLATES[templateKey] || healthcareLegacy;
  const incomingConfig = input.config || input.configJson || {};
  return {
    templateKey,
    name: input.name || builtin.name,
    config: mergeTemplateConfig(builtin.config, incomingConfig),
  };
}

export function termFromTemplate(templateInput, key, fallback = '') {
  const resolved = resolveIndustryTemplate(templateInput);
  return resolved.config.terms?.[key] || fallback || healthcareLegacy.config.terms[key] || key;
}

export function templateCapability(templateInput, key, fallback = false) {
  const value = resolveIndustryTemplate(templateInput).config.capabilities?.[key];
  return value === undefined ? fallback : Boolean(value);
}

export function templateModule(templateInput, key) {
  return resolveIndustryTemplate(templateInput).config.modules?.[key] || null;
}

export function isTemplateModuleVisible(templateInput, key) {
  const module = templateModule(templateInput, key);
  return module ? module.visible !== false : true;
}
