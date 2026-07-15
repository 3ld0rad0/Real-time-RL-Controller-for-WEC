import { useState, useEffect } from 'react'
import { Box, Play, ChevronDown, ChevronUp, Clock, Waves, BrainCircuit, Upload } from 'lucide-react'

interface Model {
  id: string
  name: string
  path: string
  size: number
  date: string
  wave_type: string
  sea_state: string
  ent_coef: string
}

interface ModelsProps {
  onTestModel: (id: string) => void
  active?: boolean
}

function parseModelInfo(model: Model) {
  const pathString = model.id;
  
  let seaState = 'Unknown Sea State';
  let waveType = 'Irregular';
  let controlMode = 'Latching';
  let controlType = 'RL';
  let duration = 'Unknown';

  const durationMatch = pathString.match(/_(\d+(?:\.\d+)?[sh])_/);
  if (durationMatch) {
    duration = durationMatch[1];
  }

  const seaStateMatch = pathString.match(/sea_state_(\d+\.\d+)_(\d+\.\d+)/);
  if (seaStateMatch) {
    seaState = `Hs: ${seaStateMatch[1]}m, Tp: ${seaStateMatch[2]}s`;
  } else if (model.sea_state && model.sea_state !== 'unknown') {
    seaState = model.sea_state.replace(/_/g, ' ');
  }

  if (pathString.includes('regular')) {
    waveType = 'Regular';
  } else if (pathString.includes('mixed')) {
    waveType = 'Mixed';
  } else if (model.wave_type && model.wave_type !== 'unknown') {
    waveType = model.wave_type;
  }

  if (pathString.includes('reactive') || pathString.includes('linear')) {
    controlMode = 'Reactive';
  }
  
  if (pathString.includes('baseline')) {
    controlType = 'Baseline';
  } else if (pathString.includes('rl')) {
    controlType = 'RL';
  }

  return {
    control: `${controlType} (${controlMode})`,
    duration,
    seaState,
    waveType
  };
}

export default function Models({ onTestModel, active }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadModelsList = () => {
    setLoading(true)
    window.api.getModels().then((data) => {
      setModels(data)
      setLoading(false)
    }).catch((err) => {
      console.error(err)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (active) {
      loadModelsList()
    }
  }, [active])

  const handleUploadModel = async () => {
    try {
      const result = await window.api.uploadModel()
      if (result && result.success) {
        loadModelsList()
      }
    } catch (err) {
      console.error('Failed to upload model:', err)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="p-10 max-w-6xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold font-display text-slate-900 mb-3 tracking-tight">Trained Models</h1>
          <p className="text-lg text-slate-500 font-medium">Browse your reinforcement learning agents and their configurations.</p>
        </div>
        <button
          onClick={handleUploadModel}
          className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer text-sm shrink-0 border border-indigo-700/10"
        >
          <Upload className="w-4 h-4" /> Upload Model
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-indigo-500">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-b-indigo-600 mb-4"></div>
          <p className="font-semibold text-indigo-900">Loading models...</p>
        </div>
      ) : models.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-24 rounded-3xl text-slate-400">
          <Box className="w-20 h-20 mb-6 text-slate-200" />
          <p className="text-xl font-medium text-slate-900 mb-2">No Models Found</p>
          <p>Run a training simulation to generate models.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
          {models.map(model => {
            const info = parseModelInfo(model);
            return (
              <div key={model.id} className="glass-card rounded-2xl overflow-hidden group flex flex-col justify-between">
                <div 
                  className="p-6 cursor-pointer flex-1 flex flex-col justify-between"
                  onClick={() => setExpandedId(expandedId === model.id ? null : model.id)}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                        <BrainCircuit className="w-6 h-6" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTestModel(model.id) }}
                        className="p-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
                        title="Test this model"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900 mb-4 truncate pr-2" title={model.name}>
                      {model.name}
                    </h3>

                    {/* Main Identifiers Section */}
                    <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/80">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <Waves className="w-3.5 h-3.5 text-slate-400" /> Sea State
                        </span>
                        <span className="font-semibold text-slate-700 capitalize">{info.seaState}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration
                        </span>
                        <span className="font-semibold text-slate-700">{info.duration}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <BrainCircuit className="w-3.5 h-3.5 text-slate-400" /> Control Mode
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                          info.control.includes('RL') 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-150/40' 
                            : 'bg-slate-100 text-slate-750 border border-slate-200'
                        }`}>
                          {info.control}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable Details Area */}
                <div className={`border-t border-slate-100 bg-slate-50/50 transition-all duration-300 overflow-hidden ${expandedId === model.id ? 'max-h-[320px]' : 'max-h-0'}`}>
                  <div className="p-6 space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Wave Type
                        </p>
                        <p className="text-sm font-semibold text-slate-800 capitalize">{info.waveType}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          File Size
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{formatSize(model.size)}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Creation Date
                        </p>
                        <p className="text-sm font-semibold text-slate-800">
                          {new Date(model.date).toLocaleDateString()} {new Date(model.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Entropy Coef
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{model.ent_coef}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">
                          Relative Path ID
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 break-all select-all font-mono mt-0.5">
                          {model.id}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Toggle handle */}
                <div 
                  className="py-2.5 bg-slate-50/80 flex justify-center items-center text-slate-400 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-t border-slate-100"
                  onClick={() => setExpandedId(expandedId === model.id ? null : model.id)}
                >
                  {expandedId === model.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
