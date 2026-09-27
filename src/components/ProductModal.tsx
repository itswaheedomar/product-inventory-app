import { useState, useMemo } from 'react'
import { toNum, fmtMoney, type Product } from '../lib/supabase'

interface ProductModalProps {
  mode: 'add' | 'edit'
  product?: Product
  onClose: () => void
  onSave: (name: string, qty: number, price: number) => Promise<void>
}

export function ProductModal({ mode, product, onClose, onSave }: ProductModalProps) {
  const [name, setName] = useState(product?.product_name || '')
  const [qty, setQty] = useState(product ? String(toNum(product.quantity)) : '1')
  const [price, setPrice] = useState(product ? String(toNum(product.unit_price)) : '')
  const [saving, setSaving] = useState(false)

  const total = useMemo(() => toNum(qty) * toNum(price), [qty, price])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim(), toNum(qty), toNum(price))
    setSaving(false)
  }

  return (
    <Overlay onClose={onClose}>
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          {mode === 'add' ? 'Add Product' : 'Edit Product'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Product Name</label>
            <input
              className="input"
              placeholder="e.g. Coffee beans"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Unit Price</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          {/* Live total preview */}
          <div className="rounded-xl bg-brand-50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-brand-700">Total</span>
            <span className="text-lg font-bold text-brand-700">AFG {fmtMoney(total)}</span>
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={saving || !name.trim()} onClick={handleSave}>
            {saving ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg sm:m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
