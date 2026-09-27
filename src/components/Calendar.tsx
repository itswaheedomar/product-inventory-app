import { useState, useMemo } from 'react'

interface CalendarProps {
  selectedDate: string
  pageDates: Set<string>
  onPickDate: (date: string) => void
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function Calendar({ selectedDate, pageDates, onPickDate }: CalendarProps) {
  const sel = new Date(selectedDate + 'T00:00:00')
  const [viewYear, setViewYear] = useState(sel.getFullYear())
  const [viewMonth, setViewMonth] = useState(sel.getMonth())

  const daysInMonth = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const last = new Date(viewYear, viewMonth + 1, 0)
    const startDow = first.getDay()
    const count = last.getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= count; d++) {
      cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return cells
  }, [viewYear, viewMonth])

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Year navigation
  const goPrevYear = () => setViewYear(y => y - 1)
  const goNextYear = () => setViewYear(y => y + 1)

  // Count records per month
  const monthHasRecords = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    return [...pageDates].filter(d => d.startsWith(prefix)).length
  }, [pageDates, viewYear, viewMonth])

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <button className="btn-ghost !px-2 !py-1.5" onClick={goPrev} aria-label="Previous month">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="text-center">
            <div className="font-bold text-slate-800">{MONTHS[viewMonth]}</div>
            <div className="text-xs text-slate-400">{monthHasRecords} record{monthHasRecords !== 1 ? 's' : ''} this month</div>
          </div>
          <button className="btn-ghost !px-2 !py-1.5" onClick={goNext} aria-label="Next month">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Year nav */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
          <button className="text-xs font-semibold text-slate-500 hover:text-brand-600" onClick={goPrevYear}>◀ {viewYear - 1}</button>
          <span className="text-sm font-bold text-slate-700">{viewYear}</span>
          <button className="text-xs font-semibold text-slate-500 hover:text-brand-600" onClick={goNextYear}>{viewYear + 1} ▶</button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 px-2 pt-2">
          {DOW.map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 px-2 pb-3 pt-1">
          {daysInMonth.map((date, i) => {
            if (!date) return <div key={i} />
            const dayNum = parseInt(date.slice(8))
            const isSelected = date === selectedDate
            const hasRecord = pageDates.has(date)
            const isToday = date === new Date().toISOString().slice(0, 10)
            return (
              <button
                key={i}
                onClick={() => onPickDate(date)}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all active:scale-90 ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-sm'
                    : hasRecord
                    ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {dayNum}
                {hasRecord && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
                )}
                {isToday && !isSelected && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick jump to today */}
      <button
        className="btn-secondary w-full"
        onClick={() => {
          const t = new Date()
          setViewYear(t.getFullYear())
          setViewMonth(t.getMonth())
          onPickDate(new Date().toISOString().slice(0, 10))
        }}
      >
        Jump to Today
      </button>

      {/* Recent days with records */}
      <div className="card p-4">
        <h3 className="font-semibold text-slate-700 text-sm mb-3">Days with Records</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {[...pageDates].sort().reverse().slice(0, 30).map(date => (
            <button
              key={date}
              onClick={() => onPickDate(date)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                date === selectedDate ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </button>
          ))}
          {pageDates.size === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">No records yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
