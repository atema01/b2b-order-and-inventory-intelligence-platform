
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingState from '../components/LoadingState';
import { addToCart as addToCartStore } from '../services/cartStore';

const BuyerProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!id) return;
      setIsLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/products/${id}`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load product');
        }
        const data = await res.json();
        if (!isMounted) return;
        setProduct(data);
      } catch (err) {
        console.error('Load product error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load product');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const addToCart = (productId: string) => {
    addToCartStore(productId, 1);
    alert('Item added to cart');
  };

  if (isLoading) return <LoadingState message="Loading product..." />;
  if (error) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        {error}
      </div>
    );
  }
  if (!product) return <div className="p-8 text-center text-gray-400 font-bold">Product not found.</div>;

  const totalStock = product.stock.mainWarehouse + product.stock.backRoom + product.stock.showRoom;
  const isOutOfStock = totalStock === 0;
  const isLowStock = totalStock > 0 && totalStock < product.reorderPoint;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-40">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="size-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-600 hover:text-[#00A3C4] hover:border-[#00A3C4] transition-all"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-black text-slate-900">Product Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4">
             {isOutOfStock ? (
                <span className="bg-red-500 text-white text-xs font-black uppercase px-3 py-1.5 rounded-lg shadow-md">{t('buyer.soldOut')}</span>
             ) : isLowStock ? (
                <span className="bg-amber-500 text-white text-xs font-black uppercase px-3 py-1.5 rounded-lg shadow-md">{t('buyer.lowStock')}</span>
             ) : (
                <span className="bg-emerald-500 text-white text-xs font-black uppercase px-3 py-1.5 rounded-lg shadow-md">{t('buyer.inStock')}</span>
             )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-black text-[#00A3C4] uppercase tracking-widest mb-1">{product.brand}</p>
            <h2 className="text-3xl font-black text-slate-900 leading-tight mb-2">{product.name}</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">SKU: {product.sku}</p>
          </div>

          <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
             <div className="flex justify-between items-center">
               <span className="text-sm font-bold text-slate-500">Wholesale Price</span>
               <span className="text-2xl font-black text-slate-900">ETB {product.price.toLocaleString()}</span>
             </div>
             <div className="h-px bg-gray-50"></div>
             <div className="space-y-2">
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Description</p>
               <p className="text-sm text-slate-600 leading-relaxed font-medium">{product.description}</p>
             </div>
          </div>

          <div className="p-6 bg-[#E0F7FA]/30 rounded-3xl border border-[#E0F7FA] flex items-center gap-4">
             <div className="size-12 bg-white rounded-xl flex items-center justify-center text-[#00A3C4] shadow-sm">
               <span className="material-symbols-outlined">local_shipping</span>
             </div>
             <div>
               <p className="text-xs font-black text-[#00A3C4] uppercase tracking-widest">Fast Delivery</p>
               <p className="text-[10px] text-slate-500 font-bold">Available for immediate dispatch</p>
             </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 lg:left-72 right-0 p-6 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-40">
         <div className="max-w-4xl mx-auto">
           <button 
             onClick={() => addToCart(product.id)}
             disabled={isOutOfStock}
             className="w-full py-4 bg-[#00A3C4] hover:bg-[#008CA8] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
           >
             <span className="material-symbols-outlined">add_shopping_cart</span>
             {isOutOfStock ? t('buyer.soldOut') : t('buyer.add')}
           </button>
         </div>
      </div>
    </div>
  );
};

export default BuyerProductDetails;
