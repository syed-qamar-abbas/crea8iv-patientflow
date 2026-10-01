// Clinic settings the owner must complete before the portal is "launch ready".
// Used by both the Dashboard alert and the Settings page highlighting so they
// always agree on what's missing.
export const REQUIRED_CLINIC_FIELDS = [
  { key: 'name', label: 'Clinic Name', group: 'Clinic Information' },
  { key: 'address', label: 'Clinic Address', group: 'Clinic Information' },
  { key: 'phone', label: 'Phone', group: 'Clinic Information' },
  { key: 'email', label: 'Email', group: 'Clinic Information' },
  { key: 'invoicePrefix', label: 'Invoice Prefix', group: 'Brand Profile & Invoice Rules' },
  { key: 'paymentTerms', label: 'Payment Terms', group: 'Brand Profile & Invoice Rules' },
  { key: 'invoiceFooter', label: 'Invoice Footer Message', group: 'Brand Profile & Invoice Rules' },
  { key: 'bankName', label: 'Bank Name', group: 'Payment / Account Details' },
  { key: 'accountTitle', label: 'Account Title', group: 'Payment / Account Details' },
  { key: 'accountNumber', label: 'Account Number', group: 'Payment / Account Details' },
  { key: 'iban', label: 'IBAN', group: 'Payment / Account Details' },
];

const PAYMENT_FIELD_KEYS = new Set(['bankName', 'accountTitle', 'accountNumber', 'iban']);

export function isFilled(value) {
  return String(value ?? '').trim() !== '';
}

// Returns the list of required fields still missing from a clinic object.
export function missingClinicFields(clinic = {}, options = {}) {
  const { includePaymentFields = true } = options;
  return REQUIRED_CLINIC_FIELDS.filter((f) => {
    if (!includePaymentFields && PAYMENT_FIELD_KEYS.has(f.key)) return false;
    return !isFilled(clinic[f.key]);
  });
}
