
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Role } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const ManageRoles: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    setRoles(db.getAllRoles());
  }, []);

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'Owner': return 'bg-slate-900 text-slate-100';
      case 'Manager': return 'bg-blue-100 text-blue-700';
      case 'Staff': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.accessLevel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-0 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Search and Header Section */}
      <div className="bg-white lg:bg-transparent p-4 lg:p-0 border-b lg:border-none border-gray-100 sticky top-16 lg:static z-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-800">{t('roles.title')}</h1>
            <p className="text-[10px] lg:text-sm text-gray-500 font-medium uppercase tracking-widest">{roles.length} {t('roles.profiles')}</p>
          </div>
          <Link 
            to="/roles/add"
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined">security</span>
            {t('roles.new')}
          </Link>
        </div>

        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl group-focus-within:text-primary transition-colors">search</span>
          <input 
            className="w-full pl-12 pr-4 py-4 bg-gray-50 lg:bg-white border border-gray-100 lg:border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
            placeholder={t('roles.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid: 1 column on mobile/tablet, 3 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-0 lg:gap-6 divide-y lg:divide-y-0 divide-gray-50 bg-white lg:bg-transparent">
        {filteredRoles.map(role => (
          <Link 
            key={role.id} 
            to={`/roles/${role.id}`}
            className="p-5 lg:p-6 bg-white lg:rounded-3xl lg:border lg:border-gray-100 shadow-none lg:shadow-sm hover:bg-gray-50 lg:hover:shadow-md transition-all group flex items-center lg:flex-col lg:items-stretch gap-4 lg:gap-0"
          >
            {/* Top Row: Icon on left, Access Level/Members on right corner for Desktop */}
            <div className="shrink-0 lg:flex lg:justify-between lg:items-start lg:mb-6">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl overflow-hidden border border-primary/5">
                <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
              </div>
              <div className="hidden lg:flex flex-col items-end gap-1.5">
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${getLevelColor(role.accessLevel)}`}>
                  {role.accessLevel}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter bg-gray-100 text-gray-600 border border-gray-200">
                  {role.memberCount} {t('roles.members')}
                </span>
              </div>
            </div>
            
            {/* Role Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center lg:block">
                <h3 className="text-base lg:text-lg font-black text-slate-800 leading-tight truncate">{role.name}</h3>
                <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${getLevelColor(role.accessLevel)}`}>
                    {role.accessLevel}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 lg:mb-6">{role.id}</p>

              {/* Desktop-only Details */}
              <div className="hidden lg:block space-y-3">
                <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2">
                  {role.description}
                </p>
                
                <div className="pt-3 flex flex-wrap gap-1.5 border-t border-gray-50">
                  {Object.entries(role.permissions).slice(0, 3).map(([perm, enabled]) => (
                    enabled && (
                      <span key={perm} className="text-[8px] font-black uppercase tracking-tighter bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100">
                        {perm}
                      </span>
                    )
                  ))}
                  {Object.values(role.permissions).filter(v => v).length > 3 && (
                    <span className="text-[8px] font-black uppercase tracking-tighter text-primary px-1.5 py-0.5">
                      +{Object.values(role.permissions).filter(v => v).length - 3} {t('roles.more')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:hidden shrink-0">
              <span className="material-symbols-outlined text-gray-300">chevron_right</span>
            </div>
          </Link>
        ))}
      </div>

      {filteredRoles.length === 0 && (
        <div className="py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">policy</span>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{t('roles.noMatch')}</p>
        </div>
      )}
    </div>
  );
};

export default ManageRoles;
