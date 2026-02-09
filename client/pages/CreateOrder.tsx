import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Product, Buyer, OrderStatus, Order } from '../types';

const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // Multi-step State
  const [step, setStep] = useState(1);

  // Form State
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerm, setPaymentTerm] = useState('Immediate');
  const [cart, setCart] = useState<{ productId: string, quantity: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [taxRate, setTaxRate] = useState(0.15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [buyersRes, productsRes, taxRes] = await Promise.all([
          fetch('/api/buyers', { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' }),
          fetch('/api/settings/tax-rate', { credentials: 'include' })
        ]);

        if (buyersRes.ok && productsRes.ok && taxRes.ok) {
          const [buyersData, productsData, taxData] = await Promise.all([
            buyersRes.json(),
            productsRes.json(),
            taxRes.json()
          ]);
          setBuyers(buyersData);
          setProducts(productsData);
          setTaxRate((taxData.taxRate ?? 0.15));

          // Handle edit mode
          if (editId) {
            const orderRes = await fetch(`/api/orders/${editId}`, { credentials: 'include' });
            if (orderRes.ok) {
              const order = await orderRes.json();
              setSelectedBuyerId(order.buyerId);
              setOrderDate(order.date);
              setPaymentTerm(order.paymentTerms || 'Immediate');
              setCart(order.items.map((i: any) => ({ 
                productId: i.productId, 
                quantity: i.quantity 
              })));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch order data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editId]);

  const selectedBuyer = useMemo(() => buyers.find(b => b.id === selectedBuyerId), [buyers, selectedBuyerId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, activeCategory]);

  const updateQuantity = (productId: string, delta: number) => {
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

  const calculateSubtotal = () => {
    return cart.reduce((acc, item) => {
      const p = products.find(prod => prod.id === item.productId);
      return acc + (item.quantity * (p?.price || 0));
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const tierDiscount = selectedBuyer ? subtotal * selectedBuyer.discountRate : 0;
  const taxableAmount = subtotal - tierDiscount;
  const tax = taxableAmount * taxRate;
  const grandTotal = taxableAmount + tax;

  const handleFinish = async (isDraft: boolean = false) => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return;
      if (!selectedBuyerId || selectedBuyerId === 'undefined') {
    alert('Please select a valid buyer');
    return;
  }
    if (!isDraft) {
    const insufficientStock = validItems.some(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return true;
      
      const totalStock = product.stock.mainWarehouse + 
                        product.stock.backRoom + 
                        product.stock.showRoom;
      return totalStock < item.quantity;
    });

    if (insufficientStock) {
      alert('Insufficient stock for one or more items. Please check inventory levels.');
      return;
    }
  }

    try {
      const orderPayload: any = {
        id: editId || `ORD-${Date.now().toString().slice(-6)}`,
        buyerId: selectedBuyerId,
        date: orderDate,
        status: isDraft ? 'Draft' : 'Pending',
        paymentTerms: paymentTerm,
        createdBy: 'seller',
        items: validItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          priceAtOrder: products.find(p => p.id === item.productId)?.price || 0
        })),
        subtotal: subtotal,
        tax: tax,
        total: grandTotal,
        amountPaid: 0,
        paymentStatus: 'Unpaid',
        history: [{ 
          status: isDraft ? 'Draft' : 'Pending', 
          date: new Date().toLocaleString(), 
          note: isDraft ? 'Saved as draft' : 'Stock deducted and order queued' 
        }]
      };

      let response;
      if (editId) {
        // Update existing order
        response = await fetch(`/api/orders/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(orderPayload)
        });
      } else {
        // Create new order
        response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(orderPayload)
        });
      }

      if (response.ok) {
        navigate('/orders');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save order');
      }
    } catch (err) {
      console.error('Save order error:', err);
      alert('Network error. Please try again.');
    }
  };

  const editProductInStep2 = (productId: string) => {
    setActiveCategory('All');
    setSearchQuery('');
    setStep(2);
    setTimeout(() => {
      const element = document.getElementById(`product-card-${productId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-primary/20', 'border-primary');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-primary/20', 'border-primary');
        }, 2000);
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="p-2 text-slate-600">
          <span className="material-symbols-outlined font-bold">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold text-slate-800">
          {step === 1 ? 'Create New Order' : step === 2 ? 'Add Products' : 'Review Order'}
        </h1>
      </header>

      {/* Progress Stepper */}
      <div className="max-w-xl mx-auto px-6 py-6 flex items-center justify-between relative">
        <div className="absolute left-6 right-6 h-0.5 bg-gray-100 top-[42%] -z-0"></div>
        {[
          { n: 1, label: 'BUYER' },
          { n: 2, label: 'PRODUCTS' },
          { n: 3, label: 'REVIEW' }
        ].map(s => (
          <div key={s.n} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`size-10 rounded-full flex items-center justify-center font-black text-sm transition-all border-4 border-white ${step === s.n ? 'bg-primary text-white shadow-lg shadow-primary/20' : step > s.n ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
              {step > s.n ? <span className="material-symbols-outlined text-sm font-black">check</span> : s.n}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${step === s.n ? 'text-primary' : 'text-gray-400'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-48">
        
        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading order form...</p>
          </div>
        )}

        {/* STEP 1: BUYER INFO */}
        {!loading && step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-lg font-black text-slate-800">Buyer Information</h2>
              <p className="text-sm text-gray-500 font-medium">Select the retail partner and order details.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 ml-1">Retail Buyer</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">store</span>
                  <select 
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none shadow-sm"
                    value={selectedBuyerId}
                    onChange={(e) => setSelectedBuyerId(e.target.value)}
                  >
                    <option value="">Select Buyer...</option>
                    {buyers.map(b => <option key={b.id} value={b.id}>{b.companyName} ({b.tier})</option>)}
                  </select>
                </div>
              </div>

              {selectedBuyer && (
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                  <span className="material-symbols-outlined text-emerald-600 font-bold">verified</span>
                  <div>
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Partner Benefit</p>
                    <p className="text-sm font-bold text-emerald-900">{selectedBuyer.tier} member discount ({(selectedBuyer.discountRate * 100)}%) will be applied.</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 ml-1">Order Date</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">calendar_today</span>
                  <input 
                    type="date"
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 ml-1">Payment Term</label>
                <div className="space-y-3">
                  {[
                    { id: 'Immediate', label: 'Immediate Payment', desc: 'Payment required upon order confirmation' },
                    { id: 'COD', label: 'Payment on Delivery', desc: 'Immediate payment upon receipt of goods' }
                  ].map(term => (
                    <div 
                      key={term.id}
                      onClick={() => setPaymentTerm(term.id)}
                      className={`
                        p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between
                        ${paymentTerm === term.id ? 'border-primary bg-primary/[0.03]' : 'border-gray-100 bg-white hover:border-gray-200'}
                      `}
                    >
                      <div className="space-y-0.5">
                        <p className={`font-black ${paymentTerm === term.id ? 'text-primary' : 'text-slate-800'}`}>{term.label}</p>
                        <p className="text-[11px] text-gray-500 font-medium">{term.desc}</p>
                      </div>
                      {paymentTerm === term.id ? (
                        <div className="size-6 bg-primary text-white rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm font-bold">check</span>
                        </div>
                      ) : (
                        <div className="size-6 border-2 border-gray-100 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ADD PRODUCTS */}
        {!loading && step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
              <input 
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl font-medium text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                placeholder="Search by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {['All', 'Lips', 'Face', 'Skincare', 'Eyes'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${activeCategory === cat ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-gray-100 text-gray-500'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredProducts.map(p => {
                const item = cart.find(i => i.productId === p.id);
                const qty = item?.quantity || 0;
                const outOfStock = (p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom) <= 0;

                return (
                  <div 
                    key={p.id} 
                    id={`product-card-${p.id}`}
                    className="bg-white p-4 rounded-[28px] border border-gray-100 shadow-sm flex gap-4 items-center transition-all duration-500 scroll-mt-24"
                  >
                    <img src={p.image} className="size-20 lg:size-24 rounded-2xl object-cover bg-gray-50 border border-gray-50" alt="" />
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-20 lg:h-24 py-1">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{p.name}</h4>
                          <p className={`text-[11px] font-black uppercase tracking-tighter ${outOfStock ? 'text-red-500' : 'text-emerald-600'}`}>
                            {outOfStock ? 'Out of stock' : `Stock: ${p.stock.mainWarehouse + p.stock.backRoom + p.stock.showRoom} units`}
                          </p>
                        </div>
                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-tighter whitespace-nowrap">SKU: {p.sku.slice(0, 8)}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className="text-lg font-black text-primary">{p.price.toLocaleString()} ETB</p>
                        <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
                          <button 
                            disabled={qty === 0}
                            onClick={() => updateQuantity(p.id, -1)}
                            className="size-8 rounded-xl bg-white text-slate-600 flex items-center justify-center hover:bg-gray-100 transition-all active:scale-90 disabled:opacity-20 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-lg">remove</span>
                          </button>
                          <input 
                              type="number"
                              className="w-12 text-center bg-transparent border-none p-0 text-slate-800 font-black focus:ring-0 appearance-none text-sm"
                              value={qty === 0 ? '' : qty}
                              placeholder={qty === 0 ? '0' : ''}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  const intVal = parseInt(val);
                                  setQuantity(p.id, isNaN(intVal) ? 0 : intVal);
                              }}
                              onBlur={() => handleInputBlur(p.id)}
                           />
                          <button 
                            disabled={outOfStock}
                            onClick={() => updateQuantity(p.id, 1)}
                            className="size-8 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-all active:scale-90 disabled:opacity-20 shadow-lg shadow-primary/20"
                          >
                            <span className="material-symbols-outlined text-lg">add</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW */}
        {!loading && step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Selected Products</h3>
              <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm divide-y divide-gray-50">
                {cart.filter(i => i.quantity > 0).map(item => {
                  const p = products.find(prod => prod.id === item.productId);
                  return (
                    <div key={item.productId} className="p-6 flex justify-between items-center">
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate mb-0.5">{p?.name}</p>
                        <p className="text-xs font-medium text-gray-400">{item.quantity} units × {p?.price.toLocaleString()} ETB</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <p className="text-base font-black text-slate-900">{(item.quantity * (p?.price || 0)).toLocaleString()} ETB</p>
                        <button 
                          onClick={() => editProductInStep2(item.productId)}
                          className="text-gray-300 hover:text-primary transition-colors flex items-center justify-center p-2"
                        >
                          <span className="material-symbols-outlined text-xl">edit_square</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 space-y-4">
               <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                  <span>Gross Subtotal</span>
                  <span>{subtotal.toLocaleString()}.00 ETB</span>
               </div>
               {tierDiscount > 0 && (
                 <div className="flex justify-between items-center text-sm font-black text-emerald-600">
                    <span>{selectedBuyer?.tier} Discount ({(selectedBuyer!.discountRate * 100)}%)</span>
                    <span>- {tierDiscount.toLocaleString()}.00 ETB</span>
                 </div>
               )}
               <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                  <span>Tax & Fees ({(taxRate * 100).toFixed(0)}%)</span>
                  <span>{tax.toLocaleString()}.00 ETB</span>
               </div>
               <div className="h-px bg-gray-50 my-4"></div>
               <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-slate-900">Grand Total</span>
                  <span className="text-2xl font-black text-primary tracking-tight">{grandTotal.toLocaleString()}.00 ETB</span>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Footer */}
      {!loading && (
        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-6 z-50 shadow-2xl">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
            
            {step === 2 && (
              <div className="w-full flex justify-between items-center mb-2 px-1">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Estimated Total</p>
                  <p className="text-xl font-black text-slate-800">{grandTotal.toLocaleString()}.00 <span className="text-xs">ETB</span></p>
                </div>
                <button 
                  disabled={cart.filter(i => i.quantity > 0).length === 0}
                  onClick={() => setStep(3)}
                  className="bg-primary text-white px-8 h-14 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-30"
                >
                  Review Order
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            )}

            {step === 1 && (
              <button 
                disabled={!selectedBuyerId}
                onClick={() => setStep(2)}
                className="w-full h-16 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-30"
              >
                Next: Add Products
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            )}

            {step === 3 && (
              <div className="w-full flex flex-col gap-3">
                <button 
                  onClick={() => handleFinish(false)}
                  className="w-full h-16 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                  Confirm & Place Order
                  <span className="material-symbols-outlined">shopping_bag</span>
                </button>
                <button 
                  onClick={() => handleFinish(true)}
                  className="w-full py-4 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-primary transition-all"
                >
                  Save as Draft (No Stock Deduction)
                </button>
                <p className="text-[10px] font-bold text-center text-gray-400 uppercase tracking-widest">Stock is deducted only upon placing the order.</p>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default CreateOrder;
