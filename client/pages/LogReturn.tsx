
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Product, ReturnLog, Order, Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_STORAGE_LOCATIONS, fetchStorageLocations } from '../utils/storageLocations';

const LogReturn: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [storageLocations, setStorageLocations] = useState(DEFAULT_STORAGE_LOCATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    orderId: '',
    buyerId: '',
    type: 'Return' as 'Return' | 'Damage',
    quantity: 1,
    reason: 'Customer Return' as any,
    action: 'Restocked' as any,
    note: '',
    stockLocation: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const requests = [
          fetch('/api/products', { credentials: 'include' }),
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/buyers', { credentials: 'include' })
        ];
        if (editId) {
          requests.push(fetch(`/api/returns/${editId}`, { credentials: 'include' }));
        }
        const [productsRes, ordersRes, buyersRes, returnRes] = await Promise.all(requests);

        if (!productsRes.ok) throw new Error('Failed to fetch products');
        if (!ordersRes.ok) throw new Error('Failed to fetch orders');
        if (!buyersRes.ok) throw new Error('Failed to fetch buyers');
        if (editId && returnRes && !returnRes.ok) throw new Error('Failed to fetch return log');

        const [productsData, ordersData, buyersData, returnData] = await Promise.all([
          productsRes.json(),
          ordersRes.json(),
          buyersRes.json(),
          returnRes ? returnRes.json() : Promise.resolve(null)
        ]);

        setProducts(productsData);
        setOrders(ordersData);
        setBuyers(buyersData);
        if (returnData) {
          setForm({
            productId: returnData.productId || '',
            orderId: returnData.orderId || '',
            buyerId: returnData.buyerId || '',
            type: returnData.type || 'Return',
            quantity: returnData.quantity || 1,
            reason: returnData.reason || 'Customer Return',
            action: returnData.action || 'Restocked',
            note: returnData.note || '',
            stockLocation: returnData.stockLocation || ''
          });
        }
      } catch (err) {
        console.error('Returns form fetch error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editId]);

  useEffect(() => {
    let active = true;
    fetchStorageLocations()
      .then((locations) => {
        if (active) setStorageLocations(locations);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const requiresStockLocation = form.type === 'Damage' || (form.type === 'Return' && form.action === 'Restocked');
  const reasonOptions =
    form.type === 'Damage'
      ? ['Damaged in Transit', 'Faulty Packaging', 'Expired']
      : ['Customer Return', 'Wrong Item', 'Damaged in Transit'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.type === 'Return' && !form.orderId) {
      alert('Please select an order for returns.');
      return;
    }
    const product = products.find(p => p.id === form.productId);
    if (!product) return;

    setIsSubmitting(true);

    try {
      const payload: Partial<ReturnLog> = {
        productId: form.productId,
        type: form.type,
        quantity: form.quantity,
        reason: form.reason,
        action: form.action,
        date: new Date().toISOString().split('T')[0],
        note: form.note
      };

      if (form.type === 'Return') {
        payload.orderId = form.orderId;
        payload.buyerId = form.buyerId;
      }
      if (requiresStockLocation) {
        payload.stockLocation = form.stockLocation as any;
      }

      const res = await fetch(editId ? `/api/returns/${editId}` : '/api/returns', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create return log');
      }

      navigate('/returns');
    } catch (err) {
      console.error('Create return log error:', err);
      alert(err instanceof Error ? err.message : 'Failed to create return log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.id === form.productId);
  const selectedOrder = orders.find(o => o.id === form.orderId);
  const selectedBuyer = buyers.find(b => b.id === form.buyerId);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading return form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load return form</p>
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
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-red-50 text-red-600 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">assignment_return</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('returns.logTitle')}</h2>
            <p className="text-sm text-gray-500 font-medium">{t('returns.logDesc')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Incident Details */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-red-600 text-xl">inventory</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">{t('returns.itemInfo')}</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('returns.selectProduct')}</label>
                <div className="relative">
                  <select 
                    required
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner appearance-none"
                    value={form.productId}
                    onChange={(e) => setForm({...form, productId: e.target.value})}
                  >
                    <option value="">{t('returns.chooseProduct')}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              {selectedProduct && (
                <div className="p-4 bg-gray-50 rounded-2xl flex gap-4 items-center border border-gray-100">
                  <img src={selectedProduct.image} alt="" className="size-12 rounded-xl object-cover" />
                  <div>
                    <p className="text-xs font-black text-slate-800">{selectedProduct.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{selectedProduct.brand}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('returns.incidentType')}</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner appearance-none"
                      value={form.type}
                      onChange={(e) => {
                        const nextType = e.target.value as 'Return' | 'Damage';
                        const nextReason =
                          nextType === 'Damage'
                            ? (form.reason === 'Wrong Item' || form.reason === 'Customer Return'
                                ? 'Damaged in Transit'
                                : form.reason)
                            : (form.reason === 'Faulty Packaging' || form.reason === 'Expired'
                                ? 'Customer Return'
                                : form.reason);
                        setForm({
                          ...form,
                          type: nextType,
                          orderId: nextType === 'Return' ? form.orderId : '',
                          buyerId: nextType === 'Return' ? form.buyerId : '',
                          stockLocation: nextType === 'Damage' ? form.stockLocation : '',
                          reason: nextReason as any
                        });
                      }}
                    >
                      <option value="Return">Return</option>
                      <option value="Damage">Damage</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('returns.unitsAffected')}</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner"
                    value={form.quantity}
                    onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>

              {requiresStockLocation && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Stock Location</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner appearance-none"
                      value={form.stockLocation}
                      onChange={(e) => setForm({ ...form, stockLocation: e.target.value })}
                    >
                      <option value="">Choose location</option>
                      {storageLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {form.type === 'Return' && (
            <div className="space-y-8">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <span className="material-symbols-outlined text-red-600 text-xl">receipt_long</span>
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Order Link</h3>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Select Order</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner appearance-none"
                      value={form.orderId}
                      onChange={(e) => {
                        const nextOrderId = e.target.value;
                        const order = orders.find(o => o.id === nextOrderId);
                        setForm({
                          ...form,
                          orderId: nextOrderId,
                          buyerId: order?.buyerId || ''
                        });
                      }}
                    >
                      <option value="">Choose an order</option>
                      {orders.map(o => {
                        const buyer = buyers.find(b => b.id === o.buyerId);
                        return (
                          <option key={o.id} value={o.id}>
                            #{o.id.split('-').pop()} {buyer ? `- ${buyer.companyName}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>

                {selectedOrder && selectedBuyer && (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Buyer</p>
                    <p className="text-sm font-black text-slate-800">{selectedBuyer.companyName}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Context & Resolution */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-red-600 text-xl">gavel</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">{t('common.resolution')}</h3>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('returns.triggerReason')}</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner appearance-none"
                      value={form.reason}
                      onChange={(e) => setForm({...form, reason: e.target.value as any})}
                    >
                      {reasonOptions.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('returns.fulfillmentRes')}</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner appearance-none"
                      value={form.action}
                      onChange={(e) => {
                        const nextAction = e.target.value as any;
                        setForm({
                          ...form,
                          action: nextAction,
                          stockLocation: nextAction === 'Restocked' || form.type === 'Damage'
                            ? form.stockLocation
                            : ''
                        });
                      }}
                    >
                      <option value="Restocked">{t('returns.resRestock')}</option>
                      <option value="Disposed">{t('returns.resDisposal')}</option>
                      <option value="Returned to Supplier">{t('returns.resReturn')}</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('common.internalNotes')}</label>
                <textarea 
                  rows={3}
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-medium text-sm text-slate-800 focus:ring-2 focus:ring-red-200 focus:border-red-500 focus:bg-white transition-all shadow-inner leading-relaxed"
                  placeholder="Batch numbers, specific defect details..."
                  value={form.note}
                  onChange={(e) => setForm({...form, note: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col md:flex-row gap-4 pt-10 border-t border-gray-50">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate('/returns')}
              className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-80"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.5s]"></div>
                </div>
              ) : (
                <>
                  {editId ? 'Update Log' : t('returns.completeLog')}
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogReturn;
