import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
})

export interface DailyPage {
  id: string
  page_date: string
  note: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  page_id: string
  seq_no: number
  product_name: string
  quantity: number
  unit_price: number
  created_at: string
}

export type ProductInput = Omit<Product, 'id' | 'created_at'> & { id?: string }

export function toNum(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'))
  return isNaN(n) ? 0 : n
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
