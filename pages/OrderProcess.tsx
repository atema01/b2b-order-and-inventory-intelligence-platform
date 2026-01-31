
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/databaseService';
import { Order, Product, OrderStatus } from '../types';

const OrderProcess: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (id) {
      const o = db.getOrder(id);
      if (o) {
        setOrder(o);
      }
      setProducts(db.getAllProducts());
    }
  }, [id]);

  const togglePick = (productId: string) => {
    if (!order) return;

    const updatedItems = order.items.map(item => 
      item.productId === productId ? { ...item, picked: !item.picked } : item
    );

    // If it was PENDING, change to PROCESSING on first pick
    let newStatus = order.status;
    if (order.status === OrderStatus.PENDING) {
      newStatus = OrderStatus.PROCESSING;
    }

    const updatedOrder = { 
      ...order, 
      status: newStatus,
      items: updatedItems 
    };
    
    db.updateOrder(updatedOrder);
    setOrder(updatedOrder);
  };

  const handleComplete = () => {
    if (order) {
      const updatedOrder = {
        ...order,
        status: OrderStatus.SHIPPED,
        history: [...order.history, { 
          status: 'Shipped', 
          date: new Date().toLocaleString(), 
          note: 'Processing completed and items shipped' 
        }]
      };
      db.updateOrder(updatedOrder);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/orders');
      }, 2000);
    }
  };

  const handleExit = () => {
    navigate('/orders');
  };

  if (!order) return <div className="p-8">Order not found.</div>;

  const pickedCount = order.items.filter(i => i.picked).length;
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
          {order.items.map((item, i) => {
            const p = products.find(prod => prod.id === item.productId);
            const isPicked = item.picked;
            return (
              <label 
                key={i} 
                className={`
                  flex items-center gap-4 p-5 bg-white rounded-[28px] shadow-sm border-2 transition-all cursor-pointer group
                  ${isPicked ? 'border-primary bg-primary/[0.02]' : 'border-white hover:border-gray-100'}
                `}
              >
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={!!isPicked}
                    onChange={() => togglePick(item.productId)}
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
