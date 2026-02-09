
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BulkDiscountRule } from '../types';

const BulkRuleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rule, setRule] = useState<BulkDiscountRule | null>(null);
  const [form, setForm] = useState({
    unitThreshold: 0,
    discountPercentage: 0
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
        const res = await fetch(`/api/pricing/bulk/${id}`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load bulk rule');
        }
        const data = await res.json();
        if (!isMounted) return;
        setRule(data);
        setForm({ unitThreshold: data.unitThreshold, discountPercentage: data.discountPercentage });
      } catch (err) {
        console.error('Load bulk rule error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load bulk rule');
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
          <p className="text-slate-600">Loading bulk rule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load bulk rule</p>
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

  if (!rule) return <div className="p-8 text-center text-gray-400">Rule not found.</div>;

  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/pricing/bulk/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unitThreshold: form.unitThreshold,
          discountPercentage: form.discountPercentage,
          isActive: rule.isActive
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update bulk rule');
      }

      navigate('/pricing');
    } catch (err) {
      console.error('Update bulk rule error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update bulk rule');
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to remove this volume discount step?")) {
      try {
        const response = await fetch(`/api/pricing/bulk/${rule.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete bulk rule');
        }

        navigate('/pricing');
      } catch (err) {
        console.error('Delete bulk rule error:', err);
        alert(err instanceof Error ? err.message : 'Failed to delete bulk rule');
      }
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
