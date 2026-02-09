
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Staff } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const StaffManagement: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/staff', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch staff');
        const data = await res.json();
        setStaff(data);
      } catch (err) {
        console.error('Failed to fetch staff:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Admin': return 'bg-slate-900 text-slate-100';
      case 'Warehouse Manager': return 'bg-blue-100 text-blue-700';
      case 'Sales Representative': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
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

  return (
    <div className="p-0 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Search and Header Section */}
      <div className="bg-white lg:bg-transparent p-4 lg:p-0 border-b lg:border-none border-gray-100 sticky top-16 lg:static z-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-800">{t('staff.title')}</h1>
            <p className="text-[10px] lg:text-sm text-gray-500 font-medium uppercase tracking-widest">{staff.length} {t('staff.activeAccounts')}</p>
          </div>
          <Link 
            to="/staff/add"
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined">person_add</span>
            {t('staff.newStaff')}
          </Link>
        </div>

        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl group-focus-within:text-primary transition-colors">search</span>
          <input 
            className="w-full pl-12 pr-4 py-4 bg-gray-50 lg:bg-white border border-gray-100 lg:border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
            placeholder={t('staff.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid: 1 column on mobile/tablet, 3 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-0 lg:gap-6 divide-y lg:divide-y-0 divide-gray-50 bg-white lg:bg-transparent">
        {filteredStaff.map(member => (
          <Link 
            key={member.id} 
            to={`/staff/${member.id}`}
            className="p-5 lg:p-6 bg-white lg:rounded-3xl lg:border lg:border-gray-100 shadow-none lg:shadow-sm hover:bg-gray-50 lg:hover:shadow-md transition-all group flex items-center lg:flex-col lg:items-stretch gap-4 lg:gap-0"
          >
            {/* Top Row: Avatar on left, Status/Role on right corner for Desktop */}
            <div className="shrink-0 lg:flex lg:justify-between lg:items-start lg:mb-6">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl overflow-hidden border border-primary/5">
                {member.name.charAt(0)}
              </div>
              <div className="hidden lg:flex flex-col items-end gap-1.5">
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {member.status}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${getRoleColor(member.role)}`}>
                  {member.role}
                </span>
              </div>
            </div>
            
            {/* Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center lg:block">
                <h3 className="text-base lg:text-lg font-black text-slate-800 leading-tight truncate">{member.name}</h3>
                <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${member.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 lg:mb-6">{member.role}</p>

              {/* Desktop-only Details */}
              <div className="hidden lg:block space-y-3">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl text-gray-600 border border-gray-100">
                  <span className="material-symbols-outlined text-sm opacity-40">mail</span>
                  <span className="text-[11px] font-bold truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl text-gray-600 border border-gray-100">
                  <span className="material-symbols-outlined text-sm opacity-40">call</span>
                  <span className="text-[11px] font-bold">{member.phone}</span>
                </div>
              </div>
            </div>

            <div className="lg:hidden shrink-0">
              <span className="material-symbols-outlined text-gray-300">chevron_right</span>
            </div>
          </Link>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">search_off</span>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{t('staff.noMatch')}</p>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
