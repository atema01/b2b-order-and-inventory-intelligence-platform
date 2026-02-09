
import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const AccountType: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-primary/5 rounded-b-[100px] -z-0"></div>
      
      <div className="w-full max-w-4xl relative z-10">
        <div className="text-center mb-12 space-y-3">
          <div className="size-20 bg-primary rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-primary/30">
            <span className="material-symbols-outlined text-white text-5xl">inventory_2</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{t('auth.welcome')}</h1>
          <p className="text-slate-500 font-medium text-lg">{t('auth.selectType')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Buyer Option */}
          <Link 
            to="/login/buyer"
            className="group relative bg-white rounded-[40px] p-8 lg:p-10 border-2 border-transparent hover:border-[#12B3D8] shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-[#12B3D8]/20 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#12B3D8]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="size-24 rounded-full bg-[#E0F7FA] text-[#00A3C4] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-5xl">storefront</span>
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-[#00A3C4] transition-colors">{t('auth.buyer')}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              {t('auth.buyerDesc')}
            </p>
            
            <span className="mt-auto px-8 py-3 rounded-2xl bg-[#12B3D8] text-white font-black text-sm uppercase tracking-widest group-hover:bg-[#0092B0] transition-colors">
              {t('auth.buyerLogin')}
            </span>
          </Link>

          {/* Seller Option */}
          <Link 
            to="/login/seller"
            className="group relative bg-white rounded-[40px] p-8 lg:p-10 border-2 border-transparent hover:border-primary shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="size-24 rounded-full bg-blue-50 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-5xl">admin_panel_settings</span>
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-primary transition-colors">{t('auth.seller')}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              {t('auth.sellerDesc')}
            </p>
            
            <span className="mt-auto px-8 py-3 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest group-hover:bg-primary-hover transition-colors">
              {t('auth.staffLogin')}
            </span>
          </Link>
        </div>

        <p className="text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-12">
          {t('auth.secure')} • v1.2.0
        </p>
      </div>
    </div>
  );
};

export default AccountType;
