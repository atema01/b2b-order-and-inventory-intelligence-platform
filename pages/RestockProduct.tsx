
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Product } from '../types';

const RestockProduct: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlProductId = searchParams.get('productId');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [unitSize, setUnitSize] = useState(1); // Standard multiplier (1, 6, 12, 24, 36, 48)
  const [quantities, setQuantities] = useState({
    mainWarehouse: 0,
    backRoom: 0,
    showRoom: 0
  });

  useEffect(() => {
    const allProducts = db.getAllProducts();
    setProducts(allProducts);
    
    // Auto-select product if ID is provided in URL
    if (urlProductId) {
      setSelectedProductId(urlProductId);
    }
  }, [urlProductId]);

  const handleRestock = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const updatedProduct: Product = {
      ...product,
      stock: {
        mainWarehouse: product.stock.mainWarehouse + (quantities.mainWarehouse || 0),
        backRoom: product.stock.backRoom + (quantities.backRoom || 0),
        showRoom: product.stock.showRoom + (quantities.showRoom || 0)
      }
    };

    // Determine new status based on total inventory
    const total = updatedProduct.stock.mainWarehouse + updatedProduct.stock.backRoom + updatedProduct.stock.showRoom;
    updatedProduct.status = total === 0 ? 'Empty' : total < updatedProduct.reorderPoint ? 'Low' : 'In Stock';

    db.updateProduct(updatedProduct);
    navigate('/products');
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
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-32">
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
              {[
                { key: 'mainWarehouse', label: 'Main Warehouse', color: 'bg-blue-500' },
                { key: 'backRoom', label: 'Back Room', color: 'bg-purple-500' },
                { key: 'showRoom', label: 'Show Room', color: 'bg-emerald-500' }
              ].map((loc) => (
                <div key={loc.key} className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 space-y-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${loc.color}`}></div>
                      <label className="text-xs font-black uppercase text-slate-700 tracking-wider whitespace-nowrap">{loc.label}</label>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Current</p>
                       <p className="text-sm font-black text-slate-800">{selectedProduct.stock[loc.key as keyof typeof selectedProduct.stock]}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                    <button 
                      onClick={() => adjustQty(loc.key as keyof typeof quantities, -1)}
                      className="size-10 lg:size-12 rounded-xl bg-gray-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 flex-shrink-0 flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined font-black text-lg">remove</span>
                    </button>
                    
                    <input 
                      type="number"
                      className="flex-1 w-full min-w-0 text-center border-none bg-transparent font-black text-lg lg:text-xl text-slate-800 focus:ring-0 p-0"
                      value={quantities[loc.key as keyof typeof quantities]}
                      onChange={(e) => handleInputChange(loc.key as keyof typeof quantities, e.target.value)}
                    />
                    
                    <button 
                      onClick={() => adjustQty(loc.key as keyof typeof quantities, 1)}
                      className="size-10 lg:size-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all active:scale-90 flex-shrink-0 flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined font-black text-lg">add</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 p-6 rounded-3xl flex items-start gap-4 border border-amber-100">
              <span className="material-symbols-outlined text-amber-600 font-black shrink-0">info</span>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-900 uppercase">Multi-Storage Update</p>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Total incoming stock across all locations: <strong className="text-amber-950 font-black text-sm">{quantities.mainWarehouse + quantities.backRoom + quantities.showRoom}</strong> units.
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
              className="w-full py-5 bg-primary text-white rounded-[24px] font-black text-lg shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              Update Inventory Levels
              <span className="material-symbols-outlined">sync</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default RestockProduct;
