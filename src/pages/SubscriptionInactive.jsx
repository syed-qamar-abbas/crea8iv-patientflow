import { Link } from 'react-router-dom';
import { AlertTriangle, MessageCircle, LogOut } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import ClinicLogoMark from '../components/branding/ClinicLogoMark';
import { appPath, logoutSession } from '../config/api';

export default function SubscriptionInactive() {
  const { clinicInfo } = useClinic();

  const handleLogout = async () => {
    await logoutSession();
    window.location.href = appPath('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-white to-amber-50 dark:from-[#0a1118] dark:via-[#0f1720] dark:to-[#1f1a0a]">
      <div className="w-full max-w-lg">
        <div className="glass rounded-2xl p-6 sm:p-9 shadow-xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-xl text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <ClinicLogoMark
              logo={clinicInfo.logo}
              alt={`${clinicInfo.name} logo`}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-lg overflow-hidden"
              textClassName="text-white font-black text-base"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
            />
          </div>

          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>

          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Subscription Inactive</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-6">
            Your clinic&apos;s portal subscription has expired or been paused.
            All your data is safe and will be restored the moment your subscription is renewed.
          </p>

          <div className="mt-6 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              How to renew
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-6">
              Contact the Crea8iv PatientFlow team on WhatsApp to renew your plan.
              Once your payment is verified, access is restored instantly — nothing is lost.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/923000000000?text=I%20want%20to%20renew%20my%20clinic%20portal%20subscription"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg"
            >
              <MessageCircle className="w-4 h-4" />
              Renew via WhatsApp
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>

          <p className="mt-6 text-[11px] text-gray-400 dark:text-gray-500">
            Already renewed? <Link to="/login" className="text-[var(--primary)] font-semibold">Sign in again</Link> to refresh your access.
          </p>
        </div>
      </div>
    </div>
  );
}
