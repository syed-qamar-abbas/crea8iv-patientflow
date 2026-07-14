import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Inbox,
  LogOut,
  MessageCircle,
  Moon,
  PackageCheck,
  Search,
  Settings,
  ShieldAlert,
  Star,
  Sun,
  User,
  Users,
  Warehouse,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { useTheme } from '../../context/ThemeContext';
import { getCurrentRole, getCurrentUser, ROLE_LABELS } from '../../config/roles';
import { appPath, fetchApi } from '../../config/api';
import WhatsNew from './WhatsNew';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/reception': 'Reception Desk',
  '/appointments': 'Appointments',
  '/clients': 'Patients',
  '/clinical': 'Operations Workspace',
  '/staff': 'Staff',
  '/services': 'Services',
  '/financials': 'Financials',
  '/packages': 'Packages',
  '/invoices': 'Invoices',
  '/inventory': 'Inventory',
  '/gallery': 'Gallery',
  '/feedback': 'Feedback',
  '/marketing': 'Marketing',
  '/whatsapp': 'WhatsApp Center',
  '/ai': 'AI Hub',
  '/meta-leads': 'Meta Lead Center',
  '/imports': 'Import Center',
  '/reports': 'Reports',
  '/audit': 'Audit Trail',
  '/branches': 'Branches',
  '/settings': 'Settings',
};

const MODULE_KEYS = {
  '/reception': 'reception',
  '/appointments': 'appointments',
  '/clients': 'clients',
  '/clinical': 'clinical',
  '/staff': 'staff',
  '/services': 'services',
  '/financials': 'financials',
  '/packages': 'packages',
  '/invoices': 'invoices',
  '/inventory': 'inventory',
  '/gallery': 'gallery',
  '/feedback': 'feedback',
  '/marketing': 'marketing',
  '/whatsapp': 'whatsapp',
  '/ai': 'ai',
  '/meta-leads': 'metaLeads',
  '/imports': 'imports',
  '/reports': 'reports',
  '/audit': 'audit',
  '/branches': 'branches',
  '/settings': 'settings',
};

const notificationIcons = {
  appointment: CalendarClock,
  schedule: CalendarClock,
  billing: CreditCard,
  inventory: Warehouse,
  patient: Users,
  package: PackageCheck,
  feedback: Star,
  whatsapp: MessageCircle,
  support: Inbox,
  subscription: ShieldAlert,
};

const priorityStyles = {
  urgent: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20',
  high: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  normal: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
  low: 'bg-slate-50 text-slate-600 ring-slate-100 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10',
};

