import { useState, useEffect } from 'react'
import { 
  LineChart as LineChartIcon, 
  FileText, 
  ChevronRight, 
  Image as ImageIcon, 
  Calendar, 
  Loader2, 
  ChevronLeft, 
  Download,
  Check
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Papa from 'papaparse'

interface ResultFile {
  id: string
  displayName: string
  date: string
  mode: string
  plotUrl: string | null
  files: {
    main?: string
    energy?: string
    reward?: string
  }
}

interface ResultsProps {
  active?: boolean
  autoExpandLatest?: boolean
  onClearAutoExpand?: () => void
}

function DownloadButton({ label, filename }: { label: string, filename: string }) {
  const [downloading, setDownloading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const result = await window.api.downloadResultFile(filename)
      if (result) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
        success
          ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
      }`}
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : success ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  )
}

export default function Results({ active, autoExpandLatest, onClearAutoExpand }: ResultsProps) {
  const [results, setResults] = useState<ResultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFile, setExpandedFile] = useState<ResultFile | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [viewMode, setViewMode] = useState<'chart' | 'plot'>('chart')

  const loadCsvData = async (filename: string) => {
    setLoadingCsv(true)
    try {
      const csvString = await window.api.readCSV(filename)
      Papa.parse(csvString, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Downsample for performance if needed (e.g. max 1000 points)
          let data = results.data as any[]
          if (data.length > 1000) {
            const step = Math.ceil(data.length / 1000)
            data = data.filter((_, i) => i % step === 0)
          }
          setCsvData(data)
          setLoadingCsv(false)
        }
      })
    } catch (e) {
      console.error(e)
      setLoadingCsv(false)
    }
  }

  const handleExpand = async (file: ResultFile) => {
    setExpandedFile(file)
    setViewMode('chart')
    
    // Only load CSV if plot is not available or user wants interactive
    if (file.files.main) {
      if (!file.plotUrl) {
        loadCsvData(file.files.main)
      } else {
        setViewMode('plot') // default to plot if it exists, it's faster
      }
    }
  }

  const handleBack = () => {
    setExpandedFile(null)
    setCsvData([])
  }

  useEffect(() => {
    if (active) {
      setLoading(true)
      window.api.getResults().then((data) => {
        setResults(data)
        setLoading(false)
        
        if (autoExpandLatest && data.length > 0) {
          handleExpand(data[0])
          onClearAutoExpand?.()
        } else {
          setExpandedFile(null)
          setCsvData([])
        }
      }).catch((err) => {
        console.error(err)
        setLoading(false)
      })
    }
  }, [active, autoExpandLatest])

  const renderRunCard = (file: ResultFile) => {
    return (
      <button
        key={file.id}
        onClick={() => handleExpand(file)}
        className="w-full text-left bg-white border border-slate-200/60 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-300 flex items-center justify-between group cursor-pointer"
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-bold text-slate-800 truncate text-sm mb-1.5 group-hover:text-indigo-600 transition-colors" title={file.displayName}>
            {file.displayName}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              file.mode === 'train' ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
            }`}>
              {file.mode === 'train' ? 'TRAINING' : 'TESTING'}
            </span>
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(file.date).toLocaleDateString()} {new Date(file.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
      </button>
    )
  }

  if (!expandedFile) {
    // List View Grouped by Mode
    return (
      <div className="p-10 max-w-7xl mx-auto flex flex-col gap-6 h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-end shrink-0 mb-4 animate-fade-in">
          <div>
            <h1 className="text-4xl font-extrabold font-display text-slate-900 mb-3 tracking-tight">Results Analysis</h1>
            <p className="text-lg text-slate-500 font-medium">Browse and analyze data from previous training and testing sessions.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
            <p className="font-semibold text-lg">Loading catalog index...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[400px] border-2 border-dashed border-slate-200 rounded-3xl p-8 bg-white/40 animate-fade-in">
            <FileText className="w-16 h-16 text-slate-300 mb-4 opacity-50" />
            <p className="font-bold text-lg text-slate-700">No simulation logs found</p>
            <p className="text-sm text-slate-400 mt-1">Run a training or test simulation to generate visualization plots.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4 mb-10 animate-fade-in w-full">
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-3xl p-6 shadow-md shadow-slate-900/10 mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold font-display flex items-center gap-3">
                  <FileText className="w-6 h-6 text-slate-200" />
                  Simulation Runs History
                </h2>
                <p className="text-xs text-slate-300 mt-1 font-medium font-sans">Showing all training and testing results logs in chronological order</p>
              </div>
              <span className="text-sm font-bold bg-white/10 px-3.5 py-1.5 rounded-full border border-white/15">
                {results.length} Runs Total
              </span>
            </div>

            <div className="space-y-3">
              {results.map((file) => renderRunCard(file))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full Screen Details View
  return (
    <div className="p-10 max-w-7xl mx-auto flex flex-col gap-6 h-[calc(100vh-2rem)] animate-fade-in">
      {/* Detail header with back button */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={handleBack}
            className="p-3 bg-white border border-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            title="Back to results list"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                expandedFile.mode === 'train' ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
              }`}>
                {expandedFile.mode === 'train' ? 'TRAINING' : 'TESTING'}
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(expandedFile.date).toLocaleString()}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-display text-slate-900 truncate max-w-xl pr-4" title={expandedFile.displayName}>
              {expandedFile.displayName}
            </h1>
          </div>
        </div>

        {/* Download CSV Files Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {expandedFile.files.main && (
            <DownloadButton 
              label="Time-Series CSV" 
              filename={expandedFile.files.main} 
            />
          )}
          {expandedFile.files.energy && (
            <DownloadButton 
              label="Energy CSV" 
              filename={expandedFile.files.energy} 
            />
          )}
          {expandedFile.files.reward && (
            <DownloadButton 
              label="Reward CSV" 
              filename={expandedFile.files.reward} 
            />
          )}
        </div>
      </div>

      {/* Main Graph Content Area */}
      <div className="flex-1 glass-card rounded-3xl shadow-sm flex flex-col overflow-hidden bg-white/40">
        <div className="p-6 border-b border-slate-100/50 flex items-center justify-between bg-white/60 backdrop-blur-md shrink-0">
          <h3 className="text-lg font-bold font-display text-slate-800">Visualization</h3>
          
          <div className="flex items-center gap-2 bg-slate-100/80 rounded-xl p-1 border border-slate-200/60 shadow-inner">
            {expandedFile.plotUrl && (
              <button
                onClick={() => setViewMode('plot')}
                className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                  viewMode === 'plot' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ImageIcon className="w-4 h-4" /> PNG Plot
              </button>
            )}
            <button
              onClick={() => {
                setViewMode('chart')
                if (csvData.length === 0 && expandedFile.files.main) {
                  loadCsvData(expandedFile.files.main)
                }
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'chart' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LineChartIcon className="w-4 h-4" /> Interactive
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto bg-white/30 custom-scrollbar">
          {viewMode === 'plot' && expandedFile.plotUrl && (
            <div className="flex justify-center items-center min-h-full">
              <img 
                src={expandedFile.plotUrl} 
                alt="Matplotlib generated plot"
                className="max-w-full rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/80 bg-white"
              />
            </div>
          )}

          {viewMode === 'chart' && (
            <>
              {loadingCsv ? (
                <div className="flex h-[350px] flex-col items-center justify-center text-purple-500">
                  <Loader2 className="animate-spin h-10 w-10 text-purple-650 mb-3" />
                  <span className="font-bold">Parsing Data Points...</span>
                </div>
              ) : csvData.length > 0 ? (
                <div className="space-y-8 pb-8 animate-fade-in">
                  {/* Position Chart */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Position
                    </h4>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={csvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="time" tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                          <YAxis tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dx={-10} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '20px' }} />
                          <Line type="monotone" dataKey="position" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Velocity Chart */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Velocity
                    </h4>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={csvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="time" tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                          <YAxis tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dx={-10} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '20px' }} />
                          <Line type="monotone" dataKey="velocity" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Power Chart */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span> Instantaneous Power
                    </h4>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={csvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="time" tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                          <YAxis tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dx={-10} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '20px' }} />
                          <Line type="monotone" dataKey="power_inst" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[300px] flex-col items-center justify-center text-slate-400 font-medium">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  Failed to parse CSV data or file is empty.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
