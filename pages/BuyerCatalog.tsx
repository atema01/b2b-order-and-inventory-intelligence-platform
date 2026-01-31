
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Product, Order, OrderStatus, CreditRequest, Category } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const BuyerCatalog: React.FC = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [taxRate, setTaxRate] = useState(0.15);
  
  // Cart State
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [requestCredit, setRequestCredit] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Load products and categories
    const allProducts = db.getAllProducts();
    setProducts(allProducts);
    setFilteredProducts(allProducts);
    setCategories(db.getAllCategories());
    setTaxRate(db.getTaxRate());

    // Check for draftId to load
    const paramDraftId = searchParams.get('draftId');
    if (paramDraftId) {
      setDraftId(paramDraftId);
      const draftOrder = db.getOrder(paramDraftId);
      if (draftOrder) {
        setCart(draftOrder.items.map(i => ({ productId: i.productId, quantity: i.quantity })));
        setIsCartOpen(true); // Open cart to show items immediately
      }
    } else {
      // Load Cart from LocalStorage if not editing a draft
      const savedCart = localStorage.getItem('b2b_buyer_cart');
      if (savedCart) setCart(JSON.parse(savedCart));
    }

    // Check query param to open cart automatically (Mobile behavior)
    if (searchParams.get('openCart') === 'true') {
      setIsCartOpen(true);
      searchParams.delete('openCart');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Save Cart Effect
  useEffect(() => {
    // Filter out 0 quantity items before saving to localStorage to keep it clean
    const cleanCart = cart.filter(i => i.quantity > 0);
    localStorage.setItem('b2b_buyer_cart', JSON.stringify(cleanCart));
    window.dispatchEvent(new Event('cart-updated')); // Notify Layout
  }, [cart]);

  // Filtering
  useEffect(() => {
    let result = products;
    if (activeCategory !== 'All') {
      result = result.filter(p => p.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q)
      );
    }
    setFilteredProducts(result);
  }, [searchQuery, activeCategory, products]);

  const updateCart = (productId: string, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        const newQty = Math.max(0, existing.quantity + delta);
        if (newQty === 0) return prev.filter(i => i.productId !== productId);
        return prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i);
      }
      if (delta > 0) return [...prev, { productId, quantity: delta }];
      return prev;
    });
  };

  const setQuantity = (productId: string, qty: number) => {
    setCart(prev => {
        const validQty = Math.max(0, qty);
        const existing = prev.find(i => i.productId === productId);
        if (existing) {
            return prev.map(i => i.productId === productId ? { ...i, quantity: validQty } : i);
        }
        if (validQty > 0) return [...prev, { productId, quantity: validQty }];
        return prev;
    });
  };

  const handleInputBlur = (productId: string) => {
    setCart(prev => prev.filter(i => !(i.productId === productId && i.quantity === 0)));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const p = products.find(prod => prod.id === item.productId);
      return sum + (item.quantity * (p?.price || 0));
    }, 0);
  };

  const handleOrderAction = (status: OrderStatus) => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return;

    const userId = localStorage.getItem('userId') || 'B-0001';
    const total = calculateTotal();
    const finalTotal = total * (1 + taxRate);
    
    const orderId = draftId || `ORD-${Date.now().toString().slice(-5)}`;

    let existingOrder: Order | undefined;
    if (draftId) {
      existingOrder = db.getOrder(draftId);
    }

    const newOrder: Order = {
      id: orderId,
      buyerId: userId,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: status,
      createdBy: 'buyer',
      items: validItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        priceAtOrder: products.find(p => p.id === i.productId)?.price || 0
      })),
      subtotal: total,
      tax: total * taxRate, 
      total: finalTotal,
      amountPaid: existingOrder?.amountPaid || 0,
      paymentStatus: existingOrder?.paymentStatus || 'Unpaid',
      history: [{ 
        status: status === OrderStatus.DRAFT ? 'Draft Saved' : 'Order Placed', 
        date: new Date().toLocaleString(), 
        note: status === OrderStatus.DRAFT ? 'Order saved as draft' : 'Order submitted via online catalog' 
      }]
    };

    if (draftId) {
      db.updateOrder(newOrder);
    } else {
      db.createOrder(newOrder);
    }

    if (status === OrderStatus.PENDING && requestCredit) {
      const creditReq: CreditRequest = {
        id: `CR-${Date.now().toString().slice(-6)}`,
        buyerId: userId,
        orderId: newOrder.id,
        amount: finalTotal,
        reason: 'Order Financing',
        status: 'Pending',
        requestDate: new Date().toISOString().split('T')[0],
        notes: `Auto-generated credit request for Order #${newOrder.id}`
      };
      db.createCreditRequest(creditReq);
    }
    
    setCart([]);
    setIsCartOpen(false);
    localStorage.removeItem('b2b_buyer_cart');
    
    if (status === OrderStatus.DRAFT) {
      alert("Order saved as draft.");
    } else {
      alert(requestCredit 
        ? `Order #${newOrder.id} placed. Credit request for ETB ${finalTotal.toLocaleString()} submitted.` 
        : `Order #${newOrder.id} placed successfully!`);
    }
    
    navigate('/orders'); 
  };

  const renderProductCard = (p: Product) => {
    const cartItem = cart.find(i => i.productId === p.id);
    const isInCart = !!cartItem;
    const qty = cartItem?.quantity || 0;
    const totalStock = p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom;
    const isOutOfStock = totalStock === 0;
    const isLowStock = totalStock > 0 && totalStock < p.reorderPoint;

    return (
        <div 
          key={p.id} 
          onClick={() => navigate(`/catalog/${p.id}`)}
          className="bg-white p-3 lg:p-4 rounded-2xl lg:rounded-[28px] border border-gray-100 shadow-sm flex flex-row lg:flex-col gap-3 lg:gap-0 group hover:shadow-xl hover:border-[#00A3C4]/20 transition-all duration-300 cursor-pointer h-full"
        >
          <div className="relative w-20 h-20 lg:w-full lg:h-auto lg:aspect-[4/3] rounded-xl lg:rounded-2xl overflow-hidden bg-gray-50 border border-gray-50 shrink-0 lg:mb-4">
            <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute top-1 right-1 lg:top-2 lg:right-2 flex flex-col items-end gap-1">
              {isOutOfStock ? (
                <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-red-500 text-white text-[8px] lg:text-[10px] font-black uppercase rounded-lg shadow-md block">{t('buyer.soldOut')}</span>
              ) : isLowStock ? (
                <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-amber-500 text-white text-[8px] lg:text-[10px] font-black uppercase rounded-lg shadow-md block animate-pulse">{t('buyer.lowStock')}</span>
              ) : (
                <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-emerald-500 text-white text-[8px] lg:text-[10px] font-black uppercase rounded-lg shadow-md block">{t('buyer.inStock')}</span>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:block justify-between min-w-0">
            <div className="lg:mb-4 space-y-0.5 lg:space-y-1">
              <p className="text-[9px] font-black uppercase text-[#00A3C4] tracking-widest truncate">{p.brand}</p>
              <h3 className="font-bold text-slate-900 text-xs lg:text-base leading-tight line-clamp-2">{p.name}</h3>
              <p className="text-[10px] text-gray-400 font-medium hidden lg:block">SKU: {p.sku}</p>
            </div>

            <div className="flex items-end justify-between mt-1 lg:mt-0 lg:mb-4">
              <div>
                <p className="hidden lg:block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Wholesale</p>
                <p className="text-sm lg:text-lg font-black text-slate-800">{p.price.toLocaleString()} <span className="text-[10px]">ETB</span></p>
              </div>

              <div className="lg:hidden" onClick={(e) => e.stopPropagation()}>
                 {!isInCart ? (
                    <button 
                      onClick={() => updateCart(p.id, 1)}
                      disabled={isOutOfStock}
                      className="size-8 bg-[#00A3C4] text-white rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-all disabled:bg-gray-200"
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                    </button>
                 ) : (
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100 shadow-inner">
                       <button onClick={() => updateCart(p.id, -1)} className="size-6 bg-white rounded shadow-sm flex items-center justify-center text-slate-600 active:scale-90"><span className="material-symbols-outlined text-xs">remove</span></button>
                       <input 
                          type="number"
                          className="w-8 text-center bg-transparent border-none p-0 text-xs font-black focus:ring-0 appearance-none"
                          value={qty === 0 ? '' : qty}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => handleInputBlur(p.id)}
                          onChange={(e) => {
                              const val = e.target.value;
                              const intVal = parseInt(val);
                              setQuantity(p.id, isNaN(intVal) ? 0 : intVal);
                          }}
                       />
                       <button onClick={() => updateCart(p.id, 1)} disabled={isOutOfStock} className="size-6 bg-white rounded shadow-sm flex items-center justify-center text-[#00A3C4] active:scale-90 disabled:opacity-50"><span className="material-symbols-outlined text-xs">add</span></button>
                    </div>
                 )}
              </div>
            </div>

            <div className="hidden lg:block" onClick={(e) => e.stopPropagation()}>
              {!isInCart ? (
                <button 
                  onClick={() => updateCart(p.id, 1)}
                  disabled={isOutOfStock}
                  className="w-full py-3 bg-[#00A3C4] hover:bg-[#008CA8] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                  {t('buyer.add')}
                </button>
              ) : (
                <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 shadow-inner">
                  <button 
                    onClick={() => updateCart(p.id, -1)}
                    className="size-10 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">remove</span>
                  </button>
                  <input 
                      type="number"
                      className="flex-1 w-full text-center bg-transparent border-none p-0 text-slate-900 font-black focus:ring-0 appearance-none"
                      value={qty === 0 ? '' : qty}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleInputBlur(p.id)}
                      onChange={(e) => {
                          const val = e.target.value;
                          const intVal = parseInt(val);
                          setQuantity(p.id, isNaN(intVal) ? 0 : intVal);
                      }}
                   />
                  <button 
                    onClick={() => updateCart(p.id, 1)}
                    disabled={isOutOfStock}
                    className="size-10 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
    );
  };

  const CartContent = ({ isMobile = false }) => (
    <>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#E0F7FA] text-[#00A3C4] p-2 rounded-xl">
            <span className="material-symbols-outlined text-xl">shopping_cart</span>
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 leading-none">
              {draftId ? t('buyer.editDraft') : t('buyer.cart')}
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">{cart.reduce((a,b)=>a+b.quantity,0)} {t('buyer.items')}</p>
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setIsCartOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {cart.length === 0 || cart.every(i => i.quantity === 0) ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 min-h-[300px]">
            <span className="material-symbols-outlined text-6xl text-gray-200">remove_shopping_cart</span>
            <p className="font-bold text-gray-400 text-sm">Your cart is empty</p>
            {isMobile && (
              <button onClick={() => setIsCartOpen(false)} className="text-[#00A3C4] font-black uppercase text-xs tracking-widest hover:underline">Start Browsing</button>
            )}
          </div>
        ) : (
          cart.filter(i => i.quantity > 0).map(item => {
            const p = products.find(prod => prod.id === item.productId);
            if (!p) return null;
            return (
              <div key={item.productId} className="flex gap-3 group">
                <div className="size-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                  <img src={p.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest truncate">{p.brand}</p>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">{p.name}</h4>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="font-black text-slate-800 text-sm">{p.price.toLocaleString()} <span className="text-[9px] text-gray-400 font-bold">ETB</span></p>
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100 shadow-inner">
                      <button onClick={() => updateCart(item.productId, -1)} className="size-5 flex items-center justify-center bg-white rounded shadow-sm text-xs hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[10px]">remove</span></button>
                      <input 
                          type="number"
                          className="w-6 text-center bg-transparent border-none p-0 text-xs font-black focus:ring-0 appearance-none"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onBlur={() => handleInputBlur(item.productId)}
                          onChange={(e) => {
                              const val = e.target.value;
                              const intVal = parseInt(val);
                              setQuantity(item.productId, isNaN(intVal) ? 0 : intVal);
                          }}
                       />
                      <button onClick={() => updateCart(item.productId, 1)} className="size-5 flex items-center justify-center bg-white rounded shadow-sm text-xs hover:text-[#00A3C4] transition-colors"><span className="material-symbols-outlined text-[10px]">add</span></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(cart.length > 0 && cart.some(i => i.quantity > 0)) && (
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 space-y-4 sticky bottom-0 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>{t('buyer.subtotal')}</span>
              <span>{calculateTotal().toLocaleString()} ETB</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>{t('buyer.tax')} ({(taxRate * 100).toFixed(0)}%)</span>
              <span>{(calculateTotal() * taxRate).toLocaleString()} ETB</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-gray-200">
              <span>{t('buyer.total')}</span>
              <span>{(calculateTotal() * (1 + taxRate)).toLocaleString()} ETB</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
             <input 
               type="checkbox" 
               id="creditCheck" 
               checked={requestCredit} 
               onChange={(e) => setRequestCredit(e.target.checked)}
               className="rounded text-[#00A3C4] focus:ring-[#00A3C4]"
             />
             <label htmlFor="creditCheck" className="text-xs font-bold text-slate-700 flex-1">Request Credit for this Order</label>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleOrderAction(OrderStatus.PENDING)}
              className="w-full py-3.5 bg-[#00A3C4] hover:bg-[#008CA8] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#00A3C4]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {requestCredit ? 'Submit & Request Credit' : t('buyer.placeOrder')}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
            
            <button 
              onClick={() => handleOrderAction(OrderStatus.DRAFT)}
              className="w-full py-3.5 bg-white border border-gray-200 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {t('buyer.saveDraft')}
              <span className="material-symbols-outlined text-base">save</span>
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex-1 overflow-y-auto h-full flex flex-col">
        <div className="sticky top-0 bg-[#FAFAFA]/95 backdrop-blur-md z-20 py-4 px-4 lg:px-8 border-b border-gray-100">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
                <input 
                  type="text" 
                  placeholder={t('buyer.search')}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsCartOpen(true)}
                className="lg:hidden relative size-12 bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-slate-600 shadow-sm"
              >
                <span className="material-symbols-outlined">shopping_cart</span>
                {cart.length > 0 && <span className="absolute -top-1 -right-1 size-4 bg-[#00A3C4] rounded-full border-2 border-white"></span>}
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                  onClick={() => setActiveCategory('All')}
                  className={`
                    px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all
                    ${activeCategory === 'All'
                      ? 'bg-[#00A3C4] border-[#00A3C4] text-white shadow-lg shadow-[#00A3C4]/20' 
                      : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50'}
                  `}
                >
                  {t('cat.all')}
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`
                    px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all
                    ${activeCategory === cat.name 
                      ? 'bg-[#00A3C4] border-[#00A3C4] text-white shadow-lg shadow-[#00A3C4]/20' 
                      : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50'}
                  `}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 w-full pb-32 space-y-10">
          <section>
             <div className="flex items-center gap-2 mb-4">
               <span className="material-symbols-outlined text-[#00A3C4]">stars</span>
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('buyer.recommended')}</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.slice(0, 3).map(p => renderProductCard(p))}
             </div>
          </section>

          <section>
             <div className="flex items-center gap-2 mb-4">
               <span className="material-symbols-outlined text-slate-400">grid_view</span>
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Catalog</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map(p => renderProductCard(p))}
             </div>
             
             {filteredProducts.length === 0 && (
                <div className="py-20 text-center">
                  <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">search_off</span>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No products match your search</p>
                </div>
             )}
          </section>
        </div>
      </div>

      <div className="hidden lg:flex w-96 flex-col border-l border-gray-200 bg-white h-full z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.03)]">
        <CartContent />
      </div>

      <div className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${isCartOpen ? 'visible' : 'invisible'}`}>
        <div 
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isCartOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsCartOpen(false)}
        ></div>
        <div className={`absolute top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl transition-transform duration-300 flex flex-col ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <CartContent isMobile={true} />
        </div>
      </div>

      <div className={`lg:hidden fixed bottom-6 left-4 right-4 z-30 transition-all duration-300 transform ${cart.length > 0 && !isCartOpen ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="w-full bg-[#00A3C4] hover:bg-[#008CA8] text-white p-4 rounded-2xl shadow-xl shadow-[#00A3C4]/30 flex items-center justify-between transition-all active:scale-95"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <span className="material-symbols-outlined text-xl">shopping_cart</span>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                {draftId ? t('buyer.editDraft') : t('buyer.cart')}
              </p>
              <p className="text-sm font-black">{cart.reduce((a,b)=>a+b.quantity,0)} {t('buyer.items')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className="font-black text-lg">{calculateTotal().toLocaleString()} ETB</span>
             <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default BuyerCatalog;
