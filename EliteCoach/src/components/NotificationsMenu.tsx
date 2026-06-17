import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { notificationsApi, unwrapApiList } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";

interface Notification {
  id: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function NotificationsMenu() {
  const { isLoggedIn, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    
    const fetchNotifications = async () => {
      try {
        const res = await notificationsApi.get("/api/v1/notifications/");
        const data = unwrapApiList(res.data) as Notification[];
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      } catch (err) {
        // silent fail
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [isLoggedIn, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.post(`/api/v1/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.post("/api/v1/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  if (!isLoggedIn) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-coral rounded-full border-2 border-surface-card" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-card border border-border shadow-lg rounded-md overflow-hidden z-50">
          <div className="p-3 border-b border-border flex justify-between items-center bg-surface">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-secondary">
                No notifications yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    className={`p-3 hover:bg-surface transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <p className={`text-sm ${!notif.read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                        {notif.subject}
                      </p>
                      {!notif.read && (
                        <button 
                          onClick={() => markAsRead(notif.id)}
                          className="text-text-secondary hover:text-primary flex-shrink-0 cursor-pointer"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">{notif.body}</p>
                    <p className="text-[10px] text-text-secondary/60 mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
