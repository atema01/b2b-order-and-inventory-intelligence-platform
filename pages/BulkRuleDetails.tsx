
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { BulkDiscountRule } from '../types';

const BulkRuleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rule, setRule] = useState<BulkDiscountRule | null>(null);
  const [form, setForm] = useState({
    unitThreshold: 0,
    discountPercentage: 0
  });

  useEffect(() => {
    if (id) {
      const r = db.getBulkRule(id);
      if (r) {
        setRule(r);
        setForm({ unitThreshold: r.unitThreshold, discountPercentage: r.discountPercentage });
      }
    }
  }, [id]);

  if (!rule) return <div className="p-8 text-center text-gray-400">Rule not found.</div>;

  const handleUpdate = () => {
    const updated = { ...rule, ...form };
    db.updateBulkRule(updated);
    navigate('/pricing');
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to remove this volume discount step?")) {
      db.deleteBulkRule(rule.id);
      navigate('/pricing');
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-32">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-10">
        <div className="flex justify-between items-start">
           <div className="flex items-center gap-5">
            <div className="size-16 rounded-[24px] bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-4xl font-bold">reorder</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Modify Volume Step</h2>
              <p className="text-sm text-gray-500 font-medium">{rule.id}</p>
            </div>
          </div>
          <button 
            onClick={handleDelete}
            className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>

        <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Minimum Units Required</label>
              <input 
                required
                type="number"
                className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                value={form.unitThreshold}
                onChange={(e) => setForm({ ...form, unitThreshold: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Stackable Discount (%)</label>
              <input 
                required
                type="number"
                className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                value={form.discountPercentage}
                onChange={(e) => setForm({ ...form, discountPercentage: parseInt(e.target.value) || 0 })}
              />
            </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-6 z-40 shadow-2xl">
        <div className="max-w-2xl mx-auto flex gap-4">
          <button type="button" onClick={() => navigate('/pricing')} className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all">Discard</button>
          <button type="button" onClick={handleUpdate} className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all flex items-center justify-center gap-3">
            Apply Updates
            <span className="material-symbols-outlined text-lg">save</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default BulkRuleDetails;
