import { useState, useEffect, useRef } from 'react'
import { X, Folder, FileArchive, Search, FolderUp, ChevronRight } from 'lucide-react'

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
}

interface FileBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectFile: (filePath: string) => void
  title?: string
  themeColor?: 'indigo' | 'emerald' // 'indigo' = Teal, 'emerald' = Cyan focus styles
}

export default function FileBrowserModal({
  isOpen,
  onClose,
  onSelectFile,
  title = 'Browse Filesystem',
  themeColor = 'indigo'
}: FileBrowserModalProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [directories, setDirectories] = useState<DirectoryEntry[]>([])
  const [files, setFiles] = useState<DirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Fetch initial home directory when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      window.api.getHomeDir()
        .then((home) => {
          setCurrentPath(home)
        })
        .catch((err) => {
          console.error(err)
          setLoading(false)
        })
    }
  }, [isOpen])

  // Fetch directory list whenever currentPath changes
  useEffect(() => {
    if (isOpen && currentPath) {
      setLoading(true)
      setSelectedFilePath(null)
      setSearchQuery('')
      window.api.listDirectory(currentPath)
        .then((result) => {
          if (result) {
            setCurrentPath(result.currentPath)
            setParentPath(result.parentPath)
            setDirectories(result.directories)
            setFiles(result.files)
          }
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setLoading(false)
        })
    }
  }, [isOpen, currentPath])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath)
  }

  const handleFileClick = (filePath: string) => {
    setSelectedFilePath(filePath)
  }

  const handleFileDoubleClick = (filePath: string) => {
    onSelectFile(filePath)
    onClose()
  }

  const handleConfirmSelect = () => {
    if (selectedFilePath) {
      onSelectFile(selectedFilePath)
      onClose()
    }
  }

  // Split path for breadcrumb navigation
  // Handles both Windows (C:\User\Name) and POSIX (/home/user) separators
  const separator = currentPath.includes('\\') ? '\\' : '/'
  const pathParts = currentPath.split(separator).filter(Boolean)
  const isWindows = currentPath.match(/^[a-zA-Z]:/)

  const navigateToBreadcrumb = (index: number) => {
    let newPath = ''
    if (isWindows) {
      // Windows absolute paths reconstruction (e.g. C:\Users\Name)
      const drive = currentPath.split(separator)[0]
      newPath = [drive, ...pathParts.slice(0, index + 1)].join(separator)
    } else {
      // Unix absolute paths reconstruction (e.g. /home/user)
      newPath = '/' + pathParts.slice(0, index + 1).join(separator)
    }
    setCurrentPath(newPath)
  }

  // Filter items in the current directory listing
  const filteredDirs = directories.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Action focus configurations
  const activeBorderClass = themeColor === 'indigo'
    ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500'
    : 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500'

  const activeBtnClass = themeColor === 'indigo'
    ? 'bg-indigo-600 hover:bg-indigo-750 text-white'
    : 'bg-emerald-500 hover:bg-emerald-650 text-white'

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-55 animate-fade-in">
      <div 
        ref={modalRef}
        className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full mx-4 border border-slate-200/50 shadow-2xl relative flex flex-col max-h-[85vh] animate-scale-in"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-4">
          <h3 className="text-xl md:text-2xl font-bold font-display text-slate-900 mb-1">{title}</h3>
          <p className="text-xs md:text-sm text-slate-400 font-semibold">Select a model parameter package from disk.</p>
        </div>

        {/* Breadcrumb Navigator */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto text-xs md:text-sm font-semibold text-slate-500 scrollbar-none mb-4">
          {/* Root/Drive Node */}
          <button 
            onClick={() => setCurrentPath(isWindows ? currentPath.split(separator)[0] + separator : '/')} 
            className="hover:text-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            {isWindows ? currentPath.split(separator)[0] : 'Root'}
          </button>
          
          {pathParts.map((part, idx) => {
            // If Windows, the first element (drive letter) is already handled
            if (isWindows && idx === 0) return null
            return (
              <div key={idx} className="flex items-center gap-1.5 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-350 shrink-0" />
                <button
                  onClick={() => navigateToBreadcrumb(idx)}
                  className="hover:text-slate-800 transition-colors cursor-pointer"
                >
                  {part}
                </button>
              </div>
            )
          })}
        </div>

        {/* Filter Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by file or directory name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold text-slate-700 placeholder-slate-400"
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-[300px] max-h-[45vh] overflow-y-auto border border-slate-200/80 rounded-2xl p-2 bg-slate-50/30 custom-scrollbar mb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-indigo-500">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-b-indigo-500 mb-3"></div>
              <p className="text-xs font-bold text-slate-555">Reading directory content...</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Directory Navigator Up Option */}
              {parentPath && (
                <button
                  type="button"
                  onClick={() => handleFolderClick(parentPath)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-xs md:text-sm font-semibold text-indigo-650 hover:bg-indigo-50/50 rounded-xl transition-all cursor-pointer"
                >
                  <FolderUp className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>.. (Parent Directory)</span>
                </button>
              )}

              {/* Directories List */}
              {filteredDirs.map((dir) => (
                <button
                  key={dir.path}
                  type="button"
                  onClick={() => handleFolderClick(dir.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs md:text-sm font-semibold text-slate-700 hover:bg-slate-100/70 rounded-xl transition-all cursor-pointer"
                >
                  <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{dir.name}</span>
                </button>
              ))}

              {/* Zip Files List */}
              {filteredFiles.map((file) => {
                const isSelected = selectedFilePath === file.path
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => handleFileClick(file.path)}
                    onDoubleClick={() => handleFileDoubleClick(file.path)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer border border-transparent
                      ${isSelected ? activeBorderClass : 'text-slate-800 hover:bg-slate-100/75'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileArchive className={`w-4 h-4 shrink-0 ${isSelected ? (themeColor === 'indigo' ? 'text-indigo-600' : 'text-emerald-500') : 'text-slate-400'}`} />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 shrink-0">
                      {formatSize(file.size)}
                    </span>
                  </button>
                )
              })}

              {/* Empty state filter */}
              {filteredDirs.length === 0 && filteredFiles.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-xs font-bold">
                  No zip files or subdirectories found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action controls */}
        <div className="flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSelect}
            disabled={!selectedFilePath}
            className={`px-5 py-2.5 text-xs md:text-sm font-semibold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${activeBtnClass}`}
          >
            Select File
          </button>
        </div>
      </div>
    </div>
  )
}
