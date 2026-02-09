import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Buyer, Order, BuyerTier, PricingRule } from '../types';

const BuyerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Buyer>>({});
  const [tiers, setTiers] = useState<PricingRule[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tiersError, setTiersError] = useState('');
  
  // Password Reset State
  const [isResetPwdOpen, setIsResetPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const fetchBuyerAndOrders = async () => {
      if (!id) return;
      
      try {
        setTiersLoading(true);
        setTiersError('');
        // Fetch buyer details
        const [buyerResponse, ordersResponse, tiersResponse] = await Promise.all([
          fetch(`/api/buyers/${id}`, { credentials: 'include' }),
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/pricing/tiers', { credentials: 'include' })
        ]);

        if (!buyerResponse.ok) {
          navigate('/buyers');
          return;
        }
        const buyerData = await buyerResponse.json();
        setBuyer(buyerData);
        setEditForm(buyerData);

        // Fetch buyer's orders
        if (ordersResponse.ok) {
          const allOrders = await ordersResponse.json();
          const buyerOrders = allOrders.filter((o: any) => o.buyerId === id);
          setOrders(buyerOrders);
        }

        if (tiersResponse.ok) {
          const tierData = await tiersResponse.json();
          setTiers(Array.isArray(tierData) ? tierData : []);
        } else {
          const data = await tiersResponse.json().catch(() => ({}));
          setTiersError(data.error || 'Failed to load tiers');
        }
      } catch (err) {
        console.error('Failed to fetch buyer details:', err);
        navigate('/buyers');
      } finally {
        setTiersLoading(false);
      }
    };

    fetchBuyerAndOrders();
  }, [id, navigate]);

  if (!buyer) return <div className="p-8">Loading...</div>;
const handleUpdate = async () => {
  if (!buyer) return;
  
  try {
    const response = await fetch(`/api/buyers/${buyer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editForm)
    });

    if (response.ok) {
      // ✅ CRITICAL: Refetch the buyer data to ensure it's synced
      const updatedResponse = await fetch(`/api/buyers/${buyer.id}`, {
        credentials: 'include'
      });
      
      if (updatedResponse.ok) {
        const updatedBuyer = await updatedResponse.json();
        setBuyer(updatedBuyer);
        setEditForm(updatedBuyer);
        setIsEditing(false);
      } else {
        throw new Error('Failed to refetch buyer data');
      }
    } else {
      const errorData = await response.json();
      alert(errorData.error || 'Failed to update buyer');
    }
  } catch (err) {
    console.error('Update buyer error:', err);
    alert('Network error. Please try again.');
  }
};

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyer || !newPassword) return;
    
    try {
      const response = await fetch(`/api/buyers/${buyer.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword })
      });

      if (response.ok) {
        setIsResetPwdOpen(false);
        setNewPassword('');
        alert("Password has been reset successfully.");
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      alert('Network error. Please try again.');
    }
  };

