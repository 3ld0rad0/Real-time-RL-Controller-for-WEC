import { useState, useRef, useEffect } from 'react'
import { Play, Square, Settings, Activity, Terminal, ShieldAlert, ChevronUp, LineChart, FolderOpen, AlertCircle } from 'lucide-react'
import type { Page } from '../App'
import Dropdown from '../components/Dropdown'
import FileBrowserModal from '../components/FileBrowserModal'

function getRelativeModelPath(filePath: string): string {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  const modelsIndex = normalizedPath.indexOf('/models/');
  if (modelsIndex !== -1) {
    return normalizedPath.substring(modelsIndex + 8);
  } else if (normalizedPath.startsWith('models/')) {
    return normalizedPath.substring(7);
  } else if (normalizedPath.startsWith('./models/')) {
    return normalizedPath.substring(9);
  }
  return filePath;
}

interface TestProps {
  navigateTo: (page: Page, autoExpand?: boolean, runId?: string | null) => void
  initialModelId?: string | null
  runningSim: 'train' | 'test' | null
  setRunningSim: (sim: 'train' | 'test' | null) => void
  active: boolean
}

export default function Test({ navigateTo, initialModelId, runningSim, setRunningSim, active }: TestProps) {
  const running = runningSim === 'test'
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [energyAbsorbed, setEnergyAbsorbed] = useState<number | null>(null)
  const [latestRunId, setLatestRunId] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const runningSimRef = useRef(runningSim)
  runningSimRef.current = runningSim

  const getSeaStateString = (indexStr: string, isMixed: boolean) => {
    if (isMixed) return 'sea_state_mixed'
    const mappings: Record<string, string> = {
      '0': 'sea_state_0.8_9.0',
      '1': 'sea_state_1.4_9.7',
      '2': 'sea_state_2.0_10.5',
      '3': 'sea_state_2.9_11.5',
      '4': 'sea_state_4.0_12.7',
      '5': 'sea_state_5.4_14.0',
      '6': 'sea_state_7.0_15.5',
      '7': 'sea_state_8.8_17.2',
      '8': 'sea_state_mixed'
    }
    return mappings[indexStr] || 'unknown'
  }

  const getSeaStateDetails = (indexStr: string) => {
    const details: Record<string, string> = {
      '0': 'Hs=0.8m, Tp=9.0s',
      '1': 'Hs=1.4m, Tp=9.7s',
      '2': 'Hs=2.0m, Tp=10.5s',
      '3': 'Hs=2.9m, Tp=11.5s',
      '4': 'Hs=4.0m, Tp=12.7s',
      '5': 'Hs=5.4m, Tp=14.0s',
      '6': 'Hs=7.0m, Tp=15.5s',
      '7': 'Hs=8.8m, Tp=17.2s'
    }
    return details[indexStr] || 'Unknown'
  }

  // Form State
  const [control, setControl] = useState('latching')
  const [type, setType] = useState('sim')
  const [waveType, setWaveType] = useState('irregular')
  const [seaState, setSeaState] = useState('2')
  const [simTime, setSimTime] = useState('60')
  const [modelId, setModelId] = useState(getRelativeModelPath(initialModelId || ''))
  const [models, setModels] = useState<any[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false)

  const modelOptions = [
    { value: '', label: '-- Choose a Model --' },
    ...models.map((m: any) => ({ value: m.id, label: m.name }))
  ]
  if (modelId && !models.some((m: any) => m.id === modelId)) {
    modelOptions.push({ value: modelId, label: modelId })
  }

  const handleBrowseModel = () => {
    setIsFileBrowserOpen(true)
  }

  // Sync initialModelId and configuration parameters from config.json when tab becomes active
  useEffect(() => {
    if (active) {
      window.api.getConfig().then((data) => {
        setControl(data.control_mode === 'linear' ? 'reactive' : 'latching')
        setType(data.rl_control ? 'sim' : 'real')
        
        if (data.mixed_sea_state) {
          setWaveType('mixed')
        } else if (data.regular) {
          setWaveType('regular')
        } else {
          setWaveType('irregular')
        }

        setSeaState((data.init_SS_test ?? 2).toString())
        setSimTime((data.sim_time_test ?? 60).toString())

        if (initialModelId) {
          setModelId(getRelativeModelPath(initialModelId))
        } else if (data.path_model) {
          setModelId(getRelativeModelPath(data.path_model))
        }
      }).catch(console.error)

      window.api.getModels().then((data) => {
        setModels(data)
      }).catch(console.error)
    }
  }, [active, initialModelId])

  // Validation for model parameter matching in Test page
  useEffect(() => {
    if (!modelId || type !== 'sim') {
      setWarnings([])
      return
    }

    const selectedModel = models.find(m => m.id === modelId)
    if (!selectedModel) {
      setWarnings([])
      return
    }

    const newWarnings: string[] = []

    // Control Mode check
    const selectedModelControl = selectedModel.name.includes('linear') ? 'reactive' : 'latching'
    if (selectedModelControl !== control) {
      newWarnings.push(`Control Mode mismatch: selected model is for '${selectedModelControl === 'reactive' ? 'Linear' : 'Latching'}' control, current form is '${control === 'reactive' ? 'Linear' : 'Latching'}'.`)
    }

    if (selectedModel.wave_type !== 'unknown' && selectedModel.wave_type !== waveType) {
      newWarnings.push(`Wave Type mismatch: selected model is for '${selectedModel.wave_type}' waves, current form is '${waveType}'.`)
    }

    const currentSeaStateStr = getSeaStateString(seaState, waveType === 'mixed')
    if (selectedModel.sea_state !== 'unknown' && selectedModel.sea_state !== currentSeaStateStr) {
      newWarnings.push(`Sea State mismatch: selected model is '${selectedModel.sea_state.replace('sea_state_', '')}', current form is '${currentSeaStateStr.replace('sea_state_', '')}'.`)
    }

    setWarnings(newWarnings)
  }, [modelId, waveType, seaState, control, type, models])

  useEffect(() => {
    const unsubscribeLog = window.api.onSimulationLog((data: string) => {
      if (runningSimRef.current === 'test') {
        setLogs(prev => [...prev, data.trim()])

        // Split data by lines to parse results safely
        const lines = data.split(/\r?\n/)
        for (const line of lines) {
          if (line.includes("[TEST_RESULT]")) {
            const match = line.match(/\[TEST_RESULT\]\s+energy=(-?[\d\.]+)/)
            if (match) {
              setEnergyAbsorbed(parseFloat(match[1]))
            }
          }
        }
      }
    })
    const unsubscribeProgress = window.api.onSimulationProgress((percent: number) => {
      if (runningSimRef.current === 'test') {
        setProgress(percent)
      }
    })
    const unsubscribeDone = window.api.onSimulationDone((code: number) => {
      if (runningSimRef.current === 'test') {
        setRunningSim(null)
        setProgress(100)
        setLogs(prev => [...prev, `\n--- Simulation exited with code ${code} ---`])
      }
    })

    return () => {
      unsubscribeLog()
      unsubscribeProgress()
      unsubscribeDone()
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setLogs(['Initializing testing environment...'])
    setProgress(0)
    setRunningSim('test')
    setStep(2)
    setEnergyAbsorbed(null)

    try {
      const result = await window.api.runSimulation({
        mode: 'test',
        control,
        type,
        mixed: waveType === 'mixed',
        regular: waveType === 'regular',
        sea_state: waveType === 'mixed' ? 1 : parseInt(seaState),
        sim_time: parseFloat(simTime),
        save: true,
        model_id: modelId || undefined
      })
      if (result && typeof result === 'object' && result.latestRunId) {
        setLatestRunId(result.latestRunId)
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: ${err.message}`])
      setRunningSim(null)
    }
  }

  const handleStop = async () => {
    const confirm = window.confirm("Sei sicuro di voler interrompere la simulazione di test?")
    if (!confirm) return
    await window.api.killSimulation()
    setRunningSim(null)
    setStep(1)
  }

  return (
    <div className="p-10 w-full h-full flex flex-col">
      <div className="mb-10 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-bold font-display text-slate-900 mb-3 tracking-tight">Simulation Test</h1>
          <p className="text-lg text-slate-500 font-medium">Evaluate trained PPO models or baseline controllers.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 pb-10">
        {step === 1 ? (
          /* Step 1: Configuration View */
          <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col animate-fade-in">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Test Configurations</h2>
                <p className="text-xs text-slate-400">Configure parameters for physical WEC testing</p>
              </div>
            </div>

            <form onSubmit={handleStart} className="space-y-6 flex-1 flex flex-col">
              {runningSim === 'train' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Training in Progress</h4>
                    <p className="text-xs text-amber-600 mt-1">A training simulation is currently running in the background. Please wait for it to finish or stop it before running a test.</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Control Mode</label>
                  <Dropdown
                    value={control}
                    onChange={(val) => setControl(val)}
                    options={[
                      { value: 'latching', label: 'Latching' },
                      { value: 'reactive', label: 'Linear' }
                    ]}
                    disabled={running}
                    themeColor="emerald"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Agent Type</label>
                  <Dropdown
                    value={type}
                    onChange={(val) => setType(val)}
                    options={[
                      { value: 'sim', label: 'RL Agent (PPO)' },
                      { value: 'real', label: 'Baseline (Threshold Control)' }
                    ]}
                    disabled={running}
                    themeColor="emerald"
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wave Mode</label>
                    <Dropdown
                      value={waveType}
                      onChange={(val) => setWaveType(val)}
                      options={[
                        { value: 'irregular', label: 'Irregular' },
                        { value: 'regular', label: 'Regular' },
                        { value: 'mixed', label: 'Mixed' }
                      ]}
                      disabled={running}
                      themeColor="emerald"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sea State</label>
                    {waveType === 'mixed' ? (
                      <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 outline-none transition-all font-medium text-sm"
                        value="N/A (Mixed)"
                        disabled
                      />
                    ) : (
                      <Dropdown
                        value={seaState}
                        onChange={(val) => setSeaState(val)}
                        options={[
                          { value: '0', label: 'State 0: Hs = 0.8m, Tp = 9.0s' },
                          { value: '1', label: 'State 1: Hs = 1.4m, Tp = 9.7s' },
                          { value: '2', label: 'State 2: Hs = 2.0m, Tp = 10.5s' },
                          { value: '3', label: 'State 3: Hs = 2.9m, Tp = 11.5s' },
                          { value: '4', label: 'State 4: Hs = 4.0m, Tp = 12.7s' },
                          { value: '5', label: 'State 5: Hs = 5.4m, Tp = 14.0s' },
                          { value: '6', label: 'State 6: Hs = 7.0m, Tp = 15.5s' },
                          { value: '7', label: 'State 7: Hs = 8.8m, Tp = 17.2s' }
                        ]}
                        disabled={running}
                        themeColor="emerald"
                        className="w-full"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (s)</label>
                    <input 
                      type="number" step="10"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium"
                      value={simTime} onChange={e => setSimTime(e.target.value)} disabled={running}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target PPO Model</label>
                    <div className="flex gap-2 min-w-0">
                      <Dropdown
                        value={modelId}
                        onChange={(val) => setModelId(val)}
                        options={modelOptions}
                        disabled={running}
                        themeColor="emerald"
                        className="flex-1 min-w-0"
                        placeholder="-- Choose a Model --"
                      />
                      <button
                        type="button"
                        onClick={handleBrowseModel}
                        disabled={running}
                        className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer transition-colors shadow-sm"
                        title="Select Custom Model File from Disk"
                      >
                        <FolderOpen className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mt-3 flex items-start gap-2.5 shadow-sm text-xs leading-relaxed animate-fade-in col-span-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">Parameter Mismatches Detected:</span>
                        <ul className="list-disc list-inside space-y-1 text-amber-700">
                          {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                        </ul>
                        <span className="block mt-2 font-semibold text-amber-600">Testing this model under different conditions might behave unexpectedly.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button 
                  type="submit" 
                  disabled={runningSim !== null}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-355 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-emerald-600/20 disabled:shadow-none flex justify-center items-center gap-2 group cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> Start Test Run
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step 2: Dashboard View */
          <div className="w-full flex flex-col gap-6 animate-fade-in">
            {/* Simulation Status Card */}
            <div className={`glass-card rounded-3xl flex flex-col shadow-sm border border-slate-100 bg-white transition-all duration-300 ${
              showLogs ? 'p-5' : 'p-8'
            }`}>
              <div className={`flex justify-between items-center ${showLogs ? 'mb-4' : 'mb-6'}`}>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Simulation Status</h3>
                  {!showLogs && <p className="text-sm text-slate-400">Real-time testing execution tracking</p>}
                </div>
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  running 
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
                    : progress === 100 
                      ? 'text-indigo-600 bg-indigo-50 border-indigo-200' 
                      : 'text-slate-500 bg-slate-50 border-slate-200'
                }`}>
                  {running ? 'Running' : progress === 100 ? 'Completed' : 'Idle'}
                </div>
              </div>

              {/* Progress representation */}
              <div className="my-2">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-slate-700">Progress</span>
                  <span className="text-2xl font-extrabold text-slate-900 font-display">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-150">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-inner"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Run details list */}
              {!showLogs && (
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 text-sm animate-fade-in">
                  <div>
                    <span className="text-slate-400 block mb-1">Sea State</span>
                    <span className="font-bold text-slate-800">
                      {waveType === 'mixed' ? 'Mixed States' : `State ${seaState} (${getSeaStateDetails(seaState)})`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Wave Type</span>
                    <span className="font-bold text-slate-800 capitalize">{waveType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Control Mode</span>
                    <span className="font-bold text-slate-800 capitalize">
                      {control === 'reactive' ? 'Linear' : 'Latching'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Duration</span>
                    <span className="font-bold text-slate-800">{simTime}s</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-1">Agent Type</span>
                    <span className="font-bold text-slate-800">
                      {type === 'sim' ? 'RL Agent (PPO)' : 'Baseline (Threshold Control)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Test Result Highlight Card (if test finished and energy value is parsed) */}
              {!running && energyAbsorbed !== null && (
                <div className="bg-emerald-50 border border-emerald-100/60 rounded-2xl p-5 mb-6 text-center animate-fade-in shadow-sm">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Total Energy Absorbed</span>
                  <span className="text-3xl font-extrabold text-emerald-800 font-display block">
                    {energyAbsorbed.toFixed(3)} <span className="text-lg font-bold">MJ</span>
                  </span>
                </div>
              )}

              {/* Control Trigger inside the Card */}
              <div className={`pt-6 border-t border-slate-100 ${showLogs ? 'mt-4' : 'mt-8'}`}>
                {running ? (
                  <button 
                    type="button" 
                    onClick={handleStop} 
                    className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-red-500/20 flex justify-center items-center gap-2 group cursor-pointer"
                  >
                    <Square className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> Stop Simulation
                  </button>
                ) : (
                  <div className="flex gap-4 w-full">
                    <button 
                      type="button" 
                      onClick={() => navigateTo('results', true, latestRunId)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2 cursor-pointer font-bold text-sm"
                    >
                      <LineChart className="w-5 h-5" /> View Results
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setStep(1)
                        setProgress(0)
                        setLogs([])
                        setLatestRunId(null)
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-4 px-4 font-bold transition-colors border border-slate-200 flex justify-center items-center gap-2 cursor-pointer font-bold text-sm"
                    >
                      Configure New Run
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!showLogs ? (
              /* Button to show logs */
              <button 
                type="button" 
                onClick={() => setShowLogs(true)}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl border border-slate-800 transition-all shadow-md group shrink-0 cursor-pointer"
              >
                <Terminal className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Show Live Console Logs ({logs.length} lines)</span>
              </button>
            ) : (
              /* Expanded Console Panel */
              <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden flex flex-col shadow-xl border border-slate-800 min-h-[250px] transition-all duration-300">
                <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-300">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <span className="font-semibold text-sm tracking-wide">Live Output Log</span>
                    <span className="text-xs bg-slate-700 text-slate-400 px-2.5 py-0.5 rounded-full font-mono">{logs.length} lines</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowLogs(false)}
                    className="text-slate-400 hover:text-slate-200 bg-slate-700/50 hover:bg-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto font-mono text-sm text-slate-300 bg-slate-900 leading-relaxed selection:bg-emerald-500/30 max-h-[350px]">
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
            )}
          </div>
        )}
      <FileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        onSelectFile={(filePath) => setModelId(getRelativeModelPath(filePath))}
        title="Select Target PPO Model"
        themeColor="emerald"
      />
      </div>
    </div>
  )
}
