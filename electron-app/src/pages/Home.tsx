import { Activity, PlaySquare, LineChart, Box, Zap, ArrowRight } from 'lucide-react'
import type { Page } from '../App'

interface HomeProps {
  navigateTo: (page: Page) => void
}

export default function Home({ navigateTo }: HomeProps) {
  return (
    <div className="p-10 max-w-5xl mx-auto h-full flex flex-col justify-center">
      
      <div className="mb-12 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-semibold mb-6 shadow-sm">
          <Zap className="w-4 h-4" /> Desktop Edition Active
        </div>
        <h1 className="text-5xl font-bold font-display text-slate-900 tracking-tight mb-4 leading-tight">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">WEC-RL</span> Controller
        </h1>
        <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">
          Manage, train, and test intelligent Reinforcement Learning agents for Wave Energy Converters directly from your desktop.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <button
          onClick={() => navigateTo('train')}
          className="glass-card p-8 rounded-2xl flex flex-col items-start text-left group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
            <Activity className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">Train Agent</h2>
          <p className="text-slate-500 leading-relaxed font-medium">Configure deep learning parameters and run a new PPO training simulation against complex sea states.</p>
        </button>

        <button
          onClick={() => navigateTo('test')}
          className="glass-card p-8 rounded-2xl flex flex-col items-start text-left group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
            <PlaySquare className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">Test Agent</h2>
          <p className="text-slate-500 leading-relaxed font-medium">Evaluate a trained agent or baseline logic against specific wave conditions to observe efficiency.</p>
        </button>

        <button
          onClick={() => navigateTo('results')}
          className="glass-card p-8 rounded-2xl flex flex-col items-start text-left group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-6 h-6 text-purple-400" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
            <LineChart className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">View Results</h2>
          <p className="text-slate-500 leading-relaxed font-medium">Analyze rich interactive time-series plots and raw CSV data from previous simulations.</p>
        </button>

        <button
          onClick={() => navigateTo('models')}
          className="glass-card p-8 rounded-2xl flex flex-col items-start text-left group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-6 h-6 text-amber-400" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
            <Box className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">Browse Models</h2>
          <p className="text-slate-500 leading-relaxed font-medium">View all trained agents, inspect their configurations, and instantly load them for testing.</p>
        </button>
      </div>
    </div>
  )
}
