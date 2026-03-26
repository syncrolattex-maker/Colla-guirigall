import React, { useState, useEffect } from 'react';
import { Search, FileText, Headphones, PlayCircle, Plus, X, Upload, Play, Pause, Volume2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserData } from '../App';

interface RepertoireProps {
  user: UserData;
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
  mp3_url: string;
  youtube_url: string;
  added_by: string;
  created_at: string;
}

export default function Repertoire({ user }: RepertoireProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [existingPdfs, setExistingPdfs] = useState<SongPdf[]>([]);
  const [removeMp3, setRemoveMp3] = useState(false);
  
  const [newSong, setNewSong] = useState({
    title: '',
    composer: '',
    style: '',
    youtubeUrl: ''
  });
  
  const [pdfFiles, setPdfFiles] = useState<{ instrument: string, file: File }[]>([]);
  const [mp3File, setMp3File] = useState<File | null>(null);
  const [activeAudio, setActiveAudio] = useState<{url: string, title: string} | null>(null);

  const fetchSongs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching songs:", error);
    } else {
      setSongs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSongs();

    // Subscribe to changes
    const channel = supabase
      .channel('public:songs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        fetchSongs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sanitizeFilename = (filename: string) => {
    return filename
      .normalize('NFD') // Normalize to decomposable form
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace any non-alphanumeric (except dot and dash) with underscore
      .replace(/_{2,}/g, '_'); // Replace multiple underscores with a single one
  };

  const handleSubmitSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSong.title) return;

    setUploading(true);
    try {
      console.log(editingSong ? "Updating song..." : "Adding song...", newSong);
      
      // Keep existing PDFs that weren't deleted
      let pdfs: SongPdf[] = [...existingPdfs];
      let mp3_url = removeMp3 ? '' : (editingSong?.mp3_url || '');

      // Upload new PDFs
      for (const pdf of pdfFiles) {
        if (!pdf.file || pdf.file.size === 0) continue;
        
        const fileName = `${Date.now()}_${sanitizeFilename(pdf.file.name)}`;
        console.log("Uploading PDF:", fileName);
        const { error: uploadError } = await supabase.storage
          .from('repertoire')
          .upload(fileName, pdf.file);
          
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('repertoire')
          .getPublicUrl(fileName);
          
        pdfs.push({ instrument: pdf.instrument, url: urlData.publicUrl });
      }

      // Upload new MP3 if provided
      if (mp3File) {
        const fileName = `${Date.now()}_${sanitizeFilename(mp3File.name)}`;
        console.log("Uploading MP3:", fileName);
        const { error: uploadError } = await supabase.storage
          .from('repertoire')
          .upload(fileName, mp3File);
          
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('repertoire')
          .getPublicUrl(fileName);
        mp3_url = urlData.publicUrl;
      }

      const songData = {
        title: newSong.title,
        composer: newSong.composer,
        style: newSong.style,
        youtube_url: newSong.youtubeUrl,
        pdfs,
        mp3_url,
        added_by: user.name
      };

      if (editingSong) {
        console.log("Saving changes to DB for song:", editingSong.id);
        const { error: updateError } = await supabase
          .from('songs')
          .update(songData)
          .eq('id', editingSong.id);
          
        if (updateError) throw updateError;
        console.log("Song updated successfully!");
      } else {
        console.log("Inserting new song into DB...");
        const { error: insertError } = await supabase
          .from('songs')
          .insert([songData]);
          
        if (insertError) throw insertError;
        console.log("Song added successfully!");
      }
      
      handleCloseModal();
      await fetchSongs();
    } catch (error: any) {
      console.error("Error saving song:", error);
      alert(`Error en desar la cançó: ${error.message || error.error_description || JSON.stringify(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSong = async (id: number) => {
    if (!confirm("Estàs segur que vols eliminar aquesta cançó?")) return;
    
    try {
      const { error } = await supabase.from('songs').delete().eq('id', id);
      if (error) throw error;
      await fetchSongs();
    } catch (error: any) {
      console.error("Error deleting song:", error);
      alert("Error en eliminar la cançó.");
    }
  };

  const handleOpenEdit = (song: Song) => {
    setEditingSong(song);
    setNewSong({
      title: song.title,
      composer: song.composer || '',
      style: song.style || '',
      youtubeUrl: song.youtube_url || ''
    });
    setExistingPdfs(song.pdfs || []);
    setRemoveMp3(false);
    setIsAdding(true);
  };

  const handleCloseModal = () => {
    setIsAdding(false);
    setEditingSong(null);
    setNewSong({ title: '', composer: '', style: '', youtubeUrl: '' });
    setPdfFiles([]);
    setExistingPdfs([]);
    setMp3File(null);
    setRemoveMp3(false);
  };

  const toggleAudio = (url: string, title: string) => {
    if (activeAudio?.url === url) {
      setActiveAudio(null);
    } else {
      setActiveAudio({ url, title });
    }
  };

  const filteredSongs = songs.filter(song => 
    song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (song.composer && song.composer.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (song.style && song.style.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2">El nostre repertori</h1>
          <p className="text-slate-600 text-lg max-w-2xl">Arxiu digital de partitures, àudios i vídeos per als membres de la Colla.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-6 py-3 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#d44211]/20 whitespace-nowrap"
        >
          <Plus size={20} /> Nova Cançó
        </button>
      </div>

      <div className="mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[#d44211]">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full p-4 pl-12 text-base text-slate-900 bg-white border border-[#d44211]/20 rounded-xl focus:ring-[#d44211] focus:border-[#d44211] placeholder-slate-400" 
            placeholder="Cerca per títol, compositor o estil..." 
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d44211]"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#d44211]/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#d44211]/5 border-b border-[#d44211]/10">
                  <th className="px-6 py-5 text-sm font-bold uppercase tracking-wider text-[#d44211]">Títol</th>
                  <th className="px-6 py-5 text-sm font-bold uppercase tracking-wider text-[#d44211]">Compositor / Estil</th>
                  <th className="px-6 py-5 text-sm font-bold uppercase tracking-wider text-[#d44211] text-right">Recursos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d44211]/5">
                {filteredSongs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                      No s'han trobat cançons.
                    </td>
                  </tr>
                ) : (
                  filteredSongs.map((song) => (
                    <tr key={song.id} className="hover:bg-[#d44211]/5 transition-colors">
                      <td className="px-6 py-6">
                        <div className="font-bold text-slate-900 text-base">{song.title}</div>
                        <div className="text-xs text-slate-500 mt-1 uppercase tracking-tighter">Afegit per: {song.added_by}</div>
                      </td>
                      <td className="px-6 py-6 text-slate-600 font-medium">
                        {song.composer} {song.style && <span className="text-slate-400">/ {song.style}</span>}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col gap-2 items-end">
                          <div className="flex flex-wrap justify-end gap-2">
                            {song.pdfs && song.pdfs.length > 0 ? (
                              song.pdfs.map((pdf, idx) => (
                                <a key={idx} href={pdf.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:scale-105 transition-transform">
                                  <FileText size={14} /> {pdf.instrument}
                                </a>
                              ))
                            ) : (
                              <span className="px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed">Sense PDF</span>
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            {song.mp3_url ? (
                              <button 
                                onClick={() => toggleAudio(song.mp3_url, song.title)}
                                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeAudio?.url === song.mp3_url ? 'bg-[#d44211] text-white' : 'bg-blue-100 text-blue-700 hover:scale-105'}`}
                              >
                                {activeAudio?.url === song.mp3_url ? <Pause size={14} /> : <Play size={14} />}
                                {activeAudio?.url === song.mp3_url ? 'Aturar' : 'Reproduïr'}
                              </button>
                            ) : null}
                            {song.youtube_url ? (
                              <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:scale-105 transition-transform">
                                <PlayCircle size={14} /> YouTube
                              </a>
                            ) : null}
                          </div>
                          {user.role === 'admin' && (
                            <div className="flex justify-end gap-2 mt-2">
                              <button 
                                onClick={() => handleOpenEdit(song)}
                                className="text-xs font-bold text-blue-600 hover:underline px-2 py-1"
                              >
                                Editar
                              </button>
                              <button 
                                onClick={() => handleDeleteSong(song.id)}
                                className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Song Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8f6f6]">
              <h3 className="text-xl font-bold text-slate-900">
                {editingSong ? 'Editar cançó' : 'Afegir nova cançó'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="add-song-form" onSubmit={handleSubmitSong} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Títol *</label>
                  <input required type="text" value={newSong.title} onChange={e => setNewSong({...newSong, title: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="Ex: La Santa Espina" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Compositor</label>
                    <input type="text" value={newSong.composer} onChange={e => setNewSong({...newSong, composer: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="Ex: Enric Morera" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Estil</label>
                    <input type="text" value={newSong.style} onChange={e => setNewSong({...newSong, style: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="Ex: Sardana" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500 mb-4">Puja els arxius o afegeix enllaços</p>
                  <div className="space-y-4">
                    <div>
                      {existingPdfs.length > 0 && (
                        <div className="mb-4 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Partitures existents</p>
                          {existingPdfs.map((pdf, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                              <span className="text-sm font-bold text-red-700">{pdf.instrument}</span>
                              <button 
                                type="button" 
                                onClick={() => setExistingPdfs(existingPdfs.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-slate-700">Afegir Partitures (PDF)</label>
                        <button 
                          type="button"
                          onClick={() => setPdfFiles([...pdfFiles, { instrument: 'General', file: new File([], '') }])}
                          className="text-xs font-bold text-[#d44211] hover:text-[#d44211]/80 flex items-center gap-1"
                        >
                          <Plus size={14} /> Afegir PDF
                        </button>
                      </div>
                      
                      {pdfFiles.length === 0 ? (
                        <div className="text-sm text-slate-500 italic p-3 border border-dashed border-slate-300 rounded-xl text-center">
                          No s'ha afegit cap partitura. Clica a "Afegir PDF" per pujar-ne una.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pdfFiles.map((pdfItem, index) => (
                            <div key={index} className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50">
                              <div className="flex-1 space-y-2">
                                <input 
                                  type="text" 
                                  placeholder="Instrument (ex: Gralla 1, Timbal...)" 
                                  value={pdfItem.instrument}
                                  onChange={(e) => {
                                    const newFiles = [...pdfFiles];
                                    newFiles[index].instrument = e.target.value;
                                    setPdfFiles(newFiles);
                                  }}
                                  className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-[#d44211] focus:border-[#d44211]"
                                />
                                <label className="cursor-pointer flex items-center justify-center gap-2 p-2 border border-dashed border-slate-300 rounded-lg hover:border-[#d44211] hover:bg-[#d44211]/5 transition-colors bg-white">
                                  <Upload size={16} className="text-slate-400" />
                                  <span className="text-sm text-slate-600 truncate max-w-[200px]">
                                    {pdfItem.file.name || 'Seleccionar PDF'}
                                  </span>
                                  <input 
                                    type="file" 
                                    accept=".pdf" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        const newFiles = [...pdfFiles];
                                        newFiles[index].file = e.target.files[0];
                                        setPdfFiles(newFiles);
                                      }
                                    }} 
                                  />
                                </label>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => {
                                  const newFiles = [...pdfFiles];
                                  newFiles.splice(index, 1);
                                  setPdfFiles(newFiles);
                                }} 
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg self-start"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Àudio (MP3)</label>
                      
                      {editingSong?.mp3_url && !removeMp3 ? (
                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl mb-2">
                          <div className="flex items-center gap-2">
                            <Volume2 size={18} className="text-blue-600" />
                            <span className="text-sm font-bold text-blue-700 truncate max-w-[200px]">Àudio actual</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setRemoveMp3(true)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar àudio actual"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {removeMp3 && (
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                                <X size={12} /> L'àudio actual s'eliminarà
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setRemoveMp3(false)}
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                Desfer eliminació
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl hover:border-[#d44211] hover:bg-[#d44211]/5 transition-colors">
                              <Upload size={18} className="text-slate-400" />
                              <span className="text-sm text-slate-600">{mp3File ? mp3File.name : 'Puja un nou MP3'}</span>
                              <input type="file" accept=".mp3,audio/*" className="hidden" onChange={(e) => setMp3File(e.target.files?.[0] || null)} />
                            </label>
                            {mp3File && (
                              <button type="button" onClick={() => setMp3File(null)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl">
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Enllaç YouTube</label>
                      <input type="url" value={newSong.youtubeUrl} onChange={e => setNewSong({...newSong, youtubeUrl: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211]" placeholder="https://youtube.com/..." />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-[#f8f6f6] flex justify-end gap-3">
              <button onClick={handleCloseModal} disabled={uploading} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                Cancel·lar
              </button>
              <button type="submit" form="add-song-form" disabled={uploading} className="px-6 py-3 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-colors shadow-lg shadow-[#d44211]/20 disabled:opacity-50 flex items-center gap-2">
                {uploading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Desar...</>
                ) : (
                  editingSong ? 'Guardar Canvis' : 'Guardar Cançó'
                )}
              </button>
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
