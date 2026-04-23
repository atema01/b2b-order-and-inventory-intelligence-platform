import React, { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Order, OrderStatus, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface PredictionItem {
  name: string;
  growth: string;
  badge: string;
  isPositive: boolean;
}

const extractArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const emptyPredictions = (): PredictionItem[] => ([
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true }
]);

const Report: React.FC = () => {
  const { t } = useLanguage();
  const [growthPercentage, setGrowthPercentage] = useState(0);
  const [growthTrend, setGrowthTrend] = useState<{ name: string; val: number }[]>([]);
  const [isGrowthPositive, setIsGrowthPositive] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [inventoryTurnover, setInventoryTurnover] = useState(0);
  const [inventoryTurnoverTrend, setInventoryTurnoverTrend] = useState<{ name: string; val: number }[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>(emptyPredictions);
  const [timeResolution, setTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');

  const normalizeStatus = (value: any): OrderStatus => {
    if (typeof value !== 'string') return OrderStatus.PENDING;
    const map: Record<string, OrderStatus> = {
      DRAFT: OrderStatus.DRAFT,
      ON_REVIEW: OrderStatus.ON_REVIEW,
      'ON REVIEW': OrderStatus.ON_REVIEW,
      PENDING: OrderStatus.PENDING,
      PROCESSING: OrderStatus.PROCESSING,
      SHIPPED: OrderStatus.SHIPPED,
      DELIVERED: OrderStatus.DELIVERED,
      UNDELIVERED: OrderStatus.UNDELIVERED,
      CANCELLED: OrderStatus.CANCELLED,
      CANCELED: OrderStatus.CANCELLED,
      DELETED: OrderStatus.DELETED,
      Draft: OrderStatus.DRAFT,
      'On Review': OrderStatus.ON_REVIEW,
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersResult, productsResult, turnoverResult] = await Promise.allSettled([
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' }),
          fetch('/api/orders/metrics/inventory-turnover', { credentials: 'include' })
        ]);

        if (ordersResult.status !== 'fulfilled' || !ordersResult.value.ok) throw new Error('Failed to fetch orders');
        if (productsResult.status !== 'fulfilled' || !productsResult.value.ok) throw new Error('Failed to fetch products');

        const ordersPayload = await ordersResult.value.json();
        const productsPayload = await productsResult.value.json();
        const allProducts = extractArray<Product>(productsPayload);
        const allOrders = extractArray<Order>(ordersPayload)
          .map((order) => ({ ...order, status: normalizeStatus(order.status) }))
          .filter((order) => ![OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.DELETED].includes(order.status));

        if (turnoverResult.status === 'fulfilled' && turnoverResult.value.ok) {
          const turnoverData = await turnoverResult.value.json();
          setInventoryTurnover(Number(turnoverData.turnover || 0));
          setInventoryTurnoverTrend(
            Array.isArray(turnoverData.trend) && turnoverData.trend.length > 0
              ? turnoverData.trend
              : [{ name: 'No Data', val: 0 }]
          );
        } else {
          setInventoryTurnover(0);
          setInventoryTurnoverTrend([{ name: 'No Data', val: 0 }]);
        }

        if (allOrders.length === 0) {
          setGrowthTrend([{ name: 'No Data', val: 0 }]);
          setPredictions(emptyPredictions());
          setTotalRevenue(0);
          return;
        }

        const timestamps = allOrders.map((order) => new Date(order.date).getTime()).filter((time) => !isNaN(time));
        if (timestamps.length === 0) return;

        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const daySpan = (maxTime - minTime) / (1000 * 3600 * 24);

        let mode: 'daily' | 'weekly' | 'monthly' = 'monthly';
        if (daySpan <= 60) mode = 'daily';
        else if (daySpan <= 730) mode = 'weekly';
        setTimeResolution(mode === 'daily' ? 'Day' : mode === 'weekly' ? 'Week' : 'Month');

        const aggregatedRevenue: Record<string, number> = {};
        const productSalesCurrent: Record<string, number> = {};
        const productSalesPrevious: Record<string, number> = {};
        let totalRev = 0;

        const getKey = (d: Date) => {
          if (mode === 'daily') return d.toISOString().split('T')[0];
          if (mode === 'weekly') return getStartOfWeek(d).toISOString().split('T')[0];
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        const now = new Date();
        const trendCutoff = new Date();
        const prevTrendCutoff = new Date();
        if (mode === 'daily') {
          trendCutoff.setDate(now.getDate() - 7);
          prevTrendCutoff.setDate(now.getDate() - 14);
        } else if (mode === 'weekly') {
          trendCutoff.setDate(now.getDate() - 30);
          prevTrendCutoff.setDate(now.getDate() - 60);
        } else {
          trendCutoff.setMonth(now.getMonth() - 1);
          prevTrendCutoff.setMonth(now.getMonth() - 2);
        }

        allOrders.forEach((order) => {
          const dateObj = new Date(order.date);
          if (isNaN(dateObj.getTime())) return;

          const key = getKey(dateObj);
          aggregatedRevenue[key] = (aggregatedRevenue[key] || 0) + order.total;
          totalRev += order.total;

          const timestamp = dateObj.getTime();
          const inCurrent = timestamp >= trendCutoff.getTime();
          const inPrevious = timestamp < trendCutoff.getTime() && timestamp >= prevTrendCutoff.getTime();

          order.items.forEach((item) => {
            if (inCurrent) productSalesCurrent[item.productId] = (productSalesCurrent[item.productId] || 0) + item.quantity;
            if (inPrevious) productSalesPrevious[item.productId] = (productSalesPrevious[item.productId] || 0) + item.quantity;
          });
        });

        setTotalRevenue(totalRev);

        const timelineData: { date: Date; key: string; revenue: number }[] = [];
        const startDate = new Date(minTime);
        const endDate = new Date(maxTime);
        let current = mode === 'daily' ? getStartOfDay(startDate) : mode === 'weekly' ? getStartOfWeek(startDate) : getStartOfMonth(startDate);
        let loopGuard = 0;

        while (current <= endDate && loopGuard < 1000) {
          const key = getKey(current);
          timelineData.push({ date: new Date(current), key, revenue: aggregatedRevenue[key] || 0 });
          if (mode === 'daily') current.setDate(current.getDate() + 1);
          else if (mode === 'weekly') current.setDate(current.getDate() + 7);
          else current.setMonth(current.getMonth() + 1);
          loopGuard++;
        }

        setGrowthTrend(timelineData.map((entry) => ({ name: entry.key, val: entry.revenue })));

        if (timelineData.length >= 2) {
          const lastVal = timelineData[timelineData.length - 1].revenue;
          const prevVal = timelineData[timelineData.length - 2].revenue;
          if (prevVal === 0) {
            setGrowthPercentage(lastVal > 0 ? 100 : 0);
            setIsGrowthPositive(true);
          } else {
            const pct = ((lastVal - prevVal) / prevVal) * 100;
            setGrowthPercentage(Math.abs(pct));
            setIsGrowthPositive(pct >= 0);
          }
        }

        const topProdIds = Object.keys(productSalesCurrent)
          .sort((a, b) => productSalesCurrent[b] - productSalesCurrent[a])
          .slice(0, 4);

        const predictionCards = topProdIds.map((productId) => {
          const product = allProducts.find((entry) => entry.id === productId);
          const currentQty = productSalesCurrent[productId];
          const previousQty = productSalesPrevious[productId] || 0;

          let trend = 0;
          if (previousQty > 0) trend = ((currentQty - previousQty) / previousQty) * 100;
          else if (currentQty > 0) trend = 100;

          let badge = 'Stable';
          if (trend > 20) badge = 'Trending Up';
          if (trend > 50) badge = 'High Demand';
          if (trend < -10) badge = 'Slowing';

          return {
            name: product ? product.name : 'Unknown',
            growth: `${trend >= 0 ? '+' : ''}${trend.toFixed(0)}%`,
            badge,
            isPositive: trend >= 0
          };
        });

        setPredictions(predictionCards.length > 0 ? predictionCards : emptyPredictions());
      } catch (err) {
        console.error('Report fetch error:', err);
        setGrowthTrend([{ name: 'No Data', val: 0 }]);
        setInventoryTurnover(0);
        setInventoryTurnoverTrend([{ name: 'No Data', val: 0 }]);
        setPredictions(emptyPredictions());
      }
    };

    fetchData();
  }, []);

  const handleExport = () => {
    const csvRows = [];
    const dateStr = new Date().toLocaleDateString();

    csvRows.push(['B2B Intel Report', `Generated: ${dateStr}`]);
    csvRows.push([]);
    csvRows.push(['--- Summary Statistics ---']);
    csvRows.push(['Total Revenue', `ETB ${totalRevenue.toLocaleString()}`]);
    csvRows.push(['Sales Growth', `${isGrowthPositive ? '+' : '-'}${growthPercentage.toFixed(1)}%`]);
    csvRows.push(['Inventory Turnover', `${inventoryTurnover.toFixed(2)}x`]);
    csvRows.push([]);
    csvRows.push(['--- Revenue Trend ---']);
    csvRows.push(['Period', 'Revenue']);
    growthTrend.forEach((row) => {
      if (row.name === 'No Data') return;
      csvRows.push([`"${row.name}"`, row.val]);
    });
    csvRows.push([]);
    csvRows.push(['--- Top Product Trends ---']);
    csvRows.push(['Product Name', 'Metric', 'Status']);
    predictions.forEach((item) => {
      csvRows.push([`"${item.name}"`, `"${item.growth}"`, `"${item.badge}"`]);
    });

    const csvContent = `data:text/csv;charset=utf-8,${csvRows.map((entry) => entry.join(',')).join('\n')}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `report_${dateStr.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">{t('reports.title')}</h1>
          <p className="text-gray-500 font-medium mt-1">{t('reports.subtitle')}</p>
        </div>
        <button
          onClick={handleExport}
          className="bg-primary text-white p-3 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/10 active:scale-95 transition-all self-start lg:self-end"
          title="Download Report CSV"
        >
          <span className="material-symbols-outlined block">download</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500">{t('analytics.salesGrowth')}</p>
            <div className="w-24 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTrend}>
                  <Line type="monotone" dataKey="val" stroke={isGrowthPositive ? '#10B981' : '#EF4444'} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className={`text-3xl font-black ${isGrowthPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isGrowthPositive ? '+' : '-'}{growthPercentage.toFixed(1)}%
          </h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 font-bold">
            <span className="material-symbols-outlined text-xs">{isGrowthPositive ? 'trending_up' : 'trending_down'}</span>
            {t('analytics.vsPrevious')} {timeResolution.toLowerCase()}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500">{t('analytics.totalRevenue')}</p>
            <div className="w-24 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTrend}>
                  <Line type="monotone" dataKey="val" stroke="#005A9C" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800">
            {totalRevenue > 1000000 ? `${(totalRevenue / 1000000).toFixed(1)}M` : `${(totalRevenue / 1000).toFixed(1)}K`} <span className="text-sm text-gray-400">ETB</span>
          </h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 font-bold">
            <span className="material-symbols-outlined text-xs">payments</span> {t('analytics.allTime')}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500">{t('analytics.inventoryTurnover')}</p>
            <div className="w-24 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventoryTurnoverTrend}>
                  <Line type="monotone" dataKey="val" stroke="#F59E0B" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{inventoryTurnover.toFixed(2)}x</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 font-bold">
            <span className="material-symbols-outlined text-xs">sync</span> {t('analytics.efficiencyScore')}
          </p>
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <span className="material-symbols-outlined">bar_chart</span>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">{t('reports.revenueTrend')}</h2>
            <p className="text-sm text-gray-400 font-medium">{t('reports.revenueTrendDesc')}</p>
          </div>
        </div>
        <div className="p-6 bg-gray-50/30">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#005A9C" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#005A9C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="val" name={t('analytics.totalRevenue')} stroke="#005A9C" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">trending_up</span>
          <div>
            <h2 className="text-lg font-black text-slate-800">{t('analytics.topTrends')}</h2>
            <p className="text-sm text-gray-400 font-medium">{t('reports.topTrendsDesc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-50">
          {predictions.map((item, index) => (
            <div key={index} className="p-6 space-y-4 hover:bg-gray-50 transition-colors">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-relaxed h-8 line-clamp-2">{item.name}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${item.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>{item.growth}</span>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${item.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {item.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Report;
