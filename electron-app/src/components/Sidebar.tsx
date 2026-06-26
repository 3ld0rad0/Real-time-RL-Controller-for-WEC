import { Home, Activity, PlaySquare, LineChart, Box, Waves } from 'lucide-react'
import type { Page } from '../App'

interface SidebarProps {
  currentPage: Page
  navigateTo: (page: Page) => void
}

export default function Sidebar({ currentPage, navigateTo }: SidebarProps) {
  const navItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'train', label: 'Train Agent', icon: Activity },
    { id: 'test', label: 'Test Agent', icon: PlaySquare },
    { id: 'results', label: 'Results', icon: LineChart },
    { id: 'models', label: 'Models', icon: Box },
  ] as const

  return (
    <div className="w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 flex flex-col h-full shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Waves className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight leading-tight">WEC-RL</h1>
          <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">Controller</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 relative group ${
                isActive 
                  ? 'text-indigo-700 bg-indigo-50/80 shadow-sm border border-indigo-100' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/80 border border-transparent'
              }`}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
              </div>
              {item.label}
              
              {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-6">
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-sm">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Real-time Reinforcement Learning Controller<br/>
            <span className="text-slate-400">v2.0.0 (Electron)</span>
          </p>
        </div>
      </div>
    </div>
  )
}
