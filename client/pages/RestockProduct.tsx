import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Product, StorageLocationId } from '../types';
import { DEFAULT_STORAGE_LOCATIONS, fetchStorageLocations } from '../utils/storageLocations';

const RestockProduct: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlProductId = searchParams.get('productId');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [unitSize, setUnitSize] = useState(1);
  const [quantities, setQuantities] = useState<Record<StorageLocationId, number>>({
    mainWarehouse: 0,
    backRoom: 0,
    showRoom: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageLocations, setStorageLocations] = useState(DEFAULT_STORAGE_LOCATIONS);
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: ''
  });

  // Fetch products from real API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products', { credentials: 'include' });
        if (response.ok) {
          const allProducts = await response.json();
          setProducts(allProducts);
          
          // Auto-select product if ID is provided in URL
          if (urlProductId) {
            setSelectedProductId(urlProductId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };
    fetchProducts();
  }, [urlProductId]);

  useEffect(() => {
    let active = true;
    fetchStorageLocations()
      .then((locations) => {
        if (active) setStorageLocations(locations);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleRestock = async () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    setIsSubmitting(true);
    
    try {
      const totalIncoming = Object.values(quantities).reduce((sum, value) => sum + (value || 0), 0);
      if (totalIncoming <= 0) {
        alert('Enter at least one quantity to restock.');
        return;
      }
      if (!batchForm.batchNumber || !batchForm.manufacturingDate || !batchForm.expiryDate) {
        alert('Batch number, manufacturing date, and expiry date are required.');
        return;
      }

      const response = await fetch(`/api/products/${selectedProductId}/batches`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...batchForm,
          quantities
        })
      });

      if (response.ok) {
        navigate('/products');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update product');
      }
    } catch (err) {
      console.error('Restock error:', err);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustQty = (field: keyof typeof quantities, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [field]: Math.max(0, (prev[field] || 0) + (delta * unitSize))
    }));
  };

  const handleInputChange = (field: keyof typeof quantities, val: string) => {
    const parsed = parseInt(val);
    setQuantities(prev => ({
      ...prev,
      [field]: isNaN(parsed) ? 0 : Math.max(0, parsed)
    }));
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-44">
      <div className="bg-white rounded-[32px] lg:rounded-[40px] p-6 lg:p-10 border border-gray-100 shadow-sm space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-3xl font-bold">inventory</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Restock Inventory</h2>
            <p className="text-sm text-gray-500 font-medium">Add units to specific storage locations.</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Select Product</label>
          <div className="relative">
            <select 
              className="w-full bg-gray-50 border-gray-100 rounded-2xl px-5 py-4 font-black text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all appearance-none shadow-sm text-sm lg:text-base"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Choose a product from catalog...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
          </div>
        </div>

        {selectedProduct && (
          <div className="space-y-8 pt-4 animate-in fade-in duration-500">
            {/* Unit/Pack Size Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Batch Number</label>
                <input
                  className="w-full bg-gray-50 border-gray-100 rounded-2xl px-5 py-4 font-black text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-sm text-sm"
                  value={batchForm.batchNumber}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, batchNumber: e.target.value }))}
                  placeholder="e.g. B-MAY-2026-02"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Manufacturing Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border-gray-100 rounded-2xl px-5 py-4 font-black text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-sm text-sm"
                  value={batchForm.manufacturingDate}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, manufacturingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Expiry Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border-gray-100 rounded-2xl px-5 py-4 font-black text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-sm text-sm"
                  value={batchForm.expiryDate}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Increment Unit (Pack Size)</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[1, 6, 12, 24, 36, 48].map(size => (
                  <button
                    key={size}
                    onClick={() => setUnitSize(size)}
                    className={`
                      py-3 rounded-xl text-xs font-black transition-all border-2
                      ${unitSize === size 
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                        : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}
                    `}
                  >
                    {size === 1 ? 'Single' : `x${size}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Storage Locations Grid - Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {storageLocations.map((loc) => {
                const colorMap: Record<StorageLocationId, string> = {
                  mainWarehouse: 'bg-blue-500',
                  backRoom: 'bg-purple-500',
                  showRoom: 'bg-emerald-500'
                };
                return (
                <div key={loc.id} className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 space-y-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${colorMap[loc.id]}`}></div>
                      <label className="text-xs font-black uppercase text-slate-700 tracking-wider whitespace-nowrap">{loc.name}</label>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Current</p>
                       <p className="text-sm font-black text-slate-800">{selectedProduct.stock[loc.id as keyof typeof selectedProduct.stock]}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                    <button 
                      onClick={() => adjustQty(loc.id as keyof typeof quantities, -1)}
                      className="size-10 lg:size-12 rounded-xl bg-gray-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 flex-shrink-0 flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined font-black text-lg">remove</span>
                    </button>
                    
                    <input 
                      type="number"
                      className="flex-1 w-full min-w-0 text-center border-none bg-transparent font-black text-lg lg:text-xl text-slate-800 focus:ring-0 p-0"
                      value={quantities[loc.id as keyof typeof quantities]}
                      onChange={(e) => handleInputChange(loc.id as keyof typeof quantities, e.target.value)}
                    />
                    
                    <button 
                      onClick={() => adjustQty(loc.id as keyof typeof quantities, 1)}
                      className="size-10 lg:size-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all active:scale-90 flex-shrink-0 flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined font-black text-lg">add</span>
                    </button>
                  </div>
                </div>
              );
              })}
            </div>

            <div className="bg-amber-50 p-6 rounded-3xl flex items-start gap-4 border border-amber-100">
              <span className="material-symbols-outlined text-amber-600 font-black shrink-0">info</span>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-900 uppercase">Multi-Storage Update</p>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Total incoming stock across all locations: <strong className="text-amber-950 font-black text-sm">
                    {storageLocations.reduce((acc, loc) => acc + (quantities[loc.id as StorageLocationId] || 0), 0)}
                  </strong> units.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-6 z-40 shadow-2xl">
          <div className="max-w-5xl mx-auto">
            <button 
              onClick={handleRestock}
              disabled={isSubmitting}
              className="w-full py-5 bg-primary text-white rounded-[24px] font-black text-lg shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isSubmitting ? 'Updating...' : 'Update Inventory Levels'}
              <span className="material-symbols-outlined">sync</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default RestockProduct;
