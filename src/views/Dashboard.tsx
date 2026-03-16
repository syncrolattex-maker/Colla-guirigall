import { useState, useEffect } from 'react';
import { Calendar, MapPin, Music, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserData } from '../App';

interface AppEvent {
  id: number;
  title: string;
  type: string;
  date: string;
  location: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  isPublished?: boolean;
}

interface Attendance {
  eventId: number;
  userId: string;
  status: 'Vull anar-hi' | 'No puc' | 'Pendent';
  convocat?: boolean;
}

interface DashboardProps {
  setView: (v: any) => void;
  user: UserData;
}

export default function Dashboard({ setView, user }: DashboardProps) {
  const [upcomingEvents, setUpcomingEvents] = useState<AppEvent[]>([]);
  const [attendances, setAttendances] = useState<Record<number, Attendance>>({});
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('date', now.toISOString())
      .order('date', { ascending: true });
      
    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setUpcomingEvents((data || []).slice(0, 3));
    }
    setLoading(false);
  };

  const fetchAttendances = async () => {
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('userId', user.uid);
      
    if (error) {
      console.error("Error fetching attendances:", error);
    } else {
      const attData: Record<number, Attendance> = {};
      data?.forEach(att => {
        attData[att.eventId] = att;
      });
      setAttendances(attData);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchAttendances();

    const eventsChannel = supabase
      .channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents)
      .subscribe();

    const attendancesChannel = supabase
      .channel('public:attendances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, fetchAttendances)
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(attendancesChannel);
    };
  }, [user.uid]);

  const handleAttendance = async (eventId: number, status: 'Vull anar-hi' | 'No puc') => {
    try {
      const { error } = await supabase
        .from('attendances')
        .upsert({
          eventId,
          userId: user.uid,
          status,
          convocat: attendances[eventId]?.convocat || false,
          updatedAt: new Date().toISOString()
        }, { onConflict: 'eventId, userId' });
        
      if (error) throw error;
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ca-ES', { 
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  const getMonthShort = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ca-ES', { month: 'short' }).format(date).toUpperCase();
  };

  const getDay = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate().toString();
  };
  return (
    <div className="max-w-md mx-auto p-6 flex flex-col gap-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900">Hola, {user.name.split(' ')[0]}!</h1>
        <p className="text-slate-500 text-base">Membre Actiu • {user.instrument}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setView('repertoire')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#d44211] text-white shadow-lg shadow-[#d44211]/20 hover:scale-[1.02] transition-transform">
          <Music size={32} className="mb-2" />
          <span className="text-sm font-bold">Repertori</span>
        </button>
        <button onClick={() => setView('calendar')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#d44211]/10 text-[#d44211] hover:bg-[#d44211]/20 transition-colors">
          <Calendar size={32} className="mb-2" />
          <span className="text-sm font-bold">El meu calendari</span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Pròxims Esdeveniments</h2>
          <button onClick={() => setView('calendar')} className="text-[#d44211] text-sm font-bold">Veure tots</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d44211]"></div>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">
            No hi ha esdeveniments pròxims.
          </div>
        ) : (
          upcomingEvents.map((event, index) => {
            const myAttendance = attendances[event.id]?.status;
            const isFirst = index === 0;

            if (isFirst) {
              // Highlight the very next event
              return (
                <div key={event.id} className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-[#d44211]/20 shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center rounded-full bg-[#d44211]/10 px-2 py-0.5 text-xs font-bold text-[#d44211] w-fit uppercase tracking-wider">
                        {event.type}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 leading-tight">{event.title}</h3>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-2 text-[#d44211] text-sm font-medium">
                      <Calendar size={16} />
                      <span className="capitalize">{formatDate(event.date)}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <MapPin size={16} />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>

                  {event.isPublished && attendances[event.id]?.convocat && (
                    <div className="mt-2 bg-[#d44211]/10 text-[#d44211] px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <CheckCircle size={16} /> Estàs convocat!
                    </div>
                  )}

                  <div className="mt-2 pt-3 border-t border-slate-100 flex gap-2">
                    {myAttendance === 'Vull anar-hi' ? (
                      <button onClick={() => handleAttendance(event.id, 'No puc')} className="flex-1 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-2">
                        <CheckCircle size={16} /> Assistiré
                      </button>
                    ) : myAttendance === 'No puc' ? (
                      <button onClick={() => handleAttendance(event.id, 'Vull anar-hi')} className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                        <XCircle size={16} /> No assistiré
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleAttendance(event.id, 'No puc')} className="flex-1 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">
                          No puc
                        </button>
                        <button onClick={() => handleAttendance(event.id, 'Vull anar-hi')} className="flex-1 py-2.5 bg-[#d44211] text-white rounded-lg text-sm font-bold hover:bg-[#d44211]/90 transition-colors shadow-sm shadow-[#d44211]/20">
                          Confirmar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            // Standard list item for other upcoming events
            return (
              <div key={event.id} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm cursor-pointer hover:border-[#d44211]/30 transition-colors" onClick={() => setView('calendar')}>
                <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-lg flex flex-col items-center justify-center border border-slate-200">
                  <span className="text-slate-700 font-black text-xl leading-none">{getDay(event.date)}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{getMonthShort(event.date)}</span>
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-[#d44211] uppercase tracking-wider">{event.type}</span>
                    {event.isPublished && attendances[event.id]?.convocat && (
                      <span className="w-2 h-2 rounded-full bg-[#d44211]" title="Convocat"></span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{event.title}</h3>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                    <Calendar size={12} />
                    <span>{new Date(event.date).toLocaleTimeString('ca-ES', {hour: '2-digit', minute:'2-digit'})}</span>
                    {event.location && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="truncate">{event.location}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {myAttendance === 'Vull anar-hi' && <CheckCircle size={16} className="text-green-500" />}
                  {myAttendance === 'No puc' && <XCircle size={16} className="text-red-500" />}
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
