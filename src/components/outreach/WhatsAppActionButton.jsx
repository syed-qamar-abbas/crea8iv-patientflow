import { MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { fetchApi } from '../../config/api';
import { openWhatsAppMessage, renderWhatsAppTemplate } from '../../utils/whatsapp';
import { useClinic } from '../../context/ClinicContext';

export function buildClientMessage({ clinicName, client, appointment, template, customContext = {} }) {
  const appointmentLabel = appointment
    ? `${appointment.service?.name || appointment.serviceName || appointment.otherTreatment || 'appointment'}`
    : 'appointment';
  return renderWhatsAppTemplate(template.body || template, {
    clinic: clinicName,
    name: client?.name || client?.clientName || 'there',
    appointment: appointmentLabel,
    date: appointment?.date || '',
    time: appointment?.startTime || '',
    due: `PKR ${Number(client?.outstandingBalance || 0).toLocaleString()}`,
    campaign: customContext.campaign || '',
    link: customContext.link || '',
    ...customContext,
  });
}

export default function WhatsAppActionButton({
  client,
  appointment,
  template,
  message,
  purpose,
  children = 'WhatsApp',
  className,
  size = 'sm',
  variant = 'soft',
  onLogged,
}) {
  const { clinicInfo } = useClinic();
  const finalMessage = message || buildClientMessage({ clinicName: clinicInfo.name, client, appointment, template });
  const clientId = client?.id || client?.clientId || appointment?.clientId || appointment?.client?.id;
  const phone = client?.phone || appointment?.clientPhone || appointment?.client?.phone;

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!phone) {
      alert('This contact has no phone number.');
      return;
    }
    const opened = openWhatsAppMessage(phone, finalMessage);
    if (!opened) {
      alert('Please add a valid phone number with country code first.');
      return;
    }
    if (clientId) {
      try {
        await fetchApi('/manual-outreach/logs', {
          method: 'POST',
          body: JSON.stringify({
            clientId,
            appointmentId: appointment?.id || null,
            purpose: purpose || template?.purpose || 'custom',
            message: finalMessage,
            status: 'opened',
          }),
        });
        onLogged?.();
      } catch (err) {
        console.warn('Manual outreach log failed:', err);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition',
        size === 'icon' ? 'p-1.5 text-xs' : 'px-3 py-1.5 text-xs',
        variant === 'primary'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20',
        className
      )}
      title="Open WhatsApp with this message"
    >
      <MessageCircle className={size === 'icon' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {size !== 'icon' && children}
    </button>
  );
}
