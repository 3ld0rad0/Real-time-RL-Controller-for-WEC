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
  Check,
  Clock,
  TrendingUp
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Papa from 'papaparse'
import Dropdown from '../components/Dropdown'

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
  selectedRunId?: string | null
}

function parseRunName(displayName: string) {
  let seaState = 'Unknown Sea State';
  let waveType = 'Irregular';
  let controlMode = 'Latching';
  let controlType = 'RL';
  let duration = '';

  const durationMatch = displayName.match(/_(\d+(?:\.\d+)?[sh])_/);
  if (durationMatch) {
    duration = durationMatch[1];
  }

  const seaStateMatch = displayName.match(/_(\d+\.\d+)_(\d+\.\d+)_/);
  if (seaStateMatch) {
    seaState = `Hs: ${seaStateMatch[1]}m, Tp: ${seaStateMatch[2]}s`;
  } else if (displayName.includes('mixed')) {
    seaState = 'Mixed Sea State';
  }

  if (displayName.includes('regular')) {
    waveType = 'Regular';
  } else if (displayName.includes('mixed')) {
    waveType = 'Mixed';
  }

  if (displayName.includes('reactive') || displayName.includes('linear')) {
    controlMode = 'Reactive';
  }

  if (displayName.includes('baseline')) {
    controlType = 'Baseline';
    if (controlMode === 'Latching') {
      controlMode = 'Threshold';
    }
  } else if (displayName.includes('rl')) {
    controlType = 'RL';
  }

  return {
    control: `${controlType} (${controlMode})`,
    wave: `${waveType} Waves`,
    seaState,
    duration: duration ? `Duration: ${duration}` : ''
  };
}

