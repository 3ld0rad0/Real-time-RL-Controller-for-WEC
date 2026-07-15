import { useState, useEffect } from 'react'
import { Activity, PlaySquare, LineChart, Box, Zap, ArrowRight, Clock, Calendar, ChevronRight, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, LineChart as SparklineChart, Line } from 'recharts'
import type { Page } from '../App'

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

interface HomeProps {
  navigateTo: (page: Page, autoExpand?: boolean, runId?: string | null) => void
}

function parseRunName(displayName: string) {
  // Example name: simulation2_latching_rl_60.0s_05s_1.6_10.0_irregular
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

function RecentRunCard({ run, onClick }: { run: ResultFile; onClick: () => void }) {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<{ energyAbs?: string; eta?: string } | null>(null)
  const [sparklineData, setSparklineData] = useState<{ time: number; value: number }[]>([])

  useEffect(() => {
    let active = true;
    
    async function loadData() {
      try {
        let energyAbsStr = undefined;
        let etaStr = undefined;
        
        // 1. Load energy metrics if file exists
        if (run.files.energy) {
          const energyCsv = await window.api.readCSV(run.files.energy);
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
        
        // 2. Load main CSV for sparkline chart
        let sData: { time: number; value: number }[] = [];
        if (run.files.main) {
          const mainCsv = await window.api.readCSV(run.files.main);
          const lines = mainCsv.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 2) {
            const headers = lines[0].split(',');
            const timeIdx = headers.indexOf('time');
            const powerIdx = headers.indexOf('power_inst');
            const posIdx = headers.indexOf('position');
            const valIdx = powerIdx !== -1 ? powerIdx : posIdx;
            
            if (valIdx !== -1 && timeIdx !== -1) {
              const maxPoints = 50;
              const step = Math.max(1, Math.floor((lines.length - 1) / maxPoints));
              for (let i = 1; i < lines.length; i += step) {
                const parts = lines[i].split(',');
                if (parts.length > Math.max(valIdx, timeIdx)) {
                  const t = parseFloat(parts[timeIdx]);
                  const v = parseFloat(parts[valIdx]);
                  if (!isNaN(t) && !isNaN(v)) {
                    sData.push({ time: t, value: v });
                  }
                }
              }
            }
          }
        }
        
        if (active) {
          setMetrics({ energyAbs: energyAbsStr, eta: etaStr });
          setSparklineData(sData);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading run details for card", err);
        if (active) setLoading(false);
      }
    }
    
    loadData();
    return () => {
      active = false;
    };
  }, [run]);

  const info = parseRunName(run.displayName);
  const formattedDate = new Date(run.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                        new Date(run.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="glass-card w-full text-left p-5 rounded-2xl border border-slate-200/60 bg-white hover:border-indigo-400 hover:shadow-lg transition-all duration-300 flex flex-col gap-3 cursor-pointer group relative overflow-hidden"
    >
      {/* Top row */}
      <div className="flex items-center justify-between w-full">
        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
          run.mode === 'train' ? 'bg-indigo-50 text-indigo-755 border border-indigo-150' : 'bg-emerald-50 text-emerald-755 border border-emerald-150'
        }`}>
          {run.mode === 'train' ? 'Training' : 'Testing'}
        </span>
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formattedDate}
        </span>
      </div>

      {/* Main Details */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-800 text-base truncate mb-0.5 group-hover:text-indigo-650 transition-colors" title={run.displayName}>
          {info.control}
        </h3>
        <p className="text-xs text-slate-500 font-medium mb-0.5">
          {info.wave} • {info.seaState}
        </p>
        {info.duration && (
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {info.duration}
          </p>
        )}
      </div>

      {/* Dynamic Content: Metrics and Sparkline */}
      {loading ? (
        <div className="h-[80px] w-full flex items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-100">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Metrics */}
          {(metrics?.energyAbs || metrics?.eta) && (
            <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              {metrics.energyAbs && (
                <div>
                  <div className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Absorbed Energy</div>
                  <div className="text-sm font-bold text-slate-850">{metrics.energyAbs}</div>
                </div>
              )}
              {metrics.eta && (
                <div>
                  <div className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Avg CWR (eta)</div>
                  <div className="text-sm font-bold text-emerald-650 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {metrics.eta} m
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sparkline Plot */}
          {sparklineData.length > 0 && (
            <div className="h-16 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <SparklineChart data={sparklineData}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={run.mode === 'train' ? '#0d9488' : '#06b6d4'} 
                    strokeWidth={1.75} 
                    dot={false} 
                  />
                </SparklineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
      
      {/* Absolute chevron indicator */}
      <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
        <ChevronRight className="w-4 h-4 text-indigo-500" />
      </div>
    </button>
  );
}

export default function Home({ navigateTo }: HomeProps) {
  const [recentRuns, setRecentRuns] = useState<ResultFile[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)

  useEffect(() => {
    window.api.getResults().then((data) => {
      setRecentRuns(data.slice(0, 3)) // top 3 runs
      setLoadingRuns(false)
    }).catch(err => {
      console.error(err)
      setLoadingRuns(false)
    })
  }, [])

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar">
      
      {/* Welcome Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 shadow-md relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-indigo-200 text-xs font-semibold mb-4 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-indigo-300" /> Desktop Edition Active
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold font-display tracking-tight mb-2">
            WEC-RL Controller Dashboard
          </h1>
          <p className="text-sm lg:text-base text-slate-350 font-medium">
            Manage, train, and test intelligent Reinforcement Learning agents for Wave Energy Converters directly from your desktop.
          </p>
        </div>
        
        <div className="hidden md:flex w-24 h-24 rounded-2xl bg-white/5 border border-white/10 items-center justify-center backdrop-blur-md shadow-inner shrink-0">
          <Activity className="w-12 h-12 text-indigo-300 animate-pulse" />
        </div>
      </div>

      {/* Recent Simulations (Horizontal Row) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold font-display text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Recent Simulation Runs
          </h2>
          <button 
            onClick={() => navigateTo('results')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-850 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            See all results
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {loadingRuns ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card w-full p-5 rounded-2xl border border-slate-200/40 bg-white/80 animate-pulse flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-16 bg-slate-200 rounded-full"></div>
                  <div className="h-3 w-24 bg-slate-100 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-slate-200 rounded"></div>
                  <div className="h-3 w-56 bg-slate-150 rounded"></div>
                </div>
                <div className="h-12 bg-slate-100 rounded-xl"></div>
              </div>
            ))
          ) : recentRuns.length === 0 ? (
            <div className="col-span-full glass-card w-full p-8 rounded-2xl border border-dashed border-slate-250 bg-white/50 text-center flex flex-col items-center justify-center gap-3">
              <Box className="w-10 h-10 text-slate-300 opacity-45" />
              <div>
                <h3 className="font-bold text-slate-700 text-sm">No simulations run yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">Start training or testing an agent to view real-time control metrics here.</p>
              </div>
              <button
                onClick={() => navigateTo('train')}
                className="mt-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Start Simulation
              </button>
            </div>
          ) : (
            recentRuns.map((run) => (
              <RecentRunCard 
                key={run.id} 
                run={run} 
                onClick={() => navigateTo('results', false, run.id)} 
              />
            ))
          )}
        </div>
      </div>

      {/* Quick Actions (Grid Row) */}
      <div className="flex flex-col gap-4 mb-4">
        <h2 className="text-lg font-bold font-display text-slate-800 px-1">
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigateTo('train')}
            className="glass-card p-5 rounded-xl flex flex-col items-start text-left group relative overflow-hidden bg-white hover:border-indigo-400"
          >
            <div className="absolute top-0 right-0 p-5 opacity-0 translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-3 shadow-inner group-hover:scale-105 transition-transform duration-300">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 mb-1">Train Agent</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">Configure deep learning parameters and run a new PPO training simulation.</p>
          </button>

          <button
            onClick={() => navigateTo('test')}
            className="glass-card p-5 rounded-xl flex flex-col items-start text-left group relative overflow-hidden bg-white hover:border-emerald-400"
          >
            <div className="absolute top-0 right-0 p-5 opacity-0 translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-3 shadow-inner group-hover:scale-105 transition-transform duration-300">
              <PlaySquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 mb-1">Test Agent</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">Evaluate a trained agent or baseline logic against specific wave conditions.</p>
          </button>

          <button
            onClick={() => navigateTo('results')}
            className="glass-card p-5 rounded-xl flex flex-col items-start text-left group relative overflow-hidden bg-white hover:border-purple-400"
          >
            <div className="absolute top-0 right-0 p-5 opacity-0 translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <ArrowRight className="w-4 h-4 text-purple-400" />
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-3 shadow-inner group-hover:scale-105 transition-transform duration-300">
              <LineChart className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 mb-1">View Results</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">Analyze rich interactive time-series plots and raw CSV data.</p>
          </button>

          <button
            onClick={() => navigateTo('models')}
            className="glass-card p-5 rounded-xl flex flex-col items-start text-left group relative overflow-hidden bg-white hover:border-amber-400"
          >
            <div className="absolute top-0 right-0 p-5 opacity-0 translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-3 shadow-inner group-hover:scale-105 transition-transform duration-300">
              <Box className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 mb-1">Browse Models</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">View all trained agents, inspect configs, and instantly load for testing.</p>
          </button>
        </div>
      </div>

    </div>
  )
}
