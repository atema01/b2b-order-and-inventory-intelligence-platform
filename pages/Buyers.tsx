
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const Buyers: React.FC = () => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    setBuyers(db.getAllBuyers());
  }, []);

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'Platinum': return 'bg-slate-900 text-slate-100';
      case 'Gold': return 'bg-amber-100 text-amber-700';
      case 'Silver': return 'bg-gray-100 text-gray-700';
      default: return 'bg-orange-50 text-orange-700';
    }
  };

  const filteredBuyers = buyers.filter(b => 
    b.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-0 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Search and Header Section */}
      <div className="bg-white lg:bg-transparent p-4 lg:p-0 border-b lg:border-none border-gray-100 sticky top-16 lg:static z-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-800">{t('buyers.title')}</h1>
            <p className="text-[10px] lg:text-sm text-gray-500 font-medium uppercase tracking-widest">{buyers.length} {t('buyers.subtitle')}</p>
          </div>
          <Link 
            to="/buyers/add"
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined">person_add</span>
            {t('buyers.newBuyer')}
          </Link>
        </div>

        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl group-focus-within:text-primary transition-colors">search</span>
          <input 
            className="w-full pl-12 pr-4 py-4 bg-gray-50 lg:bg-white border border-gray-100 lg:border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
            placeholder={t('buyers.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid: 1 column on mobile/tablet, 3 columns on desktop (lg), 4 on 2xl */}
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-0 lg:gap-6 divide-y lg:divide-y-0 divide-gray-50 bg-white lg:bg-transparent">
        {filteredBuyers.map(buyer => (
          <Link 
            key={buyer.id} 
            to={`/buyers/${buyer.id}`}
            className="p-5 lg:p-6 bg-white lg:rounded-3xl lg:border lg:border-gray-100 shadow-none lg:shadow-sm hover:bg-gray-50 lg:hover:shadow-md transition-all group flex items-center lg:flex-col lg:items-stretch gap-4 lg:gap-0"
          >
            {/* Top Row: Avatar on left, Status/Tier on right corner for Desktop */}
            <div className="shrink-0 lg:flex lg:justify-between lg:items-start lg:mb-6">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl overflow-hidden border border-primary/5">
                {buyer.avatar ? (
                  <img src={buyer.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  buyer.companyName.charAt(0)
                )}
              </div>
              <div className="hidden lg:flex flex-col items-end gap-1.5">
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${buyer.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {buyer.status}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${getTierColor(buyer.tier)}`}>
                  {buyer.tier}
                </span>
              </div>
            </div>
            
            {/* Name/Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center lg:block">
                <h3 className="text-base lg:text-lg font-black text-slate-800 leading-tight truncate">{buyer.companyName}</h3>
                {/* Mobile status indicator */}
                <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${buyer.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${getTierColor(buyer.tier)}`}>
                    {buyer.tier}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 lg:mb-6">{buyer.contactPerson}</p>

              {/* Desktop-only Details */}
              <div className="hidden lg:block space-y-4">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>{t('buyers.creditUsage')}</span>
                    <span className="text-slate-700">{Math.round((buyer.availableCredit / buyer.creditLimit) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-700" 
                      style={{ width: `${(buyer.availableCredit / buyer.creditLimit) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 border border-gray-50 rounded-xl bg-white/50">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">{t('nav.orders')}</p>
                    <p className="font-black text-slate-800 text-sm">{buyer.totalOrders}</p>
                  </div>
                  <div className="p-2 border border-gray-50 rounded-xl bg-white/50">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">{t('buyers.perk')}</p>
                    <p className="font-black text-emerald-600 text-sm">{(buyer.discountRate * 100)}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:hidden shrink-0">
              <span className="material-symbols-outlined text-gray-300">chevron_right</span>
            </div>
          </Link>
        ))}
      </div>

      {filteredBuyers.length === 0 && (
        <div className="py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">search_off</span>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{t('buyers.noMatch')}</p>
        </div>
      )}
    </div>
  );
};

export default Buyers;
