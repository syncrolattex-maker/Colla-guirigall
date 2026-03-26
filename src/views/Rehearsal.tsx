import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, FileText, ExternalLink, Info, MapPin, Edit, X, Search, Headphones, PlayCircle, Play, Pause, Trash2, Plus, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserData } from '../App';

interface RehearsalProps {
  user: UserData;
}

interface AppEvent {
  id: number;
  title: string;
  type: string;
  date: string;
  location: string;
  notes: string;
  repertoireids?: number[];
}

interface SongPdf {
  instrument: string;
  url: string;
}

interface Song {
  id: number;
  title: string;
  composer: string;
  style: string;
  pdfs?: SongPdf[];
  mp3_url?: string;
  youtube_url?: string;
}

interface DBUser {
  uid: string;
  name: string;
  instrument: string;
}

interface DBAttendance {
  eventid: number;
  userid: string;
  status: string;
}

export default function Rehearsal({ user }: RehearsalProps) {
  const [rehearsals, setRehearsals] = useState<AppEvent[]>([]);
  const [attendances, setAttendances] = useState<Record<number, string | null>>({});
  const [allAttendances, setAllAttendances] = useState<DBAttendance[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [isEditingRepertoire, setIsEditingRepertoire] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeAudio, setActiveAudio] = useState<{url: string, title: string} | null>(null);

  const fetchSongs = async () => {
    const { data, error } = await supabase.from('songs').select('*');
    if (error) console.error("Error fetching songs:", error);
    else setAllSongs(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('uid, name, instrument');
    if (error) console.error("Error fetching users:", error);
    else setUsers(data || []);
  };

  const fetchNextRehearsal = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`type.ilike.Assaig%,type.eq.Intercanvi,type.eq.Final de curs,type.eq.Actuació`)
      .gte('date', new Date(new Date().getTime() - 86400000).toISOString())
      .order('date', { ascending: true });
      
    if (error) console.error("Error fetching events:", error);
    else {
      setRehearsals(data || []);
      // If we need to set selected ids for the "active" management, we'll do it per rehearsal card
    }
    setLoading(false);
  };

  const cleanupPastRehearsals = async () => {
    if (user.role !== 'admin') return;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .or(`type.ilike.Assaig%,type.eq.Intercanvi,type.eq.Final de curs`)
        .lt('date', oneDayAgo);
      if (error) throw error;
      console.log("Past rehearsals cleaned up");
    } catch (error) {
      console.error("Error cleaning up past rehearsals:", error);
    }
  };

  useEffect(() => {
    fetchSongs();
    fetchUsers();
    fetchNextRehearsal();
    cleanupPastRehearsals();

    const songsChannel = supabase.channel('public:songs').on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, fetchSongs).subscribe();
    const eventsChannel = supabase.channel('public:events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchNextRehearsal).subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, []);

  useEffect(() => {
    if (rehearsals.length === 0) return;

    const attendancesChannel = supabase.channel('public:attendances_all')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendances' 
      }, () => {
        fetchAllAttendances();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendancesChannel);
    };
  }, [rehearsals]);

  const fetchAllAttendances = async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select('eventid, userid, status')
        .in('eventid', rehearsals.map(r => r.id))
        .eq('status', 'Vull anar-hi');
        
      if (error) {
        console.error("Error fetching all attendances:", error);
      } else {
        setAllAttendances(data || []);
      }
    };

  useEffect(() => {
    if (rehearsals.length === 0) return;
    
    const fetchAttendance = async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select('eventid, status')
        .in('eventid', rehearsals.map(r => r.id))
        .eq('userid', user.uid);
        
      if (error) {
        console.error("Error fetching attendances:", error);
      } else {
        const attMap: Record<number, string | null> = {};
        data?.forEach(att => {
          attMap[att.eventid] = att.status;
        });
        setAttendances(attMap);
      }
    };

    fetchAttendance();
    fetchAllAttendances();
  }, [rehearsals, user.uid]);

  const handleAttendance = async (eventId: number, status: 'Vull anar-hi' | 'No puc') => {
    try {
      const { error } = await supabase.from('attendances').upsert({
        eventid: eventId,
        userid: user.uid,
        status,
        updatedat: new Date().toISOString()
      }, { onConflict: 'eventid, userid' });
      if (error) throw error;
      setAttendances(prev => ({ ...prev, [eventId]: status }));
      fetchAllAttendances();
    } catch (error) {
      console.error("Error updating attendance:", error);
      alert("Error en actualitzar l'assistència.");
    }
  };

  const toggleAudio = (url: string, title: string) => {
    if (activeAudio?.url === url) {
      setActiveAudio(null);
    } else {
      setActiveAudio({ url, title });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ca-ES', { 
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  const handleSaveRepertoire = async () => {
    if (!isEditingRepertoire || !rehearsals.find(r => r.id === isEditingRepertoire)) return;
    const rehearsalId = isEditingRepertoire;
    
    // Optimistic update
    setRehearsals(rehearsals.map(r => r.id === rehearsalId ? { ...r, repertoireids: selectedSongIds } : r));
    setIsEditingRepertoire(null as any);

    try {
      const { error } = await supabase.from('events').update({
        repertoireids: selectedSongIds
      }).eq('id', rehearsalId);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating repertoire:", error);
      alert("Error en actualitzar el repertori.");
      fetchNextRehearsal();
    }
  };

  const handleRemoveFromRepertoire = async (rehearsalId: number, songId: number) => {
    const rehearsal = rehearsals.find(r => r.id === rehearsalId);
    if (!rehearsal) return;
    const updatedIds = (rehearsal.repertoireids || []).filter(id => id !== songId);
    
    // Optimistic update
    setRehearsals(rehearsals.map(r => r.id === rehearsalId ? { ...r, repertoireids: updatedIds } : r));
    if (isEditingRepertoire === rehearsalId) {
      setSelectedSongIds(updatedIds);
    }

    try {
      const { error } = await supabase.from('events').update({
        repertoireids: updatedIds
      }).eq('id', rehearsalId);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error removing song from repertoire:", error);
      alert("Error en treure la cançó del repertori.");
      // Rollback on error
      fetchNextRehearsal();
    }
  };

  const toggleSongSelection = (songId: number) => {
    if (selectedSongIds.includes(songId)) {
      setSelectedSongIds(selectedSongIds.filter(id => id !== songId));
    } else {
      setSelectedSongIds([...selectedSongIds, songId]);
    }
  };

  const filteredSongs = allSongs.filter(song => 
    song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (song.composer && song.composer.toLowerCase().includes(searchTerm.toLowerCase()))
  );


  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d44211]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-32 md:pb-12 space-y-12">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
          <CalendarIcon size={12} /> Assajos i Repertori
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
          Repertori i <span className="text-gradient">Assajos</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl font-medium">Consulta el repertori i confirma la teva assistència per als propers esdeveniments.</p>
      </div>

      {rehearsals.length === 0 ? (
        <div className="glass rounded-[2.5rem] p-16 text-center border-white/40">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <CalendarIcon size={64} strokeWidth={1} className="opacity-20 mb-2" />
            <h2 className="text-2xl font-black text-slate-500 tracking-tight">No hi ha assajos programats</h2>
            <p className="text-sm font-medium">Aviat s'anunciaran les properes dates d'assaig.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-16">
          {rehearsals.map((rehearsal) => {
            const rehearsalSongs = allSongs.filter(song => rehearsal.repertoireids?.includes(song.id));
            const attendance = attendances[rehearsal.id];

            return (
              <div key={rehearsal.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="glass rounded-[2.5rem] overflow-hidden border-white/40 shadow-xl">
                  {/* Header Section */}
                  <div className="p-8 md:p-10 border-b border-slate-100/50 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                          <CalendarIcon size={24} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{rehearsal.title}</h2>
                      </div>
                      <p className="text-slate-500 font-bold ml-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {formatDate(rehearsal.date)}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleAttendance(rehearsal.id, 'Vull anar-hi')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all active:scale-95 ${attendance === 'Vull anar-hi' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-green-200 hover:text-green-600'}`}
                      >
                        <CheckCircle size={16} strokeWidth={3} /> Assistiré
                      </button>
                      <button 
                        onClick={() => handleAttendance(rehearsal.id, 'No puc')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all active:scale-95 ${attendance === 'No puc' ? 'bg-red-400 text-white shadow-lg shadow-red-400/20' : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <XCircle size={16} strokeWidth={3} /> No puc
                      </button>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-5 gap-0">
                    {/* Repertoire Column */}
                    <div className="lg:col-span-3 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-slate-100/50 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <FileText size={16} /> Repertori i Partitures
                          </h3>
                        </div>
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => {
                              setSelectedSongIds(rehearsal.repertoireids || []);
                              setIsEditingRepertoire(rehearsal.id as any);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-dark transition-colors flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10"
                          >
                            <Plus size={14} strokeWidth={3} /> Gestionar
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4">
                        {rehearsalSongs.length === 0 ? (
                          <div className="p-12 bg-slate-50 rounded-3xl border border-slate-100 border-dashed text-center text-slate-400 text-sm font-medium">
                            No s'ha assignat repertori encara.
                          </div>
                        ) : (
                          rehearsalSongs.map((song) => {
                            const instrumentPdf = song.pdfs?.find(p => p.instrument.toLowerCase() === user.instrument?.toLowerCase());
                            const otherPdfs = song.pdfs?.filter(p => p.instrument.toLowerCase() !== user.instrument?.toLowerCase()) || [];

                            return (
                              <div key={song.id} className="group flex flex-col p-6 bg-white border border-slate-100 rounded-3xl hover:border-primary/20 hover:shadow-lg transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                      <FileText size={20} />
                                    </div>
                                    <div className="overflow-hidden">
                                      <p className="font-black text-slate-900 tracking-tight truncate group-hover:text-primary transition-colors">{song.title}</p>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{song.composer || 'Sense autor'}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {song.mp3_url && (
                                      <button onClick={() => toggleAudio(song.mp3_url!, song.title)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${activeAudio?.url === song.mp3_url ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-50 text-slate-400 hover:text-primary hover:bg-white border border-transparent hover:border-slate-100'}`}>
                                        {activeAudio?.url === song.mp3_url ? <Pause size={16} strokeWidth={3} /> : <Play size={16} strokeWidth={3} />}
                                      </button>
                                    )}
                                    {user.role === 'admin' && (
                                      <button onClick={() => handleRemoveFromRepertoire(rehearsal.id, song.id)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-100 transition-all active:scale-90">
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {instrumentPdf && (
                                    <a href={instrumentPdf.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 hover:-translate-y-0.5 transition-all active:scale-95">
                                      La Meva Partitura ({instrumentPdf.instrument})
                                    </a>
                                  )}
                                  {otherPdfs.slice(0, 3).map((pdf, idx) => (
                                    <a key={idx} href={pdf.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-white hover:text-primary transition-all">
                                      {pdf.instrument}
                                    </a>
                                  ))}
                                  {otherPdfs.length > 3 && <span className="text-[10px] font-black text-slate-300 flex items-center px-1">+{otherPdfs.length - 3} més</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Attendees Column */}
                    <div className="lg:col-span-2 p-8 md:p-10 bg-slate-50/30 space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Users size={16} /> Assistència
                        </h3>
                        <div className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-primary uppercase tracking-widest shadow-sm">
                          {allAttendances.filter(a => a.eventid === rehearsal.id).length} Músics
                        </div>
                      </div>
                      
                      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {(() => {
                          const eventAttendees = allAttendances
                            .filter(a => a.eventid === rehearsal.id)
                            .map(a => users.find(u => u.uid === a.userid))
                            .filter(Boolean) as DBUser[];

                          if (eventAttendees.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                                <Users size={32} className="text-slate-200" />
                                <p className="text-slate-400 text-sm font-medium">Encara no hi ha confirmacions.</p>
                              </div>
                            );
                          }

                          return eventAttendees.map((attendee) => (
                            <div key={attendee.uid} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-sm group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                  {attendee.name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900 tracking-tight">{attendee.name}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">{attendee.instrument}</p>
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {rehearsal.notes && (
                    <div className="p-8 bg-white glass rounded-[2.5rem] border-white/40 shadow-sm space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Info size={18} className="text-primary" /> Notes de l'assaig
                      </h3>
                      <p className="text-slate-600 font-medium text-sm leading-relaxed whitespace-pre-wrap pl-1">
                        {rehearsal.notes}
                      </p>
                    </div>
                  )}
                  {rehearsal.location && (
                    <div className="p-8 bg-white glass rounded-[2.5rem] border-white/40 shadow-sm space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <MapPin size={18} className="text-primary" /> Ubicació
                        </h3>
                        <p className="text-slate-900 font-black text-lg tracking-tight pl-1">
                          {rehearsal.location}
                        </p>
                      </div>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(rehearsal.location)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10">
                        <ExternalLink size={14} /> Veure al mapa
                      </a>
                    </div>
                  )}
                </div>
                
                {rehearsals.indexOf(rehearsal) < rehearsals.length - 1 && (
                  <div className="py-8">
                    <div className="h-px bg-slate-100 flex items-center justify-center">
                      <div className="px-6 bg-[#fcfcfd] text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{rehearsals.indexOf(rehearsal) + 1} / {rehearsals.length}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Repertoire Modal */}
      {isEditingRepertoire && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
            <div className="p-8 pb-4 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Seleccionar Repertori</h3>
              <button onClick={() => setIsEditingRepertoire(null as any)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 pt-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                  <Search size={20} />
                </div>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full p-4 pl-12 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-primary outline-none font-bold text-slate-700 transition-all" 
                  placeholder="Cerca obres al catàleg..." 
                />
              </div>
            </div>

            <div className="p-0 overflow-y-auto flex-1 px-8">
              <div className="space-y-2 pb-8">
                {filteredSongs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-medium">
                    No s'han trobat obres amb aquest criteri.
                  </div>
                ) : (
                  filteredSongs.map((song) => (
                    <label key={song.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedSongIds.includes(song.id) ? 'bg-primary/5 border-primary/20' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                      <div className="flex-shrink-0">
                        <input 
                           type="checkbox" 
                           checked={selectedSongIds.includes(song.id)}
                           onChange={() => toggleSongSelection(song.id)}
                           className="w-6 h-6 rounded-lg border-2 border-slate-200 text-primary focus:ring-primary transition-all"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-slate-900 tracking-tight leading-tight">{song.title}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{song.composer} {song.style && `• ${song.style}`}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex justify-between items-center gap-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {selectedSongIds.length} obres seleccionades
              </span>
              <div className="flex gap-4">
                <button onClick={() => setIsEditingRepertoire(null as any)} className="px-6 py-4 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:text-slate-700 transition-colors">Abortar</button>
                <button onClick={handleSaveRepertoire} className="px-8 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95">Guardar Canvis</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Player Sticky */}
      {activeAudio && (
        <div className="fixed bottom-24 left-4 right-4 md:bottom-28 md:left-auto md:right-8 md:w-96 glass-dark text-white shadow-2xl rounded-3xl z-40 animate-in slide-in-from-bottom-8 duration-500 border border-white/10 p-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl pointer-events-none rounded-full -mr-16 -mt-16"></div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center text-primary flex-shrink-0 shadow-inner">
                  <Headphones size={24} className="animate-pulse" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Reproduint Ara</p>
                  <p className="text-sm font-black text-white truncate pr-2">{activeAudio.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveAudio(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
            
            <audio 
              src={activeAudio.url} 
              controls 
              autoPlay 
              className="w-full h-8 custom-audio-player-dark"
            />
          </div>
        </div>
      )}
    </div>
  );
}
