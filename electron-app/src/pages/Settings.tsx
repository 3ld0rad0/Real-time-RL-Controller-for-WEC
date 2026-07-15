import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Globe, Sliders, FolderOpen, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface SettingsProps {
  active: boolean
  runningSim: 'train' | 'test' | null
}

export default function Settings({ active, runningSim }: SettingsProps) {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const disabled = runningSim !== null

  // Form State
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('5000')
  const [dT, setDT] = useState('0.5')
  const [warmupTime, setWarmupTime] = useState('300')
  const [resultsDir, setResultsDir] = useState('./results')
  const [initCStar, setInitCStar] = useState('0.5')
  const [initGStar, setInitGStar] = useState('5.0')
  const [nEpisodes, setNEpisodes] = useState('4.0')
  const [entCoef, setEntCoef] = useState('0.01')
  const [batchSize, setBatchSize] = useState('1')
  const [simTimeTrain, setSimTimeTrain] = useState('0.1')

  useEffect(() => {
    if (active) {
      setLoading(true)
      window.api.getConfig()
        .then((data) => {
          setConfig(data)
          setHost(data.host || '127.0.0.1')
          setPort((data.port ?? 5000).toString())
          setDT((data.d_t ?? 0.5).toString())
          setWarmupTime((data.warmup_time ?? 300).toString())
          setResultsDir(data.results_dir || './results')
          setInitCStar((data.init_C_star ?? 0.5).toString())
          setInitGStar((data.init_G_star ?? 5.0).toString())
          setNEpisodes((data.n_episodes ?? 4.0).toString())
          setEntCoef((data.ent_coef ?? 0.01).toString())
          setBatchSize((data.batch_size ?? 1).toString())
          setSimTimeTrain((data.sim_time_train ?? 0.1).toString())
          setLoading(false)
        })
        .catch((err) => {
          console.error('Failed to load configuration:', err)
          setLoading(false)
        })
    }
  }, [active])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveStatus('idle')

    try {
      const updatedConfig = {
        ...config,
        host,
        port: parseInt(port, 10),
        d_t: parseFloat(dT),
        warmup_time: parseInt(warmupTime, 10),
        results_dir: resultsDir,
        init_C_star: parseFloat(initCStar),
        init_G_star: parseFloat(initGStar),
        n_episodes: parseFloat(nEpisodes),
        ent_coef: parseFloat(entCoef),
        batch_size: parseInt(batchSize, 10),
        sim_time_train: parseFloat(simTimeTrain)
      }

      await window.api.saveConfig(updatedConfig)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('Failed to save configuration:', err)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
        <p className="font-medium">Loading configuration parameters...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="p-10 h-full flex flex-col min-h-0 bg-slate-50/30">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">General Configuration</h2>
          <p className="text-slate-500 mt-1">Configure global connection, physical environment, and default model parameters</p>
        </div>
        
        {/* Save button and status in the header */}
        <div className="flex items-center gap-4 shrink-0">
          {saveStatus === 'success' && (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl px-4 py-2 flex items-center gap-2 animate-fade-in text-xs font-bold shadow-sm">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Saved!</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="bg-rose-50 border border-rose-250 text-rose-800 rounded-xl px-4 py-2 flex items-center gap-2 animate-fade-in text-xs font-bold shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Error saving</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={disabled || saving}
            className="bg-indigo-600 hover:bg-indigo-750 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white rounded-xl py-2.5 px-5 font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 group cursor-pointer disabled:cursor-not-allowed border border-indigo-700/10 shrink-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform" /> Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {disabled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-sm animate-fade-in shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Settings Locked</h4>
            <p className="text-xs text-amber-600 mt-1">A simulation is currently running in the background. Global settings cannot be modified until the active simulation completes or is stopped.</p>
          </div>
        </div>
      )}

      <div className="flex gap-8 flex-1 min-h-0 overflow-hidden pb-6">
        {/* Left Column: Info */}
        <div className="w-[360px] flex flex-col gap-6 shrink-0">
          <div className="glass-card rounded-3xl p-6 border border-slate-150 bg-white shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-indigo-500" />
              WEC Settings
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-4 font-semibold">
              These values act as global defaults for the WEC simulation server and clients. Values configured here are persisted inside the project's config file.
            </p>
            <div className="text-xs font-bold text-amber-700 bg-amber-50/80 border border-amber-100 rounded-xl p-3 leading-relaxed">
              <strong>Note:</strong> Starting specific simulations from the Train or Test tabs will temporarily override parameters like sea state, batch size, and model paths.
            </div>
          </div>
        </div>

        {/* Right Column: Settings Sections */}
        <div className="flex-1 overflow-y-auto pr-4 space-y-6 custom-scrollbar h-full pb-4">
          
          {/* Section 1: Network */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm">
            <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              Network & Socket Server
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Host Address (IP)</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Socket Port</label>
                <input
                  type="number"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Environment */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm">
            <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              WEC Physics Environment
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Control Time Step (d_t)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={dT}
                  onChange={(e) => setDT(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Warmup Time (seconds)</label>
                <input
                  type="number"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={warmupTime}
                  onChange={(e) => setWarmupTime(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-slate-450" /> Results Directory Path
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={resultsDir}
                  onChange={(e) => setResultsDir(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Model */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm">
            <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              Default RL Model Hyperparameters
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Initial Latching Threshold (init_C_star)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={initCStar}
                  onChange={(e) => setInitCStar(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Initial Declutching Threshold (init_G_star)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={initGStar}
                  onChange={(e) => setInitGStar(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Default Episodes (n_episodes)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={nEpisodes}
                  onChange={(e) => setNEpisodes(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Default Training Duration (sim_time_train in hours)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={simTimeTrain}
                  onChange={(e) => setSimTimeTrain(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entropy Coefficient</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={entCoef}
                  onChange={(e) => setEntCoef(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Default Batch Run Count</label>
                <input
                  type="number"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-sm hover:border-slate-300 disabled:cursor-not-allowed"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  disabled={disabled || saving}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </form>
  )
}
