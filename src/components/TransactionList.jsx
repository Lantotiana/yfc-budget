import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../context/ThemeContext'
import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { Search, X, Download, Share2, FileText } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { createNotification } from '../notifications'
import ReceiptModal from './ReceiptModal'

const DEFAULT_MOTIFS = {
  entree: ['Don membres', 'Quête vendredi', 'Don extérieur', 'Cotisation', 'Dons', 'Autre'],
  depense: ['Sortie prédication', 'Transport', 'Matériel', 'Impression', 'Restauration', 'Autre']
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const PAGE_SIZE = 10

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function fuzzyMatch(text, query) {
  const t = normalize(text)
  const q = normalize(query)
  if (!q) return true
  if (t.includes(q)) return true
  const words = q.split(/\s+/).filter(Boolean)
  return words.every(w => t.includes(w) || t.includes(w.slice(0, Math.max(3, w.length - 1))))
}

export default function TransactionList({
  transactions, months, filterMonth, filterType,
  onFilterMonth, onFilterType, onDelete, allTransactions = [], canManageBudget = true, onShared,
  user, userData, currentMember
}) {
  const { C } = useTheme()
  const [selected, setSelected] = useState(null)
  const [receiptTx, setReceiptTx] = useState(null)
  const [editType, setEditType] = useState('entree')
  const [editDate, setEditDate] = useState('')
  const [editMontant, setEditMontant] = useState('')
  const [editMotif, setEditMotif] = useState('')
  const [editMotifCustom, setEditMotifCustom] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shareFeedback, setShareFeedback] = useState('')

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [hasInit, setHasInit] = useState(false)

  useEffect(() => {
    if (!hasInit && months.length > 0) {
      if (months.includes(currentMonth)) {
        onFilterMonth(currentMonth)
      }
      setHasInit(true)
    }
  }, [months, hasInit])

  useEffect(() => {
    setPage(1)
  }, [filterMonth, filterType, search])

  const searched = useMemo(() => {
    if (!search.trim()) return transactions
    return transactions.filter(tx =>
      fuzzyMatch(tx.motif, search) ||
      fuzzyMatch(tx.note, search) ||
      fuzzyMatch(tx.date, search) ||
      fuzzyMatch(tx.createdBy?.nom, search) ||
      fuzzyMatch(tx.createdBy?.email, search)
    )
  }, [transactions, search])

  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE))
  const paginated = searched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openEdit(tx) {
    setSelected(tx)
    setEditType(tx.type)
    setEditDate(tx.date)
    setEditMontant(String(tx.montant))
    setEditNote(tx.note || '')
    if (DEFAULT_MOTIFS[tx.type].includes(tx.motif)) {
      setEditMotif(tx.motif)
      setEditMotifCustom('')
    } else {
      setEditMotif('Autre')
      setEditMotifCustom(tx.motif)
    }
  }

  function closeEdit() {
    setSelected(null)
    setEditMotifCustom('')
  }

  function handleChangeType(t) {
    if (!canManageBudget) return
    setEditType(t)
    setEditMotif(DEFAULT_MOTIFS[t][0])
    setEditMotifCustom('')
  }

  async function handleSave() {
    if (!canManageBudget) return
    const motifFinal = editMotif === 'Autre' ? editMotifCustom.trim() : editMotif
    if (!editDate || !editMontant || isNaN(editMontant) || Number(editMontant) <= 0) {
      alert('Veuillez remplir la date et le montant.')
      return
    }
    if (editMotif === 'Autre' && !motifFinal) {
      alert('Veuillez préciser le motif.')
      return
    }
    setSaving(true)
    await updateDoc(doc(db, 'transactions', selected.id), {
      type: editType,
      date: editDate,
      montant: Number(editMontant),
      motif: motifFinal,
      note: editNote
    })
    await createNotification({
      type: 'budget',
      titre: 'Transaction modifiée',
      detail: `${motifFinal} - ${fmt(editMontant)}`,
      cible: motifFinal,
      route: '/budget',
    })
    setSaving(false)
    closeEdit()
  }

  async function handleDelete() {
    if (!canManageBudget) return
    if (window.confirm('Supprimer cette transaction ?')) {
      await deleteDoc(doc(db, 'transactions', selected.id))
      await createNotification({
        type: 'budget',
        titre: 'Transaction supprimée',
        detail: `${selected.motif} - ${fmt(selected.montant)}`,
        cible: selected.motif,
        route: '/budget',
      })
      closeEdit()
    }
  }

  async function exportToExcel() {
    if (!searched.length) return

    const ExcelJS = await import('exceljs')
    const entrees  = searched.filter(t => t.type === 'entree')
    const depenses = searched.filter(t => t.type === 'depense')
    const totalEntrees  = entrees.reduce((s, t)  => s + Number(t.montant || 0), 0)
    const totalDepenses = depenses.reduce((s, t) => s + Number(t.montant || 0), 0)
    const solde = totalEntrees - totalDepenses

    const periodLabel = filterMonth
      ? `${MONTHS[parseInt(filterMonth.split('-')[1]) - 1]} ${filterMonth.split('-')[0]}`
      : 'Toutes périodes'
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'YFC Budget'
    const NC = 5
    const COLS = [{ width: 14 }, { width: 26 }, { width: 32 }, { width: 22 }, { width: 20 }]

    function sc(cell, { bg, fg = 'FFFFFFFF', bold = false, size = 11, hAlign = 'left', numFmt = null } = {}) {
      if (bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.font = { bold, size, color: { argb: fg } }
      cell.alignment = { vertical: 'middle', horizontal: hAlign }
      if (numFmt) cell.numFmt = numFmt
    }

    function buildSheet(ws, rows, { headerBg, headerDark, dataBg, totalBg, label }) {
      ws.columns = COLS
      const addBanner = (text, bg, fg = 'FFFFFFFF', size = 13, bold = true) => {
        const row = ws.addRow([text, '', '', '', ''])
        ws.mergeCells(`A${row.number}:E${row.number}`)
        row.height = bold ? 30 : 22
        sc(row.getCell(1), { bg, fg, bold, size, hAlign: 'center' })
      }
      addBanner(`Budget YFC — ${label}`, 'FF5B4FCF', 'FFFFFFFF', 14)
      addBanner(`Exporté le ${dateStr}  •  ${periodLabel}`, 'FFE8E4FB', 'FF4338CA', 10, false)
      ws.addRow([])

      const hRow = ws.addRow(['Date', 'Motif', 'Note', 'Ajouté par', 'Montant (Ar)'])
      hRow.height = 20
      for (let c = 1; c <= NC; c++)
        sc(hRow.getCell(c), { bg: headerDark, bold: true, size: 10, hAlign: c === NC ? 'right' : 'left' })

      if (rows.length === 0) {
        const r = ws.addRow([`Aucune ${label.toLowerCase()}`, '', '', '', ''])
        ws.mergeCells(`A${r.number}:E${r.number}`)
        sc(r.getCell(1), { bg: 'FFFAFAFA', fg: 'FF9CA3AF', hAlign: 'center' })
      }
      rows.forEach(tx => {
        const row = ws.addRow([toDisplayDate(tx.date), tx.motif || '', tx.note || '', tx.createdBy?.nom || '—', Number(tx.montant || 0)])
        row.height = 19
        for (let c = 1; c <= NC; c++)
          sc(row.getCell(c), { bg: dataBg, fg: 'FF1F2937', size: 10, hAlign: c === NC ? 'right' : 'left', numFmt: c === NC ? '#,##0' : null })
      })

      const total = rows.reduce((s, t) => s + Number(t.montant || 0), 0)
      const tRow = ws.addRow([`TOTAL ${label.toUpperCase()}`, '', '', '', total])
      ws.mergeCells(`A${tRow.number}:D${tRow.number}`)
      tRow.height = 26
      sc(tRow.getCell(1), { bg: totalBg, bold: true, size: 12, hAlign: 'right' })
      for (let c = 2; c <= 4; c++) tRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalBg } }
      sc(tRow.getCell(5), { bg: totalBg, bold: true, size: 12, hAlign: 'right', numFmt: '#,##0' })
    }

    // Onglet Résumé
    const wsResume = wb.addWorksheet('Résumé')
    wsResume.columns = COLS
    const addResumeBanner = (text, bg, fg = 'FFFFFFFF', size = 13, bold = true) => {
      const row = wsResume.addRow([text, '', '', '', ''])
      wsResume.mergeCells(`A${row.number}:E${row.number}`)
      row.height = bold ? 30 : 22
      sc(row.getCell(1), { bg, fg, bold, size, hAlign: 'center' })
    }
    addResumeBanner('Budget YFC — Young For Christ', 'FF5B4FCF', 'FFFFFFFF', 14)
    addResumeBanner(`Exporté le ${dateStr}  •  ${periodLabel}`, 'FFE8E4FB', 'FF4338CA', 10, false)
    wsResume.addRow([])
    const resumeRows = [
      ['ENTRÉES', entrees.length, totalEntrees],
      ['DÉPENSES', depenses.length, totalDepenses],
    ]
    const rHeader = wsResume.addRow(['', 'Nombre', 'Montant (Ar)'])
    rHeader.height = 20
    sc(rHeader.getCell(2), { bg: 'FF374151', bold: true, size: 10, hAlign: 'center' })
    sc(rHeader.getCell(3), { bg: 'FF374151', bold: true, size: 10, hAlign: 'right' })
    resumeRows.forEach(([lbl, nb, mt]) => {
      const isE = lbl === 'ENTRÉES'
      const bg = isE ? 'FFF0FDF4' : 'FFFEF2F2'
      const fg = isE ? 'FF15803D' : 'FFB91C1C'
      const r = wsResume.addRow([lbl, nb, mt])
      r.height = 24
      sc(r.getCell(1), { bg, fg, bold: true, size: 11 })
      sc(r.getCell(2), { bg, fg: 'FF1F2937', size: 11, hAlign: 'center' })
      sc(r.getCell(3), { bg, fg: 'FF1F2937', size: 11, hAlign: 'right', numFmt: '#,##0' })
    })
    wsResume.addRow([])
    const soldeBg = solde >= 0 ? 'FF0D9370' : 'FFD63B5E'
    const soldeRow = wsResume.addRow(['SOLDE', '', solde])
    wsResume.mergeCells(`A${soldeRow.number}:B${soldeRow.number}`)
    soldeRow.height = 34
    sc(soldeRow.getCell(1), { bg: soldeBg, bold: true, size: 14, hAlign: 'right' })
    soldeRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: soldeBg } }
    sc(soldeRow.getCell(3), { bg: soldeBg, bold: true, size: 14, hAlign: 'right', numFmt: '#,##0' })

    // Onglet Entrées
    buildSheet(wb.addWorksheet('Entrées'), entrees, {
      headerDark: 'FF166534', dataBg: 'FFF0FDF4', totalBg: 'FF15803D', label: 'Entrées',
    })

    // Onglet Dépenses
    buildSheet(wb.addWorksheet('Dépenses'), depenses, {
      headerDark: 'FF991B1B', dataBg: 'FFFEF2F2', totalBg: 'FFB91C1C', label: 'Dépenses',
    })

    // Onglet Tout
    const wsAll = wb.addWorksheet('Tout')
    wsAll.columns = COLS
    const addAllBanner = (text, bg, fg = 'FFFFFFFF', size = 13, bold = true) => {
      const row = wsAll.addRow([text, '', '', '', ''])
      wsAll.mergeCells(`A${row.number}:E${row.number}`)
      row.height = bold ? 30 : 22
      sc(row.getCell(1), { bg, fg, bold, size, hAlign: 'center' })
    }
    addAllBanner('Budget YFC — Toutes les transactions', 'FF5B4FCF', 'FFFFFFFF', 14)
    addAllBanner(`Exporté le ${dateStr}  •  ${periodLabel}`, 'FFE8E4FB', 'FF4338CA', 10, false)
    wsAll.addRow([])
    const allHRow = wsAll.addRow(['Date', 'Type', 'Motif', 'Note', 'Ajouté par', 'Montant (Ar)'])
    allHRow.height = 20
    wsAll.columns = [{ width: 14 }, { width: 12 }, { width: 26 }, { width: 28 }, { width: 22 }, { width: 20 }]
    ;[1,2,3,4,5,6].forEach(c => sc(allHRow.getCell(c), { bg: 'FF374151', bold: true, size: 10, hAlign: c === 6 ? 'right' : 'left' }))
    searched.forEach(tx => {
      const isE = tx.type === 'entree'
      const bg = isE ? 'FFF0FDF4' : 'FFFEF2F2'
      const typeLabel = isE ? 'Entrée' : 'Dépense'
      const row = wsAll.addRow([toDisplayDate(tx.date), typeLabel, tx.motif || '', tx.note || '', tx.createdBy?.nom || '—', Number(tx.montant || 0)])
      row.height = 19
      ;[1,2,3,4,5].forEach(c => sc(row.getCell(c), { bg, fg: 'FF1F2937', size: 10 }))
      sc(row.getCell(6), { bg, fg: isE ? 'FF15803D' : 'FFB91C1C', bold: true, size: 10, hAlign: 'right', numFmt: '#,##0' })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `YFC-budget-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function shareReport() {
    const base = filterMonth
      ? allTransactions.filter(t => t.date?.startsWith(filterMonth))
      : allTransactions
    const entrees  = base.filter(t => t.type === 'entree')
    const depenses = base.filter(t => t.type === 'depense')
    const totalEntrees  = entrees.reduce((s, t)  => s + Number(t.montant || 0), 0)
    const totalDepenses = depenses.reduce((s, t) => s + Number(t.montant || 0), 0)
    const solde = totalEntrees - totalDepenses

    let soldePrecedent = null
    if (filterMonth) {
      const prev = allTransactions.filter(t => t.date && t.date.slice(0, 7) < filterMonth)
      const prevE = prev.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
      const prevD = prev.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
      soldePrecedent = prevE - prevD
    }

    const periodLabel = filterMonth
      ? `${MONTHS[parseInt(filterMonth.split('-')[1]) - 1]} ${filterMonth.split('-')[0]}`
      : 'toutes périodes'

    const fmtAr = n => Number(n).toLocaleString('fr-FR') + ' Ar'

    let prevMonthLabel = null
    if (filterMonth) {
      const [y, mo] = filterMonth.split('-').map(Number)
      prevMonthLabel = new Date(y, mo - 2).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }

    const allE = allTransactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
    const allD = allTransactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
    const soldeActuel = allE - allD

    const lines = [
      `📊 *Rapport Budget YFC*`,
      `🗓️ Mois de ${periodLabel}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💚 *ENTRÉES* (${entrees.length})`,
      ...entrees.map(t => `  • ${t.motif} — ${fmtAr(t.montant)}`),
      entrees.length === 0 ? '  Aucune entrée' : '',
      `📥 *Total entrées : ${fmtAr(totalEntrees)}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔴 *DÉPENSES* (${depenses.length})`,
      ...depenses.map(t => `  • ${t.motif} — ${fmtAr(t.montant)}`),
      depenses.length === 0 ? '  Aucune dépense' : '',
      `📤 *Total dépenses : ${fmtAr(totalDepenses)}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ...(soldePrecedent !== null ? [
        `🏦 Solde fin ${prevMonthLabel} : ${soldePrecedent < 0 ? '−' : ''}${fmtAr(Math.abs(soldePrecedent))}`,
        `📊 Solde ${periodLabel} : ${solde >= 0 ? '+' : '−'}${fmtAr(Math.abs(solde))}`,
        `🏦 *Solde fin ${periodLabel} : ${(soldePrecedent + solde) < 0 ? '−' : ''}${fmtAr(Math.abs(soldePrecedent + solde))}*`,
      ] : [
        `📊 Solde ${periodLabel} : ${solde >= 0 ? '+' : '−'}${fmtAr(Math.abs(solde))}`,
      ]),
      `${soldeActuel >= 0 ? '✅' : '⚠️'} *Solde actuel : ${soldeActuel < 0 ? '−' : ''}${fmtAr(Math.abs(soldeActuel))}*`,
    ].filter(l => l !== undefined)

    const text = lines.join('\n')

    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setShareFeedback('Copié !')
        setTimeout(() => setShareFeedback(''), 2500)
      }
      onShared?.({
        totalEntrees, totalDepenses, solde, filterMonth, soldePrecedent, soldeActuel,
        entrees: entrees.map(t => ({ motif: t.motif, montant: Number(t.montant || 0), date: t.date })),
        depenses: depenses.map(t => ({ motif: t.motif, montant: Number(t.montant || 0), date: t.date })),
      })
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share error:', err)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Historique</div>

        <div className="tx-search-wrapper">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (motif, note, date, utilisateur)..."
            className="tx-search-input"
            style={{paddingLeft: '38px', paddingRight: search ? '38px' : '12px'}}
          />
          <div className="tx-search-icon"><Search size={14} /></div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="tx-search-clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-row">
          <select value={filterMonth} onChange={e => onFilterMonth(e.target.value)}>
            <option value="">Tous les mois</option>
            {months.map(m => {
              const [y, mo] = m.split('-')
              return <option key={m} value={m}>{MONTHS[parseInt(mo)-1]} {y}</option>
            })}
          </select>
          <select value={filterType} onChange={e => onFilterType(e.target.value)}>
            <option value="">Tous</option>
            <option value="entree">Entrées</option>
            <option value="depense">Dépenses</option>
          </select>
          <button className="btn-export" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={shareReport}>
            <Share2 size={14} /> {shareFeedback || 'Partager'}
          </button>
          <button className="btn-export budget-export-primary" onClick={exportToExcel}>
            <Download size={14} /> Exporter Excel
          </button>
        </div>

        <div className="tx-count">
          {searched.length} transaction{searched.length > 1 ? 's' : ''}
          {searched.length > PAGE_SIZE && ` · Page ${page}/${totalPages}`}
        </div>

        {paginated.length === 0 && <div className="empty">Aucune transaction</div>}

        {paginated.map(tx => (
          <div key={tx.id} className="tx-item cursor-pointer" onClick={() => openEdit(tx)}>
            <div className={`tx-icon ${tx.type}`}>{tx.type === 'entree' ? '+' : '−'}</div>
            <div className="tx-info">
              <div className="tx-motif">{tx.motif}</div>
              <div className="tx-date">{toDisplayDate(tx.date)}{tx.note ? ' · ' + tx.note : ''}</div>
              {tx.createdBy && (
                <div className="tx-user">
                  {tx.createdBy.photoURL ? (
                    <img src={tx.createdBy.photoURL} alt="" className="tx-user-avatar" />
                  ) : (
                    <div className="tx-user-avatar-fallback">
                      {(tx.createdBy.nom || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{tx.createdBy.nom}</span>
                </div>
              )}
            </div>
            <div className={`tx-amount ${tx.type}`}>
              {tx.type === 'depense' ? '−' : '+'}{fmt(tx.montant)}
            </div>
            {tx.type === 'entree' && normalize(tx.motif || '').includes('don') && (
              <button
                className="tx-receipt-btn"
                title="Reçu de don"
                onClick={e => { e.stopPropagation(); setReceiptTx(tx) }}
              >
                <FileText size={13} />
              </button>
            )}
          </div>
        ))}

        {searched.length > PAGE_SIZE && (
          <div className="flex-center gap-8" style={{marginTop:'14px', paddingTop:'14px', borderTop:'0.5px solid var(--border-input)'}}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-12 font-600 rounded-10 border-none bg-secondary cursor-pointer"
              style={{ padding:'8px 14px', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === 1 ? 0.5 : 1 }}
            >
              ← Précédent
            </button>
            <div className="text-12 text-secondary font-600 px-12">
              {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-12 font-600 rounded-10 border-none bg-secondary cursor-pointer"
              style={{ padding:'8px 14px', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === totalPages ? 0.5 : 1 }}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {receiptTx && (
        <ReceiptModal
          tx={receiptTx}
          onClose={() => setReceiptTx(null)}
          user={user}
          userData={userData}
          currentMember={currentMember}
        />
      )}

      {selected && createPortal(
        <div className="modal-overlay">
          <div className="modal">

            <div className="dialog-header">
              <h3 className="dialog-title">Modifier la transaction</h3>
              <button onClick={closeEdit} className="dialog-close-btn"><X size={18} /></button>
            </div>
            {!canManageBudget && (
              <div className="budget-readonly-note">
                Lecture seule : seuls les Présidents, Vice-présidents et Trésoriers peuvent modifier le budget.
              </div>
            )}

            {selected.createdBy && (
              <div className="flex-center gap-10 p-12 rounded-12 mb-14" style={{background:'var(--surface-alt)'}}>
                {selected.createdBy.photoURL ? (
                  <img
                    src={selected.createdBy.photoURL}
                    alt=""
                    className="w-32-h-32 rounded-50 object-cover flex-shrink-0"
                    style={{border:`2px solid ${C.teal}`}}
                  />
                ) : (
                  <div className="w-32-h-32 rounded-50 flex-center flex-shrink-0 font-700 text-13" style={{background:C.tealD, color:C.teal}}>
                    {(selected.createdBy.nom || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1-min">
                  <div className="text-10 text-secondary font-600 mb-2" style={{textTransform:'uppercase', letterSpacing:'.05em'}}>Ajouté par</div>
                  <div className="text-13 font-700 text-primary text-ellipsis">
                    {selected.createdBy.nom}
                  </div>
                  {selected.createdBy.email && selected.createdBy.email !== selected.createdBy.nom && (
                    <div className="text-10 text-secondary text-ellipsis">
                      {selected.createdBy.email}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="type-toggle mb-14">
              <button onClick={() => handleChangeType('entree')} disabled={!canManageBudget} className="type-btn" style={{background: editType==='entree' ? C.tealD : 'transparent', color: editType==='entree' ? C.teal : C.t2}}>
                + Entrée
              </button>
              <button onClick={() => handleChangeType('depense')} disabled={!canManageBudget} className="type-btn" style={{background: editType==='depense' ? C.coralD : 'transparent', color: editType==='depense' ? C.coral : C.t2}}>
                − Dépense
              </button>
            </div>

            <div className="form-row gap-10 mb-10">
              <div>
                <label className="form-label">Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="form-input" disabled={!canManageBudget} />
              </div>
              <div>
                <label className="form-label">Montant (Ar)</label>
                <input type="number" value={editMontant} onChange={e => setEditMontant(e.target.value)} min="0" className="form-input" disabled={!canManageBudget} />
              </div>
            </div>

            <div className="mb-10">
              <label className="form-label">Motif</label>
              <select value={editMotif} onChange={e => { setEditMotif(e.target.value); if (e.target.value !== 'Autre') setEditMotifCustom('') }} className="form-input" disabled={!canManageBudget}>
                {DEFAULT_MOTIFS[editType].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {editMotif === 'Autre' && (
              <div className="mb-10">
                <label className="form-label">Précisez le motif</label>
                <input
                  type="text"
                  value={editMotifCustom}
                  onChange={e => setEditMotifCustom(e.target.value)}
                  placeholder="Ex: Achat matériel évangélisation..."
                  className="form-input"
                  autoFocus
                  disabled={!canManageBudget}
                />
              </div>
            )}

            <div className="mb-16">
              <label className="form-label">Note (optionnel)</label>
              <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Détail..." className="form-input" disabled={!canManageBudget} />
            </div>

            <button onClick={handleSave} disabled={saving || !canManageBudget} className="w-full rounded-12 font-700 text-14 cursor-pointer text-white border-none mb-8" style={{padding:'12px', background:'var(--btn-primary-bg)', opacity: saving || !canManageBudget ? 0.45 : 1}}>
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>

            <button onClick={handleDelete} disabled={!canManageBudget} className="btn-danger w-full" style={{padding:'12px', fontSize:'14px', fontWeight:'700', opacity: !canManageBudget ? 0.45 : 1}}>
              Supprimer la transaction
            </button>
          </div>
        </div>
      , document.body)}
    </>
  )
}
