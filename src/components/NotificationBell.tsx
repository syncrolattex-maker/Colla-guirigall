import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserData } from '../App';

interface AppNotification {
  id: number;
  userid: string;
  title: string;
  message: string;
  read: boolean;
  createdat: string;
  link?: string;
  eventid?: string;
}

export default function NotificationBell({ user, onNavigate }: { user: UserData, onNavigate: (view: any, eventId?: string) => void }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showToast, setShowToast] = useState<AppNotification | null>(null);
  const prevNotifsRef = useRef<AppNotification[]>([]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('userid', user.uid)
      .order('createdat', { ascending: false });
    
    if (error) {
      console.error("Error fetching notifications:", error);
    } else {
      setNotifications(data || []);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    // Check for new unread notifications that were not in our previous state
    const newNotifs = notifications.filter(n => 
      !n.read && !prevNotifsRef.current.some(p => p.id === n.id)
    );
    
    // If we have actual new notifications and this is not the first load (to avoid toast on initial login)
    if (newNotifs.length > 0 && prevNotifsRef.current.length > 0) {
      setShowToast(newNotifs[0]);
      setTimeout(() => setShowToast(null), 5000);
    }
    
    prevNotifsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: number, currentRead: boolean) => {
    if (currentRead) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error("Error marking as read", error);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    markAsRead(notif.id, notif.read);
    setIsOpen(false);
    if (notif.link) {
      onNavigate(notif.link, notif.eventid);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting notification", error);
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[#d44211]/10 text-[#d44211] hover:bg-[#d44211]/20 transition-colors relative"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
              {unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Notificacions</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-[#d44211] font-medium">{unreadCount} noves</span>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No tens cap notificació.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer ${!notif.read ? 'bg-[#d44211]/5' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notif.read ? 'bg-[#d44211]' : 'bg-transparent'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${!notif.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 mt-2">
                          {new Date(notif.createdat).toLocaleDateString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 h-fit"
                        title="Esborrar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast for new notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-white border border-[#d44211]/20 shadow-xl rounded-xl p-4 flex items-start gap-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-sm">
          <div className="w-8 h-8 rounded-full bg-[#d44211]/10 text-[#d44211] flex items-center justify-center shrink-0">
            <Bell size={16} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-900">{showToast.title}</h4>
            <p className="text-xs text-slate-600 mt-1">{showToast.message}</p>
          </div>
          <button onClick={() => setShowToast(null)} className="text-slate-400 hover:text-slate-600">
            <Trash2 size={14} className="opacity-0" /> {/* Spacer */}
          </button>
        </div>
      )}
    </>
  );
}
