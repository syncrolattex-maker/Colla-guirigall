import { Home, MessageSquare, Settings } from 'lucide-react';
import { View } from '../App';

export default function BottomNav({ currentView, setCurrentView }: { currentView: View, setCurrentView: (v: View) => void }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#d44211]/10 px-6 py-3 flex justify-around items-center z-50 pb-safe">
      <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-[#d44211]' : 'text-slate-400'}`}>
        <Home size={24} />
        <span className="text-[10px] font-bold">Inici</span>
      </button>
      <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#d44211]">
        <MessageSquare size={24} />
        <span className="text-[10px] font-bold">Missatges</span>
      </button>
      <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#d44211]">
        <Settings size={24} />
        <span className="text-[10px] font-bold">Configuració</span>
      </button>
    </div>
  );
}
