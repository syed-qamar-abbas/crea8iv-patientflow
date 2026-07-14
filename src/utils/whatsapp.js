export const MANUAL_WHATSAPP_TEMPLATES = [
  {
    key: 'appointment_reminder',
    label: 'Appointment reminder',
    purpose: 'appointment_reminder',
    body: 'Hi {{name}}, this is a reminder for your {{appointment}} at {{clinic}} on {{date}} at {{time}}. Please reply if you need to reschedule.',
  },
  {
    key: 'follow_up',
    label: 'Follow-up reminder',
    purpose: 'follow_up',
    body: 'Hi {{name}}, hope you are doing well. {{clinic}} is checking in for your follow-up. Please reply when convenient.',
  },
  {
    key: 'payment',
    label: 'Payment / invoice reminder',
    purpose: 'payment',
    body: 'Hi {{name}}, this is a friendly reminder from {{clinic}} about your pending balance of {{due}}. Please contact us if you need help.',
  },
  {
    key: 'promotion',
    label: 'Offer / campaign',
    purpose: 'promotion',
    body: 'Hi {{name}}, {{clinic}} has an update for you: {{campaign}} {{link}}',
  },
  {
    key: 'custom',
    label: 'Custom message',
    purpose: 'custom',
    body: 'Hi {{name}}, ',
  },
];

export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  return digits;
}

export function buildWhatsAppUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message || '')}`;
}

export function renderWhatsAppTemplate(template, context = {}) {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = context[key];
    return value === undefined || value === null ? '' : String(value);
  }).replace(/[ \t]+\n/g, '\n').trim();
}

export function openWhatsAppMessage(phone, message) {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
