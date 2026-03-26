import { Home, Music, Calendar, Users, Shield } from 'lucide-react';
import { View } from '../App';

export default function BottomNav({ currentView, setCurrentView, userRole }: { currentView: View, setCurrentView: (v: View) => void, userRole?: string }) {
  const tabs = [
    { id: 'dashboard', label: 'Inici', icon: Home },
    { id: 'repertoire', label: 'Repertori', icon: Music },
    { id: 'calendar', label: 'Calendari', icon: Calendar },
    { id: 'rehearsal', label: 'Gestió', icon: Users },
    ...(userRole === 'admin' ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <div className="md:hidden fixed bottom-6 left-6 right-6 glass rounded-3xl px-3 py-3 flex justify-around items-center z-50 shadow-2xl border-white/40 ring-1 ring-slate-900/5 backdrop-blur-xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button 
            key={tab.id}
            onClick={() => setCurrentView(tab.id as View)} 
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-slate-400 hover:text-slate-500'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
              <Icon size={20} strokeWidth={isActive ? 3 : 2} />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${isActive ? 'opacity-100' : 'opacity-0 h-0 w-0'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
