import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Train from './pages/Train'
import Test from './pages/Test'
import Results from './pages/Results'
import Models from './pages/Models'

export type Page = 'home' | 'train' | 'test' | 'results' | 'models'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [testModelId, setTestModelId] = useState<string | null>(null)

  const navigateTo = (page: Page) => setCurrentPage(page)

  const handleTestModel = (modelId: string) => {
    setTestModelId(modelId)
    setCurrentPage('test')
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar currentPage={currentPage} navigateTo={navigateTo} />
      
      {/* Main Content Area with subtle background pattern */}
      <main className="flex-1 overflow-auto bg-slate-50/50 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/60 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 h-full">
          {currentPage === 'home' && <Home navigateTo={navigateTo} />}
          {currentPage === 'train' && <Train navigateTo={navigateTo} />}
          {currentPage === 'test' && <Test navigateTo={navigateTo} initialModelId={testModelId} />}
          {currentPage === 'results' && <Results />}
          {currentPage === 'models' && <Models onTestModel={handleTestModel} />}
        </div>
      </main>
    </div>
  )
}

export default App
