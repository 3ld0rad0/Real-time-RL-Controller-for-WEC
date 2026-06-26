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
    <div className="p-8 max-w-6xl mx-auto flex gap-6 h-[calc(100vh-4rem)]">
      
      {/* Sidebar List */}
      <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <FileText className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-slate-900">Result Files</h2>
          <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">
            {results.length}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-slate-500 animate-pulse">Loading files...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-slate-500">No results found.</div>
          ) : (
            <div className="space-y-1">
              {results.map((file) => {
                const isActive = expandedFile === file.filename
                return (
                  <button
                    key={file.filename}
                    onClick={() => handleExpand(file)}
                    className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                      isActive ? 'bg-purple-50 text-purple-900 ring-1 ring-purple-200' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isActive ? <ChevronDown className="w-4 h-4 text-purple-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm" title={file.filename}>
                        {file.filename}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          file.mode === 'train' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {file.mode}
                        </span>
                        <span className="text-xs text-slate-500">
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
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {!expandedFile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <LineChartIcon className="w-16 h-16 mb-4 text-slate-200" />
            <h3 className="text-xl font-medium text-slate-900 mb-2">No File Selected</h3>
            <p>Select a result file from the list to view its data and generated plots.</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-900 truncate pr-4" title={expandedFile}>
                {expandedFile}
              </h3>
              
              <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                {results.find(r => r.filename === expandedFile)?.plotUrl && (
                  <button
                    onClick={() => setViewMode('plot')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
                      viewMode === 'plot' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
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
                  className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
                    viewMode === 'chart' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <LineChartIcon className="w-4 h-4" /> Interactive Chart
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {viewMode === 'plot' && (
                <div className="flex justify-center items-center min-h-full">
                  <img 
                    src={results.find(r => r.filename === expandedFile)?.plotUrl || ''} 
                    alt="Matplotlib generated plot"
                    className="max-w-full rounded-lg shadow-sm border border-slate-200"
                  />
                </div>
              )}

              {viewMode === 'chart' && (
                <>
                  {loadingCsv ? (
                    <div className="flex-1 flex items-center justify-center h-full text-slate-500 animate-pulse">
                      Parsing CSV Data...
                    </div>
                  ) : csvData.length > 0 ? (
                    <div className="space-y-8">
                      {/* Position Chart */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Position</h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={csvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="time" tick={{fontSize: 12}} stroke="#94a3b8" />
                              <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Legend wrapperStyle={{ fontSize: '12px' }} />
                              <Line type="monotone" dataKey="position" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Velocity Chart */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Velocity</h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={csvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="time" tick={{fontSize: 12}} stroke="#94a3b8" />
                              <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Legend wrapperStyle={{ fontSize: '12px' }} />
                              <Line type="monotone" dataKey="velocity" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Power Chart */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Instantaneous Power</h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={csvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="time" tick={{fontSize: 12}} stroke="#94a3b8" />
                              <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Legend wrapperStyle={{ fontSize: '12px' }} />
                              <Line type="monotone" dataKey="power_inst" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center h-full text-slate-500">
                      Failed to parse CSV data.
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

