import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  themeColor?: 'indigo' | 'emerald' // 'indigo' = Teal, 'emerald' = Cyan
}

export default function Dropdown({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Select option...',
  themeColor = 'indigo'
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  // Setup focus styles based on active color theme
  const focusStyles = themeColor === 'indigo'
    ? 'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
    : 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'

  return (
    <div className={`relative inline-block text-left min-w-[140px] ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all outline-none cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400' : 'hover:bg-slate-100/50 hover:border-slate-350'}
          ${isOpen ? (themeColor === 'indigo' ? 'border-indigo-500 bg-white' : 'border-emerald-500 bg-white') : ''}
          ${focusStyles}`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute right-0 md:left-0 mt-2 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 py-1.5 min-w-full md:min-w-[200px] max-h-64 overflow-y-auto custom-scrollbar animate-fade-in origin-top-left">
          {options.length === 0 ? (
            <div className="px-4 py-2 text-xs font-semibold text-slate-450 italic">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value

              // Hover/Selection colors mapping to the primary/success marine themes
              let itemStyles = ''
              if (isSelected) {
                itemStyles = themeColor === 'indigo'
                  ? 'bg-indigo-100 text-indigo-800 font-bold'
                  : 'bg-emerald-100 text-emerald-800 font-bold'
              } else {
                itemStyles = themeColor === 'indigo'
                  ? 'text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-800'
                  : 'text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-800'
              }

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors truncate block cursor-pointer ${itemStyles}`}
                >
                  {opt.label}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
