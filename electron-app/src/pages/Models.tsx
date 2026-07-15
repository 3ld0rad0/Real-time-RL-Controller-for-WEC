import { useState, useEffect } from 'react'
import { Box, Play, Clock, Waves, BrainCircuit, Upload, X, UploadCloud, FileArchive, Check, AlertCircle, Loader2 } from 'lucide-react'
import Dropdown from '../components/Dropdown'
import FileBrowserModal from '../components/FileBrowserModal'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [fineTuningFilter, setFineTuningFilter] = useState('all')

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

  // Custom Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadFile, setUploadFile] = useState<{ name: string; path: string; size: number } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false)

  const handleFileSelectedFromBrowser = (filePath: string) => {
    const separator = filePath.includes('\\') ? '\\' : '/'
    const name = filePath.substring(filePath.lastIndexOf(separator) + 1)
    setUploadFile({
      name,
      path: filePath,
      size: 0
    })
    setUploadError(null)
  }

  const handleUploadModelClick = () => {
    setUploadFile(null)
    setUploadSuccess(false)
    setUploadError(null)
    setIsUploading(false)
    setShowUploadModal(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setUploadError('Only .zip files are supported.')
        return
      }
      setUploadError(null)
      setUploadFile({
        name: file.name,
        path: (file as any).path || '',
        size: file.size
      })
    }
  }


  const handleConfirmUpload = async () => {
    if (!uploadFile) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const result = await window.api.copyModelFile(uploadFile.path)
      if (result && result.success) {
        setUploadSuccess(true)
        setTimeout(() => {
          setShowUploadModal(false)
          loadModelsList()
        }, 1500)
      } else {
        setUploadError('Failed to copy the model file. Make sure the file exists and is valid.')
      }
    } catch (err) {
      console.error(err)
      setUploadError('An error occurred during file upload.')
    } finally {
      setIsUploading(false)
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
          onClick={handleUploadModelClick}
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
      ) : (() => {
        const filteredModels = models.filter((model) => {
          const isFineTuning = model.id.toLowerCase().includes('fine_tuning') || model.name.toLowerCase().includes('fine_tuning')
          
          const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase())
          
          const matchesFineTuning = fineTuningFilter === 'all' || 
            (fineTuningFilter === 'fine-tuned' && isFineTuning) || 
            (fineTuningFilter === 'regular' && !isFineTuning)

          return matchesSearch && matchesFineTuning
        })

        return (
          <div className="space-y-6 pb-20">
            {/* Filter controls panel */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm">
              {/* Text Search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by model name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium text-slate-800 placeholder-slate-400 font-sans"
                />
              </div>
              
              <div className="flex flex-wrap gap-3">
                {/* Fine Tuning Filter */}
                <Dropdown
                  value={fineTuningFilter}
                  onChange={(val) => setFineTuningFilter(val)}
                  options={[
                    { value: 'all', label: 'All Model Types' },
                    { value: 'fine-tuned', label: 'Fine-Tuning Models' },
                    { value: 'regular', label: 'Regular Models' }
                  ]}
                  themeColor="indigo"
                />
              </div>
            </div>

            {/* Model Grid */}
            {filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/40 animate-fade-in">
                <Box className="w-12 h-12 text-slate-300 mb-3 opacity-60" />
                <p className="font-bold text-slate-700 text-lg">No matching trained models found</p>
                <p className="text-sm text-slate-400 mt-1">Try modifying your filter settings or search query keywords.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredModels.map(model => {
                  const info = parseModelInfo(model);
                  const isFineTuning = model.id.toLowerCase().includes('fine_tuning') || model.name.toLowerCase().includes('fine_tuning');
                  return (
                    <div key={model.id} className="glass-card rounded-2xl overflow-hidden group flex flex-col justify-between p-6">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner ${
                            isFineTuning 
                              ? 'bg-amber-50 text-amber-600' 
                              : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            <BrainCircuit className="w-6 h-6" />
                          </div>
                          <div className="flex items-center gap-2">
                            {isFineTuning && (
                              <span className="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-1 rounded-md uppercase tracking-wider">
                                Fine-Tuning
                              </span>
                            )}
                            <button
                              onClick={() => onTestModel(model.id)}
                              className="p-2.5 bg-slate-900 hover:bg-indigo-650 text-white rounded-xl shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
                              title="Test this model"
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          </div>
                        </div>
                        
                        <h3 className="font-bold text-lg text-slate-900 mb-4 truncate pr-2" title={model.name}>
                          {model.name}
                        </h3>

                        {/* Environment & Simulation Configuration */}
                        <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/80 mb-3 text-xs">
                          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Configuration</h4>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold flex items-center gap-1.5">
                              <Waves className="w-3.5 h-3.5 text-slate-400" /> Sea State
                            </span>
                            <span className="font-bold text-slate-750 capitalize">{info.seaState}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold flex items-center gap-1.5">
                              <Waves className="w-3.5 h-3.5 text-slate-400" /> Wave Type
                            </span>
                            <span className="font-bold text-slate-750 capitalize">{info.waveType}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration
                            </span>
                            <span className="font-bold text-slate-750">{info.duration}</span>
                          </div>
                        </div>

                        {/* Model Hyperparameters & Specs */}
                        <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/80 text-xs">
                          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Agent Details</h4>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold flex items-center gap-1.5">
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

                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold flex items-center gap-1.5">
                              <BrainCircuit className="w-3.5 h-3.5 text-slate-400" /> Entropy Coef
                            </span>
                            <span className="font-bold text-slate-750">{model.ent_coef}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold">File Size</span>
                            <span className="font-bold text-slate-750">{formatSize(model.size)}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-550 font-semibold">Date Created</span>
                            <span className="font-bold text-slate-750">
                              {new Date(model.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 border border-slate-200/50 shadow-2xl relative">
            {/* Close Button */}
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold font-display text-slate-900 mb-1">Upload PPO Model</h3>
              <p className="text-sm text-slate-500 font-medium">Import a zip file containing the model parameters.</p>
            </div>

            {/* Success state */}
            {uploadSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 animate-scale-in">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Upload Completed!</h4>
                <p className="text-sm text-slate-500">The model has been imported into the catalog.</p>
              </div>
            ) : (
              <>
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => setIsFileBrowserOpen(true)}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer select-none text-center
                    ${isDragging 
                      ? 'border-indigo-500 bg-indigo-50/30' 
                      : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'}`}
                >
                  <UploadCloud className={`w-12 h-12 mb-3 transition-colors ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} />
                  <p className="text-sm font-semibold text-slate-700 mb-1">
                    Drag & drop your PPO model .zip here
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    or click to browse local files
                  </p>
                </div>

                {/* Selected File Details */}
                {uploadFile && (
                  <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileArchive className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{uploadFile.name}</p>
                        <p className="text-xs font-semibold text-slate-400">{formatSize(uploadFile.size)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {uploadError && (
                  <div className="mt-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={isUploading}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-550 hover:text-slate-750 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUpload}
                    disabled={!uploadFile || isUploading}
                    className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload Model'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <FileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        onSelectFile={handleFileSelectedFromBrowser}
        title="Select Model Zip Package"
        themeColor="indigo"
      />
    </div>
  )
}
