import { useState, useEffect } from 'react'
import { Box, Play, ChevronDown, ChevronUp, Clock, HardDrive, Waves, Thermometer, BrainCircuit } from 'lucide-react'

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
}

export default function Models({ onTestModel }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    window.api.getModels().then((data) => {
      setModels(data)
      setLoading(false)
    }).catch(console.error)
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="p-10 max-w-6xl mx-auto h-full overflow-y-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-bold font-display text-slate-900 mb-3 tracking-tight">Trained Models</h1>
        <p className="text-lg text-slate-500 font-medium">Browse your reinforcement learning agents and their configurations.</p>
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
          {models.map(model => (
            <div key={model.id} className="glass-card rounded-2xl overflow-hidden group">
              <div 
                className="p-6 cursor-pointer"
                onClick={() => setExpandedId(expandedId === model.id ? null : model.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onTestModel(model.id) }}
                    className="p-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl shadow-lg transition-colors flex items-center gap-2"
                    title="Test this model"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
                
                <h3 className="font-bold text-lg text-slate-900 mb-1 truncate pr-2" title={model.name}>
                  {model.name}
                </h3>
                
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-4">
                  <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" /> {formatSize(model.size)}
                  </span>
                  <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {new Date(model.date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Expandable Details Area */}
              <div className={`border-t border-slate-100 bg-slate-50/50 transition-all duration-300 overflow-hidden ${expandedId === model.id ? 'max-h-64' : 'max-h-0'}`}>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Waves className="w-3 h-3" /> Wave Type
                      </p>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{model.wave_type}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Thermometer className="w-3 h-3" /> Sea State
                      </p>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{model.sea_state.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3" /> Entropy Coef
                      </p>
                      <p className="text-sm font-semibold text-slate-800">{model.ent_coef}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Toggle handle */}
              <div 
                className="py-2 bg-slate-50 flex justify-center items-center text-slate-400 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                onClick={() => setExpandedId(expandedId === model.id ? null : model.id)}
              >
                {expandedId === model.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
