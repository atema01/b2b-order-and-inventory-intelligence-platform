
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PricingRule, BulkDiscountRule, MarginDiscountRule } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const PricingManagement: React.FC = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [bulkRules, setBulkRules] = useState<BulkDiscountRule[]>([]);
  const [marginRules, setMarginRules] = useState<MarginDiscountRule[]>([]);
  const [activeTab, setActiveTab] = useState<'tiers' | 'bulk' | 'margin'>('tiers');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const loadPricing = async () => {
      setLoading(true);
      setError('');
      try {
        const [tiersRes, bulkRes, marginRes] = await Promise.all([
          fetch('/api/pricing/tiers', { credentials: 'include' }),
          fetch('/api/pricing/bulk', { credentials: 'include' }),
          fetch('/api/pricing/margin', { credentials: 'include' })
        ]);

        if (!tiersRes.ok || !bulkRes.ok || !marginRes.ok) {
          const errData = await tiersRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load pricing rules');
        }

        const [tiersData, bulkData, marginData] = await Promise.all([
          tiersRes.json(),
          bulkRes.json(),
          marginRes.json()
        ]);

        if (!isMounted) return;
        setRules(Array.isArray(tiersData) ? tiersData : []);
        setBulkRules(Array.isArray(bulkData) ? bulkData : []);
        setMarginRules(Array.isArray(marginData) ? marginData : []);
      } catch (err) {
        console.error('Load pricing rules error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPricing();

    return () => {
      isMounted = false;
    };
  }, []);

  const getTierIconColor = (name: string) => {
    switch(name) {
      case 'Platinum': return 'bg-slate-900 text-white';
      case 'Gold': return 'bg-amber-100 text-amber-600';
      case 'Silver': return 'bg-slate-100 text-slate-500';
      case 'Bronze': return 'bg-orange-50 text-orange-700';
      default: return 'bg-primary/10 text-primary';
    }
  };

  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNewRulePath = () => {
    if (activeTab === 'tiers') return "/pricing/add";
    if (activeTab === 'bulk') return "/pricing/bulk/add";
    if (activeTab === 'margin') return "/pricing/margin/add";
    return "/pricing/add";
  };

  const getNewRuleLabel = () => {
    if (activeTab === 'tiers') return t('pricing.newTier');
    if (activeTab === 'bulk') return t('pricing.newVolume');
    if (activeTab === 'margin') return t('pricing.newConstraint');
    return t('pricing.newTier');
  }

  return (
    <div className="p-0 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Header and Strategic Tabs */}
      <div className="bg-white lg:bg-transparent p-4 lg:p-0 border-b lg:border-none border-gray-100 sticky top-16 lg:static z-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">{t('pricing.title')}</h1>
            <p className="text-[10px] lg:text-sm text-gray-500 font-medium uppercase tracking-widest">{t('pricing.subtitle')}</p>
          </div>
          <Link 
            to={getNewRulePath()}
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            {getNewRuleLabel()}
          </Link>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 p-1.5 bg-gray-100 lg:bg-white border border-gray-200 lg:border-gray-100 rounded-[24px] mb-6">
          {[
            { id: 'tiers', label: t('pricing.tiers'), icon: 'stars' },
            { id: 'bulk', label: t('pricing.bulk'), icon: 'reorder' },
            { id: 'margin', label: t('pricing.margin'), icon: 'security' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] text-[10px] lg:text-xs font-black uppercase tracking-wider transition-all
                ${activeTab === tab.id 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                  : 'text-gray-400 hover:text-slate-600 hover:bg-gray-50'}
              `}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'tiers' && (
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl group-focus-within:text-primary transition-colors">search</span>
            <input 
              className="w-full pl-12 pr-4 py-4 bg-gray-50 lg:bg-white border border-gray-100 lg:border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading pricing rules...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load pricing rules</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tiers View */}
      {activeTab === 'tiers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-0 lg:gap-6 divide-y lg:divide-y-0 divide-gray-50 bg-white lg:bg-transparent">
          {filteredRules.map(rule => (
            <Link 
              key={rule.id} 
              to={`/pricing/${rule.id}`}
              className="p-5 lg:p-6 bg-white lg:rounded-3xl lg:border lg:border-gray-100 shadow-none lg:shadow-sm hover:bg-gray-50 lg:hover:shadow-md transition-all group flex items-center lg:flex-col lg:items-stretch gap-4 lg:gap-0"
            >
              <div className="shrink-0 lg:flex lg:justify-between lg:items-start lg:mb-6">
                <div className={`w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center font-black text-2xl overflow-hidden border border-black/5 ${getTierIconColor(rule.name)}`}>
                  {rule.name.charAt(0)}
                </div>
                <div className="hidden lg:flex flex-col items-end gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-700">
                    {rule.discountPercentage}% {t('buyers.off')}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center lg:block">
                  <h3 className="text-base lg:text-lg font-black text-slate-800 leading-tight truncate">{rule.name}</h3>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 lg:mb-4">{t('pricing.gifted')}</p>

                <div className="hidden lg:block space-y-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-gray-400">payments</span>
                    <span className="text-[10px] font-black text-slate-600 uppercase">ETB {rule.minSpend.toLocaleString()} {t('pricing.minSpend')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-gray-400">calendar_today</span>
                    <span className="text-[10px] font-black text-slate-600 uppercase">{rule.minYears}+ Years {t('pricing.tenure')}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Bulk View */}
      {activeTab === 'bulk' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden p-8">
           <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-slate-800">{t('pricing.bulkTitle')}</h2>
                <p className="text-sm text-gray-400 font-medium">{t('pricing.bulkDesc')}</p>
              </div>
              
              <div className="space-y-4">
                {bulkRules.map(br => (
                  <Link 
                    key={br.id} 
                    to={`/pricing/bulk/${br.id}`}
                    className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between group hover:bg-gray-100 transition-all"
                  >
                    <div className="flex items-center gap-6">
                       <div className="size-14 bg-white rounded-2xl flex items-center justify-center text-primary font-black text-lg border border-gray-100 shadow-sm">
                        {br.unitThreshold}
                       </div>
                       <div>
                          <p className="text-sm font-black text-slate-800">Minimum {br.unitThreshold} {t('prod.units')}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apply to any single item SKU</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="text-right">
                          <p className="text-xl font-black text-emerald-600">-{br.discountPercentage}%</p>
                          <p className="text-[8px] font-black text-gray-400 uppercase">Per Unit</p>
                       </div>
                       <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">edit</span>
                    </div>
                  </Link>
                ))}
              </div>
              
              <Link 
                to="/pricing/bulk/add"
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 font-black text-xs uppercase tracking-widest hover:border-primary hover:text-primary transition-all flex items-center justify-center"
              >
                + {t('pricing.newVolumeStep')}
              </Link>
           </div>
        </div>
      )}

      {/* Margin View */}
      {activeTab === 'margin' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden p-8 lg:p-12">
           <div className="max-w-3xl mx-auto space-y-12">
              <div className="flex items-start gap-6">
                <div className="size-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-4xl">security</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">{t('pricing.marginTitle')}</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {t('pricing.marginDesc')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {marginRules.map(mr => (
                  <Link 
                    key={mr.id} 
                    to={`/pricing/margin/${mr.id}`}
                    className="p-8 bg-slate-900 text-white rounded-[40px] shadow-2xl space-y-8 relative overflow-hidden group hover:scale-[1.02] transition-all"
                  >
                    <div className="absolute top-0 right-0 size-24 bg-primary/20 blur-3xl rounded-full"></div>
                    
                    <div className="space-y-6 relative z-10">
                      <div>
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">{t('pricing.trigger')}</p>
                        <p className="text-lg font-bold">Cost {'>'} ETB {mr.minUnitCost.toLocaleString()}</p>
                        <p className="text-lg font-bold">Margin {'>'}  {mr.minMarginPercentage}%</p>
                      </div>

                      <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-1">{t('pricing.incentive')}</p>
                          <p className="text-3xl font-black">{mr.bonusDiscount}% <span className="text-xs uppercase opacity-40">{t('pricing.bonus')}</span></p>
                        </div>
                        <div className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-all">
                          <span className="material-symbols-outlined">tune</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                <Link 
                  to="/pricing/margin/add"
                  className="h-full border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center p-8 text-gray-300 hover:text-primary hover:border-primary transition-all group"
                >
                   <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">add_moderator</span>
                   <p className="font-black text-xs uppercase tracking-widest">{t('pricing.addConstraint')}</p>
                </Link>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PricingManagement;
