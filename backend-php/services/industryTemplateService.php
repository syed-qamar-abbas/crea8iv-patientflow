<?php

const INDUSTRY_TEMPLATE_DEFAULT = 'healthcare';
const INDUSTRY_TEMPLATE_SCHEMA_VERSION = 2;

function industry_template_v2_base() {
    return [
        'schemaVersion' => INDUSTRY_TEMPLATE_SCHEMA_VERSION,
        'vertical' => 'healthcare',
        'primaryGoal' => ['key' => 'book_appointment', 'label' => 'Book Appointment', 'eventType' => 'appointment'],
        'terms' => [
            'business' => 'Clinic', 'clinic' => 'Clinic', 'appointment' => 'Appointment', 'appointments' => 'Appointments',
            'patient' => 'Patient', 'patients' => 'Patients', 'client' => 'Patient', 'clients' => 'Patients',
            'doctor' => 'Doctor', 'doctors' => 'Doctors', 'staff' => 'Staff', 'service' => 'Treatment Service',
            'services' => 'Treatment Services', 'treatment' => 'Treatment', 'treatments' => 'Treatments',
            'clinical' => 'Operations', 'clinicalWorkspace' => 'Operations Workspace', 'clinicalNotes' => 'Operational Notes',
            'recall' => 'Recall', 'recalls' => 'Recalls', 'visit' => 'Visit', 'visits' => 'Visits',
            'campaign' => 'Campaign', 'campaigns' => 'Campaigns', 'reception' => 'Reception Desk',
            'packages' => 'Packages', 'gallery' => 'Private Media', 'feedback' => 'Feedback', 'lab' => 'Lab',
            'lead' => 'Lead', 'leads' => 'Leads', 'project' => 'Case', 'projects' => 'Cases',
        ],
        'capabilities' => [
            'appointments' => true, 'meetings' => false, 'pipeline' => false, 'projects' => false, 'properties' => false,
            'lab' => true, 'stockInventory' => true, 'privateMedia' => true, 'packages' => true, 'invoicing' => true,
            'dentalContext' => false, 'aestheticContext' => false, 'specialtySwitcher' => false,
            // These remain fail-closed under operations-v1 regardless of template selection.
            'clinicalRecordEntry' => false, 'procedureEntry' => false, 'medicalHistoryEntry' => false, 'publicPatientMedia' => false,
        ],
        'navigation' => ['groups' => [
            ['key' => 'main', 'label' => 'Main Menu', 'modules' => ['dashboard', 'reception', 'appointments', 'clients', 'clinical', 'staff', 'services', 'financials']],
            ['key' => 'billing', 'label' => 'Billing & Packages', 'modules' => ['packages', 'invoices']],
            ['key' => 'operations', 'label' => 'Operations', 'modules' => ['lab', 'inventory', 'gallery', 'feedback']],
            ['key' => 'growth', 'label' => 'Growth', 'modules' => ['marketing', 'outreach', 'whatsapp', 'ai', 'aiReceptionist', 'metaLeads', 'imports', 'reports', 'branches']],
            ['key' => 'admin', 'label' => 'Admin', 'modules' => ['audit', 'support', 'settings']],
        ]],
        'scheduling' => [
            'defaultEventType' => 'appointment',
            'eventTypes' => [
                ['key' => 'appointment', 'label' => 'Appointment'],
                ['key' => 'consultation', 'label' => 'Consultation'],
                ['key' => 'follow_up', 'label' => 'Follow-up'],
            ],
        ],
        'profile' => ['fields' => [
            ['key' => 'name', 'label' => 'Full Name', 'type' => 'text', 'required' => true],
            ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
            ['key' => 'email', 'label' => 'Email', 'type' => 'email'],
            ['key' => 'notes', 'label' => 'Operational Notes', 'type' => 'textarea'],
        ]],
        'workflow' => ['key' => 'appointment_flow', 'stages' => ['new', 'confirmed', 'checked_in', 'completed', 'cancelled']],
        'dashboard' => [
            'todayAppointments' => "Today's Appointments",
            'activePatients' => 'Active Patients',
            'activeStaff' => 'Active Staff',
            'scheduleTitle' => "Today's Schedule",
            'topStaff' => 'Top Doctors',
            'servicesConfigured' => 'Services configured',
            'portalFeatures' => 'Portal Features',
            'primaryAction' => 'Book Appointment',
        ],
        'modules' => [
            'reception' => ['label' => 'Reception Desk', 'desc' => 'Today schedule, invoices, check-in and handover', 'icon' => 'WalletCards', 'visible' => true],
            'appointments' => ['label' => 'Appointments', 'desc' => 'Calendar, availability and booking', 'icon' => 'Calendar', 'visible' => true],
            'clients' => ['label' => 'Patients', 'desc' => 'Operational profiles, history, dues and follow-ups', 'icon' => 'Users', 'visible' => true],
            'clinical' => ['label' => 'Operations', 'desc' => 'Operational workload and service workflow', 'icon' => 'Stethoscope', 'visible' => true],
            'staff' => ['label' => 'Staff', 'desc' => 'Team profiles, compensation and access', 'icon' => 'UserCheck', 'visible' => true],
            'services' => ['label' => 'Services', 'desc' => 'Service categories, durations and pricing', 'icon' => 'Stethoscope', 'visible' => true],
            'financials' => ['label' => 'Financials', 'desc' => 'Revenue, dues and payment summaries', 'icon' => 'DollarSign', 'visible' => true],
            'packages' => ['label' => 'Packages', 'desc' => 'Plans and bundled services', 'icon' => 'Package', 'visible' => true],
            'invoices' => ['label' => 'Invoices', 'desc' => 'Billing, payments, refunds and PDFs', 'icon' => 'Receipt', 'visible' => true],
            'lab' => ['label' => 'Lab', 'desc' => 'External lab work and due dates', 'icon' => 'FlaskConical', 'visible' => true],
            'inventory' => ['label' => 'Inventory', 'desc' => 'Stock tracking and supply movement', 'icon' => 'Archive', 'visible' => true],
            'gallery' => ['label' => 'Private Media', 'desc' => 'Private operational documents and media', 'icon' => 'Image', 'visible' => true],
            'feedback' => ['label' => 'Feedback', 'desc' => 'Customer feedback and team performance', 'icon' => 'MessageSquare', 'visible' => true],
            'marketing' => ['label' => 'Marketing', 'desc' => 'Engagement and campaigns', 'icon' => 'Megaphone', 'visible' => true],
            'outreach' => ['label' => 'Manual Outreach', 'desc' => 'Manual WhatsApp reminders, follow-ups and broadcast lists', 'icon' => 'MessageCircle', 'visible' => true],
            'whatsapp' => ['label' => 'WhatsApp Center', 'desc' => 'Conversations, reminders and campaigns', 'icon' => 'MessageCircle', 'visible' => true],
            'ai' => ['label' => 'AI Hub', 'desc' => 'AI provider configuration and failover', 'icon' => 'Bot', 'visible' => true],
            'aiReceptionist' => ['label' => 'AI Receptionist', 'desc' => 'AI front desk and intake workflows', 'icon' => 'Sparkles', 'visible' => true],
            'metaLeads' => ['label' => 'Meta Leads', 'desc' => 'Facebook and Instagram leads to CRM workflow', 'icon' => 'Facebook', 'visible' => true],
            'imports' => ['label' => 'Import Center', 'desc' => 'CSV, Excel, Sheets and CRM migration jobs', 'icon' => 'Database', 'visible' => true],
            'reports' => ['label' => 'Reports', 'desc' => 'Live operational and financial reports', 'icon' => 'FileBarChart', 'visible' => true],
            'branches' => ['label' => 'Branches', 'desc' => 'Location management and message routing', 'icon' => 'Building2', 'visible' => true],
            'audit' => ['label' => 'Audit Trail', 'desc' => 'Track portal activity and changes', 'icon' => 'Shield', 'visible' => true],
            'support' => ['label' => 'Support', 'desc' => 'Support tickets and platform help', 'icon' => 'LifeBuoy', 'visible' => true],
            'settings' => ['label' => 'Settings', 'desc' => 'Business profile, public site and branding', 'icon' => 'Settings', 'visible' => true],
        ],
    ];
}

