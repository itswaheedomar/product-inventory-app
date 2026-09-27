import { toNum, fmtMoney, type Product } from './supabase'

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCSV(date: string, products: Product[]) {
  const header = ['No.', 'Product Name', 'Quantity', 'Unit Price', 'Total Price']
  const rows = products.map((p, i) => {
    const total = toNum(p.quantity) * toNum(p.unit_price)
    const name = `"${p.product_name.replace(/"/g, '""')}"`
    return [i + 1, name, toNum(p.quantity), toNum(p.unit_price).toFixed(2), total.toFixed(2)].join(',')
  })
  const grandTotal = products.reduce((s, p) => s + toNum(p.quantity) * toNum(p.unit_price), 0)
  rows.push(['', '', '', 'Grand Total', grandTotal.toFixed(2)].join(','))

  const csv = [header.join(','), ...rows].join('\n')
  downloadFile(`daily-list-${date}.csv`, csv, 'text/csv;charset=utf-8;')
}

export function exportExcel(date: string, products: Product[]) {
  // Excel can open HTML tables with the .xls extension
  const headerStyle = 'font-weight:bold;background:#dbeafe;border:1px solid #93c5fd;padding:4px 8px;text-align:center;'
  const cellStyle = 'border:1px solid #e2e8f0;padding:4px 8px;'
  const numStyle = `${cellStyle}text-align:right;`

  const rows = products.map((p, i) => {
    const total = toNum(p.quantity) * toNum(p.unit_price)
    return `<tr>
      <td style="${cellStyle}">${i + 1}</td>
      <td style="${cellStyle}">${escapeHtml(p.product_name)}</td>
      <td style="${numStyle}">${toNum(p.quantity)}</td>
      <td style="${numStyle}">${toNum(p.unit_price).toFixed(2)}</td>
      <td style="${numStyle}">${total.toFixed(2)}</td>
    </tr>`
  }).join('')

  const grandTotal = products.reduce((s, p) => s + toNum(p.quantity) * toNum(p.unit_price), 0)
  const footer = `<tr>
    <td colspan="4" style="font-weight:bold;text-align:right;border:1px solid #e2e8f0;padding:4px 8px;">Grand Total</td>
    <td style="font-weight:bold;text-align:right;border:1px solid #e2e8f0;padding:4px 8px;background:#dbeafe;">${grandTotal.toFixed(2)}</td>
  </tr>`

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"></head>
<body>
<table>
<tr><td colspan="5" style="font-size:16px;font-weight:bold;padding:8px;">Daily Product List — ${date}</td></tr>
<tr style="height:8px"></tr>
<tr>
  <th style="${headerStyle}">No.</th>
  <th style="${headerStyle}">Product Name</th>
  <th style="${headerStyle}">Quantity</th>
  <th style="${headerStyle}">Unit Price</th>
  <th style="${headerStyle}">Total Price</th>
</tr>
${rows}
${footer}
</table>
</body>
</html>`

  downloadFile(`daily-list-${date}.xls`, html, 'application/vnd.ms-excel')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export { fmtMoney }
