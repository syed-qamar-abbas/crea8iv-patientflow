/* ===========================================================================
   PatientFlow — SINGLE SOURCE OF TRUTH
   ---------------------------------------------------------------------------
   Every feature, plan, changelog entry and roadmap item is defined ONCE here.
   All marketing pages (home, pricing, package pages, comparison, What's New,
   roadmap, search) render from this object via js/render.js. Add a feature or
   ship a release by editing this file — the whole site updates automatically.
   =========================================================================== */
window.PF = (function () {
  // ---- Plans -------------------------------------------------------------
  const PLANS = {
    starter: {
      id: 'starter',
      name: 'Starter',
      tagline: 'Everything to run the clinic, end to end.',
      pricePKR: 50000,
      period: 'month',
      annualOffer: {
        label: 'Yearly offer',
        annualPricePKR: 50000,
        note: 'Pay the full yearly amount in advance to activate this offer.',
      },
      blurb: 'The operations platform for a modern clinic — appointments, operational patient profiles, billing, inventory, staff and your own booking site. Not an EHR.',
      bestFor: 'Single-location clinics that want to replace registers, spreadsheets and WhatsApp chaos with one clean system.',
      accent: '#FE6A09',
      highlight: false,
      ctaLabel: 'Get Started',
    },
    ai: {
      id: 'ai',
      name: 'AppointmentFlow AI',
      tagline: 'Starter + automation that fills your calendar for you.',
      pricePKR: 40000,
      period: 'month',
      annualOffer: {
        label: '30% off yearly',
        annualPricePKR: 336000,
        note: 'Billed once in advance for 12 months.',
      },
      blurb: 'Everything in Starter, plus WhatsApp automation, an AI receptionist, review generation and reactivation campaigns that turn your existing patient list into predictable monthly revenue.',
      bestFor: 'Growth-minded clinics that want appointments booked automatically — recalls, reminders, reviews and reactivation running 24/7.',
      accent: '#FF8A2A',
      highlight: true,
      ctaLabel: 'Book a Demo',
    },
  };

  // ---- Feature categories (order = display order) ------------------------
  const CATEGORIES = [
    { id: 'operations', name: 'Clinic Operations', icon: 'calendar' },
    { id: 'patients', name: 'Patient Operations', icon: 'users' },
    { id: 'billing', name: 'Billing & Finance', icon: 'receipt' },
    { id: 'growth', name: 'Growth & Marketing', icon: 'trending' },
    { id: 'ai', name: 'AI & Automation', icon: 'sparkles' },
    { id: 'platform', name: 'Platform & Security', icon: 'shield' },
  ];

  // ---- Features (the registry) ------------------------------------------
  // plans: which plans include it. outcome: the business result (for ROI/cards).
  const FEATURES = [
    // Operations
    { id: 'appointments', name: 'Smart Appointments', category: 'operations', icon: 'calendar', plans: ['starter', 'ai'], desc: 'Chairside scheduling with conflict detection, drag-to-reschedule, colour-coded calendars and per-doctor availability.', outcome: 'No double-bookings, fewer gaps.' },
    { id: 'reception', name: 'Reception Desk', category: 'operations', icon: 'monitor', plans: ['starter', 'ai'], desc: 'A live front-desk board — today\'s patients, check-ins, waiting list and quick actions in one screen.', outcome: 'Faster front desk, calmer mornings.' },
    { id: 'multibranch', name: 'Multi-Branch', category: 'operations', icon: 'building', plans: ['starter', 'ai'], desc: 'Run multiple locations under one login with per-branch staff, calendars and reporting.', outcome: 'Scale to new locations cleanly.' },
    { id: 'inventory', name: 'Inventory & Stock', category: 'operations', icon: 'box', plans: ['starter', 'ai'], desc: 'Track consumables and materials, low-stock alerts and per-transaction movement.', outcome: 'Never run out mid-procedure.' },
    { id: 'staff', name: 'Staff & Roles', category: 'operations', icon: 'idcard', plans: ['starter', 'ai'], desc: 'Role-based access for owners, managers, doctors, reception and accountants — everyone sees exactly what they should.', outcome: 'Security + accountability.' },

    // Patients & clinical
    { id: 'records', name: 'Patient Profiles', category: 'patients', icon: 'folder', plans: ['starter', 'ai'], desc: 'Operational contact profiles, private documents and searchable typeahead by name, phone, email or patient number.', outcome: 'Find any patient in seconds.' },
    { id: 'clinical', name: 'Historical Treatment View', category: 'patients', icon: 'tooth', plans: ['starter', 'ai'], desc: 'Existing treatment and procedure data remains available as read-only reference data; PatientFlow is not an EHR.', outcome: 'Preserve continuity without unsafe charting claims.' },
    { id: 'documents', name: 'Private Documents & Media', category: 'patients', icon: 'image', plans: ['starter', 'ai'], desc: 'Authorized staff can store private patient documents and media over secure signed links; public patient-image publishing is disabled.', outcome: 'Keep operational files private.' },
    { id: 'feedback', name: 'Patient Feedback', category: 'patients', icon: 'star', plans: ['starter', 'ai'], desc: 'Capture visit feedback and satisfaction so you act on issues before they become bad reviews.', outcome: 'Protect your reputation.' },

    // Billing & finance
    { id: 'billing', name: 'Invoicing & Billing', category: 'billing', icon: 'receipt', plans: ['starter', 'ai'], desc: 'Professional invoices with your bank details, flexible discounts (amount or %), partial payments and one-click PDF/print.', outcome: 'Get paid faster, look professional.' },
    { id: 'packages', name: 'Treatment Packages', category: 'billing', icon: 'gift', plans: ['starter', 'ai'], desc: 'Sell and track multi-session treatment packages against a patient with remaining-balance tracking.', outcome: 'Upfront revenue, clear balances.' },
    { id: 'financials', name: 'Financials & P&L', category: 'billing', icon: 'chart', plans: ['starter', 'ai'], desc: 'Expenses, procedure costs, revenue trends and profit/margin reporting — the real health of the business.', outcome: 'Know your true profit.' },
    { id: 'dues', name: 'Dues & Balances', category: 'billing', icon: 'wallet', plans: ['starter', 'ai'], desc: 'Automatic patient balance tracking so pending payments never slip through.', outcome: 'Recover every rupee owed.' },

    // Growth & marketing
    { id: 'bookingsite', name: 'Public Booking Site', category: 'growth', icon: 'globe', plans: ['starter', 'ai'], desc: 'Your own branded booking website and embeddable widget so patients book themselves, 24/7.', outcome: 'Bookings while you sleep.' },
    { id: 'whatsapp', name: 'WhatsApp Center', category: 'growth', icon: 'whatsapp', plans: ['ai'], desc: 'A shared clinic WhatsApp inbox with templates, broadcasts and reply suggestions.', outcome: 'One number, whole team.' },
    { id: 'campaigns', name: 'Broadcast Campaigns', category: 'growth', icon: 'megaphone', plans: ['ai'], desc: 'Segment your patient list and send targeted WhatsApp campaigns — offers, recalls, announcements.', outcome: 'Turn your list into revenue.' },
    { id: 'reactivation', name: 'Patient Reactivation', category: 'growth', icon: 'refresh', plans: ['ai'], desc: 'Automatically win back patients who haven\'t visited in months with timed WhatsApp sequences.', outcome: 'Revenue from patients you already have.' },
    { id: 'reviews', name: 'Review Automation', category: 'growth', icon: 'stars', plans: ['ai'], desc: 'Request Google reviews from happy patients automatically after their visit.', outcome: 'More 5-star reviews, on autopilot.' },
    { id: 'metaleads', name: 'Meta Lead Capture', category: 'growth', icon: 'target', plans: ['ai'], desc: 'Pull Facebook/Instagram lead-form submissions straight into your pipeline.', outcome: 'No lead left cold.' },

    // AI & automation
    { id: 'ai-receptionist', name: 'AI Receptionist', category: 'ai', icon: 'robot', plans: ['ai'], desc: 'A per-clinic AI that answers patient questions, with its own persona, knowledge base and memory.', outcome: 'Answer patients 24/7.' },
    { id: 'ai-reminders', name: 'Automated Reminders', category: 'ai', icon: 'bell', plans: ['ai'], desc: 'Precise 24-hour and 2-hour appointment reminders over WhatsApp — no manual chasing.', outcome: 'Cut no-shows dramatically.' },
    { id: 'ai-recalls', name: 'Recall Campaigns', category: 'ai', icon: 'clock', plans: ['ai'], desc: 'Automatic recalls for cleanings, follow-ups and check-ups based on last visit.', outcome: 'Fill next month\'s calendar today.' },
    { id: 'ai-followups', name: 'AI Follow-ups', category: 'ai', icon: 'chat', plans: ['ai'], desc: 'Smart post-visit follow-ups and reply suggestions drafted for your team.', outcome: 'Personal touch, zero effort.' },

    // Platform & security
    { id: 'branding', name: 'White-Label Branding', category: 'platform', icon: 'palette', plans: ['starter', 'ai'], desc: 'Your logo, colours, domain and invoice identity across the whole portal.', outcome: 'It\'s your brand, not ours.' },
    { id: 'reports', name: 'Reports & Dashboards', category: 'platform', icon: 'gauge', plans: ['starter', 'ai'], desc: 'Live dashboards and reports across appointments, revenue, staff and patients.', outcome: 'Decisions from real data.' },
    { id: 'security', name: 'Security & Audit', category: 'platform', icon: 'lock', plans: ['starter', 'ai'], desc: 'Encrypted secrets, signed file access, tenant isolation and an audit trail on sensitive actions.', outcome: 'Patient data stays safe.' },
    { id: 'backups', name: 'Automated Backups', category: 'platform', icon: 'database', plans: ['starter', 'ai'], desc: 'Nightly database backups with offsite copies and self-heal recovery.', outcome: 'Your data is never lost.' },
  ];

  // ---- Success metrics ---------------------------------------------------
  const STATS = [
    { value: 159, suffix: '+', label: 'Patients managed live' },
    { value: 24, suffix: '/7', label: 'Automated reminders' },
    { value: 90, suffix: '%', label: 'Fewer missed follow-ups' },
    { value: 3, suffix: '×', label: 'Faster front desk' },
  ];

  // ---- Changelog (real releases) ----------------------------------------
  // types: feature | improvement | fix | performance | security | ai
  const CHANGELOG = [
    {
      version: '1.6.0', date: '2026-07-02', title: 'Enterprise hardening',
      impact: 'Bank-grade file security + automated backups & deploys.',
      entries: [
        { type: 'security', text: 'Patient files now served only through short-lived signed URLs — direct access blocked.' },
        { type: 'security', text: 'Automated test suite (41 checks) gating every release.' },
        { type: 'performance', text: 'Nightly encrypted offsite backups + one-click CI/CD deploys.' },
      ],
    },
    {
      version: '1.5.0', date: '2026-07-01', title: 'Speed & billing',
      impact: 'Instant page loads and flexible discounts.',
      entries: [
        { type: 'performance', text: 'Instant page loads with background refresh + skeleton loaders.' },
        { type: 'feature', text: 'Invoices: discount as a fixed amount or a percentage (your choice).' },
        { type: 'fix', text: 'Staff profiles now show real appointment counts and revenue.' },
      ],
    },
    {
      version: '1.4.0', date: '2026-06-30', title: 'Payments on invoices',
      impact: 'Patients know exactly where to pay.',
      entries: [
        { type: 'feature', text: 'Clinic bank & payment details on every invoice (PDF + on-screen), editable by the owner.' },
        { type: 'feature', text: 'Stamp / signature upload for a professional invoice.' },
      ],
    },
    {
      version: '1.3.0', date: '2026-06-27', title: 'Instant clinic portals',
      impact: 'Every clinic gets its own branded URL, zero setup.',
      entries: [
        { type: 'feature', text: 'Path-based clinic portals — every clinic reachable at its own branded URL with valid SSL.' },
        { type: 'improvement', text: 'Custom-domain support retained for clinics that own a domain.' },
      ],
    },
    {
      version: '1.2.0', date: '2026-06-22', title: 'Plans & AI receptionist',
      impact: 'Clear packages and a 24/7 AI front desk.',
      entries: [
        { type: 'ai', text: 'AI Receptionist foundation — per-clinic persona, knowledge base and memory.' },
        { type: 'feature', text: 'Starter and AppointmentFlow AI packages with centralized feature gating.' },
      ],
    },
    {
      version: '1.1.0', date: '2026-06-19', title: 'Financials & lab',
      impact: 'See true profit; track lab cases.',
      entries: [
        { type: 'feature', text: 'Financials: expenses, procedure costs and profit / margin reporting.' },
        { type: 'feature', text: 'Lab case management.' },
        { type: 'improvement', text: 'Industry templates — terminology adapts to your vertical.' },
      ],
    },
  ];

  // ---- Roadmap -----------------------------------------------------------
  // status: completed | progress | planned | research | community
  const ROADMAP = [
    { title: 'Online payments (JazzCash / Easypaisa)', status: 'progress', quarter: 'Q3 2026', desc: 'Let patients pay invoices online; auto-reconcile balances.', progress: 40, votes: 128 },
    { title: 'Patient mobile app', status: 'planned', quarter: 'Q4 2026', desc: 'Patients view appointments, invoices and documents on their phone.', progress: 0, votes: 96 },
    { title: 'Advanced analytics & cohorts', status: 'planned', quarter: 'Q4 2026', desc: 'Retention cohorts, revenue forecasting and per-doctor performance.', progress: 0, votes: 74 },
    { title: 'Two-factor authentication & SSO', status: 'progress', quarter: 'Q3 2026', desc: 'TOTP 2FA and Google Workspace sign-in for clinic staff.', progress: 25, votes: 61 },
    { title: 'AI Receptionist — live deployment', status: 'progress', quarter: 'Q3 2026', desc: 'Roll the AI front desk out to production clinics.', progress: 55, votes: 143 },
    { title: 'Urdu language (i18n)', status: 'research', quarter: 'Exploring', desc: 'Full Urdu interface for staff and patients.', progress: 0, votes: 52 },
    { title: 'Insurance & claims module', status: 'community', quarter: 'Requested', desc: 'Track insurance claims and approvals.', progress: 0, votes: 38 },
    { title: 'Signed file access & offsite backups', status: 'completed', quarter: 'Shipped', desc: 'Bank-grade file security and automated backups.', progress: 100, votes: 0 },
    { title: 'Instant page loads', status: 'completed', quarter: 'Shipped', desc: 'Stale-while-revalidate caching + skeletons.', progress: 100, votes: 0 },
    { title: 'Path-based clinic portals', status: 'completed', quarter: 'Shipped', desc: 'Every clinic on its own branded URL.', progress: 100, votes: 0 },
  ];

  const ROADMAP_STATUSES = [
    { id: 'completed', name: 'Completed', color: '#25D366' },
    { id: 'progress', name: 'In Progress', color: '#FE6A09' },
    { id: 'planned', name: 'Planned', color: '#FF8A2A' },
    { id: 'research', name: 'Research', color: '#FFB347' },
    { id: 'community', name: 'Community Requests', color: '#8B93A7' },
  ];

  // ---- FAQs --------------------------------------------------------------
  const FAQS = [
    { q: 'Is my patient data secure?', a: 'Yes. Data is encrypted, files are served only through signed links, every clinic is fully isolated from every other, sensitive actions are audit-logged, and the database is backed up nightly with offsite copies.' },
    { q: 'Do I need to install anything?', a: 'No. PatientFlow runs in any browser on desktop, tablet and mobile. Your clinic gets its own branded URL instantly — no setup, no servers.' },
    { q: 'Can I use my own clinic domain?', a: 'Yes. You can run on your own domain (e.g. portal.yourclinic.com) with valid SSL, or use the free branded URL we provide.' },
    { q: 'What\'s the difference between the two plans?', a: 'Starter runs clinic operations — appointments, patient profiles, billing, staff and your booking site. AppointmentFlow AI adds WhatsApp automation, an administrative AI receptionist, review generation and reactivation campaigns.' },
    { q: 'Can I switch or upgrade later?', a: 'Absolutely. You can upgrade from Starter to AppointmentFlow AI at any time and every feature turns on instantly — your data stays exactly where it is.' },
    { q: 'Is there a contract?', a: 'Monthly plans renew month to month. Yearly offers require the full advance payment for the year. Your data is always yours and always exportable.' },
  ];

  // ---- Use cases ---------------------------------------------------------
  const USE_CASES = [
    { id: 'dental', name: 'Dental Clinics', icon: 'tooth', desc: 'Scheduling, recalls, treatment-package billing and private patient media.' },
    { id: 'aesthetic', name: 'Aesthetic & Skin', icon: 'sparkles', desc: 'Package sessions, consent documents, reactivation and review generation.' },
    { id: 'medical', name: 'Medical & GP', icon: 'stethoscope', desc: 'Operational patient profiles, appointments, billing and automated reminders.' },
    { id: 'physio', name: 'Physiotherapy', icon: 'activity', desc: 'Session packages, recall campaigns and progress tracking.' },
    { id: 'multi', name: 'Multi-Branch Groups', icon: 'building', desc: 'One login across locations with per-branch staff, calendars and reporting.' },
  ];

  // ---- Interface showcase screens ---------------------------------------
  // Each tab renders a UI mockup + the registry features it demonstrates.
  const SCREENS = [
    { id: 'dashboard', name: 'Dashboard', blurb: 'Your whole clinic at a glance — today\'s appointments, revenue, dues and staff, live.', features: ['reports', 'appointments', 'financials', 'dues'] },
    { id: 'appointments', name: 'Appointments', blurb: 'A clean scheduling calendar with reminders, reschedule and conflict detection.', features: ['appointments', 'reception', 'ai-reminders'] },
    { id: 'billing', name: 'Billing', blurb: 'Professional invoices with your bank details, flexible discounts and instant PDF.', features: ['billing', 'dues', 'packages'] },
    { id: 'patients', name: 'Patients', blurb: 'Operational profiles, read-only historical treatment data and private documents — searchable in seconds.', features: ['records', 'clinical', 'documents'] },
    { id: 'automation', name: 'AI & WhatsApp', blurb: 'Reminders, reactivation, reviews and an AI receptionist — working 24/7.', features: ['whatsapp', 'ai-receptionist', 'reviews', 'reactivation'] },
  ];

  // ---- Security & compliance (for the security page) --------------------
  const SECURITY = [
    { icon: 'lock', title: 'Encryption everywhere', desc: 'All traffic is encrypted (HTTPS/TLS). Sensitive secrets like AI keys are encrypted at rest with AES-256.' },
    { icon: 'shield', title: 'Complete tenant isolation', desc: 'Every clinic\'s data is fully separated. Queries are scoped per clinic — one clinic can never see another\'s data.' },
    { icon: 'idcard', title: 'Role-based access (RBAC)', desc: 'Owners, managers, doctors, reception and accountants each see exactly what they should — enforced on every request.' },
    { icon: 'image', title: 'Signed file access', desc: 'Patient photos and documents are never public. They\'re served only through short-lived, signed links that expire.' },
    { icon: 'database', title: 'Automated backups', desc: 'The database is backed up nightly with encrypted offsite copies and self-heal recovery — your data is never lost.' },
    { icon: 'folder', title: 'Audit trail', desc: 'Sensitive actions — deletes, refunds, admin access — are logged with who, what and when.' },
    { icon: 'check', title: 'Login protection', desc: 'Passwords are hashed with bcrypt, logins are rate-limited per user and IP, and sessions use rotating tokens.' },
    { icon: 'globe', title: 'Your data is yours', desc: 'Export your data anytime. No lock-in. Retained for 90 days after expiry so renewing restores everything.' },
  ];

  // ---- AI capabilities (for the AI showcase page) -----------------------
  const AI_CAPS = [
    { icon: 'robot', title: 'AI Receptionist', tag: 'Live', desc: 'A per-clinic AI with its own persona, knowledge base and memory that answers patient questions around the clock.' },
    { icon: 'bell', title: 'Smart Reminders', tag: 'Live', desc: 'Precise 24-hour and 2-hour WhatsApp reminders that dramatically cut no-shows — fully automatic.' },
    { icon: 'refresh', title: 'Patient Reactivation', tag: 'Live', desc: 'Timed WhatsApp sequences win back patients who haven\'t visited in months.' },
    { icon: 'stars', title: 'Review Generation', tag: 'Live', desc: 'Happy patients are automatically asked for a Google review after their visit.' },
    { icon: 'clock', title: 'Recall Campaigns', tag: 'Live', desc: 'Automatic recalls for cleanings and follow-ups based on each patient\'s last visit.' },
    { icon: 'chat', title: 'AI Reply Suggestions', tag: 'Live', desc: 'Smart, on-brand reply drafts for your WhatsApp inbox — a personal touch with zero effort.' },
    { icon: 'sparkles', title: 'Governed Clinical AI', tag: 'Future / gated', desc: 'Not available unless a compliant clinical model, clinician verification, provenance, and audit controls are implemented.' },
    { icon: 'chart', title: 'Predictive Insights', tag: 'Soon', desc: 'Forecast no-shows, revenue and which patients are about to lapse — before they do.' },
  ];

  // ---- Derived helpers ---------------------------------------------------
  function featuresForPlan(planId) { return FEATURES.filter(f => f.plans.includes(planId)); }
  function featuresByCategory(planId) {
    return CATEGORIES.map(cat => ({
      ...cat,
      features: FEATURES.filter(f => f.category === cat.id && (!planId || f.plans.includes(planId))),
    })).filter(cat => cat.features.length);
  }
  function fmtPrice(n) { return 'PKR ' + n.toLocaleString('en-US'); }

  function featureById(id) { return FEATURES.find(f => f.id === id); }

  return {
    PLANS, CATEGORIES, FEATURES, STATS, CHANGELOG, ROADMAP, ROADMAP_STATUSES,
    FAQS, USE_CASES, SCREENS, SECURITY, AI_CAPS,
    featuresForPlan, featuresByCategory, fmtPrice, featureById,
    planList: Object.values(PLANS),
  };
})();
