
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditRequest, Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const CreditRequests: React.FC = () => {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  
  // State for partial approval editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approveAmount, setApproveAmount] = useState<number>(0);

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

        if (!buyersRes.ok) {
          const data = await buyersRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load buyers');
        }

        const [creditData, buyersData] = await Promise.all([
          creditRes.json(),
          buyersRes.json()
        ]);

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
    .filter(r => r.status === 'Approved' || r.status === 'Partially Approved')
    .reduce((acc, r) => acc + (r.approvedAmount || r.amount), 0);

  const startApproval = (req: CreditRequest) => {
    setEditingId(req.id);
    setApproveAmount(req.amount);
  };

  const cancelApproval = () => {
    setEditingId(null);
    setApproveAmount(0);
  };

  const refreshRequests = async () => {
    const res = await fetch('/api/credits', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    }
  };

  const confirmApproval = async (req: CreditRequest) => {
    const isPartial = approveAmount < req.amount;
    const status = isPartial ? 'Partially Approved' : 'Approved';
    try {
      const response = await fetch(`/api/credits/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status,
          approvedAmount: approveAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve request');
      }

      await refreshRequests();
      setEditingId(null);
      setApproveAmount(0);
    } catch (err) {
      console.error('Approve credit request error:', err);
      alert(err instanceof Error ? err.message : 'Failed to approve request');
    }
  };

  const handleReject = async (req: CreditRequest) => {
    try {
      const response = await fetch(`/api/credits/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'Rejected' })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reject request');
      }

      await refreshRequests();
    } catch (err) {
      console.error('Reject credit request error:', err);
      alert(err instanceof Error ? err.message : 'Failed to reject request');
    }
  };

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
                <th className="px-6 py-5 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(req => {
                const buyer = buyers.find(b => b.id === req.buyerId);
                const isEditingThis = editingId === req.id;

                return (
                  <tr key={req.id} className="group hover:bg-gray-50 transition-all">
                    <td className="px-6 py-5 font-bold text-slate-800">{req.id}</td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-700 text-sm">{buyer?.companyName || 'Unknown'}</p>
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
                      {isEditingThis ? (
                        <input 
                          type="number" 
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-bold focus:ring-primary focus:border-primary"
                          value={approveAmount}
                          onChange={(e) => setApproveAmount(parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        (req.approvedAmount || 0) > 0 ? `ETB ${req.approvedAmount?.toLocaleString()}` : '-'
                      )}
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-500">{req.reason}</td>
                    <td className="px-6 py-5">
                      <span className={`
                        px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider
                        ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                          req.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'}
                      `}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {req.status === 'Pending' && (
                        isEditingThis ? (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={cancelApproval}
                              className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-300"
                            >
                              {t('common.cancel')}
                            </button>
                            <button 
                              onClick={() => confirmApproval(req)}
                              className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover shadow-lg shadow-primary/20"
                            >
                              {t('common.confirm')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleReject(req)}
                              className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                              title="Reject"
                            >
                              <span className="material-symbols-outlined text-lg font-bold">close</span>
                            </button>
                            <button 
                              onClick={() => startApproval(req)}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                              title="Review & Approve"
                            >
                              <span className="material-symbols-outlined text-lg font-bold">edit_note</span>
                            </button>
                          </div>
                        )
                      )}
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
