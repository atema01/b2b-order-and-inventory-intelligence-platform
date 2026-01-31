
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Buyer, BuyerTier } from '../types';
import { hashPassword } from '../utils/auth';

const AddBuyer: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    creditLimit: 500000,
    paymentTerms: 'Net 30',
    tier: 'Bronze' as BuyerTier,
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const hashedPassword = await hashPassword(form.password);

    setTimeout(() => {
      let discountRate = 0;
      if (form.tier === 'Silver') discountRate = 0.05;
      if (form.tier === 'Gold') discountRate = 0.10;
      if (form.tier === 'Platinum') discountRate = 0.15;

      // Automatic ID Generation: B-0001
      const allBuyers = db.getAllBuyers();
      let nextIdNum = 1;
      if (allBuyers.length > 0) {
         const maxId = allBuyers.reduce((max, b) => {
             const numPart = parseInt(b.id.split('-')[1]);
             return !isNaN(numPart) && numPart > max ? numPart : max;
         }, 0);
         nextIdNum = maxId + 1;
      }
      
      const newId = `B-${nextIdNum.toString().padStart(4, '0')}`;

      const newBuyer: Buyer = {
        id: newId,
        companyName: form.companyName,
        contactPerson: form.contactPerson,
        email: form.email,
        phone: form.phone,
        address: form.address,
        creditLimit: form.creditLimit,
        availableCredit: form.creditLimit,
        outstandingBalance: 0,
        paymentTerms: form.paymentTerms,
        totalSpend: 0,
        totalOrders: 0,
        status: 'Active',
        tier: form.tier,
        discountRate: discountRate,
        joinDate: new Date().toISOString().split('T')[0],
        password: hashedPassword
      };

      db.createBuyer(newBuyer);
      navigate('/buyers');
    }, 600);
  };

  return (
    <div className="bg-gray-50 min-h-full pb-20">
      <div className="max-w-3xl mx-auto p-6 lg:p-12 space-y-10">
        
        {/* Page Header */}
        <div className="text-center space-y-2">
          <div className="size-16 rounded-[24px] bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/20 mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl">person_add</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Register Wholesale Partner</h1>
          <p className="text-slate-500 font-medium">Create a new distribution account and set financial credit limits.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Business Identity */}
          <div className="bg-white rounded-[32px] p-8 lg:p-10 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-bold">corporate_fare</span>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">Business Identity</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Company Legal Name</label>
                <input 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="Official registered name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Point of Contact</label>
                <input 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Direct Phone</label>
                <input 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+251 ..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Email Address</label>
                <input 
                  required
                  type="email"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Account Password</label>
                <input 
                  required
                  type="password"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Initial login password"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Financial Terms */}
          <div className="bg-white rounded-[32px] p-8 lg:p-10 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-bold">account_balance_wallet</span>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">Account & Credit</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Credit Limit (ETB)</label>
                <input 
                  type="number"
                  step="10000"
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-black text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Payment Policy</label>
                <div className="relative">
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all appearance-none shadow-inner"
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  >
                    <option>Net 15</option>
                    <option>Net 30</option>
                    <option>Net 60</option>
                    <option>COD</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="md:col-span-2 space-y-5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Strategic Membership Tier</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(['Bronze', 'Silver', 'Gold', 'Platinum'] as BuyerTier[]).map(t => (
                    <button 
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tier: t })}
                      className={`
                        p-5 rounded-[24px] text-center border-2 transition-all flex flex-col items-center gap-1
                        ${form.tier === t 
                          ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
                          : 'bg-white border-gray-100 text-slate-400 hover:border-gray-200'}
                      `}
                    >
                      <p className={`text-[9px] font-black uppercase tracking-widest ${form.tier === t ? 'text-white/70' : 'text-gray-300'}`}>{t}</p>
                      <p className="text-base font-black">{t === 'Bronze' ? '0%' : t === 'Silver' ? '5%' : t === 'Gold' ? '10%' : '15%'} OFF</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Logistics */}
          <div className="bg-white rounded-[32px] p-8 lg:p-10 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-bold">local_shipping</span>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">Distribution Address</h3>
            </div>
            <div className="space-y-2">
              <textarea 
                rows={3}
                required
                className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner leading-relaxed"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Primary warehouse or terminal delivery address..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col md:flex-row gap-4 pt-10">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate('/buyers')}
              className="flex-1 py-6 bg-white border-2 border-gray-100 text-slate-500 rounded-[28px] font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 shadow-sm disabled:opacity-50"
            >
              Discard Changes
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-6 bg-primary text-white rounded-[28px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-80"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.5s]"></div>
                </div>
              ) : (
                <>
                  Complete Registration
                  <span className="material-symbols-outlined text-lg">how_to_reg</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-10">
           <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">B2B Intel Ecosystem • Onboarding Terminal</p>
        </div>
      </div>
    </div>
  );
};

export default AddBuyer;
