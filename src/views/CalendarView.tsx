import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, Settings, MapPin, CheckCircle, Plus, X } from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserData } from '../App';

interface CalendarProps {
  user: UserData;
}

interface AppEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  location: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface Attendance {
  eventId: string;
  userId: string;
  status: 'Vull anar-hi' | 'No puc' | 'Pendent';
}

export default function CalendarView({ user }: CalendarProps) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'Actuació',
    date: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    // Fetch events
    const unsubscribeEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData: AppEvent[] = [];
      snapshot.forEach((doc) => {
        eventsData.push({ id: doc.id, ...doc.data() } as AppEvent);
      });
      // Sort by date ascending
      eventsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(eventsData);
      setLoading(false);
    });

    // Fetch user attendances
    const q = query(collection(db, 'attendances'), where("userId", "==", user.uid));
    const unsubscribeAttendances = onSnapshot(q, (snapshot) => {
      const attData: Record<string, Attendance> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as Attendance;
        attData[data.eventId] = data;
      });
      setAttendances(attData);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeAttendances();
    };
  }, [user.uid]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;

    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        createdBy: user.name,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewEvent({ title: '', type: 'Actuació', date: '', location: '', notes: '' });
    } catch (error) {
      console.error("Error adding event:", error);
      alert("Hi ha hagut un error en afegir l'esdeveniment.");
    }
  };

  const handleAttendance = async (eventId: string, status: 'Vull anar-hi' | 'No puc') => {
    try {
      const attendanceId = `${eventId}_${user.uid}`;
      await setDoc(doc(db, 'attendances', attendanceId), {
        eventId,
        userId: user.uid,
        status,
        updatedAt: new Date().toISOString()
      });
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
    <div className="max-w-5xl mx-auto px-6 py-8 pb-24 md:pb-8 flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-[#d44211] text-white cursor-pointer">
          <CalendarIcon size={20} />
          <p className="text-sm font-bold">Calendari</p>
        </div>
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#d44211]/5 text-slate-700 cursor-pointer transition-colors">
          <Users size={20} className="text-slate-500" />
          <p className="text-sm font-medium">Assajos</p>
        </div>
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#d44211]/5 text-slate-700 cursor-pointer transition-colors">
          <Users size={20} className="text-slate-500" />
          <p className="text-sm font-medium">Membres</p>
        </div>
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#d44211]/5 text-slate-700 cursor-pointer transition-colors">
          <Settings size={20} className="text-slate-500" />
          <p className="text-sm font-medium">Configuració</p>
        </div>
      </aside>

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
              const myAttendance = attendances[event.id]?.status;
              
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
                      {myAttendance === 'Vull anar-hi' && (
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
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
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
              );
            })}
          </div>
        )}
      </div>

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
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Títol *</label>
                  <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="Ex: Diada Castellera" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Tipus</label>
                    <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211] bg-white">
                      <option value="Actuació">Actuació</option>
                      <option value="Assaig">Assaig</option>
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
