
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Notification } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingState from '../components/LoadingState';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import RefreshIndicator from '../components/RefreshIndicator';
import { buyerQueryKeys, loadBuyerNotifications } from '../services/buyerQueries';

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

const BuyerNotifications: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('New');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: notifications = [],
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: buyerQueryKeys.notifications(),
    queryFn: loadBuyerNotifications
  });
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';

  useRealtimeEvent('realtime:notifications', () => {
    queryClient.invalidateQueries({ queryKey: ['buyer-notifications'] });
  });

  const filteredNotifications = notifications.filter((notif) => {
    const matchesFilter =
      activeFilter === 'New'
        ? !notif.isRead
        : activeFilter === 'All'
          ? true
          : getNotificationCategory(notif) === activeFilter;

    if (!matchesFilter) return false;
    if (!query) return true;
    const haystack = [
      notif.title,
      notif.message,
      notif.type,
      getNotificationCategory(notif),
      notif.time,
      notif.severity,
      notif.relatedId || ''
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to mark all read');
      queryClient.setQueryData<Notification[]>(buyerQueryKeys.notifications(), (prev = []) =>
        prev.map((notification) => ({ ...notification, isRead: true }))
      );
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
      queryClient.setQueryData<Notification[]>(buyerQueryKeys.notifications(), (prev = []) =>
        prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
      );
    } catch (err) {
      console.error('Mark notification read error:', err);
      alert('Failed to mark notification as read.');
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    await handleMarkRead(notif);

    if (notif.type === 'Order' && notif.relatedId) {
      navigate(`/orders/${notif.relatedId}`);
    } else if (notif.type === 'Payment') {
      // Payment/Credit notifications route by related entity type.
      if (notif.relatedId?.startsWith('ORD-')) {
        navigate(`/orders/${notif.relatedId}`);
      } else if (notif.relatedId?.startsWith('CR-')) {
        navigate('/credit');
      } else {
        navigate('/orders');
      }
    }
  };

  const availableCategoryFilters = Array.from(
    new Set(notifications.map((notif) => getNotificationCategory(notif)))
  ) as Exclude<NotificationFilter, 'All' | 'New'>[];
  const filters = FILTER_PRIORITY.filter(
    (filter) => filter === 'New' || filter === 'All' || availableCategoryFilters.includes(filter as Exclude<NotificationFilter, 'All' | 'New'>)
  );

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('buyer.notifications')}</h1>
        <div className="flex items-center gap-3">
          <RefreshIndicator visible={isFetching && !isLoading} />
          {filteredNotifications.some(n => !n.isRead) && (
            <button 
              onClick={handleMarkAllRead}
              className="text-xs font-black text-[#00A3C4] uppercase tracking-widest hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
              activeFilter === filter
                ? 'border-[#00A3C4] bg-[#00A3C4] text-white shadow-lg shadow-[#00A3C4]/20'
                : 'border-gray-200 bg-white text-slate-500 hover:border-gray-300'
            }`}
          >
            {filter === 'New' ? `New Messages (${notifications.filter((notif) => !notif.isRead).length})` : filter}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <LoadingState message="Loading notifications..." />
        ) : error ? (
          <div className="p-12 text-center">
            <p className="font-semibold text-red-600">Failed to load notifications.</p>
            <p className="mt-2 text-sm text-red-500">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: buyerQueryKeys.notifications() })}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {filteredNotifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`p-6 flex gap-5 transition-colors cursor-pointer ${!notif.isRead ? 'bg-[#E0F7FA]/30' : 'hover:bg-gray-50'}`}
              >
                <div className="flex-shrink-0 relative">
                  <div className={`
                    size-12 rounded-2xl flex items-center justify-center
                    ${notif.severity === 'high' ? 'bg-red-50 text-red-500' : notif.severity === 'medium' ? 'bg-[#E0F7FA] text-[#00A3C4]' : 'bg-gray-100 text-gray-500'}
                  `}>
                    <span className="material-symbols-outlined">{notif.type === 'Order' ? 'local_shipping' : notif.type === 'Payment' ? 'credit_score' : 'info'}</span>
                  </div>
                  {!notif.isRead && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#00A3C4] border-4 border-white rounded-full"></span>}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-slate-900 text-sm leading-none">{notif.title}</h3>
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{notif.time}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-snug">{notif.message}</p>
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
                        className="text-[10px] font-black uppercase tracking-widest text-[#00A3C4] hover:underline"
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
          <div className="p-16 text-center">
            <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
               <span className="material-symbols-outlined text-4xl">notifications_none</span>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
              {activeFilter === 'New' ? 'No new messages' : `No ${activeFilter.toLowerCase()} notifications`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerNotifications;
