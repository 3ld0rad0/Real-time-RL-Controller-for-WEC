import { useState, useRef, useEffect } from 'react'
import { Play, Square, Settings, Activity, Terminal } from 'lucide-react'
import type { Page } from '../App'

interface TrainProps {
  navigateTo: (page: Page) => void
}

export default function Train({ navigateTo: _navigateTo }: TrainProps) {
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Form State
  const [control, setControl] = useState('latching')
  const [type, _setType] = useState('sim')
  const [waveType, setWaveType] = useState('irregular')
  const [seaState, setSeaState] = useState('2')
  const [batchSize, setBatchSize] = useState('2048')
  const [entropyCoef, setEntropyCoef] = useState('0.01')

  useEffect(() => {
    const unsubscribeLog = window.api.onSimulationLog((data: string) => {
      setLogs(prev => [...prev, data.trim()])
    })
    const unsubscribeDone = window.api.onSimulationDone((code: number) => {
      setRunning(false)
      setLogs(prev => [...prev, `\n--- Simulation exited with code ${code} ---`])
    })

    return () => {
      unsubscribeLog()
      unsubscribeDone()
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setLogs(['Initializing training environment...'])
    setRunning(true)

    try {
      await window.api.runSimulation({
        mode: 'train',
        control,
        type,
        mixed: waveType === 'mixed',
        regular: waveType === 'regular',
        sea_state: parseInt(seaState),
        batch_size: parseInt(batchSize),
        entropy_coef: parseFloat(entropyCoef),
        save: true
      })
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: ${err.message}`])
      setRunning(false)
    }
  }

  const handleStop = async () => {
    await window.api.killSimulation()
    setRunning(false)
  }

  return (
    <div className="p-10 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-10 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-bold font-display text-slate-900 mb-3 tracking-tight">Train Agent</h1>
          <p className="text-lg text-slate-500 font-medium">Configure and run PPO reinforcement learning simulations.</p>
        </div>
      </div>

      <div className="flex gap-8 flex-1 min-h-0 pb-10">
        {/* Form Panel */}
        <div className="w-[400px] glass-card rounded-3xl p-8 flex flex-col shadow-sm shrink-0 overflow-y-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Configuration</h2>
          </div>
          
          <form onSubmit={handleStart} className="space-y-6 flex-1 flex flex-col">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Control Mode</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  value={control} onChange={e => setControl(e.target.value)} disabled={running}
                >
                  <option value="latching">Latching</option>
                  <option value="reactive">Reactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wave Type</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  value={waveType} onChange={e => setWaveType(e.target.value)} disabled={running}
                >
                  <option value="irregular">Irregular</option>
                  <option value="regular">Regular</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sea State</label>
                <input 
                  type="number" min="1" max="5" 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  value={seaState} onChange={e => setSeaState(e.target.value)} disabled={running}
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Batch Size</label>
                <input 
                  type="number" step="512"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  value={batchSize} onChange={e => setBatchSize(e.target.value)} disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entropy Coefficient</label>
                <input 
                  type="number" step="0.001"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  value={entropyCoef} onChange={e => setEntropyCoef(e.target.value)} disabled={running}
                />
              </div>
            </div>

            <div className="pt-6 mt-auto">
              {!running ? (
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2 group">
                  <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> Start Training
                </button>
              ) : (
                <button type="button" onClick={handleStop} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-red-500/20 flex justify-center items-center gap-2 group">
                  <Square className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> Stop Simulation
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Console Panel */}
        <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden flex flex-col shadow-xl shadow-slate-900/10 border border-slate-800">
          <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-3 text-slate-300">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-sm tracking-wide">Live Output Log</span>
            </div>
            {running && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-400/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div> Running
              </div>
            )}
          </div>
          <div className="flex-1 p-6 overflow-y-auto font-mono text-sm text-slate-300 bg-slate-900 leading-relaxed selection:bg-indigo-500/30">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <p>Output logs will appear here</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">{log}</div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
