export function invoicePrefillFromAppointment(appointment, source = 'appointment') {
  if (!appointment) return {};
  const client = appointment.client || {};
  return {
    source,
    appointmentId: appointment.id || '',
    clientId: appointment.clientId || client.id || '',
    clientLabel: appointment.clientName || client.name || '',
    clientPhone: appointment.clientPhone || client.phone || '',
    patientNo: client.patientNo || '',
  };
}

export function invoicePrefillFromPatient(patient, source = 'patient') {
  if (!patient) return {};
  return {
    source,
    clientId: patient.id || '',
    clientLabel: patient.name || '',
    clientPhone: patient.phone || '',
    patientNo: patient.patientNo || '',
  };
}

export function invoicePrefillSearch(prefill = {}) {
  const params = new URLSearchParams();
  if (prefill.clientId) params.set('clientId', prefill.clientId);
  if (prefill.appointmentId) params.set('appointmentId', prefill.appointmentId);
  if (prefill.clientLabel) params.set('clientName', prefill.clientLabel);
  return params.toString();
}
