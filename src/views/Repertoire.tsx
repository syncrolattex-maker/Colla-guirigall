import { useState, useEffect } from 'react';
import { Search, Filter, FileText, Headphones, PlayCircle, Music, Clock, User, Plus, X, Upload } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { UserData } from '../App';

interface RepertoireProps {
  user: UserData;
}

interface Song {
  id: string;
  title: string;
  composer: string;
  style: string;
  pdfUrl: string;
  mp3Url: string;
  youtubeUrl: string;
  addedBy: string;
  createdAt: any;
}

export default function Repertoire({ user }: RepertoireProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // New song form state
  const [newSong, setNewSong] = useState({
    title: '',
    composer: '',
    style: '',
    youtubeUrl: ''
  });
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mp3File, setMp3File] = useState<File | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'songs'), (snapshot) => {
      const songsData: Song[] = [];
      snapshot.forEach((doc) => {
        songsData.push({ id: doc.id, ...doc.data() } as Song);
      });
      setSongs(songsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching songs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSong.title) return;

    setUploading(true);
    try {
      let pdfUrl = '';
      let mp3Url = '';

      if (pdfFile) {
        const pdfRef = ref(storage, `repertoire/${Date.now()}_${pdfFile.name}`);
        await uploadBytes(pdfRef, pdfFile);
        pdfUrl = await getDownloadURL(pdfRef);
      }

      if (mp3File) {
        const mp3Ref = ref(storage, `repertoire/${Date.now()}_${mp3File.name}`);
        await uploadBytes(mp3Ref, mp3File);
        mp3Url = await getDownloadURL(mp3Ref);
      }

      await addDoc(collection(db, 'songs'), {
        ...newSong,
        pdfUrl,
        mp3Url,
        addedBy: user.name,
        createdAt: new Date().toISOString()
      });
      
      setIsAdding(false);
      setNewSong({ title: '', composer: '', style: '', youtubeUrl: '' });
      setPdfFile(null);
      setMp3File(null);
    } catch (error) {
      console.error("Error adding song:", error);
      alert("Hi ha hagut un error en afegir la cançó.");
    } finally {
      setUploading(false);
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
        {user.role === 'admin' && (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-6 py-3 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#d44211]/20 whitespace-nowrap"
          >
            <Plus size={20} /> Nova Cançó
          </button>
        )}
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
                        <div className="text-xs text-slate-500 mt-1 uppercase tracking-tighter">Afegit per: {song.addedBy}</div>
                      </td>
                      <td className="px-6 py-6 text-slate-600 font-medium">
                        {song.composer} {song.style && <span className="text-slate-400">/ {song.style}</span>}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex justify-end gap-2">
                          {song.pdfUrl ? (
                            <a href={song.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:scale-105 transition-transform">
                              <FileText size={14} /> PDF
                            </a>
                          ) : <span className="px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed">N/A</span>}
                          {song.mp3Url ? (
                            <a href={song.mp3Url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:scale-105 transition-transform">
                              <Headphones size={14} /> MP3
                            </a>
                          ) : <span className="px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed">N/A</span>}
                          {song.youtubeUrl ? (
                            <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:scale-105 transition-transform">
                              <PlayCircle size={14} /> YouTube
                            </a>
                          ) : <span className="px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed">N/A</span>}
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
              <h3 className="text-xl font-bold text-slate-900">Afegir nova cançó</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="add-song-form" onSubmit={handleAddSong} className="space-y-4">
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
                      <label className="block text-sm font-bold text-slate-700 mb-1">Partitura (PDF)</label>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl hover:border-[#d44211] hover:bg-[#d44211]/5 transition-colors">
                          <Upload size={18} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{pdfFile ? pdfFile.name : 'Seleccionar PDF'}</span>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                        </label>
                        {pdfFile && (
                          <button type="button" onClick={() => setPdfFile(null)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl">
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Àudio (MP3)</label>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl hover:border-[#d44211] hover:bg-[#d44211]/5 transition-colors">
                          <Upload size={18} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{mp3File ? mp3File.name : 'Seleccionar MP3'}</span>
                          <input type="file" accept=".mp3,audio/*" className="hidden" onChange={(e) => setMp3File(e.target.files?.[0] || null)} />
                        </label>
                        {mp3File && (
                          <button type="button" onClick={() => setMp3File(null)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl">
                            <X size={18} />
                          </button>
                        )}
                      </div>
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
              <button onClick={() => setIsAdding(false)} disabled={uploading} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                Cancel·lar
              </button>
              <button type="submit" form="add-song-form" disabled={uploading} className="px-6 py-3 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-colors shadow-lg shadow-[#d44211]/20 disabled:opacity-50 flex items-center gap-2">
                {uploading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Pujant...</>
                ) : (
                  'Guardar Cançó'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
