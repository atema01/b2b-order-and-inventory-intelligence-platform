
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '../types';

const AddStaff: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    roleId: '',
    password: ''
  });

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/roles', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch roles');
        const data = await res.json();
        setRoles(data);
        if (data.length > 0) {
          setForm(prev => ({ ...prev, roleId: data[0].id }));
        }
      } catch (err) {
        console.error('Failed to fetch roles:', err);
        setError(err instanceof Error ? err.message : 'Failed to load roles');
      }
    };

    fetchRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          phone: form.phone,
          role_id: form.roleId
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create staff');
      }

      navigate('/staff');
    } catch (err) {
      console.error('Create staff error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">person_add</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Invite Team Member</h2>
            <p className="text-sm text-gray-500 font-medium">Create access for a new staff member.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}
          {/* Identity Section */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">badge</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Personal Identity</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Full Legal Name</label>
                <input 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Abebe Kebede"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Work Email</label>
                  <input 
                    required
                    type="email"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@b2bintel.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Phone Number</label>
                  <input 
                    required
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+251 911 ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Access Password</label>
                <input 
                  required
                  type="password"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Set initial password..."
                />
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">admin_panel_settings</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Operational Role</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {(roles.length > 0 ? roles : [{ id: 'R1', name: 'Inventory Specialist', description: 'Warehouse operations access' }]).map(r => (
                <button 
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, roleId: r.id })}
                  className={`
                    p-5 rounded-[24px] border-2 text-left transition-all
                    ${form.roleId === r.id 
                      ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.01]' 
                      : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}
                  `}
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className={`font-black uppercase text-[11px] tracking-wider ${form.roleId === r.id ? 'text-white' : 'text-primary'}`}>{r.name}</p>
                    {form.roleId === r.id && <span className="material-symbols-outlined text-white text-sm">check_circle</span>}
                  </div>
                  <p className={`text-[10px] font-medium leading-relaxed ${form.roleId === r.id ? 'text-white/70' : 'text-gray-400'}`}>
                    {r.description || 'Assigned system permissions for this role.'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons at end of form */}
          <div className="flex flex-col md:flex-row gap-4 pt-10">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate('/staff')}
              className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
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
                  Confirm Registration
                  <span className="material-symbols-outlined text-lg">how_to_reg</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStaff;
