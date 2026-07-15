import { useState, useRef, useEffect } from 'react'
import { Play, Square, Settings, Activity, Terminal, ShieldAlert, ChevronUp, LineChart, AlertCircle, FolderOpen } from 'lucide-react'
import type { Page } from '../App'
import Dropdown from '../components/Dropdown'
import FileBrowserModal from '../components/FileBrowserModal'

interface TrainingMetric {
  step: number
  episode: number
  reward: number
  loss: number
}

interface TrainProps {
  navigateTo: (page: Page, autoExpand?: boolean) => void
  runningSim: 'train' | 'test' | null
  setRunningSim: (sim: 'train' | 'test' | null) => void
  active: boolean
}

export default function Train({ navigateTo, runningSim, setRunningSim, active }: TrainProps) {
  const running = runningSim === 'train'
  const [logs, setLogs] = useState<string[]>([])
  const [trainProgress, setTrainProgress] = useState(0)
  const [testProgress, setTestProgress] = useState(0)
  const [phase, setPhase] = useState<'training' | 'testing'>('training')
  const [showLogs, setShowLogs] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const runningSimRef = useRef(runningSim)
  runningSimRef.current = runningSim

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Form State
  const [control, setControl] = useState('latching')
  const [type, _setType] = useState('sim')
  const [waveType, setWaveType] = useState('irregular')
  const [seaState, setSeaState] = useState('2')
  const [configBatchSize, setConfigBatchSize] = useState('1')
  const [configEntCoef, setConfigEntCoef] = useState('0.01')
  const [configSimTimeTest, setConfigSimTimeTest] = useState('60')
  const [simTimeTrain, setSimTimeTrain] = useState('0.1')

  // Fine-tuning State
  const [retrain, setRetrain] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [latestMetric, setLatestMetric] = useState<TrainingMetric | null>(null)
  const [energyAbsorbed, setEnergyAbsorbed] = useState<number | null>(null)
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false)

  const modelOptions = [
    { value: '', label: '-- Choose a Model --' },
    ...models.map((m: any) => ({ value: m.id, label: m.name }))
  ]
  if (selectedModelId && !models.some((m: any) => m.id === selectedModelId)) {
    modelOptions.push({ value: selectedModelId, label: selectedModelId })
  }

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

  useEffect(() => {
    if (active) {
      window.api.getConfig().then((data) => {
        setConfigBatchSize((data.batch_size ?? 1).toString())
        setConfigEntCoef((data.ent_coef ?? 0.01).toString())
        setConfigSimTimeTest((data.sim_time_test ?? 60).toString())
        setSimTimeTrain((data.sim_time_train ?? 0.1).toString())
      }).catch(console.error)

      window.api.getModels().then((mList) => {
        setModels(mList)
      }).catch(console.error)
    }
  }, [active])

  useEffect(() => {
    if (!retrain || !selectedModelId) {
      setWarnings([])
      return
    }

    const selectedModel = models.find(m => m.id === selectedModelId)
    if (!selectedModel) {
      setWarnings([])
      return
    }

    const newWarnings: string[] = []

    // Control Mode check
    const selectedModelControl = selectedModel.name.includes('linear') ? 'reactive' : 'latching'
    if (selectedModelControl !== control) {
      newWarnings.push(`Control Mode mismatch: selected model is for '${selectedModelControl}' control, current form is '${control}'.`)
    }

    if (selectedModel.wave_type !== 'unknown' && selectedModel.wave_type !== waveType) {
      newWarnings.push(`Wave Type mismatch: selected model is '${selectedModel.wave_type}', current form is '${waveType}'.`)
    }

    const currentSeaStateStr = getSeaStateString(seaState, waveType === 'mixed')
    if (selectedModel.sea_state !== 'unknown' && selectedModel.sea_state !== currentSeaStateStr) {
      newWarnings.push(`Sea State mismatch: selected model is '${selectedModel.sea_state.replace('sea_state_', '')}', current form is '${currentSeaStateStr.replace('sea_state_', '')}'.`)
    }

    if (selectedModel.ent_coef !== 'unknown' && parseFloat(selectedModel.ent_coef) !== parseFloat(configEntCoef)) {
      newWarnings.push(`Entropy Coeff. mismatch: selected model used '${selectedModel.ent_coef}', current settings use '${configEntCoef}'.`)
    }

    setWarnings(newWarnings)
  }, [retrain, selectedModelId, waveType, seaState, configEntCoef, control, models])

  useEffect(() => {
    let currentPhase: 'training' | 'testing' = 'training'

    const unsubscribeLog = window.api.onSimulationLog((data: string) => {
      if (runningSimRef.current === 'train') {
        const text = data.trim()
        setLogs(prev => [...prev, text])

        if (text.toLowerCase().includes("starting test simulation")) {
          currentPhase = 'testing'
          setPhase('testing')
          setTrainProgress(100)
        } else if (text.toLowerCase().includes("initializing training environment") || text.toLowerCase().includes("starting train simulation")) {
          currentPhase = 'training'
          setPhase('training')
        }

        // Split data by lines to parse metrics safely
        const lines = data.split(/\r?\n/)
        for (const line of lines) {
          if (line.includes("[METRICS]")) {
            const match = line.match(/\[METRICS\]\s+step=(\d+)\s+episode=(\d+)\s+reward=(-?[\d\.]+)\s+loss=(-?[\d\.]+)/)
            if (match) {
              setLatestMetric({
                step: parseInt(match[1]),
                episode: parseInt(match[2]),
                reward: parseFloat(match[3]),
                loss: parseFloat(match[4])
              })
            }
          } else if (line.includes("[TEST_RESULT]")) {
            const match = line.match(/\[TEST_RESULT\]\s+energy=(-?[\d\.]+)/)
            if (match) {
              setEnergyAbsorbed(parseFloat(match[1]))
            }
          }
        }
      }
    })
    const unsubscribeProgress = window.api.onSimulationProgress((percent: number) => {
      if (runningSimRef.current === 'train') {
        if (currentPhase === 'training') {
          setTrainProgress(percent)
        } else {
          setTestProgress(percent)
        }
      }
    })
    const unsubscribeDone = window.api.onSimulationDone((code: number) => {
      if (runningSimRef.current === 'train') {
        setRunningSim(null)
        setTrainProgress(100)
        setTestProgress(100)
        currentPhase = 'training'
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
    setLogs(['Initializing training environment...'])
    setTrainProgress(0)
    setTestProgress(0)
    setPhase('training')
    setRunningSim('train')
    setStep(2)
    setLatestMetric(null)
    setEnergyAbsorbed(null)

    try {
      await window.api.runSimulation({
        mode: 'train',
        control,
        type,
        sea_state: waveType === 'mixed' ? 1 : parseInt(seaState, 10),
        mixed: waveType === 'mixed',
        regular: waveType === 'regular',
        sim_time: parseFloat(simTimeTrain),
        batch_size: parseInt(configBatchSize, 10),
        entropy_coef: parseFloat(configEntCoef),
        save: true,
        retrain: retrain,
        model_id: retrain && selectedModelId ? selectedModelId : undefined
      })
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: ${err.message}`])
      setRunningSim(null)
    }
  }

  const handleStop = async () => {
    const confirm = window.confirm("Sei sicuro di voler interrompere la simulazione di training?")
    if (!confirm) return
    await window.api.killSimulation()
    setRunningSim(null)
    setStep(1)
  }

  const handleBrowseModel = () => {
    setIsFileBrowserOpen(true)
  }

  return (
    <div className="p-10 w-full h-full flex flex-col">
      <div className="mb-10 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-bold font-display text-slate-900 mb-3 tracking-tight">Train</h1>
          <p className="text-lg text-slate-500 font-medium">Configure and run PPO reinforcement learning simulations.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 pb-10">
        {step === 1 ? (
          /* Step 1: Configuration View */
          <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col animate-fade-in">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Training Configurations</h2>
                <p className="text-xs text-slate-400">Configure parameters for agent training</p>
              </div>
            </div>

            <form onSubmit={handleStart} className="space-y-6 flex-1 flex flex-col">
              {runningSim === 'test' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Testing in Progress</h4>
                    <p className="text-xs text-amber-600 mt-1">A test simulation is currently running in the background. Please wait for it to finish or stop it before starting training.</p>
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
                    themeColor="indigo"
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
                      themeColor="indigo"
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
                        themeColor="indigo"
                        className="w-full"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Training Duration (hours)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-sm"
                    value={simTimeTrain}
                    onChange={e => setSimTimeTrain(e.target.value)}
                    disabled={running}
                  />
                </div>

                {/* Fine-Tuning Block */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer animate-none"
                      checked={retrain}
                      onChange={e => {
                        setRetrain(e.target.checked)
                        if (!e.target.checked) setSelectedModelId('')
                      }}
                      disabled={running}
                    />
                    <span className="text-sm font-semibold text-slate-700">Fine-tune existing model</span>
                  </label>

                  {retrain && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Model</label>
                      <div className="flex gap-2 min-w-0">
                        <Dropdown
                          value={selectedModelId}
                          onChange={(val) => setSelectedModelId(val)}
                          options={modelOptions}
                          disabled={running}
                          themeColor="indigo"
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

                      {warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mt-3 flex items-start gap-2.5 shadow-sm text-xs leading-relaxed animate-fade-in">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-1">Parameter Mismatches Detected:</span>
                            <ul className="list-disc list-inside space-y-1 text-amber-700">
                              {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                            </ul>
                            <span className="block mt-2 font-semibold text-amber-600">Fine-tuning might fail or behave unexpectedly.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={runningSim !== null}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-355 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-indigo-600/20 disabled:shadow-none flex justify-center items-center gap-2 group cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> Start Training
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step 2: Dashboard View */
          <div className="w-full flex flex-col gap-6 animate-fade-in">
            {/* Simulation Status Card */}
            <div className={`glass-card rounded-3xl flex flex-col shadow-sm border border-slate-100 bg-white transition-all duration-300 ${showLogs ? 'p-5' : 'p-8'
              }`}>
              <div className={`flex justify-between items-center ${showLogs ? 'mb-4' : 'mb-6'}`}>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Simulation Status</h3>
                  {!showLogs && <p className="text-sm text-slate-400">Real-time training execution tracking</p>}
                </div>
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${running
                    ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
                    : (trainProgress === 100 && testProgress === 100)
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      : 'text-slate-500 bg-slate-50 border-slate-200'
                  }`}>
                  {running ? 'Running' : (trainProgress === 100 && testProgress === 100) ? 'Completed' : 'Idle'}
                </div>
              </div>

              {/* Live metrics cards (always visible if training and data exists) */}
              {phase === 'training' && latestMetric && (
                <div className="grid grid-cols-3 gap-4 mb-6 animate-fade-in">
                  {/* Episode Card */}
                  <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Episode</span>
                    <span className="text-xl font-extrabold text-indigo-600 font-display block">{latestMetric.episode}</span>
                  </div>
                  {/* Mean Reward Card */}
                  <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mean Reward</span>
                    <span className="text-xl font-extrabold text-indigo-600 font-display block" title={latestMetric.reward.toString()}>
                      {latestMetric.reward.toFixed(4)}
                    </span>
                  </div>
                  {/* Policy Loss Card */}
                  <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Policy Loss</span>
                    <span className="text-xl font-extrabold text-indigo-600 font-display block" title={latestMetric.loss.toString()}>
                      {latestMetric.loss.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}

              {/* Progress representation */}
              <div className="space-y-4 my-2">
                {/* Training Phase Bar */}
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${phase === 'training' && running ? 'bg-indigo-500 animate-ping' : 'bg-indigo-300'
                        }`}></span>
                      Training Phase
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 font-display">{trainProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-150">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full rounded-full transition-all duration-350 shadow-inner"
                      style={{ width: `${trainProgress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Testing Phase Bar */}
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${phase === 'testing' && running ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                        }`}></span>
                      Evaluation Test Phase
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 font-display">
                      {phase === 'training' ? '0%' : `${testProgress}%`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-150">
                    <div
                      className={`h-full rounded-full transition-all duration-350 shadow-inner bg-gradient-to-r ${phase === 'training'
                          ? 'from-slate-300 to-slate-200'
                          : 'from-emerald-500 to-emerald-400'
                        }`}
                      style={{ width: `${phase === 'training' ? 0 : testProgress}%` }}
                    ></div>
                  </div>
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
                    <span className="text-slate-400 block mb-1">Batch Size</span>
                    <span className="font-bold text-slate-800">{configBatchSize}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-1">Entropy Coeff.</span>
                    <span className="font-bold text-slate-800">{configEntCoef}</span>
                  </div>
                </div>
              )}

              {/* Evaluation Result Highlight Card (if evaluation test finished and energy value is parsed) */}
              {!running && energyAbsorbed !== null && (
                <div className="bg-emerald-50 border border-emerald-100/60 rounded-2xl p-5 mb-6 text-center animate-fade-in shadow-sm">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Evaluation Total Energy Absorbed</span>
                  <span className="text-3xl font-extrabold text-emerald-800 font-display block mb-1.5">
                    {energyAbsorbed.toFixed(3)} <span className="text-lg font-bold">MJ</span>
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold block">
                    Evaluation Duration: <span className="font-bold">{configSimTimeTest}s</span>
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
                      onClick={() => navigateTo('results', true)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-4 px-4 font-bold transition-colors shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2 cursor-pointer font-bold text-sm"
                    >
                      <LineChart className="w-5 h-5" /> View Results
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1)
                        setTrainProgress(0)
                        setTestProgress(0)
                        setPhase('training')
                        setLogs([])
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
                <Terminal className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Show Live Console Logs ({logs.length} lines)</span>
              </button>
            ) : (
              /* Expanded Console Panel */
              <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden flex flex-col shadow-xl border border-slate-800 min-h-[250px] transition-all duration-300">
                <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-300">
                    <Terminal className="w-5 h-5 text-indigo-400" />
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

                <div className="flex-1 p-6 overflow-y-auto font-mono text-sm text-slate-300 bg-slate-900 leading-relaxed selection:bg-indigo-500/30 max-h-[350px]">
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
        onSelectFile={(filePath) => setSelectedModelId(filePath)}
        title="Select Base Model Zip"
        themeColor="indigo"
      />
      </div>
    </div>
  )
}
