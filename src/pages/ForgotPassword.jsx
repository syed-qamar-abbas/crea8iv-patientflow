import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, ArrowLeft } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { appPath, fetchPublicApi } from '../config/api';
import ClinicLogoMark from '../components/branding/ClinicLogoMark';

export default function ForgotPassword() {
  const { clinicInfo } = useClinic();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetchPublicApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          resetBaseUrl: new URL(appPath('/reset-password'), window.location.origin).toString(),
        }),
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-[#0a1118] dark:via-[#0f1720] dark:to-[#0a1f1d]">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-6 sm:p-9 shadow-xl shadow-teal-900/5 border border-white/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
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

          {sent ? (
            <div className="text-center py-4">
              <div
                className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)' }}
              >
                <MailCheck className="w-6 h-6" style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="text-xl font-black text-gray-950 dark:text-white">Check your email</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                If <span className="font-semibold text-gray-700 dark:text-gray-300">{email}</span> is registered,
                we&apos;ve sent a password reset link. It expires in 30 minutes.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:opacity-80"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">Account recovery</p>
                <h2 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">Forgot your password?</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  Enter your email and we&apos;ll send you a secure reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`you@${clinicInfo.website || 'clinic.com'}`}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/40 transition-all"
                  />
                  {error && (
                    <div className="mt-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs px-3 py-2 font-medium">
                      {error}
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:opacity-80"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
