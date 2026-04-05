import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CreditRequest, Order } from '../types';
import LoadingState from '../components/LoadingState';

const formatCurrency = (amount: number) => `ETB ${amount.toLocaleString()}`;

const BuyerCreditDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [request, setRequest] = useState<CreditRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState(0);
  const [repaymentAmountInput, setRepaymentAmountInput] = useState('');
  const [repaymentNote, setRepaymentNote] = useState('');
  const [repaymentReference, setRepaymentReference] = useState('');
  const [repaymentProof, setRepaymentProof] = useState('');
  const [selectedRepaymentPercentage, setSelectedRepaymentPercentage] = useState(100);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';

  useEffect(() => {
    let isMounted = true;

    const loadCredit = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const creditRes = await fetch('/api/credits/my', { credentials: 'include' });
        if (!creditRes.ok) {
          const data = await creditRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load credit');
        }

        const creditList: CreditRequest[] = await creditRes.json();
        const creditData = Array.isArray(creditList)
          ? creditList.find((credit) => credit.id === id) || null
          : null;

        if (!creditData) {
          throw new Error('Credit request not found');
        }

        const orderRes = creditData.orderId
          ? await fetch(`/api/orders/${creditData.orderId}`, { credentials: 'include' })
          : null;

        if (!isMounted) return;

        setRequest(creditData);
        setRepaymentAmount(creditData.outstandingAmount || 0);
        setRepaymentAmountInput(String(creditData.outstandingAmount || 0));

        if (orderRes?.ok) {
          const orderData = await orderRes.json();
          if (isMounted) setOrder(orderData);
        } else {
          setOrder(null);
        }
      } catch (err) {
        console.error('Failed to load credit details:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load credit details.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCredit();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const refreshCredit = async () => {
    if (!id) return;
    const creditRes = await fetch('/api/credits/my', { credentials: 'include' });
    if (!creditRes.ok) return;
    const creditList: CreditRequest[] = await creditRes.json();
    const creditData = Array.isArray(creditList)
      ? creditList.find((credit) => credit.id === id) || null
      : null;
    if (!creditData) return;
    setRequest(creditData);
    setRepaymentAmount(creditData.outstandingAmount || 0);
    setRepaymentAmountInput(String(creditData.outstandingAmount || 0));
    setRepaymentNote('');
    setRepaymentReference('');
    setRepaymentProof('');
    setSelectedRepaymentPercentage(100);
    setIsRepaymentModalOpen(false);
  };

  const applyRepaymentPercentage = (outstandingAmount: number, percentage: number) => {
    const nextOutstanding = outstandingAmount;
    const nextAmount = Number(((nextOutstanding * percentage) / 100).toFixed(2));
    setSelectedRepaymentPercentage(percentage);
    setRepaymentAmount(nextAmount);
    setRepaymentAmountInput(nextAmount.toFixed(2));
  };

  const openRepaymentModal = (outstandingAmount: number) => {
    const nextOutstanding = outstandingAmount;
    setRepaymentAmount(nextOutstanding);
    setRepaymentAmountInput(nextOutstanding.toFixed(2));
    setRepaymentNote('');
    setRepaymentReference('');
    setRepaymentProof('');
    setSelectedRepaymentPercentage(100);
    setIsRepaymentModalOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setRepaymentProof(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRepayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!request) return;

    const unpaid = request.outstandingAmount ?? Math.max((request.approvedAmount || 0) - (request.repaidAmount || 0), 0);
    const trimmedReference = repaymentReference.trim();
    const trimmedNote = repaymentNote.trim();
    if (repaymentAmount <= 0) {
      alert('Repayment amount must be greater than zero.');
      return;
    }
    if (repaymentAmount > unpaid) {
      alert(`Repayment cannot exceed unpaid credit of ${formatCurrency(unpaid)}.`);
      return;
    }
    if (!trimmedReference && !repaymentProof.trim()) {
      alert('Please provide at least a bank reference or a proof of payment image.');
      return;
    }
    if (trimmedReference.length > 100) {
      alert('Bank reference cannot exceed 100 characters.');
      return;
    }
    if (trimmedNote.length > 1000) {
      alert('Repayment note cannot exceed 1000 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = JSON.stringify({
        amount: repaymentAmount,
        note: trimmedNote || null,
        referenceId: trimmedReference || null,
        proofImage: repaymentProof.trim() || null
      });

      let response = await fetch(`/api/credits/repay/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: payload
      });

      if (response.status === 404) {
        response = await fetch(`/api/credits/${request.id}/repay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: payload
        });
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to repay credit');
      }

      await refreshCredit();
      alert('Credit repayment submitted successfully. It is now waiting for seller verification.');
    } catch (err) {
      console.error('Credit repayment error:', err);
      alert(err instanceof Error ? err.message : 'Failed to repay credit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading credit details..." />;
  if (error) return <div className="p-8 text-red-600 font-semibold">{error}</div>;
  if (!request) return <div className="p-8">Credit record not found.</div>;

  const approved = request.approvedAmount || 0;
  const repaid = request.repaidAmount || 0;
  const unpaid = request.outstandingAmount ?? Math.max(approved - repaid, 0);
  const isRepayable =
    (request.status === 'Approved' || request.status === 'Partially Approved' || request.status === 'Partially Paid') &&
    unpaid > 0;
  const repaymentPercentage = unpaid > 0 ? Math.min(100, Math.max(0, (repaymentAmount / unpaid) * 100)) : 0;
  const pageMatches = !query || [
    request.id,
    request.reason,
    request.status,
    request.requestDate,
    request.dueDate || '',
    request.paymentTerms || '',
    request.notes || '',
    request.orderId || '',
    order?.id || '',
    String(request.amount),
    String(approved),
    String(repaid),
    String(unpaid)
  ].join(' ').toLowerCase().includes(query);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-40">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/credit')}
          className="flex size-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-600 transition-colors hover:border-[#00A3C4] hover:text-[#00A3C4]"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Credit Details</h1>
          <p className="text-sm font-medium text-slate-500">Track this credit request and record repayments.</p>
        </div>
      </div>

      {!pageMatches ? (
        <div className="rounded-[32px] border border-gray-100 bg-white p-12 text-center text-slate-400 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest">No matching content on this page</p>
        </div>
      ) : (
      <>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Requested', value: request.amount, accent: 'text-slate-900' },
          { label: 'Approved', value: approved, accent: 'text-cyan-600' },
          { label: 'Repaid', value: repaid, accent: 'text-emerald-600' },
          { label: 'Outstanding', value: unpaid, accent: 'text-amber-600' }
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
            <p className={`mt-3 text-2xl font-black ${item.accent}`}>{formatCurrency(item.value)}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-gray-100 bg-white p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-gray-50 pb-4">
            <h2 className="text-lg font-black text-slate-900">Credit Request</h2>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Credit ID</p>
              <p className="mt-1 font-black text-slate-900">{request.id}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reason</p>
              <p className="mt-1 font-bold text-slate-800">{request.reason}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Requested On</p>
              <p className="mt-1 font-bold text-slate-800">{request.requestDate}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Due Date</p>
              <p className="mt-1 font-bold text-slate-800">{request.dueDate || 'Set after approval'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payment Terms</p>
              <p className="mt-1 font-bold text-slate-800">{request.paymentTerms || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Last Repayment</p>
              <p className="mt-1 font-bold text-slate-800">{request.repaidAt || 'No repayment yet'}</p>
            </div>
          </div>

          {request.notes && (
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-700">{request.notes}</p>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-[32px] border border-gray-100 bg-white p-7 shadow-sm space-y-4">
            <div className="border-b border-gray-50 pb-4">
              <h2 className="text-lg font-black text-slate-900">Linked Order</h2>
            </div>
            {order ? (
              <div className="space-y-3">
                <p className="font-black text-slate-900">Order #{order.id.split('-').pop()}</p>
                <p className="text-sm text-slate-500">Date: {order.date}</p>
                <p className="text-sm text-slate-500">Total: {formatCurrency(order.total)}</p>
                <p className="text-sm text-slate-500">Amount Paid: {formatCurrency(order.amountPaid || 0)}</p>
                <p className="text-sm text-slate-500">Outstanding Credit: {formatCurrency(unpaid)}</p>
                <button
                  type="button"
                  onClick={() => openRepaymentModal(unpaid)}
                  disabled={!isRepayable}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00A3C4] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#00A3C4]/20 transition-all hover:bg-[#008FAE] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  {isRepayable ? 'Repay Credit' : 'No repayment needed'}
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-500">
                {request.orderId ? 'Order details are not available right now.' : 'This credit is not linked to a specific order.'}
              </p>
            )}
          </div>
        </section>
      </div>
      </>
      )}

      {isRepaymentModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm overflow-y-auto px-4 py-8 sm:py-10">
          <div className="min-h-full flex items-start justify-center">
            <div className="w-full max-w-lg rounded-[32px] bg-white shadow-2xl border border-white/60 overflow-hidden my-auto max-h-[calc(100vh-4rem)] flex flex-col">
              <div className="p-8 pb-6 border-b border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-2xl bg-[#E0F7FA] text-[#00A3C4] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">payments</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Repay Credit</h3>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Choose how much of this credit you want to pay now</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRepaymentModalOpen(false)}
                    className="size-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleRepayment} className="p-8 space-y-6 overflow-y-auto">
                <div className="rounded-3xl bg-slate-50 border border-slate-200 p-5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span>Outstanding Credit</span>
                    <span>Repayment</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-black text-slate-900">{formatCurrency(unpaid)}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">Current unpaid balance</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#00A3C4]">{formatCurrency(repaymentAmount)}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{repaymentPercentage.toFixed(1)}% of outstanding credit</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Repayment Percentage</label>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[25, 50, 75, 100].map((percentage) => (
                      <button
                        key={percentage}
                        type="button"
                        onClick={() => applyRepaymentPercentage(unpaid, percentage)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                          selectedRepaymentPercentage === percentage
                            ? 'border-[#00A3C4] bg-[#E0F7FA] text-[#008CA8] shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {percentage}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Custom Repayment Amount (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    max={unpaid}
                    step="0.01"
                    value={repaymentAmountInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const parsed = parseFloat(nextValue);
                      setSelectedRepaymentPercentage(0);
                      setRepaymentAmountInput(nextValue);
                      setRepaymentAmount(Number.isFinite(parsed) ? parsed : 0);
                    }}
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-black text-xl text-slate-900 shadow-inner transition-all focus:border-[#00A3C4] focus:bg-white focus:ring-2 focus:ring-[#00A3C4]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Enter custom repayment amount"
                  />
                  <p className="mt-2 text-xs text-slate-500 font-medium">The percentage updates automatically from the amount you enter.</p>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Bank Reference</label>
                  <input
                    type="text"
                    value={repaymentReference}
                    onChange={(event) => setRepaymentReference(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Optional bank or transfer reference"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium text-slate-800 shadow-inner transition-all focus:border-[#00A3C4] focus:bg-white focus:ring-2 focus:ring-[#00A3C4]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Repayment Note</label>
                  <textarea
                    rows={3}
                    value={repaymentNote}
                    onChange={(event) => setRepaymentNote(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Optional note for this repayment"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium text-slate-800 shadow-inner transition-all focus:border-[#00A3C4] focus:bg-white focus:ring-2 focus:ring-[#00A3C4]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Proof of Payment</label>
                    {repaymentProof && (
                      <button
                        type="button"
                        onClick={() => {
                          setRepaymentProof('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                    className="hidden"
                  />

                  {repaymentProof ? (
                    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
                      <img src={repaymentProof} alt="Repayment proof" className="h-52 w-full object-cover" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm font-bold text-slate-500 transition-all hover:border-[#00A3C4] hover:text-[#00A3C4] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Upload proof image (optional)
                    </button>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRepaymentModalOpen(false)}
                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isRepayable}
                    className="flex-[1.4] py-3.5 bg-[#00A3C4] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#00A3C4]/20 hover:bg-[#008CA8] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? 'Recording...' : 'Repay Credit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerCreditDetails;
