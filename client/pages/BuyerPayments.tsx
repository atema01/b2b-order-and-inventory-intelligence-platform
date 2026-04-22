import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Payment, PaymentStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';
import RefreshIndicator from '../components/RefreshIndicator';
import { buyerQueryKeys, fetchJson, parseArrayResponse } from '../services/buyerQueries';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';

const BuyerPayments: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: payments = [],
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: buyerQueryKeys.payments(user?.id),
    queryFn: async (): Promise<Payment[]> => {
      const data = await fetchJson<any>('/api/payments');
      return parseArrayResponse<Payment>(data);
    }
  });

  useRealtimeEvent<{ buyerId?: string }>('realtime:payments', (detail) => {
    if (!user?.id || (detail?.buyerId && detail.buyerId !== user.id)) return;
    queryClient.invalidateQueries({ queryKey: buyerQueryKeys.payments(user?.id) });
  });

  const filters = [
    { id: 'All', label: t('cat.all') },
    { id: PaymentStatus.PENDING, label: t('status.pending_review') },
    { id: PaymentStatus.APPROVED, label: t('status.approved') },
    { id: PaymentStatus.MISMATCHED, label: t('status.mismatched') },
    { id: PaymentStatus.REJECTED, label: t('status.rejected') }
  ];

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return payments.filter((payment) => {
      if (activeFilter !== 'All' && payment.status !== activeFilter) return false;
      if (!query) return true;

      const haystack = [
        payment.id,
        payment.orderId,
        payment.referenceId || '',
        payment.method || '',
        payment.status || '',
        payment.dateTime || '',
        String(payment.amount || 0)
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeFilter, payments, searchQuery]);

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.APPROVED:
        return 'bg-emerald-100 text-emerald-700';
      case PaymentStatus.PENDING:
        return 'bg-amber-100 text-amber-700';
      case PaymentStatus.REJECTED:
        return 'bg-red-100 text-red-700';
      case PaymentStatus.MISMATCHED:
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading payments..." />;
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-semibold text-red-700">Failed to load payments.</p>
          <p className="mb-4 text-sm text-red-600">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: buyerQueryKeys.payments(user?.id) })}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('payments.title')}</h1>
        <RefreshIndicator visible={isFetching && !isLoading} />
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
        <input
          type="text"
          placeholder="Search by order, reference, method, or status"
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] outline-none transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`
              px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all
              ${activeFilter === filter.id
                ? 'bg-[#00A3C4] border-[#00A3C4] text-white shadow-lg shadow-[#00A3C4]/20'
                : 'bg-white border-gray-100 text-slate-500 hover:bg-gray-50'}
            `}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[32px] border border-gray-100">
            <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">payments</span>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">{t('payments.noPayments')}</p>
          </div>
        ) : (
          filteredPayments.map((payment) => (
            <div
              key={payment.id}
              onClick={() => navigate(`/orders/${payment.orderId}`)}
              className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-black text-slate-900 text-base lg:text-lg">Order #{payment.orderId.replace('ORD-', '')}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${getStatusColor(payment.status as PaymentStatus)}`}>
                      {payment.status}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{payment.dateTime}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {payment.referenceId || payment.method}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-lg font-black text-slate-900 sm:text-right">ETB {payment.amount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BuyerPayments;
