
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/databaseService';
import { Category, Staff, Buyer } from '../types';
import { hashPassword } from '../utils/auth';

const Settings: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const userType = localStorage.getItem('userType');
  
  // Category Management State
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Tax Management State
  const [taxRate, setTaxRate] = useState(15);
  const [canManageFinancials, setCanManageFinancials] = useState(false);

  // Password Change State
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    if (userType !== 'buyer') {
      setCategories(db.getAllCategories());
      setTaxRate(db.getTaxRate() * 100);
    }
  }, [userType]);

  // Determine access to financial settings
  useEffect(() => {
    if (user && user.type === 'seller') {
        const staff = db.getAllStaff().find(s => s.id === user.id);
        if (staff) {
            const role = db.getAllRoles().find(r => r.name === staff.role);
            // Logic: Any staff with permission to access credits page (Credits permission) or Payments permission or Admin
            // This allows anyone who handles payments/credits to also configure the tax rate
            const hasCreditAccess = staff.role === 'Admin' || (role && (role.permissions['Credits'] || role.permissions['Payments']));
            
            setCanManageFinancials(!!hasCreditAccess);
        } else if (user.role === 'Admin') {
            // Fallback for default admin
            setCanManageFinancials(true);
        } else {
            setCanManageFinancials(false);
        }
    } else {
        setCanManageFinancials(false);
    }
  }, [user]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'en' | 'am');
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat: Category = {
        id: `CAT-${Date.now()}`,
        name: newCategoryName.trim()
    };
    db.createCategory(newCat);
    setCategories(db.getAllCategories());
    setNewCategoryName('');
  };

  const checkCategoryUsage = (categoryName: string): boolean => {
    const products = db.getAllProducts();
    return products.some(p => p.category === categoryName);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (checkCategoryUsage(name)) {
        alert(t('settings.categoryInUse'));
        return;
    }
    if (window.confirm(t('common.confirm'))) {
        db.deleteCategory(id);
        setCategories(db.getAllCategories());
    }
  };

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleUpdateCategory = () => {
    if (!editingId || !editName.trim()) return;
    
    // Find original category to check usage of old name
    const original = categories.find(c => c.id === editingId);
    if (original && original.name !== editName) {
        if (checkCategoryUsage(original.name)) {
            alert(t('settings.categoryInUse'));
            return;
        }
    }

    db.updateCategory({ id: editingId, name: editName.trim() });
    setCategories(db.getAllCategories());
    setEditingId(null);
    setEditName('');
  };

  const handleSaveTax = () => {
    db.setTaxRate(taxRate / 100);
    alert('Tax rate updated successfully.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPwdError('');

    const hashedCurrent = await hashPassword(currentPwd);
    let currentUserData: Staff | Buyer | undefined;

    // Fetch fresh user data
    if (user.type === 'seller') {
        currentUserData = db.getAllStaff().find(s => s.id === user.id);
    } else {
        currentUserData = db.getBuyer(user.id);
    }

    if (!currentUserData) {
        setPwdError('User record not found.');
        return;
    }

    // Verify current password
    // Note: In a real app, the backend handles this check securely. 
    // Here we check against stored hash or plain text (legacy)
    const storedPwd = currentUserData.password;
    if (storedPwd !== hashedCurrent && storedPwd !== currentPwd) {
        setPwdError('Incorrect current password.');
        return;
    }

    // Update with new password
    const hashedNew = await hashPassword(newPwd);
    
    if (user.type === 'seller') {
        db.updateStaff({ ...currentUserData as Staff, password: hashedNew });
    } else {
        db.updateBuyer({ ...currentUserData as Buyer, password: hashedNew });
    }

    alert('Password changed successfully.');
    setIsChangePwdOpen(false);
    setCurrentPwd('');
    setNewPwd('');
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8 pb-32">
        <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('settings.title')}</h1>
            <p className="text-slate-500 font-medium">{t('settings.subtitle')}</p>
        </div>

        {/* Financial Settings - For Admins or Staff with Credits/Payments Access */}
        {userType !== 'buyer' && canManageFinancials && (
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
        {userType !== 'buyer' && (
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

        {/* Localization */}
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

        {/* Notifications */}
        <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <span className="material-symbols-outlined text-primary text-xl">notifications</span>
                <h2 className="text-lg font-black text-slate-800">{t('settings.notifications')}</h2>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">{t('settings.emailAlerts')}</p>
                        <p className="text-xs text-gray-500 font-medium">{t('settings.emailDesc')}</p>
                    </div>
                    <button 
                        onClick={() => setEmailNotifs(!emailNotifs)}
                        className={`w-12 h-7 rounded-full p-1 transition-all ${emailNotifs ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                        <div className={`size-5 bg-white rounded-full shadow-md transition-all ${emailNotifs ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">{t('settings.pushNotifs')}</p>
                        <p className="text-xs text-gray-500 font-medium">{t('settings.pushDesc')}</p>
                    </div>
                    <button 
                        onClick={() => setPushNotifs(!pushNotifs)}
                        className={`w-12 h-7 rounded-full p-1 transition-all ${pushNotifs ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                        <div className={`size-5 bg-white rounded-full shadow-md transition-all ${pushNotifs ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>
            </div>
        </section>

        {/* Account Security */}
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
