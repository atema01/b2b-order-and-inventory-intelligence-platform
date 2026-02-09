
import React, { useState, useEffect } from 'react';
import { Buyer, CreditRequest } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';

const BuyerCredit: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
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
        const [buyerRes, creditRes] = await Promise.all([
          fetch(`/api/buyers/${user.id}`, { credentials: 'include' }),
          fetch('/api/credits/my', { credentials: 'include' })
        ]);

        if (!buyerRes.ok) {
          throw new Error('Failed to load buyer profile');
        }

        const buyerData = await buyerRes.json();
        const creditData = creditRes.ok ? await creditRes.json() : [];

        if (!isMounted) return;

        setBuyer(buyerData);
        setRequests((creditData || []).slice().reverse());
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

  if (isLoading) return <LoadingState message="Loading credit details..." />;
  if (error) return <div className="p-8 text-red-600 font-semibold">{error}</div>;
  if (!buyer) return <div className="p-8">No buyer profile found.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-32">
      <div className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('nav.financials')}</h1>
        <p className="text-slate-500 font-medium">Track your credit requests and outstanding payments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Outstanding Balance Card */}
        <div className="bg-slate-900 rounded-[40px] p-8 lg:p-10 shadow-2xl text-white relative overflow-hidden flex flex-col justify-between min-h-[260px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00A3C4]/20 blur-3xl rounded-full -mr-10 -mt-10"></div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
               <span className="material-symbols-outlined text-2xl">account_balance</span>
            </div>
            <div className="text-right">
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">{t('common.status')}</p>
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                   Active
                </span>
            </div>
          </div>

          <div className="relative z-10 space-y-1">
             <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Total Outstanding Balance</p>
             <p className="text-4xl font-black">ETB {buyer.outstandingBalance.toLocaleString()}</p>
             <p className="text-[10px] font-medium text-white/40 pt-2">Includes all approved credit financing currently unpaid.</p>
          </div>
        </div>

        {/* Account Details */}
        <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900">Account Terms</h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">calendar_clock</span>
                    <span className="text-sm font-bold text-slate-600">Payment Terms</span>
                </div>
                <span className="text-sm font-black text-slate-900">{buyer.paymentTerms}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">stars</span>
                    <span className="text-sm font-bold text-slate-600">Pricing Tier</span>
                </div>
                <span className="text-sm font-black text-slate-900">{buyer.tier} ({(buyer.discountRate * 100)}% Off)</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">history</span>
                    <span className="text-sm font-bold text-slate-600">Since</span>
                </div>
                <span className="text-sm font-black text-slate-900">{buyer.joinDate}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Credit Request History */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 px-1">Credit Request History</h3>
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            {requests.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                    <p className="text-xs font-bold uppercase tracking-widest">No credit requests found</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {requests.map(req => (
                        <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-slate-800">{req.id}</span>
                                    <span className="text-xs text-gray-400 font-medium">{req.requestDate}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-500">Order: {req.orderId ? `#${req.orderId.split('-').pop()}` : 'General'}</p>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Requested</p>
                                    <p className="font-black text-slate-800">ETB {req.amount.toLocaleString()}</p>
                                </div>
                                {(req.status === 'Approved' || req.status === 'Partially Approved') && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Approved</p>
                                        <p className="font-black text-emerald-600">ETB {(req.approvedAmount || req.amount).toLocaleString()}</p>
                                    </div>
                                )}
                                <span className={`
                                    px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest
                                    ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                                      req.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                                      req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                                      'bg-amber-100 text-amber-700'}
                                `}>
                                    {req.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </section>
    </div>
  );
};

export default BuyerCredit;
