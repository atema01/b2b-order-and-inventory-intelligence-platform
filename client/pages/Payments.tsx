
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Buyer, Payment, PaymentStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const loadPayments = async () => {
      setLoading(true);
      setError('');
      try {
        const [paymentsRes, buyersRes] = await Promise.all([
          fetch('/api/payments', { credentials: 'include' }),
          fetch('/api/buyers', { credentials: 'include' })
        ]);

        if (!paymentsRes.ok) {
          const data = await paymentsRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load payments');
        }

        if (!buyersRes.ok) {
          const data = await buyersRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load buyers');
        }

        const [paymentsData, buyersData] = await Promise.all([
          paymentsRes.json(),
          buyersRes.json()
        ]);

        if (!isMounted) return;
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        setBuyers(Array.isArray(buyersData) ? buyersData : []);
      } catch (err) {
        console.error('Load payments error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load payments');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPayments();

    return () => {
      isMounted = false;
    };
  }, []);

  const filters = [
    { id: 'All', label: t('cat.all') },
    { id: PaymentStatus.PENDING, label: t('status.pending_review') },
    { id: PaymentStatus.APPROVED, label: t('status.approved') },
    { id: PaymentStatus.MISMATCHED, label: t('status.mismatched') },
    { id: PaymentStatus.REJECTED, label: t('status.rejected') }
  ];

  const filteredPayments = payments.filter(p => 
    activeFilter === 'All' ? true : p.status === activeFilter
  );

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.APPROVED: return 'bg-emerald-100 text-emerald-700';
      case PaymentStatus.PENDING: return 'bg-amber-100 text-amber-700';
      case PaymentStatus.REJECTED: return 'bg-red-100 text-red-700';
      case PaymentStatus.MISMATCHED: return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    switch (status) {
        case PaymentStatus.APPROVED: return t('status.approved');
        case PaymentStatus.PENDING: return t('status.pending_review');
        case PaymentStatus.REJECTED: return t('status.rejected');
        case PaymentStatus.MISMATCHED: return t('status.mismatched');
        default: return status;
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-black text-slate-800">{t('payments.title')}</h1>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading payments...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load payments</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 ${loading || error ? 'pointer-events-none opacity-60' : ''}`}>
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`
              px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all
              ${activeFilter === filter.id 
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-white border-gray-100 text-slate-500 hover:bg-gray-50'}
            `}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {!loading && !error && (
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop View */}
        <div className="hidden lg:block">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-5">{t('payments.reference')}</th>
                <th className="px-6 py-5">{t('common.buyer')}</th>
                <th className="px-6 py-5">{t('common.revenue')}</th>
                <th className="px-6 py-5">{t('payments.submissionTime')}</th>
                <th className="px-6 py-5">{t('common.status')}</th>
                <th className="px-6 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPayments.map(p => {
                const buyer = buyers.find(b => b.id === p.buyerId);
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5 font-bold text-slate-800">{p.referenceId}</td>
                    <td className="px-6 py-5 font-semibold text-slate-600">{buyer?.companyName || 'Unknown Buyer'}</td>
                    <td className="px-6 py-5 font-black text-primary">ETB {p.amount.toLocaleString()}</td>
                    <td className="px-6 py-5 text-sm text-gray-400">{p.dateTime}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link to={`/payments/${p.id}`} className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-primary/20">
                        {t('common.view')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden divide-y divide-gray-50">
          {filteredPayments.map(p => {
             const buyer = buyers.find(b => b.id === p.buyerId);
             return (
              <Link key={p.id} to={`/payments/${p.id}`} className="p-5 flex flex-col gap-4 active:bg-gray-50 transition-all">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('payments.reference')}</p>
                    <p className="font-black text-slate-800 text-lg">{p.referenceId}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(p.status)}`}>
                    {getStatusLabel(p.status)}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">{buyer?.companyName || 'Unknown Buyer'}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{p.dateTime}</p>
                  </div>
                  <p className="text-lg font-black text-primary">ETB {p.amount.toLocaleString()}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      )}
      
      {!loading && !error && filteredPayments.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[32px] border border-gray-100">
          <span className="material-symbols-outlined text-gray-200 text-6xl mb-4">filter_list_off</span>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{t('payments.noPayments')}</p>
        </div>
      )}
    </div>
  );
};

export default Payments;
