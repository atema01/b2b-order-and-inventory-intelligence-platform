
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Buyer } from '../types';
import { getCart } from '../services/cartStore';
import { getCartCount } from '../services/cartStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';

interface BuyerLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const BuyerLayout: React.FC<BuyerLayoutProps> = ({ children, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  const saveDraft = async (useKeepalive = false) => {
    if (!user || user.role !== 'Buyer') return;
    const items = getCart();
    try {
      await fetch('/api/orders/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        keepalive: useKeepalive,
        body: JSON.stringify({ items })
      });
    } catch (err) {
      console.error('Failed to save draft order:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const toBuyerProfile = (me: any): Buyer => ({
      id: me?.id || user?.id || '',
      companyName: me?.companyName || 'Buyer Account',
      contactPerson: me?.name || 'Buyer',
      email: me?.email || '',
      phone: me?.phone || '',
      address: '',
      outstandingBalance: 0,
      paymentTerms: '',
      totalSpend: 0,
      totalOrders: 0,
      status: 'Active',
      tier: me?.tier || 'Bronze',
      discountRate: 0,
      joinDate: ''
    });

    const loadBuyerProfile = async () => {
      if (!user || user.role !== 'Buyer') return;
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const meData = await res.json();
        if (isMounted) setBuyer(toBuyerProfile(meData));
      } catch (err) {
        console.error('Failed to load buyer profile:', err);
      }
    };

    // Load Buyer from Auth Context/DB
    if (user && user.role === 'Buyer') {
      loadBuyerProfile();
    }

    // Initial Cart Count
    setCartCount(getCartCount());
    
    // Initial Notifications
    updateNotifCount();

    // Listen for custom cart events
    window.addEventListener('cart-updated', updateCartCount);
    
    return () => {
      isMounted = false;
      window.removeEventListener('cart-updated', updateCartCount);
    };
  }, [location, user]); 

  useEffect(() => {
    const handleBeforeUnload = () => {
      void saveDraft(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  const updateCartCount = (event?: Event) => {
    const custom = event as CustomEvent | undefined;
    if (custom?.detail && typeof custom.detail.count === 'number') {
      setCartCount(custom.detail.count);
    } else {
      setCartCount(getCartCount());
    }
  };

  const updateNotifCount = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const count = (data || []).filter((n: any) => !n.isRead).length;
      setUnreadNotifCount(count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useRealtimeEvent('realtime:notifications', () => {
    void updateNotifCount();
  });

  const handleCartClick = () => {
    navigate('/catalog?openCart=true');
  };

  const navItems = [
    { label: t('nav.dashboard'), path: '/', icon: 'dashboard' },
    { label: t('nav.catalog'), path: '/catalog', icon: 'storefront' },
    { label: t('nav.history'), path: '/orders', icon: 'receipt_long' },
    { label: t('nav.payments'), path: '/payments', icon: 'payments' },
    { label: t('nav.financials'), path: '/credit', icon: 'account_balance_wallet' },
  ];

  const getMobileTitle = () => {
    if (location.pathname.startsWith('/credit/')) return 'Credit Details';
    if (location.pathname === '/notifications') return 'Notifications';
    if (location.pathname === '/settings') return t('nav.settings');
    return navItems.find((item) => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)))?.label || 'B2B Intel';
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-slate-900 flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 h-20 flex items-center justify-between border-b border-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-[#00A3C4] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#00A3C4]/20">
                <span className="material-symbols-outlined text-xl">spa</span>
            </div>
            <h1 className="font-black text-xl text-slate-900 tracking-tight">B2B Intel</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 p-1 hover:bg-gray-50 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Mobile Profile Summary */}
        <div className="lg:hidden p-6 bg-slate-50 border-b border-gray-100">
            <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-white border border-gray-200 overflow-hidden shrink-0">
                    <img src={buyer?.avatar || `https://ui-avatars.com/api/?name=${buyer?.contactPerson || 'User'}&background=random`} alt="User" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{buyer?.contactPerson}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{buyer?.companyName}</p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="px-4 pb-2">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Main Menu</p>
          </div>
          <nav className="space-y-1">
            {navItems.map(item => (
              (() => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));
                return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all group
                  ${isActive
                    ? 'bg-[#E0F7FA] text-[#00839E] shadow-sm' 
                    : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'}
                `}
              >
                <span className={`material-symbols-outlined ${isActive ? '' : 'group-hover:text-[#00A3C4]'}`}>{item.icon}</span>
                {item.label}
              </button>
                );
              })()
            ))}
          </nav>

         
     
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={async () => {
              await saveDraft();
              onLogout();
            }}
            className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold text-sm w-full transition-all"
          >
            <span className="material-symbols-outlined">logout</span>
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100 shrink-0">
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="text-slate-800 p-2 -ml-2 lg:hidden hover:bg-gray-100 rounded-xl"
              >
                <span className="material-symbols-outlined text-2xl">menu</span>
              </button>
              
              {/* Context Title */}
              <h2 className="lg:hidden font-black text-lg text-slate-800">
                {getMobileTitle()}
              </h2>
            </div>

            <div className="flex items-center gap-3 lg:gap-6">
              <button 
                onClick={() => navigate('/notifications')}
                className="relative text-slate-600 hover:text-[#00A3C4] transition-colors p-2 hover:bg-gray-50 rounded-xl"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-2xl">notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              <button 
                onClick={handleCartClick}
                className="relative text-slate-600 hover:text-[#00A3C4] transition-colors p-2 hover:bg-gray-50 rounded-xl"
              >
                <span className="material-symbols-outlined text-2xl">shopping_cart</span>
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 bg-[#00A3C4] text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {cartCount}
                  </span>
                )}
              </button>
              
              <div className="hidden lg:block h-8 w-px bg-gray-200"></div>

              {/* Profile */}
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 group"
                title={t('nav.settings')}
              >
                 <div className="text-right hidden lg:block">
                    <p className="text-xs font-black text-slate-800">{buyer?.contactPerson || user?.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{buyer?.companyName || 'Buyer'}</p>
                 </div>
                 <div className="size-9 lg:size-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm group-hover:border-[#00A3C4] transition-all">
                    <img src={buyer?.avatar || `https://ui-avatars.com/api/?name=${buyer?.contactPerson || user?.name || 'User'}&background=random`} alt="User" className="w-full h-full object-cover" />
                 </div>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#FAFAFA] relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default BuyerLayout;
