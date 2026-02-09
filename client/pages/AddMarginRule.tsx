
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AddMarginRule: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    minUnitCost: 1000,
    minMarginPercentage: 8,
    bonusDiscount: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/pricing/margin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          minUnitCost: form.minUnitCost,
          minMarginPercentage: form.minMarginPercentage,
          bonusDiscount: form.bonusDiscount,
          isActive: true
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create margin rule');
      }

      navigate('/pricing');
    } catch (err) {
      console.error('Create margin rule error:', err);
      alert(err instanceof Error ? err.message : 'Failed to create margin rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">security</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Add Margin Constraint</h2>
            <p className="text-sm text-gray-500 font-medium">Protect profits while rewarding high-value sales.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
           <div className="space-y-8">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <span className="material-symbols-outlined text-emerald-600 text-xl">account_balance_wallet</span>
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Rule Criteria</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Minimum Unit Cost (ETB)</label>
                  <input 
                    required
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.minUnitCost}
                    onChange={(e) => setForm({ ...form, minUnitCost: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Minimum Required Margin (%)</label>
                  <input 
                    required
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.minMarginPercentage}
                    onChange={(e) => setForm({ ...form, minMarginPercentage: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="pt-4 space-y-2">
                  <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1">Grant Bonus Discount (%)</label>
                  <input 
                    required
                    type="number"
                    className="w-full bg-emerald-50 border-transparent rounded-2xl px-5 py-4 font-black text-emerald-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                    value={form.bonusDiscount}
                    onChange={(e) => setForm({ ...form, bonusDiscount: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-gray-400 mt-2 font-medium italic">This discount is added on top of tier and volume benefits.</p>
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
               Cancel
             </button>
             <button 
               type="submit" 
               disabled={isSubmitting}
               className="flex-[2] py-5 bg-emerald-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-80"
             >
               {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.3s]"></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.5s]"></div>
                  </div>
               ) : (
                <>
                  Deploy Constraint
                  <span className="material-symbols-outlined text-lg">add_moderator</span>
                </>
               )}
             </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default AddMarginRule;
