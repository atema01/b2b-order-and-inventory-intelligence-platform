import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Order, Product, OrderStatus, Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { printInvoice } from '../utils/printInvoice';



const normalizeStatus = (value: any): OrderStatus => {
  if (typeof value !== 'string') return OrderStatus.PENDING;
  const map: Record<string, OrderStatus> = {
    DRAFT: OrderStatus.DRAFT,
    PENDING: OrderStatus.PENDING,
    PROCESSING: OrderStatus.PROCESSING,
    SHIPPED: OrderStatus.SHIPPED,
    DELIVERED: OrderStatus.DELIVERED,
    UNDELIVERED: OrderStatus.UNDELIVERED,
    CANCELLED: OrderStatus.CANCELLED,
    DELETED: OrderStatus.DELETED,
    Draft: OrderStatus.DRAFT,
    Pending: OrderStatus.PENDING,
    Processing: OrderStatus.PROCESSING,
    Shipped: OrderStatus.SHIPPED,
    Delivered: OrderStatus.DELIVERED,
    Undelivered: OrderStatus.UNDELIVERED,
    Cancelled: OrderStatus.CANCELLED,
    Deleted: OrderStatus.DELETED
  };
  return map[value] || OrderStatus.PENDING;
};

const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const canViewBuyers = Boolean(user?.permissions?.['Buyers']);
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUndeliveredModalOpen, setIsUndeliveredModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeliveredModalOpen, setIsDeliveredModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
useEffect(() => {
  const fetchOrderDetails = async () => {
    if (!id) {
      navigate('/orders');
      return;
    }
    
    try {
      setLoading(true);
      
      // Fetch order first
      const orderResponse = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (!orderResponse.ok) {
        navigate('/orders');
        return;
      }
      const orderData = await orderResponse.json();
      setOrder({
        ...orderData,
        status: normalizeStatus(orderData.status)
      });

      // Products are required for order items.
      const productsResponse = await fetch('/api/products', { credentials: 'include' });

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData);
      }

      // Buyer endpoint is optional because order payload includes buyer display fields.
      if (canViewBuyers && orderData.buyerId) {
        const buyerResponse = await fetch(`/api/buyers/${orderData.buyerId}`, { credentials: 'include' });
        if (buyerResponse.ok) {
          const buyerData = await buyerResponse.json();
          setBuyer(buyerData);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  fetchOrderDetails();
}, [id, navigate, canViewBuyers]);
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!order) return <div className="p-8 text-center text-gray-400 font-bold">Order not found.</div>;

  const isPending = order.status === OrderStatus.PENDING;
  const isProcessing = order.status === OrderStatus.PROCESSING;
  const isShipped = order.status === OrderStatus.SHIPPED;
  const isDelivered = order.status === OrderStatus.DELIVERED;
  const isUndelivered = order.status === OrderStatus.UNDELIVERED;
  const isDraft = order.status === OrderStatus.DRAFT;
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isDeleted = order.status === OrderStatus.DELETED;
  const buyerDisplayName = buyer?.companyName || order.buyerCompanyName || order.buyerName || 'Unknown Buyer';
  const buyerDisplayId = buyer?.id || order.buyerId || '---';
  const buyerDisplayPhone = buyer?.phone || order.buyerPhone || '-';
  const buyerDisplayEmail = buyer?.email || order.buyerEmail || '-';
  const buyerDisplayAddress = buyer?.address || order.buyerAddress || '-';

  const handleStatusUpdate = async (newStatus: OrderStatus, note: string): Promise<boolean> => {
    if (!order) return;
    
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, note: note })
      });

      if (response.ok) {
        const updatedOrder = await fetch(`/api/orders/${order.id}`, { credentials: 'include' }).then(r => r.json());
        setOrder(updatedOrder);
        return true;
      } else {
        alert('Failed to update order status');
        return false;
      }
    } catch (err) {
      alert('Network error');
      return false;
    }
  };

  const handleConfirmDelete = async () => {
    if (!reasonText.trim()) {
      alert("Please provide a reason for deletion.");
      return;
    }
    const ok = await handleStatusUpdate(OrderStatus.DELETED, reasonText);
    setIsDeleteModalOpen(false);
    setReasonText('');
    if (ok) {
      navigate('/orders');
    }
  };

  const handleConfirmUndelivered = () => {
    if (!reasonText.trim()) {
      alert("Please provide a reason for delivery failure.");
      return;
    }
    handleStatusUpdate(OrderStatus.UNDELIVERED, reasonText);
    setIsUndeliveredModalOpen(false);
    setReasonText('');
  };

  const handleConfirmCancel = () => {
    if (!reasonText.trim()) {
      alert("Please provide a reason for cancellation.");
      return;
    }
    handleStatusUpdate(OrderStatus.CANCELLED, `Seller cancelled: ${reasonText}`);
    setIsCancelModalOpen(false);
    setReasonText('');
  };

  const handleConfirmDelivered = () => {
    handleStatusUpdate(OrderStatus.DELIVERED, 'Order confirmed delivered by field staff');
    setIsDeliveredModalOpen(false);
  };

  const getStatusBannerColor = () => {
    if (isDelivered) return 'bg-emerald-500';
    if (isShipped) return 'bg-purple-500';
    if (isProcessing) return 'bg-blue-500';
    if (isUndelivered) return 'bg-red-500';
    if (isCancelled) return 'bg-slate-400';
    if (isDeleted) return 'bg-red-600';
    return 'bg-amber-500';
  };

  const getStatusBadgeStyles = () => {
    if (isDelivered) return 'bg-emerald-50 text-emerald-700';
    if (isShipped) return 'bg-purple-50 text-purple-700';
    if (isProcessing) return 'bg-blue-50 text-blue-700';
    if (isUndelivered) return 'bg-red-50 text-red-700';
    if (isCancelled) return 'bg-slate-50 text-slate-400';
    if (isDeleted) return 'bg-red-50 text-red-600';
    return 'bg-amber-50 text-amber-600';
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-48">
      {/* Current Status Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusBannerColor()} animate-pulse`}></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('order.lifecycle')}</span>
        </div>
        <div className={`
          px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider
          ${getStatusBadgeStyles()}
        `}>
          {t(`status.${order.status.toLowerCase()}` as any)}
        </div>
      </div>

      <div className="p-4 lg:p-8 max-w-xl mx-auto space-y-5">
        
 {/* CUSTOMER INFO CARD */}
{/* CUSTOMER INFO CARD */}
<div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
  <div className="px-6 py-4 border-b border-gray-50">
    <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('order.partner')}</h2>
  </div>
  <div className="p-6 space-y-6">
    {/* ðŸ”¥ ADD DEBUG INFO */}
    {/* Buyer details: prefer fetched buyer, fallback to order-level fields */}
    <div className="flex items-start gap-4">
      <span className="material-symbols-outlined text-gray-300 text-2xl">store</span>
      <div>
        <p className="font-black text-slate-800 text-lg leading-tight">{buyerDisplayName}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Account ID: #{buyerDisplayId.slice(0, 8)}</p>
      </div>
    </div>
    
    <div className="flex items-start gap-4">
      <span className="material-symbols-outlined text-gray-300 text-2xl">call</span>
      <div>
        <p className="font-bold text-slate-800 text-sm">{buyerDisplayPhone}</p>
        <p className="text-xs text-gray-400 font-medium">{buyerDisplayEmail}</p>
      </div>
    </div>

    <div className="flex items-start gap-4">
      <span className="material-symbols-outlined text-gray-300 text-2xl">location_on</span>
      <p className="text-sm font-medium text-slate-600 leading-relaxed pr-8">
        {buyerDisplayAddress}
      </p>
    </div>
  </div>
