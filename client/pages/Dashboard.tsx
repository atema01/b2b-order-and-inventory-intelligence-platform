import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import RefreshIndicator from '../components/RefreshIndicator';
import LoadingState from '../components/LoadingState';

type DashboardTrend = {
  text: string;
  up: boolean;
};

type DashboardStat = {
  value: number;
  trend: DashboardTrend;
};

type DashboardLocation = {
  id: string;
  name: string;
  items: number;
  value: number;
  capUnits: number;
  capPercent: number;
};

type DashboardOrder = {
  id: string;
  date: string;
  status: string;
  total: number;
  buyerLabel: string;
  unitCount: number;
};

type DashboardSummary = {
  stats: {
    inventoryValue: DashboardStat;
    totalSkus: DashboardStat;
    onOrder: DashboardStat;
    sellThrough: DashboardStat;
  };
  lowStockCount: number;
  locations: DashboardLocation[];
  recentOrders: DashboardOrder[];
};

const formatCompactCurrency = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
};

const getStatusBadgeClasses = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'pending') return 'bg-amber-100 text-amber-700';
  if (normalized === 'processing') return 'bg-blue-100 text-blue-700';
  if (normalized === 'delivered') return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
};

const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const permissions = user?.permissions || {};
  const canViewReports = Boolean(permissions['Reports']);
  const canViewProducts = Boolean(permissions['Products']);
  const canViewOrders = Boolean(permissions['Orders']);
  const firstName = user?.name?.split(' ')[0] || 'Admin';

  const {
    data,
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: ['dashboard-summary', user?.id || 'guest'],
    queryFn: async (): Promise<DashboardSummary> => {
      const response = await fetch('/api/dashboard/summary', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }

      return response.json();
    },
    staleTime: 60_000,
    refetchOnMount: false
  });

  useRealtimeEvent('realtime:orders', () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  });

  useRealtimeEvent('realtime:inventory', () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  });

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-semibold text-red-700">Failed to load dashboard</p>
          <p className="mb-4 text-sm text-red-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })}
            className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = data ?? {
    stats: {
      inventoryValue: { value: 0, trend: { text: '0.0%', up: true } },
      totalSkus: { value: 0, trend: { text: '0.0%', up: true } },
      onOrder: { value: 0, trend: { text: '0.0%', up: true } },
      sellThrough: { value: 0, trend: { text: '0.0%', up: true } }
    },
    lowStockCount: 0,
    locations: [],
    recentOrders: []
  };

  const stats = [
    {
      label: t('dash.invValue'),
      value: `ETB ${formatCompactCurrency(summary.stats.inventoryValue.value)}`,
      trend: summary.stats.inventoryValue.trend.text,
      up: summary.stats.inventoryValue.trend.up
    },
    {
      label: t('dash.totalSkus'),
      value: summary.stats.totalSkus.value.toLocaleString(),
      trend: summary.stats.totalSkus.trend.text,
      up: summary.stats.totalSkus.trend.up
    },
    {
      label: t('dash.onOrder'),
      value: summary.stats.onOrder.value.toLocaleString(),
      trend: summary.stats.onOrder.trend.text,
      up: summary.stats.onOrder.trend.up
    },
    {
      label: t('dash.sellThrough'),
      value: `${summary.stats.sellThrough.value}%`,
      trend: summary.stats.sellThrough.trend.text,
      up: summary.stats.sellThrough.trend.up
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-24 pt-4 lg:space-y-8 lg:px-8 lg:pb-8">
      <div className="mb-2 flex flex-col justify-between gap-2 lg:flex-row lg:items-end">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">
            {t('dash.hello')}, {firstName}
          </h2>
          <p className="text-sm font-medium text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <RefreshIndicator visible={isFetching && !isLoading} />
      </div>

      {canViewReports && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md lg:rounded-3xl lg:p-6"
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 lg:mb-2 lg:text-sm">
                {stat.label}
              </p>
              <p className="text-lg font-black text-slate-800 lg:text-3xl">{stat.value}</p>
              <p className={`mt-1 text-[10px] font-bold lg:mt-2 lg:text-xs ${stat.up ? 'text-green-600' : 'text-red-500'}`}>
                {stat.trend}
                <span className="ml-1 hidden font-normal text-gray-400 lg:inline">{t('dash.lastMonth')}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {canViewProducts && (
          <div className="space-y-6 lg:col-span-4 lg:space-y-8">
            <div className={`relative overflow-hidden rounded-3xl border p-5 lg:p-6 ${summary.lowStockCount > 0 ? 'border-red-100 bg-red-50' : 'border-green-100 bg-green-50'}`}>
              <div className="mb-4 flex items-start justify-between">
                <div className={`flex items-center gap-2 ${summary.lowStockCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  <span className="material-symbols-outlined font-black">
                    {summary.lowStockCount > 0 ? 'warning' : 'check_circle'}
                  </span>
                  <h2 className="text-lg font-extrabold">{t('dash.alerts')}</h2>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-black text-white shadow-lg ${summary.lowStockCount > 0 ? 'bg-red-600 shadow-red-200' : 'bg-green-600 shadow-green-200'}`}>
                  {summary.lowStockCount}
                </span>
              </div>

              {summary.lowStockCount > 0 ? (
                <>
                  <p className="mb-6 text-sm font-medium leading-relaxed text-red-800">
                    {t('dash.alertsDesc')}
                  </p>
                  <Link
                    to="/alerts"
                    className="block w-full rounded-2xl bg-red-600 py-4 text-center font-black text-white shadow-xl shadow-red-200 transition-all hover:bg-red-700 active:scale-[0.98]"
                  >
                    {t('dash.action')}
                  </Link>
                </>
              ) : (
                <p className="text-sm font-medium leading-relaxed text-green-800">
                  All stock levels look healthy. No low stock items at the moment.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="px-1 text-lg font-black text-slate-800">{t('dash.distribution')}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {summary.locations.map((location) => {
                  const capTone = location.capUnits === 0
                    ? 'bg-gray-300'
                    : location.capPercent >= 85
                      ? 'bg-red-500'
                      : location.capPercent >= 60
                        ? 'bg-amber-500'
                        : 'bg-green-500';

                  return (
                    <Link
                      key={location.id}
                      to={`/products?location=${location.id}`}
                      className="group block rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-slate-800 transition-colors group-hover:text-primary">
                            {location.name}
                          </h3>
                          <p className="text-[11px] font-medium text-gray-500">
                            {location.items.toLocaleString()} units • ETB {formatCompactCurrency(location.value)} • {location.capUnits > 0 ? `${location.capUnits.toLocaleString()} cap` : 'Capacity not set'}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-gray-300 transition-colors group-hover:text-primary">
                          chevron_right
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                          <span>{t('dash.stockCapacity')}</span>
                          <span>{location.capUnits > 0 ? `${location.capPercent}%` : 'Not set'}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full ${capTone} transition-all duration-700`}
                            style={{ width: `${location.capPercent}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {canViewOrders && (
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm lg:col-span-8">
            <div className="flex items-center justify-between border-b border-gray-50 p-5 lg:p-6">
              <h2 className="text-lg font-black text-slate-800">{t('dash.pulse')}</h2>
              <Link to="/orders" className="text-xs font-black uppercase tracking-wider text-primary hover:underline lg:text-sm">
                {t('dash.viewAll')}
              </Link>
            </div>

            {summary.recentOrders.length === 0 ? (
              <div className="p-8 text-center text-sm font-medium text-slate-500">
                No active orders to show right now.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <tr>
                        <th className="px-6 py-4">{t('common.id')}</th>
                        <th className="px-6 py-4">{t('common.buyer')}</th>
                        <th className="px-6 py-4">{t('common.revenue')}</th>
                        <th className="px-6 py-4 text-center">{t('common.status')}</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summary.recentOrders.map((order) => (
                        <tr key={order.id} className="group transition-colors hover:bg-gray-50">
                          <td className="px-6 py-5">
                            <Link to={`/orders/${order.id}`} className="font-black text-primary hover:underline">
                              #{order.id.split('-').pop()}
                            </Link>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-bold leading-none text-slate-800">{order.buyerLabel}</span>
                          </td>
                          <td className="px-6 py-5 font-black text-slate-800">
                            ETB {order.total.toLocaleString()}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getStatusBadgeClasses(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link to={`/orders/${order.id}`} className="material-symbols-outlined text-gray-300 transition-colors group-hover:text-primary">
                              arrow_forward
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-gray-50 lg:hidden">
                  {summary.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="flex items-center justify-between p-5 transition-all hover:bg-gray-50 active:bg-gray-100"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-black text-primary">#{order.id.split('-').pop()}</p>
                        <p className="text-base font-bold text-slate-800">{order.buyerLabel}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{order.date}</p>
                      </div>
                      <div className="space-y-2 text-right">
                        <p className="font-black text-slate-900">ETB {order.total.toLocaleString()}</p>
                        <span className={`inline-block rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${getStatusBadgeClasses(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
