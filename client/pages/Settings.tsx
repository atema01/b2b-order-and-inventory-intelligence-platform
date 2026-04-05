
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Category, Staff, Buyer, StorageLocation } from '../types';
import { DEFAULT_STORAGE_LOCATIONS, fetchStorageLocations, normalizeStorageLocations } from '../utils/storageLocations';
const Settings: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const permissions = user?.permissions || {};
  const isBuyer = user?.role === 'Buyer';
  const isAdmin = user?.role === 'Admin';
  const canManageProductsSettings = !isBuyer && (isAdmin || Boolean(permissions['Products']));
  const canManageLocations = canManageProductsSettings;
  const canManageFinancials = !isBuyer && (isAdmin || Boolean(permissions['Payments']));
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCompanyName, setProfileCompanyName] = useState('');
  const [profileError, setProfileError] = useState('');
  
  // Category Management State
    const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Tax Management State
  const [taxRate, setTaxRate] = useState(15);

  // Storage Location Management
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(DEFAULT_STORAGE_LOCATIONS);
  const [isSavingLocations, setIsSavingLocations] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Password Change State
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';

  const matchesSection = (...values: string[]) => {
    if (!query) return true;
    return values.join(' ').toLowerCase().includes(query);
  };

useEffect(() => {
  if (canManageProductsSettings) {
    fetch('/api/categories', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setCategories(data));
  } else {
    setCategories([]);
  }
}, [canManageProductsSettings]);

useEffect(() => {
  if (canManageFinancials) {
    fetch('/api/settings/tax-rate', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setTaxRate((data.taxRate ?? 0) * 100));
  } else {
    setTaxRate(15);
  }
}, [canManageFinancials]);

useEffect(() => {
  if (user) {
    setProfileName(user.name || '');
    setProfileEmail(user.email || '');
    setProfilePhone(user.phone || '');
    setProfileCompanyName((user as any).companyName || '');
  }

  // Always refresh profile from backend to avoid stale/missing fields
  fetch('/api/auth/me', { credentials: 'include' })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (!data) return;
      setProfileName(data.name || '');
      setProfileEmail(data.email || '');
      setProfilePhone(data.phone || '');
      setProfileCompanyName(data.companyName || '');
    })
    .catch(() => {});
}, [user]);

useEffect(() => {
  if (!canManageLocations) return;
  let active = true;
  fetchStorageLocations()
    .then((locations) => {
      if (active) setStorageLocations(locations);
    })
    .catch(() => {});
  return () => { active = false; };
}, [canManageLocations]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'en' | 'am');
  };
  
// handleAddCategory
const handleAddCategory = async () => {
  if (!newCategoryName.trim()) return;
  
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name: newCategoryName.trim() })
  });

  if (response.ok) {
    const updatedCategories = await fetch('/api/categories', { credentials: 'include' }).then(r => r.json());
    setCategories(updatedCategories);
    setNewCategoryName('');
  }
};

// Replace this function entirely
const checkCategoryUsage = async (categoryName: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/products', { credentials: 'include' });
    const products = await response.json();
    return products.some((p: any) => p.category === categoryName);
  } catch (err) {
    console.error('Failed to check category usage:', err);
    return false; // Assume not in use if error
  }
};
// Update handleDeleteCategory
const handleDeleteCategory = async (id: string, name: string) => {
  const inUse = await checkCategoryUsage(name); // ✅ Now async
  
  if (inUse) {
    alert(t('settings.categoryInUse'));
    return;
  }

  if (window.confirm(t('common.confirm'))) {
    const response = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      const updatedCategories = await fetch('/api/categories', { credentials: 'include' }).then(r => r.json());
      setCategories(updatedCategories);
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to delete category');
    }
  }
};

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };



