
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import LoadingState from '../components/LoadingState';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';

type NotificationFilter = 'New' | 'All' | 'Order' | 'Payment' | 'Credit' | 'Inventory' | 'System';

const getNotificationCategory = (notif: Notification): Exclude<NotificationFilter, 'All' | 'New'> => {
  const text = `${notif.title} ${notif.message}`.toLowerCase();
  if (notif.relatedId?.startsWith('CR-') || text.includes('credit')) return 'Credit';
  if (notif.type === 'Order') return 'Order';
  if (notif.type === 'Payment') return 'Payment';
  if (notif.type === 'Stock' || text.includes('inventory') || text.includes('stock') || text.includes('return')) return 'Inventory';
  return 'System';
};

const FILTER_PRIORITY: NotificationFilter[] = ['New', 'All', 'Order', 'Payment', 'Credit', 'Inventory', 'System'];

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('New');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        if (isMounted) setNotifications(data || []);
      } catch (err) {
        console.error('Load notifications error:', err);
        if (isMounted) setError('Failed to load notifications.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  useRealtimeEvent('realtime:notifications', () => {
    setRefreshToken((value) => value + 1);
  });

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to mark all read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
      alert('Failed to mark notifications as read.');
    }
  };

  const handleMarkRead = async (notif: Notification) => {
    if (notif.isRead) return;
    try {
      const res = await fetch(`/api/notifications/${notif.id}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to mark notification read');
      setNotifications(prev =>
        prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
      );
    } catch (err) {
      console.error('Mark notification read error:', err);
      alert('Failed to mark notification as read.');
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    await handleMarkRead(notif);

    if (!notif.relatedId) return;

    if (notif.type === 'Order') {
      navigate(`/orders/${notif.relatedId}`);
    } else if (notif.type === 'Stock') {
      navigate(`/products/${notif.relatedId}`);
    } else if (notif.type === 'Payment') {
      // Logic to distinguish credit requests from payments
      if (notif.relatedId.startsWith('CR-')) {
        navigate('/credits');
      } else {
        navigate(`/payments/${notif.relatedId}`);
      }
    }
  };

  const availableCategoryFilters = Array.from(
    new Set(notifications.map((notif) => getNotificationCategory(notif)))
  ) as Exclude<NotificationFilter, 'All' | 'New'>[];
  const filters = FILTER_PRIORITY.filter(
    (filter) => filter === 'New' || filter === 'All' || availableCategoryFilters.includes(filter as Exclude<NotificationFilter, 'All' | 'New'>)
  );
  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'New') return !notif.isRead;
    if (activeFilter === 'All') return true;
    return getNotificationCategory(notif) === activeFilter;
  });

  return (
    <div className="p-0 sm:p-4 lg:p-8 max-w-2xl mx-auto divide-y divide-gray-100 bg-white sm:bg-transparent min-h-screen">
      <div className="hidden sm:flex justify-between items-center mb-6 px-1">
        <h1 className="text-2xl font-black text-slate-800">Notifications</h1>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={handleMarkAllRead}
            className="text-sm font-bold text-primary hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:px-1">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
              activeFilter === filter
                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                : 'border-gray-200 bg-white text-slate-500 hover:border-gray-300'
            }`}
          >
            {filter === 'New' ? `New Messages (${notifications.filter((notif) => !notif.isRead).length})` : filter}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <LoadingState message="Loading notifications..." />
        ) : error ? (
          <div className="p-12 text-center text-red-600 font-semibold">{error}</div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {filteredNotifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`p-5 flex gap-4 transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
              >
                <div className="flex-shrink-0 relative">
                  <div className={`
                    size-12 rounded-2xl flex items-center justify-center
                    ${notif.severity === 'high' ? 'bg-red-50 text-red-600' : notif.severity === 'medium' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}
                  `}>
                    <span className="material-symbols-outlined">{notif.type === 'Stock' ? 'inventory_2' : notif.type === 'Order' ? 'shopping_bag' : notif.type === 'Payment' ? 'payments' : 'info'}</span>
                  </div>
                  {!notif.isRead && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary border-4 border-white rounded-full"></span>}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-slate-800 text-sm leading-none">{notif.title}</h3>
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{notif.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">{notif.message}</p>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {getNotificationCategory(notif)}
                    </span>
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMarkRead(notif);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
               <span className="material-symbols-outlined text-4xl">notifications_off</span>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
              {activeFilter === 'New' ? 'No new messages' : `No ${activeFilter.toLowerCase()} notifications`}
            </p>
          </div>
        )}
        
        {notifications.length > 0 && notifications.every(n => n.isRead) && (
           <div className="p-8 text-center bg-gray-50/50">
             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">You're all caught up!</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
