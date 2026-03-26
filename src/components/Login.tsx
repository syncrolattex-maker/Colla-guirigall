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
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-6 selection:bg-primary/20">
      <div className="max-w-md w-full glass rounded-[3rem] p-12 flex flex-col items-center text-center shadow-2xl border-white/40">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl shadow-primary/40 animate-float">
          <Music size={40} />
        </div>
        
        <div className="space-y-2 mb-10">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Guirigall</h1>
          <p className="text-slate-500 font-medium px-4">Benvingut a la plataforma de la Colla. Inicia sessió per gestionar el teu repertori i assajos.</p>
        </div>
        
        {error && (
          <div className="w-full p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            {error}
          </div>
        )}
        
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full group relative py-5 px-6 bg-white border-2 border-slate-100 text-slate-900 font-black rounded-2xl shadow-xl shadow-slate-200/50 hover:border-primary hover:shadow-primary/10 transition-all duration-300 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-4 overflow-hidden"
        >
          <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 relative z-10" />
          <span className="relative z-10 text-lg">
            {loading ? 'Preparant sessió...' : 'Entra amb Google'}
          </span>
        </button>
        
        <p className="mt-12 text-[10px] uppercase font-black tracking-widest text-slate-400">
          &copy; 2024 Colla Musical Guirigall
        </p>
      </div>
    </div>
  );
}
