
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Payment, Order, PaymentStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const PaymentReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const p = db.getPayment(id);
      if (p) {
        setPayment(p);
        setNotes(p.notes || '');
        const o = db.getOrder(p.orderId);
        if (o) setOrder(o);
      }
    }
  }, [id]);

  if (!payment) return <div className="p-8">Payment not found.</div>;

  const handleAction = (status: PaymentStatus) => {
    if (payment) {
        const updatedPayment = { ...payment, status, notes: notes || payment.notes };
        db.updatePayment(updatedPayment);
        navigate('/payments');
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 pb-32">
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
            <h3 className="text-sm font-black text-slate-800">{t('payments.reviewNotes')}</h3>
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

      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 z-40">
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
      </footer>
    </div>
  );
};

export default PaymentReview;