function timeAgo(value) {
  const timestamp = value ? new Date(value.replace(' ', 'T')).getTime() : Date.now();
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const money = (value) => `PKR ${Number(value || 0).toLocaleString('en-US')}`;

export default function Header() {
  const { clinicInfo, features, industryTemplate } = useClinic();
  const { darkMode, toggleDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const user = getCurrentUser();
  const role = getCurrentRole();
  const subscription = features.subscription;
  const packageInfo = features.package || {};
  const planName = subscription?.packageName || packageInfo.name || 'Starter';
  const planCycle = subscription?.billingCycle || 'monthly';
  const planAmount = planCycle === 'annual'
    ? (packageInfo.annualPricePKR || packageInfo.pricePKR || 0)
    : (packageInfo.pricePKR || 0);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const titleForPath = (path) => {
    const moduleKey = MODULE_KEYS[path];
    return industryTemplate.config.modules?.[moduleKey]?.label || pageTitles[path] || null;
  };
  const title = titleForPath(location.pathname) || titleForPath('/' + pathParts[0]) || clinicInfo.name;
  const breadcrumb = pathParts.map((p, i) => {
    const path = '/' + pathParts.slice(0, i + 1).join('/');
    return { label: titleForPath('/' + p) || titleForPath(path) || p, path };
  });

  const loadNotifications = async () => {
    if (localStorage.getItem('clinic_auth') !== 'true') return;
    setLoadingNotifications(true);
    try {
      const data = await fetchApi('/notifications?limit=20');
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
      setUrgentCount(Number(data.urgentCount || 0));
    } catch (_) {
      setNotifications([]);
      setUnreadCount(0);
      setUrgentCount(0);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  const markAllRead = async () => {
    await fetchApi('/notifications/read-all', { method: 'POST' });
    await loadNotifications();
  };

  const openNotification = async (notification) => {
    if (!notification.computed) {
      await fetchApi(`/notifications/${notification.id}/read`, { method: 'POST' }).catch(() => {});
    }
    setShowNotifications(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
    await loadNotifications();
  };

  const handleLogout = () => {
    localStorage.removeItem('clinic_auth');
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_refresh');
    localStorage.removeItem('clinic_user');
    window.location.assign(appPath('/login'));
  };

  return (
    <header className="relative z-20 h-16 bg-white/82 dark:bg-slate-950/70 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Left: Title + Breadcrumb */}
      <div>
        <h1 className="text-[15px] font-bold text-gray-950 dark:text-white tracking-tight">{title}</h1>
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <span>{clinicInfo.name}</span>
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>/</span>
              <span className={i === breadcrumb.length - 1 ? 'text-indigo-600 dark:text-indigo-400 font-medium' : ''}>{b.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            data-global-search
            type="text"
            placeholder="Search patients, appointments..."
            className="premium-input pl-9 pr-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 w-72"
          />
        </div>

        {/* Subscription plan */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-200/60 bg-white/70 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <CreditCard className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          <div className="leading-tight">
            <p className="text-[10px] font-bold text-gray-700 dark:text-gray-200">{planName}</p>
            <p className="text-[9px] font-semibold capitalize text-gray-400 dark:text-gray-500">{money(planAmount)} / {planCycle}</p>
          </div>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 transition-all duration-200 shadow-sm"
          aria-label="Toggle dark mode"
        >
          {darkMode
            ? <Sun className="w-3.5 h-3.5 text-amber-400" />
            : <Moon className="w-3.5 h-3.5 text-slate-500" />}
          <span className="text-[11px] font-medium hidden sm:inline">
            {darkMode ? 'Light' : 'Dark'}
          </span>
        </button>

        {/* What's New (feature updates for owners/managers) */}
        <WhatsNew />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            className="relative p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors shadow-sm border border-transparent hover:border-gray-200/60"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className={`absolute top-1 right-1 min-w-4 h-4 px-1 text-white text-[9px] font-bold rounded-full flex items-center justify-center ${urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-[26rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-2xl rounded-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                  <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{unreadCount} active item{unreadCount === 1 ? '' : 's'}</p>
                </div>
                <button onClick={markAllRead} className="text-xs font-medium" style={{ color: 'var(--primary)' }}>Mark saved read</button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {loadingNotifications && notifications.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs font-medium text-gray-400">Loading clinic alerts...</div>
                )}
                {!loadingNotifications && notifications.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Bell className="mx-auto h-5 w-5 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">No active notifications</p>
                  </div>
                )}
                {notifications.map((n) => {
                  const Icon = notificationIcons[n.type] || AlertTriangle;
                  const priorityClass = priorityStyles[n.priority] || priorityStyles.normal;
                  return (
                    <button
                      type="button"
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className="w-full px-4 py-3 border-b border-gray-100/70 dark:border-white/5 hover:bg-gray-50/90 dark:hover:bg-white/5 cursor-pointer transition-colors text-left"
                    >
                      <div className="flex gap-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${priorityClass}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-5">{n.title}</p>
                            {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--primary)' }} />}
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 leading-5">{n.body}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ${priorityClass}`}>{n.priority || 'normal'}</span>
                            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{n.computed ? 'live alert' : timeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {notifications.length > 0 && (
                <div className="border-t border-gray-200/50 dark:border-white/10 bg-gray-50/80 px-4 py-2 text-[10px] font-medium text-gray-400 dark:bg-white/5 dark:text-gray-500">
                  Live alerts disappear when the underlying issue is resolved.
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors border border-transparent hover:border-gray-200/60"
          >
            <div
              className="brand-mark w-8 h-8 text-xs"
            >
              {user.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'AU'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">{user.name}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{ROLE_LABELS[role] || 'Owner'}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-2xl rounded-2xl z-50 overflow-hidden py-1">
              <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50/80 dark:hover:bg-white/10 transition-colors">
                <User className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Profile
              </button>
              <button onClick={() => navigate('/settings')} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50/80 dark:hover:bg-white/10 transition-colors">
                <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Settings
              </button>
              <div className="border-t border-gray-100/50 dark:border-white/10 mt-1" />
              <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/30 transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
