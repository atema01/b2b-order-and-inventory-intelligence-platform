
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditRequest, Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const CreditRequests: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [creditRes, buyersRes] = await Promise.all([
          fetch('/api/credits', { credentials: 'include' }),
          fetch('/api/buyers', { credentials: 'include' })
        ]);

        if (!creditRes.ok) {
          const data = await creditRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load credit requests');
        }

        // Buyers lookup is optional; this page should still work with Credits-only permission.
        const creditData = await creditRes.json();
        const buyersData = buyersRes.ok ? await buyersRes.json() : [];

        if (!isMounted) return;
        setRequests(Array.isArray(creditData) ? creditData : []);
        setBuyers(Array.isArray(buyersData) ? buyersData : []);
      } catch (err) {
        console.error('Load credit data error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load credit data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const pendingAmount = requests
    .filter(r => r.status === 'Pending')
    .reduce((acc, r) => acc + r.amount, 0);

  const approvedThisMonth = requests
    .filter(r =>
      r.status === 'Approved' ||
      r.status === 'Partially Approved' ||
      r.status === 'Partially Paid' ||
      r.status === 'Fully Paid'
    )
    .reduce((acc, r) => acc + (r.approvedAmount || r.amount), 0);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading credit requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load credit requests</p>
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


  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{t('credits.title')}</h1>
          <p className="text-gray-500 font-medium text-sm">{t('credits.subtitle')}</p>
        </div>
        <Link 
          to="/credits/log"
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
        >
          <span className="material-symbols-outlined">add_card</span>
          {t('credits.logRequest')}
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('credits.pendingApproval')}</p>
            <h3 className="text-3xl font-black text-amber-500">ETB {pendingAmount.toLocaleString()}</h3>
          </div>
          <div className="size-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">pending_actions</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('credits.creditsIssued')}</p>
            <h3 className="text-3xl font-black text-emerald-500">ETB {approvedThisMonth.toLocaleString()}</h3>
          </div>
          <div className="size-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-6 py-5">{t('credits.reqId')}</th>
                <th className="px-6 py-5">{t('common.buyer')}</th>
                <th className="px-6 py-5">{t('credits.assocOrder')}</th>
                <th className="px-6 py-5">{t('credits.requested')}</th>
                <th className="px-6 py-5">{t('credits.approved')}</th>
                <th className="px-6 py-5">{t('common.reason')}</th>
                <th className="px-6 py-5">{t('common.status')}</th>
                <th className="px-6 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(req => {
                const buyer = buyers.find(b => b.id === req.buyerId);
                const buyerLabel = buyer?.companyName || req.buyerId || 'Unknown';

                return (
                  <tr
                    key={req.id}
                    className="group hover:bg-gray-50 transition-all cursor-pointer"
                    onClick={() => navigate(`/credits/${req.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/credits/${req.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open credit request ${req.id}`}
                  >
                    <td className="px-6 py-5 font-bold text-slate-800">{req.id}</td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-700 text-sm">{buyerLabel}</p>
                      <p className="text-[10px] text-gray-400">{req.requestDate}</p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-500">
                      {req.orderId ? (
                        <span className="bg-gray-100 px-2 py-1 rounded text-slate-600">#{req.orderId.split('-').pop()}</span>
                      ) : (
                        <span className="italic text-gray-300">{t('credits.generalCredit')}</span>
                      )}
                    </td>
                    <td className="px-6 py-5 font-black text-slate-800">ETB {req.amount.toLocaleString()}</td>
                    <td className="px-6 py-5 font-black text-emerald-600">
                      {(req.approvedAmount || 0) > 0 ? `ETB ${req.approvedAmount?.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-500">{req.reason}</td>
                    <td className="px-6 py-5">
                      <span className={`
                        px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider
                        ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                          req.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'Fully Paid' ? 'bg-emerald-100 text-emerald-700' :
                          req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'}
                      `}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">arrow_forward</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="p-16 text-center text-gray-400 font-bold uppercase text-xs">{t('credits.noRequests')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditRequests;
