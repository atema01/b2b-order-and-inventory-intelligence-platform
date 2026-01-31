
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Role } from '../types';

const AddRole: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    accessLevel: 'Staff',
    description: '',
    permissions: {
      'Orders': false,
      'Products': false,
      'Returns': false,
      'Buyers': false,
      'Payments': false,
      'Credits': false,
      'Pricing': false,
      'Staff': false,
      'Roles': false,
      'Reports': false,
      'Logs': false,
      'Settings': false
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    setTimeout(() => {
      const newRole: Role = {
        id: `R-${Date.now().toString().slice(-4)}`,
        name: form.name,
        description: form.description,
        memberCount: 0,
        accessLevel: form.accessLevel,
        permissions: form.permissions
      };

      db.createRole(newRole);
      navigate('/roles');
    }, 600);
  };

  const togglePermission = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key as keyof typeof prev.permissions]
      }
    }));
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">security</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">New Role Profile</h2>
            <p className="text-sm text-gray-500 font-medium">Define a new set of system capabilities.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Role Identity */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">badge</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Role Identity</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Internal Name</label>
                <input 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sales Coordinator"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Access Tier</label>
                <div className="relative">
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all appearance-none shadow-inner"
                    value={form.accessLevel}
                    onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}
                  >
                    <option>Staff</option>
                    <option>Manager</option>
                    <option>Owner</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Profile Description</label>
                <textarea 
                  required
                  rows={2}
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner leading-relaxed"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Operational responsibilities for this role..."
                />
              </div>
            </div>
          </div>

          {/* Module Access Grid */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">rule</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Access Grid</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(form.permissions).map((key) => {
                const isSelected = form.permissions[key as keyof typeof form.permissions];
                return (
                  <button 
                    key={key}
                    type="button"
                    onClick={() => togglePermission(key)}
                    className={`
                      p-5 rounded-[24px] border-2 text-left transition-all
                      ${isSelected 
                        ? 'bg-primary/5 border-primary text-primary shadow-lg shadow-primary/5' 
                        : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200'}
                    `}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-black uppercase text-[10px] tracking-widest">{key}</p>
                      <span className={`material-symbols-outlined text-base ${isSelected ? 'text-primary' : 'text-gray-200'}`}>
                        {isSelected ? 'check_circle' : 'circle'}
                      </span>
                    </div>
                    <p className="text-[9px] font-medium leading-none opacity-60">Full module access</p>
                  </button>
                )}
              )}
            </div>
          </div>

          {/* Form Actions at end of page */}
          <div className="flex flex-col md:flex-row gap-4 pt-10 border-t border-gray-50">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate('/roles')}
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
                  Finalize Role Profile
                  <span className="material-symbols-outlined text-lg">security</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRole;
