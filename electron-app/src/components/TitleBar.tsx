import { useState, useEffect } from 'react'
import { Minus, Square, Copy, X, Waves } from 'lucide-react'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Listen to maximize state updates from Electron
    const unsubscribe = window.api.onWindowMaximized((maximized) => {
      setIsMaximized(maximized)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleMinimize = () => {
    window.api.minimizeWindow()
  }

  const handleMaximize = () => {
    window.api.maximizeWindow()
  }

  const handleClose = () => {
    window.api.closeWindow()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    handleMaximize()
  }

  return (
    <div 
      className="h-10 w-full bg-white border-b border-slate-200/80 flex items-center justify-between pl-4 pr-0 shrink-0 select-none z-50 relative"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleDoubleClick}
    >
      {/* App Branding (Logo & Title) */}
      <div className="flex items-center gap-2">
        <Waves className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-bold font-display text-slate-800 tracking-wide uppercase">
          WEC-RL Controller
        </span>
      </div>

      {/* Window Controls Buttons */}
      <div 
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore Button */}
        <button
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 -rotate-90" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center text-slate-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
