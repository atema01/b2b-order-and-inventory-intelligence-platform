
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Order, Product, OrderStatus, Buyer, Staff } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();

  useEffect(() => {
    setOrders(db.getAllOrders());
    setProducts(db.getAllProducts());
    setBuyers(db.getAllBuyers());

    const userId = localStorage.getItem('userId');
    if (userId) {
        const staff = db.getAllStaff().find(s => s.id === userId);
        if (staff) {
          setCurrentUser(staff);
          const role = db.getAllRoles().find(r => r.name === staff.role);
          if (role) {
            setPermissions(role.permissions);
          } else if (staff.role === 'Admin') {
            // Default full access for Admin if role definition missing
            setPermissions({
              'Orders': true, 'Products': true, 'Staff': true, 
              'Reports': true, 'Payments': true, 'Buyers': true, 'Settings': true
            });
          }
        }
    }
  }, []);

  const totalInventoryValue = products.reduce((acc, p) => {
    const totalQty = p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom;
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
    acc + p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom, 0);

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

  const locations = [
    { 
      id: 'mainWarehouse',
      name: t('loc.warehouse'), 
      items: products.reduce((acc, p) => acc + p.stock.mainWarehouse, 0),
      value: products.reduce((acc, p) => acc + (p.stock.mainWarehouse * p.price), 0),
      cap: 82 
    },
    { 
      id: 'backRoom',
      name: t('loc.backroom'), 
      items: products.reduce((acc, p) => acc + p.stock.backRoom, 0),
      value: products.reduce((acc, p) => acc + (p.stock.backRoom * p.price), 0),
      cap: 94
    },
    { 
      id: 'showRoom',
      name: t('loc.showroom'), 
      items: products.reduce((acc, p) => acc + p.stock.showRoom, 0),
      value: products.reduce((acc, p) => acc + (p.stock.showRoom * p.price), 0),
      cap: 38
    },
  ];

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

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
      {permissions['Reports'] && (
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
        {permissions['Products'] && (
          <div className="lg:col-span-4 space-y-6 lg:space-y-8">
            <div className="bg-red-50 border border-red-100 rounded-3xl p-5 lg:p-6 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="material-symbols-outlined font-black">warning</span>
                  <h2 className="font-extrabold text-lg">{t('dash.alerts')}</h2>
                </div>
                <span className="bg-red-600 text-white text-xs font-black px-2 py-1 rounded-full shadow-lg shadow-red-200">{lowStockCount}</span>
              </div>
              <p className="text-red-800 text-sm leading-relaxed mb-6 font-medium">
                {t('dash.alertsDesc')}
              </p>
              <Link 
                to="/alerts"
                className="block w-full bg-red-600 text-white py-4 rounded-2xl font-black text-center shadow-xl shadow-red-200 active:scale-[0.98] transition-all hover:bg-red-700"
              >
                {t('dash.action')}
              </Link>
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
                        <p className="text-[11px] text-gray-500 font-medium">{loc.items.toLocaleString()} {t('prod.units')} • ETB {formatCurrency(loc.value)}</p>
                      </div>
                      <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <span>{t('dash.stockCapacity')}</span>
                        <span>{loc.cap}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${loc.cap}%` }}></div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Recent Orders - Controlled by 'Orders' Permission */}
        {permissions['Orders'] && (
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
                  {orders.slice(0, 5).map((order) => {
                    const buyer = buyers.find(b => b.id === order.buyerId);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-5">
                          <Link to={`/orders/${order.id}`} className="font-black text-primary hover:underline">#{order.id.split('-').pop()}</Link>
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-bold text-slate-800 leading-none">{buyer?.companyName || "Unknown Buyer"}</span>
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
              {orders.slice(0, 5).map((order) => {
                const buyer = buyers.find(b => b.id === order.buyerId);
                return (
                  <Link key={order.id} to={`/orders/${order.id}`} className="p-5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-all">
                    <div className="space-y-1">
                      <p className="font-black text-primary text-sm">#{order.id.split('-').pop()}</p>
                      <p className="font-bold text-slate-800 text-base">{buyer?.companyName || "Unknown"}</p>
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
      {permissions['Orders'] && (
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
