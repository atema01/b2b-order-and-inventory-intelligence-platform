
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import OrderProcess from './pages/OrderProcess';
import CreateOrder from './pages/CreateOrder';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import RestockProduct from './pages/RestockProduct';
import AddProduct from './pages/AddProduct';
import ReturnsManagement from './pages/ReturnsManagement';
import LogReturn from './pages/LogReturn';
import CreditRequests from './pages/CreditRequests';
import CreditDetails from './pages/CreditDetails';
import LogCredit from './pages/LogCredit';
import Buyers from './pages/Buyers';
import BuyerDetails from './pages/BuyerDetails';
import AddBuyer from './pages/AddBuyer';
import Payments from './pages/Payments';
import PaymentReview from './pages/PaymentReview';
import StaffManagement from './pages/StaffManagement';
import StaffDetails from './pages/StaffDetails';
import ManageRoles from './pages/ManageRoles';
import RoleDetails from './pages/RoleDetails';
import PricingManagement from './pages/PricingManagement';
import PricingDetails from './pages/PricingDetails';
import AddPricingRule from './pages/AddPricingRule';
import AddBulkRule from './pages/AddBulkRule';
import BulkRuleDetails from './pages/BulkRuleDetails';
import AddRole from './pages/AddRole';
import AddStaff from './pages/AddStaff';
import Report from './pages/Report';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import BuyerNotifications from './pages/BuyerNotifications';
import Alerts from './pages/Alerts';
import SystemLogs from './pages/SystemLogs';
import Settings from './pages/Settings';
import Login from './pages/Login';
import BuyerLogin from './pages/BuyerLogin';
import AccountType from './pages/AccountType';
import BuyerDashboard from './pages/BuyerDashboard';
import BuyerCatalog from './pages/BuyerCatalog';
import BuyerProductDetails from './pages/BuyerProductDetails';
import BuyerCredit from './pages/BuyerCredit';
import BuyerCreditDetails from './pages/BuyerCreditDetails';
import BuyerOrders from './pages/BuyerOrders';
import BuyerOrderDetails from './pages/BuyerOrderDetails';
import BuyerPayment from './pages/BuyerPayment';
import BuyerPayments from './pages/BuyerPayments';
import Sidebar from './components/Sidebar';
import BuyerLayout from './components/BuyerLayout';
import ChatbotWidget from './components/ChatbotWidget';
import { Staff } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useRealtimeEvent } from './hooks/useRealtimeEvent';
import { connectRealtime, disconnectRealtime } from './services/realtime';

type PermissionKey =
  | 'Orders'
  | 'Products'
  | 'Returns'
  | 'Credits'
  | 'Reports'
  | 'Payments'
  | 'Buyers'
  | 'Pricing'
  | 'Staff'
  | 'Roles'
  | 'Logs';

const RealtimeBridge: React.FC = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectRealtime();
      return;
    }

    const socket = connectRealtime();
    return () => {
      socket.off('socket:ready');
    };
  }, [isAuthenticated]);

  return null;
};