</div>

        {/* ORDER ITEMS CARD */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('order.manifest')}</h2>
            <span className="bg-blue-50 text-primary px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{order.items.length} SKUs</span>
          </div>
          <div className="divide-y divide-gray-50">
           {order.items.map((item, i) => {
  // Fix 1: Access correct property name from API (snake_case)
  const priceAtOrder = parseFloat(item.priceAtOrder || '0');
  const quantity = parseInt(item.quantity || '0');
  const total = quantity * priceAtOrder;
  
  const p = products.find(prod => prod.id === item.productId);
  
  return (
    <div key={i} className="p-5 flex justify-between items-center">
      <div className="min-w-0">
        <p className="font-bold text-slate-800 text-sm truncate">{p?.name || 'Loading SKU...'}</p>
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-tighter">SKU: {p?.sku || '---'}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end gap-1.5 mb-1">
          <span className="text-xs font-black text-slate-800">{quantity}</span>
          <span className="text-[10px] text-gray-300 font-bold">Ã— {priceAtOrder.toLocaleString()}</span>
        </div>
        <p className="text-sm font-black text-primary">ETB {total.toLocaleString()}</p>
      </div>
    </div>
  );
})}
          </div>
          <div className="p-6 bg-gray-50/50 space-y-2 border-t border-gray-100">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">{t('buyer.subtotal')}</span>
              <span className="font-bold text-slate-800">ETB {order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">{t('buyer.tax')}</span>
              <span className="font-bold text-slate-800">ETB {order.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-4 mt-2 border-t border-gray-200">
              <span className="text-base font-black text-slate-900">{t('buyer.total')}</span>
              <span className="text-xl font-black text-primary">ETB {order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ORDER HISTORY TIMELINE */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('order.timeline')}</h2>
          </div>
          <div className="p-8">
            <div className="space-y-12">
              {[...order.history].reverse().map((h, i) => (
                <div key={i} className="flex gap-6 relative">
                  {i < order.history.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-[-48px] w-0.5 bg-gray-100"></div>
                  )}
                  <div className="relative z-10 size-6 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center">
                    <div className={`size-3 rounded-full ${i === 0 ? 'bg-primary scale-110 shadow-sm' : 'bg-gray-200'}`}></div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-800 text-[13px] leading-tight">{h.status}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h.date}</p>
                    {h.note && <p className="text-[11px] text-slate-500 mt-2 font-medium bg-gray-50 p-2 rounded-xl border border-gray-100">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CANCEL CONFIRMATION MODAL */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined font-black">cancel</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{t('order.cancel')}?</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stops fulfillment process</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Cancellation Reason</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-gray-50 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                  placeholder="e.g., Customer request, out of stock, duplicate order..."
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => { setIsCancelModalOpen(false); setReasonText(''); }}
                  className="flex-1 py-4 bg-gray-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  {t('common.back')}
                </button>
                <button 
                  onClick={handleConfirmCancel}
                  className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined font-black">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{t('common.delete')}?</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soft-Deletion Protocol</p>
                </div>
              </div>

              {order.stockDeducted && (
                <div className="mb-6">
                  <p className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-500">inventory_2</span>
                    Stock to be Restocked:
                  </p>
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
                    {order.items.map((item, idx) => {
                      const p = products.find(prod => prod.id === item.productId);
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600 truncate mr-4">{p?.name || 'Item'}</span>
                          <span className="font-black text-emerald-600 shrink-0">+{item.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Reason for Deletion</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-gray-50 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                  placeholder="e.g., Customer cancelled, error in quantities, inventory discrepancy..."
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => { setIsDeleteModalOpen(false); setReasonText(''); }}
                  className="flex-1 py-4 bg-gray-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  {t('common.back')}
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNDELIVERED MODAL */}
      {isUndeliveredModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined font-black">assignment_return</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{t('order.undelivered')}?</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock will be restocked automatically</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Delivery Failure Reason</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-gray-50 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                  placeholder="e.g., Warehouse closed, customer rejected, vehicle breakdown..."
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => { setIsUndeliveredModalOpen(false); setReasonText(''); }}
                  className="flex-1 py-4 bg-gray-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={handleConfirmUndelivered}
                  className="flex-[2] py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-200 active:scale-95 transition-all"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERED CONFIRMATION MODAL */}
      {isDeliveredModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined font-black">check_circle</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{t('order.markDelivered')}?</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirm successful handover</p>
                </div>
              </div>

              <p className="text-sm font-medium text-slate-600 leading-relaxed mb-8">
                This will update the order status to <strong>Delivered</strong>. Ensure the buyer has received all items in good condition.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeliveredModalOpen(false)}
                  className="flex-1 py-4 bg-gray-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={handleConfirmDelivered}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BAR */}
      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-4 z-50 shadow-2xl">
        <div className="max-w-xl mx-auto flex flex-col gap-3">
          <div className="flex gap-3">
            {!isShipped && !isDelivered && !isDeleted && (
              <button 
                onClick={() => { setReasonText(''); setIsDeleteModalOpen(true); }}
                className="size-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm border border-red-100"
                title="Delete Order"
              >
                <span className="material-symbols-outlined font-black">delete_forever</span>
              </button>
            )}

            {(isPending || isProcessing) && !isCancelled && !isDeleted && (
              <button 
                onClick={() => { setReasonText(''); setIsCancelModalOpen(true); }}
                className="flex-1 h-14 bg-white border-2 border-red-100 text-red-600 rounded-2xl flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-all hover:bg-red-50"
              >
                <span className="material-symbols-outlined">cancel</span>
                {t('order.cancel')}
              </button>
            )}
            
            <button 
              onClick={() => printInvoice(order, buyer, products)}
              className="flex-1 h-14 bg-gray-100 text-slate-700 rounded-2xl flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-all hover:bg-gray-200"
            >
              <span className="material-symbols-outlined">print</span>
              {t('order.invoice')}
            </button>
            
            {(isPending || isProcessing || isDraft) && !isCancelled && !isDeleted && (
              <Link 
                to={`/orders/create?edit=${order.id}`}
                className="flex-1 h-14 bg-white border-2 border-gray-100 text-slate-600 rounded-2xl flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-all hover:border-primary hover:text-primary"
              >
                <span className="material-symbols-outlined">edit_square</span>
                {t('order.edit')}
              </Link>
            )}

            {isDraft && !isDeleted && (
              <button 
                onClick={() => handleStatusUpdate(OrderStatus.PENDING, 'Draft submitted to live queue')}
                className="flex-1 h-14 bg-primary text-white rounded-2xl flex items-center justify-center gap-2 font-black text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">send</span>
                {t('order.submit')}
              </button>
            )}
          </div>

          {(isPending || isProcessing) && !isCancelled && !isDeleted && (
            <Link 
              to={`/orders/${id}/process`}
              className="w-full h-14 bg-primary text-white rounded-2xl flex items-center justify-center gap-2 font-black text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              {t('order.fulfill')}
            </Link>
          )}

          {isShipped && !isDeleted && (
             <div className="flex gap-3 w-full animate-in slide-in-from-bottom-2">
                <button 
                  onClick={() => { setReasonText(''); setIsUndeliveredModalOpen(true); }}
                  className="flex-1 h-14 bg-red-50 text-red-600 border border-red-100 rounded-2xl flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined">assignment_return</span>
                  {t('order.undelivered')}
                </button>
                <button 
                  onClick={() => setIsDeliveredModalOpen(true)}
                  className="flex-[2] h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-sm shadow-xl shadow-emerald-200 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined">check_circle</span>
                  {t('order.markDelivered')}
                </button>
             </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default OrderDetails;




