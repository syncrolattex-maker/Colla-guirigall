import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, FileText, ExternalLink, Info, MapPin, Edit, X, Search, Headphones, PlayCircle, Play, Pause, Trash2, Plus } from 'lucide-react';
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

export default function Rehearsal({ user }: RehearsalProps) {
  const [nextRehearsal, setNextRehearsal] = useState<AppEvent | null>(null);
  const [attendance, setAttendance] = useState<'Vull anar-hi' | 'No puc' | null>(null);
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

  const fetchNextRehearsal = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .ilike('type', 'Assaig%')
      .gte('date', new Date(new Date().getTime() - 86400000).toISOString())
      .order('date', { ascending: true });
      
    if (error) console.error("Error fetching events:", error);
    else {
      const rehearsal = data && data.length > 0 ? data[0] : null;
      setNextRehearsal(rehearsal);
      if (rehearsal && rehearsal.repertoireids) {
        setSelectedSongIds(rehearsal.repertoireids);
      } else {
        setSelectedSongIds([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSongs();
    fetchNextRehearsal();

    const songsChannel = supabase.channel('public:songs').on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, fetchSongs).subscribe();
    const eventsChannel = supabase.channel('public:events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchNextRehearsal).subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, []);

  useEffect(() => {
    if (!nextRehearsal) return;
    
    const fetchAttendance = async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select('status')
        .eq('eventid', nextRehearsal.id)
        .eq('userid', user.uid)
        .single();
        
      if (error && error.code !== 'PGRST116') console.error("Error fetching attendance:", error);
      else setAttendance(data?.status || null);
    };

    fetchAttendance();
  }, [nextRehearsal, user.uid]);

  const handleAttendance = async (status: 'Vull anar-hi' | 'No puc') => {
    if (!nextRehearsal) return;
    try {
      const { error } = await supabase.from('attendances').upsert({
        eventid: nextRehearsal.id,
        userid: user.uid,
        status,
        updatedat: new Date().toISOString()
      }, { onConflict: 'eventid, userid' });
      if (error) throw error;
      setAttendance(status);
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
    if (!nextRehearsal) return;
    try {
      const { error } = await supabase.from('events').update({
        repertoireids: selectedSongIds
      }).eq('id', nextRehearsal.id);
      if (error) throw error;
      setIsEditingRepertoire(false);
    } catch (error) {
      console.error("Error updating repertoire:", error);
      alert("Error en actualitzar el repertori.");
    }
  };

  const handleRemoveFromRepertoire = async (songId: number) => {
    if (!nextRehearsal) return;
    const updatedIds = (nextRehearsal.repertoireids || []).filter(id => id !== songId);
    
    try {
      const { error } = await supabase.from('events').update({
        repertoireids: updatedIds
      }).eq('id', nextRehearsal.id);
      
      if (error) throw error;
      // Real-time will update the list
    } catch (error) {
      console.error("Error removing song from repertoire:", error);
      alert("Error en treure la cançó del repertori.");
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

  const rehearsalSongs = allSongs.filter(song => nextRehearsal?.repertoireids?.includes(song.id));

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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#d44211]/80">Repertori i Scores</h3>
                {user.role === 'admin' && (
                  <button 
                    onClick={() => setIsEditingRepertoire(true)}
                    className="text-xs font-bold text-[#d44211] hover:text-[#d44211]/80 flex items-center gap-1 bg-[#d44211]/10 px-3 py-1.5 rounded-lg transition-colors border border-[#d44211]/20"
                  >
                    <Plus size={14} /> <Edit size={14} /> Gestionar Repertori
                  </button>
                )}
              </div>
              <div className="grid gap-3">
                {rehearsalSongs.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-slate-500 text-sm">
                    No s'ha assignat cap obra per a aquest assaig.
                  </div>
                ) : (
                  rehearsalSongs.map((song) => {
                    const instrumentPdf = song.pdfs?.find(p => p.instrument.toLowerCase() === user.instrument?.toLowerCase());
                    const otherPdfs = song.pdfs?.filter(p => p.instrument.toLowerCase() !== user.instrument?.toLowerCase()) || [];

                    return (
                      <div key={song.id} className="flex flex-col p-4 bg-[#f8f6f6] rounded-lg border border-[#d44211]/5 hover:border-[#d44211]/20 transition-all group">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center bg-[#d44211]/10 text-[#d44211] rounded-full group-hover:bg-[#d44211] group-hover:text-white transition-colors">
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{song.title}</p>
                              <p className="text-xs text-slate-500">{song.style || song.composer || 'Sense estil'}</p>
                            </div>
                          </div>
                          
                           <div className="flex gap-2">
                            {song.mp3_url && (
                              <button 
                                onClick={() => toggleAudio(song.mp3_url!, song.title)}
                                className={`p-2 rounded-lg transition-colors ${activeAudio?.url === song.mp3_url ? 'bg-[#d44211] text-white shadow-lg' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                title="Reproduïr Àudio"
                              >
                                {activeAudio?.url === song.mp3_url ? <Pause size={16} /> : <Play size={16} />}
                              </button>
                            )}
                            {song.youtube_url && (
                              <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors" title="Veure a YouTube">
                                <PlayCircle size={16} />
                              </a>
                            )}
                            {user.role === 'admin' && (
                              <button 
                                onClick={() => handleRemoveFromRepertoire(song.id)}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                title="Treure de l'assaig"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {instrumentPdf && (
                            <a href={instrumentPdf.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d44211] text-white rounded-lg text-xs font-bold hover:scale-105 transition-transform shadow-sm">
                              <FileText size={14} /> El meu instrument ({instrumentPdf.instrument})
                            </a>
                          )}
                          {otherPdfs.map((pdf, idx) => (
                            <a key={idx} href={pdf.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
                              <FileText size={14} /> {pdf.instrument}
                            </a>
                          ))}
                          {!song.pdfs?.length && <span className="text-xs text-slate-400 italic">Sense partitures PDF</span>}
                        </div>
                      </div>
                    );
                  })
                )}
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

      {/* Edit Repertoire Modal */}
      {isEditingRepertoire && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8f6f6]">
              <h3 className="text-xl font-bold text-slate-900">Seleccionar Repertori</h3>
              <button onClick={() => setIsEditingRepertoire(false)} className="text-slate-400 hover:text-slate-600">
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
                <button onClick={() => setIsEditingRepertoire(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">
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