// Protected Route Wrapper
const RequireAuth: React.FC<{ allowedTypes?: string[] }> = ({ allowedTypes }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();
  const userType = user?.role === 'Buyer' ? 'buyer' : 'seller';

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-400 font-bold">Authenticating...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedTypes && user && !allowedTypes.includes(userType)) {
    // Redirect to appropriate dashboard if logged in but wrong type
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const RequirePermission: React.FC<{ permission?: PermissionKey; allOf?: PermissionKey[]; children: React.ReactNode }> = ({ permission, allOf, children }) => {
  const { user } = useAuth();

  // Public seller routes like Dashboard/Settings pass no permission and are always allowed.
  if (!permission && (!allOf || allOf.length === 0)) return <>{children}</>;

  // Backward compatibility: full Admin role bypasses fine-grained checks.
  if (user?.role === 'Admin') return <>{children}</>;

  // Role permissions from /api/auth/me are the source of truth for route access.
  const hasSinglePermission = permission ? Boolean(user?.permissions?.[permission]) : true;
  const hasAllPermissions = allOf ? allOf.every((perm) => Boolean(user?.permissions?.[perm])) : true;
  const canAccess = hasSinglePermission && hasAllPermissions;
  if (canAccess) return <>{children}</>;

  return <Navigate to="/" replace />;
};

// Root Component wrapper to route based on User Type
const RootRouter: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (user.role === 'Buyer') {
    return (
      <BuyerLayout onLogout={logout}>
        <Routes>
          <Route path="/" element={<BuyerDashboard />} />
          <Route path="/catalog" element={<BuyerCatalog />} />
          <Route path="/catalog/:id" element={<BuyerProductDetails />} />
          <Route path="/orders" element={<BuyerOrders />} />
          <Route path="/orders/:id" element={<BuyerOrderDetails />} />
            <Route path="/products/:id" element={<ProductDetails />} />  {/* ← This must exist */}
          <Route path="/credit" element={<BuyerCredit />} />
          <Route path="/credit/:id" element={<BuyerCreditDetails />} />
          <Route path="/notifications" element={<BuyerNotifications />} />
          <Route path="/payments" element={<BuyerPayments />} />
          <Route path="/payment" element={<BuyerPayment />} />
          <Route path="/payment/:orderId" element={<BuyerPayment />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BuyerLayout>
    );
  }

  // Seller/Staff Layout
  return (
    <SellerLayout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<RequirePermission permission="Orders"><Orders /></RequirePermission>} />
        <Route path="/orders/:id" element={<RequirePermission permission="Orders"><OrderDetails /></RequirePermission>} />
        <Route path="/orders/:id/process" element={<RequirePermission permission="Orders"><OrderProcess /></RequirePermission>} />
        <Route path="/orders/create" element={<RequirePermission permission="Orders"><CreateOrder /></RequirePermission>} />
        <Route path="/products" element={<RequirePermission permission="Products"><Products /></RequirePermission>} />
        <Route path="/products/add" element={<RequirePermission permission="Products"><AddProduct /></RequirePermission>} />
        <Route path="/products/:id" element={<RequirePermission permission="Products"><ProductDetails /></RequirePermission>} />
        <Route path="/products/restock" element={<RequirePermission permission="Products"><RestockProduct /></RequirePermission>} />
        <Route path="/returns" element={<RequirePermission permission="Returns"><ReturnsManagement /></RequirePermission>} />
        <Route path="/returns/log" element={<RequirePermission permission="Returns"><LogReturn /></RequirePermission>} />
        <Route path="/credits" element={<RequirePermission permission="Credits"><CreditRequests /></RequirePermission>} />
        <Route path="/credits/:id" element={<RequirePermission permission="Credits"><CreditDetails /></RequirePermission>} />
        <Route path="/credits/log" element={<RequirePermission permission="Credits"><LogCredit /></RequirePermission>} />
        <Route path="/buyers" element={<RequirePermission permission="Buyers"><Buyers /></RequirePermission>} />
        <Route path="/buyers/:id" element={<RequirePermission permission="Buyers"><BuyerDetails /></RequirePermission>} />
        <Route path="/buyers/add" element={<RequirePermission permission="Buyers"><AddBuyer /></RequirePermission>} />
        <Route path="/payments" element={<RequirePermission permission="Payments"><Payments /></RequirePermission>} />
        <Route path="/payments/:id" element={<RequirePermission permission="Payments"><PaymentReview /></RequirePermission>} />
        <Route path="/staff" element={<RequirePermission permission="Staff"><StaffManagement /></RequirePermission>} />
        <Route path="/staff/:id" element={<RequirePermission permission="Staff"><StaffDetails /></RequirePermission>} />
        <Route path="/staff/add" element={<RequirePermission allOf={['Staff', 'Roles']}><AddStaff /></RequirePermission>} />
        <Route path="/roles" element={<RequirePermission permission="Roles"><ManageRoles /></RequirePermission>} />
        <Route path="/roles/add" element={<RequirePermission permission="Roles"><AddRole /></RequirePermission>} />
        <Route path="/roles/:id" element={<RequirePermission permission="Roles"><RoleDetails /></RequirePermission>} />
        <Route path="/pricing" element={<RequirePermission permission="Pricing"><PricingManagement /></RequirePermission>} />
        <Route path="/pricing/add" element={<RequirePermission permission="Pricing"><AddPricingRule /></RequirePermission>} />
        <Route path="/pricing/:id" element={<RequirePermission permission="Pricing"><PricingDetails /></RequirePermission>} />
        <Route path="/pricing/bulk/add" element={<RequirePermission permission="Pricing"><AddBulkRule /></RequirePermission>} />
        <Route path="/pricing/bulk/:id" element={<RequirePermission permission="Pricing"><BulkRuleDetails /></RequirePermission>} />
        <Route path="/reports" element={<RequirePermission permission="Reports"><Report /></RequirePermission>} />
        <Route path="/analytics" element={<RequirePermission permission="Reports"><Analytics /></RequirePermission>} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/alerts" element={<RequirePermission permission="Products"><Alerts /></RequirePermission>} />
        <Route path="/logs" element={<RequirePermission permission="Logs"><SystemLogs /></RequirePermission>} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </SellerLayout>
  );
}

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <HashRouter>
          <RealtimeBridge />
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<PublicOnlyRoute><AccountType /></PublicOnlyRoute>} />
            <Route path="/login/seller" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/login/buyer" element={<PublicOnlyRoute><BuyerLogin /></PublicOnlyRoute>} />

            {/* Protected Routes */}
            <Route element={<RequireAuth />}>
              <Route path="/*" element={<RootRouter />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

// Helper to redirect authenticated users away from login pages
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const SellerLayout: React.FC<{ children: React.ReactNode, onLogout: () => void }> = ({ children, onLogout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<Staff | undefined>(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isBuyer = user?.role === 'Buyer';

  useEffect(() => {
    let isMounted = true;
    setSidebarOpen(false);

    const loadUnread = async () => {
      try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const count = (data || []).filter((n: any) => !n.isRead).length;
        if (isMounted) setUnreadCount(count);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    loadUnread();

    if (user && !isBuyer) {
      setCurrentUser(user as Staff);
    }

    return () => {
      isMounted = false;
    };
  }, [location, user, isBuyer]);

  useRealtimeEvent('realtime:notifications', () => {
    void (async () => {
      try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount((data || []).filter((n: any) => !n.isRead).length);
      } catch (err) {
        console.error('Failed to refresh notifications:', err);
      }
    })();
  });

  const currentPath = location.pathname === '' ? '/' : location.pathname;
  const topLevelPaths = ['/', '/orders', '/products', '/reports', '/analytics', '/payments', '/buyers', '/staff', '/roles', '/pricing', '/returns', '/credits', '/logs', '/settings'];
  const isTopLevel = topLevelPaths.includes(currentPath);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const getHeaderTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return t('header.dashboard');
    if (path === '/returns') return t('header.returns');
    if (path === '/returns/log') return t('header.logReturn');
    if (path === '/credits') return t('header.creditMgmt');
    if (path.startsWith('/credits/') && path !== '/credits/log') return 'Credit Request';
    if (path === '/credits/log') return t('header.logCredit');
    if (path.startsWith('/orders/create')) return t('header.createOrder');
    if (path.startsWith('/orders/') && path.endsWith('/process')) return t('header.processOrder');
    if (path.startsWith('/orders/') && path.split('/').length === 3) return t('header.orderDetails');
    if (path === '/orders') return t('header.orders');
    if (path === '/products/add') return t('header.addProduct');
    if (path.startsWith('/products/restock')) return t('header.restock');
    if (path.startsWith('/products/')) return t('header.productDetails');
    if (path === '/products') return t('header.products');
    if (path === '/buyers') return t('header.buyers');
    if (path === '/buyers/add') return t('header.addBuyer');
    if (path.startsWith('/buyers/')) return t('header.buyerProfile');
    if (path === '/staff') return t('header.staff');
    if (path === '/staff/add') return t('header.addStaff');
    if (path.startsWith('/staff/')) return t('header.staffProfile');
    if (path === '/roles') return t('header.roles');
    if (path === '/roles/add') return t('header.addRole');
    if (path.startsWith('/roles/')) return t('header.roleConfig');
    if (path === '/pricing') return t('header.pricing');
    if (path === '/pricing/add') return t('header.addPricing');
    if (path.startsWith('/pricing/bulk')) return t('header.bulkConfig');
    if (path.startsWith('/pricing/')) return t('header.tierConfig');
    if (path.startsWith('/payments/')) return t('header.reviewPayment');
    if (path === '/payments') return t('header.payments');
    if (path.startsWith('/alerts')) return t('header.alerts');
    if (path === '/logs') return t('header.logs');
    if (path === '/settings') return t('header.settings');
    if (path === '/reports') return t('header.reports');
    if (path === '/analytics') return t('header.analytics');
    return path.split('/')[1] || t('header.dashboard');
  };

  const displayName = currentUser ? currentUser.name : (user?.name || 'Staff');
  const displayRole = currentUser ? currentUser.role : (user?.role || 'Staff');
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300 min-w-0">
        <header className="fixed top-0 right-0 left-0 lg:left-64 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {!isTopLevel ? (
              <button 
                type="button"
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-xl text-primary transition-colors flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                aria-label="Go back"
              >
                <span className="material-symbols-outlined font-bold">arrow_back</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-slate-600 shrink-0"
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
            )}
            <h1 className="text-base lg:text-lg font-extrabold text-slate-800 capitalize truncate">
              {getHeaderTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-2">
            <Link to="/notifications" className="p-2 hover:bg-gray-100 rounded-full text-slate-500 relative">
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </Link>
            
            <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
               <div className="text-right hidden md:block">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{displayName}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{displayRole}</p>
               </div>
               <Link
                 to="/settings"
                 className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-lg shadow-primary/20"
                 title={t('nav.settings')}
               >
                 {initials}
               </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 relative pt-16">
          {children}
          <ChatbotWidget />
        </main>
      </div>
    </div>
  );
};

export default App;
