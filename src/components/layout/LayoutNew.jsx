import SidebarNew from './SidebarNew';
import Header from './Header';
import MobileQuickActions from './MobileQuickActions';
import MobileNavigationDrawer from './MobileNavigationDrawer';
import ImpersonationBanner from '../ImpersonationBanner';
import InstallPrompt from '../pwa/InstallPrompt';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, Menu, MessageCircle, Users } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../context/ThemeContext';
import { useClinic } from '../../context/ClinicContext';
import { canAccessPath, getCurrentRole } from '../../config/roles';

const mobileNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/appointments', icon: Calendar, label: 'Appts' },
  { to: '/clients', icon: Users, label: 'Patients' },
  { to: '/outreach', icon: MessageCircle, label: 'Outreach' },
];

export default function LayoutNew() {
  const { darkMode } = useTheme();
  const { term } = useClinic();
  const role = getCurrentRole();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dynamicMobileNav = mobileNav.map(item => {
    if (item.to === '/appointments') return { ...item, label: term('appointments', 'Appts') };
    if (item.to === '/clients') return { ...item, label: term('patients', 'Patients') };
    if (item.to === '/clinical') return { ...item, label: 'Operations' };
    return item;
  });

  useEffect(() => {
    const handleShortcuts = (event) => {
      const tagName = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return;

      const key = event.key.toLowerCase();
      if (key === '/') {
        event.preventDefault();
        const searchInput = [...document.querySelectorAll('[data-global-search]')]
          .find((input) => input.offsetParent !== null);
        searchInput?.focus();
      }
      if (key === 'n') navigate('/clients');
      if (key === 'a') navigate('/appointments');
      if (key === 'i') navigate('/invoices');
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [navigate]);

  return (
    <div className={clsx('flex h-screen overflow-hidden', darkMode && 'dark')}>
      <div className="flex h-screen overflow-hidden w-full app-shell">
        <div className="hidden md:flex h-full">
          <SidebarNew />
        </div>
        <MobileNavigationDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0">
          <ImpersonationBanner />
          <Header />
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6 md:p-6">
            <Outlet />
          </main>
        </div>
        <InstallPrompt />
        <MobileQuickActions />
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/50 dark:border-white/10 shadow-2xl px-2 py-2">
          <div className="flex items-center justify-around gap-1">
            {dynamicMobileNav.filter((item) => canAccessPath(item.to, role)).map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => clsx(
                  'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] sm:text-[10px] font-semibold',
                  isActive
                    ? 'bg-[var(--primary)]/10 dark:bg-[var(--primary)]/20 text-[var(--primary)] dark:text-[var(--primary)]'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate w-full text-center">{label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] sm:text-[10px] font-semibold text-gray-500 dark:text-gray-400"
            >
              <Menu className="w-4 h-4 shrink-0" />
              <span className="truncate w-full text-center">Menu</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
