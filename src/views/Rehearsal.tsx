import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, FileText, ExternalLink, Info, MapPin } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserData } from '../App';

interface RehearsalProps {
  user: UserData;
}

interface AppEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  location: string;
  notes: string;
}

export default function Rehearsal({ user }: RehearsalProps) {
  const [nextRehearsal, setNextRehearsal] = useState<AppEvent | null>(null);
  const [attendance, setAttendance] = useState<'Vull anar-hi' | 'No puc' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch next rehearsal
    const q = query(collection(db, 'events'), where("type", "==", "Assaig"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const events: AppEvent[] = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() } as AppEvent);
      });
      
      // Filter future events and sort by date
      const now = new Date().getTime();
      const futureEvents = events.filter(e => new Date(e.date).getTime() > now - 86400000); // include today
      futureEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setNextRehearsal(futureEvents.length > 0 ? futureEvents[0] : null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!nextRehearsal) return;
    
    // Fetch user attendance for this rehearsal
    const attendanceId = `${nextRehearsal.id}_${user.uid}`;
    const unsubscribe = onSnapshot(doc(db, 'attendances', attendanceId), (docSnap) => {
      if (docSnap.exists()) {
        setAttendance(docSnap.data().status);
      } else {
        setAttendance(null);
      }
    });

    return () => unsubscribe();
  }, [nextRehearsal, user.uid]);

  const handleAttendance = async (status: 'Vull anar-hi' | 'No puc') => {
    if (!nextRehearsal) return;
    try {
      const attendanceId = `${nextRehearsal.id}_${user.uid}`;
      await setDoc(doc(db, 'attendances', attendanceId), {
        eventId: nextRehearsal.id,
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
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d44211]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-24 md:pb-8 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Gestió d'assajos</h1>
        <p className="text-slate-600">Consulta el repertori i confirma la teva assistència.</p>
      </div>

      {!nextRehearsal ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-[#d44211]/5">
          <CalendarIcon size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No hi ha assajos programats</h2>
          <p className="text-slate-500">Aviat s'anunciaran les properes dates d'assaig.</p>
        </div>
      ) : (
        <>
          <section className="bg-white rounded-xl p-6 shadow-sm border border-[#d44211]/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarIcon size={20} className="text-[#d44211]" />
                  <h2 className="text-xl font-bold text-slate-900">{nextRehearsal.title}</h2>
                </div>
                <p className="text-slate-600 capitalize">{formatDate(nextRehearsal.date)}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAttendance('Vull anar-hi')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${attendance === 'Vull anar-hi' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                >
                  <CheckCircle size={18} /> Assistiré
                </button>
                <button 
                  onClick={() => handleAttendance('No puc')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${attendance === 'No puc' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'}`}
                >
                  <XCircle size={18} /> No puc
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#d44211]/80">Repertori i Scores</h3>
              <div className="grid gap-3">
                {[
                  { title: 'La Santa Espina', desc: 'Sardana' },
                  { title: 'Toc de Castells', desc: 'Tradicional' }
                ].map((song, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-[#f8f6f6] rounded-lg border border-[#d44211]/5 hover:border-[#d44211]/20 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-[#d44211]/10 text-[#d44211] rounded-full group-hover:bg-[#d44211] group-hover:text-white transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 leading-tight">{song.title}</p>
                        <p className="text-xs text-slate-500">{song.desc}</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-[#d44211] font-medium hover:underline">
                      <span className="text-sm hidden sm:inline">Veure Partitura</span>
                      <ExternalLink size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            {nextRehearsal.notes && (
              <div className="bg-[#d44211]/5 rounded-xl p-6 border border-[#d44211]/10">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Info size={20} className="text-[#d44211]" /> Notes de l'assaig
                </h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {nextRehearsal.notes}
                </p>
              </div>
            )}
            {nextRehearsal.location && (
              <div className="bg-[#d44211]/5 rounded-xl p-6 border border-[#d44211]/10">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <MapPin size={20} className="text-[#d44211]" /> Ubicació
                </h3>
                <p className="text-sm text-slate-700">
                  {nextRehearsal.location}
                </p>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(nextRehearsal.location)}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[#d44211] text-xs font-bold hover:underline">Obrir a Google Maps</a>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
