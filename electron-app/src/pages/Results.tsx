import { useState, useEffect } from 'react'
import { LineChart as LineChartIcon, FileText, ChevronRight, ChevronDown, Image as ImageIcon } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Papa from 'papaparse'

interface ResultFile {
  filename: string
  date: string
  mode: string
  plotUrl: string | null
}

export default function Results() {
  const [results, setResults] = useState<ResultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [viewMode, setViewMode] = useState<'chart' | 'plot'>('chart')

  useEffect(() => {
    window.api.getResults().then((data) => {
      setResults(data)
      setLoading(false)
    }).catch(console.error)
  }, [])

  const handleExpand = async (file: ResultFile) => {
    if (expandedFile === file.filename) {
      setExpandedFile(null)
      setCsvData([])
      return
    }

    setExpandedFile(file.filename)
    setViewMode('chart')
    
    // Only load CSV if plot is not available or user wants interactive
    if (!file.plotUrl) {
      loadCsvData(file.filename)
    } else {
      setViewMode('plot') // default to plot if it exists, it's faster
    }
  }

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

  return (
    <div className="p-10 max-w-7xl mx-auto flex flex-col gap-6 h-[calc(100vh-2rem)]">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-bold font-display text-slate-900 mb-3 tracking-tight">Results Analysis</h1>
          <p className="text-lg text-slate-500 font-medium">Interactive visualization of your testing and training logs.</p>
        </div>
      </div>

      <div className="flex gap-8 flex-1 min-h-0 pb-10">
        {/* Sidebar List */}
        <div className="w-[350px] flex flex-col glass-card rounded-3xl shadow-sm overflow-hidden flex-shrink-0">
          <div className="p-6 border-b border-slate-100/50 bg-white/50 flex items-center gap-4 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Result Files</h2>
              <p className="text-sm font-medium text-slate-500">{results.length} files available</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center font-medium text-slate-400 animate-pulse">Loading files...</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center font-medium text-slate-400">No results found.</div>
            ) : (
              <div className="space-y-2">
                {results.map((file) => {
                  const isActive = expandedFile === file.filename
                  return (
                    <button
                      key={file.filename}
                      onClick={() => handleExpand(file)}
                      className={`w-full text-left p-4 rounded-2xl flex items-start gap-4 transition-all duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-br from-purple-50 to-white text-purple-900 shadow-sm border border-purple-100' 
                          : 'hover:bg-slate-50/80 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="mt-1">
                        {isActive ? <ChevronDown className="w-4 h-4 text-purple-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate text-sm mb-1" title={file.filename}>
                          {file.filename}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${
                            file.mode === 'train' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {file.mode}
                          </span>
                          <span className="text-xs font-medium text-slate-400">
                            {new Date(file.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 glass-card rounded-3xl shadow-sm flex flex-col overflow-hidden">
          {!expandedFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white/40">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center mb-6 shadow-inner">
                <LineChartIcon className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-bold font-display text-slate-900 mb-2">No File Selected</h3>
              <p className="font-medium text-slate-500">Select a result file from the list to view its interactive data.</p>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100/50 flex items-center justify-between bg-white/60 backdrop-blur-md">
                <h3 className="text-xl font-bold font-display text-slate-900 truncate pr-4" title={expandedFile}>
                  {expandedFile}
                </h3>
                
                <div className="flex items-center gap-2 bg-slate-100/80 rounded-xl p-1 border border-slate-200/60 shadow-inner">
                  {results.find(r => r.filename === expandedFile)?.plotUrl && (
                    <button
                      onClick={() => setViewMode('plot')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${
                        viewMode === 'plot' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" /> PNG Plot
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setViewMode('chart')
                      if (csvData.length === 0) loadCsvData(expandedFile)
                    }}
                    className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${
                      viewMode === 'chart' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <LineChartIcon className="w-4 h-4" /> Interactive
                  </button>
                </div>
              </div>

              <div className="flex-1 p-8 overflow-y-auto bg-white/30 custom-scrollbar">
                {viewMode === 'plot' && (
                  <div className="flex justify-center items-center min-h-full">
                    <img 
                      src={results.find(r => r.filename === expandedFile)?.plotUrl || ''} 
                      alt="Matplotlib generated plot"
                      className="max-w-full rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/80 bg-white"
                    />
                  </div>
                )}

                {viewMode === 'chart' && (
                  <>
                    {loadingCsv ? (
                      <div className="flex-1 flex flex-col items-center justify-center h-full text-purple-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-b-purple-600 mb-4"></div>
                        <span className="font-bold">Parsing Data...</span>
                      </div>
                    ) : csvData.length > 0 ? (
                      <div className="space-y-8 pb-8">
                        {/* Position Chart */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
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
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
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
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
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
                      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 font-medium">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        Failed to parse CSV data or file is empty.
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
