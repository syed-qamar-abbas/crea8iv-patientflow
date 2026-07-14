import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, UserCheck, Stethoscope,
  DollarSign, Settings, ChevronLeft, ChevronRight,
  Package, Receipt, Archive, Image, MessageSquare,
  Megaphone, Shield, Building2, ClipboardList, FileBarChart,
  MessageCircle, Bot, Facebook, Database, LifeBuoy, FlaskConical, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { useClinic } from '../../context/ClinicContext';
import { useState } from 'react';
import { canAccessPath, getCurrentRole, ROLE_LABELS } from '../../config/roles';
import ClinicLogoMark from '../branding/ClinicLogoMark';

export const navGroups = [
  {
    label: 'Main Menu',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/reception', icon: ClipboardList, label: 'Reception Desk' },
      { to: '/appointments', icon: Calendar, label: 'Appointments' },
      { to: '/clients', icon: Users, label: 'Patients' },
      { to: '/clinical', icon: Stethoscope, label: 'Operations Workspace' },
      { to: '/staff', icon: UserCheck, label: 'Staff' },
      { to: '/services', icon: Stethoscope, label: 'Services' },
      { to: '/financials', icon: DollarSign, label: 'Financials' },
    ],
  },
  {
    label: 'Billing & Packages',
    items: [
      { to: '/packages', icon: Package, label: 'Packages' },
      { to: '/invoices', icon: Receipt, label: 'Invoices' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/lab', icon: FlaskConical, label: 'Lab' },
      { to: '/inventory', icon: Archive, label: 'Inventory' },
      { to: '/gallery', icon: Image, label: 'Gallery' },
      { to: '/feedback', icon: MessageSquare, label: 'Feedback' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/marketing', icon: Megaphone, label: 'Marketing' },
      { to: '/outreach', icon: MessageCircle, label: 'Manual Outreach' },
      { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp Center' },
      { to: '/ai', icon: Bot, label: 'AI Hub' },
      { to: '/ai-receptionist', icon: Sparkles, label: 'AI Receptionist' },
      { to: '/meta-leads', icon: Facebook, label: 'Meta Leads' },
      { to: '/imports', icon: Database, label: 'Import Center' },
      { to: '/reports', icon: FileBarChart, label: 'Reports' },
      { to: '/branches', icon: Building2, label: 'Branches' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/audit', icon: Shield, label: 'Audit Trail' },
      { to: '/support', icon: LifeBuoy, label: 'Support' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export const FEATURE_LOCKS = {
  '/marketing': 'marketingEnabled',
  '/whatsapp': 'whatsappEnabled',
  '/ai': 'aiEnabled',
  '/ai-receptionist': 'aiEnabled',
  '/meta-leads': 'metaLeadsEnabled',
  '/imports': 'importsEnabled',
};

export const MODULE_KEYS = {
  '/dashboard': 'dashboard',
  '/reception': 'reception',
  '/appointments': 'appointments',
  '/clients': 'clients',
  '/clinical': 'clinical',
  '/staff': 'staff',
  '/services': 'services',
  '/financials': 'financials',
  '/packages': 'packages',
  '/invoices': 'invoices',
  '/lab': 'lab',
  '/inventory': 'inventory',
  '/gallery': 'gallery',
  '/feedback': 'feedback',
  '/marketing': 'marketing',
  '/outreach': 'outreach',
  '/whatsapp': 'whatsapp',
  '/ai': 'ai',
  '/ai-receptionist': 'aiReceptionist',
  '/meta-leads': 'metaLeads',
  '/imports': 'imports',
  '/reports': 'reports',
  '/branches': 'branches',
  '/audit': 'audit',
  '/support': 'support',
  '/settings': 'settings',
};

const money = (value) => `PKR ${Number(value || 0).toLocaleString('en-US')}`;

export function getEffectiveNavGroups(features, industryTemplate, role) {
  const allNavItems = navGroups.flatMap(group => group.items);
  const navigationGroups = (industryTemplate?.config?.navigation?.groups || []).map(group => ({
    label: group.label,
    items: (group.modules || []).map(moduleKey => allNavItems.find(item => MODULE_KEYS[item.to] === moduleKey)).filter(Boolean),
  }));
  const baseGroups = navigationGroups.length ? navigationGroups : navGroups;
  return baseGroups.map(group => ({
    ...group,
    items: group.items.filter((item) => {
      if (!canAccessPath(item.to, role)) return false;
      const featureKey = FEATURE_LOCKS[item.to];
      if (featureKey && !features?.[featureKey]) return false;
      const templateModule = industryTemplate?.config?.modules?.[MODULE_KEYS[item.to]];
      if (templateModule?.visible === false) return false;
      return true;
    }),
  })).filter(group => group.items.length > 0);
}

export default function SidebarNew() {
  const { clinicInfo, features, industryTemplate } = useClinic();
  const [collapsed, setCollapsed] = useState(false);
  const role = getCurrentRole();
  const subscription = features.subscription;
  const packageInfo = features.package || {};
  const planName = subscription?.packageName || packageInfo.name || 'Starter';
  const planCycle = subscription?.billingCycle || 'monthly';
  const planAmount = planCycle === 'annual'
    ? (packageInfo.annualPricePKR || packageInfo.pricePKR || 0)
    : (packageInfo.pricePKR || 0);
  const expiresAt = subscription?.expiresAt ? String(subscription.expiresAt).slice(0, 10) : '';
  const effectiveNavGroups = getEffectiveNavGroups(features, industryTemplate, role);

  return (
    <aside
      className={clsx(
        'flex flex-col h-full transition-all duration-300 ease-in-out relative overflow-hidden border-r border-white/10',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ background: '#0f1720' }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0)_34%)] pointer-events-none" />

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-8 z-20 bg-white text-slate-700 rounded-full p-1 shadow-lg ring-1 ring-black/5 hover:scale-105 transition-all"
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Logo */}
      <div className="relative z-10 px-4 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <ClinicLogoMark
            logo={clinicInfo.logo}
            alt={`${clinicInfo.name} logo`}
            className="brand-mark w-9 h-9 shrink-0 overflow-hidden"
            textClassName="text-white font-bold text-sm"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-tight truncate">{clinicInfo.name}</p>
              <p className="text-white/55 text-xs truncate">{clinicInfo.tagline}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Brand Suite</p>
            <p className="mt-1 text-xs text-white/70 truncate">{clinicInfo.activeBranch}</p>
            <p className="mt-1 text-[10px] font-semibold text-white/40">{ROLE_LABELS[role]} Portal</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Subscribed Plan</p>
              <p className="mt-1 text-xs font-bold text-white truncate">{planName}</p>
              <p className="mt-0.5 text-[10px] font-semibold capitalize text-white/50">
                {money(planAmount)} / {planCycle}
              </p>
              {expiresAt && <p className="mt-0.5 text-[10px] text-white/35">Active until {expiresAt}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {effectiveNavGroups.map(group => {
          const visibleItems = group.items;
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-white/40 text-[10px] uppercase tracking-widest px-2 mb-1.5 font-medium">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map(({ to, icon: Icon, label }) => {
                const templateModule = industryTemplate.config.modules?.[MODULE_KEYS[to]] || {};
                const navLabel = templateModule.label || label;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border-l-2 border-white'
                          : 'text-white/60 hover:text-white hover:bg-white/10 border-l-2 border-transparent'
                      )
                    }
                    title={collapsed ? navLabel : undefined}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{navLabel}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <div className="relative z-10 h-4 shrink-0 border-t border-white/10" />
    </aside>
  );
}
