import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase, type DailyPage, type Product, toNum, fmtMoney, todayStr } from './lib/supabase'
import { Calendar } from './components/Calendar'
import { SearchModal } from './components/SearchModal'
import { BackupModal } from './components/BackupModal'
import { ProductModal } from './components/ProductModal'
import { exportCSV, exportExcel } from './lib/export'

type TabView = 'day' | 'calendar' | 'search'

export default function App() {
  const [tab, setTab] = useState<TabView>('day')
  const [currentDate, setCurrentDate] = useState<string>(todayStr())
  const [page, setPage] = useState<DailyPage | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [showBackup, setShowBackup] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [allPages, setAllPages] = useState<DailyPage[]>([])
  const [pageDates, setPageDates] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const grandTotal = useMemo(
    () => products.reduce((sum, p) => sum + toNum(p.quantity) * toNum(p.unit_price), 0),
    [products],
  )

  // Load all page dates for calendar markers
  useEffect(() => {
    loadAllPages()
  }, [])

  const loadAllPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('daily_pages')
      .select('id, page_date, note, created_at, updated_at')
      .order('page_date', { ascending: true })
    if (error) { setError(error.message); return }
    setAllPages(data || [])
    setPageDates(new Set((data || []).map(p => p.page_date)))
  }, [])

  // Load page + products when date changes
  const loadPage = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    const { data: pageData, error: pageErr } = await supabase
      .from('daily_pages')
      .select('id, page_date, note, created_at, updated_at')
      .eq('page_date', date)
      .maybeSingle()

    if (pageErr) { setError(pageErr.message); setLoading(false); return }

    if (pageData) {
      setPage(pageData)
      setNote(pageData.note || '')
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('id, page_id, seq_no, product_name, quantity, unit_price, created_at')
        .eq('page_id', pageData.id)
        .order('seq_no', { ascending: true })
      if (prodErr) { setError(prodErr.message); setLoading(false); return }
      setProducts(prodData || [])
    } else {
      setPage(null)
      setNote('')
      setProducts([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadPage(currentDate)
  }, [currentDate, loadPage])

  // Create a new page for the current date
  const ensurePage = useCallback(async (): Promise<DailyPage | null> => {
    if (page) return page
    const { data, error } = await supabase
      .from('daily_pages')
      .insert({ page_date: currentDate })
      .select('id, page_date, note, created_at, updated_at')
      .maybeSingle()
    if (error) { setError(error.message); return null }
    setPage(data)
    setNote('')
    await loadAllPages()
    return data
  }, [page, currentDate, loadAllPages])

  const handleAddProduct = useCallback(async (name: string, qty: number, price: number) => {
    const p = await ensurePage()
    if (!p) return
    const nextSeq = products.length > 0 ? Math.max(...products.map(x => x.seq_no)) + 1 : 1
    const { data, error } = await supabase
      .from('products')
      .insert({
        page_id: p.id,
        seq_no: nextSeq,
        product_name: name,
        quantity: qty,
        unit_price: price,
      })
      .select('id, page_id, seq_no, product_name, quantity, unit_price, created_at')
      .maybeSingle()
    if (error) { setError(error.message); return }
    if (data) setProducts(prev => [...prev, data])
  }, [ensurePage, products])

  const handleUpdateProduct = useCallback(async (id: string, name: string, qty: number, price: number) => {
    const { data, error } = await supabase
      .from('products')
      .update({ product_name: name, quantity: qty, unit_price: price })
      .eq('id', id)
      .select('id, page_id, seq_no, product_name, quantity, unit_price, created_at')
      .maybeSingle()
    if (error) { setError(error.message); return }
    if (data) setProducts(prev => prev.map(p => p.id === id ? data : p))
  }, [])

  const handleDeleteProduct = useCallback(async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { setError(error.message); loadPage(currentDate); return }
    // Renumber remaining
    const remaining = products.filter(p => p.id !== id)
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].seq_no !== i + 1) {
        await supabase.from('products').update({ seq_no: i + 1 }).eq('id', remaining[i].id)
      }
    }
    loadPage(currentDate)
  }, [products, currentDate, loadPage])

  const handleDeletePage = useCallback(async () => {
    if (!page) return
    if (!confirm('Delete this entire day and all its products? This cannot be undone.')) return
    const { error } = await supabase.from('daily_pages').delete().eq('id', page.id)
    if (error) { setError(error.message); return }
    setPage(null)
    setNote('')
    setProducts([])
    await loadAllPages()
  }, [page, loadAllPages])

  // Debounced note save
  const saveNote = useCallback(async (value: string) => {
    const p = await ensurePage()
    if (!p) return
    setSaving(true)
    const { error } = await supabase.from('daily_pages').update({ note: value, updated_at: new Date().toISOString() }).eq('id', p.id)
    setSaving(false)
    if (error) setError(error.message)
  }, [ensurePage])

  const onNoteChange = useCallback((value: string) => {
    setNote(value)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => saveNote(value), 800)
  }, [saveNote])

  const handleExportCSV = useCallback(() => {
    exportCSV(currentDate, products)
  }, [currentDate, products])

  const handleExportExcel = useCallback(() => {
    exportExcel(currentDate, products)
  }, [currentDate, products])

  const onPickDate = useCallback((date: string) => {
    setCurrentDate(date)
    setTab('day')
  }, [])

  const prevDay = useCallback(() => {
    const d = new Date(currentDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setCurrentDate(d.toISOString().slice(0, 10))
  }, [currentDate])

  const nextDay = useCallback(() => {
    const d = new Date(currentDate + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setCurrentDate(d.toISOString().slice(0, 10))
  }, [currentDate])

  const dateDisplay = useMemo(() => {
    const d = new Date(currentDate + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }, [currentDate])

  const isToday = currentDate === todayStr()

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">Daily Lists</h1>
          <div className="flex items-center gap-1">
            <button className="btn-ghost !px-2.5 !py-2" onClick={() => setShowSearch(true)} aria-label="Search">
              <SearchIcon />
            </button>
            <button className="btn-ghost !px-2.5 !py-2" onClick={() => setShowBackup(true)} aria-label="Backup">
              <BackupIcon />
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <nav className="flex gap-1 mt-2.5 bg-slate-100 rounded-xl p-1">
          <TabButton active={tab === 'day'} onClick={() => setTab('day')}>Today</TabButton>
          <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>Calendar</TabButton>
          <TabButton active={tab === 'search'} onClick={() => setShowSearch(true)}>Search</TabButton>
        </nav>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'day' && (
          <DayView
            loading={loading}
            dateDisplay={dateDisplay}
            isToday={isToday}
            page={page}
            products={products}
            grandTotal={grandTotal}
            note={note}
            saving={saving}
            onNoteChange={onNoteChange}
            onPrevDay={prevDay}
            onNextDay={nextDay}
            onAddProduct={() => setShowAddProduct(true)}
            onEditProduct={(p) => setEditingProduct(p)}
            onDeleteProduct={handleDeleteProduct}
            onDeletePage={handleDeletePage}
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            onGoToday={() => setCurrentDate(todayStr())}
          />
        )}
        {tab === 'calendar' && (
          <Calendar
            selectedDate={currentDate}
            pageDates={pageDates}
            onPickDate={onPickDate}
          />
        )}
        {tab === 'search' && (
          <div className="text-center py-20 text-slate-400">
            <p className="text-sm">Tap the search icon to find records</p>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-100 px-2 py-1.5 flex justify-around">
        <NavButton active={tab === 'day'} onClick={() => setTab('day')} icon={<DayIcon />} label="Day" />
        <NavButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<CalIcon />} label="Calendar" />
        <NavButton onClick={() => setShowSearch(true)} icon={<SearchIcon />} label="Search" />
        <NavButton onClick={() => setShowBackup(true)} icon={<BackupIcon />} label="Backup" />
      </nav>

      {/* Modals */}
      {showAddProduct && (
        <ProductModal
          mode="add"
          onClose={() => setShowAddProduct(false)}
          onSave={async (name, qty, price) => { await handleAddProduct(name, qty, price); setShowAddProduct(false) }}
        />
      )}
      {editingProduct && (
        <ProductModal
          mode="edit"
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={async (name, qty, price) => { await handleUpdateProduct(editingProduct.id, name, qty, price); setEditingProduct(null) }}
        />
      )}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onPickDate={onPickDate}
        />
      )}
      {showBackup && (
        <BackupModal
          allPages={allPages}
          onClose={() => setShowBackup(false)}
          onRestored={() => { loadAllPages(); loadPage(currentDate); setShowBackup(false) }}
        />
      )}
    </div>
  )
}

