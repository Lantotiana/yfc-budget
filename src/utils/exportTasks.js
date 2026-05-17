import { formatDate, getDueDateStatus, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from './taskUtils'

const TEAL   = 'FF16B5A3'
const TEAL_D = 'FFE6FAF8'
const TEAL_DARK = 'FF0D9370'

const STATUS_COLORS = {
  todo:        { bg: 'FFE0F2FE', fg: 'FF0369A1', dark: 'FF075985' },
  in_progress: { bg: 'FFFEF3C7', fg: 'FFB45309', dark: 'FF92400E' },
  done:        { bg: 'FFF0FDF4', fg: 'FF15803D', dark: 'FF14532D' },
}

const PRIORITY_COLORS = {
  low:    { bg: 'FFE0F7F6', fg: '  FF0B9EB7' },
  medium: { bg: 'FFFEF3C7', fg: 'FFB45309'  },
  high:   { bg: 'FFFEF2F2', fg: 'FFB91C1C'  },
}

const COLS = [
  { width: 36 }, // Titre
  { width: 14 }, // Statut
  { width: 12 }, // Priorité
  { width: 26 }, // Assigné à
  { width: 14 }, // Échéance
  { width: 16 }, // Checklist
  { width: 14 }, // Créé le
]
const NC = 7
const HEADERS = ['Titre', 'Statut', 'Priorité', 'Assigné à', 'Échéance', 'Checklist', 'Créé le']
const LAST_COL = 'G'

function sc(cell, { bg, fg = 'FF1F2937', bold = false, size = 10, hAlign = 'left', wrap = false } = {}) {
  if (bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.font = { bold, size, color: { argb: fg }, name: 'Calibri' }
  cell.alignment = { vertical: 'middle', horizontal: hAlign, wrapText: wrap }
}

function banner(ws, text, bg, fg = 'FFFFFFFF', size = 13, bold = true) {
  const row = ws.addRow([text, ...Array(NC - 1).fill('')])
  ws.mergeCells(`A${row.number}:${LAST_COL}${row.number}`)
  row.height = bold ? 34 : 22
  sc(row.getCell(1), { bg, fg, bold, size, hAlign: 'center' })
}

function addHeaderRow(ws, darkBg) {
  const hRow = ws.addRow(HEADERS)
  hRow.height = 24
  for (let c = 1; c <= NC; c++) {
    sc(hRow.getCell(c), { bg: darkBg, fg: 'FFFFFFFF', bold: true, size: 10, hAlign: c === 1 ? 'left' : 'center' })
  }
  return hRow
}

function addTaskRow(ws, task) {
  const s = STATUS_COLORS[task.status] || STATUS_COLORS.todo
  const p = PRIORITY_COLORS[task.priority]
  const names = (task.assignedToNames || []).join(', ') || '—'
  const deadline = formatDate(task.deadline) || '—'
  const checklist = Array.isArray(task.checklist) ? task.checklist.filter(c => c?.text) : []
  const checkStr = checklist.length ? `${checklist.filter(c => c.done).length}/${checklist.length}` : '—'
  const createdAt = formatDate(task.createdAt) || '—'

  const row = ws.addRow([
    task.title || '',
    TASK_STATUS_LABELS[task.status] || task.status,
    TASK_PRIORITY_LABELS[task.priority] || task.priority,
    names,
    deadline,
    checkStr,
    createdAt,
  ])
  row.height = 20

  for (let c = 1; c <= NC; c++) {
    sc(row.getCell(c), { bg: s.bg, fg: 'FF1F2937', size: 10, hAlign: c === 1 ? 'left' : 'center' })
  }
  sc(row.getCell(2), { bg: s.bg, fg: s.fg, bold: true, size: 10, hAlign: 'center' })
  if (p) sc(row.getCell(3), { bg: p.bg, fg: p.fg, bold: true, size: 10, hAlign: 'center' })
}

function buildStatusSheet(ws, statusKey, taskList, dateStr) {
  const s = STATUS_COLORS[statusKey]
  ws.columns = COLS
  banner(ws, `Tâches YFC — ${TASK_STATUS_LABELS[statusKey]}`, TEAL)
  banner(ws, `Exporté le ${dateStr}  •  ${taskList.length} tâche(s)`, TEAL_D, TEAL_DARK, 10, false)
  ws.addRow([])
  addHeaderRow(ws, s.dark)

  if (taskList.length === 0) {
    const r = ws.addRow(['Aucune tâche dans cette catégorie', ...Array(NC - 1).fill('')])
    ws.mergeCells(`A${r.number}:${LAST_COL}${r.number}`)
    sc(r.getCell(1), { bg: 'FFF9FAFB', fg: 'FF9CA3AF', hAlign: 'center' })
  } else {
    taskList.forEach(task => addTaskRow(ws, task))
  }
}

export async function exportTasks(tasks) {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'YFC'

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const active = tasks.filter(t => !t.archived)
  const byStatus = key => active.filter(t => t.status === key)

  // ── Résumé ────────────────────────────────────────────────────────────────
  const wsR = wb.addWorksheet('Résumé')
  wsR.columns = [{ width: 24 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }]

  const bannerR = (text, bg, fg = 'FFFFFFFF', size = 13, bold = true) => {
    const row = wsR.addRow([text, '', '', '', ''])
    wsR.mergeCells(`A${row.number}:E${row.number}`)
    row.height = bold ? 34 : 22
    sc(row.getCell(1), { bg, fg, bold, size, hAlign: 'center' })
  }

  bannerR('Tâches YFC — Young For Christ', TEAL)
  bannerR(`Exporté le ${dateStr}`, TEAL_D, TEAL_DARK, 10, false)
  wsR.addRow([])

  const statSection = (label, rows) => {
    const h = wsR.addRow([label, 'Tâches', '', '', ''])
    wsR.mergeCells(`C${h.number}:E${h.number}`)
    h.height = 22
    sc(h.getCell(1), { bg: 'FF374151', fg: 'FFFFFFFF', bold: true, size: 10 })
    sc(h.getCell(2), { bg: 'FF374151', fg: 'FFFFFFFF', bold: true, size: 10, hAlign: 'center' })
    rows.forEach(([lbl, count, colors]) => {
      const r = wsR.addRow([lbl, count, '', '', ''])
      wsR.mergeCells(`C${r.number}:E${r.number}`)
      r.height = 26
      sc(r.getCell(1), { bg: colors.bg, fg: colors.fg, bold: true, size: 11 })
      sc(r.getCell(2), { bg: colors.bg, fg: colors.fg, bold: true, size: 14, hAlign: 'center' })
    })
    wsR.addRow([])
  }

  statSection('Statut', [
    ['À faire',   byStatus('todo').length,        STATUS_COLORS.todo],
    ['En cours',  byStatus('in_progress').length,  STATUS_COLORS.in_progress],
    ['Terminées', byStatus('done').length,         STATUS_COLORS.done],
  ])

  statSection('Priorité', [
    ['Haute',   active.filter(t => t.priority === 'high').length,   PRIORITY_COLORS.high],
    ['Moyenne', active.filter(t => t.priority === 'medium').length, PRIORITY_COLORS.medium],
    ['Faible',  active.filter(t => t.priority === 'low').length,    PRIORITY_COLORS.low],
  ])

  const overdue = active.filter(t => getDueDateStatus(t.deadline, t.status).isOverdue).length
  const odRow = wsR.addRow(['En retard', overdue, '', '', ''])
  wsR.mergeCells(`C${odRow.number}:E${odRow.number}`)
  odRow.height = 30
  sc(odRow.getCell(1), { bg: overdue > 0 ? 'FFFEF2F2' : 'FFF0FDF4', fg: overdue > 0 ? 'FFB91C1C' : 'FF15803D', bold: true, size: 12 })
  sc(odRow.getCell(2), { bg: overdue > 0 ? 'FFFEF2F2' : 'FFF0FDF4', fg: overdue > 0 ? 'FFB91C1C' : 'FF15803D', bold: true, size: 16, hAlign: 'center' })

  // ── Feuilles par statut ───────────────────────────────────────────────────
  buildStatusSheet(wb.addWorksheet('À faire'),   'todo',        byStatus('todo'),        dateStr)
  buildStatusSheet(wb.addWorksheet('En cours'),  'in_progress', byStatus('in_progress'), dateStr)
  buildStatusSheet(wb.addWorksheet('Terminées'), 'done',        byStatus('done'),        dateStr)

  // ── Toutes ────────────────────────────────────────────────────────────────
  const wsAll = wb.addWorksheet('Toutes')
  wsAll.columns = COLS
  banner(wsAll, 'Tâches YFC — Toutes les tâches', TEAL)
  banner(wsAll, `Exporté le ${dateStr}  •  ${active.length} tâche(s)`, TEAL_D, TEAL_DARK, 10, false)
  wsAll.addRow([])
  addHeaderRow(wsAll, '  FF1F2937')

  const ORDER = { todo: 0, in_progress: 1, done: 2 }
  ;[...active].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3))
    .forEach(task => addTaskRow(wsAll, task))

  // ── Téléchargement ────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `YFC-taches-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
