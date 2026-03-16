import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Music } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error en iniciar sessió');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-[#d44211]/10">
        <div className="w-16 h-16 bg-[#d44211] rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-[#d44211]/30">
          <Music size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Colla Guirigall</h1>
        <p className="text-slate-500 mb-8">Inicia sessió per accedir al teu panell, repertori i convocatòries.</p>
        
        {error && <div className="w-full p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4">{error}</div>}
        
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-[#d44211] text-slate-700 font-bold rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          {loading ? 'Redirigint...' : 'Continua amb Google'}
        </button>
      </div>
    </div>
  );
}
