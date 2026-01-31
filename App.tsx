
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
import AddMarginRule from './pages/AddMarginRule';
import MarginRuleDetails from './pages/MarginRuleDetails';
import AddRole from './pages/AddRole';
import AddStaff from './pages/AddStaff';
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
import BuyerOrders from './pages/BuyerOrders';
import BuyerOrderDetails from './pages/BuyerOrderDetails';
import BuyerPayment from './pages/BuyerPayment';
import Sidebar from './components/Sidebar';
import BuyerLayout from './components/BuyerLayout';
import { db } from './services/databaseService';
import { Staff } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Protected Route Wrapper
const RequireAuth: React.FC<{ allowedTypes?: string[] }> = ({ allowedTypes }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-400 font-bold">Authenticating...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedTypes && user && !allowedTypes.includes(user.type)) {
    // Redirect to appropriate dashboard if logged in but wrong type
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// Root Component wrapper to route based on User Type
const RootRouter: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (user.type === 'buyer') {
    return (
      <BuyerLayout onLogout={logout}>
        <Routes>
          <Route path="/" element={<BuyerDashboard />} />
          <Route path="/catalog" element={<BuyerCatalog />} />
          <Route path="/catalog/:id" element={<BuyerProductDetails />} />
          <Route path="/orders" element={<BuyerOrders />} />
          <Route path="/orders/:id" element={<BuyerOrderDetails />} />
          <Route path="/credit" element={<BuyerCredit />} />
          <Route path="/notifications" element={<BuyerNotifications />} />
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
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetails />} />
        <Route path="/orders/:id/process" element={<OrderProcess />} />
        <Route path="/orders/create" element={<CreateOrder />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/add" element={<AddProduct />} />
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/products/restock" element={<RestockProduct />} />
        <Route path="/returns" element={<ReturnsManagement />} />
        <Route path="/returns/log" element={<LogReturn />} />
        <Route path="/credits" element={<CreditRequests />} />
        <Route path="/credits/log" element={<LogCredit />} />
        <Route path="/buyers" element={<Buyers />} />
        <Route path="/buyers/:id" element={<BuyerDetails />} />
        <Route path="/buyers/add" element={<AddBuyer />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payments/:id" element={<PaymentReview />} />
        <Route path="/staff" element={<StaffManagement />} />
        <Route path="/staff/:id" element={<StaffDetails />} />
        <Route path="/staff/add" element={<AddStaff />} />
        <Route path="/roles" element={<ManageRoles />} />
        <Route path="/roles/add" element={<AddRole />} />
        <Route path="/roles/:id" element={<RoleDetails />} />
        <Route path="/pricing" element={<PricingManagement />} />
        <Route path="/pricing/add" element={<AddPricingRule />} />
        <Route path="/pricing/:id" element={<PricingDetails />} />
        <Route path="/pricing/bulk/add" element={<AddBulkRule />} />
        <Route path="/pricing/bulk/:id" element={<BulkRuleDetails />} />
        <Route path="/pricing/margin/add" element={<AddMarginRule />} />
        <Route path="/pricing/margin/:id" element={<MarginRuleDetails />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/logs" element={<SystemLogs />} />
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

  useEffect(() => {
    setSidebarOpen(false);
    
    // Check for unread notifications for seller
    const allNotifs = db.getAllNotifications();
    const count = allNotifs.filter(n => n.recipientId === 'seller' && !n.isRead).length;
    setUnreadCount(count);

    if (user && user.type === 'seller') {
       const staff = db.getAllStaff().find(s => s.id === user.id);
       setCurrentUser(staff);
    }
  }, [location, user]);

  const currentPath = location.pathname === '' ? '/' : location.pathname;
  const topLevelPaths = ['/', '/orders', '/products', '/analytics', '/payments', '/buyers', '/staff', '/roles', '/pricing', '/returns', '/credits', '/logs', '/settings'];
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
    if (path.startsWith('/pricing/margin')) return t('header.marginConfig');
    if (path.startsWith('/pricing/')) return t('header.tierConfig');
    if (path.startsWith('/payments/')) return t('header.reviewPayment');
    if (path === '/payments') return t('header.payments');
    if (path.startsWith('/alerts')) return t('header.alerts');
    if (path === '/logs') return t('header.logs');
    if (path === '/settings') return t('header.settings');
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
               <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-lg shadow-primary/20">
                 {initials}
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 relative pt-16">
          {children}
        </main>
      </div>
    </div>
  );
};

export default App;
