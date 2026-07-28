export const ROLES = {
  owner: 'owner',
  manager: 'manager',
  doctor: 'doctor',
  therapist: 'therapist',
  accountant: 'accountant',
  receptionist: 'receptionist',
  staff: 'staff',
};

export const ROLE_LABELS = {
  owner: 'Owner',
  manager: 'Manager',
  doctor: 'Doctor',
  therapist: 'Therapist',
  accountant: 'Accountant',
  receptionist: 'Receptionist',
  staff: 'Staff',
};

export const ROLE_ACCESS = {
  owner: [
    'dashboard',
    'reception',
    'appointments',
    'clients',
    'clinical',
    'lab',
    'staff',
    'services',
    'financials',
    'packages',
    'invoices',
    'prescriptions',
    'inventory',
    'gallery',
    'feedback',
    'marketing',
    'outreach',
    'whatsapp',
    'ai',
    'ai-receptionist',
    'meta-leads',
    'imports',
    'reports',
    'branches',
    'audit',
    'support',
    'settings',
  ],
  manager: [
    'dashboard',
    'reception',
    'appointments',
    'clients',
    'clinical',
    'lab',
    'staff',
    'services',
    'financials',
    'packages',
    'invoices',
    'prescriptions',
    'inventory',
    'gallery',
    'feedback',
    'marketing',
    'outreach',
    'whatsapp',
    'ai',
    'ai-receptionist',
    'meta-leads',
    'imports',
    'reports',
    'branches',
    'audit',
    'support',
    'settings',
  ],
  doctor: ['dashboard', 'clinical', 'lab', 'appointments', 'clients', 'prescriptions', 'gallery', 'feedback', 'inventory', 'outreach'],
  therapist: ['dashboard', 'clinical', 'lab', 'appointments', 'clients', 'prescriptions', 'gallery', 'feedback', 'inventory', 'outreach'],
  accountant: ['dashboard', 'clients', 'financials', 'packages', 'invoices', 'reports'],
  receptionist: ['dashboard', 'reception', 'appointments', 'clients', 'prescriptions', 'lab', 'invoices', 'packages', 'outreach', 'whatsapp', 'support'],
  staff: ['dashboard', 'clinical', 'appointments', 'clients', 'gallery', 'feedback', 'inventory', 'outreach'],
};

export function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (['owner', 'admin', 'administrator', 'superadmin', 'super_admin'].includes(value)) return ROLES.owner;
  if (['manager', 'clinic_manager', 'clinic manager', 'operations manager'].includes(value)) return ROLES.manager;
  if (['doctor', 'dentist', 'physician', 'consultant'].includes(value)) return ROLES.doctor;
  if (['therapist', 'aesthetician', 'esthetician', 'hygienist'].includes(value)) return ROLES.therapist;
  if (['accountant', 'finance', 'billing', 'cashier'].includes(value)) return ROLES.accountant;
  if (['reception', 'receptionist', 'frontdesk', 'front-desk', 'front_desk'].includes(value)) return ROLES.receptionist;
  if (['staff', 'assistant', 'dental assistant', 'clinical'].includes(value)) return ROLES.staff;
  return ROLES.staff;
}

export function getCurrentUser() {
  const fallback = {
    name: 'Smile Expert Owner',
    email: 'owner@thesmileexpert.com',
    role: ROLES.owner,
  };
  try {
    const user = JSON.parse(localStorage.getItem('clinic_user') || 'null') || fallback;
    const normalizedRole = normalizeRole(user.role || user.userRole || user.type);
    return { ...fallback, ...user, role: normalizedRole };
  } catch (_) {
    return fallback;
  }
}

export function getCurrentRole() {
  return normalizeRole(getCurrentUser().role);
}

export function canAccessPath(pathname, role = getCurrentRole()) {
  const segment = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  return ROLE_ACCESS[normalizeRole(role)]?.includes(segment) || false;
}

export function getRoleHome(role = getCurrentRole()) {
  return '/dashboard';
}

export function isOwner(role = getCurrentRole()) {
  return normalizeRole(role) === ROLES.owner;
}

export function isReceptionist(role = getCurrentRole()) {
  return normalizeRole(role) === ROLES.receptionist;
}

export function canViewBusinessFinancials(role = getCurrentRole()) {
  return [ROLES.owner, ROLES.manager, ROLES.accountant].includes(normalizeRole(role));
}

export function canManageInvoiceAdmin(role = getCurrentRole()) {
  return [ROLES.owner, ROLES.manager, ROLES.accountant].includes(normalizeRole(role));
}

export function isStaff(role = getCurrentRole()) {
  return [ROLES.staff, ROLES.doctor, ROLES.therapist].includes(normalizeRole(role));
}
