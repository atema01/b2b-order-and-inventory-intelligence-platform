import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// KEEP type imports
import { Order, Product, OrderStatus } from '../types';

const normalizeStatus = (value: any): OrderStatus => {
  if (typeof value !== 'string') return OrderStatus.PENDING;
  const map: Record<string, OrderStatus> = {
    DRAFT: OrderStatus.DRAFT,
    PENDING: OrderStatus.PENDING,
    PROCESSING: OrderStatus.PROCESSING,
    SHIPPED: OrderStatus.SHIPPED,
    DELIVERED: OrderStatus.DELIVERED,
    UNDELIVERED: OrderStatus.UNDELIVERED,
    CANCELLED: OrderStatus.CANCELLED,
    DELETED: OrderStatus.DELETED,
    Draft: OrderStatus.DRAFT,
    Pending: OrderStatus.PENDING,
    Processing: OrderStatus.PROCESSING,
    Shipped: OrderStatus.SHIPPED,
    Delivered: OrderStatus.DELIVERED,
    Undelivered: OrderStatus.UNDELIVERED,
    Cancelled: OrderStatus.CANCELLED,
    Deleted: OrderStatus.DELETED
  };
  return map[value] || OrderStatus.PENDING;
};

const OrderProcess: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Local picked state for instant feedback
  const [localPicked, setLocalPicked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchOrderProcessData = async () => {
      if (!id) {
        navigate('/orders');
        return;
      }
      
      try {
        setLoading(true);
        const [orderRes, productsRes] = await Promise.all([
          fetch(`/api/orders/${id}`, { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' })
        ]);

        if (!orderRes.ok || !productsRes.ok) {
          navigate('/orders');
          return;
        }

        const [orderData, productsData] = await Promise.all([
          orderRes.json(),
          productsRes.json()
        ]);

        const processedOrder = {
          ...orderData,
          status: normalizeStatus(orderData.status),
          subtotal: parseFloat(orderData.subtotal),
          tax: parseFloat(orderData.tax),
          total: parseFloat(orderData.total),
          amountPaid: parseFloat(orderData.amountPaid),
          stockDeducted: Boolean(orderData.stockDeducted),
          items: orderData.items.map((item: any) => ({
            ...item,
            priceAtOrder: parseFloat(item.priceAtOrder),
            quantity: parseInt(item.quantity),
            picked: Boolean(item.picked)
          }))
        };

        setOrder(processedOrder);
        setProducts(productsData);
        
        // Initialize local picked state from server data
        const initialPicked: Record<string, boolean> = {};
        orderData.items.forEach((item: any) => {
          initialPicked[item.id] = Boolean(item.picked);
        });
        setLocalPicked(initialPicked);
      } catch (err) {
        console.error('Failed to fetch order process ', err);
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderProcessData();
  }, [id, navigate]);

  const togglePick = useCallback(async (itemId: string, productId: string) => {
    // Update local state immediately for instant feedback
    setLocalPicked(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));

    try {
      // Sync to backend
      await fetch(`/api/orders/${id}/items/${itemId}/pick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          picked: !localPicked[itemId] 
        })
      });

      // Update order status if needed
      if (normalizeStatus(order?.status) === OrderStatus.PENDING && !localPicked[itemId]) {
        await fetch(`/api/orders/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            status: OrderStatus.PROCESSING,
            note: 'First item picked - moved to processing'
          })
        });
        
        // Update local order status
        if (order) {
          setOrder({ ...order, status: OrderStatus.PROCESSING });
        }
      }
    } catch (err) {
      console.error('Toggle pick error:', err);
      // Revert local state on error
      setLocalPicked(prev => ({
        ...prev,
        [itemId]: prev[itemId]
      }));
    }
  }, [id, localPicked, order]);

  const handleComplete = async () => {
    if (!order) return;

    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          status: OrderStatus.SHIPPED, 
          note: 'Processing completed and items shipped' 
        })
      });

      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          navigate('/orders');
        }, 2000);
      }
    } catch (err) {
      console.error('Complete order error:', err);
    }
  };

  const handleExit = () => {
    navigate('/orders');
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading fulfillment details...</p>
      </div>
    );
  }

  if (!order) return <div className="p-8">Order not found.</div>;

  const pickedCount = Object.values(localPicked).filter(picked => picked).length;
  const allPicked = pickedCount === order.items.length;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="size-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 scale-in-center">
          <span className="material-symbols-outlined text-6xl font-bold">local_shipping</span>
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-2">Order Shipped!</h2>
        <p className="text-gray-500 font-medium max-w-xs mx-auto">
          Order #{order.id} has been processed and is now in transit.
        </p>
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex gap-1">
             <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
             <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-75"></div>
             <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-150"></div>
          </div>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Returning to Orders list</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-40">
      <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
             <button 
                onClick={handleExit}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-primary transition-all lg:hidden"
             >
                <span className="material-symbols-outlined">arrow_back</span>
             </button>
             <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">
               Fulfillment Checklist
             </h2>
          </div>
          <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-3 py-1 rounded-full">
            {pickedCount} / {order.items.length} Picked
          </span>
        </div>
        
        <div className="space-y-3">
          {order.items.map((item) => {
            const p = products.find(prod => prod.id === item.productId);
            const isPicked = localPicked[item.id] ?? item.picked;
            return (
              <label 
                key={item.id}
                className={`
                  flex items-center gap-4 p-5 bg-white rounded-[28px] shadow-sm border-2 transition-all cursor-pointer group
                  ${isPicked ? 'border-primary bg-primary/[0.02]' : 'border-white hover:border-gray-100'}
                `}
              >
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={isPicked}
                    onChange={() => togglePick(item.id.toString(), item.productId)}
                    className="size-7 rounded-full border-2 border-gray-200 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer"
                  />
                  {isPicked && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white text-[10px] font-black">
                      <span className="material-symbols-outlined text-sm">check</span>
                    </span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className={`font-black text-lg leading-none ${isPicked ? 'text-primary' : 'text-slate-800'}`}>
                      {p?.name || 'Product'}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-tight">SKU: {p?.sku}</span>
                    <p className="text-sm font-bold text-slate-500">
                      <span className="text-slate-900 font-black">{item.quantity}</span> units
                    </p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start gap-4 shadow-sm">
          <span className="material-symbols-outlined text-amber-600 font-bold">info</span>
          <div>
            <p className="text-xs text-amber-900 font-black uppercase tracking-tight mb-1">Session Progress Persisted</p>
            <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
              Your picks are saved automatically. The order is now marked as <strong>{order.status.toUpperCase()}</strong>.
            </p>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-4 z-40">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex gap-3">
             <button 
                onClick={handleExit}
                className="flex-1 py-5 bg-gray-50 text-slate-500 rounded-[24px] font-black text-sm active:scale-95 transition-all"
             >
                Exit
             </button>
             <button 
                disabled={!allPicked}
                onClick={handleComplete}
                className={`
                  flex-[2] py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl
                  ${allPicked 
                    ? 'bg-primary text-white shadow-primary/20 active:scale-95' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}
                `}
              >
                <span className="material-symbols-outlined">local_shipping</span>
                Ship Order
              </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OrderProcess;



