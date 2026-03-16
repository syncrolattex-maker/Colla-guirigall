import { useState, useEffect } from 'react';
import { ChevronDown, CheckCircle, MoreVertical, XCircle, Home, Calendar, Users, Archive } from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserData } from '../App';

interface AdminProps {
  user: UserData;
}

interface AppEvent {
  id: string;
  title: string;
  date: string;
}

interface Member {
  uid: string;
  name: string;
  role: string;
  instrument: string;
  avatar: string;
}

interface AttendanceRecord {
  userId: string;
  status: string;
}

export default function Admin({ user }: AdminProps) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [attendances, setAttendances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch future events
    const unsubscribeEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData: AppEvent[] = [];
      const now = new Date().getTime();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (new Date(data.date).getTime() > now - 86400000) {
          eventsData.push({ id: doc.id, title: data.title, date: data.date });
        }
      });
      eventsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(eventsData);
      if (eventsData.length > 0 && !selectedEventId) {
        setSelectedEventId(eventsData[0].id);
      }
    });

    // Fetch all users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: Member[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          uid: doc.id,
          name: data.name,
          role: data.role === 'admin' ? 'Administrador' : 'Membre',
          instrument: data.instrument || 'Sense assignar',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=d44211&color=fff`
        });
      });
      setMembers(usersData);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;

    setLoading(true);
    const q = query(collection(db, 'attendances'), where("eventId", "==", selectedEventId));
    const unsubscribeAttendances = onSnapshot(q, (snapshot) => {
      const attendanceData: Record<string, string> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        attendanceData[data.userId] = data.status;
      });
      setAttendances(attendanceData);
      setLoading(false);
    });

    return () => unsubscribeAttendances();
  }, [selectedEventId]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ca-ES', { 
      day: 'numeric', month: 'short' 
    }).format(date);
  };

  const combinedData = members.map(m => ({
    ...m,
    status: attendances[m.uid] || 'Pendent',
    checked: attendances[m.uid] === 'Vull anar-hi'
  }));

  const totalVoluntaris = combinedData.filter(m => m.status === 'Vull anar-hi').length;
  const dolcaines = combinedData.filter(m => m.status === 'Vull anar-hi' && m.instrument.toLowerCase().includes('dolçaina')).length;
  const tabals = combinedData.filter(m => m.status === 'Vull anar-hi' && m.instrument.toLowerCase().includes('tabal')).length;
  const percussio = combinedData.filter(m => m.status === 'Vull anar-hi' && !m.instrument.toLowerCase().includes('dolçaina') && !m.instrument.toLowerCase().includes('tabal')).length;

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
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestió de Convocatòria</h2>
            <p className="text-slate-500">Revisió de disponibilitat i confirmació final</p>
          </div>
          <div className="relative min-w-[300px]">
            <label className="text-xs font-bold text-[#d44211] uppercase mb-1 block">Selecciona l'esdeveniment</label>
            <div className="relative">
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-white border border-[#d44211]/20 rounded-lg px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-[#d44211] focus:border-[#d44211] outline-none"
              >
                {events.length === 0 && <option value="">Cap esdeveniment proper</option>}
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
            <h3 className="font-bold text-slate-900">Llistat d'Assistència</h3>
            <button className="px-4 py-2 bg-[#d44211] text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#d44211]/90 transition-colors">
              <CheckCircle size={16} /> Confirmar Convocatòria
            </button>
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
                ) : combinedData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No hi ha membres registrats.
                    </td>
                  </tr>
                ) : (
                  combinedData.map((m) => (
                    <tr key={m.uid} className={`hover:bg-[#d44211]/5 transition-colors ${m.status === 'No puc' ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 text-center">
                        <input type="checkbox" checked={m.checked} readOnly className="w-5 h-5 rounded border-[#d44211]/30 text-[#d44211] focus:ring-[#d44211] cursor-pointer" />
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
                        <div className={`flex items-center gap-1.5 ${m.status === 'Vull anar-hi' ? 'text-emerald-500' : m.status === 'No puc' ? 'text-red-500' : 'text-slate-400'}`}>
                          {m.status === 'Vull anar-hi' ? <CheckCircle size={16} /> : m.status === 'No puc' ? <XCircle size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>}
                          <span className="text-xs font-bold">{m.status}</span>
                        </div>
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
            <p>Mostrant {combinedData.length} membres de la colla</p>
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
            <button className="flex-1 sm:flex-none px-6 py-3 bg-[#d44211] text-white font-bold rounded-lg shadow-lg shadow-[#d44211]/30 hover:bg-[#d44211]/90 transition-all">
              Publicar Llista
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
