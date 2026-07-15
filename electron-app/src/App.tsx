import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Home from './pages/Home'
import Train from './pages/Train'
import Test from './pages/Test'
import Results from './pages/Results'
import Models from './pages/Models'
import Settings from './pages/Settings'

export type Page = 'home' | 'train' | 'test' | 'results' | 'models' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [testModelId, setTestModelId] = useState<string | null>(null)
  const [runningSim, setRunningSim] = useState<'train' | 'test' | null>(null)
  const [autoExpandLatest, setAutoExpandLatest] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const navigateTo = (page: Page, autoExpand = false, runId: string | null = null) => {
    setCurrentPage(page)
    setAutoExpandLatest(autoExpand)
    setSelectedRunId(runId)
  }

  const handleTestModel = (modelId: string) => {
    setTestModelId(modelId)
    setCurrentPage('test')
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      <TitleBar />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} navigateTo={navigateTo} runningSim={runningSim} />
        
        {/* Main Content Area with subtle background pattern */}
        <main className="flex-1 overflow-auto bg-slate-100/70 relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/60 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 h-full">
            <div className={currentPage === 'home' ? 'h-full' : 'hidden'}><Home navigateTo={navigateTo} /></div>
            <div className={currentPage === 'train' ? 'h-full' : 'hidden'}><Train navigateTo={navigateTo} runningSim={runningSim} setRunningSim={setRunningSim} active={currentPage === 'train'} /></div>
            <div className={currentPage === 'test' ? 'h-full' : 'hidden'}><Test navigateTo={navigateTo} initialModelId={testModelId} runningSim={runningSim} setRunningSim={setRunningSim} active={currentPage === 'test'} /></div>
            <div className={currentPage === 'results' ? 'h-full' : 'hidden'}>
              <Results 
                active={currentPage === 'results'} 
                autoExpandLatest={autoExpandLatest}
                onClearAutoExpand={() => setAutoExpandLatest(false)}
                selectedRunId={selectedRunId}
              />
            </div>
            <div className={currentPage === 'models' ? 'h-full' : 'hidden'}><Models onTestModel={handleTestModel} active={currentPage === 'models'} /></div>
            <div className={currentPage === 'settings' ? 'h-full' : 'hidden'}><Settings active={currentPage === 'settings'} runningSim={runningSim} /></div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