// ─── Day View ──────────────────────────────────────────────

interface DayViewProps {
  loading: boolean
  dateDisplay: string
  isToday: boolean
  page: DailyPage | null
  products: Product[]
  grandTotal: number
  note: string
  saving: boolean
  onNoteChange: (v: string) => void
  onPrevDay: () => void
  onNextDay: () => void
  onAddProduct: () => void
  onEditProduct: (p: Product) => void
  onDeleteProduct: (id: string) => void
  onDeletePage: () => void
  onExportCSV: () => void
  onExportExcel: () => void
  onGoToday: () => void
}

function DayView(props: DayViewProps) {
  const { loading, dateDisplay, isToday, page, products, grandTotal, note, saving } = props

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading…</div>
  }

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-2">
        <button className="btn-secondary !px-3 !py-2" onClick={props.onPrevDay}>
          <ChevronLeft />
        </button>
        <button className="flex-1 text-center" onClick={props.onGoToday}>
          <div className="font-bold text-slate-800 text-base">{dateDisplay}</div>
          <div className="text-xs text-slate-400">{isToday ? 'Today' : 'Tap for today'}</div>
        </button>
        <button className="btn-secondary !px-3 !py-2" onClick={props.onNextDay}>
          <ChevronRight />
        </button>
      </div>

      {/* Grand total card */}
      <div className="card bg-gradient-to-br from-brand-600 to-brand-700 border-0 px-5 py-4">
        <div className="text-brand-100 text-xs font-semibold uppercase tracking-wide">Grand Total</div>
        <div className="text-white text-3xl font-bold mt-1">AFG {fmtMoney(grandTotal)}</div>
        <div className="text-brand-200 text-xs mt-1">{products.length} item{products.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Product table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Products</h2>
          <div className="flex gap-1.5">
            <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={props.onExportCSV}>CSV</button>
            <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={props.onExportExcel}>Excel</button>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-slate-300 mb-3">
              <InboxIcon />
            </div>
            <p className="text-slate-400 text-sm">No products yet</p>
            <p className="text-slate-300 text-xs mt-1">Tap "Add Product" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="px-3 py-2.5 text-left font-semibold w-10">No.</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-16">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-20">Price</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-24">Total</th>
                  <th className="px-2 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const total = toNum(p.quantity) * toNum(p.unit_price)
                  return (
                    <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-3 py-3 text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-3 py-3 text-slate-800 font-medium cursor-pointer" onClick={() => props.onEditProduct(p)}>
                        {p.product_name}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{toNum(p.quantity)}</td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">AFG {fmtMoney(toNum(p.unit_price))}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800 tabular-nums">AFG {fmtMoney(total)}</td>
                      <td className="px-2 py-3">
                        <button className="text-slate-300 hover:text-red-500 transition-colors p-1" onClick={() => props.onDeleteProduct(p.id)} aria-label="Delete">
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-100">
                  <td colSpan={4} className="px-3 py-3 text-right font-semibold text-slate-500 text-xs uppercase">Total</td>
                  <td className="px-3 py-3 text-right font-bold text-brand-700 tabular-nums">AFG {fmtMoney(grandTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-slate-100">
          <button className="btn-primary w-full" onClick={props.onAddProduct}>
            <PlusIcon /> Add Product
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label !mb-0">Note for this day</label>
          {saving && <span className="text-xs text-slate-400">Saving…</span>}
        </div>
        <textarea
          className="input min-h-[80px] resize-y"
          placeholder="Add a note for this day…"
          value={note}
          onChange={(e) => props.onNoteChange(e.target.value)}
        />
      </div>

      {/* Delete page */}
      {page && (
        <button className="btn-danger w-full" onClick={props.onDeletePage}>
          <TrashIcon /> Delete this day
        </button>
      )}
    </div>
  )
}

// ─── Tab & Nav buttons ──────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all ${
        active ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

function NavButton({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
        active ? 'text-brand-600' : 'text-slate-400'
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  )
}

// ─── Icons ──────────────────────────────────────────────────

function SearchIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> }
function BackupIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function DayIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function CalIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function PlusIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> }
function ChevronLeft() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function ChevronRight() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg> }
function InboxIcon() { return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> }
