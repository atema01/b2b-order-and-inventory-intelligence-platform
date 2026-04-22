
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Order, Product, OrderStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import RefreshIndicator from '../components/RefreshIndicator';
import { buyerQueryKeys, loadBuyerOrderDetails, normalizeBuyerOrderStatus } from '../services/buyerQueries';

const BuyerOrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Credit Request State
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditReason, setCreditReason] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditPaymentTerms, setCreditPaymentTerms] = useState<'Net 15' | 'Net 30'>('Net 15');

  // Delete/Cancel Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
  const {
    data,
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: buyerQueryKeys.orderDetails(id, user?.id),
    queryFn: () => loadBuyerOrderDetails(id, user?.id)
  });
  const order = data?.order ?? null;
  const products = data?.products ?? [];

  useEffect(() => {
    if (!order) return;
    setCreditAmount(order.total - (order.amountPaid || 0));
  }, [order]);

  useRealtimeEvent<{ orderId?: string; buyerId?: string }>('realtime:orders', (detail) => {
    if (!id || detail?.orderId !== id) return;
    if (user?.id && detail?.buyerId && detail.buyerId !== user.id) return;
    queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
  });

  useRealtimeEvent<{ orderId?: string; buyerId?: string }>('realtime:payments', (detail) => {
    if (!id || detail?.orderId !== id) return;
    if (user?.id && detail?.buyerId && detail.buyerId !== user.id) return;
    queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
  });

  useRealtimeEvent<{ orderId?: string; buyerId?: string }>('realtime:credits', (detail) => {
    if (!id || detail?.orderId !== id) return;
    if (user?.id && detail?.buyerId && detail.buyerId !== user.id) return;
    queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
  });

  if (isLoading) return <LoadingState message="Loading order details..." />;
  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-semibold text-red-700">Failed to load order details.</p>
          <p className="mb-4 text-sm text-red-600">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: buyerQueryKeys.orderDetails(id, user?.id) })}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!order) return <div className="p-8">Order not found.</div>;

  const normalizeStatus = normalizeBuyerOrderStatus;

  const normalizedStatus = normalizeStatus(order.status);
  const isDelivered = normalizedStatus === OrderStatus.DELIVERED;
  const isDraft = normalizedStatus === OrderStatus.DRAFT;
  const isCancelled = normalizedStatus === OrderStatus.CANCELLED;
  const isPaid = order.paymentStatus === 'Paid';
  const remainingBalance = order.total - (order.amountPaid || 0);

  // Can request credit if: Pending, Processing, Shipped, OR Delivered (but not fully paid)
  const canRequestCredit = (
    normalizedStatus !== OrderStatus.DRAFT && 
    normalizedStatus !== OrderStatus.CANCELLED && 
    normalizedStatus !== OrderStatus.DELETED &&
    normalizedStatus !== OrderStatus.UNDELIVERED &&
    !isPaid
  );

  // Can pay if: Pending, Processing, Shipped, OR Delivered, AND not fully paid
  const canPay = (
    (normalizedStatus === OrderStatus.PENDING || 
     normalizedStatus === OrderStatus.PROCESSING || 
     normalizedStatus === OrderStatus.SHIPPED || 
     normalizedStatus === OrderStatus.DELIVERED) && 
    !isPaid
  );

  // Can cancel if: Pending or Processing (Placed but not shipped)
  const canCancel = (normalizedStatus === OrderStatus.PENDING || normalizedStatus === OrderStatus.PROCESSING);

  const handleCreditRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!creditAmount || creditAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        orderId: order.id,
        amount: creditAmount,
        reason: 'Order Financing',
        notes: creditReason,
        paymentTerms: creditPaymentTerms
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to submit credit request');
        setIsCreditModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-credit-list'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
        alert('Credit request submitted successfully. Once approved, the amount will be added to your credit balance.');
        navigate('/credit');
      })
      .catch(err => {
        console.error('Credit request error:', err);
        alert('Failed to submit credit request.');
      });
  };

  const handleReorder = () => {
    if (!order) return;
    
    // Create a new draft order based on this delivered order
    const newOrder: Order = {
      ...order,
      id: `ORD-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Draft' as OrderStatus,
      amountPaid: 0,
      paymentStatus: 'Unpaid',
      createdBy: 'buyer',
      history: [{ 
        status: 'Draft Created', 
        date: new Date().toLocaleString(), 
        note: `Reorder created from #${order.id.replace('ORD-', '')}` 
      }],
      stockDeducted: false // Important: Drafts don't deduct stock
    };

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...newOrder,
        status: 'Draft'
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to create reorder draft');
        queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-catalog'] });
        navigate('/orders');
        alert(`Reorder draft #${newOrder.id} created.`);
      })
      .catch(err => {
        console.error('Reorder error:', err);
        alert('Failed to create reorder draft.');
      });
  };

  const handleEditDraft = () => {
    navigate(`/catalog?draftId=${order.id}`);
  };

  const handlePlaceOrder = () => {
    if (!order) return;
    navigate(`/payment?draftId=${order.id}`);
  };

  const handleDeleteOrder = () => {
    if (!order) return;
    fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'Deleted', note: 'Deleted by buyer' })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete order');
        queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
        navigate('/orders');
      })
      .catch(err => {
        console.error('Delete order error:', err);
        alert('Failed to delete order.');
      });
  };

  const handleCancelOrder = () => {
    if (!order) return;
    if (!cancelReason.trim()) {
        alert("Please enter a reason for cancellation.");
        return;
    }
    
    fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'Cancelled', note: `Cancelled by buyer: ${cancelReason}` })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to cancel order');
        setIsCancelModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['buyer-order-details'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
        queryClient.invalidateQueries({ queryKey: ['buyer-dashboard'] });
        alert("Order has been cancelled.");
        navigate('/orders');
      })
      .catch(err => {
        console.error('Cancel order error:', err);
        alert('Failed to cancel order.');
      });
  };

  const handlePayment = () => {
    navigate(`/payment/${order.id}`);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(normalizeStatus(status)) {
      case OrderStatus.ON_REVIEW: return 'bg-cyan-100 text-cyan-800';
      case OrderStatus.PENDING: return 'bg-amber-100 text-amber-800';
      case OrderStatus.PROCESSING: return 'bg-blue-100 text-blue-800';
      case OrderStatus.SHIPPED: return 'bg-purple-100 text-purple-800';
      case OrderStatus.DELIVERED: return 'bg-emerald-100 text-emerald-800';
      case OrderStatus.CANCELLED: return 'bg-red-100 text-red-800';
      case OrderStatus.DRAFT: return 'bg-gray-100 text-gray-800 border border-gray-200';
      case OrderStatus.DELETED: return 'bg-gray-200 text-gray-600 border border-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const paymentPercentage = Math.min(100, ((order.amountPaid || 0) / order.total) * 100);
  const pageMatches = !query || [
    order.id,
    order.date,
    order.paymentStatus,
    order.paymentTerms || '',
    normalizedStatus,
    String(order.total),
    String(order.amountPaid || 0),
    ...order.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return [item.productId, product?.name || '', product?.sku || '', product?.brand || ''].join(' ');
    })
  ].join(' ').toLowerCase().includes(query);

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6 pb-40">
      {!pageMatches ? (
        <div className="rounded-[32px] border border-gray-100 bg-white p-12 text-center text-slate-400 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest">No matching content on this page</p>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/orders')}
          className="size-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-600 hover:text-[#00A3C4] hover:border-[#00A3C4] transition-all"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Order #{order.id}</h1>
          <div className="flex items-center gap-2 mt-1">
             <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${getStatusColor(order.status)}`}>
               {normalizeStatus(order.status)}
             </span>
             <span className="text-xs font-bold text-gray-400">{order.date}</span>
          </div>
        </div>
        <RefreshIndicator visible={isFetching && !isLoading} />
      </div>

      {/* Payment Progress Card (If not draft/cancelled/deleted) */}
      {!isDraft && !isCancelled && normalizedStatus !== OrderStatus.DELETED && (
        <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-black text-slate-800">{t('common.status')}: <span className={`${isPaid ? 'text-emerald-500' : 'text-amber-500'}`}>{order.paymentStatus || 'Unpaid'}</span></h3>
            <span className="text-xs font-bold text-gray-400">{Math.round(paymentPercentage)}% Paid</span>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#00A3C4] transition-all duration-1000" style={{ width: `${paymentPercentage}%` }}></div>
          </div>
          <div className="flex justify-between mt-3 text-xs">
             <div>
               <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Paid Amount</p>
               <p className="font-black text-slate-900 text-base">ETB {(order.amountPaid || 0).toLocaleString()}</p>
             </div>
             <div className="text-right">
               <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Remaining</p>
               <p className="font-black text-slate-900 text-base">ETB {remainingBalance.toLocaleString()}</p>
             </div>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
           <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('buyer.items')}</h2>
           <span className="text-xs font-bold text-gray-400">{order.items.length} Products</span>
        </div>
        <div className="divide-y divide-gray-50">
          {order.items.map((item, idx) => {
            const p = products.find(prod => prod.id === item.productId);
            return (
              <div key={idx} className="p-5 flex items-center gap-4">
                <div className="size-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                  {p && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{p?.name || 'Product'}</p>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">SKU: {p?.sku}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs font-medium text-slate-600">Qty: <span className="font-black">{item.quantity}</span></p>
                    <p className="font-black text-slate-900">ETB {(item.quantity * item.priceAtOrder).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-2">
           <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>{t('buyer.subtotal')}</span>
              <span>ETB {order.subtotal.toLocaleString()}</span>
           </div>
           <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>{t('buyer.tax')}</span>
              <span>ETB {order.tax.toLocaleString()}</span>
           </div>
           <div className="flex justify-between text-lg font-black text-slate-900 pt-2 border-t border-gray-200">
              <span>{t('buyer.total')}</span>
              <span>ETB {order.total.toLocaleString()}</span>
           </div>
        </div>
      </div>

      {/* Action Footer */}
      {(canRequestCredit || isDelivered || isDraft || isCancelled || canPay || canCancel) && (
        <div className="fixed bottom-0 left-0 lg:left-72 right-0 p-6 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-40">
           <div className="max-w-3xl mx-auto flex gap-3">
             {canPay && (
               <button 
                 onClick={handlePayment}
                 className="flex-1 py-4 bg-[#00A3C4] hover:bg-[#008CA8] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <span className="material-symbols-outlined">payments</span>
                 {t('buyer.makePayment')}
               </button>
             )}

             {canRequestCredit && (
               <button 
                 onClick={() => setIsCreditModalOpen(true)}
                 className="flex-1 py-4 bg-white border-2 border-[#E0F7FA] text-[#00A3C4] hover:border-[#00A3C4] rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <span className="material-symbols-outlined">credit_score</span>
                 {t('buyer.requestCredit')}
               </button>
             )}
             
             {isDelivered && (
               <button 
                 onClick={handleReorder}
                 className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <span className="material-symbols-outlined">history</span>
                 {t('buyer.reorder')}
               </button>
             )}

             {(isDraft || isCancelled) && (
               <button 
                 onClick={() => setIsDeleteModalOpen(true)}
                 className="size-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm border border-red-100 shrink-0"
                 title="Delete Order"
               >
                 <span className="material-symbols-outlined">delete</span>
               </button>
             )}

             {canCancel && (
                <button 
                  onClick={() => setIsCancelModalOpen(true)}
                  className="flex-1 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined">cancel</span>
                  {t('buyer.cancelOrder')}
                </button>
             )}

             {isDraft && (
               <>
                 <button 
                   onClick={handleEditDraft}
                   className="flex-1 py-4 bg-white border-2 border-gray-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:border-primary hover:text-primary active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   <span className="material-symbols-outlined">edit_square</span>
                   {t('common.edit')}
                 </button>
                 <button 
                   onClick={handlePlaceOrder}
                   className="flex-1 py-4 bg-[#00A3C4] hover:bg-[#008CA8] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   <span className="material-symbols-outlined">shopping_bag</span>
                  Proceed to Payment
                </button>
              </>
            )}
           </div>
        </div>
      )}

      {/* Credit Request Modal */}
      {isCreditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8 animate-in zoom-in duration-200">
             <div className="flex items-center gap-4 mb-6">
               <div className="size-12 rounded-2xl bg-[#E0F7FA] text-[#00A3C4] flex items-center justify-center">
                 <span className="material-symbols-outlined text-2xl">request_quote</span>
               </div>
               <div>
                 <h3 className="text-xl font-black text-slate-900">{t('buyer.requestCredit')}</h3>
                 <p className="text-xs text-gray-500 font-bold">For Order #{order.id.replace('ORD-', '')}</p>
               </div>
             </div>

             <form onSubmit={handleCreditRequest} className="space-y-4">
               <div>
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Reason</label>
                 <textarea 
                   required
                   rows={3}
                   className="w-full bg-gray-50 border-transparent rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:bg-white transition-all"
                   placeholder="e.g. Requesting financing for remaining balance..."
                   value={creditReason}
                   onChange={(e) => setCreditReason(e.target.value)}
                 />
               </div>
               
               <div>
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Amount Requested (ETB)</label>
                 <input 
                   type="number"
                   max={remainingBalance}
                   className="w-full bg-gray-50 border-transparent rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:bg-white transition-all"
                   value={creditAmount}
                   onChange={(e) => setCreditAmount(parseFloat(e.target.value))}
                 />
                 <p className="text-[10px] text-gray-400 mt-1 ml-2">Max requestable: ETB {remainingBalance.toLocaleString()}</p>
               </div>

               <div>
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Repayment Terms</label>
                 <div className="relative">
                   <select
                     className="w-full bg-gray-50 border-transparent rounded-2xl p-4 pr-12 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:bg-white transition-all appearance-none"
                     value={creditPaymentTerms}
                     onChange={(e) => setCreditPaymentTerms(e.target.value as 'Net 15' | 'Net 30')}
                   >
                     <option value="Net 15">15 Days</option>
                     <option value="Net 30">30 Days</option>
                   </select>
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                 </div>
               </div>

               <div className="flex gap-3 pt-4">
                 <button 
                   type="button"
                   onClick={() => setIsCreditModalOpen(false)}
                   className="flex-1 py-3 bg-gray-100 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                 >
                   {t('common.cancel')}
                 </button>
                 <button 
                   type="submit"
                   className="flex-[2] py-3 bg-[#00A3C4] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#00A3C4]/20 hover:bg-[#008CA8] transition-all"
                 >
                   {t('common.submit')}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
      </>
      )}

      {/* Cancel Order Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="size-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl font-black">cancel</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{t('buyer.cancelOrder')}?</h3>
                  <p className="text-xs font-bold text-gray-400">Order #{order.id.replace('ORD-', '')}</p>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Reason for Cancellation</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-gray-50 border-transparent rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:bg-white transition-all placeholder:font-medium"
                  placeholder="e.g. Changed my mind, found better price, accidental order..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  {t('common.back')}
                </button>
                <button 
                  onClick={handleCancelOrder}
                  className="flex-[2] py-3.5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="size-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl font-black">delete_forever</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{t('buyer.deleteOrder')}?</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Are you sure you want to permanently remove Order <strong>#{order.id.replace('ORD-', '')}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={handleDeleteOrder}
                  className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerOrderDetails;



