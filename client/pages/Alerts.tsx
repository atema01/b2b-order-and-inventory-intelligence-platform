
import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';

const Alerts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/products', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error('Alerts product fetch error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      if (p.status === 'Low' || p.status === 'Empty') return true;
      const totalStock = p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom;
      return totalStock > 0 && totalStock < p.reorderPoint;
    });
  }, [products]);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load alerts</p>
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

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Low Stock Alerts</h1>
          <p className="text-gray-500 font-medium">Items that require immediate restocking attention.</p>
        </div>
        <Link 
          to="/products/restock"
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Bulk Restock
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {lowStockProducts.length > 0 ? (
          lowStockProducts.map(p => (
            <div key={p.id} className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-col md:flex-row items-center gap-6 group hover:border-red-200 transition-all">
              <div className="size-16 rounded-xl overflow-hidden bg-gray-50 relative shrink-0 border border-gray-100">
                <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
                <div className={`absolute inset-0 flex items-center justify-center ${p.status === 'Empty' ? 'bg-red-600/10' : 'bg-amber-600/5'}`}>
                </div>
              </div>

              <div className="flex-1 space-y-0.5 text-center md:text-left min-w-0">
                <div className="flex items-center justify-center md:justify-start gap-2">
                   <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{p.brand}</p>
                   <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white ${p.status === 'Empty' ? 'bg-red-600' : 'bg-amber-600'}`}>
                    {p.status}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-800 leading-tight truncate">{p.name}</h3>
                <p className="text-[10px] text-gray-400 font-bold">SKU: {p.sku}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[8px] font-black text-gray-400 uppercase">Warehouse</p>
                  <p className={`text-sm font-black ${p.stock.mainWarehouse <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{p.stock.mainWarehouse}</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[8px] font-black text-gray-400 uppercase">Back Room</p>
                  <p className={`text-sm font-black ${p.stock.backRoom <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{p.stock.backRoom}</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[8px] font-black text-gray-400 uppercase">Showroom</p>
                  <p className={`text-sm font-black ${p.stock.showRoom <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{p.stock.showRoom}</p>
                </div>
              </div>

              <div className="shrink-0 flex gap-2 w-full md:w-auto">
                <Link 
                  to={`/products/${p.id}`}
                  className="flex-1 md:flex-none text-center py-2.5 px-4 bg-gray-50 rounded-xl text-[10px] font-black text-slate-600 hover:bg-gray-100 transition-all uppercase tracking-widest"
                >
                  View
                </Link>
                <Link 
                  to={`/products/restock?productId=${p.id}`}
                  className="flex-[2] md:flex-none text-center py-2.5 px-4 bg-red-600 rounded-xl text-[10px] font-black text-white hover:bg-red-700 transition-all uppercase tracking-widest shadow-lg shadow-red-200"
                >
                  Quick Restock
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm space-y-4">
            <div className="size-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">All Stocked Up!</h3>
              <p className="text-gray-500 font-medium mt-1">There are currently no products flagged with low stock levels.</p>
            </div>
            <Link to="/products" className="inline-block text-primary font-black text-sm hover:underline mt-4">Browse Catalog</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
