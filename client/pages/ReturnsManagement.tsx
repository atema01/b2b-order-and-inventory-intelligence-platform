
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ReturnLog } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';

const ReturnsManagement: React.FC = () => {
  const [logs, setLogs] = useState<ReturnLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/returns', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch return logs');
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error('Returns fetch error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const COLORS = ['#005A9C', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

  const toDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const now = new Date();
  const daysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  const windowStart = daysAgo(30);
  const prevWindowStart = daysAgo(60);

  const logsCurrent = logs.filter(l => {
    const d = toDate(l.date);
    return d && d >= windowStart && d <= now;
  });

  const logsPrev = logs.filter(l => {
    const d = toDate(l.date);
    return d && d >= prevWindowStart && d < windowStart;
  });

  // Pattern Analysis Data (last 30 days)
  const reasonData = logsCurrent.reduce((acc: any[], log) => {
    const existing = acc.find(i => i.name === log.reason);
    if (existing) existing.value++;
    else acc.push({ name: log.reason, value: 1 });
    return acc;
  }, []);

  // Supplier + Brand pattern detection (last 30 days)
  const supplierRisk = logsCurrent.reduce((acc: any, log) => {
    const supplier = log.supplierName || 'Unknown Supplier';
    const brand = log.brand || 'Unknown Brand';
    const key = `${supplier} - ${brand}`;
    if (!acc[key]) acc[key] = { name: key, returns: 0, damages: 0, totalValue: 0 };
    if (log.type === 'Return') acc[key].returns += log.quantity;
    if (log.type === 'Damage') acc[key].damages += log.quantity;
    acc[key].totalValue += log.lossValue;
    return acc;
  }, {});

  const topRiskSuppliers = Object.values(supplierRisk)
    .sort((a: any, b: any) => (b.returns + b.damages) - (a.returns + a.damages))
    .slice(0, 3);

  const totalLoss = logsCurrent.reduce((acc, log) => acc + log.lossValue, 0);

  // High return products in last 30 days (relative to peers)
  const productReturnCounts = logsCurrent
    .filter(l => l.type === 'Return')
    .reduce((acc: any, log) => {
      if (!acc[log.productId]) {
        acc[log.productId] = { id: log.productId, name: log.productName, brand: log.brand, count: 0 };
      }
      acc[log.productId].count += log.quantity;
      return acc;
    }, {});

  const topReturnProducts = Object.values(productReturnCounts)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 3);

  // Reason spikes: compare last 30 days vs previous 30 days
  const reasonCounts = (list: ReturnLog[]) =>
    list.reduce((acc: Record<string, number>, log) => {
      acc[log.reason] = (acc[log.reason] || 0) + 1;
      return acc;
    }, {});

  const currentReasons = reasonCounts(logsCurrent);
  const prevReasons = reasonCounts(logsPrev);

  const reasonSpikes = Object.keys(currentReasons)
    .map((reason) => {
      const current = currentReasons[reason] || 0;
      const previous = prevReasons[reason] || 0;
      const spike = previous === 0 ? current >= 3 : current >= Math.ceil(previous * 2);
      return { reason, current, previous, spike };
    })
    .filter(r => r.spike)
    .sort((a, b) => (b.current - b.previous) - (a.current - a.previous))
    .slice(0, 3);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading returns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load returns</p>
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

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this log? This will revert any stock adjustment tied to it.');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/returns/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete log');
      }
      setLogs((prev) => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Delete return log error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete log');
    }
  };

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
          <h3 className="text-3xl font-black text-slate-800">{logsCurrent.length} <span className="text-sm">Logs</span></h3>
          <p className="text-xs font-bold text-gray-400 mt-2">{t('returns.operationalPulseDesc')}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('returns.recoveryRate')}</p>
          <h3 className="text-3xl font-black text-emerald-500">
            {Math.round((logsCurrent.filter(l => l.action === 'Restocked').length / logsCurrent.length) * 100 || 0)}%
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
                    <th className="px-6 py-4 text-right">Actions</th>
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/returns/log?edit=${log.id}`}
                            className="text-gray-400 hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
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
              {topReturnProducts.map((p: any) => (
                <div key={p.id} className="flex gap-4">
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {p.brand} - {p.count} returns (last 30 days)
                    </p>
                  </div>
                </div>
              ))}

              {reasonSpikes.map((r) => (
                <div key={r.reason} className="flex gap-4">
                  <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">local_shipping</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Reason spike: {r.reason}</p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {r.current} incidents vs {r.previous} previous 30 days
                    </p>
                  </div>
                </div>
              ))}

              {topReturnProducts.length === 0 && reasonSpikes.length === 0 && (
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  No significant patterns detected in the last 30 days.
                </div>
              )}
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
