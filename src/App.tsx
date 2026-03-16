import { useState, useEffect } from 'react';
import { Bell, Menu, Music, LogOut } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';
import Dashboard from './views/Dashboard';
import Repertoire from './views/Repertoire';
import CalendarView from './views/CalendarView';
import Rehearsal from './views/Rehearsal';
import Admin from './views/Admin';
import BottomNav from './components/BottomNav';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserData);
          } else {
            // Fallback if user document isn't created yet by Login
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Nou Membre',
              role: 'member',
              instrument: 'Sense assignar'
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  const handleLogout = () => {
    signOut(auth);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard setView={setCurrentView} user={user} />;
      case 'repertoire': return <Repertoire user={user} />;
      case 'calendar': return <CalendarView user={user} />;
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
            <button onClick={() => setCurrentView('rehearsal')} className={`text-sm font-semibold ${currentView === 'rehearsal' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Assajos</button>
            {user.role === 'admin' && (
              <button onClick={() => setCurrentView('admin')} className={`text-sm font-semibold ${currentView === 'admin' ? 'text-[#d44211] border-b-2 border-[#d44211]' : 'text-slate-600 hover:text-[#d44211]'}`}>Admin</button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#d44211]/10 text-[#d44211] hover:bg-[#d44211]/20 transition-colors">
            <Bell size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#d44211]/20 border-2 border-[#d44211] overflow-hidden flex items-center justify-center text-[#d44211] font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors" title="Tancar sessió">
            <LogOut size={20} />
          </button>
          <button className="md:hidden text-slate-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[73px] left-0 right-0 bg-white border-b border-[#d44211]/10 shadow-lg z-40 flex flex-col">
          <button onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }} className="p-4 text-left font-semibold border-b border-slate-100">Inici</button>
          <button onClick={() => { setCurrentView('repertoire'); setIsMobileMenuOpen(false); }} className="p-4 text-left font-semibold border-b border-slate-100">Repertori</button>
          <button onClick={() => { setCurrentView('calendar'); setIsMobileMenuOpen(false); }} className="p-4 text-left font-semibold border-b border-slate-100">Calendari</button>
          <button onClick={() => { setCurrentView('rehearsal'); setIsMobileMenuOpen(false); }} className="p-4 text-left font-semibold border-b border-slate-100">Assajos</button>
          {user.role === 'admin' && (
            <button onClick={() => { setCurrentView('admin'); setIsMobileMenuOpen(false); }} className="p-4 text-left font-semibold">Admin</button>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>

      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
    </div>
  );
}
