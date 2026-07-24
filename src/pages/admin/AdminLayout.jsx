import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Receipt, LogOut, LifeBuoy, SlidersHorizontal,
} from 'lucide-react';
import { appPath } from '../../config/api';
import ClinicLogoMark from '../../components/branding/ClinicLogoMark';

const PLATFORM_LOGO = '/crea8iv.png';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/leads', label: 'Leads', icon: Users },
  { to: '/admin/tenants', label: 'Clinics', icon: Building2 },
  { to: '/admin/payments', label: 'Payments', icon: Receipt },
  { to: '/admin/support', label: 'Support', icon: LifeBuoy },
  { to: '/admin/platform', label: 'Platform', icon: SlidersHorizontal },
];

export default function AdminLayout() {
  const user = JSON.parse(localStorage.getItem('clinic_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('clinic_auth');
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_refresh');
    localStorage.removeItem('clinic_user');
    window.location.assign(appPath('/login'));
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-orange-50 dark:from-[#0a0e18] dark:via-[#0f1420] dark:to-[#100a1f]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 hidden md:flex flex-col border-r border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl">
        <div className="p-5 flex items-center gap-3 border-b border-gray-200/70 dark:border-white/10">
          <ClinicLogoMark
            logo={PLATFORM_LOGO}
            alt="Crea8iv Media logo"
            className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-orange-100 bg-white shadow-lg"
            imageClassName="h-full w-full object-contain p-1"
          />
          <div>
            <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">Crea8iv PatientFlow</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Owner Portal</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200/70 dark:border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.name || 'Admin'}</p>
            <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <ClinicLogoMark
              logo={PLATFORM_LOGO}
              alt="Crea8iv Media logo"
              className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden border border-orange-100 bg-white shadow-sm"
              imageClassName="h-full w-full object-contain p-1"
            />
            <p className="text-sm font-black text-gray-900 dark:text-white">PatientFlow Owner Portal</p>
          </div>
          <button onClick={handleLogout} className="text-gray-500"><LogOut className="w-4 h-4" /></button>
        </div>
        <div className="md:hidden flex gap-1 p-2 border-b border-gray-200/70 dark:border-white/10 overflow-x-auto">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  isActive ? 'bg-orange-600 text-white' : 'text-gray-600 dark:text-gray-300'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
