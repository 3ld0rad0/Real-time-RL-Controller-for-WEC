import { useState, useEffect, useRef } from 'react'
import { Activity, Play, StopCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import type { Page } from '../App'

type State = 'idle' | 'running' | 'completed'

export default function Train({ navigateTo }: { navigateTo: (page: Page) => void }) {
  const [state, setState] = useState<State>('idle')
  const [logs, setLogs] = useState<string[]>([])
  
  const [controller, setController] = useState('rl')
  const [controlMode, setControlMode] = useState('latching')
  const [seaState, setSeaState] = useState('3')
  const [mixed, setMixed] = useState(false)
  const [regular, setRegular] = useState(false)
  const [simTime, setSimTime] = useState('2.0')
  const [batchSize, setBatchSize] = useState('2048')
  const [entropyCoef, setEntropyCoef] = useState('0.01')
  const [retrain, setRetrain] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [availableModels, setAvailableModels] = useState<any[]>([])

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getModels().then(setAvailableModels).catch(console.error)
  }, [])

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const handleStart = async () => {
    setState('running')
    setLogs(['Starting training simulation...'])

    const unSubLog = window.api.onSimulationLog((log) => {
      setLogs((prev) => [...prev, log])
    })

    const unSubDone = window.api.onSimulationDone((code) => {
      unSubLog()
      unSubDone()
      setLogs((prev) => [...prev, `Simulation process exited with code ${code}`])
      setState(code === 0 ? 'completed' : 'idle')
    })

    try {
      await window.api.runSimulation({
        mode: 'train',
        control: controller,
        type: controlMode,
        sea_state: parseInt(seaState),
        mixed,
        regular,
        sim_time: parseFloat(simTime),
        save: true,
        retrain,
        model_id: retrain ? selectedModel : undefined,
        batch_size: parseInt(batchSize),
        entropy_coef: parseFloat(entropyCoef)
      })
    } catch (e: any) {
      setLogs((prev) => [...prev, `Failed to start: ${e.message}`])
      setState('idle')
    }
  }

  const handleStop = async () => {
    await window.api.killSimulation()
    setState('idle')
    setLogs((prev) => [...prev, 'Simulation stopped manually.'])
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigateTo('home')}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-600" />
          Train Agent
        </h1>
        <p className="text-slate-600 mt-2">Configure parameters to train a new Reinforcement Learning agent.</p>
      </div>

      {state === 'idle' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Controller</label>
              <select value={controller} onChange={(e) => setController(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
                <option value="rl">RL Control (PPO)</option>
                <option value="baseline">Threshold Baseline</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Control Mode</label>
              <select value={controlMode} onChange={(e) => setControlMode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
                <option value="latching">Latching</option>
                <option value="linear">Linear</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sea State</label>
              <select value={seaState} onChange={(e) => setSeaState(e.target.value)} disabled={mixed} className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:opacity-50">
                <option value="0">SS 0 (Hw=0.8m, T=9.0s)</option>
                <option value="1">SS 1 (Hw=1.2m, T=9.5s)</option>
                <option value="2">SS 2 (Hw=1.6m, T=10.0s)</option>
                <option value="3">SS 3 (Hw=2.0m, T=10.5s)</option>
                <option value="4">SS 4 (Hw=2.5m, T=11.0s)</option>
                <option value="5">SS 5 (Hw=3.0m, T=11.5s)</option>
                <option value="6">SS 6 (Hw=3.5m, T=12.0s)</option>
                <option value="7">SS 7 (Hw=4.0m, T=12.5s)</option>
                <option value="8">SS 8 (Hw=4.5m, T=13.0s)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Simulation Time (hours)</label>
              <input type="number" step="0.1" value={simTime} onChange={(e) => setSimTime(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
            </div>
          </div>

          <div className="flex gap-6 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={mixed} onChange={(e) => setMixed(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-slate-700 font-medium">Mixed Sea States</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={regular} onChange={(e) => setRegular(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-slate-700 font-medium">Regular Waves</span>
            </label>
          </div>

          {controller === 'rl' && (
            <div className="border-t border-slate-200 pt-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">RL Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch Size</label>
                  <input type="number" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Entropy Coef</label>
                  <input type="number" step="0.01" value={entropyCoef} onChange={(e) => setEntropyCoef(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input type="checkbox" checked={retrain} onChange={(e) => setRetrain(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-slate-700 font-medium">Retrain from existing model</span>
              </label>

              {retrain && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base Model</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
                    <option value="" disabled>Select a model...</option>
                    {availableModels.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleStart}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-5 h-5" /> Start Training
          </button>
        </div>
      )}

      {state === 'running' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full relative"></div>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Training in Progress</h2>
            </div>
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <StopCircle className="w-4 h-4" /> Stop Simulation
            </button>
          </div>

          <div className="bg-slate-900 text-slate-300 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto whitespace-pre-wrap">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {state === 'completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center shadow-sm">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Training Completed!</h2>
          <p className="text-slate-600 mb-6">The simulation finished successfully. Check the results page for data.</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigateTo('results')}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              View Results
            </button>
            <button
              onClick={() => { setState('idle'); setLogs([]) }}
              className="px-6 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg transition-colors"
            >
              New Training
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

