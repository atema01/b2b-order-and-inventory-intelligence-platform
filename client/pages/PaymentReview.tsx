
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Payment, Order, PaymentStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const PaymentReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus>(PaymentStatus.PENDING);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadPayment = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const paymentRes = await fetch(`/api/payments/${id}`, { credentials: 'include' });
        if (!paymentRes.ok) {
          const data = await paymentRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load payment');
        }
        const paymentData = await paymentRes.json();

        let orderData: Order | null = null;
        if (paymentData?.orderId) {
          const orderRes = await fetch(`/api/orders/${paymentData.orderId}`, { credentials: 'include' });
          if (orderRes.ok) {
            orderData = await orderRes.json();
          }
        }

        if (!isMounted) return;
        setPayment(paymentData);
        setNotes(paymentData?.notes || '');
        setSelectedStatus((paymentData?.status as PaymentStatus) || PaymentStatus.PENDING);
        setOrder(orderData);
      } catch (err) {
        console.error('Load payment error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load payment');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPayment();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load payment</p>
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

  if (!payment) return <div className="p-8">Payment not found.</div>;

  const handleAction = async (status: PaymentStatus) => {
    if (!payment) return;
    // Rejected and mismatched reviews require explanatory notes for audit clarity.
    if ((status === PaymentStatus.REJECTED || status === PaymentStatus.MISMATCHED) && !notes.trim()) {
      alert('Please add review notes before rejecting or marking mismatch.');
      return;
    }
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, notes })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update payment');
      }
      navigate('/payments');
    } catch (err) {
      console.error('Update payment error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update payment');
    }
  };

  const isPendingReview = payment.status === PaymentStatus.PENDING;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 pb-44">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Proof of Payment */}
        <div className="space-y-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 px-1">{t('payments.proof')}</h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-2">
            <div className="aspect-[3/4] rounded-2xl bg-gray-50 overflow-hidden relative group">
              <img src={payment.proofImage} className="w-full h-full object-contain" alt="Proof" />
              <button className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-sm">
                <span className="material-symbols-outlined mr-2">zoom_in</span>
                {t('payments.viewProof')}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Verification Details */}
        <div className="space-y-8">
          <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary">verified</span>
              <h2 className="text-lg font-black text-slate-800">{t('payments.verification')}</h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('payments.expected')}</p>
                <p className="text-xl font-black text-slate-800">ETB {order?.total.toLocaleString() || '---'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('payments.reported')}</p>
                <p className="text-xl font-black text-primary">ETB {payment.amount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('payments.reference')}</p>
                <p className="font-bold text-slate-800">{payment.referenceId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('payments.submissionTime')}</p>
                <p className="font-bold text-slate-800">{payment.dateTime}</p>
              </div>
            </div>

            {order?.total !== payment.amount && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-600">warning</span>
                <div>
                  <p className="text-red-800 font-black text-xs uppercase tracking-tight">{t('payments.mismatch')}</p>
                  <p className="text-red-700 text-[11px] font-medium leading-relaxed mt-1">
                    {t('payments.mismatchDesc')}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-800">{t('payments.reviewNotes')}</h3>
              {!isPendingReview && isEditingStatus && (
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as PaymentStatus)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 uppercase tracking-widest"
                >
                  <option value={PaymentStatus.PENDING}>Pending Review</option>
                  <option value={PaymentStatus.APPROVED}>Approved</option>
                  <option value={PaymentStatus.MISMATCHED}>Mismatched</option>
                  <option value={PaymentStatus.REJECTED}>Rejected</option>
                </select>
              )}
            </div>
            <textarea 
              className="w-full bg-gray-50 border-transparent rounded-2xl p-4 text-sm font-medium focus:ring-primary focus:bg-white transition-all"
              placeholder={t('payments.reviewNotesPlaceholder')}
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>
      </div>

      {/* Spacer to keep last content visible above fixed action bar */}
      <div className="h-28 lg:h-32" aria-hidden="true"></div>

      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 z-40">
        {isPendingReview ? (
          <div className="max-w-6xl mx-auto grid grid-cols-3 gap-4">
            <button 
              onClick={() => handleAction(PaymentStatus.REJECTED)}
              className="py-4 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all text-xs uppercase tracking-widest"
            >
              {t('payments.reject')}
            </button>
            <button 
              onClick={() => handleAction(PaymentStatus.MISMATCHED)}
              className="py-4 bg-orange-50 text-orange-600 rounded-2xl font-black hover:bg-orange-600 hover:text-white transition-all text-xs uppercase tracking-widest"
            >
              {t('payments.markMismatch')}
            </button>
            <button 
              onClick={() => handleAction(PaymentStatus.APPROVED)}
              className="py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
            >
              {t('payments.approve')}
            </button>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto flex justify-end gap-3">
            {isEditingStatus ? (
              <>
                <button
                  onClick={() => {
                    setIsEditingStatus(false);
                    setSelectedStatus(payment.status as PaymentStatus);
                  }}
                  className="px-6 py-3 bg-gray-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => handleAction(selectedStatus)}
                  className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                >
                  Save Status
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditingStatus(true)}
                className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
              >
                Edit Status
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};

export default PaymentReview;
