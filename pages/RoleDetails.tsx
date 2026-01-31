
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Role } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const RoleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [role, setRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Role>>({});

  useEffect(() => {
    if (id) {
      const allRoles = db.getAllRoles();
      const r = allRoles.find(x => x.id === id);
      if (r) {
        setRole(r);
        setEditForm(r);
      }
    }
  }, [id]);

  if (!role) return <div className="p-8">Role not found.</div>;

  const handleUpdate = () => {
    if (role) {
      const updatedRole = { ...role, ...editForm } as Role;
      db.updateRole(updatedRole);
      setRole(updatedRole);
      setIsEditing(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'Owner': return 'bg-slate-900 text-slate-100';
      case 'Manager': return 'bg-blue-100 text-blue-700';
      case 'Staff': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const togglePermission = (key: string) => {
    if (!editForm.permissions) return;
    setEditForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions!,
        [key]: !prev.permissions![key]
      }
    }));
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-40">
      {/* Header */}
      <div className="bg-white rounded-[40px] p-8 lg:p-10 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full ${isEditing ? 'bg-amber-500' : 'bg-primary'}`}></div>
        
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center relative z-10">
          <div className="size-28 lg:size-32 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary text-5xl font-black shrink-0 shadow-inner border border-primary/5">
            <span className="material-symbols-outlined text-5xl">security</span>
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight leading-tight">{role.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${getLevelColor(role.accessLevel)} shadow-lg shadow-black/5`}>
                    {role.accessLevel} Level
                  </span>
                  <span className="text-xs text-gray-400 font-bold">• ID: {role.id}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => {
                    setIsEditing(!isEditing);
                    if (!isEditing) setEditForm(role);
                  }}
                  className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-gray-50">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('roles.members')}</p>
                <p className="text-xl font-black text-slate-800">{role.memberCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('roles.activeModules')}</p>
                <p className="text-xl font-black text-slate-800">{Object.values(role.permissions).filter(Boolean).length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-black">badge</span>
              <h2 className="text-lg font-black text-slate-800">Role Identity</h2>
            </div>

            {isEditing ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Role Name</label>
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Description</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner leading-relaxed"
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Access Level</label>
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner appearance-none"
                    value={editForm.accessLevel}
                    onChange={(e) => setEditForm({...editForm, accessLevel: e.target.value})}
                  >
                    <option>Staff</option>
                    <option>Manager</option>
                    <option>Owner</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-50">
                <div className="py-5 first:pt-0 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</p>
                  <p className="font-bold text-slate-800 text-lg">{role.name}</p>
                </div>
                <div className="py-5 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</p>
                  <p className="font-bold text-slate-800 text-lg">{role.description}</p>
                </div>
              </div>
            )}
          </section>

          {/* Permissions Grid */}
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-black">rule</span>
              <h2 className="text-lg font-black text-slate-800">Permissions & Access</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(isEditing ? (editForm.permissions || {}) : role.permissions).map(([perm, enabled]) => (
                <button 
                  key={perm}
                  disabled={!isEditing}
                  onClick={() => togglePermission(perm)}
                  className={`
                    p-4 rounded-2xl border-2 text-left transition-all flex justify-between items-center
                    ${enabled 
                      ? 'bg-primary/5 border-primary text-primary shadow-sm' 
                      : 'bg-white border-gray-100 text-gray-400'}
                    ${isEditing ? 'hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}
                  `}
                >
                  <span className="font-bold text-xs uppercase tracking-wider">{perm}</span>
                  {enabled && <span className="material-symbols-outlined text-sm">check_circle</span>}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl shadow-slate-900/30">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-40 mb-6">Security Context</h3>
            <div className="space-y-6">
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary-light mb-2">{t('roles.globalScope')}</p>
                <p className="text-lg font-black">{role.accessLevel === 'Owner' ? t('roles.systemWide') : t('roles.restricted')}</p>
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
              {t('common.discardChanges')}
            </button>
            <button 
              onClick={handleUpdate}
              className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {t('common.saveUpdates')}
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default RoleDetails;
