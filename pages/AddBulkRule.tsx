
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { BulkDiscountRule } from '../types';

const AddBulkRule: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    unitThreshold: 12,
    discountPercentage: 2
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    setTimeout(() => {
      const newRule: BulkDiscountRule = {
        id: `BR-${Date.now().toString().slice(-4)}`,
        unitThreshold: form.unitThreshold,
        discountPercentage: form.discountPercentage,
        isActive: true
      };

      db.createBulkRule(newRule);
      navigate('/pricing');
    }, 600);
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">reorder</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">New Volume Step</h2>
            <p className="text-sm text-gray-500 font-medium">Reward bulk purchases of single SKU items.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Threshold Settings</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Minimum Units Required</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.unitThreshold}
                  onChange={(e) => setForm({ ...form, unitThreshold: parseInt(e.target.value) || 0 })}
                  placeholder="e.g. 24"
                />
                <p className="text-[10px] text-gray-400 font-medium ml-1 italic">Applies when a single product reaches this count in an order.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1">Stackable Discount (%)</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-emerald-50 border-transparent rounded-2xl px-5 py-4 font-black text-emerald-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                  value={form.discountPercentage}
                  onChange={(e) => setForm({ ...form, discountPercentage: parseInt(e.target.value) || 0 })}
                  placeholder="e.g. 5"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4 pt-10 border-t border-gray-50">
            <button 
              type="button" 
              disabled={isSubmitting}
              onClick={() => navigate('/pricing')} 
              className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Discard
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
                  Deploy Volume Step
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

export default AddBulkRule;
