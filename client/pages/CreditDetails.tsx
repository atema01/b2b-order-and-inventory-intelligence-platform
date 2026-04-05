import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Buyer, CreditRequest, Order, Payment } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const CreditDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [request, setRequest] = useState<CreditRequest | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [repaymentPayments, setRepaymentPayments] = useState<Payment[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<CreditRequest['status']>('Pending');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCreditRequest = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const reqRes = await fetch(`/api/credits/${id}`, { credentials: 'include' });
        if (!reqRes.ok) {
          const data = await reqRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load credit request');
        }

        const reqData: CreditRequest = await reqRes.json();
        if (!isMounted) return;

        setRequest(reqData);
        setApprovedAmount(reqData.approvedAmount || reqData.amount);
        setSelectedStatus(reqData.status);

        const [buyerRes, orderRes, repaymentsRes] = await Promise.all([
          fetch('/api/buyers', { credentials: 'include' }),
          reqData.orderId ? fetch(`/api/orders/${reqData.orderId}`, { credentials: 'include' }) : Promise.resolve(null),
          fetch(`/api/payments?creditRequestId=${reqData.id}`, { credentials: 'include' })
        ]);

        if (!isMounted) return;

        if (buyerRes.ok) {
          const buyersData = await buyerRes.json();
          const buyerData = Array.isArray(buyersData)
            ? buyersData.find((b: Buyer) => b.id === reqData.buyerId) || null
            : null;
          setBuyer(buyerData);
        }

        if (orderRes && orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData);
        }

        if (repaymentsRes.ok) {
          const repaymentData = await repaymentsRes.json();
          setRepaymentPayments(Array.isArray(repaymentData) ? repaymentData : []);
        } else {
          setRepaymentPayments([]);
        }
      } catch (err) {
        console.error('Load credit request error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load credit request');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCreditRequest();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const refreshRequest = async () => {
    if (!id) return;
    const [reqRes, repaymentsRes] = await Promise.all([
      fetch(`/api/credits/${id}`, { credentials: 'include' }),
      fetch(`/api/payments?creditRequestId=${id}`, { credentials: 'include' })
    ]);
    if (reqRes.ok) {
      const reqData: CreditRequest = await reqRes.json();
      setRequest(reqData);
      setApprovedAmount(reqData.approvedAmount || reqData.amount);
      setSelectedStatus(reqData.status);
    }
    if (repaymentsRes.ok) {
      const repaymentData = await repaymentsRes.json();
      setRepaymentPayments(Array.isArray(repaymentData) ? repaymentData : []);
    }
  };

  const submitStatus = async (status: 'Pending' | 'Approved' | 'Rejected' | 'Partially Approved', notes?: string) => {
    if (!request) return;
    try {
      const payload: any = { status };
      if (status !== 'Rejected') {
        payload.approvedAmount = approvedAmount;
      }
      if (notes !== undefined) {
        payload.notes = notes;
      }

      const res = await fetch(`/api/credits/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update credit request');
      }

      await refreshRequest();
      navigate('/credits');
    } catch (err) {
      console.error('Update credit request error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update credit request');
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading credit request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load credit request</p>
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

  if (!request) return <div className="p-8">Credit request not found.</div>;

  const isPending = request.status === 'Pending';
  const buyerName = buyer?.companyName || request.buyerId;
  const handleApprove = async () => {
    if (!request) return;
    if (approvedAmount <= 0) {
      alert('Approved amount must be greater than 0');
      return;
    }
    if (approvedAmount > request.amount) {
      alert('Approved amount cannot exceed requested amount');
      return;
    }
    const autoStatus = approvedAmount < request.amount ? 'Partially Approved' : 'Approved';
    await submitStatus(autoStatus);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please add rejection reason.');
      return;
    }
    await submitStatus('Rejected', rejectReason.trim());
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-44">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="material-symbols-outlined text-primary">credit_card</span>
            <h2 className="text-lg font-black text-slate-800">Credit Request Details</h2>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('credits.reqId')}</p>
              <p className="font-black text-slate-900">{request.id}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('common.buyer')}</p>
              <p className="font-bold text-slate-800">{buyerName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('credits.requested')}</p>
                <p className="text-xl font-black text-slate-900">ETB {request.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('credits.approved')}</p>
                <p className="text-xl font-black text-emerald-600">
                  ETB {(request.approvedAmount || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('common.status')}</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
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
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            <h2 className="text-lg font-black text-slate-800">Linked Order</h2>
          </div>
          {order ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-800">#{order.id.split('-').pop()}</p>
              <p className="text-xs text-gray-500">Date: {order.date}</p>
              <p className="text-xs text-gray-500">Total: ETB {order.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Paid: ETB {(order.amountPaid || 0).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{request.orderId ? 'Unable to load order details.' : t('credits.generalCredit')}</p>
          )}

          {isPending && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('credits.approved')}</label>
                <input
                  type="number"
                  min={0}
                  max={request.amount}
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Rejection Reason</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Required if you reject this credit request"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-slate-800"
                />
              </div>
            </div>
          )}

          {!isPending && isEditingStatus && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('common.status')}</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as CreditRequest['status'])}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-slate-800"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Partially Approved">Partially Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              {(selectedStatus === 'Approved' || selectedStatus === 'Partially Approved') && (
                <input
                  type="number"
                  min={0}
                  max={request.amount}
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-slate-800"
                />
              )}
              {selectedStatus === 'Rejected' && (
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Required for rejected status"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-slate-800"
                />
              )}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-gray-50 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">Repayment Submissions</h2>
            <p className="text-xs font-medium text-slate-500">Payments submitted by the buyer for this credit appear here and can be reviewed from the seller payment portal.</p>
          </div>
        </div>

        {repaymentPayments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-500">
            No repayment submissions yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {repaymentPayments.map((payment) => (
              <button
                key={payment.id}
                type="button"
                onClick={() => navigate(`/payments/${payment.id}`)}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition-all hover:border-primary hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repayment</p>
                    <p className="mt-1 text-base font-black text-slate-900">{payment.id}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    payment.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                    payment.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    payment.status === 'Mismatched' ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {payment.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</p>
                    <p className="mt-1 font-black text-primary">ETB {payment.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reference</p>
                    <p className="mt-1 font-bold text-slate-700">{payment.referenceId || 'No reference provided'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submitted</p>
                    <p className="mt-1 font-bold text-slate-700">{payment.dateTime}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Method</p>
                    <p className="mt-1 font-bold text-slate-700">{payment.method}</p>
                  </div>
                </div>

                {payment.notes && (
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-medium text-slate-600">
                    {payment.notes}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Spacer to keep last content visible above fixed action bar */}
      <div className="h-28 lg:h-32" aria-hidden="true"></div>

      {isPending && (
        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 z-40">
          <div className="max-w-5xl mx-auto grid grid-cols-2 gap-4">
            <button
              onClick={handleReject}
              className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all text-xs uppercase tracking-widest"
            >
              {t('payments.reject')}
            </button>
            <button
              onClick={handleApprove}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 transition-all text-xs uppercase tracking-widest"
            >
              {t('payments.approve')}
            </button>
          </div>
        </footer>
      )}

      {!isPending && (
        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 z-40">
          <div className="max-w-5xl mx-auto flex justify-end gap-3">
            {isEditingStatus ? (
              <>
                <button
                  onClick={() => {
                    setIsEditingStatus(false);
                    setSelectedStatus(request.status);
                    setApprovedAmount(request.approvedAmount || request.amount);
                  }}
                  className="px-6 py-3 bg-gray-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => submitStatus(selectedStatus, selectedStatus === 'Rejected' ? rejectReason.trim() : undefined)}
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
        </footer>
      )}
    </div>
  );
};

export default CreditDetails;
