import { useState, useEffect } from 'react';
import { ChevronDown, CheckCircle, MoreVertical, XCircle, Home, Calendar, Users, Archive } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserData } from '../App';

interface AdminProps {
  user: UserData;
}

interface AppEvent {
  id: number;
  title: string;
  date: string;
  type: string;
  ispublished?: boolean;
}

interface Member {
  uid: string;
  name: string;
  role: string;
  instrument: string;
  avatar: string;
}

export default function Admin({ user }: AdminProps) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendances, setAttendances] = useState<Record<string, {status: string, convocat: boolean}>>({});
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    const now = new Date().getTime();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'Actuació')
      .gte('date', new Date(now - 86400000).toISOString())
      .order('date', { ascending: true });
    if (error) console.error("Error fetching events:", error);
    else {
      setEvents(data || []);
      if (data && data.length > 0 && !selectedEventId) {
        setSelectedEventId(data[0].id);
      }
    }
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) console.error("Error fetching members:", error);
    else {
      setMembers((data || []).map(d => ({
        uid: d.uid,
        name: d.name,
        role: d.role === 'admin' ? 'Administrador' : 'Membre',
        instrument: d.instrument || 'Sense assignar',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=d44211&color=fff`
      })));
    }
  };

  const fetchAttendances = async () => {
    if (!selectedEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('eventid', selectedEventId);
    if (error) console.error("Error fetching attendances:", error);
    else {
      const attendanceData: Record<string, {status: string, convocat: boolean}> = {};
      data?.forEach(d => {
        attendanceData[d.userid] = {
          status: d.status,
          convocat: d.convocat || false
        };
      });
      setAttendances(attendanceData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    fetchMembers();

    const eventsChannel = supabase.channel('public:events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents).subscribe();
    const usersChannel = supabase.channel('public:users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchMembers).subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(usersChannel);
    };
  }, []);

  useEffect(() => {
    fetchAttendances();
    const attendancesChannel = supabase.channel('public:attendances').on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, fetchAttendances).subscribe();
    return () => { supabase.removeChannel(attendancesChannel); };
  }, [selectedEventId]);

  const handleAttendanceChange = async (userId: string, newStatus: string) => {
    if (!selectedEventId) return;
    try {
      const { error } = await supabase.from('attendances').upsert({
        eventid: selectedEventId,
        userid: userId,
        status: newStatus,
        convocat: attendances[userId]?.convocat || false,
        updatedat: new Date().toISOString()
      }, { onConflict: 'eventid, userid' });
      if (error) throw error;
    } catch (error) {
      console.error("Error updating attendance:", error);
      alert("Error en actualitzar l'assistència.");
    }
  };

  const handleConvocatChange = async (userId: string, convocat: boolean) => {
    if (!selectedEventId) return;
    try {
      const { error } = await supabase.from('attendances').upsert({
        eventid: selectedEventId,
        userid: userId,
        status: attendances[userId]?.status || 'Pendent',
        convocat: convocat,
        updatedat: new Date().toISOString()
      }, { onConflict: 'eventid, userid' });
      if (error) throw error;
    } catch (error) {
      console.error("Error updating convocat:", error);
      alert("Error en actualitzar la convocatòria.");
    }
  };

  const handlePublish = async () => {
    if (!selectedEventId) return;
    try {
      const { error: eventError } = await supabase
        .from('events')
        .update({ ispublished: true })
        .eq('id', selectedEventId);
      if (eventError) throw eventError;

      const event = events.find(e => e.id === selectedEventId);
      const eventTitle = event?.title || 'Actuació';
      const eventDate = event ? new Date(event.date).toLocaleString('ca-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

      const notifications = combinedData
        .filter(m => m.convocat)
        .map(m => ({
          userid: m.uid,
          title: 'Convocatòria Confirmada',
          message: `Has estat convocat per a l'actuació "${eventTitle}" el dia ${eventDate}. Revisa el calendari per a més detalls.`,
          read: false,
          createdat: new Date().toISOString(),
          link: 'calendar',
          eventid: selectedEventId
        }));

      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) throw notifError;
      }

      alert("S'ha publicat la llista i enviat les notificacions als músics convocats.");
    } catch (error) {
      console.error("Error publishing event:", error);
      alert("Error en publicar la llista.");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ca-ES', { 
      day: 'numeric', month: 'short' 
    }).format(date);
  };

  const combinedData = members.map(m => ({
    ...m,
    status: attendances[m.uid]?.status || 'Pendent',
    convocat: attendances[m.uid]?.convocat || false
  }));

  const manageableMusicians = combinedData.filter(m => m.status === 'Vull anar-hi');
  const otherMusicians = combinedData.filter(m => m.status !== 'Vull anar-hi');

  const totalVoluntaris = combinedData.filter(m => m.convocat).length;
  const dolcaines = combinedData.filter(m => m.convocat && m.instrument.toLowerCase().includes('dolçaina')).length;
  const tabals = combinedData.filter(m => m.convocat && m.instrument.toLowerCase().includes('tabal')).length;
  const percussio = combinedData.filter(m => m.convocat && !m.instrument.toLowerCase().includes('dolçaina') && !m.instrument.toLowerCase().includes('tabal')).length;

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="flex flex-col lg:flex-row min-h-full">
      <aside className="w-full lg:w-64 border-r border-[#d44211]/10 p-4 flex flex-col gap-6 bg-white shrink-0">
        <div className="flex flex-col gap-1 px-2">
          <h1 className="text-slate-900 text-base font-bold">Panell d'Admin</h1>
          <p className="text-slate-500 text-xs">Gestió de la Colla</p>
        </div>
        <nav className="flex flex-col gap-2">
          <button className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-[#d44211]/5 rounded-lg transition-colors w-full text-left">
            <Home size={20} /> <span className="text-sm font-medium">Inici</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 bg-[#d44211] text-white rounded-lg shadow-lg shadow-[#d44211]/20 w-full text-left">
            <Calendar size={20} /> <span className="text-sm font-medium">Convocatòries</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-[#d44211]/5 rounded-lg transition-colors w-full text-left">
            <Users size={20} /> <span className="text-sm font-medium">Músics</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-[#d44211]/5 rounded-lg transition-colors w-full text-left">
            <Archive size={20} /> <span className="text-sm font-medium">Inventari</span>
          </button>
        </nav>
      </aside>

      <div className="flex-1 p-6 md:p-8 flex flex-col gap-8 pb-24 md:pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestió de Convocatòria</h2>
              {selectedEvent?.ispublished && (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                  <CheckCircle size={12} /> Publicat
                </span>
              )}
            </div>
            <p className="text-slate-500">Revisió de disponibilitat i confirmació final per a les actuacions</p>
          </div>
          <div className="relative min-w-[300px]">
            <label className="text-xs font-bold text-[#d44211] uppercase mb-1 block">Selecciona l'actuació</label>
            <div className="relative">
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-white border border-[#d44211]/20 rounded-lg px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-[#d44211] focus:border-[#d44211] outline-none"
              >
                {events.length === 0 && <option value="">Cap actuació propera</option>}
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {formatDate(event.date)}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} className="absolute right-3 top-2.5 pointer-events-none text-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#d44211]/10 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total Voluntaris</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-[#d44211]">{totalVoluntaris}</span>
              <span className="text-sm text-slate-400">músics</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#d44211]/10 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Dolçaines</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900">{dolcaines}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#d44211]/10 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Tabals</p>
            <span className="text-2xl font-black text-slate-900">{tabals}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#d44211]/10 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Altres</p>
            <span className="text-2xl font-black text-slate-900">{percussio}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#d44211]/10 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d44211]/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-slate-900">Músics disponibles (Vull anar-hi)</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">{otherMusicians.length} persones han dit que no poden o no han respost</span>
              <button onClick={handlePublish} className="px-4 py-2 bg-[#d44211] text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#d44211]/90 transition-colors">
                <CheckCircle size={16} /> Confirmar Convocatòria
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#d44211]/5 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <th className="px-6 py-3 w-12 text-center">Convocat</th>
                  <th className="px-6 py-3">Músic</th>
                  <th className="px-6 py-3">Instrument</th>
                  <th className="px-6 py-3">Estat</th>
                  <th className="px-6 py-3 text-right">Accions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d44211]/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#d44211]"></div>
                    </td>
                  </tr>
                ) : manageableMusicians.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Encara no hi ha músics que hagin confirmat disponibilitat ("Vull anar-hi").
                    </td>
                  </tr>
                ) : (
                  manageableMusicians.map((m) => (
                    <tr key={m.uid} className={`hover:bg-[#d44211]/5 transition-colors ${m.status === 'No puc' ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={m.convocat} 
                          onChange={(e) => handleConvocatChange(m.uid, e.target.checked)}
                          className="w-5 h-5 rounded border-[#d44211]/30 text-[#d44211] focus:ring-[#d44211] cursor-pointer" 
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={m.avatar} alt={m.name} className={`w-10 h-10 rounded-full object-cover ${m.status === 'No puc' ? 'grayscale' : ''}`} />
                          <div>
                            <p className={`font-bold text-slate-900 text-sm ${m.status === 'No puc' ? 'line-through' : ''}`}>{m.name}</p>
                            <p className="text-xs text-slate-500">{m.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${m.instrument.toLowerCase().includes('dolçaina') ? 'bg-[#d44211]/10 text-[#d44211]' : 'bg-slate-100 text-slate-600'}`}>
                          {m.instrument}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={m.status}
                          onChange={(e) => handleAttendanceChange(m.uid, e.target.value)}
                          className={`text-sm font-bold rounded-lg px-3 py-1.5 border-0 focus:ring-2 focus:ring-[#d44211] outline-none cursor-pointer ${
                            m.status === 'Vull anar-hi' ? 'bg-green-100 text-green-700' : 
                            m.status === 'No puc' ? 'bg-red-100 text-red-700' : 
                            'bg-amber-100 text-amber-700'
                          }`}
                        >
                          <option value="Pendent">Pendent</option>
                          <option value="Vull anar-hi">Vull anar-hi</option>
                          <option value="No puc">No puc</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-[#d44211] transition-colors">
                          <MoreVertical size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-[#d44211]/5 flex justify-between items-center text-xs font-bold text-slate-500">
            <p>Mostrant {manageableMusicians.length} músics disponibles</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#d44211]/10 p-6 rounded-xl border border-[#d44211]/20">
          <div className="flex flex-col">
            <span className="text-lg font-black text-[#d44211] leading-tight">Convocatòria Final</span>
            <span className="text-sm text-slate-600">Enviarem notificació als {totalVoluntaris} músics confirmats.</span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-6 py-3 border border-[#d44211]/50 text-[#d44211] font-bold rounded-lg hover:bg-[#d44211]/5 transition-colors">
              Guardar Esborrany
            </button>
            <button onClick={handlePublish} className="flex-1 sm:flex-none px-6 py-3 bg-[#d44211] text-white font-bold rounded-lg shadow-lg shadow-[#d44211]/30 hover:bg-[#d44211]/90 transition-all">
              Publicar Llista
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
