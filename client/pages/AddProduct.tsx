import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, Category } from '../types';

const AddProduct: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: '',
    sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
    brand: '',
    category: '', // Will default to first category loaded
    description: '',
    price: 0,
    costPrice: 0,
    reorderPoint: 50,
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?auto=format&fit=crop&q=80&w=400',
    stock: {
      mainWarehouse: 0,
      backRoom: 0,
      showRoom: 0
    },
    supplierName: '',
    supplierPhone: '',
    initialBatch: {
      batchNumber: '',
      manufacturingDate: '',
      expiryDate: ''
    }
  });

  // Fetch categories from real API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories', { credentials: 'include' });
        if (response.ok) {
          const cats = await response.json();
          setCategories(cats);
          if (cats.length > 0) {
            setForm(prev => ({ ...prev, category: cats[0].name }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setForm(prev => ({ ...prev, image: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const totalStock = form.stock.mainWarehouse + form.stock.backRoom + form.stock.showRoom;
      let initialStatus: 'In Stock' | 'Low' | 'Empty' = 'Empty';
      
      if (totalStock > form.reorderPoint) {
        initialStatus = 'In Stock';
      } else if (totalStock > 0) {
        initialStatus = 'Low';
      }

      // Prepare product data for API
      const newProduct = {
        name: form.name,
        sku: form.sku,
        brand: form.brand,
        category: form.category || (categories.length > 0 ? categories[0].name : 'Uncategorized'),
        description: form.description,
        price: form.price,
        costPrice: form.costPrice,
        image: form.image,
        stock: form.stock,
        reorderPoint: form.reorderPoint,
        status: initialStatus,
        supplierName: form.supplierName,
        supplierPhone: form.supplierPhone,
        initialBatch: form.initialBatch
      };

      if (totalStock > 0 && (!form.initialBatch.batchNumber || !form.initialBatch.manufacturingDate || !form.initialBatch.expiryDate)) {
        alert('Batch number, manufacturing date, and expiry date are required when adding initial stock.');
        setIsSubmitting(false);
        return;
      }

      // Create product via real API
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newProduct)
      });

      if (response.ok) {
        navigate('/products');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create product');
      }
    } catch (err) {
      console.error('Create product error:', err);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="size-16 rounded-[24px] bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl font-bold">inventory_2</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Register Catalog Item</h2>
            <p className="text-sm text-gray-500 font-medium">Add a new SKU to your inventory system.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Section 0: Image Upload */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">image</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Product Imagery</h3>
            </div>
            
            <div className="flex flex-col items-center justify-center">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
              />
              <div 
                onClick={handleImageClick}
                className="relative group cursor-pointer overflow-hidden rounded-[32px] border-4 border-dashed border-gray-100 hover:border-primary/30 transition-all bg-gray-50/50 aspect-square w-full max-w-[240px] flex items-center justify-center shadow-inner"
              >
                {form.image ? (
                  <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-6">
                    <span className="material-symbols-outlined text-5xl text-gray-300 group-hover:text-primary transition-colors">add_photo_alternate</span>
                    <p className="mt-2 text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-primary transition-colors">Upload Image</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white font-black text-[10px] uppercase tracking-widest bg-slate-900/40 px-4 py-2 rounded-xl backdrop-blur-sm">Change Photo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Specifications */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">label</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Specifications</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Official Product Name</label>
                <input 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Velvet Matte Lipstick"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">SKU ID</label>
                  <input 
                    required
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Classification</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all appearance-none shadow-inner"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      <option value="" disabled>Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Brand Name</label>
                  <input 
                    required
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Glow Cosmetics"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Reorder Point</label>
                  <input 
                    required
                    type="number"
                    className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                    value={form.reorderPoint}
                    onChange={(e) => setForm({ ...form, reorderPoint: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Item Description</label>
                <textarea 
                  required
                  rows={2}
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner leading-relaxed"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Key product highlights..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Supplier Info */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">local_shipping</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Supplier Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Supplier Name (Optional)</label>
                <input 
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.supplierName}
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  placeholder="e.g. Global Imports Ltd"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Supplier Phone (Optional)</label>
                <input 
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.supplierPhone}
                  onChange={(e) => setForm({ ...form, supplierPhone: e.target.value })}
                  placeholder="+251 ..."
                />
              </div>
            </div>
          </div>

          {/* Section 3: Financials */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">payments</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Financials</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Cost (ETB)</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Wholesale (ETB)</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-black text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Batch Tracking */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Initial Batch Tracking</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Batch Number</label>
                <input
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.initialBatch.batchNumber}
                  onChange={(e) => setForm({ ...form, initialBatch: { ...form.initialBatch, batchNumber: e.target.value } })}
                  placeholder="e.g. B-APR-2026-01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Manufacturing Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.initialBatch.manufacturingDate}
                  onChange={(e) => setForm({ ...form, initialBatch: { ...form.initialBatch, manufacturingDate: e.target.value } })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Expiry Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.initialBatch.expiryDate}
                  onChange={(e) => setForm({ ...form, initialBatch: { ...form.initialBatch, expiryDate: e.target.value } })}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Initial Inventory */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <span className="material-symbols-outlined text-primary text-xl">inventory</span>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Initial Stock</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Main Warehouse</label>
                <input 
                  type="number"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.stock.mainWarehouse}
                  onChange={(e) => setForm({ ...form, stock: { ...form.stock, mainWarehouse: parseInt(e.target.value) || 0 } })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Back Room</label>
                <input 
                  type="number"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.stock.backRoom}
                  onChange={(e) => setForm({ ...form, stock: { ...form.stock, backRoom: parseInt(e.target.value) || 0 } })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Show Room</label>
                <input 
                  type="number"
                  className="w-full bg-gray-50 border-transparent rounded-2xl px-5 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-inner"
                  value={form.stock.showRoom}
                  onChange={(e) => setForm({ ...form, stock: { ...form.stock, showRoom: parseInt(e.target.value) || 0 } })}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col md:flex-row gap-4 pt-10 border-t border-gray-50">
            <button 
              type="button" 
              disabled={isSubmitting}
              onClick={() => navigate('/products')} 
              className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-80"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-.5s]"></div>
                </div>
              ) : (
                <>
                  Register Catalog SKU
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
