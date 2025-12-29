import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../lib/api';
import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState({ total: 0, emergency: 0, urgent: 0, warning: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        notificationAPI.getAll({ limit: 10 }),
        notificationAPI.getUnreadCount()
      ]);
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data);
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  };

  const handleClick = async (notification) => {
    if (!notification.is_read) {
      await notificationAPI.markAsRead(notification.id);
      fetchNotifications();
    }
    if (notification.link_to) {
      navigate(notification.link_to);
    }
    setIsOpen(false);
  };

  const markAllRead = async () => {
    await notificationAPI.markAllAsRead();
    fetchNotifications();
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'emergency': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBadgeColor = () => {
    if (unreadCount.emergency > 0) return 'bg-red-500';
    if (unreadCount.urgent > 0) return 'bg-amber-500';
    if (unreadCount.warning > 0) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount.total > 0 && (
          <span className={`absolute -top-1 -right-1 ${getBadgeColor()} text-white text-xs rounded-full w-5 h-5 flex items-center justify-center`}>
            {unreadCount.total > 9 ? '9+' : unreadCount.total}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount.total > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`p-3 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                      !notif.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getAlertIcon(notif.alert_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!notif.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-2 border-t border-slate-200 dark:border-slate-700">
                <Button 
                  variant="ghost" 
                  className="w-full text-sm"
                  onClick={() => { navigate('/alerts'); setIsOpen(false); }}
                >
                  View All Alerts
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
