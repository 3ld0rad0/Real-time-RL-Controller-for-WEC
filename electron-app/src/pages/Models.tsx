import { useState, useEffect } from 'react'
import { Box, ChevronDown, ChevronRight, PlaySquare } from 'lucide-react'

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

export default function Models({ onTestModel }: { onTestModel: (id: string) => void }) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    window.api.getModels().then((data) => {
      setModels(data)
      setLoading(false)
    }).catch(console.error)
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-pulse flex items-center gap-2 text-slate-500">
          <Box className="w-5 h-5" />
          <span>Loading models...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Box className="w-8 h-8 text-amber-600" />
            Trained Models
          </h1>
          <p className="text-slate-600 mt-2">Manage and test your trained PPO agents.</p>
        </div>
        <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-lg font-medium">
          Total: {models.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => {
          const isExpanded = expandedId === model.id
          return (
            <div 
              key={model.id}
              className={`border border-slate-200 rounded-xl bg-white overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-amber-500 shadow-md' : 'hover:border-slate-300 hover:shadow-sm'}`}
            >
              <div 
                className="p-4 flex items-start gap-3 cursor-pointer select-none"
                onClick={() => setExpandedId(isExpanded ? null : model.id)}
              >
                <div className="mt-1 text-slate-400">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                      {model.wave_type}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      Sea State: {model.sea_state}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-900 break-all leading-tight">
                    {model.name}
                  </h3>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50 text-sm">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                    <div>
                      <span className="block text-slate-500 text-xs uppercase tracking-wider mb-0.5">Entropy Coef</span>
                      <span className="font-medium text-slate-900">{model.ent_coef}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs uppercase tracking-wider mb-0.5">Size</span>
                      <span className="font-medium text-slate-900">{(model.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-slate-500 text-xs uppercase tracking-wider mb-0.5">Last Modified</span>
                      <span className="font-medium text-slate-900">{new Date(model.date).toLocaleString()}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-slate-500 text-xs uppercase tracking-wider mb-0.5">Path</span>
                      <span className="font-mono text-xs text-slate-600 break-all">{model.path}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTestModel(model.id)
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <PlaySquare className="w-4 h-4" />
                    Use for Testing
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {models.length === 0 && !loading && (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No models found in the models directory.</p>
          </div>
        )}
      </div>
    </div>
  )
}

