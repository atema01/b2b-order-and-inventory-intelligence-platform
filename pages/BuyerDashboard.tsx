
import React, { useState, useEffect } from 'react';
import { db } from '../services/databaseService';
import { Order, Product, Buyer, OrderStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const BuyerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [buyer, setBuyer] = useState<Buyer | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        const currentBuyer = db.getBuyer(userId);
        if (currentBuyer) setBuyer(currentBuyer);

        const allOrders = db.getAllOrders();
        setOrders(allOrders.filter(o => o.buyerId === userId));
    }
    setProducts(db.getAllProducts());
  }, []);

  const getStatusBadge = (status: OrderStatus) => {
    if (status === OrderStatus.SHIPPED) return 'bg-[#D1FAE5] text-[#065F46]';
    if (status === OrderStatus.PROCESSING) return 'bg-[#DBEAFE] text-[#1E40AF]';
    if (status === OrderStatus.PENDING) return 'bg-amber-100 text-amber-800';
    if (status === OrderStatus.DELIVERED) return 'bg-emerald-100 text-emerald-800';
    return 'bg-gray-100 text-gray-800';
  };

  const goToCatalog = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/catalog');
  };

  if (!buyer) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 lg:space-y-12">
      {/* Welcome */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('buyer.welcome')}, {buyer.contactPerson.split(' ')[0]}</h2>
          <p className="text-slate-500 text-sm lg:text-base font-medium">{t('buyer.overview')} <span className="font-bold text-slate-700">{buyer.companyName}</span></p>
        </div>
      </div>

      {/* Business Health Section - Full Width Stats */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 px-1">{t('buyer.overview')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-5 hover:border-[#1E40AF]/20 hover:shadow-md transition-all group">
            <div className="size-16 rounded-2xl bg-[#DBEAFE] text-[#1E40AF] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">local_shipping</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-black uppercase tracking-wide mb-1">{t('buyer.activeOrders')}</p>
              <p className="text-3xl font-black text-slate-800">{orders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED).length}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-5 hover:border-[#D97706]/20 hover:shadow-md transition-all group">
            <div className="size-16 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">star</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-black uppercase tracking-wide mb-1">{t('buyer.loyaltyTier')}</p>
              <p className="text-3xl font-black text-slate-800">{buyer.tier}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-5 hover:border-[#059669]/20 hover:shadow-md transition-all group">
            <div className="size-16 rounded-2xl bg-[#D1FAE5] text-[#059669] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">payments</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-black uppercase tracking-wide mb-1">{t('buyer.totalSpend')}</p>
              <p className="text-3xl font-black text-slate-800">{((buyer.totalSpend || 0)/1000).toFixed(1)}k <span className="text-sm text-gray-400 font-bold">ETB</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Orders Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-slate-900">{t('buyer.recentOrders')}</h3>
          <button onClick={() => navigate('/orders')} className="text-[#00A3C4] text-xs font-black uppercase tracking-widest hover:underline hover:text-[#008CA8] transition-colors">{t('buyer.viewHistory')}</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {orders.slice(0, 3).map(order => (
            <div 
              key={order.id} 
              onClick={() => navigate(`/orders/${order.id}`)}
              className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col justify-between group cursor-pointer hover:border-[#00A3C4]/30 hover:shadow-lg transition-all active:scale-[0.98] h-full"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-black text-slate-800 text-lg">#{order.id.replace('ORD-', '')}</p>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getStatusBadge(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div className="h-px w-full bg-gray-50"></div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                  {order.date}
                </p>
                <div className="flex justify-between items-end">
                   <p className="text-xs text-gray-500 font-bold">{order.items.length} {t('buyer.items')}</p>
                   <p className="font-black text-slate-800 text-xl">{order.total.toLocaleString()} <span className="text-xs font-bold text-gray-400">ETB</span></p>
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="col-span-full p-12 text-center text-gray-400 font-bold uppercase tracking-widest border-2 border-dashed border-gray-100 rounded-[32px]">
              {t('buyer.noOrders')}
            </div>
          )}
        </div>
      </section>

      {/* Recommended Products Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-slate-900">{t('buyer.recommended')}</h3>
          <button onClick={() => navigate('/catalog')} className="text-[#00A3C4] text-xs font-black uppercase tracking-widest hover:underline">{t('buyer.seeAll')}</button>
        </div>

        <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 snap-x snap-mandatory scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
          {products.slice(0, 3).map(p => {
            const totalStock = p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom;
            const isOutOfStock = totalStock === 0;
            const isLowStock = totalStock > 0 && totalStock < p.reorderPoint;

            return (
              <div 
                key={p.id} 
                onClick={() => navigate(`/catalog/${p.id}`)}
                className="snap-center shrink-0 w-64 lg:w-auto bg-white p-4 rounded-[28px] border border-gray-100 shadow-sm space-y-3 group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-50 border border-gray-50">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute top-2 left-2">
                    {isOutOfStock ? (
                      <span className="bg-red-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md shadow-sm">{t('buyer.soldOut')}</span>
                    ) : isLowStock ? (
                      <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md shadow-sm">{t('buyer.lowStock')}</span>
                    ) : (
                      <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md shadow-sm">{t('buyer.inStock')}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-[#00A3C4] tracking-widest truncate">{p.brand}</p>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2 h-9 mt-1 group-hover:text-[#00A3C4] transition-colors">{p.name}</h4>
                </div>

                <div className="flex items-center justify-between">
                    <p className="font-black text-slate-800 text-lg">{p.price.toLocaleString()} <span className="text-[10px] text-gray-400 font-bold">ETB</span></p>
                </div>

                <button 
                  onClick={goToCatalog}
                  className="w-full py-3 bg-[#00A3C4] hover:bg-[#008CA8] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
                >
                  <span className="material-symbols-outlined text-sm group-hover/btn:animate-bounce">storefront</span>
                  Shop in Catalog
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default BuyerDashboard;
