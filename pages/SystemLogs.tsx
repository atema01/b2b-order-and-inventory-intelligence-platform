
import React, { useState, useEffect } from 'react';
import { db } from '../services/databaseService';
import { SystemLog } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModule, setActiveModule] = useState('All');
  const { t } = useLanguage();

  useEffect(() => {
    const allLogs = db.getAllSystemLogs();
    setLogs(allLogs);
    setFilteredLogs(allLogs);
  }, []);

  useEffect(() => {
    let result = logs;
    
    // Filter by Module
    if (activeModule !== 'All') {
      result = result.filter(log => log.module === activeModule);
    }

    // Filter by Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(log => 
        log.action.toLowerCase().includes(q) || 
        log.details.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q)
      );
    }

    setFilteredLogs(result);
  }, [searchQuery, activeModule, logs]);

  const getModuleColor = (module: string) => {
    switch(module) {
      case 'Orders': return 'bg-amber-100 text-amber-700';
      case 'Inventory': return 'bg-blue-100 text-blue-700';
      case 'Finance': return 'bg-emerald-100 text-emerald-700';
      case 'Users': return 'bg-purple-100 text-purple-700';
      case 'Settings': return 'bg-gray-100 text-gray-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getActorIcon = (type: SystemLog['actorType']) => {
    switch(type) {
        case 'Buyer': return 'storefront';
        case 'Admin': return 'admin_panel_settings';
        case 'Staff': return 'badge';
        case 'System': return 'smart_toy';
        default: return 'person';
    }
  };

  const filters = [
    { id: 'All', label: t('log.module.all') },
    { id: 'Orders', label: t('log.module.orders') },
    { id: 'Inventory', label: t('log.module.inventory') },
    { id: 'Finance', label: t('log.module.finance') },
    { id: 'Users', label: t('log.module.users') },
    { id: 'Settings', label: t('log.module.settings') }
  ];

  return (
    <div className="p-0 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Header and Controls */}
      <div className="bg-white lg:bg-transparent p-4 lg:p-0 border-b lg:border-none border-gray-100 sticky top-16 lg:static z-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">{t('logs.title')}</h1>
            <p className="text-[10px] lg:text-sm text-gray-500 font-medium uppercase tracking-widest">{logs.length} {t('logs.eventsRecorded')}</p>
          </div>
          
          <button 
            onClick={() => {
                // In a real app this would re-fetch from API
                const updated = db.getAllSystemLogs();
                setLogs(updated);
            }}
            className="p-2 text-slate-400 hover:text-primary transition-colors"
            title={t('logs.refresh')}
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl group-focus-within:text-primary transition-colors">search</span>
                <input 
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 lg:bg-white border border-gray-100 lg:border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all text-sm"
                    placeholder={t('logs.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
                {filters.map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setActiveModule(filter.id)}
                        className={`
                            px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all
                            ${activeModule === filter.id 
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                : 'bg-white border-gray-100 text-slate-500 hover:bg-gray-50'}
                        `}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Log List */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
                <span className="material-symbols-outlined text-5xl mb-2 opacity-20">history_edu</span>
                <p className="text-xs font-bold uppercase tracking-widest">{t('logs.noLogs')}</p>
            </div>
        ) : (
            <div className="divide-y divide-gray-50">
                {filteredLogs.map(log => (
                    <div key={log.id} className="p-5 hover:bg-gray-50/80 transition-colors flex flex-col md:flex-row gap-4 items-start">
                        <div className="flex items-center gap-3 w-full md:w-48 shrink-0">
                            <div className="size-10 rounded-xl bg-gray-100 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined text-lg">{getActorIcon(log.actorType)}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 truncate">{log.actorName}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{log.actorType}</p>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${getModuleColor(log.module)}`}>
                                    {log.module}
                                </span>
                                <h3 className="text-sm font-bold text-slate-800">{log.action}</h3>
                            </div>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed">{log.details}</p>
                        </div>

                        <div className="w-full md:w-auto text-right shrink-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{log.timestamp}</p>
                            <p className="text-[9px] font-bold text-gray-300 mt-0.5">ID: {log.id}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;
