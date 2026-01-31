
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/databaseService';
import { ReturnLog } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';

const ReturnsManagement: React.FC = () => {
  const [logs, setLogs] = useState<ReturnLog[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    setLogs(db.getAllReturnLogs());
  }, []);

  const COLORS = ['#005A9C', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

  // Pattern Analysis Data
  const reasonData = logs.reduce((acc: any[], log) => {
    const existing = acc.find(i => i.name === log.reason);
    if (existing) existing.value++;
    else acc.push({ name: log.reason, value: 1 });
    return acc;
  }, []);

  // Supplier pattern detection
  const supplierRisk = logs.reduce((acc: any, log) => {
    if (!acc[log.brand]) acc[log.brand] = { name: log.brand, returns: 0, damages: 0, totalValue: 0 };
    if (log.type === 'Return') acc[log.brand].returns += log.quantity;
    if (log.type === 'Damage') acc[log.brand].damages += log.quantity;
    acc[log.brand].totalValue += log.lossValue;
    return acc;
  }, {});

  const topRiskSuppliers = Object.values(supplierRisk)
    .sort((a: any, b: any) => (b.returns + b.damages) - (a.returns + a.damages))
    .slice(0, 3);

  const totalLoss = logs.reduce((acc, log) => acc + log.lossValue, 0);

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('returns.financialImpact')}</p>
          <h3 className="text-3xl font-black text-red-500">ETB {totalLoss.toLocaleString()}</h3>
          <p className="text-xs font-bold text-gray-400 mt-2">{t('returns.financialImpactDesc')}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('returns.operationalPulse')}</p>
          <h3 className="text-3xl font-black text-slate-800">{logs.length} <span className="text-sm">Logs</span></h3>
          <p className="text-xs font-bold text-gray-400 mt-2">{t('returns.operationalPulseDesc')}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('returns.recoveryRate')}</p>
          <h3 className="text-3xl font-black text-emerald-500">
            {Math.round((logs.filter(l => l.action === 'Restocked').length / logs.length) * 100 || 0)}%
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-2">{t('returns.recoveryRateDesc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Analytics Section */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="size-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl">
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <h2 className="text-xl font-black text-slate-800">{t('returns.reasonDistribution')}</h2>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {reasonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={4} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('returns.recentLog')}</h3>
              <Link to="/returns/log" className="text-[10px] font-black text-primary uppercase tracking-widest bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95">
                + {t('returns.addLog')}
              </Link>
            </div>
            <div className="divide-y divide-gray-50 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/30 text-[9px] font-black uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-4">{t('common.item')}</th>
                    <th className="px-6 py-4">{t('common.type')}</th>
                    <th className="px-6 py-4">{t('common.quantity')}</th>
                    <th className="px-6 py-4">{t('common.reason')}</th>
                    <th className="px-6 py-4">{t('common.resolution')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 text-sm">{log.productName}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{log.brand}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${log.type === 'Damage' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">{log.quantity}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">{log.reason}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${log.action === 'Restocked' ? 'bg-emerald-500' : log.action === 'Disposed' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                          <span className="text-[10px] font-black uppercase text-slate-700">{log.action}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <div className="p-20 text-center text-gray-300 font-bold uppercase text-xs">{t('returns.noIncidents')}</div>}
            </div>
          </div>
        </div>

        {/* Pattern & Risk Intelligence */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl shadow-slate-900/30 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 size-24 bg-primary/20 blur-3xl rounded-full"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500">warning</span>
                <h3 className="text-xs font-black uppercase tracking-widest text-primary-light">{t('returns.supplierWatch')}</h3>
              </div>

              <div className="space-y-4">
                {topRiskSuppliers.map((s: any, idx) => (
                  <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-sm">{s.name}</p>
                      <span className="text-[10px] font-black uppercase text-red-400">{s.returns + s.damages} Issues</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black uppercase text-white/40">
                        <span>{t('returns.riskScore')}</span>
                        <span>{Math.min(100, (s.returns + s.damages) * 10)}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 transition-all duration-1000" 
                          style={{ width: `${Math.min(100, (s.returns + s.damages) * 10)}%` }}
                        ></div>
                      </div>
                    </div>
                    {s.damages > s.returns && (
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <span className="material-symbols-outlined text-xs">history_edu</span>
                        <p className="text-[9px] font-black uppercase">{t('returns.packagingFault')}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-[10px] text-white/50 leading-relaxed italic">
                  * Based on historical data, these suppliers show a high correlation with "Damaged on Delivery" incidents. Consider auditing their dispatch protocols.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('returns.globalPattern')}</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                 <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">schedule</span>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-800">"Expired" trending in Eye Serums</p>
                    <p className="text-[10px] text-gray-400 font-medium">Consider adjusting reorder point for Eye Serum SKU-88.</p>
                 </div>
              </div>
              <div className="flex gap-4">
                 <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">local_shipping</span>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-800">In-transit damage is up 12%</p>
                    <p className="text-[10px] text-gray-400 font-medium">Verify handling guidelines with secondary courier partner.</p>
                 </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Floating Action Button */}
      <Link 
        to="/returns/log"
        className="fixed bottom-6 right-6 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white group"
      >
        <span className="material-symbols-outlined text-3xl font-light group-hover:rotate-90 transition-transform duration-300">add</span>
      </Link>
    </div>
  );
};

export default ReturnsManagement;
