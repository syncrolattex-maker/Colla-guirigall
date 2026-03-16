import { Calendar, MapPin, Music, ChevronRight } from 'lucide-react';
import { UserData } from '../App';

interface DashboardProps {
  setView: (v: any) => void;
  user: UserData;
}

export default function Dashboard({ setView, user }: DashboardProps) {
  return (
    <div className="max-w-md mx-auto p-6 flex flex-col gap-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900">Hola, {user.name.split(' ')[0]}!</h1>
        <p className="text-slate-500 text-base">Membre Actiu • {user.instrument}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setView('repertoire')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#d44211] text-white shadow-lg shadow-[#d44211]/20 hover:scale-[1.02] transition-transform">
          <Music size={32} className="mb-2" />
          <span className="text-sm font-bold">Repertori</span>
        </button>
        <button onClick={() => setView('calendar')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#d44211]/10 text-[#d44211] hover:bg-[#d44211]/20 transition-colors">
          <Calendar size={32} className="mb-2" />
          <span className="text-sm font-bold">El meu calendari</span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Pròxims Esdeveniments</h2>
          <button onClick={() => setView('calendar')} className="text-[#d44211] text-sm font-bold">Veure tots</button>
        </div>

        {/* Practice Card */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-[#d44211]/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center rounded-full bg-[#d44211]/10 px-2 py-0.5 text-xs font-medium text-[#d44211] w-fit">Assaig General</span>
              <h3 className="text-lg font-bold text-slate-900">Pròxim Assaig</h3>
            </div>
            <div className="text-right">
              <p className="text-[#d44211] font-bold text-lg leading-none">Dijous</p>
              <p className="text-slate-500 text-xs mt-1">20:00h - 22:00h</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <MapPin size={16} />
            <span className="truncate">Local de la Colla, Carrer Major 12</span>
          </div>
          <div className="h-24 w-full rounded-lg overflow-hidden mt-1">
            <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1000" alt="Assaig" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" />
          </div>
          <button onClick={() => setView('rehearsal')} className="w-full py-2 bg-white border border-[#d44211]/20 rounded-lg text-[#d44211] text-sm font-bold hover:bg-[#d44211] hover:text-white transition-colors">
            Confirmar assistència
          </button>
        </div>

        {/* Performance Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-[#d44211]/10 shadow-sm cursor-pointer" onClick={() => setView('calendar')}>
          <div className="flex-shrink-0 w-14 h-14 bg-white rounded-lg flex flex-col items-center justify-center border border-[#d44211]/10 shadow-sm">
            <span className="text-[#d44211] font-black text-xl leading-none">24</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">MAIG</span>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <h3 className="text-base font-bold text-slate-900 truncate">Pròxima Actuació</h3>
            <p className="text-slate-500 text-xs">Festa Major de Vilafranca</p>
            <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-1">
              <Calendar size={12} />
              <span>11:30h - Plaça de la Vila</span>
            </div>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#d44211] transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
