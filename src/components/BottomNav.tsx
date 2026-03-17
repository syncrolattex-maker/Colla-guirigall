import { Home, Music, Calendar, Users } from 'lucide-react';
import { View } from '../App';

export default function BottomNav({ currentView, setCurrentView }: { currentView: View, setCurrentView: (v: View) => void }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#d44211]/10 px-6 py-3 flex justify-around items-center z-50 pb-safe">
      <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-[#d44211]' : 'text-slate-400'}`}>
        <Home size={24} />
        <span className="text-[10px] font-bold">Inici</span>
      </button>
      <button onClick={() => setCurrentView('repertoire')} className={`flex flex-col items-center gap-1 ${currentView === 'repertoire' ? 'text-[#d44211]' : 'text-slate-400'}`}>
        <Music size={24} />
        <span className="text-[10px] font-bold">Repertori</span>
      </button>
      <button onClick={() => setCurrentView('calendar')} className={`flex flex-col items-center gap-1 ${currentView === 'calendar' ? 'text-[#d44211]' : 'text-slate-400'}`}>
        <Calendar size={24} />
        <span className="text-[10px] font-bold">Calendari</span>
      </button>
      <button onClick={() => setCurrentView('rehearsal')} className={`flex flex-col items-center gap-1 ${currentView === 'rehearsal' ? 'text-[#d44211]' : 'text-slate-400'}`}>
        <Users size={24} />
        <span className="text-[10px] font-bold">Obres i Assajos</span>
      </button>
    </div>
  );
}
