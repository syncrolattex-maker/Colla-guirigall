import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, Settings, MapPin, CheckCircle, Plus, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserData } from '../App';

interface CalendarProps {
  user: UserData;
  selectedEventId?: number | null;
  setSelectedEventId?: (id: number | null) => void;
}

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

export default function CalendarView({ user, selectedEventId, setSelectedEventId }: CalendarProps) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [allAttendances, setAllAttendances] = useState<Record<number, Record<string, Attendance>>>({});
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<AppEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'Actuació',
    date: '',
    location: '',
    notes: ''
  });

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });
    if (error) console.error("Error fetching events:", error);
    else setEvents(data || []);
    setLoading(false);
  };

  const fetchAttendances = async () => {
    const { data, error } = await supabase.from('attendances').select('*');
    if (error) console.error("Error fetching attendances:", error);
    else {
      const attData: Record<number, Record<string, Attendance>> = {};
      data?.forEach(att => {
        if (!attData[att.eventId]) attData[att.eventId] = {};
        attData[att.eventId][att.userId] = att;
      });
      setAllAttendances(attData);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) console.error("Error fetching users:", error);
    else setUsers(data || []);
  };

  useEffect(() => {
    fetchEvents();
    fetchAttendances();
    fetchUsers();

    const eventsChannel = supabase.channel('public:events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents).subscribe();
    const attendancesChannel = supabase.channel('public:attendances').on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, fetchAttendances).subscribe();
    const usersChannel = supabase.channel('public:users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers).subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(attendancesChannel);
      supabase.removeChannel(usersChannel);
    };
  }, []);

  useEffect(() => {
    if (selectedEventId && events.length > 0) {
      const ev = events.find(e => e.id === selectedEventId);
      if (ev) setViewingEvent(ev);
    }
  }, [selectedEventId, events]);

  const closeEventModal = () => {
    setViewingEvent(null);
    if (setSelectedEventId) setSelectedEventId(null);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const isRehearsal = newEvent.type.startsWith('Assaig');
    if ((!newEvent.title && !isRehearsal) || !newEvent.date) return;

    try {
      const finalTitle = newEvent.title || newEvent.type;
      const { error } = await supabase.from('events').insert({
        ...newEvent,
        title: finalTitle,
        createdBy: user.name,
        createdAt: new Date().toISOString()
      });
      if (error) throw error;
      setIsAdding(false);
      setNewEvent({ title: '', type: 'Actuació', date: '', location: '', notes: '' });
    } catch (error) {
      console.error("Error adding event:", error);
      alert("Hi ha hagut un error en afegir l'esdeveniment.");
    }
  };

  const handleAttendance = async (eventId: number, status: 'Vull anar-hi' | 'No puc' | 'Pendent', targetUserId: string = user.uid) => {
    try {
      const currentConvocat = allAttendances[eventId]?.[targetUserId]?.convocat || false;
      const { error } = await supabase.from('attendances').upsert({
        eventId,
        userId: targetUserId,
        status,
        convocat: currentConvocat,
        updatedAt: new Date().toISOString()
      }, { onConflict: 'eventId, userId' });
      if (error) throw error;
    } catch (error) {
      console.error("Error updating attendance:", error);
      alert("Error en actualitzar l'assistència.");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ca-ES', { 
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 pb-24 md:pb-8">
      <div className="flex-1">
        <div className="flex border-b border-[#d44211]/10 mb-6 gap-8 justify-between items-center">
          <div className="flex gap-8">
            <button className="flex flex-col items-center justify-center border-b-[3px] border-[#d44211] text-slate-900 pb-3 pt-2">
              <span className="text-sm font-bold tracking-wide">Pròxims</span>
            </button>
            <button className="flex flex-col items-center justify-center border-b-[3px] border-transparent text-slate-500 hover:text-slate-700 pb-3 pt-2">
              <span className="text-sm font-bold tracking-wide">Passats</span>
            </button>
          </div>
          {user.role === 'admin' && (
            <button 
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-[#d44211] text-white font-bold rounded-lg hover:bg-[#d44211]/90 transition-all flex items-center gap-2 text-sm mb-2"
            >
              <Plus size={16} /> Nou Esdeveniment
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-6 text-slate-900">Pròximes actuacions i assajos</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d44211]"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
            No hi ha esdeveniments programats.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {events.map(event => {
              const eventAtts = allAttendances[event.id] || {};
              const myAttendance = eventAtts[user.uid]?.status;
              const amIConvocat = eventAtts[user.uid]?.convocat;
              const confirmedCount = (Object.values(eventAtts) as Attendance[]).filter(a => a.status === 'Vull anar-hi').length;
              const declinedCount = (Object.values(eventAtts) as Attendance[]).filter(a => a.status === 'No puc').length;
              
              return (
                <div key={event.id} className="flex flex-col md:flex-row bg-white rounded-xl overflow-hidden shadow-sm border border-[#d44211]/5 hover:shadow-md transition-shadow">
                  <div className="w-full md:w-48 h-40 md:h-auto bg-[#d44211]/10 flex items-center justify-center p-6 text-center">
                    <div>
                      <div className="text-[#d44211] font-black text-xl">{event.type}</div>
                      <div className="text-slate-500 text-sm mt-2">{new Date(event.date).toLocaleDateString('ca-ES')}</div>
                    </div>
                  </div>
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{event.title}</h3>
                        <div className="flex items-center gap-2 text-[#d44211] font-medium text-sm mb-2">
                          <CalendarIcon size={14} />
                          <span>{formatDate(event.date)}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <MapPin size={14} />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.notes && (
                          <p className="text-sm text-slate-600 mt-2 italic">{event.notes}</p>
                        )}
                      </div>
                      {event.isPublished && amIConvocat && myAttendance !== 'No puc' && (
                        <span className="px-3 py-1 bg-[#d44211] text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-sm shadow-[#d44211]/20">
                          <CheckCircle size={12} /> Convocat
                        </span>
                      )}
                      {event.isPublished && !amIConvocat && myAttendance === 'Vull anar-hi' && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                          No convocat
                        </span>
                      )}
                      {!event.isPublished && myAttendance === 'Vull anar-hi' && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                          <CheckCircle size={12} /> Inscrit
                        </span>
                      )}
                      {myAttendance === 'No puc' && (
                        <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                          No assisteix
                        </span>
                      )}
                      {!myAttendance && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                          Pendent
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle size={16} /> {confirmedCount} inscrits
                        </div>
                        <div className="flex items-center gap-1 text-red-500 font-medium">
                          <X size={16} /> {declinedCount} no vénen
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => setViewingEvent(event)} 
                          className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg text-sm hover:bg-slate-50 transition-colors"
                        >
                          Veure Detalls
                        </button>
                        {myAttendance === 'Vull anar-hi' ? (
                          <button onClick={() => handleAttendance(event.id, 'No puc')} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg text-sm hover:bg-slate-200 transition-colors">
                            Cancel·lar assistència
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleAttendance(event.id, 'No puc')} className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg text-sm hover:bg-slate-50 transition-colors">
                              No puc
                            </button>
                            <button onClick={() => handleAttendance(event.id, 'Vull anar-hi')} className="px-6 py-2 bg-[#d44211] text-white font-bold rounded-lg text-sm hover:bg-[#d44211]/90 transition-colors shadow-sm shadow-[#d44211]/20">
                              Vull anar-hi
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {viewingEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8f6f6]">
              <h3 className="text-xl font-bold text-slate-900">Detalls de l'esdeveniment</h3>
              <button onClick={closeEventModal} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <div className="inline-block px-3 py-1 bg-[#d44211]/10 text-[#d44211] font-bold text-sm rounded-full mb-3">
                  {viewingEvent.type}
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">{viewingEvent.title}</h2>
                <div className="flex flex-col gap-2 text-slate-600">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-[#d44211]" />
                    <span>{formatDate(viewingEvent.date)}</span>
                  </div>
                  {viewingEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#d44211]" />
                      <span>{viewingEvent.location}</span>
                    </div>
                  )}
                </div>
                {viewingEvent.notes && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-slate-700 whitespace-pre-wrap">{viewingEvent.notes}</p>
                  </div>
                )}
              </div>

              {viewingEvent.isPublished ? (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Users size={20} className="text-[#d44211]" />
                    Llista de Convocats
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-2 bg-slate-50 p-3 border-b border-slate-200 font-bold text-sm text-slate-700">
                      <div>Músic</div>
                      <div>Instrument</div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      {users
                        .filter(u => allAttendances[viewingEvent.id]?.[u.uid]?.convocat)
                        .map(u => (
                          <div key={u.uid} className="grid grid-cols-2 p-3 text-sm items-center">
                            <div className="font-medium text-slate-900">{u.name}</div>
                            <div className="text-slate-500">{u.instrument || 'Sense assignar'}</div>
                          </div>
                        ))}
                      {users.filter(u => allAttendances[viewingEvent.id]?.[u.uid]?.convocat).length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          Encara no hi ha cap músic convocat.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center">
                  La llista de convocats encara no s'ha publicat.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8f6f6]">
              <h3 className="text-xl font-bold text-slate-900">Nou Esdeveniment</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="add-event-form" onSubmit={handleAddEvent} className="space-y-4">
                {!newEvent.type.startsWith('Assaig') && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Títol *</label>
                    <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="Ex: Diada Castellera" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Tipus</label>
                    <select 
                      value={newEvent.type} 
                      onChange={e => {
                        const type = e.target.value;
                        const location = type.startsWith('Assaig') ? 'Plaça Numero 8, 7A, 46290, Valencia' : newEvent.location;
                        setNewEvent({...newEvent, type, location});
                      }} 
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211] bg-white"
                    >
                      <option value="Actuació">Actuació</option>
                      <option value="Assaig Colleta">Assaig Colleta</option>
                      <option value="Assaig Cambra">Assaig Cambra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data i Hora *</label>
                    <input required type="datetime-local" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Ubicació</label>
                  <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="Ex: Plaça de la Vila" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Notes / Observacions</label>
                  <textarea value={newEvent.notes} onChange={e => setNewEvent({...newEvent, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" rows={3} placeholder="Detalls de la convocatòria..."></textarea>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-[#f8f6f6] flex justify-end gap-3">
              <button onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">
                Cancel·lar
              </button>
              <button type="submit" form="add-event-form" className="px-6 py-3 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-colors shadow-lg shadow-[#d44211]/20">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
