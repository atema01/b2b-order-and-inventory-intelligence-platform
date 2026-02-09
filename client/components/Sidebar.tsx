
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onLogout }) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();
  const { user } = useAuth();

// NEW (real backend data)
useEffect(() => {
  if (user?.permissions) {
    setPermissions(user.permissions);
  } else if (user?.role === 'Admin') {
    setPermissions({
      Orders: true, Products: true, Returns: true,
      Staff: true, Roles: true, Reports: true,
      Payments: true, Credits: true, Buyers: true,
      Pricing: true, Logs: true, Settings: true
    });
  }
}, [user]);

  // Define nav items with their required permission key and translation key
  const allNavItems = [
    { path: '/', label: t('nav.dashboard'), icon: 'dashboard', permission: 'Any' },
    { path: '/orders', label: t('nav.orders'), icon: 'receipt_long', permission: 'Orders' },
    { path: '/products', label: t('nav.products'), icon: 'category', permission: 'Products' },
    { path: '/returns', label: t('nav.returns'), icon: 'assignment_return', permission: 'Returns' }, 
    { path: '/credits', label: t('nav.credits'), icon: 'credit_card', permission: 'Credits' },
    { path: '/analytics', label: t('nav.reports'), icon: 'bar_chart', permission: 'Reports' },
    { path: '/payments', label: t('nav.payments'), icon: 'payments', permission: 'Payments' },
    { path: '/buyers', label: t('nav.buyers'), icon: 'storefront', permission: 'Buyers' },
    { path: '/pricing', label: t('nav.pricing'), icon: 'local_offer', permission: 'Pricing' },
    { path: '/staff', label: t('nav.staff'), icon: 'group', permission: 'Staff' },
    { path: '/roles', label: t('nav.roles'), icon: 'admin_panel_settings', permission: 'Roles' },
    { path: '/logs', label: t('nav.logs'), icon: 'history_edu', permission: 'Logs' },
  ];

  const filteredNavItems = allNavItems.filter(item => {
    if (item.permission === 'Any') return true;
    return permissions[item.permission];
  });

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 transform flex flex-col h-full
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header Section */}
        <div className="p-4 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-primary rounded p-1.5 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">inventory_2</span>
            </div>
            <span className="font-extrabold text-xl tracking-tight text-primary">B2B Intel</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-gray-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation Section (Scrollable) */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                ${isActive 
                  ? 'bg-primary/10 text-primary font-bold shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-primary'}
              `}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Section */}
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 font-semibold transition-all"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm">{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
