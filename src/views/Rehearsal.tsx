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
  id: string;
  nombre: string;
  instrumento: string;
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
    const { data, error } = await supabase.from('users').select('id, nombre, instrumento');
    if (error) console.error("Error fetching users:", error);
    else setUsers(data || []);
  };

  const fetchNextRehearsal = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .ilike('type', 'Assaig%')
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
        .ilike('type', 'Assaig%')
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
    <div className="max-w-4xl mx-auto px-6 py-8 pb-24 md:pb-8 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Gestió d'assajos</h1>
        <p className="text-slate-600">Consulta el repertori i confirma la teva assistència per als propers assajos.</p>
      </div>

      {rehearsals.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-[#d44211]/5">
          <CalendarIcon size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No hi ha assajos programats</h2>
          <p className="text-slate-500">Aviat s'anunciaran les properes dates d'assaig.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {rehearsals.map((rehearsal) => {
            const rehearsalSongs = allSongs.filter(song => rehearsal.repertoireids?.includes(song.id));
            const attendance = attendances[rehearsal.id];

            return (
              <div key={rehearsal.id} className="flex flex-col gap-6">
                <section className="bg-white rounded-xl p-6 shadow-sm border border-[#d44211]/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon size={20} className="text-[#d44211]" />
                        <h2 className="text-xl font-bold text-slate-900">{rehearsal.title}</h2>
                      </div>
                      <p className="text-slate-600 capitalize">{formatDate(rehearsal.date)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAttendance(rehearsal.id, 'Vull anar-hi')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${attendance === 'Vull anar-hi' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                      >
                        <CheckCircle size={18} /> Assistiré
                      </button>
                      <button 
                        onClick={() => handleAttendance(rehearsal.id, 'No puc')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${attendance === 'No puc' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'}`}
                      >
                        <XCircle size={18} /> No puc
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Repertoire Column */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#d44211]/80 flex items-center gap-2">
                          <FileText size={16} /> Repertori i Scores
                        </h3>
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => {
                              setSelectedSongIds(rehearsal.repertoireids || []);
                              setIsEditingRepertoire(rehearsal.id as any);
                            }}
                            className="text-xs font-bold text-[#d44211] hover:text-[#d44211]/80 flex items-center gap-1 bg-[#d44211]/10 px-3 py-1.5 rounded-lg transition-colors border border-[#d44211]/20"
                          >
                            <Plus size={14} /> <Edit size={14} /> Gestionar
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3">
                        {rehearsalSongs.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-slate-500 text-sm">
                            No s'ha assignat repertori.
                          </div>
                        ) : (
                          rehearsalSongs.map((song) => {
                            const instrumentPdf = song.pdfs?.find(p => p.instrument.toLowerCase() === user.instrument?.toLowerCase());
                            const otherPdfs = song.pdfs?.filter(p => p.instrument.toLowerCase() !== user.instrument?.toLowerCase()) || [];

                            return (
                              <div key={song.id} className="flex flex-col p-3 bg-[#f8f6f6] rounded-lg border border-[#d44211]/5 group">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={14} className="text-[#d44211] flex-shrink-0" />
                                    <p className="font-bold text-slate-900 text-sm truncate">{song.title}</p>
                                  </div>
                                  <div className="flex gap-1">
                                    {song.mp3_url && (
                                      <button onClick={() => toggleAudio(song.mp3_url!, song.title)} className={`p-1.5 rounded transition-colors ${activeAudio?.url === song.mp3_url ? 'bg-[#d44211] text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                                        {activeAudio?.url === song.mp3_url ? <Pause size={12} /> : <Play size={12} />}
                                      </button>
                                    )}
                                    {user.role === 'admin' && (
                                      <button onClick={() => handleRemoveFromRepertoire(rehearsal.id, song.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100">
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {instrumentPdf && (
                                    <a href={instrumentPdf.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 bg-[#d44211] text-white rounded text-[10px] font-bold">
                                      Meu ({instrumentPdf.instrument})
                                    </a>
                                  )}
                                  {otherPdfs.slice(0, 2).map((pdf, idx) => (
                                    <a key={idx} href={pdf.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 bg-white border border-slate-200 text-slate-500 rounded text-[10px] font-bold">
                                      {pdf.instrument}
                                    </a>
                                  ))}
                                  {otherPdfs.length > 2 && <span className="text-[10px] text-slate-400">+{otherPdfs.length - 2}</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Attendees Column */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#d44211]/80 flex items-center gap-2">
                          <Users size={16} /> Qui hi va?
                        </h3>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                          {allAttendances.filter(a => a.eventid === rehearsal.id).length} confirmats
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-100 h-full max-h-[300px] overflow-y-auto">
                        <div className="p-2 space-y-1">
                          {(() => {
                            const eventAttendees = allAttendances
                              .filter(a => a.eventid === rehearsal.id)
                              .map(a => users.find(u => u.id === a.userid))
                              .filter(Boolean) as DBUser[];

                            if (eventAttendees.length === 0) {
                              return <p className="text-center py-8 text-slate-400 text-sm">Encara no hi ha confirmacions.</p>;
                            }

                            return eventAttendees.map((attendee) => (
                              <div key={attendee.id} className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-[#d44211]/10 flex items-center justify-center text-[#d44211] font-bold text-xs">
                                    {attendee.nombre[0]}
                                  </div>
                                  <p className="text-sm font-semibold text-slate-700">{attendee.nombre}</p>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">
                                  {attendee.instrumento}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid md:grid-cols-2 gap-6">
                  {rehearsal.notes && (
                    <div className="bg-[#d44211]/5 rounded-xl p-6 border border-[#d44211]/10">
                      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <Info size={20} className="text-[#d44211]" /> Notes de l'assaig
                      </h3>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {rehearsal.notes}
                      </p>
                    </div>
                  )}
                  {rehearsal.location && (
                    <div className="bg-[#d44211]/5 rounded-xl p-6 border border-[#d44211]/10">
                      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <MapPin size={20} className="text-[#d44211]" /> Ubicació
                      </h3>
                      <p className="text-sm text-slate-700">
                        {rehearsal.location}
                      </p>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(rehearsal.location)}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[#d44211] text-xs font-bold hover:underline">Obrir a Google Maps</a>
                    </div>
                  )}
                </section>
                
                {rehearsals.indexOf(rehearsal) < rehearsals.length - 1 && (
                  <div className="h-px bg-slate-100 my-4" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Repertoire Modal */}
      {isEditingRepertoire && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8f6f6]">
              <h3 className="text-xl font-bold text-slate-900">Seleccionar Repertori</h3>
              <button onClick={() => setIsEditingRepertoire(null as any)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full p-3 pl-10 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" 
                  placeholder="Cerca obres..." 
                />
              </div>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100">
                {filteredSongs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No s'han trobat obres.
                  </div>
                ) : (
                  filteredSongs.map((song) => (
                    <label key={song.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-shrink-0">
                        <input 
                           type="checkbox" 
                           checked={selectedSongIds.includes(song.id)}
                           onChange={() => toggleSongSelection(song.id)}
                           className="w-5 h-5 rounded border-slate-300 text-[#d44211] focus:ring-[#d44211]"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-900">{song.title}</p>
                        <p className="text-xs text-slate-500">{song.composer} {song.style && `• ${song.style}`}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-[#f8f6f6] flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">
                {selectedSongIds.length} obres seleccionades
              </span>
              <div className="flex gap-3">
                <button onClick={() => setIsEditingRepertoire(null as any)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">
                  Cancel·lar
                </button>
                <button onClick={handleSaveRepertoire} className="px-6 py-2.5 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-colors shadow-sm shadow-[#d44211]/20">
                  Guardar Repertori
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Audio Player Sticky */}
      {activeAudio && (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-24 md:left-auto md:right-8 md:w-96 bg-white border-2 border-[#d44211] shadow-2xl rounded-2xl z-40 animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-[#d44211]/10 rounded-lg flex items-center justify-center text-[#d44211] flex-shrink-0 animate-pulse">
                  <Headphones size={20} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-[#d44211] uppercase tracking-wider">S'està reproduint</p>
                  <p className="text-sm font-black text-slate-900 truncate">{activeAudio.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveAudio(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <audio 
              src={activeAudio.url} 
              controls 
              autoPlay 
              className="w-full h-10 custom-audio-player"
            />
          </div>
        </div>
      )}
    </div>
  );
}