function industry_template_make($name, $override = []) {
    return ['name' => $name, 'config' => array_replace_recursive(industry_template_v2_base(), $override)];
}

function industry_template_builtins() {
    return [
        // Existing tenants retain their current behavior until explicitly moved.
        'healthcare' => industry_template_make('Healthcare (Legacy)'),
        'dental_clinic' => industry_template_make('Dental Clinic', [
            'vertical' => 'dental',
            'terms' => ['business' => 'Dental Clinic', 'doctor' => 'Dentist', 'doctors' => 'Dentists', 'service' => 'Dental Service', 'services' => 'Dental Services'],
            'capabilities' => ['dentalContext' => true],
            'profile' => ['fields' => [
                ['key' => 'name', 'label' => 'Patient Name', 'type' => 'text', 'required' => true],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['key' => 'email', 'label' => 'Email', 'type' => 'email'],
                ['key' => 'appointmentConcern', 'label' => 'Appointment Concern', 'type' => 'textarea'],
                ['key' => 'notes', 'label' => 'Operational Notes', 'type' => 'textarea'],
            ]],
            'modules' => ['clinical' => ['label' => 'Dental Operations'], 'inventory' => ['label' => 'Dental Inventory']],
            'dashboard' => ['topStaff' => 'Top Dentists', 'primaryAction' => 'Book Dental Appointment'],
        ]),
        'aesthetic_clinic' => industry_template_make('Aesthetic Clinic', [
            'vertical' => 'aesthetics',
            'terms' => ['business' => 'Aesthetic Clinic', 'doctor' => 'Practitioner', 'doctors' => 'Practitioners', 'service' => 'Aesthetic Service', 'services' => 'Aesthetic Services', 'recall' => 'Next Session', 'recalls' => 'Next Sessions'],
            'capabilities' => ['aestheticContext' => true, 'lab' => false],
            'scheduling' => ['eventTypes' => [
                ['key' => 'consultation', 'label' => 'Consultation'],
                ['key' => 'treatment_session', 'label' => 'Treatment Session'],
                ['key' => 'follow_up', 'label' => 'Follow-up'],
            ]],
            'profile' => ['fields' => [
                ['key' => 'name', 'label' => 'Client Name', 'type' => 'text', 'required' => true],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['key' => 'email', 'label' => 'Email', 'type' => 'email'],
                ['key' => 'concern', 'label' => 'Aesthetic Concern', 'type' => 'textarea'],
                ['key' => 'treatmentArea', 'label' => 'Treatment Area', 'type' => 'text'],
                ['key' => 'notes', 'label' => 'Operational Notes', 'type' => 'textarea'],
            ]],
            'modules' => ['clinical' => ['label' => 'Aesthetic Operations'], 'lab' => ['visible' => false], 'inventory' => ['label' => 'Product Inventory']],
            'dashboard' => ['todayAppointments' => "Today's Consultations & Sessions", 'topStaff' => 'Top Practitioners', 'primaryAction' => 'Book Consultation'],
        ]),
        'dental_aesthetic_clinic' => industry_template_make('Dental & Aesthetic Clinic', [
            'vertical' => 'dental_aesthetics',
            'terms' => ['business' => 'Dental & Aesthetic Clinic', 'doctor' => 'Practitioner', 'doctors' => 'Practitioners'],
            'capabilities' => ['dentalContext' => true, 'aestheticContext' => true, 'specialtySwitcher' => true],
            'scheduling' => ['eventTypes' => [
                ['key' => 'dental_appointment', 'label' => 'Dental Appointment'],
                ['key' => 'aesthetic_consultation', 'label' => 'Aesthetic Consultation'],
                ['key' => 'treatment_session', 'label' => 'Treatment Session'],
                ['key' => 'follow_up', 'label' => 'Follow-up'],
            ]],
            'profile' => ['fields' => [
                ['key' => 'name', 'label' => 'Patient Name', 'type' => 'text', 'required' => true],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['key' => 'email', 'label' => 'Email', 'type' => 'email'],
                ['key' => 'specialty', 'label' => 'Service Area', 'type' => 'select', 'options' => ['dental', 'aesthetics', 'both']],
                ['key' => 'appointmentConcern', 'label' => 'Appointment Concern', 'type' => 'textarea'],
                ['key' => 'notes', 'label' => 'Operational Notes', 'type' => 'textarea'],
            ]],
            'modules' => ['clinical' => ['label' => 'Treatment Operations']],
            'dashboard' => ['topStaff' => 'Top Practitioners', 'primaryAction' => 'Book Appointment'],
        ]),
        'interiors_architects' => industry_template_make('Interiors & Architects', [
            'vertical' => 'professional_services',
            'primaryGoal' => ['key' => 'schedule_consultation', 'label' => 'Schedule Consultation', 'eventType' => 'consultation'],
            'terms' => [
                'business' => 'Design Studio', 'clinic' => 'Studio', 'appointment' => 'Consultation', 'appointments' => 'Consultations',
                'patient' => 'Client', 'patients' => 'Clients', 'client' => 'Client', 'clients' => 'Clients',
                'doctor' => 'Architect / Designer', 'doctors' => 'Architects & Designers', 'service' => 'Project Type', 'services' => 'Project Types',
                'treatment' => 'Project', 'treatments' => 'Projects', 'clinical' => 'Projects', 'clinicalWorkspace' => 'Project Workspace',
                'clinicalNotes' => 'Project Notes', 'recall' => 'Proposal Follow-up', 'recalls' => 'Proposal Follow-ups',
                'visit' => 'Site Visit', 'visits' => 'Site Visits', 'project' => 'Project', 'projects' => 'Projects',
            ],
            'capabilities' => ['meetings' => true, 'pipeline' => true, 'projects' => true, 'lab' => false, 'stockInventory' => false, 'packages' => false],
            'scheduling' => ['defaultEventType' => 'consultation', 'eventTypes' => [
                ['key' => 'consultation', 'label' => 'Consultation'], ['key' => 'site_visit', 'label' => 'Site Visit'], ['key' => 'design_review', 'label' => 'Design Review'],
            ]],
            'workflow' => ['key' => 'design_project_pipeline', 'stages' => ['inquiry', 'qualified', 'consultation', 'site_visit', 'proposal', 'won', 'in_progress', 'delivered', 'lost']],
            'profile' => ['fields' => [
                ['key' => 'name', 'label' => 'Client Name', 'type' => 'text', 'required' => true], ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['key' => 'email', 'label' => 'Email', 'type' => 'email'], ['key' => 'propertyType', 'label' => 'Property Type', 'type' => 'text'],
                ['key' => 'location', 'label' => 'Project Location', 'type' => 'text'], ['key' => 'coveredArea', 'label' => 'Covered Area', 'type' => 'text'],
                ['key' => 'budgetRange', 'label' => 'Estimated Budget', 'type' => 'money_range'], ['key' => 'preferredStyle', 'label' => 'Preferred Style', 'type' => 'text'],
                ['key' => 'targetDate', 'label' => 'Target Date', 'type' => 'date'], ['key' => 'notes', 'label' => 'Project Notes', 'type' => 'textarea'],
            ]],
            'modules' => ['reception' => ['label' => 'Meeting Desk'], 'appointments' => ['label' => 'Consultations'], 'clients' => ['label' => 'Clients'], 'clinical' => ['label' => 'Project Pipeline', 'icon' => 'ClipboardList'], 'staff' => ['label' => 'Architects & Designers'], 'services' => ['label' => 'Project Types'], 'lab' => ['visible' => false], 'inventory' => ['visible' => false], 'packages' => ['visible' => false], 'gallery' => ['label' => 'Project Media']],
            'dashboard' => ['todayAppointments' => 'Consultations Today', 'activePatients' => 'Active Clients', 'activeStaff' => 'Active Designers', 'scheduleTitle' => "Today's Consultations", 'topStaff' => 'Top Designers', 'servicesConfigured' => 'Project types configured', 'primaryAction' => 'Schedule Consultation'],
        ]),
        'real_estate' => industry_template_make('Real Estate', [
            'vertical' => 'real_estate',
            'primaryGoal' => ['key' => 'schedule_meeting', 'label' => 'Schedule Meeting', 'eventType' => 'meeting'],
            'terms' => [
                'business' => 'Real Estate Business', 'clinic' => 'Agency', 'appointment' => 'Meeting', 'appointments' => 'Meetings',
                'patient' => 'Lead', 'patients' => 'Leads', 'client' => 'Lead', 'clients' => 'Leads', 'doctor' => 'Agent', 'doctors' => 'Agents',
                'service' => 'Property', 'services' => 'Properties', 'treatment' => 'Property', 'treatments' => 'Properties',
                'clinical' => 'Deals', 'clinicalWorkspace' => 'Deal Pipeline', 'clinicalNotes' => 'Lead Notes',
                'recall' => 'Lead Follow-up', 'recalls' => 'Lead Follow-ups', 'visit' => 'Property Viewing', 'visits' => 'Property Viewings',
            ],
            'capabilities' => ['meetings' => true, 'pipeline' => true, 'properties' => true, 'lab' => false, 'stockInventory' => false, 'packages' => false],
            'scheduling' => ['defaultEventType' => 'meeting', 'eventTypes' => [
                ['key' => 'meeting', 'label' => 'Office Meeting'], ['key' => 'property_viewing', 'label' => 'Property Viewing'], ['key' => 'call', 'label' => 'Phone / Video Call'],
            ]],
            'workflow' => ['key' => 'real_estate_pipeline', 'stages' => ['new', 'contacted', 'qualified', 'meeting', 'viewing', 'negotiation', 'won', 'lost']],
            'profile' => ['fields' => [
                ['key' => 'name', 'label' => 'Lead Name', 'type' => 'text', 'required' => true], ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['key' => 'email', 'label' => 'Email', 'type' => 'email'], ['key' => 'intent', 'label' => 'Looking To', 'type' => 'select', 'options' => ['buy', 'rent', 'sell', 'invest']],
                ['key' => 'propertyType', 'label' => 'Property Type', 'type' => 'text'], ['key' => 'preferredLocation', 'label' => 'Preferred Location', 'type' => 'text'],
                ['key' => 'budgetRange', 'label' => 'Budget Range', 'type' => 'money_range'], ['key' => 'bedrooms', 'label' => 'Bedrooms', 'type' => 'number'],
                ['key' => 'leadSource', 'label' => 'Lead Source', 'type' => 'text'], ['key' => 'notes', 'label' => 'Lead Notes', 'type' => 'textarea'],
            ]],
            'modules' => ['reception' => ['label' => 'Lead Desk'], 'appointments' => ['label' => 'Meetings & Viewings'], 'clients' => ['label' => 'Leads'], 'clinical' => ['label' => 'Deal Pipeline', 'icon' => 'ClipboardList'], 'staff' => ['label' => 'Agents'], 'services' => ['label' => 'Properties'], 'lab' => ['visible' => false], 'inventory' => ['label' => 'Property Listings', 'desc' => 'Available, reserved and sold property listings'], 'packages' => ['visible' => false], 'gallery' => ['label' => 'Property Media']],
            'dashboard' => ['todayAppointments' => 'Meetings & Viewings Today', 'activePatients' => 'Active Leads', 'activeStaff' => 'Active Agents', 'scheduleTitle' => "Today's Meetings", 'topStaff' => 'Top Agents', 'servicesConfigured' => 'Properties listed', 'primaryAction' => 'Schedule Meeting'],
        ]),
        'marketing_agency' => industry_template_make('Marketing Agency', [
            'vertical' => 'professional_services',
            'primaryGoal' => ['key' => 'schedule_discovery', 'label' => 'Schedule Discovery Meeting', 'eventType' => 'discovery_meeting'],
            'terms' => [
                'appointment' => 'Meeting', 'appointments' => 'Meetings',
                'patient' => 'Client', 'patients' => 'Clients', 'client' => 'Client', 'clients' => 'Clients',
                'doctor' => 'Account Manager', 'doctors' => 'Account Managers',
                'service' => 'Service', 'services' => 'Services',
                'treatment' => 'Project', 'treatments' => 'Projects',
                'clinical' => 'Projects', 'clinicalWorkspace' => 'Project Workspace', 'clinicalNotes' => 'Task Notes',
                'recall' => 'Follow-up', 'recalls' => 'Follow-ups', 'visit' => 'Meeting', 'visits' => 'Meetings',
                'business' => 'Marketing Agency', 'clinic' => 'Agency', 'project' => 'Project', 'projects' => 'Projects',
            ],
            'capabilities' => ['meetings' => true, 'pipeline' => true, 'projects' => true, 'lab' => false, 'stockInventory' => false],
            'scheduling' => ['defaultEventType' => 'discovery_meeting', 'eventTypes' => [
                ['key' => 'discovery_meeting', 'label' => 'Discovery Meeting'], ['key' => 'strategy_call', 'label' => 'Strategy Call'], ['key' => 'review_meeting', 'label' => 'Performance Review'],
            ]],
            'workflow' => ['key' => 'agency_sales_pipeline', 'stages' => ['lead', 'discovery', 'proposal', 'negotiation', 'onboarding', 'active', 'renewal', 'closed']],
            'profile' => ['fields' => [
                ['key' => 'name', 'label' => 'Client / Company Name', 'type' => 'text', 'required' => true], ['key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['key' => 'email', 'label' => 'Email', 'type' => 'email'], ['key' => 'industry', 'label' => 'Industry', 'type' => 'text'],
                ['key' => 'monthlyBudget', 'label' => 'Monthly Marketing Budget', 'type' => 'money'],
                ['key' => 'requestedChannels', 'label' => 'Requested Channels', 'type' => 'multi_select', 'options' => ['Meta Ads', 'Google Ads', 'SEO', 'Social Media', 'Web Development', 'Creative']],
                ['key' => 'targetKpis', 'label' => 'Target KPIs', 'type' => 'textarea'], ['key' => 'notes', 'label' => 'Account Notes', 'type' => 'textarea'],
            ]],
            'dashboard' => [
                'todayAppointments' => 'Meetings Scheduled',
                'activePatients' => 'Active Clients',
                'activeStaff' => 'Active Team',
                'scheduleTitle' => "Today's Meetings",
                'topStaff' => 'Top Account Managers',
                'servicesConfigured' => 'Services configured',
                'primaryAction' => 'Schedule Discovery Meeting',
            ],
            'modules' => [
                'reception' => ['label' => 'Meeting Desk', 'desc' => 'Meetings, invoices and handover'],
                'appointments' => ['label' => 'Meetings', 'desc' => 'Calendar, account manager availability and booking'],
                'clients' => ['label' => 'Clients', 'desc' => 'Client records, history, dues and follow-ups'],
                'clinical' => ['label' => 'Client Pipeline', 'desc' => 'Project notes and client workflow', 'icon' => 'ClipboardList'],
                'staff' => ['label' => 'Agency Team', 'desc' => 'Account managers, salaries, commissions and access'],
                'services' => ['label' => 'Services', 'desc' => 'Service categories, durations and pricing'],
                'lab' => ['visible' => false], 'inventory' => ['visible' => false],
                'gallery' => ['label' => 'Creative Library'], 'packages' => ['label' => 'Retainers & Packages'],
                'marketing' => ['label' => 'Client Campaigns'],
            ],
        ]),
    ];
}

function industry_templates_ensure($db) {
    if (DB_DRIVER === 'sqlite') {
        $db->exec("CREATE TABLE IF NOT EXISTS IndustryTemplate (
            templateKey TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            configJson TEXT NOT NULL,
            isActive INTEGER DEFAULT 1,
            sortOrder INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )");
    } else {
        $db->exec("CREATE TABLE IF NOT EXISTS IndustryTemplate (
            templateKey VARCHAR(80) PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            configJson JSON NOT NULL,
            isActive TINYINT DEFAULT 1,
            sortOrder INT DEFAULT 0,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    $sort = 0;
    foreach (industry_template_builtins() as $key => $template) {
        $json = json_encode($template['config'], JSON_UNESCAPED_SLASHES);
        if (DB_DRIVER === 'sqlite') {
            $sql = "INSERT INTO IndustryTemplate (templateKey, name, configJson, isActive, sortOrder)
                    VALUES (?, ?, ?, 1, ?)
                    ON CONFLICT(templateKey) DO UPDATE SET name=excluded.name, configJson=excluded.configJson, isActive=excluded.isActive, sortOrder=excluded.sortOrder, updatedAt=CURRENT_TIMESTAMP";
        } else {
            $sql = "INSERT INTO IndustryTemplate (templateKey, name, configJson, isActive, sortOrder)
                    VALUES (?, ?, ?, 1, ?)
                    ON DUPLICATE KEY UPDATE name=VALUES(name), configJson=VALUES(configJson), isActive=VALUES(isActive), sortOrder=VALUES(sortOrder), updatedAt=CURRENT_TIMESTAMP";
        }
        $db->prepare($sql)->execute([$key, $template['name'], $json, $sort++]);
    }
}

function industry_template_normalize($key) {
    $key = strtolower(trim((string)$key));
    $key = preg_replace('/[^a-z0-9_]+/', '_', $key);
    return trim($key, '_') ?: INDUSTRY_TEMPLATE_DEFAULT;
}

function industry_templates_list($db) {
    industry_templates_ensure($db);
    $stmt = $db->query("SELECT templateKey, name, configJson, isActive, sortOrder FROM IndustryTemplate WHERE isActive = 1 ORDER BY sortOrder ASC, name ASC");
    $rows = $stmt ? $stmt->fetchAll() : [];
    // Old built-ins may remain in an upgraded database for tenants already
    // assigned to them. Keep them resolvable, but expose only the v2 catalog
    // for new admin selections.
    $selectable = array_keys(industry_template_builtins());
    $rows = array_values(array_filter($rows, fn($row) => in_array($row['templateKey'], $selectable, true)));
    return array_map(function ($row) {
        $row['config'] = json_decode($row['configJson'] ?? '{}', true) ?: [];
        $row['isActive'] = !empty($row['isActive']);
        unset($row['configJson']);
        return $row;
    }, $rows);
}

function industry_template_get($db, $key) {
    industry_templates_ensure($db);
    $key = industry_template_normalize($key ?: INDUSTRY_TEMPLATE_DEFAULT);
    $stmt = $db->prepare("SELECT templateKey, name, configJson, isActive, sortOrder FROM IndustryTemplate WHERE templateKey = ? AND isActive = 1");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row && $key !== INDUSTRY_TEMPLATE_DEFAULT) {
        return industry_template_get($db, INDUSTRY_TEMPLATE_DEFAULT);
    }
    if (!$row) return null;
    $row['config'] = json_decode($row['configJson'] ?? '{}', true) ?: [];
    $row['isActive'] = !empty($row['isActive']);
    unset($row['configJson']);
    return $row;
}

function industry_template_exists($db, $key) {
    industry_templates_ensure($db);
    $stmt = $db->prepare("SELECT COUNT(*) FROM IndustryTemplate WHERE templateKey = ? AND isActive = 1");
    $stmt->execute([industry_template_normalize($key)]);
    return (int)$stmt->fetchColumn() > 0;
}