const handleToggleStatus = async () => {
  if (!buyer) return;
  
  try {
    const newStatus = buyer.status === 'Active' ? 'Inactive' : 'Active';
    const updatedData = { ...buyer, status: newStatus };
    
    // Update the buyer status
    const response = await fetch(`/api/buyers/${buyer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updatedData)
    });

    if (response.ok) {
      // ✅ CRITICAL: Refetch the buyer data to ensure it's synced
      const updatedResponse = await fetch(`/api/buyers/${buyer.id}`, {
        credentials: 'include'
      });
      
      if (updatedResponse.ok) {
        const updatedBuyer = await updatedResponse.json();
        setBuyer(updatedBuyer);
        setEditForm(prev => ({ ...prev, status: updatedBuyer.status }));
      } else {
        throw new Error('Failed to refetch buyer data');
      }
    }
  } catch (err) {
    console.error('Toggle status error:', err);
    // Optionally show error message
    alert('Failed to update status. Please try again.');
  }
};

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setEditForm(prev => ({ ...prev, avatar: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTierChange = (tier: BuyerTier) => {
    setEditForm(prev => ({ ...prev, tier }));
  };

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'Platinum': return 'bg-slate-900 text-white';
      case 'Gold': return 'bg-amber-500 text-white';
      case 'Silver': return 'bg-slate-400 text-white';
      default: return 'bg-orange-600 text-white';
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-40">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
      />

      {/* Profile Header */}
      <div className="bg-white rounded-[40px] p-8 lg:p-10 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full ${isEditing ? 'bg-amber-500' : 'bg-primary'}`}></div>
        
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center relative z-10">
          <div 
            onClick={handleAvatarClick}
            className={`
              relative size-28 lg:size-32 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary text-5xl font-black shrink-0 shadow-inner border border-primary/5 overflow-hidden transition-all
              ${isEditing ? 'cursor-pointer hover:scale-105 active:scale-95 group' : ''}
            `}
          >
            {(editForm.avatar || buyer.avatar) ? (
              <img src={editForm.avatar || buyer.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (editForm.companyName || buyer.companyName).charAt(0)
            )}
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                <span className="material-symbols-outlined">photo_camera</span>
                <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Change</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight leading-tight">{buyer.companyName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${getTierColor(buyer.tier || '')} shadow-lg shadow-black/5`}>
                    {buyer.tier ? `${buyer.tier} Member` : 'No Tier'}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">• Account ID: {buyer.id}</span>
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
                    ${buyer.status === 'Active' 
                      ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white' 
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {buyer.status === 'Active' ? 'person_off' : 'person_check'}
                  </span>
                  {buyer.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(!isEditing);
                    if (!isEditing) setEditForm(buyer);
                  }}
                  className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isEditing ? 'bg-slate-800 text-white shadow-xl' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-50">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lifetime Spend</p>
                <p className="text-xl font-black text-slate-800">ETB {buyer.totalSpend.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Order Count</p>
                <p className="text-xl font-black text-slate-800">{buyer.totalOrders}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pricing Perk</p>
                <p className="text-xl font-black text-emerald-600">{(buyer.discountRate * 100)}% Off</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Account State</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${buyer.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {buyer.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Business Info */}
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
              <span className="material-symbols-outlined text-primary font-black">business</span>
              <h2 className="text-lg font-black text-slate-800">{isEditing ? 'Modify Identity' : 'Business Information'}</h2>
            </div>

            {isEditing ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Company Legal Name</label>
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.companyName || ''}
                    onChange={(e) => setEditForm({...editForm, companyName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Contact Manager</label>
                    <input 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                      value={editForm.contactPerson || ''}
                      onChange={(e) => setEditForm({...editForm, contactPerson: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Business Phone</label>
                    <input 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Primary Email Address</label>
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Main Delivery Point</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-50">
                <div className="py-5 first:pt-0 last:pb-0 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Legal Entity Name</p>
                  <p className="font-bold text-slate-800 text-lg">{buyer.companyName}</p>
                </div>
                <div className="py-5 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Primary Point of Contact</p>
                  <p className="font-bold text-slate-800 text-lg">{buyer.contactPerson}</p>
                </div>
                <div className="py-5 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Email Address</p>
                  <p className="font-bold text-slate-800 text-lg">{buyer.email}</p>
                </div>
                <div className="py-5 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Registered Phone</p>
                  <p className="font-bold text-slate-800 text-lg">{buyer.phone}</p>
                </div>
                <div className="py-5 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fulfillment Terminal</p>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-lg">{buyer.address}</p>
                </div>
              </div>
            )}
          </section>

          {/* Tier Management (Only in Edit Mode) */}
          {isEditing && (
            <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-8 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-5">
                <span className="material-symbols-outlined text-amber-500 font-black">stars</span>
                <h2 className="text-lg font-black text-slate-800">Partner Tier & Benefits</h2>
              </div>
              
                {tiersLoading ? (
                  <div className="text-xs font-bold text-gray-400">Loading tiers...</div>
                ) : tiersError ? (
                  <div className="text-xs font-bold text-red-500">{tiersError}</div>
                ) : tiers.length === 0 ? (
                  <div className="text-xs font-bold text-gray-400">No tiers configured yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tiers.map((t) => (
                      <button 
                        key={t.id}
                        onClick={() => handleTierChange(t.name as BuyerTier)}
                        className={`
                          p-5 rounded-2xl border-2 text-left transition-all
                          ${editForm.tier === t.name 
                            ? 'border-primary ring-4 ring-primary/5 bg-white shadow-xl translate-y-[-2px]' 
                            : 'border-gray-50 hover:border-gray-100 bg-gray-50/30'}
                        `}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <p className={`font-black uppercase text-[11px] tracking-wider ${editForm.tier === t.name ? 'text-primary' : 'text-gray-400'}`}>{t.name}</p>
                          {editForm.tier === t.name && <span className="material-symbols-outlined text-primary text-sm">check_circle</span>}
                        </div>
                        <p className={`text-2xl font-black ${editForm.tier === t.name ? 'text-slate-900' : 'text-slate-400'}`}>{t.discountPercentage}% <span className="text-[10px] font-bold uppercase">Off</span></p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
        </div>

        {/* Right: History Only */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">Operational Log</h3>
              <Link to="/orders" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Full History</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {orders.slice(0, 6).map(o => (
                <Link key={o.id} to={`/orders/${o.id}`} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-primary group-hover:text-white transition-all">
                      <span className="material-symbols-outlined text-xl">receipt_long</span>
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm group-hover:text-primary transition-colors">#{o.id.split('-').pop()}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{o.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 text-sm">ETB {o.total.toLocaleString()}</p>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${o.status === 'Delivered' ? 'text-green-500' : 'text-amber-500'}`}>{o.status}</span>
                  </div>
                </Link>
              ))}
              {orders.length === 0 && (
                <div className="p-12 text-center text-gray-400 font-bold text-xs uppercase tracking-widest">
                  No records found
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Floating Save Bar */}
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
              Save Profile Updates
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

export default BuyerDetails;
