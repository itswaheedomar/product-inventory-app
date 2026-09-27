import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, type DailyPage, type Product, toNum, fmtMoney, todayStr } from '../lib/supabase'
import { Overlay } from './ProductModal'

interface SearchModalProps {
  onClose: () => void
  onPickDate: (date: string) => void
}

interface SearchResult {
  page_date: string
  product_name: string
  quantity: number
  unit_price: number
  page_id: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function SearchModal({ onClose, onPickDate }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchType, setSearchType] = useState<'product' | 'date'>('product')
  const [pageDates, setPageDates] = useState<Set<string>>(new Set())

  // Mini calendar state
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [pickedDate, setPickedDate] = useState<string>('')

  // Load all page dates for calendar dots
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('daily_pages').select('page_date').order('page_date', { ascending: true })
      if (data) setPageDates(new Set(data.map(p => p.page_date)))
    })()
  }, [])

  const calendarDays = useMemo(() => {
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

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    if (searchType === 'product') {
      const { data, error } = await supabase
        .from('products')
        .select('page_id, product_name, quantity, unit_price')
        .ilike('product_name', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) { console.error(error); setLoading(false); return }
      const pageIds = [...new Set((data || []).map(r => r.page_id))]
      let dateMap: Record<string, string> = {}
      if (pageIds.length > 0) {
        const { data: pages } = await supabase
          .from('daily_pages')
          .select('id, page_date')
          .in('id', pageIds)
        dateMap = Object.fromEntries((pages || []).map(p => [p.id, p.page_date]))
      }
      setResults((data || []).map(r => ({
        page_date: dateMap[r.page_id] || '',
        product_name: r.product_name,
        quantity: toNum(r.quantity),
        unit_price: toNum(r.unit_price),
        page_id: r.page_id,
      })))
    } else {
      // Date search: exact match
      const { data, error } = await supabase
        .from('daily_pages')
        .select('id, page_date, note')
        .eq('page_date', q)
        .order('page_date', { ascending: false })
        .limit(50)
      if (error) { console.error(error); setLoading(false); return }
      setResults((data || []).map(r => ({
        page_date: r.page_date,
        product_name: r.note || '',
        quantity: 0,
        unit_price: 0,
        page_id: r.id,
      })))
    }
    setLoading(false)
  }, [searchType])

  useEffect(() => {
    if (searchType === 'product') {
      const t = setTimeout(() => doSearch(query), 300)
      return () => clearTimeout(t)
    } else if (pickedDate) {
      doSearch(pickedDate)
    } else {
      setResults([])
    }
  }, [query, pickedDate, doSearch, searchType])

  const handleCalendarPick = (date: string) => {
    setPickedDate(date)
  }

  return (
    <Overlay onClose={onClose}>
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Search Records</h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
          <button
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all ${searchType === 'product' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
            onClick={() => { setSearchType('product'); setResults([]); setPickedDate('') }}
          >By Product</button>
          <button
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all ${searchType === 'date' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
            onClick={() => { setSearchType('date'); setResults([]); setQuery('') }}
          >By Date</button>
        </div>

        {searchType === 'product' ? (
          <input
            className="input"
            placeholder="Search product name…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : (
          <div>
            {/* Mini calendar date picker */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                <button className="btn-ghost !px-2 !py-1" onClick={goPrevMonth} aria-label="Previous month">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className="font-bold text-slate-700 text-sm">{MONTHS[viewMonth]} {viewYear}</span>
                <button className="btn-ghost !px-2 !py-1" onClick={goNextMonth} aria-label="Next month">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 px-2 pt-2">
                {DOW.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 px-2 pb-2 pt-1">
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={i} />
                  const dayNum = parseInt(date.slice(8))
                  const isPicked = date === pickedDate
                  const hasRecord = pageDates.has(date)
                  const isToday = date === todayStr()
                  return (
                    <button
                      key={i}
                      onClick={() => handleCalendarPick(date)}
                      className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all active:scale-90 ${
                        isPicked
                          ? 'bg-brand-600 text-white shadow-sm'
                          : hasRecord
                          ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {dayNum}
                      {hasRecord && !isPicked && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
                      )}
                      {isToday && !isPicked && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            {pickedDate && (
              <div className="mt-2 text-center text-xs text-slate-500">
                Searching: {new Date(pickedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 max-h-[40vh] overflow-y-auto space-y-2">
          {loading && <div className="text-center text-slate-400 text-sm py-4">Searching…</div>}
          {!loading && searchType === 'product' && query.trim() && results.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-4">No results found</div>
          )}
          {!loading && searchType === 'date' && pickedDate && results.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-4">No records on this date</div>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={i}
              onClick={() => onPickDate(r.page_date)}
              className="w-full text-left rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">
                  {new Date(r.page_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {searchType === 'product' && r.unit_price > 0 && (
                  <span className="text-sm font-bold text-slate-700">AFG {fmtMoney(r.quantity * r.unit_price)}</span>
                )}
              </div>
              {searchType === 'product' ? (
                <div className="mt-1 text-sm text-slate-700 font-medium">{r.product_name}</div>
              ) : (
                r.product_name && <div className="mt-1 text-sm text-slate-500 truncate">{r.product_name}</div>
              )}
              {searchType === 'product' && (
                <div className="text-xs text-slate-400 mt-0.5">
                  Qty: {r.quantity} × AFG {fmtMoney(r.unit_price)}
                </div>
              )}
            </button>
          ))}
        </div>
        <button className="btn-secondary w-full mt-4" onClick={onClose}>Close</button>
      </div>
    </Overlay>
  )
}
