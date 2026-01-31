
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Product, Category } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Product | null>(null);

  useEffect(() => {
    setCategories(db.getAllCategories());
    if (id) {
      const p = db.getProduct(id);
      if (p) {
        setProduct(p);
        setEditForm(p);
      }
    }
  }, [id]);

  if (!product || !editForm) return <div className="p-8">{t('common.loading')}</div>;

  const handleInputChange = (field: keyof Product, value: any) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleStockChange = (location: keyof Product['stock'], value: string) => {
    const num = parseInt(value) || 0;
    setEditForm(prev => {
      if (!prev) return null;
      return {
        ...prev,
        stock: { ...prev.stock, [location]: num }
      };
    });
  };

  const handleImageClick = () => {
    if (isEditing) fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (editForm) {
      // Re-calculate status based on stock
      const totalStock = editForm.stock.mainWarehouse + editForm.stock.backRoom + editForm.stock.showRoom;
      let newStatus = editForm.status;
      if (totalStock === 0) newStatus = 'Empty';
      else if (totalStock < editForm.reorderPoint) newStatus = 'Low';
      else if (editForm.status !== 'Discontinued') newStatus = 'In Stock';

      const updated = { ...editForm, status: newStatus };
      db.updateProduct(updated);
      setProduct(updated);
      setIsEditing(false);
      alert(t('prod.updated'));
    }
  };

  const handleCancel = () => {
    setEditForm(product);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`${t('prod.deleteConfirm')} "${product.name}"?`)) {
      db.deleteProduct(product.id);
      navigate('/products');
    }
  };

  const totalStock = product.stock.mainWarehouse + product.stock.backRoom + product.stock.showRoom;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto pb-40 lg:pb-32">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metadata & Image */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm flex flex-col items-center">
            <div 
              onClick={handleImageClick}
              className={`size-32 lg:size-40 rounded-3xl bg-gray-50 border border-gray-100 overflow-hidden relative shadow-inner mb-6 transition-all ${isEditing ? 'cursor-pointer hover:ring-4 hover:ring-primary/20 group' : ''}`}
            >
              <img src={editForm.image} alt={editForm.name} className="w-full h-full object-cover" />
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined">photo_camera</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter mt-1">{t('common.upload')}</span>
                </div>
              )}
            </div>
            
            <div className="w-full space-y-4">
              <div className="text-center">
                {isEditing ? (
                  <input 
                    className="w-full bg-gray-50 border-gray-100 rounded-xl px-3 py-2 font-black text-slate-800 text-center focus:ring-primary focus:bg-white"
                    value={editForm.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={t('prod.name')}
                  />
                ) : (
                  <h1 className="text-xl font-black text-slate-800 leading-tight">{product.name}</h1>
                )}
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{t('common.sku')}: {product.sku}</p>
              </div>
              <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-3">
                 <div className="text-center p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">{t('prod.wholesale')}</p>
                    <p className="text-sm font-black text-primary">ETB {product.price.toLocaleString()}</p>
                 </div>
                 <div className="text-center p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">{t('prod.stock')}</p>
                    <div className="flex items-center justify-center gap-1">
                        <span className={`text-sm font-black transition-all ${totalStock < product.reorderPoint ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
                        {totalStock.toLocaleString()}
                        </span>
                        <span className="flex size-2 rounded-full bg-green-500 animate-pulse" title="Live Update"></span>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <section className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-5">
              <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
              <h2 className="text-base font-black text-slate-800">{t('prod.fulfillmentStock')}</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: t('loc.warehouse'), key: 'mainWarehouse' as const },
                { label: t('loc.backroom'), key: 'backRoom' as const },
                { label: t('loc.showroom'), key: 'showRoom' as const },
              ].map((s) => (
                <div key={s.key} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl transition-all">
                   <p className="text-[10px] font-black text-gray-400 uppercase">{s.label}</p>
                   {isEditing ? (
                     <input 
                      type="number"
                      className="w-20 bg-white border-gray-200 rounded-lg px-2 py-1 font-black text-right text-sm focus:ring-primary"
                      value={editForm.stock[s.key]}
                      onChange={(e) => handleStockChange(s.key, e.target.value)}
                     />
                   ) : (
                     <p className="text-sm font-black text-slate-800 transition-colors">{product.stock[s.key]}</p>
                   )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Product Attributes Form */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white rounded-[32px] p-6 lg:p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-50 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary font-bold">tune</span>
                <h2 className="text-lg font-black text-slate-800">{t('prod.catalogAttributes')}</h2>
              </div>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95"
                >
                  {t('prod.editMode')}
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.brand')}</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.brand}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.category')}</label>
                {isEditing ? (
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                  >
                    {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.category}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.cost')} (ETB)</label>
                {isEditing ? (
                  <input 
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.costPrice}
                    onChange={(e) => handleInputChange('costPrice', parseInt(e.target.value) || 0)}
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.costPrice?.toLocaleString() || '0'}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.sellingPrice')} (ETB)</label>
                {isEditing ? (
                  <input 
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.price}
                    onChange={(e) => handleInputChange('price', parseInt(e.target.value) || 0)}
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.price.toLocaleString()}</p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.description')}</label>
                {isEditing ? (
                  <textarea 
                    rows={3}
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-medium text-slate-700 focus:ring-primary focus:bg-white transition-all shadow-inner leading-relaxed text-sm"
                    value={editForm.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-medium text-slate-600 text-sm leading-relaxed">{product.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.reorderPoint')}</label>
                {isEditing ? (
                  <input 
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.reorderPoint}
                    onChange={(e) => handleInputChange('reorderPoint', parseInt(e.target.value) || 0)}
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.reorderPoint}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.status')}</label>
                {isEditing ? (
                  <select 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="In Stock">In Stock (Auto-calc)</option>
                    <option value="Low">Low (Auto-calc)</option>
                    <option value="Empty">Empty (Auto-calc)</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                ) : (
                  <div className="px-5 py-3.5 bg-gray-50 rounded-2xl flex items-center gap-2">
                    <span className={`size-2 rounded-full ${product.status === 'In Stock' ? 'bg-green-500' : product.status === 'Low' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                    <p className="font-bold text-slate-800">{product.status}</p>
                  </div>
                )}
              </div>

              {/* Supplier Info */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.supplierName')}</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.supplierName || ''}
                    onChange={(e) => handleInputChange('supplierName', e.target.value)}
                    placeholder="e.g. Global Imports"
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.supplierName || '---'}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('prod.supplierPhone')}</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    value={editForm.supplierPhone || ''}
                    onChange={(e) => handleInputChange('supplierPhone', e.target.value)}
                    placeholder="+251 ..."
                  />
                ) : (
                  <p className="px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-slate-800">{product.supplierPhone || '---'}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Floating Sticky Footer Actions */}
      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 px-4 py-4 z-40 shadow-2xl">
        <div className="max-w-4xl mx-auto flex gap-3">
          {isEditing ? (
            <>
              <button 
                onClick={handleCancel}
                className="flex-1 py-4 px-6 rounded-2xl bg-white border-2 border-gray-100 text-slate-600 font-black hover:bg-gray-50 transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                {t('prod.discard')}
              </button>
              <button 
                onClick={handleSave}
                className="flex-[2] py-4 px-6 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                {t('prod.saveChanges')}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleDelete}
                className="flex items-center justify-center size-14 rounded-2xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all active:scale-90 flex-shrink-0"
                title={t('prod.delete')}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 text-white font-black shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                {t('prod.modify')}
              </button>
              <button 
                onClick={() => navigate(`/products/restock?productId=${product.id}`)}
                className="flex-1 py-4 px-6 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">add_box</span>
                {t('prod.restockUnits')}
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ProductDetails;
