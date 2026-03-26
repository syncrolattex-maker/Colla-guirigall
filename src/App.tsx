import { useState, useEffect } from 'react';
import { Music, LogOut, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './views/Dashboard';
import Repertoire from './views/Repertoire';
import CalendarView from './views/CalendarView';
import Rehearsal from './views/Rehearsal';
import Admin from './views/Admin';
import BottomNav from './components/BottomNav';
import NotificationBell from './components/NotificationBell';

export type View = 'dashboard' | 'repertoire' | 'calendar' | 'rehearsal' | 'admin';

export interface UserData {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  instrument: string;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const DEV_MODE = false; // Set to true only for local testing without Supabase Auth
  const ADMIN_EMAILS = ['syncrolattex@gmail.com', 'crentero@gmail.com']; // Authorized administrators

  useEffect(() => {
    if (DEV_MODE) return;
    let mounted = true;

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            await fetchUserData(session.user);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Error in checkUser:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkUser();

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      console.log("Auth state change:", _event, session?.user?.email);
      
      try {
        if (session?.user) {
          await fetchUserData(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error in onAuthStateChange handler:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    // Handle visibility change to refresh session
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) fetchUserData(session.user);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchUserData = async (authUser: any) => {
    try {
      console.log("Fetching data for UID:", authUser.id);
      
      // Use select() instead of single() to avoid 406 error confusion
      let { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', authUser.id);

      if (error) {
        console.error("Supabase select error:", error);
        throw error;
      }

      let userData = users && users.length > 0 ? users[0] : null;

      if (!userData) {
        console.log("User not found in DB, creating profile...");
        // User not found, create it
        const newUser = {
          uid: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Nou Membre',
          role: ADMIN_EMAILS.includes(authUser.email || '') ? 'admin' : 'member',
          instrument: 'Sense assignar'
        };
        
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();
          
        if (insertError) {
          console.error("Supabase insert error:", insertError);
          throw insertError;
        }
        userData = insertedUser;
      }

      // Force admin role for users in the list
      if (ADMIN_EMAILS.includes(authUser.email || '') && userData) {
        userData.role = 'admin';
      }
      
      console.log("User dynamic data loaded:", userData);
      setUser(userData);
    } catch (error: any) {
      console.error("Detailed error fetching user data:", error);
      // Even if it fails, we shouldn't block the app forever
      // but without user data many things will fail.
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d44211]"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleLogout = async () => {
    if (DEV_MODE) {
      alert("Estàs en mode desenvolupament. El login està desactivat.");
      return;
    }
    await supabase.auth.signOut();
  };

  const handleUpdateInstrument = async (instrument: string) => {
    if (!user) return;
    setUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ instrument })
        .eq('uid', user.uid);
        
      if (error) throw error;
      setUser({ ...user, instrument });
    } catch (error) {
      console.error("Error updating instrument:", error);
      alert("Error en actualitzar l'instrument.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleNavigate = (view: View, eventId?: number) => {
    setCurrentView(view);
    if (eventId) {
      setSelectedEventId(eventId);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard setView={setCurrentView} user={user} />;
      case 'repertoire': return <Repertoire user={user} />;
      case 'calendar': return <CalendarView user={user} selectedEventId={selectedEventId} setSelectedEventId={setSelectedEventId} />;
      case 'rehearsal': return <Rehearsal user={user} />;
      case 'admin': return user.role === 'admin' ? <Admin user={user} /> : <Dashboard setView={setCurrentView} user={user} />;
      default: return <Dashboard setView={setCurrentView} user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f6] text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-[#d44211]/10">
        <div className="flex items-center gap-3 text-[#d44211] cursor-pointer" onClick={() => setCurrentView('dashboard')}>
          <div className="w-8 h-8 bg-[#d44211] rounded-lg flex items-center justify-center text-white">
            <Music size={20} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 hidden sm:block">Colla Guirigall</h2>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-6">
            <button onClick={() => setCurrentView('dashboard')} className={`text-sm font-semibold ${currentView === 'dashboard' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Inici</button>
            <button onClick={() => setCurrentView('repertoire')} className={`text-sm font-semibold ${currentView === 'repertoire' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Repertori</button>
            <button onClick={() => setCurrentView('calendar')} className={`text-sm font-semibold ${currentView === 'calendar' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Calendari</button>
            <button onClick={() => setCurrentView('rehearsal')} className={`text-sm font-semibold ${currentView === 'rehearsal' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Obres i Assajos</button>
            {user.role === 'admin' && (
              <button onClick={() => setCurrentView('admin')} className={`text-sm font-semibold ${currentView === 'admin' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Admin</button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell user={user} onNavigate={handleNavigate} />
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-10 h-10 rounded-full bg-[#d44211]/20 border-2 border-[#d44211] overflow-hidden flex items-center justify-center text-[#d44211] font-bold hover:bg-[#d44211]/30 transition-colors cursor-pointer"
            title="El meu perfil"
          >
            {user.name.charAt(0).toUpperCase()}
          </button>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors" title="Tancar sessió">
            <LogOut size={20} />
          </button>
          {/* Hamburger hidden on mobile — navigation handled by BottomNav */}
        </div>
      </header>

      {/* Mobile navigation is handled by BottomNav */}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>

      {/* Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8f6f6]">
              <h3 className="text-xl font-bold text-slate-900">El meu perfil</h3>
              <button onClick={() => setIsProfileOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nom</label>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium">{user.name}</div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Correu</label>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium">{user.email}</div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">El meu instrument</label>
                <select 
                  value={user.instrument}
                  onChange={(e) => handleUpdateInstrument(e.target.value)}
                  disabled={updatingProfile}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-[#d44211] focus:border-[#d44211] bg-white font-medium"
                >
                  <option value="Sense assignar">Sense assignar</option>
                  <option value="Dolçaina">Dolçaina</option>
                  <option value="Tabal">Tabal</option>
                </select>
              </div>
              {DEV_MODE && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rol (Només DEV)</label>
                  <select 
                    value={user.role}
                    onChange={(e) => setUser({...user, role: e.target.value as 'admin' | 'member'})}
                    className="w-full p-3 border border-amber-200 rounded-xl focus:ring-amber-500 focus:border-amber-500 bg-amber-50 font-medium text-amber-900"
                  >
                    <option value="admin">Administrador</option>
                    <option value="member">Usuari (Membre)</option>
                  </select>
                  <p className="text-[10px] text-amber-600 mt-1 italic">Aquest selector només apareix en mode desenvolupament.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-[#f8f6f6] flex justify-end">
              <button onClick={() => setIsProfileOpen(false)} className="px-6 py-3 bg-[#d44211] text-white font-bold rounded-xl hover:bg-[#d44211]/90 transition-colors shadow-lg shadow-[#d44211]/20">
                Tancar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav currentView={currentView} setCurrentView={setCurrentView} userRole={user.role} />
    </div>
  );
}
