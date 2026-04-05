
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, Order, OrderStatus, Category } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';
import { getCart, setCart as setCartStore, clearCart } from '../services/cartStore';

const BuyerCatalog: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [taxRate, setTaxRate] = useState(0.15);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Cart State
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>(() => getCart());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [requestCredit, setRequestCredit] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditPaymentTerms, setCreditPaymentTerms] = useState<'Net 15' | 'Net 30'>('Net 15');
  const [selectedCreditPercentage, setSelectedCreditPercentage] = useState<number>(100);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const cartInitRef = useRef(false);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
  const draftParam = searchParams.get('draftId');
  const openCartParam = searchParams.get('openCart');

  useEffect(() => {
    let isMounted = true;

    const loadCatalog = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [productsRes, categoriesRes, taxRes] = await Promise.all([
          fetch('/api/products', { credentials: 'include' }),
          fetch('/api/categories', { credentials: 'include' }),
          fetch('/api/settings/tax-rate', { credentials: 'include' })
        ]);

        if (!productsRes.ok || !categoriesRes.ok) {
          throw new Error('Failed to load catalog data');
        }

        const productsData = await productsRes.json();
        const categoriesData = await categoriesRes.json();
        const taxData = taxRes.ok ? await taxRes.json() : null;

        const productsArray = Array.isArray(productsData) ? productsData : (productsData?.data || []);

        if (!isMounted) return;

        setProducts(productsArray);
        setFilteredProducts(productsArray);
        setCategories(categoriesData || []);
        setTaxRate(taxData?.taxRate ?? 0.15);

        // Check for draftId to load
        const paramDraftId = searchParams.get('draftId');
        if (paramDraftId && user?.id) {
          setDraftId(paramDraftId);
          const draftRes = await fetch(`/api/orders/${paramDraftId}`, { credentials: 'include' });
          if (draftRes.ok) {
            const draftOrder = await draftRes.json();
            if (draftOrder?.buyerId === user.id) {
              setCart((draftOrder.items || []).map((i: any) => ({ productId: i.productId, quantity: i.quantity })));
              setIsCartOpen(true);
            }
          }
        } else {
          // Load latest draft if it exists; otherwise use in-memory store
          if (user?.id) {
            const draftRes = await fetch('/api/orders/draft', { credentials: 'include' });
            if (draftRes.ok) {
              const draftOrder = await draftRes.json();
              if (draftOrder?.id && draftOrder?.items?.length) {
                setDraftId(draftOrder.id);
                setCart((draftOrder.items || []).map((i: any) => ({ productId: i.productId, quantity: i.quantity })));
              } else {
                setCart(getCart());
              }
            } else {
              setCart(getCart());
            }
          } else {
            setCart(getCart());
          }
        }
      } catch (err) {
        console.error('Failed to load catalog:', err);
        if (isMounted) {
          setError('Failed to load catalog data.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCatalog();

    // Check query param to open cart automatically (Mobile behavior)
    if (searchParams.get('openCart') === 'true') {
      setIsCartOpen(true);
      searchParams.delete('openCart');
      setSearchParams(searchParams);
    }

    return () => {
      isMounted = false;
    };
  }, [draftParam, openCartParam, setSearchParams, user?.id]);

  // Save Cart Effect
  useEffect(() => {
    // Skip initial sync to avoid clearing cart before hydration completes
    if (!cartInitRef.current) {
      cartInitRef.current = true;
      return;
    }
    const cleanCart = cart.filter(i => i.quantity > 0);
    setCartStore(cleanCart);
  }, [cart]);

  useEffect(() => {
    if (!user?.id) return;
    const handler = setTimeout(async () => {
      try {
        await fetch('/api/orders/draft', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ items: cart })
        });
      } catch (err) {
        console.error('Failed to save draft:', err);
      }
    }, 600);

    return () => clearTimeout(handler);
  }, [cart, user?.id]);


  // Filtering
  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

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

  const orderSubtotal = calculateTotal();
  const orderTax = orderSubtotal * taxRate;
  const orderTotal = orderSubtotal + orderTax;
  const parsedCreditAmount = Number.parseFloat(creditAmount);
  const safeCreditAmount = Number.isFinite(parsedCreditAmount) ? parsedCreditAmount : 0;
  const creditPercentage = orderTotal > 0 ? Math.min(100, Math.max(0, (safeCreditAmount / orderTotal) * 100)) : 0;

  const applyCreditPercentage = (percentage: number) => {
    setSelectedCreditPercentage(percentage);
    setCreditAmount(((orderTotal * percentage) / 100).toFixed(2));
  };

  const openCreditRequestModal = () => {
    if (orderTotal <= 0) return;
    applyCreditPercentage(100);
    setCreditReason('');
    setCreditPaymentTerms('Net 15');
    setIsCreditModalOpen(true);
  };

  const submitOrder = async (status: OrderStatus) => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return null;
    if (!user?.id) {
      alert('Please log in to place an order.');
      return null;
    }

    const orderId = draftId || `ORD-${Date.now().toString().slice(-6)}`;
    const statusValue = status === OrderStatus.DRAFT ? 'Draft' : 'Pending';
    const now = new Date();

    const newOrder: Order = {
      id: orderId,
      buyerId: user.id,
      date: now.toISOString().split('T')[0],
      status: statusValue as OrderStatus,
      createdBy: 'buyer',
      items: validItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        priceAtOrder: products.find(p => p.id === i.productId)?.price || 0
      })),
      subtotal: orderSubtotal,
      tax: orderTax,
      total: orderTotal,
      amountPaid: 0,
      paymentStatus: 'Unpaid',
      history: [{ 
        status: status === OrderStatus.DRAFT ? 'Draft Saved' : 'Order Placed',
        date: now.toLocaleString(),
        note: status === OrderStatus.DRAFT ? 'Order saved as draft' : 'Order submitted via online catalog'
      }]
    };

    try {
      const response = await fetch(draftId ? `/api/orders/${orderId}` : '/api/orders', {
        method: draftId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newOrder,
          status: statusValue
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit order');
      }

      return newOrder;
    } catch (err) {
      console.error('Order submission failed:', err);
      throw err;
    }
  };

  const handleOrderAction = async (status: OrderStatus) => {
    try {
      const newOrder = await submitOrder(status);
      if (!newOrder) return;

      setCart([]);
      setIsCartOpen(false);
      clearCart();
      setDraftId(null);
      setRequestCredit(false);

      if (status === OrderStatus.DRAFT) {
        alert('Order saved as draft.');
      } else {
        alert(`Order #${newOrder.id} placed successfully!`);
      }

      navigate('/orders');
    } catch (err) {
      alert('Failed to submit order. Please try again.');
    }
  };

  const handleSubmitAndRequestCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCreditReason = creditReason.trim();

    if (!safeCreditAmount || safeCreditAmount <= 0) {
      alert('Please enter a valid credit amount.');
      return;
    }

    if (safeCreditAmount > orderTotal) {
      alert(`Credit amount cannot exceed ETB ${orderTotal.toLocaleString()}.`);
      return;
    }

    if (trimmedCreditReason.length > 1000) {
      alert('Notes cannot exceed 1000 characters.');
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const newOrder = await submitOrder(OrderStatus.PENDING);
      if (!newOrder) return;

      const creditResponse = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: newOrder.id,
          amount: Number(safeCreditAmount.toFixed(2)),
          reason: 'Order Financing',
          notes: trimmedCreditReason
            ? `${trimmedCreditReason} (${creditPercentage.toFixed(1)}% of order total requested)`
            : `${creditPercentage.toFixed(1)}% of order total requested`,
          paymentTerms: creditPaymentTerms
        })
      });

      if (!creditResponse.ok) {
        const errorData = await creditResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit credit request');
      }

      setCart([]);
      setIsCartOpen(false);
      setIsCreditModalOpen(false);
      clearCart();
      setDraftId(null);
      setRequestCredit(false);

      alert(`Order #${newOrder.id} placed and credit request submitted successfully.`);
      navigate('/credit');
    } catch (err) {
      console.error('Submit and request credit failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit order and credit request.');
    } finally {
      setIsSubmittingOrder(false);
    }
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
          className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-row gap-3 group hover:shadow-xl hover:border-[#00A3C4]/20 transition-all duration-300 cursor-pointer h-full"
        >
          <div className="relative w-20 h-20 lg:w-14 lg:h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-50 shrink-0">
            <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute top-1 right-1 flex flex-col items-end gap-1">
              {isOutOfStock ? (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase rounded-lg shadow-md block">{t('buyer.soldOut')}</span>
              ) : isLowStock ? (
                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase rounded-lg shadow-md block animate-pulse">{t('buyer.lowStock')}</span>
              ) : (
                <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-lg shadow-md block">{t('buyer.inStock')}</span>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-[#00A3C4] tracking-widest truncate">{p.brand}</p>
              <h3 className="font-bold text-slate-900 text-xs leading-tight line-clamp-2">{p.name}</h3>
              <p className="text-[10px] text-gray-400 font-medium">SKU: {p.sku}</p>
            </div>

            <div className="flex items-end justify-between mt-1">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Wholesale</p>
                <p className="text-sm font-black text-slate-800">{p.price.toLocaleString()} <span className="text-[10px]">ETB</span></p>
              </div>

              <div onClick={(e) => e.stopPropagation()}>
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
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <LoadingState message="Loading cart..." />
          </div>
        ) : cart.length === 0 || cart.every(i => i.quantity === 0) ? (
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

      {!isLoading && (cart.length > 0 && cart.some(i => i.quantity > 0)) && (
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
              onClick={() => {
                if (requestCredit) {
                  openCreditRequestModal();
                  return;
                }
                handleOrderAction(OrderStatus.PENDING);
              }}
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
                className="relative size-12 bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-slate-600 shadow-sm"
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
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl font-semibold">
              {error}
            </div>
          )}
          <section>
             <div className="flex items-center gap-2 mb-4">
               <span className="material-symbols-outlined text-[#00A3C4]">stars</span>
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('buyer.recommended')}</h3>
             </div>
             {isLoading ? (
               <LoadingState message="Loading catalog..." />
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  {products.slice(0, 3).map(p => renderProductCard(p))}
               </div>
             )}
          </section>

          <section>
             <div className="flex items-center gap-2 mb-4">
               <span className="material-symbols-outlined text-slate-400">grid_view</span>
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Catalog</h3>
             </div>
             {isLoading ? (
               <LoadingState message="Loading catalog..." />
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  {filteredProducts.map(p => renderProductCard(p))}
               </div>
             )}
             
             {!isLoading && filteredProducts.length === 0 && (
                <div className="py-20 text-center">
                  <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">search_off</span>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No products match your search</p>
                </div>
             )}
          </section>
        </div>
      </div>

      <div className={`fixed inset-0 z-50 transition-all duration-300 ${isCartOpen ? 'visible' : 'invisible'}`}>
        <div 
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isCartOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsCartOpen(false)}
        ></div>
        <div className={`absolute top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl transition-transform duration-300 flex flex-col ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <CartContent isMobile={true} />
        </div>
      </div>

      <div className={`fixed bottom-6 left-4 right-4 z-30 transition-all duration-300 transform ${cart.length > 0 && !isCartOpen ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="w-full lg:w-[420px] lg:mx-auto bg-[#00A3C4] hover:bg-[#008CA8] text-white p-4 lg:p-3.5 rounded-2xl shadow-xl shadow-[#00A3C4]/30 flex items-center justify-between transition-all active:scale-95"
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

      {isCreditModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm overflow-y-auto px-4 py-8 sm:py-10">
          <div className="min-h-full flex items-start justify-center">
            <div className="w-full max-w-lg rounded-[32px] bg-white shadow-2xl border border-white/60 overflow-hidden my-auto max-h-[calc(100vh-4rem)] flex flex-col">
            <div className="p-8 pb-6 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-2xl bg-[#E0F7FA] text-[#00A3C4] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">credit_score</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Credit Request</h3>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Choose how much of this order should go on credit</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreditModalOpen(false)}
                  className="size-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitAndRequestCredit} className="p-8 space-y-6 overflow-y-auto">
              <div className="rounded-3xl bg-slate-50 border border-slate-200 p-5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Order Total</span>
                  <span>Requested Credit</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl font-black text-slate-900">ETB {orderTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">Tax included</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#00A3C4]">ETB {safeCreditAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">{creditPercentage.toFixed(1)}% of order total</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Credit Percentage</label>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[25, 50, 75, 100].map((percentage) => (
                    <button
                      key={percentage}
                      type="button"
                      onClick={() => applyCreditPercentage(percentage)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                        selectedCreditPercentage === percentage
                          ? 'border-[#00A3C4] bg-[#E0F7FA] text-[#008CA8] shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {percentage}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Custom Credit Amount (ETB)</label>
                <input
                  type="number"
                  min="0"
                  max={orderTotal}
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => {
                    setSelectedCreditPercentage(0);
                    setCreditAmount(e.target.value);
                  }}
                  className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] outline-none transition-all"
                  placeholder="Enter custom amount"
                />
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  The percentage updates automatically from the amount you enter.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Repayment Terms</label>
                <div className="relative mt-2">
                  <select
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] outline-none transition-all"
                    value={creditPaymentTerms}
                    onChange={(e) => setCreditPaymentTerms(e.target.value as 'Net 15' | 'Net 30')}
                  >
                    <option value="Net 15">15 Days</option>
                    <option value="Net 30">30 Days</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#00A3C4]/20 focus:border-[#00A3C4] outline-none transition-all"
                  placeholder="Add any note for this credit request"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreditModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="flex-[1.4] py-3.5 bg-[#00A3C4] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#00A3C4]/20 hover:bg-[#008CA8] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmittingOrder ? 'Submitting...' : 'Submit and Request'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerCatalog;
