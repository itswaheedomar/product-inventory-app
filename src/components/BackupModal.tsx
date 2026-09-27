import { useState, useCallback } from 'react'
import { supabase, type DailyPage, type Product } from '../lib/supabase'
import { Overlay } from './ProductModal'

interface BackupModalProps {
  allPages: DailyPage[]
  onClose: () => void
  onRestored: () => void
}

export function BackupModal({ allPages, onClose, onRestored }: BackupModalProps) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleBackup = useCallback(async () => {
    setBusy(true)
    setMsg(null)
    try {
      // Fetch all pages and products
      const { data: pages, error: pErr } = await supabase
        .from('daily_pages')
        .select('id, page_date, note, created_at, updated_at')
        .order('page_date', { ascending: true })
      if (pErr) throw pErr

      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, page_id, seq_no, product_name, quantity, unit_price, created_at')
        .order('seq_no', { ascending: true })
      if (prodErr) throw prodErr

      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        daily_pages: pages || [],
        products: products || [],
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `daily-lists-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg('Backup downloaded successfully')
    } catch (e) {
      setMsg(`Backup failed: ${(e as Error).message}`)
    }
    setBusy(false)
  }, [])

  const handleRestore = useCallback(async (file: File) => {
    setBusy(true)
    setMsg(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.daily_pages || !data.products) throw new Error('Invalid backup file')

      // Insert pages (upsert by page_date)
      for (const p of data.daily_pages) {
        await supabase.from('daily_pages').upsert({
          id: p.id,
          page_date: p.page_date,
          note: p.note,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }, { onConflict: 'page_date' })
      }

      // Insert products
      for (const prod of data.products) {
        await supabase.from('products').upsert({
          id: prod.id,
          page_id: prod.page_id,
          seq_no: prod.seq_no,
          product_name: prod.product_name,
          quantity: prod.quantity,
          unit_price: prod.unit_price,
          created_at: prod.created_at,
        }, { onConflict: 'id' })
      }

      setMsg(`Restored ${data.daily_pages.length} days and ${data.products.length} products`)
      setTimeout(() => onRestored(), 1000)
    } catch (e) {
      setMsg(`Restore failed: ${(e as Error).message}`)
    }
    setBusy(false)
  }, [onRestored])

  return (
    <Overlay onClose={onClose}>
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Backup & Restore</h2>

        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-slate-700">{allPages.length}</div>
              <div className="text-xs text-slate-400 mt-0.5">Days recorded</div>
            </div>
          </div>

          {/* Backup */}
          <div>
            <h3 className="font-semibold text-slate-700 text-sm mb-2">Export Backup</h3>
            <p className="text-xs text-slate-400 mb-3">Download a JSON file with all your days and products. Keep it safe — it contains all your data.</p>
            <button className="btn-primary w-full" disabled={busy} onClick={handleBackup}>
              {busy ? 'Working…' : 'Download Backup'}
            </button>
          </div>

          {/* Restore */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-2">Restore from Backup</h3>
            <p className="text-xs text-slate-400 mb-3">Upload a backup JSON file to restore your data. Existing records with the same date will be updated.</p>
            <label className="btn-secondary w-full cursor-pointer">
              Choose Backup File
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleRestore(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {/* Message */}
          {msg && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              {msg}
            </div>
          )}
        </div>

        <button className="btn-secondary w-full mt-5" onClick={onClose}>Close</button>
      </div>
    </Overlay>
  )
}