function ResultRunCard({ file, onClick }: { file: ResultFile; onClick: () => void }) {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<{ energyAbs?: string; eta?: string } | null>(null)

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        let energyAbsStr = undefined;
        let etaStr = undefined;
        
        if (file.files.energy) {
          const energyCsv = await window.api.readCSV(file.files.energy);
          const lines = energyCsv.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const headers = lines[0].split(',');
            const values = lines[1].split(',');
            const energyAbsIdx = headers.indexOf('energy_abs');
            const etaIdx = headers.indexOf('eta');
            
            if (energyAbsIdx !== -1 && values[energyAbsIdx]) {
              const energyVal = parseFloat(values[energyAbsIdx]);
              if (!isNaN(energyVal)) {
                if (energyVal >= 1e6) {
                  energyAbsStr = `${(energyVal / 1e6).toFixed(2)} MJ`;
                } else {
                  energyAbsStr = `${(energyVal / 1e3).toFixed(1)} kJ`;
                }
              }
            }
            if (etaIdx !== -1 && values[etaIdx]) {
              const etaVal = parseFloat(values[etaIdx]);
              if (!isNaN(etaVal)) {
                etaStr = etaVal.toFixed(2);
              }
            }
          }
        }
        
        if (active) {
          setMetrics({ energyAbs: energyAbsStr, eta: etaStr });
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading run details for Results card", err);
        if (active) setLoading(false);
      }
    }
    
    loadData();
    return () => {
      active = false;
    };
  }, [file]);

  const info = parseRunName(file.displayName);
  const formattedDate = new Date(file.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
                        new Date(file.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="glass-card w-full text-left p-4.5 rounded-2xl border border-slate-200/60 bg-white hover:border-indigo-400 hover:shadow-lg transition-all duration-300 flex flex-col gap-3 cursor-pointer group relative overflow-hidden"
    >
      {/* Top badges/row */}
      <div className="flex items-center justify-between w-full">
        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
          file.mode === 'train' ? 'bg-indigo-50 text-indigo-755 border border-indigo-150' : 'bg-emerald-50 text-emerald-755 border border-emerald-150'
        }`}>
          {file.mode === 'train' ? 'TRAINING' : 'TESTING'}
        </span>
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {formattedDate}
        </span>
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-800 text-base truncate mb-1 group-hover:text-indigo-655 transition-colors" title={file.displayName}>
          {info.control}
        </h3>
        <p className="text-sm text-slate-500 font-medium mb-1">
          {info.wave} • {info.seaState}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {info.duration && (
            <span className="text-[10px] bg-slate-100/80 border border-slate-200/60 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              {info.duration}
            </span>
          )}
          {file.plotUrl && (
            <span className="text-[10px] bg-purple-50 border border-purple-100 text-purple-650 font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Static Plot
            </span>
          )}
          {file.files.main && (
            <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-650 font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <LineChartIcon className="w-3 h-3" /> Interactive Chart
            </span>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      {loading ? (
        <div className="h-[50px] w-full flex items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-100 animate-pulse">
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
        </div>
      ) : (
        (metrics?.energyAbs || metrics?.eta) && (
          <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-150/60">
            {metrics.energyAbs && (
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Absorbed Energy</div>
                <div className="text-sm font-bold text-slate-800">{metrics.energyAbs}</div>
              </div>
            )}
            {metrics.eta && (
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Capture Width Ratio</div>
                <div className="text-sm font-bold text-emerald-655 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {metrics.eta} m
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Absolute hover chevron */}
      <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
        <ChevronRight className="w-5 h-5 text-indigo-500" />
      </div>
    </button>
  );
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

export default function Results({ 
  active, 
  autoExpandLatest, 
  onClearAutoExpand, 
  selectedRunId
}: ResultsProps) {
  const [results, setResults] = useState<ResultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFile, setExpandedFile] = useState<ResultFile | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [viewMode, setViewMode] = useState<'chart' | 'plot'>('chart')
  const [timeWindow, setTimeWindow] = useState<'all' | 60 | 180 | 900>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [modeFilter, setModeFilter] = useState('all')
  const [seaStateFilter, setSeaStateFilter] = useState('all')
  const [controlFilter, setControlFilter] = useState('all')

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
    setTimeWindow('all')
    
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
    setTimeWindow('all')
  }

  useEffect(() => {
    if (active) {
      setLoading(true)
      window.api.getResults().then((data) => {
        setResults(data)
        setLoading(false)
        
        if (selectedRunId) {
          const run = data.find((r) => r.id === selectedRunId)
          if (run) {
            handleExpand(run)
          } else if (data.length > 0) {
            handleExpand(data[0])
          }
        } else if (autoExpandLatest && data.length > 0) {
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
  }, [active, autoExpandLatest, selectedRunId, onClearAutoExpand])

  if (!expandedFile) {
    const filteredResults = results.filter((run) => {
      const parsed = parseRunName(run.displayName)
      const matchesSearch = run.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      
      // 1) Train/Test Filter
      const matchesMode = modeFilter === 'all' || 
        (modeFilter === 'train' && run.mode === 'train') ||
        (modeFilter === 'test' && (run.mode === 'test' || run.mode === 'final'))
        
      // 2) Sea State Filter
      const matchesSeaState = seaStateFilter === 'all' || parsed.seaState.includes(seaStateFilter)
      
      // 3) Control Method Filter
      const matchesControl = controlFilter === 'all' || parsed.control === controlFilter
      
      return matchesSearch && matchesMode && matchesSeaState && matchesControl
    })

    // List View Grouped by Mode
    return (
      <div className="p-10 w-full flex flex-col gap-6 h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
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
          <div className="w-full space-y-6 mb-10 animate-fade-in">
            {/* Header statistics summary */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-3xl p-6 shadow-md shadow-slate-900/10 flex justify-between items-center">
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

            {/* Filter controls panel */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm">
              {/* Text Search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by run name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium text-slate-800 placeholder-slate-400 font-sans"
                />
              </div>
              
              <div className="flex flex-wrap gap-3">
                {/* 1) Train/Test Filter */}
                <Dropdown
                  value={modeFilter}
                  onChange={(val) => setModeFilter(val)}
                  options={[
                    { value: 'all', label: 'All Modes' },
                    { value: 'train', label: 'Training' },
                    { value: 'test', label: 'Testing' }
                  ]}
                  themeColor="indigo"
                />

                {/* 2) Sea State Filter */}
                <Dropdown
                  value={seaStateFilter}
                  onChange={(val) => setSeaStateFilter(val)}
                  options={[
                    { value: 'all', label: 'All Sea States' },
                    { value: 'Hs: 0.8m', label: 'Hs=0.8m, Tp=9.0s' },
                    { value: 'Hs: 1.4m', label: 'Hs=1.4m, Tp=9.7s' },
                    { value: 'Hs: 2.0m', label: 'Hs=2.0m, Tp=10.5s' },
                    { value: 'Hs: 2.9m', label: 'Hs=2.9m, Tp=11.5s' },
                    { value: 'Hs: 4.0m', label: 'Hs=4.0m, Tp=12.7s' },
                    { value: 'Hs: 5.4m', label: 'Hs=5.4m, Tp=14.0s' },
                    { value: 'Hs: 7.0m', label: 'Hs=7.0m, Tp=15.5s' },
                    { value: 'Hs: 8.8m', label: 'Hs=8.8m, Tp=17.2s' },
                    { value: 'Mixed Sea State', label: 'Mixed Sea State' }
                  ]}
                  themeColor="indigo"
                />

                {/* 3) Control Method Filter */}
                <Dropdown
                  value={controlFilter}
                  onChange={(val) => setControlFilter(val)}
                  options={[
                    { value: 'all', label: 'All Control Methods' },
                    { value: 'RL (Latching)', label: 'RL (Latching)' },
                    { value: 'Baseline (Threshold)', label: 'Baseline (Threshold)' }
                  ]}
                  themeColor="indigo"
                />
              </div>
            </div>

            {/* Catalog Grid */}
            {filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/40 animate-fade-in">
                <FileText className="w-12 h-12 text-slate-300 mb-3 opacity-60" />
                <p className="font-bold text-slate-700 text-lg">No matching simulation logs found</p>
                <p className="text-sm text-slate-400 mt-1">Try modifying your filter settings or search query keywords.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResults.map((file) => (
                  <ResultRunCard 
                    key={file.id} 
                    file={file} 
                    onClick={() => handleExpand(file)} 
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Full Screen Details View
  return (
    <div className="p-10 w-full flex flex-col gap-6 h-[calc(100vh-2rem)] animate-fade-in">
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
          )}          {viewMode === 'chart' && (() => {
            const getFilteredCsvData = () => {
              if (timeWindow === 'all' || csvData.length === 0) return csvData;
              const latestTime = csvData[csvData.length - 1].time;
              const startTime = latestTime - timeWindow;
              return csvData.filter((d) => d.time >= startTime);
            }
            const filteredData = getFilteredCsvData();

            return (
              <>
                {loadingCsv ? (
                  <div className="flex h-[350px] flex-col items-center justify-center text-purple-505">
                    <Loader2 className="animate-spin h-10 w-10 text-purple-650 mb-3" />
                    <span className="font-bold">Parsing Data Points...</span>
                  </div>
                ) : filteredData.length > 0 ? (
                  <div className="space-y-8 pb-8 animate-fade-in">
                    
                    {/* Time Window Display Toggles */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-150 shadow-[0_4px_24px_rgba(0,0,0,0.015)]">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        Time Window Display
                      </span>
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/65">
                        {[
                          { id: 'all', label: 'Full Sim' },
                          { id: 900, label: 'Last 15m' },
                          { id: 180, label: 'Last 3m' },
                          { id: 60, label: 'Last 60s' }
                        ].map((win) => (
                          <button
                            key={win.id}
                            onClick={() => setTimeWindow(win.id as any)}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              timeWindow === win.id 
                                ? 'bg-white text-indigo-650 shadow-sm border border-slate-200/40 font-extrabold' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {win.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Position Chart */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                      <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Position
                      </h4>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredData} margin={{ top: 10, right: 20, left: 20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                              axisLine={false} 
                              tickLine={false} 
                              dy={8} 
                              label={{ value: 'Time (s)', position: 'insideBottom', offset: -10, style: { fontSize: '11px', fill: '#64748b', fontWeight: 600 } }}
                            />
                            <YAxis 
                              tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                              axisLine={false} 
                              tickLine={false} 
                              dx={-5} 
                              label={{ value: 'Position (m)', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: '11px', fill: '#64748b', fontWeight: 600, textAnchor: 'middle' } }}
                            />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '15px' }} />
                            <Line type="monotone" dataKey="position" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
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
                          <LineChart data={filteredData} margin={{ top: 10, right: 20, left: 20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                              axisLine={false} 
                              tickLine={false} 
                              dy={8} 
                              label={{ value: 'Time (s)', position: 'insideBottom', offset: -10, style: { fontSize: '11px', fill: '#64748b', fontWeight: 600 } }}
                            />
                            <YAxis 
                              tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                              axisLine={false} 
                              tickLine={false} 
                              dx={-5} 
                              label={{ value: 'Velocity (m/s)', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: '11px', fill: '#64748b', fontWeight: 600, textAnchor: 'middle' } }}
                            />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '15px' }} />
                            <Line type="monotone" dataKey="velocity" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
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
                          <LineChart data={filteredData} margin={{ top: 10, right: 20, left: 20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                              axisLine={false} 
                              tickLine={false} 
                              dy={8} 
                              label={{ value: 'Time (s)', position: 'insideBottom', offset: -10, style: { fontSize: '11px', fill: '#64748b', fontWeight: 600 } }}
                            />
                            <YAxis 
                              tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                              axisLine={false} 
                              tickLine={false} 
                              dx={-5} 
                              label={{ value: 'Power (W)', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: '11px', fill: '#64748b', fontWeight: 600, textAnchor: 'middle' } }}
                            />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '15px' }} />
                            <Line type="monotone" dataKey="power_inst" stroke="#0d9488" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
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
            );
          })()}
        </div>
      </div>
    </div>
  )
}
