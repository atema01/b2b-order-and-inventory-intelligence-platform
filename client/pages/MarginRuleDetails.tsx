
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MarginDiscountRule } from '../types';

const MarginRuleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rule, setRule] = useState<MarginDiscountRule | null>(null);
  const [form, setForm] = useState({
    minUnitCost: 0,
    minMarginPercentage: 0,
    bonusDiscount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadRule = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/pricing/margin/${id}`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load margin rule');
        }
        const data = await res.json();
        if (!isMounted) return;
        setRule(data);
        setForm({
          minUnitCost: data.minUnitCost,
          minMarginPercentage: data.minMarginPercentage,
          bonusDiscount: data.bonusDiscount
        });
      } catch (err) {
        console.error('Load margin rule error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load margin rule');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRule();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading margin rule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load margin rule</p>
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

  if (!rule) return <div className="p-8 text-center text-gray-400">Constraint not found.</div>;

  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/pricing/margin/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          minUnitCost: form.minUnitCost,
          minMarginPercentage: form.minMarginPercentage,
          bonusDiscount: form.bonusDiscount,
          isActive: rule.isActive
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update margin rule');
      }

      navigate('/pricing');
    } catch (err) {
      console.error('Update margin rule error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update margin rule');
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Delete this Profit Protection rule? Products meeting these criteria will no longer receive bonus discounts.")) {
      try {
        const response = await fetch(`/api/pricing/margin/${rule.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete margin rule');
        }

        navigate('/pricing');
      } catch (err) {
        console.error('Delete margin rule error:', err);
        alert(err instanceof Error ? err.message : 'Failed to delete margin rule');
      }
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-32">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-10">
        <div className="flex justify-between items-start">
           <div className="flex items-center gap-5">
            <div className="size-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-4xl font-bold">security</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Modify Constraint</h2>
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
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Minimum Margin (%)</label>
              <input 
                required
                type="number"
                className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                value={form.minMarginPercentage}
                onChange={(e) => setForm({ ...form, minMarginPercentage: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="pt-6 border-t border-gray-50">
              <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1">Bonus Discount (%)</label>
              <input 
                required
                type="number"
                className="w-full bg-emerald-50 border-transparent rounded-2xl px-5 py-4 font-black text-emerald-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                value={form.bonusDiscount}
                onChange={(e) => setForm({ ...form, bonusDiscount: parseInt(e.target.value) || 0 })}
              />
            </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-6 z-40 shadow-2xl">
        <div className="max-w-2xl mx-auto flex gap-4">
          <button type="button" onClick={() => navigate('/pricing')} className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all">Discard</button>
          <button type="button" onClick={handleUpdate} className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all flex items-center justify-center gap-3">
            Save Rule Updates
            <span className="material-symbols-outlined text-lg">save</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default MarginRuleDetails;