// handleUpdateCategory
const handleUpdateCategory = async () => {
  if (!editingId || !editName.trim()) return;
  
  const response = await fetch(`/api/categories/${editingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name: editName.trim() })
  });

  if (response.ok) {
    const updatedCategories = await fetch('/api/categories', { credentials: 'include' }).then(r => r.json());
    setCategories(updatedCategories);
    setEditingId(null);
    setEditName('');
  }
};
  

// handleSaveTax
const handleSaveTax = async () => {
  const response = await fetch('/api/settings/tax-rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ taxRate })
  });

  if (response.ok) {
    alert('Tax rate updated successfully.');
  }
};

const handleLocationChange = (id: string, field: 'name' | 'capacityUnits', value: string) => {
  setStorageLocations(prev => prev.map(loc => {
    if (loc.id !== id) return loc;
    if (field === 'name') {
      return { ...loc, name: value };
    }
    const parsed = parseInt(value, 10);
    const capUnits = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    return { ...loc, capacityUnits: capUnits };
  }));
};

const handleSaveLocations = async () => {
  setIsSavingLocations(true);
  setLocationError('');
  try {
    const response = await fetch('/api/settings/storage-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ locations: normalizeStorageLocations(storageLocations) })
    });
    if (response.ok) {
      const data = await response.json();
      setStorageLocations(normalizeStorageLocations(data?.locations || storageLocations));
    } else {
      const data = await response.json().catch(() => ({}));
      setLocationError(data.error || 'Failed to update storage locations');
    }
  } catch (err) {
    setLocationError('Network error. Please try again.');
  } finally {
    setIsSavingLocations(false);
  }
};

// Replace the entire handleChangePassword function
const handleChangePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) return;
  setPwdError('');

  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd })
    });

    if (response.ok) {
      alert('Password changed successfully.');
      setIsChangePwdOpen(false);
      setCurrentPwd('');
      setNewPwd('');
    } else {
      const errorData = await response.json();
      setPwdError(errorData.error || 'Failed to change password');
    }
  } catch (err) {
    console.error('Password change error:', err);
    setPwdError('Network error. Please try again.');
  }
};

const handleProfileUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  setProfileError('');
  try {
    const response = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        companyName: profileCompanyName
      })
    });
    if (response.ok) {
      alert('Profile updated successfully.');
      window.location.reload();
    } else {
      const errorData = await response.json();
      setProfileError(errorData.error || 'Failed to update profile');
    }
  } catch (err) {
    console.error('Profile update error:', err);
    setProfileError('Network error. Please try again.');
  }
};

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8 pb-32">
        <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('settings.title')}</h1>
            <p className="text-slate-500 font-medium">{t('settings.subtitle')}</p>
        </div>

        {/* Financial Settings - For Admins or Staff with Credits/Payments Access */}
        {canManageFinancials && matchesSection('financial settings tax vat rate prices orders') && (
            <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <span className="material-symbols-outlined text-primary text-xl">account_balance</span>
                    <h2 className="text-lg font-black text-slate-800">Financial Settings</h2>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col space-y-2">
                        <label className="text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Default Tax / VAT Rate (%)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                                value={taxRate}
                                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                            />
                            <button 
                                onClick={handleSaveTax}
                                className="bg-primary text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 font-medium ml-1">Applied to all new orders and catalog prices.</p>
                    </div>
                </div>
            </section>
        )}

        {/* Product Categories - Only for Sellers */}
        {canManageProductsSettings && matchesSection('categories product categories manage categories add category delete category') && (
            <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <span className="material-symbols-outlined text-primary text-xl">category</span>
                    <h2 className="text-lg font-black text-slate-800">{t('settings.categories')}</h2>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-gray-500 font-medium">{t('settings.manageCategories')}</p>
                    
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            className="flex-1 bg-gray-50 border-transparent rounded-xl px-4 py-3 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                            placeholder={t('settings.newCategory')}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                        <button 
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim()}
                            className="bg-primary text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-50 hover:bg-primary-hover transition-all"
                        >
                            {t('common.add')}
                        </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:bg-gray-100 transition-colors">
                                {editingId === cat.id ? (
                                    <input 
                                        className="flex-1 bg-white border border-primary rounded-lg px-2 py-1 font-bold text-slate-800 text-sm mr-2"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        autoFocus
                                    />
                                ) : (
                                    <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                                )}
                                
                                <div className="flex items-center gap-2">
                                    {editingId === cat.id ? (
                                        <>
                                            <button onClick={handleUpdateCategory} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-lg">check</span>
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => startEditing(cat)} className="text-slate-400 hover:text-primary hover:bg-white p-1.5 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-slate-400 hover:text-red-500 hover:bg-white p-1.5 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        )}

        {/* Storage Locations - For users with Products access */}
        {canManageLocations && matchesSection('storage locations warehouse capacity units location name') && (
            <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <span className="material-symbols-outlined text-primary text-xl">warehouse</span>
                    <h2 className="text-lg font-black text-slate-800">Storage Locations</h2>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-gray-500 font-medium">
                      Configure location names and capacity (units). The dashboard will calculate utilization % from stored units.
                    </p>

                    <div className="space-y-3">
                      {storageLocations.map((loc) => (
                        <div key={loc.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="md:col-span-7 space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Location Name</label>
                            <input
                              className="w-full bg-white border-gray-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                              value={loc.name}
                              onChange={(e) => handleLocationChange(loc.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Capacity (Units)</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full bg-white border-gray-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-right"
                              value={loc.capacityUnits}
                              onChange={(e) => handleLocationChange(loc.id, 'capacityUnits', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-2 flex justify-end">
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{loc.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {locationError && (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 text-xs font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {locationError}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveLocations}
                        disabled={isSavingLocations}
                        className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-70"
                      >
                        {isSavingLocations ? 'Saving...' : t('common.save')}
                      </button>
                    </div>
                </div>
            </section>
        )}

        {/* Localization */}
        {matchesSection('profile settings company name full name email phone profile') && (
        <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <span className="material-symbols-outlined text-primary text-xl">account_circle</span>
                <h2 className="text-lg font-black text-slate-800">{t('settings.profile') || 'Profile Settings'}</h2>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isBuyer && (
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Company Name</label>
                            <input 
                                required
                                className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                                value={profileCompanyName}
                                onChange={(e) => setProfileCompanyName(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Full Name</label>
                        <input 
                            required
                            className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Email</label>
                        <input 
                            required
                            type="email"
                            className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Phone</label>
                        <input 
                            className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                            value={profilePhone}
                            onChange={(e) => setProfilePhone(e.target.value)}
                        />
                    </div>
                </div>
                {profileError && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 text-xs font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {profileError}
                    </div>
                )}
                <div className="flex justify-end">
                    <button 
                        type="submit"
                        className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
                    >
                        {t('common.save')}
                    </button>
                </div>
            </form>
        </section>
        )}

        {matchesSection('language localization english amharic locale') && (
        <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <span className="material-symbols-outlined text-primary text-xl">language</span>
                <h2 className="text-lg font-black text-slate-800">{t('settings.localization')}</h2>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                    <label className="text-xs font-black uppercase text-gray-400 tracking-widest ml-1">{t('settings.language')}</label>
                    <div className="relative">
                        <select 
                            value={language} 
                            onChange={handleLanguageChange}
                            className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none shadow-inner"
                        >
                            <option value="en">English (US)</option>
                            <option value="am">Amharic (አማርኛ)</option>
                        </select>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                    </div>
                </div>
            </div>
        </section>
        )}

        {/* Account Security */}
        {matchesSection('security password change password account security') && (
        <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <span className="material-symbols-outlined text-primary text-xl">lock</span>
                <h2 className="text-lg font-black text-slate-800">{t('settings.security')}</h2>
            </div>
            
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-bold text-slate-800">{t('settings.password')}</p>
                    <p className="text-xs text-gray-500 font-medium">{t('settings.lastChanged')}</p>
                </div>
                <button 
                    onClick={() => setIsChangePwdOpen(true)}
                    className="px-4 py-2 bg-gray-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                    {t('settings.changePwd')}
                </button>
            </div>
        </section>
        )}

        {/* Change Password Modal */}
        {isChangePwdOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8 animate-in zoom-in duration-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined font-black">lock_reset</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">Change Password</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Update your access credentials</p>
                        </div>
                    </div>

                    <form onSubmit={handleChangePassword}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Current Password</label>
                                <input 
                                    type="password"
                                    required
                                    className="w-full bg-gray-50 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all shadow-inner"
                                    placeholder="Enter current password"
                                    value={currentPwd}
                                    onChange={(e) => setCurrentPwd(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">New Password</label>
                                <input 
                                    type="password"
                                    required
                                    className="w-full bg-gray-50 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all shadow-inner"
                                    placeholder="Enter new password"
                                    value={newPwd}
                                    onChange={(e) => setNewPwd(e.target.value)}
                                />
                            </div>
                            
                            {pwdError && (
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 text-xs font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    {pwdError}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => { setIsChangePwdOpen(false); setPwdError(''); setCurrentPwd(''); setNewPwd(''); }}
                                    className="flex-1 py-3.5 bg-gray-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    {t('common.cancel')}
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
        )}
    </div>
  );
};

export default Settings;
