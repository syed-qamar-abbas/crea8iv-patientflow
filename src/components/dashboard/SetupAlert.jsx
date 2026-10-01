import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { fetchApi } from '../../config/api';
import { getCurrentRole } from '../../config/roles';
import { missingClinicFields } from '../../config/requiredSettings';
import { useClinic } from '../../context/ClinicContext';

// Red alert on the dashboard when the owner hasn't completed the required clinic
// details (clinic info, invoice rules, payment details). Clicking it jumps to Settings.
export default function SetupAlert() {
  const { term } = useClinic();
  const clinicLabel = term('clinic', 'clinic');
  const patientLabel = term('patient', 'patient');
  const navigate = useNavigate();
  const role = getCurrentRole();
  const [missing, setMissing] = useState(null);

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) return;
    fetchApi('/settings/public-site')
      .then(({ clinic }) => setMissing(missingClinicFields(clinic || {}, { includePaymentFields: false })))
      .catch(() => {});
  }, [role]);

  if (!missing || missing.length === 0) return null;

  // Group the missing fields by their Settings section for a readable summary.
  const groups = missing.reduce((acc, f) => {
    (acc[f.group] = acc[f.group] || []).push(f.label);
    return acc;
  }, {});

  return (
    <button
      type="button"
      onClick={() => navigate('/settings')}
      className="group w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-left transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:hover:bg-red-500/15"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-800 dark:text-red-200">
            Complete your {clinicLabel.toLowerCase()} setup — {missing.length} required {missing.length === 1 ? 'detail' : 'details'} missing
          </p>
          <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-300/80">
            These appear on invoices and {patientLabel} documents. Fill them in to finish setup.
          </p>
          <div className="mt-2 space-y-1">
            {Object.entries(groups).map(([group, labels]) => (
              <p key={group} className="text-xs text-red-700 dark:text-red-300">
                <span className="font-semibold">{group}:</span> {labels.join(', ')}
              </p>
            ))}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white group-hover:bg-red-700">
          Complete now <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}
