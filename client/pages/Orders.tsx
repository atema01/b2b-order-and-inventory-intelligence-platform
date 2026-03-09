import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Order, OrderStatus, Buyer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

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
    CANCELED: OrderStatus.CANCELLED,
    DELETED: OrderStatus.DELETED,
    Draft: OrderStatus.DRAFT,
    Pending: OrderStatus.PENDING,
    Processing: OrderStatus.PROCESSING,
    Shipped: OrderStatus.SHIPPED,
    Delivered: OrderStatus.DELIVERED,
    Undelivered: OrderStatus.UNDELIVERED,
    Cancelled: OrderStatus.CANCELLED,
    Canceled: OrderStatus.CANCELLED,
    Deleted: OrderStatus.DELETED
  };
  return map[value] || OrderStatus.PENDING;
};

const Orders: React.FC = () => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [activeTab, setActiveTab] = useState<string>('All Orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(9);
  const navigate = useNavigate();

  const normalizeOrders = (ordersData: any[]) =>
    ordersData.map((o: any) => ({
      ...o,
      status: normalizeStatus(o.status)
    }));

  // Resolve buyer label from embedded order fields first, then buyers lookup.
  const getBuyerLabel = (order: any): string => {
    return (
      order?.buyerCompanyName ||
      order?.buyerName ||
      order?.companyName ||
      order?.buyer?.companyName ||
      order?.buyer?.name ||
      buyers.find(b => b.id === order?.buyerId)?.companyName ||
      'Unknown Buyer'
    );
  };

  // Fetch orders and buyers from real API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Orders page requires Orders data; buyers lookup is optional for names/search.
        const ordersRes = await fetch('/api/orders', { credentials: 'include' });
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (ordersData?.data) {
            setOrders(normalizeOrders(ordersData.data));
          } else {
            setOrders(normalizeOrders(ordersData));
          }
        } else {
          setOrders([]);
        }

        // If user lacks Buyers permission this may return 403; keep page functional.
        const buyersRes = await fetch('/api/buyers', { credentials: 'include' });
        if (buyersRes.ok) {
          const buyersData = await buyersRes.json();
          setBuyers(Array.isArray(buyersData) ? buyersData : []);
        } else {
          setBuyers([]);
        }
      } catch (err) {
        console.error('Failed to fetch orders/buyers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  const tabs = [
    { id: 'All Orders', label: t('status.all') },
    { id: 'Draft', label: t('status.draft') },
    { id: 'Pending', label: t('status.pending') },
    { id: 'Processing', label: t('status.processing') },
    { id: 'Shipped', label: t('status.shipped') },
    { id: 'Delivered', label: t('status.delivered') },
    { id: 'Undelivered', label: t('status.undelivered') },
    { id: 'Cancelled', label: t('status.cancelled') },
    { id: 'Deleted', label: t('status.deleted') }
  ];

  const filteredOrders = orders.filter(order => {
  const orderStatus = normalizeStatus(order.status);

  if (activeTab === 'All Orders') {
    if (orderStatus === OrderStatus.DRAFT && order.createdBy === 'buyer') return false;
    return ![OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.DELETED].includes(orderStatus);
  }

  const tabStatus = normalizeStatus(activeTab);
  return orderStatus === tabStatus;
});
  const searchLower = searchQuery.trim().toLowerCase();
  const searchedOrders = searchLower
    ? filteredOrders.filter(order => {
        const buyerName = getBuyerLabel(order);
        return (
          order.id.toLowerCase().includes(searchLower) ||
          buyerName.toLowerCase().includes(searchLower)
        );
      })
    : filteredOrders;

  const totalFiltered = searchedOrders.length;
  const startIndex = (page - 1) * limit;
  const pagedOrders = searchedOrders.slice(startIndex, startIndex + limit);
  const getStatusStyles = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case OrderStatus.DRAFT:
        return 'bg-gray-50 text-gray-500 border-gray-100';
      case OrderStatus.PROCESSING:
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case OrderStatus.SHIPPED:
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case OrderStatus.DELIVERED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case OrderStatus.UNDELIVERED:
        return 'bg-red-50 text-red-700 border-red-100';
      case OrderStatus.CANCELLED:
        return 'bg-red-50 text-red-500 border-red-100 opacity-60';
      case OrderStatus.DELETED:
        return 'bg-red-50 text-red-600 border-red-200 opacity-80';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const handleStatusUpdate = async (e: React.MouseEvent, orderId: string, newStatus: OrderStatus) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Refresh orders list
        const ordersRes = await fetch('/api/orders', { credentials: 'include' });
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (ordersData?.data) {
            setOrders(normalizeOrders(ordersData.data));
          } else {
            setOrders(normalizeOrders(ordersData));
          }
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Update order status error:', err);
      alert('Network error. Please try again.');
    }
  };

  const handleActionClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(path);
  };

  return (
    <div className="min-h-full bg-gray-50 pb-32">
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <div className="flex flex-col lg:flex-row gap-3 pt-4">
            <div className="flex-1 relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl font-light">search</span>
              <input 
                type="text"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium placeholder:text-gray-400 transition-all shadow-inner"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Link 
              to="/orders/create"
              className="hidden lg:flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              {t('order.new')}
            </Link>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 mt-4 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-5 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all uppercase tracking-widest border
                  ${activeTab === tab.id 
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-white border-gray-100 text-slate-400 hover:bg-gray-50'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-10 lg:pt-12 pb-12 lg:px-8">
        {loading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading orders...</p>
          </div>
        ) : pagedOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {pagedOrders.map(order => {
              const buyerLabel = getBuyerLabel(order);
              const isDraft = order.status === OrderStatus.DRAFT;
              const isPending = order.status === OrderStatus.PENDING;
              const isProcessing = order.status === OrderStatus.PROCESSING;
              const isShipped = order.status === OrderStatus.SHIPPED;
              const isDeleted = order.status === OrderStatus.DELETED;

              return (
                <Link 
                  key={order.id} 
                  to={isDraft ? `/orders/create?edit=${order.id}` : `/orders/${order.id}`}
                  className={`group block bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-primary/20 active:scale-[0.98] lg:active:scale-100 ${isDeleted ? 'opacity-60 grayscale-[0.5]' : ''}`}
                >
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest truncate">
                      {order.id}
                    </span>
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border ${getStatusStyles(order.status)}`}>
                      {t(`status.${order.status.toLowerCase()}` as any)}
                    </span>
                  </div>

                  <div className="mb-8">
                    <h3 className={`text-xl font-black text-slate-800 leading-tight group-hover:text-primary transition-colors ${isDeleted ? 'line-through' : ''}`}>
                      {buyerLabel}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-2 opacity-50">
                       <span className="material-symbols-outlined text-sm">calendar_today</span>
                       <p className="text-[10px] font-black uppercase tracking-widest">{order.date}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-end pt-6 border-t border-gray-50">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Wholesale Value</p>
                      <p className="text-xl font-black text-slate-900 tracking-tight">
                        ETB {order.total.toLocaleString()}
                      </p>
                    </div>

                    {!isDeleted && isDraft && (
                      <button 
                        onClick={(e) => handleStatusUpdate(e, order.id, OrderStatus.PENDING)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
                      >
                        {t('order.submit')}
                      </button>
                    )}
                    
                    {!isDeleted && (isPending || isProcessing) && (
                      <button 
                        onClick={(e) => handleActionClick(e, `/orders/${order.id}/process`)}
                        className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all active:scale-95"
                      >
                        {t('order.process')}
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center bg-white rounded-[40px] border-4 border-dashed border-gray-100">
            <span className="material-symbols-outlined text-6xl text-gray-100 mb-4">receipt_long</span>
            <h3 className="text-xl font-black text-slate-800">No orders found</h3>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-2">Adjust your filters or search terms</p>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalFiltered > limit && (
          <div className="flex items-center justify-center gap-4 pt-10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm font-bold text-gray-500">
              Page {page} of {Math.max(1, Math.ceil(totalFiltered / limit))}
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(totalFiltered / limit), p + 1))}
              disabled={page >= Math.ceil(totalFiltered / limit)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Link 
        to="/orders/create"
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-50 border-4 border-white group"
        title={t('order.new')}
      >
        <span className="material-symbols-outlined text-3xl font-light group-hover:rotate-90 transition-transform duration-300">add</span>
      </Link>
    </div>
  );
};

export default Orders;
