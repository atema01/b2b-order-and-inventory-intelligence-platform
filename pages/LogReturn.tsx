
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Product, ReturnLog } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const LogReturn: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    type: 'Return' as 'Return' | 'Damage',
    quantity: 1,
    reason: 'Customer Return' as any,
    action: 'Restocked' as any,
    note: ''
  });

  useEffect(() => {
    setProducts(db.getAllProducts());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === form.productId);
    if (!product) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const newLog: ReturnLog = {
        id: `RT-${Date.now().toString().slice(-4)}`,
        productId: form.productId,
        productName: product.name,
        brand: product.brand,
        type: form.type,
        quantity: form.quantity,
        reason: form.reason,
        action: form.action,
        date: new Date().toISOString().split('T')[0],
        note: form.note,
        lossValue: form.action === 'Disposed' ? (product.costPrice || product.price) * form.quantity : 0
      };

      db.createReturnLog(newLog);
      navigate('/returns');
    }, 600);
  };

  const selectedProduct = products.find(p => p.id === form.productId);

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
                      onChange={(e) => setForm({...form, type: e.target.value as any})}
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
            </div>
          </div>

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
                      <option value="Customer Return">Customer Return</option>
                      <option value="Damaged in Transit">Damaged in Transit</option>
                      <option value="Faulty Packaging">Faulty Packaging</option>
                      <option value="Expired">Expired</option>
                      <option value="Wrong Item">Wrong Item</option>
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
                      onChange={(e) => setForm({...form, action: e.target.value as any})}
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
                  {t('returns.completeLog')}
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
