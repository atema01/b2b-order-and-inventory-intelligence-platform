
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Order, Product, Buyer, OrderStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import RefreshIndicator from '../components/RefreshIndicator';
import { buyerQueryKeys, loadBuyerDashboardData } from '../services/buyerQueries';

const BuyerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: buyerQueryKeys.dashboard(user?.id),
    queryFn: () => loadBuyerDashboardData(user?.id)
  });

  const orders = data?.orders ?? [];
  const products = data?.products ?? [];
  const buyer = data?.buyer ?? null;

  useRealtimeEvent('realtime:inventory', () => {
    queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
  });

  useRealtimeEvent('realtime:orders', (detail?: { buyerId?: string }) => {
    if (!user?.id || (detail?.buyerId && detail.buyerId !== user.id)) return;
    queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
  });

  useRealtimeEvent('realtime:payments', (detail?: { buyerId?: string }) => {
    if (!user?.id || (detail?.buyerId && detail.buyerId !== user.id)) return;
    queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
  });

  useRealtimeEvent('realtime:credits', (detail?: { buyerId?: string }) => {
    if (!user?.id || (detail?.buyerId && detail.buyerId !== user.id)) return;
    queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
  });

  const normalizeStatus = (status: string) => status?.toString().trim().toUpperCase() || '';
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const isBetween = (value: string, start: Date, end: Date) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  };

  const formatTrend = (current: number, previous: number) => {
    if (previous === 0) {
      if (current === 0) return { text: '0.0%', up: true };
      return { text: '+100.0%', up: true };
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? '+' : '';
    return { text: `${sign}${change.toFixed(1)}%`, up: change >= 0 };
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) return `ETB ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `ETB ${(value / 1000).toFixed(1)}K`;
    return `ETB ${value.toLocaleString()}`;
  };

  const getStatusBadge = (status: OrderStatus) => {
    const normalized = normalizeStatus(status);
    if (normalized === OrderStatus.SHIPPED) return 'bg-[#D1FAE5] text-[#065F46]';
    if (normalized === OrderStatus.PROCESSING) return 'bg-[#DBEAFE] text-[#1E40AF]';
    if (normalized === OrderStatus.PENDING) return 'bg-amber-100 text-amber-800';
    if (normalized === OrderStatus.DELIVERED) return 'bg-emerald-100 text-emerald-800';
    return 'bg-gray-100 text-gray-800';
  };

  const goToCatalog = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/catalog');
  };

  const activeOrdersCount = orders.filter((order) => {
    const status = normalizeStatus(order.status);
    return status !== OrderStatus.DELIVERED &&
      status !== OrderStatus.CANCELLED &&
      status !== OrderStatus.DELETED;
  }).length;

  const previousMonthOrders = orders.filter((order) =>
    isBetween(order.date, startOfLastMonth, startOfCurrentMonth)
  );
  const previousActiveOrdersCount = previousMonthOrders.filter((order) => {
    const status = normalizeStatus(order.status);
    return status !== OrderStatus.DELIVERED &&
      status !== OrderStatus.CANCELLED &&
      status !== OrderStatus.DELETED;
  }).length;
  const currentMonthOrdersCount = orders.filter((order) =>
    isBetween(order.date, startOfCurrentMonth, now)
  ).length;
  const previousMonthOrdersCount = previousMonthOrders.length;
  const currentMonthSpend = orders
    .filter((order) => isBetween(order.date, startOfCurrentMonth, now))
    .reduce((sum, order) => sum + (order.amountPaid || 0), 0);
  const previousMonthSpend = previousMonthOrders
    .reduce((sum, order) => sum + (order.amountPaid || 0), 0);
  const totalSpend = orders.reduce((sum, order) => sum + (order.amountPaid || 0), 0);
  const totalSpendBeforeThisMonth = totalSpend - currentMonthSpend;

  const activeOrdersTrend = formatTrend(activeOrdersCount, previousActiveOrdersCount);
  const monthlyOrdersTrend = formatTrend(currentMonthOrdersCount, previousMonthOrdersCount);
  const monthlySpendTrend = formatTrend(currentMonthSpend, previousMonthSpend);
  const totalSpendTrend = formatTrend(totalSpend, totalSpendBeforeThisMonth);

  const summaryCards = [
    { label: t('buyer.activeOrders'), value: activeOrdersCount.toLocaleString(), trend: activeOrdersTrend.text, up: activeOrdersTrend.up },
    { label: t('buyer.monthlyOrders'), value: currentMonthOrdersCount.toLocaleString(), trend: monthlyOrdersTrend.text, up: monthlyOrdersTrend.up },
    { label: t('buyer.monthlySpend'), value: formatCompactCurrency(currentMonthSpend), trend: monthlySpendTrend.text, up: monthlySpendTrend.up },
    { label: t('buyer.totalSpend'), value: formatCompactCurrency(totalSpend), trend: totalSpendTrend.text, up: totalSpendTrend.up }
  ];

  if (isLoading) return <LoadingState message="Loading dashboard..." />;
  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-semibold text-red-700">Failed to load buyer dashboard data.</p>
          <p className="mb-4 text-sm text-red-600">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: buyerQueryKeys.dashboard(user?.id) })}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!buyer) return <div className="p-8">No buyer profile found.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 lg:space-y-12">
      {/* Welcome */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('dash.hello')}, {buyer.contactPerson.split(' ')[0]}</h2>
 <p className="text-slate-500 text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>        </div>
        <RefreshIndicator visible={isFetching && !isLoading} />
      </div>

      {/* Business Health Section - Full Width Stats */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <p className="text-[10px] lg:text-sm font-semibold text-gray-500 mb-1 lg:mb-2 uppercase tracking-wider">{card.label}</p>
              <p className="text-lg lg:text-3xl font-black text-slate-800">{card.value}</p>
              <p className={`text-[10px] lg:text-xs font-bold mt-1 lg:mt-2 ${card.up ? 'text-green-600' : 'text-red-500'}`}>
                {card.trend} <span className="hidden lg:inline font-normal text-gray-400 ml-1">{t('dash.lastMonth')}</span>
              </p>
            </div>
          ))}
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

      {/* Product Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-slate-900">Catalog</h3>
          <button onClick={() => navigate('/catalog')} className="text-[#00A3C4] text-xs font-black uppercase tracking-widest hover:underline">{t('buyer.seeAll')}</button>
        </div>

        <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 snap-x snap-mandatory scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
          {products.slice(0, 3).map(p => {
            const totalStock = p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom;
            const isOutOfStock = totalStock === 0;
            const isLowStock = totalStock > 0 && totalStock < p.reorderPoint;
            const isRecommended = Boolean(p.recommended);

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
                  {isRecommended && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E0F7FA] px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#008CA8]">
                      <span className="material-symbols-outlined text-[11px]">stars</span>
                      {t('buyer.recommended')}
                    </span>
                  )}
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
