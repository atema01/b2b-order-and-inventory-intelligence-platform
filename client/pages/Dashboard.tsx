// Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Order, Product, OrderStatus, Buyer, Staff, StorageLocationId } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_STORAGE_LOCATIONS, fetchStorageLocations } from '../utils/storageLocations';

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [storageLocations, setStorageLocations] = useState(DEFAULT_STORAGE_LOCATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const { user } = useAuth();

  // Extract permissions and current user from auth context
  const permissions = user?.permissions || {};
  const canViewReports = Boolean(permissions['Reports']);
  const canViewProducts = Boolean(permissions['Products']);
  const canViewOrders = Boolean(permissions['Orders']);
  const canViewBuyers = Boolean(permissions['Buyers']);
  const currentUser = user as Staff | null;

  const normalizeStatus = (value: any): OrderStatus => {
    if (typeof value !== 'string') return OrderStatus.PENDING;
    const map: Record<string, OrderStatus> = {
      DRAFT: OrderStatus.DRAFT,
      PENDING: OrderStatus.PENDING,
      PROCESSING: OrderStatus.PROCESSING,
      SHIPPED: OrderStatus.SHIPPED,
      DELIVERED: OrderStatus.DELIVERED,
      UNDELIVERED: OrderStatus.UNDELIVERED,
      CANCELLED: OrderStatus.CANCELLED,
      CANCELED: OrderStatus.CANCELLED,
      DELETED: OrderStatus.DELETED,
      Draft: OrderStatus.DRAFT,
      Pending: OrderStatus.PENDING,
      Processing: OrderStatus.PROCESSING,
      Shipped: OrderStatus.SHIPPED,
      Delivered: OrderStatus.DELIVERED,
      Undelivered: OrderStatus.UNDELIVERED,
      Cancelled: OrderStatus.CANCELLED,
      Canceled: OrderStatus.CANCELLED,
      Deleted: OrderStatus.DELETED
    };
    return map[value] || OrderStatus.PENDING;
  };

  // Resolve buyer label from embedded order fields first, then buyers lookup.
  const getBuyerLabel = (order: any): string => {
    return (
      order?.buyerCompanyName ||
      order?.buyerName ||
      order?.companyName ||
      order?.buyer?.companyName ||
      order?.buyer?.name ||
      buyers.find(b => b.id === order?.buyerId)?.companyName ||
      'Unknown Buyer'
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load only datasets required by the sections this user can see.
        const needsOrders = canViewOrders || canViewReports;
        const needsProducts = canViewProducts || canViewReports;
        const needsBuyers = canViewOrders && canViewBuyers;

        if (needsOrders) {
          const ordersRes = await fetch('/api/orders', { credentials: 'include' });
          if (!ordersRes.ok) throw new Error('Failed to fetch orders');
          const ordersData = await ordersRes.json();
          setOrders(ordersData.map((o: any) => ({ ...o, status: normalizeStatus(o.status) })));
        } else {
          setOrders([]);
        }

        if (needsProducts) {
          const productsRes = await fetch('/api/products', { credentials: 'include' });
          if (!productsRes.ok) throw new Error('Failed to fetch products');
          const productsData = await productsRes.json();
          setProducts(productsData);
        } else {
          setProducts([]);
        }

        if (needsBuyers) {
          const buyersRes = await fetch('/api/buyers', { credentials: 'include' });
          if (buyersRes.ok) {
            const buyersData = await buyersRes.json();
            setBuyers(Array.isArray(buyersData) ? buyersData : []);
          } else {
            // Buyers list is optional for dashboard order cards.
            setBuyers([]);
          }
        } else {
          setBuyers([]);
        }
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [canViewOrders, canViewProducts, canViewReports, canViewBuyers]);

  useEffect(() => {
    if (!canViewProducts) return;
    let active = true;
    fetchStorageLocations()
      .then((locations) => {
        if (active) setStorageLocations(locations);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [canViewProducts]);

  // Loading state
  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load dashboard</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate metrics (same as before)
  const totalInventoryValue = products.reduce((acc, p) => {
    const totalQty = storageLocations.reduce((sum, loc) => sum + (p.stock[loc.id as StorageLocationId] || 0), 0);
    return acc + (totalQty * p.price);
  }, 0);

  const totalSKUs = products.length;

  const itemsOnOrder = orders
    .filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PROCESSING)
    .reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  const deliveredUnits = orders
    .filter(o => o.status === OrderStatus.DELIVERED)
    .reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
  
  const onHandUnits = products.reduce((acc, p) => 
    acc + storageLocations.reduce((sum, loc) => sum + (p.stock[loc.id as StorageLocationId] || 0), 0), 0);

  const sellThroughRateVal = (deliveredUnits + onHandUnits) > 0 
    ? ((deliveredUnits / (deliveredUnits + onHandUnits)) * 100).toFixed(1) 
    : "0";

  const stats = [
    { label: t('dash.invValue'), value: `ETB ${(totalInventoryValue / 1000000).toFixed(1)}M`, trend: '+2.1%', up: true },
    { label: t('dash.totalSkus'), value: totalSKUs.toLocaleString(), trend: '+0.5%', up: true },
    { label: t('dash.onOrder'), value: itemsOnOrder.toLocaleString(), trend: '-1.2%', up: false },
    { label: t('dash.sellThrough'), value: `${sellThroughRateVal}%`, trend: '+1.8%', up: true },
  ];

  const lowStockCount = products.filter(p => p.status === 'Low' || p.status === 'Empty').length;

  const locations = storageLocations.map((loc) => {
    const items = products.reduce((acc, p) => acc + (p.stock[loc.id as StorageLocationId] || 0), 0);
    const value = products.reduce((acc, p) => acc + ((p.stock[loc.id as StorageLocationId] || 0) * p.price), 0);
    const capUnits = loc.capacityUnits;
    const capPercent = capUnits > 0 ? Math.min(100, Math.round((items / capUnits) * 100)) : 0;
    const capTone = capUnits === 0
      ? 'bg-gray-300'
      : capPercent >= 85
        ? 'bg-red-500'
        : capPercent >= 60
          ? 'bg-amber-500'
          : 'bg-green-500';
    return {
      id: loc.id,
      name: loc.name,
      items,
      value,
      capUnits,
      capPercent,
      capTone
    };
  });

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  const recentOrders = orders
    .filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PROCESSING)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 pb-24 lg:pb-8">
      
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2 mb-2">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            {t('dash.hello')}, {currentUser?.name.split(' ')[0] || 'Admin'}
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats Grid - Controlled by 'Reports' Permission */}
      {canViewReports && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <p className="text-[10px] lg:text-sm font-semibold text-gray-500 mb-1 lg:mb-2 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg lg:text-3xl font-black text-slate-800">{stat.value}</p>
              <p className={`text-[10px] lg:text-xs font-bold mt-1 lg:mt-2 ${stat.up ? 'text-green-600' : 'text-red-500'}`}>
                {stat.trend} <span className="hidden lg:inline font-normal text-gray-400 ml-1">{t('dash.lastMonth')}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Alerts & Locations - Controlled by 'Products' Permission */}
        {canViewProducts && (
          <div className="lg:col-span-4 space-y-6 lg:space-y-8">
            <div className={`rounded-3xl p-5 lg:p-6 relative overflow-hidden group border ${lowStockCount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`flex items-center gap-2 ${lowStockCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  <span className="material-symbols-outlined font-black">
                    {lowStockCount > 0 ? 'warning' : 'check_circle'}
                  </span>
                  <h2 className="font-extrabold text-lg">{t('dash.alerts')}</h2>
                </div>
                <span className={`text-white text-xs font-black px-2 py-1 rounded-full shadow-lg ${lowStockCount > 0 ? 'bg-red-600 shadow-red-200' : 'bg-green-600 shadow-green-200'}`}>
                  {lowStockCount}
                </span>
              </div>
              {lowStockCount > 0 ? (
                <>
                  <p className="text-red-800 text-sm leading-relaxed mb-6 font-medium">
                    {t('dash.alertsDesc')}
                  </p>
                  <Link 
                    to="/alerts"
                    className="block w-full bg-red-600 text-white py-4 rounded-2xl font-black text-center shadow-xl shadow-red-200 active:scale-[0.98] transition-all hover:bg-red-700"
                  >
                    {t('dash.action')}
                  </Link>
                </>
              ) : (
                <p className="text-green-800 text-sm leading-relaxed font-medium">
                  All stock levels look healthy. No low stock items at the moment.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-black text-slate-800 px-1">{t('dash.distribution')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {locations.map((loc, i) => (
                  <Link 
                    key={i} 
                    to={`/products?location=${loc.id}`}
                    className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group block"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors">{loc.name}</h3>
                        <p className="text-[11px] text-gray-500 font-medium">
                          {loc.items.toLocaleString()} {t('prod.units')} • ETB {formatCurrency(loc.value)} • {loc.capUnits > 0 ? `${loc.capUnits.toLocaleString()} cap` : 'Capacity not set'}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <span>{t('dash.stockCapacity')}</span>
                        <span>{loc.capUnits > 0 ? `${loc.capPercent}%` : 'Not set'}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${loc.capTone} transition-all duration-1000`} style={{ width: `${loc.capPercent}%` }}></div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Recent Orders - Controlled by 'Orders' Permission */}
        {canViewOrders && (
          <div className="lg:col-span-8 bg-white border border-gray-100 rounded-3xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 lg:p-6 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800">{t('dash.pulse')}</h2>
              <Link to="/orders" className="text-primary text-xs lg:text-sm font-black hover:underline uppercase tracking-wider">{t('dash.viewAll')}</Link>
            </div>
            
            {/* Desktop Table */}
            <div className="hidden lg:block flex-1 overflow-x-auto scrollbar-hide">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">{t('common.id')}</th>
                    <th className="px-6 py-4">{t('common.buyer')}</th>
                    <th className="px-6 py-4">{t('common.revenue')}</th>
                    <th className="px-6 py-4 text-center">{t('common.status')}</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentOrders.map((order) => {
                    const buyerLabel = getBuyerLabel(order);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-5">
                          <Link to={`/orders/${order.id}`} className="font-black text-primary hover:underline">#{order.id.split('-').pop()}</Link>
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-bold text-slate-800 leading-none">{buyerLabel}</span>
                        </td>
                        <td className="px-6 py-5 font-black text-slate-800">ETB {order.total.toLocaleString()}</td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : order.status === OrderStatus.DELIVERED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {t(`status.${order.status.toLowerCase()}` as any)}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Link to={`/orders/${order.id}`} className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">arrow_forward</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="lg:hidden divide-y divide-gray-50">
              {recentOrders.map((order) => {
                const buyerLabel = getBuyerLabel(order);
                return (
                  <Link key={order.id} to={`/orders/${order.id}`} className="p-5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-all">
                    <div className="space-y-1">
                      <p className="font-black text-primary text-sm">#{order.id.split('-').pop()}</p>
                      <p className="font-bold text-slate-800 text-base">{buyerLabel}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{order.date}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="font-black text-slate-900">ETB {order.total.toLocaleString()}</p>
                      <span className={`inline-block px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {t(`status.${order.status.toLowerCase()}` as any)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB (Now visible on Desktop too) - Controlled by 'Orders' Permission */}
      {canViewOrders && (
        <Link 
          to="/orders/create"
          className="fixed bottom-6 right-6 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white group"
          title={t('dash.newOrder')}
        >
          <span className="material-symbols-outlined text-3xl font-light group-hover:rotate-90 transition-transform duration-300">add</span>
        </Link>
      )}
    </div>
  );
};

export default Dashboard;
