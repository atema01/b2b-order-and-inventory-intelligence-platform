
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PricingRule } from '../types';

const PricingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rule, setRule] = useState<PricingRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PricingRule>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadRule = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/pricing/tiers/${id}`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load pricing rule');
        }
        const data = await res.json();
        if (!isMounted) return;
        setRule(data);
        setEditForm(data);
      } catch (err) {
        console.error('Load pricing rule error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load pricing rule');
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
          <p className="text-slate-600">Loading pricing rule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load pricing rule</p>
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

  if (!rule) return <div className="p-8 text-center font-bold text-gray-400">Rule not found.</div>;

  const handleUpdate = async () => {
    if (!rule) return;
    try {
      const payload = {
        name: rule.name,
        description: rule.description || '',
        discountPercentage: editForm.discountPercentage,
        minSpend: editForm.minSpend,
        minYears: editForm.minYears,
        status: rule.status
      };
      const res = await fetch(`/api/pricing/tiers/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update pricing rule');
      }
      const updated = await res.json();
      setRule(updated);
      setEditForm(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Update pricing rule error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update pricing rule');
    }
  };

  const getTierColor = (name: string) => {
    switch(name) {
      case 'Platinum': return 'bg-slate-900 text-white';
      case 'Gold': return 'bg-amber-500 text-white';
      case 'Silver': return 'bg-slate-400 text-white';
      case 'Bronze': return 'bg-orange-600 text-white';
      default: return 'bg-primary text-white';
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-40">
      {/* Tier Header */}
      <div className="bg-white rounded-[40px] p-8 lg:p-10 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full ${isEditing ? 'bg-amber-500' : 'bg-primary'}`}></div>
        
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center relative z-10">
          <div className={`size-28 lg:size-32 rounded-[32px] flex items-center justify-center text-5xl font-black shrink-0 shadow-inner border border-black/5 ${getTierColor(rule.name)}`}>
            {rule.name.charAt(0)}
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight leading-tight">{rule.name} Tier</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
                    {rule.discountPercentage}% Baseline Discount
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}
                >
                  {isEditing ? 'Cancel Edit' : 'Modify Tier Requirements'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-gray-50">
               <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Required Tenure</p>
                <p className="text-xl font-black text-slate-800">{rule.minYears} Years</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Required Spend</p>
                <p className="text-xl font-black text-slate-800">ETB {rule.minSpend.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Partners</p>
                <p className="text-xl font-black text-primary">{rule.memberCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-black">loyalty</span>
              <h2 className="text-lg font-black text-slate-800">Gifting Requirements</h2>
            </div>

            {isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Tenure (Years Required)</label>
                    <input 
                      type="number"
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                      value={editForm.minYears}
                      onChange={(e) => setEditForm({...editForm, minYears: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Min Lifetime Spend (ETB)</label>
                    <input 
                      type="number"
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                      value={editForm.minSpend}
                      onChange={(e) => setEditForm({...editForm, minSpend: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Base Discount (%)</label>
                  <input 
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.discountPercentage}
                    onChange={(e) => setEditForm({...editForm, discountPercentage: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-50">
                <div className="py-5 first:pt-0 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Promotion Logic</p>
                  <p className="font-bold text-slate-800 text-lg">System gifts this tier when lifetime spend exceeds <span className="text-primary">ETB {rule.minSpend.toLocaleString()}</span> and tenure is at least <span className="text-primary">{rule.minYears} years</span>.</p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl shadow-slate-900/30">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-40 mb-6">Financial Strategy</h3>
            <div className="space-y-6">
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-2">Benefit Yield</p>
                <p className="text-2xl font-black">{rule.discountPercentage}% Off</p>
              </div>
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary-light mb-2">Status</p>
                <p className="text-sm font-bold opacity-70 uppercase">Automatic Promotion</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isEditing && (
        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-6 z-50 shadow-2xl">
          <div className="max-w-5xl mx-auto flex gap-4">
            <button onClick={() => setIsEditing(false)} className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all">Discard</button>
            <button onClick={handleUpdate} className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all flex items-center justify-center gap-3">
              Update Strategy
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default PricingDetails;
