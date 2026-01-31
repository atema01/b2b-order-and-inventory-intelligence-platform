
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

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

  useEffect(() => {
    // Load Buyer from Auth Context/DB
    if (user && user.type === 'buyer') {
      const currentBuyer = db.getBuyer(user.id);
      if (currentBuyer) setBuyer(currentBuyer);
    }

    // Initial Cart Count
    updateCartCount();
    
    // Initial Notifications
    updateNotifCount();

    // Listen for custom cart events
    window.addEventListener('cart-updated', updateCartCount);
    
    return () => window.removeEventListener('cart-updated', updateCartCount);
  }, [location, user]); 

  const updateCartCount = () => {
    const savedCart = localStorage.getItem('b2b_buyer_cart');
    if (savedCart) {
      const parsed = JSON.parse(savedCart);
      const count = parsed.reduce((acc: number, item: any) => acc + item.quantity, 0);
      setCartCount(count);
    } else {
      setCartCount(0);
    }
  };

  const updateNotifCount = () => {
    if (user && user.id) {
        const notifs = db.getAllNotifications();
        const count = notifs.filter(n => n.recipientId === user.id && !n.isRead).length;
        setUnreadNotifCount(count);
    }
  };

  const handleCartClick = () => {
    navigate('/catalog?openCart=true');
  };

  const navItems = [
    { label: t('nav.dashboard'), path: '/', icon: 'dashboard' },
    { label: t('nav.catalog'), path: '/catalog', icon: 'storefront' },
    { label: t('nav.history'), path: '/orders', icon: 'receipt_long' },
    { label: t('nav.financials'), path: '/credit', icon: 'account_balance_wallet' },
  ];

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
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all group
                  ${location.pathname === item.path 
                    ? 'bg-[#E0F7FA] text-[#00839E] shadow-sm' 
                    : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'}
                `}
              >
                <span className={`material-symbols-outlined ${location.pathname === item.path ? '' : 'group-hover:text-[#00A3C4]'}`}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="px-4 pb-2 pt-6">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Account</p>
          </div>
          <nav className="space-y-1">
            <button 
              onClick={() => { navigate('/settings'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all group ${location.pathname === '/settings' ? 'bg-[#E0F7FA] text-[#00839E]' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'}`}
            >
              <span className="material-symbols-outlined group-hover:text-[#00A3C4]">settings</span>
              {t('nav.settings')}
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-gray-50 hover:text-slate-900 rounded-xl font-bold text-sm transition-all group">
              <span className="material-symbols-outlined group-hover:text-[#00A3C4]">support_agent</span>
              {t('login.support')}
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100">
           <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold text-sm w-full transition-all">
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
              
              {/* Context Title (Mobile) or Search (Desktop) */}
              <h2 className="lg:hidden font-black text-lg text-slate-800">
                {navItems.find(i => i.path === location.pathname)?.label || (location.pathname === '/notifications' ? 'Notifications' : location.pathname === '/settings' ? t('nav.settings') : 'B2B Intel')}
              </h2>

              <div className="hidden md:flex items-center bg-gray-100/50 rounded-xl px-4 py-2.5 w-80 focus-within:ring-2 focus-within:ring-[#00A3C4]/20 focus-within:bg-white transition-all">
                 <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
                 <input type="text" placeholder={t('common.search')} className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-gray-400 w-full ml-2" />
              </div>
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
              <div className="flex items-center gap-3 group">
                 <div className="text-right hidden lg:block">
                    <p className="text-xs font-black text-slate-800">{buyer?.contactPerson || user?.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{buyer?.companyName || 'Buyer'}</p>
                 </div>
                 <div className="size-9 lg:size-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm group-hover:border-[#00A3C4] transition-all">
                    <img src={buyer?.avatar || `https://ui-avatars.com/api/?name=${buyer?.contactPerson || user?.name || 'User'}&background=random`} alt="User" className="w-full h-full object-cover" />
                 </div>
              </div>
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
