import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditRequest } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';

const formatCurrency = (amount: number) => `ETB ${amount.toLocaleString()}`;

const BuyerCredit: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCreditData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const creditRes = await fetch('/api/credits/my', { credentials: 'include' });
        if (!creditRes.ok) {
          throw new Error('Failed to load credit requests');
        }

        const creditData = await creditRes.json();
        if (!isMounted) return;
        setRequests(Array.isArray(creditData) ? creditData : []);
      } catch (err) {
        console.error('Failed to load credit data:', err);
        if (isMounted) {
          setError('Failed to load credit details.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCreditData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return requests.reduce(
      (totals, request) => {
        const approved = request.approvedAmount || 0;
        const repaid = request.repaidAmount || 0;
        const unpaid = request.outstandingAmount ?? Math.max(approved - repaid, 0);
        const isDue = Boolean(unpaid > 0 && request.dueDate && request.dueDate < today);

        totals.totalGiven += approved;
        totals.totalPaid += repaid;
        totals.totalUnpaid += unpaid;
        if (isDue) {
          totals.totalDue += unpaid;
        }

        return totals;
      },
      { totalGiven: 0, totalPaid: 0, totalUnpaid: 0, totalDue: 0 }
    );
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      const haystack = [
        request.id,
        request.reason,
        request.status,
        request.requestDate,
        request.orderId || '',
        request.dueDate || '',
        String(request.amount),
        String(request.approvedAmount || 0),
        String(request.repaidAmount || 0),
        String(request.outstandingAmount || 0)
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [requests, searchQuery]);

  if (isLoading) return <LoadingState message="Loading credit details..." />;
  if (error) return <div className="p-8 text-red-600 font-semibold">{error}</div>;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('nav.financials')}</h1>
        <p className="text-slate-500 font-medium">Review your approved credit, repayments, and outstanding balances.</p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        {[
          {
            label: 'Total Credit Given',
            value: summary.totalGiven,
            icon: 'account_balance_wallet',
            tint: 'from-cyan-500 to-sky-500'
          },
          {
            label: 'Total Credit Paid',
            value: summary.totalPaid,
            icon: 'payments',
            tint: 'from-emerald-500 to-teal-500'
          },
          {
            label: 'Currently Unpaid',
            value: summary.totalUnpaid,
            icon: 'pending_actions',
            tint: 'from-amber-500 to-orange-500'
          },
          {
            label: 'Due Credits',
            value: summary.totalDue,
            icon: 'event_busy',
            tint: 'from-rose-500 to-red-500'
          }
        ].map((card) => (
          <div key={card.label} className="relative overflow-hidden rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.tint}`} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{formatCurrency(card.value)}</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <span className="material-symbols-outlined">{card.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
        <input
          type="text"
          placeholder="Search credit ID, status, or due date"
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] outline-none transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 px-1">
          <h3 className="text-lg font-bold text-slate-900">Credit History</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{filteredRequests.length} records</p>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-sm">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-xs font-bold uppercase tracking-widest">No credit requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredRequests.map((request) => {
                const approved = request.approvedAmount || 0;
                const repaid = request.repaidAmount || 0;
                const unpaid = request.outstandingAmount ?? Math.max(approved - repaid, 0);

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => navigate(`/credit/${request.id}`)}
                    className="flex w-full flex-col gap-4 p-6 text-left transition-colors hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-black text-slate-800">{request.id}</span>
                        <span className="text-xs font-medium text-gray-400">{request.requestDate}</span>
                        <span className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                          request.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                          request.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                          request.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                          request.status === 'Fully Paid' ? 'bg-emerald-100 text-emerald-700' :
                          request.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        Order: {request.orderId ? `#${request.orderId.split('-').pop()}` : 'General'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {request.dueDate ? `Due ${request.dueDate}` : 'Due date will appear after approval'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-5 md:justify-end">
                      <div className="text-left md:text-right">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Approved</p>
                        <p className="font-black text-slate-800">{formatCurrency(approved)}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Paid</p>
                        <p className="font-black text-emerald-600">{formatCurrency(repaid)}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Unpaid</p>
                        <p className="font-black text-amber-600">{formatCurrency(unpaid)}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BuyerCredit;
