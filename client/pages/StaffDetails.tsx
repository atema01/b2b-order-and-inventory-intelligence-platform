
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Staff, Role } from '../types';

const StaffDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Staff | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Staff>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password Reset State
  const [isResetPwdOpen, setIsResetPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [rolesRes, staffRes] = await Promise.all([
          fetch('/api/roles', { credentials: 'include' }),
          fetch(`/api/staff/${id}`, { credentials: 'include' })
        ]);
        if (!rolesRes.ok) throw new Error('Failed to fetch roles');
        if (!staffRes.ok) throw new Error('Failed to fetch staff member');
        const [rolesData, staffData] = await Promise.all([
          rolesRes.json(),
          staffRes.json()
        ]);
        setRoles(rolesData);
        setMember(staffData);
        setEditForm({
          ...staffData,
          roleId: staffData.roleId
        });
      } catch (err) {
        console.error('Fetch staff error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleUpdate = async () => {
    if (!member || !id) return;
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        roleId: (editForm as any).roleId,
        status: editForm.status || member.status
      };
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update staff');
      }
      const updated = await res.json();
      setMember(updated);
      setEditForm({
        ...updated,
        roleId: updated.roleId
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Update staff error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update staff');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (member && newPassword) {
      try {
        const res = await fetch(`/api/staff/${member.id}/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ newPassword })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to reset password');
        }
        setIsResetPwdOpen(false);
        setNewPassword('');
        alert("Password has been reset successfully.");
      } catch (err) {
        console.error('Reset staff password error:', err);
        alert(err instanceof Error ? err.message : 'Failed to reset password');
      }
    }
  };

  const handleToggleStatus = () => {
    if (!member) return;
    const newStatus: 'Active' | 'Inactive' = member.status === 'Active' ? 'Inactive' : 'Active';
    fetch(`/api/staff/${member.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => res.json())
      .then(updated => {
        setMember(updated);
        setEditForm(prev => ({ ...prev, status: newStatus }));
      })
      .catch(err => {
        console.error('Update status error:', err);
        alert('Failed to update status');
      });
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Admin': return 'bg-slate-900 text-white';
      case 'Warehouse Manager': return 'bg-blue-600 text-white';
      case 'Sales Representative': return 'bg-purple-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load staff</p>
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

  if (!member) return <div className="p-8">Staff member not found.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-40">
      {/* Profile Header */}
      <div className="bg-white rounded-[40px] p-8 lg:p-10 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full ${isEditing ? 'bg-amber-500' : 'bg-primary'}`}></div>
        
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center relative z-10">
          <div className="size-28 lg:size-32 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary text-5xl font-black shrink-0 shadow-inner border border-primary/5">
            {member.name.charAt(0)}
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight leading-tight">{member.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${getRoleColor(member.role)} shadow-lg shadow-black/5`}>
                    {member.role}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">• Staff ID: {member.id}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setIsResetPwdOpen(true)}
                  className="px-4 py-3 bg-white border border-gray-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                  title="Reset Password"
                >
                  <span className="material-symbols-outlined text-sm">lock_reset</span>
                  <span className="hidden sm:inline">Reset Pwd</span>
                </button>
                <button 
                  onClick={handleToggleStatus}
                  className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-sm active:scale-95
                    ${member.status === 'Active' 
                      ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white' 
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {member.status === 'Active' ? 'person_off' : 'person_check'}
                  </span>
                  {member.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-gray-50">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {member.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Primary Role</p>
                <p className="text-xl font-black text-slate-800">{member.role}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Login</p>
                <p className="text-sm font-black text-slate-400">Today, 09:42 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Info Stack */}
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-black">badge</span>
              <h2 className="text-lg font-black text-slate-800">Identity & Contact</h2>
            </div>

            {isEditing ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Full Name</label>
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Phone Number</label>
                    <input 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Work Email</label>
                    <input 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Assigned Role</label>
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner appearance-none"
                    value={(editForm as any).roleId || ''}
                    onChange={(e) => setEditForm({...editForm, roleId: e.target.value} as any)}
                  >
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-50">
                <div className="py-5 first:pt-0 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Legal Name</p>
                  <p className="font-bold text-slate-800 text-lg">{member.name}</p>
                </div>
                <div className="py-5 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Work Email</p>
                  <p className="font-bold text-slate-800 text-lg">{member.email}</p>
                </div>
                <div className="py-5 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mobile Phone</p>
                  <p className="font-bold text-slate-800 text-lg">{member.phone}</p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Permissions & Logs */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl shadow-slate-900/30">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-40 mb-6">Security Context</h3>
            <div className="space-y-6">
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary-light mb-2">Access Level</p>
                <p className="text-lg font-black">{member.role === 'Admin' ? 'Superuser' : 'Standard User'}</p>
              </div>
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary-light mb-2">Login Method</p>
                <p className="text-sm font-bold opacity-70">Company OAuth / Password</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Save Button */}
      {isEditing && (
        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-6 z-50 shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="max-w-5xl mx-auto flex gap-4">
            <button 
              onClick={() => setIsEditing(false)}
              className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95"
            >
              Discard Changes
            </button>
            <button 
              onClick={handleUpdate}
              className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              Update Member
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </button>
          </div>
        </footer>
      )}

      {/* Password Reset Modal */}
      {isResetPwdOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined font-black">lock_reset</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Reset Password</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin Action</p>
                </div>
              </div>

              <form onSubmit={handlePasswordReset}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">New Password</label>
                    <input 
                      type="password"
                      required
                      className="w-full bg-gray-50 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all shadow-inner"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => { setIsResetPwdOpen(false); setNewPassword(''); }}
                      className="flex-1 py-3.5 bg-gray-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-3.5 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-700 transition-all"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDetails;
