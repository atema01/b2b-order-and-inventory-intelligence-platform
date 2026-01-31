
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { CreditRequest, Buyer, Order } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const LogCredit: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [form, setForm] = useState({
    orderId: '',
    amount: 0,
    reason: 'Return' as any,
    notes: ''
  });

  useEffect(() => {
    setBuyers(db.getAllBuyers());
    setOrders(db.getAllOrders());
  }, []);

  const buyerOrders = orders.filter(o => o.buyerId === selectedBuyerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyerId || form.amount <= 0) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const newRequest: CreditRequest = {
        id: `CR-${Date.now().toString().slice(-6)}`,
        buyerId: selectedBuyerId,
        orderId: form.orderId || undefined,
        amount: form.amount,
        reason: form.reason,
        status: 'Pending',
        requestDate: new Date().toISOString().split('T')[0],
        notes: form.notes
      };

      db.createCreditRequest(newRequest);
      navigate('/credits');
    }, 600);
  };

  const selectedBuyer = buyers.find(b => b.id === selectedBuyerId);

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">credit_card</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('credits.logTitle')}</h2>
            <p className="text-sm text-gray-500 font-medium">{t('credits.logDesc')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Buyer Selection */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-amber-600 text-xl">person</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">{t('credits.accountDetails')}</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('credits.selectBuyer')}</label>
                <div className="relative">
                  <select 
                    required
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:bg-white transition-all shadow-inner appearance-none"
                    value={selectedBuyerId}
                    onChange={(e) => setSelectedBuyerId(e.target.value)}
                  >
                    <option value="">{t('credits.chooseBuyer')}</option>
                    {buyers.map(b => <option key={b.id} value={b.id}>{b.companyName}</option>)}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              {selectedBuyer && (
                <div className="p-4 bg-gray-50 rounded-2xl flex gap-4 items-center border border-gray-100">
                  <div className="size-10 bg-white rounded-xl flex items-center justify-center font-black text-amber-600 border border-gray-100">
                    {selectedBuyer.companyName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{selectedBuyer.contactPerson}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{t('credits.currentCredit')}: ETB {selectedBuyer.availableCredit.toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('credits.assocOrderOpt')}</label>
                <div className="relative">
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:bg-white transition-all shadow-inner appearance-none disabled:opacity-50"
                    value={form.orderId}
                    onChange={(e) => setForm({...form, orderId: e.target.value})}
                    disabled={!selectedBuyerId}
                  >
                    <option value="">{t('credits.generalCreditOpt')}</option>
                    {buyerOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.id.split('-').pop()} - {o.date} ({t('buyer.total')}: {o.total})
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-amber-600 text-xl">payments</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">{t('credits.creditTerms')}</h3>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('credits.creditAmount')}</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-black text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:bg-white transition-all shadow-inner"
                    value={form.amount}
                    onChange={(e) => setForm({...form, amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('credits.reasonCode')}</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:bg-white transition-all shadow-inner appearance-none"
                      value={form.reason}
                      onChange={(e) => setForm({...form, reason: e.target.value as any})}
                    >
                      <option value="Damaged Goods">Damaged Goods</option>
                      <option value="Return">Product Return</option>
                      <option value="Pricing Error">Pricing Error</option>
                      <option value="Shortage">Shortage / Missing</option>
                      <option value="Goodwill">Goodwill / Loyalty</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('common.internalNotes')}</label>
                <textarea 
                  rows={3}
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-medium text-sm text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:bg-white transition-all shadow-inner leading-relaxed"
                  placeholder={t('credits.notesPlaceholder')}
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col md:flex-row gap-4 pt-10 border-t border-gray-50">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate('/credits')}
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
                  {t('credits.submitRequest')}
                  <span className="material-symbols-outlined text-lg">send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogCredit;
