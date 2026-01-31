
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/databaseService';
import { CreditRequest, Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const CreditRequests: React.FC = () => {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const { t } = useLanguage();
  
  // State for partial approval editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approveAmount, setApproveAmount] = useState<number>(0);

  useEffect(() => {
    setRequests(db.getAllCreditRequests());
    setBuyers(db.getAllBuyers());
  }, []);

  const pendingAmount = requests
    .filter(r => r.status === 'Pending')
    .reduce((acc, r) => acc + r.amount, 0);

  const approvedThisMonth = requests
    .filter(r => r.status === 'Approved' || r.status === 'Partially Approved')
    .reduce((acc, r) => acc + (r.approvedAmount || r.amount), 0);

  const startApproval = (req: CreditRequest) => {
    setEditingId(req.id);
    setApproveAmount(req.amount);
  };

  const cancelApproval = () => {
    setEditingId(null);
    setApproveAmount(0);
  };

  const confirmApproval = (req: CreditRequest) => {
    const isPartial = approveAmount < req.amount;
    const updatedReq: CreditRequest = {
      ...req,
      status: isPartial ? 'Partially Approved' : 'Approved',
      approvedAmount: approveAmount,
      actionDate: new Date().toISOString().split('T')[0]
    };
    db.updateCreditRequest(updatedReq);
    setRequests(db.getAllCreditRequests());
    setEditingId(null);
  };

  const handleReject = (req: CreditRequest) => {
    const updatedReq: CreditRequest = {
      ...req,
      status: 'Rejected',
      approvedAmount: 0,
      actionDate: new Date().toISOString().split('T')[0]
    };
    db.updateCreditRequest(updatedReq);
    setRequests(db.getAllCreditRequests());
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{t('credits.title')}</h1>
          <p className="text-gray-500 font-medium text-sm">{t('credits.subtitle')}</p>
        </div>
        <Link 
          to="/credits/log"
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
        >
          <span className="material-symbols-outlined">add_card</span>
          {t('credits.logRequest')}
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('credits.pendingApproval')}</p>
            <h3 className="text-3xl font-black text-amber-500">ETB {pendingAmount.toLocaleString()}</h3>
          </div>
          <div className="size-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">pending_actions</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('credits.creditsIssued')}</p>
            <h3 className="text-3xl font-black text-emerald-500">ETB {approvedThisMonth.toLocaleString()}</h3>
          </div>
          <div className="size-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-6 py-5">{t('credits.reqId')}</th>
                <th className="px-6 py-5">{t('common.buyer')}</th>
                <th className="px-6 py-5">{t('credits.assocOrder')}</th>
                <th className="px-6 py-5">{t('credits.requested')}</th>
                <th className="px-6 py-5">{t('credits.approved')}</th>
                <th className="px-6 py-5">{t('common.reason')}</th>
                <th className="px-6 py-5">{t('common.status')}</th>
                <th className="px-6 py-5 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(req => {
                const buyer = buyers.find(b => b.id === req.buyerId);
                const isEditingThis = editingId === req.id;

                return (
                  <tr key={req.id} className="group hover:bg-gray-50 transition-all">
                    <td className="px-6 py-5 font-bold text-slate-800">{req.id}</td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-700 text-sm">{buyer?.companyName || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-400">{req.requestDate}</p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-500">
                      {req.orderId ? (
                        <span className="bg-gray-100 px-2 py-1 rounded text-slate-600">#{req.orderId.split('-').pop()}</span>
                      ) : (
                        <span className="italic text-gray-300">{t('credits.generalCredit')}</span>
                      )}
                    </td>
                    <td className="px-6 py-5 font-black text-slate-800">ETB {req.amount.toLocaleString()}</td>
                    <td className="px-6 py-5 font-black text-emerald-600">
                      {isEditingThis ? (
                        <input 
                          type="number" 
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-bold focus:ring-primary focus:border-primary"
                          value={approveAmount}
                          onChange={(e) => setApproveAmount(parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        (req.approvedAmount || 0) > 0 ? `ETB ${req.approvedAmount?.toLocaleString()}` : '-'
                      )}
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-500">{req.reason}</td>
                    <td className="px-6 py-5">
                      <span className={`
                        px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider
                        ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                          req.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'}
                      `}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {req.status === 'Pending' && (
                        isEditingThis ? (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={cancelApproval}
                              className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-300"
                            >
                              {t('common.cancel')}
                            </button>
                            <button 
                              onClick={() => confirmApproval(req)}
                              className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover shadow-lg shadow-primary/20"
                            >
                              {t('common.confirm')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleReject(req)}
                              className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                              title="Reject"
                            >
                              <span className="material-symbols-outlined text-lg font-bold">close</span>
                            </button>
                            <button 
                              onClick={() => startApproval(req)}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                              title="Review & Approve"
                            >
                              <span className="material-symbols-outlined text-lg font-bold">edit_note</span>
                            </button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="p-16 text-center text-gray-400 font-bold uppercase text-xs">{t('credits.noRequests')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditRequests;
