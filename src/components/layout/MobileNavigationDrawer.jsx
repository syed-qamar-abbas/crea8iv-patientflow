import { NavLink } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import clsx from 'clsx';
import { getCurrentRole, ROLE_LABELS } from '../../config/roles';
import { useClinic } from '../../context/ClinicContext';
import ClinicLogoMark from '../branding/ClinicLogoMark';
import { getEffectiveNavGroups, MODULE_KEYS } from './SidebarNew';

export default function MobileNavigationDrawer({ open, onClose }) {
  const { clinicInfo, features, industryTemplate } = useClinic();
  const role = getCurrentRole();
  const groups = getEffectiveNavGroups(features, industryTemplate, role);

  if (!open) return null;

  const requestInstall = () => {
    window.dispatchEvent(new CustomEvent('patientflow:install-prompt'));
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <button
        type="button"
        aria-label="Close menu overlay"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-[88vw] max-w-sm flex-col overflow-hidden bg-[#0f1720] shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" />
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <ClinicLogoMark
              logo={clinicInfo.logo}
              alt={`${clinicInfo.name} logo`}
              className="brand-mark h-10 w-10 shrink-0 overflow-hidden"
              textClassName="text-white font-bold text-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{clinicInfo.name}</p>
              <p className="truncate text-xs font-semibold text-white/45">{ROLE_LABELS[role]} Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <button
            type="button"
            onClick={requestInstall}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-left text-sm font-bold text-emerald-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/20">
              <Download className="h-4 w-4" />
            </span>
            <span>
              Install mobile app
              <span className="block text-[11px] font-semibold text-emerald-100/65">Android install or iPhone Add to Home Screen help</span>
            </span>
          </button>

          <nav className="space-y-4">
            {groups.map(group => (
              <div key={group.label}>
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map(({ to, icon: Icon, label }) => {
                    const templateModule = industryTemplate.config.modules?.[MODULE_KEYS[to]] || {};
                    const navLabel = templateModule.label || label;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={onClose}
                        className={({ isActive }) => clsx(
                          'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition',
                          isActive
                            ? 'bg-white/18 text-white ring-1 ring-white/15'
                            : 'text-white/65 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{navLabel}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}
