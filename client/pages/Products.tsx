
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Product, Category, StorageLocationId } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_STORAGE_LOCATIONS, fetchStorageLocations } from '../utils/storageLocations';

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || 'All');
  const [search, setSearch] = useState('');
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [storageLocations, setStorageLocations] = useState(DEFAULT_STORAGE_LOCATIONS);
  const { t } = useLanguage();
const [loading, setLoading] = useState(true);
const [page, setPage] = useState(1);
const [limit] = useState(16);
const [total, setTotal] = useState(0);



// With this:
useEffect(() => {
  const fetchData = async () => {
    setLoading(true); // start loading
    try {

      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`/api/products?page=${page}&limit=${limit}`, { credentials: 'include' }),
        fetch('/api/categories', { credentials: 'include' })
      ]);

      if (productsRes.ok && categoriesRes.ok) {
        const [productsData, categoriesData] = await Promise.all([
          productsRes.json(),
          categoriesRes.json()
        ]);
        if (productsData?.data) {
          setProducts(productsData.data);
          setTotal(productsData.total || 0);
        } else {
          setProducts(productsData);
          setTotal(productsData?.length || 0);
        }
        setCategories(categoriesData);
      }
    } catch (err) {
      console.error('Failed to fetch products/categories:', err);
    }
    finally {
      setLoading(false); // end loading
    }
  };

  fetchData();
}, [searchParams, page, limit]);

useEffect(() => {
  let active = true;
  fetchStorageLocations()
    .then((locations) => {
      if (active) setStorageLocations(locations);
    })
    .catch(() => {});
  return () => { active = false; };
}, []);
if (loading) {
  return (
    <div className="p-4 lg:p-8 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading products...</p>
      </div>
    </div>
  );
}


  const filteredProducts = products.filter(p => {
    const matchesCat = filter === 'All' || p.category === filter;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    
    let matchesLoc = true;
    if (locationFilter !== 'All') {
      matchesLoc = true; 
    }

    return matchesCat && matchesSearch && matchesLoc;
  });

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocationFilter(val);
    if (val === 'All') {
      searchParams.delete('location');
    } else {
      searchParams.set('location', val);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="min-h-full bg-gray-50 pb-24">
      {/* Click-away overlay for FAB */}
      {isFabOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[2px]"
          onClick={() => setIsFabOpen(false)}
        />
      )}

      {/* Sticky Header */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch pt-4">
            <div className="flex-1 relative group">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl group-focus-within:text-primary transition-colors">search</span>
              <input 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium shadow-inner transition-all"
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-48">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl pointer-events-none">location_on</span>
                <select 
                  value={locationFilter}
                  onChange={handleLocationChange}
                  className="w-full pl-11 pr-10 py-3 bg-white border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-black uppercase tracking-widest shadow-sm transition-all appearance-none"
                >
                  <option value="All">{t('loc.all')}</option>
                  {storageLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-300 pointer-events-none">expand_more</span>
              </div>

              <div className="hidden lg:flex gap-2">
                <Link 
                  to="/products/restock"
                  className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">inventory</span>
                  {t('prod.restock')}
                </Link>
                <Link 
                  to="/products/add"
                  className="flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-lg">add_box</span>
                  {t('prod.add')}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 mt-4 scrollbar-hide -mx-1 px-1">
            <button 
                onClick={() => setFilter('All')}
                className={`
                  px-4 py-2.5 rounded-xl text-[11px] lg:text-sm font-black whitespace-nowrap transition-all uppercase tracking-wider border
                  ${filter === 'All' ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-gray-100 text-slate-500 hover:bg-gray-50'}
                `}
            >
                {t('cat.all')}
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setFilter(cat.name)}
                className={`
                  px-4 py-2.5 rounded-xl text-[11px] lg:text-sm font-black whitespace-nowrap transition-all uppercase tracking-wider border
                  ${filter === cat.name ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-gray-100 text-slate-500 hover:bg-gray-50'}
                `}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product List/Grid */}
      <div className="max-w-7xl mx-auto px-4 pt-10 lg:pt-12 lg:px-8">
        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {filteredProducts.map((p) => {
            const totalStock = storageLocations.reduce((acc, loc) => acc + (p.stock[loc.id as StorageLocationId] || 0), 0);
            // Dynamic display stock based on filter
            const displayStock = locationFilter === 'All' 
              ? totalStock 
              : p.stock[locationFilter as keyof typeof p.stock] || 0;

            return (
              <Link 
                key={p.id} 
                to={`/products/${p.id}`}
                className="group bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] sm:active:scale-100 flex flex-col"
              >
                <div className="p-4 border-b border-gray-50 flex items-center gap-4 bg-gray-50/30">
                  <div className="size-16 rounded-xl overflow-hidden bg-white shrink-0 border border-gray-200">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest mb-0.5 opacity-70 truncate">{p.category}</p>
                    <h3 className="font-black text-slate-800 truncate leading-tight group-hover:text-primary transition-colors text-base">{p.name}</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter truncate">{t('common.sku')}: {p.sku}</p>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex items-end justify-between">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{t('prod.wholesale')}</span>
                      <span className="text-base font-black text-slate-900">ETB {p.price.toLocaleString()}</span>
                    </div>
                    <div className="text-right shrink-0 transition-colors duration-300">
                      <span className={`text-base font-black ${totalStock < p.reorderPoint ? 'text-red-500 animate-pulse' : 'text-primary'}`}>{displayStock}</span>
                      <span className="text-[9px] block font-black text-gray-400 uppercase leading-none">{t('prod.units')}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                     <span className={`
                      inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider
                      ${p.status === 'In Stock' ? 'bg-green-50 text-green-600' : p.status === 'Low' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}
                    `}>
                      {p.status}
                    </span>
                    <span className="text-[9px] text-gray-300 font-bold flex items-center gap-1">
                        <span className="size-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        Live
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-24 text-center">
            <div className="size-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
               <span className="material-symbols-outlined text-4xl">inventory_2</span>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{t('prod.noMatch')}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="max-w-7xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-center gap-4 pt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm font-bold text-gray-500">
              Page {page} of {Math.max(1, Math.ceil(total / limit))}
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
              disabled={page >= Math.ceil(total / limit)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Mobile Multi-Action Speed Dial FAB */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 lg:hidden">
        <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom transform ${isFabOpen ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}>
          <Link 
            to="/products/add"
            className="flex items-center gap-3 group"
          >
            <span className="px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">{t('prod.add')}</span>
            <div className="size-12 bg-white text-slate-800 border border-gray-100 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
              <span className="material-symbols-outlined">add_box</span>
            </div>
          </Link>
          <Link 
            to="/products/restock"
            className="flex items-center gap-3 group"
          >
            <span className="px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">{t('prod.restock')}</span>
            <div className="size-12 bg-white text-slate-800 border border-gray-100 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
              <span className="material-symbols-outlined">inventory</span>
            </div>
          </Link>
        </div>

        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`size-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white transition-all transform active:scale-90 relative z-50 ${isFabOpen ? 'rotate-45 bg-slate-800' : ''}`}
        >
          <span className="material-symbols-outlined text-3xl font-light">add</span>
        </button>
      </div>
    </div>
  );
};

export default Products;
