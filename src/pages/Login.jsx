import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, Sparkles, CalendarCheck2, Users, Receipt, ShieldCheck, Activity,
} from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { appPath, fetchApi } from '../config/api';
import ClinicLogoMark from '../components/branding/ClinicLogoMark';

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: 'Smart Appointments',
    desc: 'Chairside scheduling with reminders, recalls, and no-show recovery.',
  },
  {
    icon: Users,
    title: 'Patient Operations',
    desc: 'Searchable patient profiles, appointments, billing, and private operational documents.',
  },
  {
    icon: Receipt,
    title: 'Billing & Dues',
    desc: 'Invoices, packages, and pending-payment tracking that closes the loop.',
  },
  {
    icon: Activity,
    title: 'Live Operations',
    desc: 'Reception desk, inventory, and staff portals stay in sync in real time.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access',
    desc: 'Owner, reception, and operations roles each see exactly what they should.',
  },
];

export default function Login() {
  const { clinicInfo, isPlatform } = useClinic();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await fetchApi('/auth/login', {
        method: 'POST',
          body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });

      localStorage.setItem('clinic_auth', 'true');
      localStorage.setItem('clinic_token', data.accessToken);
      localStorage.setItem('clinic_refresh', data.refreshToken);
      localStorage.setItem('clinic_user', JSON.stringify(data.user));
      // Reload the app after establishing the session so ClinicProvider can
      // hydrate tenant branding and plan features for the signed-in clinic.
      window.location.assign(appPath(data.user.role === 'superadmin' ? '/admin' : '/dashboard'));
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-10 bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-[#0a1118] dark:via-[#0f1720] dark:to-[#0a1f1d]">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">

        {/* Login form */}
        <div className="order-1">
          <div className="glass rounded-2xl p-5 sm:p-9 shadow-xl shadow-teal-900/5 border border-white/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-xl">
            <div className="mb-5 sm:mb-7 flex items-center gap-3">
              <ClinicLogoMark
                logo={clinicInfo.logo}
                alt={`${clinicInfo.name} logo`}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-lg shadow-teal-900/20 overflow-hidden"
                textClassName="text-white font-black text-base"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
              />
              <div>
                <h1 className="text-lg font-black text-gray-900 dark:text-white">{clinicInfo.name}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">{clinicInfo.tagline}</p>
              </div>
            </div>

            <div className="mb-5 sm:mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">{isPlatform ? 'Platform administration' : 'Secure clinic access'}</p>
              <h2 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">Welcome back</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to continue to your portal.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isPlatform ? 'superadmin' : 'frontdesk'}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/40 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-[var(--primary)] hover:opacity-80"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs px-3 py-2">
                    <span className="font-medium">{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-[11px] text-center text-gray-400 dark:text-gray-500">
              Developed by Crea8iv Media for modern clinic teams.
            </p>
          </div>
        </div>

        {/* Features showcase */}
        <div className="order-2">
          <div className="mb-4 lg:hidden">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">{isPlatform ? 'Platform' : 'Portal features'}</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-white">
              {isPlatform ? 'Everything your clinics need.' : 'Everything your clinic team needs.'}
            </h2>
          </div>
          <div className="mb-6 lg:mb-8 hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] backdrop-blur px-3 py-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span className="text-xs font-semibold text-gray-700 dark:text-white/70">
                {isPlatform ? 'Clinic management platform' : 'Dental clinic operating system'}
              </span>
            </div>
            <h2 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white leading-[1.1]">
              {isPlatform ? 'Everything your clinics need,' : 'Everything your dental practice needs,'}{' '}
              <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
                in one {isPlatform ? 'platform' : 'portal'}.
              </span>
            </h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
              {isPlatform
                ? 'Manage every clinic on your platform — onboarding, branding, subscriptions and support — from one place.'
                : 'From the front desk to the chair, manage your clinic with tools built specifically for modern dental teams.'}
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur p-4 hover:border-[var(--primary)]/30 dark:hover:border-[var(--primary)]/40 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)' }}
                >
                  <f.icon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
