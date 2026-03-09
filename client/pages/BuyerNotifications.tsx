
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingState from '../components/LoadingState';

const BuyerNotifications: React.FC = () => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
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
  }, []);

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

  const handleNotificationClick = async (notif: Notification) => {
    try {
      await fetch(`/api/notifications/${notif.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err) {
      console.error('Delete notification error:', err);
    }

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

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{t('buyer.notifications')}</h1>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={handleMarkAllRead}
            className="text-xs font-black text-[#00A3C4] uppercase tracking-widest hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <LoadingState message="Loading notifications..." />
        ) : error ? (
          <div className="p-12 text-center text-red-600 font-semibold">{error}</div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {notifications.map((notif) => (
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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
               <span className="material-symbols-outlined text-4xl">notifications_none</span>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No alerts at the moment</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerNotifications;
