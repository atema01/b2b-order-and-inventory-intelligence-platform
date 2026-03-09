
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, Buyer, Product } from '../types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { printInvoice } from '../utils/printInvoice';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';

const BuyerOrders: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const toBuyerProfile = (me: any): Buyer => ({
      id: me?.id || user?.id || '',
      companyName: me?.companyName || 'Buyer Account',
      contactPerson: me?.name || 'Buyer',
      email: me?.email || '',
      phone: me?.phone || '',
      address: '',
      creditLimit: 0,
      availableCredit: 0,
      outstandingBalance: 0,
      paymentTerms: '',
      totalSpend: 0,
      totalOrders: 0,
      status: 'Active',
      tier: me?.tier || 'Bronze',
      discountRate: 0,
      joinDate: ''
    });

    const loadBuyerOrders = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [ordersRes, meRes, productsRes] = await Promise.all([
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' })
        ]);

        if (!ordersRes.ok) {
          throw new Error('Failed to load orders');
        }

        const ordersData = await ordersRes.json();
        const meData = meRes.ok ? await meRes.json() : null;
        const productsData = productsRes.ok ? await productsRes.json() : [];

        const ordersArray = Array.isArray(ordersData) ? ordersData : (ordersData?.data || []);
        const productsArray = Array.isArray(productsData) ? productsData : (productsData?.data || []);

        const buyerOrders = ordersArray.filter((o: Order) => {
          if (o.buyerId !== user.id) return false;
          // Buyers can see their own drafts, but not drafts created by others
          if (normalizeStatus(o.status) === OrderStatus.DRAFT && o.createdBy !== 'buyer') return false;
          return true;
        });

        if (!isMounted) return;

        setOrders(buyerOrders);
        setBuyer(meData ? toBuyerProfile(meData) : null);
        setProducts(productsArray);
      } catch (err) {
        console.error('Failed to load buyer orders:', err);
        if (isMounted) {
          setError('Failed to load order history.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadBuyerOrders();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (activeStatus === 'All') {
      // Show everything EXCEPT Cancelled and Deleted
      setFilteredOrders(orders.filter(o => 
        normalizeStatus(o.status) !== OrderStatus.CANCELLED && 
        normalizeStatus(o.status) !== OrderStatus.DELETED
      ));
    } else {
      setFilteredOrders(orders.filter(o => normalizeStatus(o.status) === activeStatus));
    }
  }, [activeStatus, orders]);

  const normalizeStatus = (status: OrderStatus | string) => {
    const value = status?.toString().trim().toUpperCase() || '';
    if (value === 'DRAFT') return OrderStatus.DRAFT;
    if (value === 'PENDING') return OrderStatus.PENDING;
    if (value === 'PROCESSING') return OrderStatus.PROCESSING;
    if (value === 'SHIPPED') return OrderStatus.SHIPPED;
    if (value === 'DELIVERED') return OrderStatus.DELIVERED;
    if (value === 'UNDELIVERED') return OrderStatus.UNDELIVERED;
    if (value === 'CANCELLED' || value === 'CANCELED') return OrderStatus.CANCELLED;
    if (value === 'DELETED') return OrderStatus.DELETED;
    return value as OrderStatus;
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(normalizeStatus(status)) {
      case OrderStatus.PENDING: return 'bg-amber-100 text-amber-800';
      case OrderStatus.PROCESSING: return 'bg-blue-100 text-blue-800';
      case OrderStatus.SHIPPED: return 'bg-purple-100 text-purple-800';
      case OrderStatus.DELIVERED: return 'bg-emerald-100 text-emerald-800';
      case OrderStatus.CANCELLED: return 'bg-red-50 text-red-600 border border-red-100';
      case OrderStatus.DELETED: return 'bg-gray-100 text-gray-500 border border-gray-200';
      case OrderStatus.DRAFT: return 'bg-gray-100 text-gray-800 border border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleInvoiceClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!buyer) {
      alert('Buyer profile unavailable.');
      return;
    }
    printInvoice(order, buyer, products);
  };

  const handlePayClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    navigate(`/payment/${orderId}`);
  };

  const canPay = (order: Order) => {
    const status = normalizeStatus(order.status);
    if (status === OrderStatus.PENDING || status === OrderStatus.PROCESSING || status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED) {
      return order.paymentStatus !== 'Paid';
    }
    return false;
  };

  // Filter tabs list
  const filterTabs = [
    'All', 
    OrderStatus.DRAFT, 
    OrderStatus.PENDING, 
    OrderStatus.PROCESSING, 
    OrderStatus.SHIPPED, 
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.DELETED
  ];

  if (isLoading) {
    return <LoadingState message="Loading order history..." />;
  }

  if (error) {
    return <div className="p-8 text-red-600 font-semibold">{error}</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 pb-32">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('nav.history')}</h1>
        
        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filterTabs.map(status => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`
                px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all
                ${activeStatus === status 
                  ? 'bg-[#00A3C4] border-[#00A3C4] text-white shadow-lg shadow-[#00A3C4]/20' 
                  : 'bg-white border-gray-100 text-slate-500 hover:bg-gray-50'}
              `}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[32px] border border-gray-100">
            <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">filter_list_off</span>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">{t('buyer.noOrders')}</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div 
              key={order.id} 
              onClick={() => navigate(`/orders/${order.id}`)}
              className={`
                bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group
                ${(normalizeStatus(order.status) === OrderStatus.CANCELLED || normalizeStatus(order.status) === OrderStatus.DELETED) ? 'opacity-70 grayscale' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 bg-gray-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-[#00A3C4] group-hover:bg-[#E0F7FA] transition-all">
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base lg:text-lg">#{order.id.replace('ORD-', '')}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                       <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${getStatusColor(order.status as OrderStatus)}`}>
                        {normalizeStatus(order.status)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {order.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                   <p className="text-lg font-black text-slate-900">ETB {order.total.toLocaleString()}</p>
                   <div className="flex items-center gap-2">
                     {normalizeStatus(order.status) !== OrderStatus.DRAFT && normalizeStatus(order.status) !== OrderStatus.CANCELLED && normalizeStatus(order.status) !== OrderStatus.DELETED && (
                       <button 
                        onClick={(e) => handleInvoiceClick(e, order)}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#00A3C4] hover:text-[#008CA8] bg-[#E0F7FA] hover:bg-[#B2EBF2] px-3 py-1.5 rounded-lg transition-colors"
                       >
                         <span className="material-symbols-outlined text-sm">download</span>
                         {t('buyer.invoice')}
                       </button>
                     )}
                     {canPay(order) && (
                       <button 
                        onClick={(e) => handlePayClick(e, order.id)}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white bg-[#00A3C4] hover:bg-[#008CA8] px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                       >
                         {t('buyer.pay')}
                       </button>
                     )}
                   </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BuyerOrders;
