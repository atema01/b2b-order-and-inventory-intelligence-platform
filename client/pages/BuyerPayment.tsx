
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Order } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';
import RefreshIndicator from '../components/RefreshIndicator';
import { buyerQueryKeys, loadBuyerPaymentOrder } from '../services/buyerQueries';
import {clearCart} from '../services/cartStore'
import { clear } from 'console';

const BuyerPayment: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  const isDraftCheckout = !orderId;
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [form, setForm] = useState({
    method: 'Bank Transfer',
    reference: '',
    image: '',
    notes: ''
  });
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
  const {
    data: order,
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: buyerQueryKeys.paymentOrder(orderId, user?.id, draftId),
    queryFn: () => loadBuyerPaymentOrder(orderId, user?.id, draftId)
  });

  useEffect(() => {
    if (!order) return;
    setPayAmount(isDraftCheckout ? order.total : order.total - (order.amountPaid || 0));
  }, [order, isDraftCheckout]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.reference && !form.image) {
      alert("Please provide either a Reference Number or a Proof Image.");
      return;
    }

    if (!order) return;
    
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      alert("Payment amount must be greater than zero.");
      return;
    }

    const remaining = isDraftCheckout ? order.total : order.total - (order.amountPaid || 0);
    if (payAmount > remaining) {
      alert(`Payment cannot exceed remaining balance of ETB ${remaining.toLocaleString()}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = isDraftCheckout
        ? await fetch('/api/orders/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              draftId: order.id,
              payment: {
                amount: payAmount,
                method: form.method,
                referenceId: form.reference || null,
                proofImage: form.image || null,
                notes: form.notes || null
              }
            })
          })
        : await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              orderId: order.id,
              amount: payAmount,
              method: form.method,
              referenceId: form.reference || null,
              proofImage: form.image || null,
              notes: form.notes || null
            })
          });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = String(errorData?.error || '');
        const requestedPath = String(errorData?.requested || '');
        if (response.status === 404 && errorMessage.toLowerCase().includes('route not found')) {
          throw new Error(
            `Backend route is missing for ${requestedPath || (isDraftCheckout ? '/api/orders/checkout' : '/api/payments')}. ` +
            'Please restart the backend server so the latest routes are loaded.'
          );
        }
        throw new Error(errorMessage || 'Failed to submit payment');
      }

      const responseData = await response.json().catch(() => null);

      await queryClient.invalidateQueries({ queryKey: ['buyer-payment-order'] });
      await queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
      await queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['buyer-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['buyer-credit-list'] });
      queryClient.removeQueries({ queryKey: ['buyer-catalog'] });

      alert(
        isDraftCheckout
          ? 'Payment submitted. Your order is now awaiting seller verification.' 
          : 'Payment submitted successfully! Waiting for approval.'
      );
clearCart();
      const targetOrderId = isDraftCheckout ? responseData?.orderId : orderId;
      navigate(targetOrderId ? `/orders/${targetOrderId}` : '/orders');
    } catch (err) {
      console.error('Payment submission error:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading order..." />;
  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="font-bold text-red-600">Order not found.</p>
        <p className="mt-2 text-sm text-red-500">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: buyerQueryKeys.paymentOrder(orderId, user?.id) })}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!order) return <div className="p-10 text-center font-bold text-gray-400">Order not found...</div>;

  const remaining = isDraftCheckout ? order.total : order.total - (order.amountPaid || 0);
  const pageMatches = !query || [
    order.id,
    order.date,
    order.paymentStatus,
    form.method,
    form.reference,
    form.notes,
    String(order.total),
    String(order.amountPaid || 0),
    String(remaining)
  ].join(' ').toLowerCase().includes(query);

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-44">
      {!pageMatches ? (
        <div className="rounded-[32px] border border-gray-100 bg-white p-12 text-center text-slate-400 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest">No matching content on this page</p>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="size-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-600 hover:text-[#00A3C4] hover:border-[#00A3C4] transition-all"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t('buyer.makePayment')}</h1>
          <p className="text-sm font-medium text-gray-500">Securely settle your order balance.</p>
        </div>
        <RefreshIndicator visible={isFetching && !isLoading} />
      </div>

      {/* Order Summary Card */}
      <div className="bg-[#E0F7FA]/30 rounded-[32px] p-6 border border-[#E0F7FA] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <p className="text-xs font-black text-[#00A3C4] uppercase tracking-widest mb-1">
            {isDraftCheckout ? 'Checking out' : 'Paying for'}
          </p>
          <p className="text-lg font-black text-slate-900">Order #{order.id.split('-').pop()}</p>
          <p className="text-xs font-bold text-gray-400 mt-0.5">{order.date}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            {isDraftCheckout ? 'Order Total' : 'Remaining Balance'}
          </p>
          <p className="text-2xl font-black text-slate-900">ETB {remaining.toLocaleString()}</p>
          {order.amountPaid > 0 && <p className="text-[10px] font-bold text-emerald-600">Already Paid: ETB {order.amountPaid.toLocaleString()}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Payment Details */}
        <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="material-symbols-outlined text-[#00A3C4] text-xl">payments</span>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Transaction Details</h3>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Payment Amount (ETB)</label>
            <input 
              type="number"
              className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-black text-2xl text-[#00A3C4] focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] focus:bg-white transition-all shadow-inner"
              value={payAmount}
              max={remaining}
              onChange={(e) => setPayAmount(parseFloat(e.target.value))}
            />
            <p className="text-[10px] text-gray-400 font-medium ml-2">You can enter a partial amount to pay in installments.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Payment Method</label>
            <div className="relative">
              <select 
                className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] focus:bg-white transition-all appearance-none shadow-inner"
                value={form.method}
                onChange={(e) => setForm({...form, method: e.target.value})}
              >
                <option>Bank Transfer</option>
                <option>Mobile Money (CBE Birr/Telebirr)</option>
                <option>Check Deposit</option>
                <option>Cash Deposit</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Transaction Reference No.</label>
            <input 
              className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] focus:bg-white transition-all shadow-inner"
              placeholder="e.g. FT23098123 or Check #0099"
              value={form.reference}
              onChange={(e) => setForm({...form, reference: e.target.value})}
            />
            <p className="text-[10px] text-gray-400 font-medium ml-2">Required if no image proof is provided.</p>
          </div>
        </div>

        {/* Proof of Payment */}
        <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="material-symbols-outlined text-[#00A3C4] text-xl">image</span>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Proof of Payment</h3>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*" 
          />

          {form.image ? (
            <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
              <img src={form.image} alt="Proof" className="w-full h-64 object-cover" />
              <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-100"
                >
                  {t('common.edit')}
                </button>
                <button 
                  type="button"
                  onClick={() => setForm({...form, image: ''})}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-600"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-gray-200 rounded-2xl bg-gray-50 p-10 flex flex-col items-center justify-center cursor-pointer hover:border-[#00A3C4] hover:bg-[#E0F7FA]/20 transition-all group"
            >
              <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-[#00A3C4] mb-2 transition-colors">add_photo_alternate</span>
              <p className="text-xs font-bold text-gray-400 group-hover:text-[#00A3C4] transition-colors uppercase tracking-widest">Upload Receipt Image</p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 lg:left-72 right-0 p-6 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-40">
           <div className="max-w-2xl mx-auto">
             <button 
               type="submit"
               disabled={isSubmitting || (!form.reference && !form.image)}
               className="w-full py-4 bg-[#00A3C4] hover:bg-[#008CA8] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSubmitting ? 'Submitting...' : t('common.submit')}
               <span className="material-symbols-outlined text-lg">send</span>
             </button>
           </div>
        </div>
      </form>
      </>
      )}
    </div>
  );
};

export default BuyerPayment;
