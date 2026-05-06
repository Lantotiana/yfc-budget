import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, Share2, Mail, Copy, Image, Loader } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import DonationReceiptPreview from './DonationReceiptPreview'
import { getReceiptByEntryId, generateReceiptNumber, createReceipt, updateReceipt, markReceiptSent } from '../services/receiptService'

const PAYMENT_METHODS = ['Espèces', 'Mobile Money', 'Virement bancaire', 'Chèque', 'Autre']

function fmtLocalDate(str) {
  if (!str) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(str))) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR')
  }
  return new Date(str).toLocaleDateString('fr-FR')
}

export default function ReceiptModal({ tx, onClose, user, userData, currentMember }) {
  const { C } = useTheme()
  const previewRef = useRef(null)
  const [step, setStep] = useState('loading')
  const [receipt, setReceipt] = useState(null)
  const [donorName, setDonorName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Espèces')
  const [reference, setReference] = useState('')
  const [responsible, setResponsible] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    getReceiptByEntryId(tx.id)
      .then(existing => {
        if (existing) {
          setReceipt(existing)
          setStep('view')
        } else {
          setResponsible(currentMember?.nom || userData?.nom || user?.displayName || '')
          setRole(currentMember?.staffRole || '')
          setStep('form')
        }
      })
      .catch(() => {
        setResponsible(currentMember?.nom || userData?.nom || user?.displayName || '')
        setRole(currentMember?.staffRole || '')
        setStep('form')
      })
  }, [tx.id])

  function openEditForm() {
    setDonorName(receipt?.donorName || '')
    setPaymentMethod(receipt?.paymentMethod || 'Espèces')
    setReference(receipt?.reference || '')
    setResponsible(receipt?.responsible || currentMember?.nom || userData?.nom || user?.displayName || '')
    setRole(receipt?.role || currentMember?.staffRole || '')
    setStep('form')
  }

  async function handleGenerate() {
    if (!donorName.trim()) { alert('Veuillez saisir le nom du donateur.'); return }
    setSaving(true)
    try {
      if (receipt) {
        const changes = {
          donorName: donorName.trim(),
          paymentMethod,
          reference: reference.trim(),
          responsible: responsible.trim(),
          role: role.trim(),
        }
        await updateReceipt(receipt.id, changes)
        setReceipt(prev => ({ ...prev, ...changes }))
      } else {
        const receiptNumber = await generateReceiptNumber()
        const data = {
          budgetEntryId: tx.id,
          receiptNumber,
          donorName: donorName.trim(),
          paymentMethod,
          reference: reference.trim(),
          responsible: responsible.trim(),
          role: role.trim(),
          montant: tx.montant,
          motif: tx.motif,
          txDate: tx.date,
          createdBy: {
            uid: user?.uid || null,
            nom: userData?.nom || user?.displayName || '',
            email: user?.email || '',
          },
        }
        const created = await createReceipt(data)
        setReceipt(created)
      }
      setStep('view')
    } catch (e) {
      console.error(e)
      alert('Erreur lors de la sauvegarde du reçu.')
    } finally {
      setSaving(false)
    }
  }

  async function captureCanvas() {
    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(previewRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
  }

  async function doAction(key, fn) {
    setActionLoading(key)
    setFeedback('')
    try { await fn() } catch (e) { if (e?.name !== 'AbortError') console.error(e) }
    setActionLoading('')
  }

  async function downloadPDF() {
    await doAction('pdf', async () => {
      const canvas = await captureCanvas()
      const { jsPDF } = await import('jspdf')
      const imgData = canvas.toDataURL('image/png')
      const w = canvas.width / 2
      const h = canvas.height / 2
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] })
      pdf.addImage(imgData, 'PNG', 0, 0, w, h)
      pdf.save(`recu-${receipt.receiptNumber}.pdf`)
      await markReceiptSent(receipt.id, 'pdf')
    })
  }

  async function downloadImage() {
    await doAction('img', async () => {
      const canvas = await captureCanvas()
      const link = document.createElement('a')
      link.download = `recu-${receipt.receiptNumber}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      await markReceiptSent(receipt.id, 'image')
    })
  }

  async function shareReceipt() {
    await doAction('share', async () => {
      if (!navigator.share) {
        await navigator.clipboard.writeText(buildText())
        setFeedback('Copié !')
        setTimeout(() => setFeedback(''), 2500)
        return
      }
      const canvas = await captureCanvas()
      await new Promise((resolve, reject) => {
        canvas.toBlob(async blob => {
          try {
            const file = new File([blob], `recu-${receipt.receiptNumber}.png`, { type: 'image/png' })
            const shareData = { files: [file], title: `Reçu de don ${receipt.receiptNumber}` }
            if (navigator.canShare?.(shareData)) {
              await navigator.share(shareData)
            } else {
              await navigator.share({ title: `Reçu YFC`, text: buildText() })
            }
            await markReceiptSent(receipt.id, 'share')
            resolve()
          } catch (e) { reject(e) }
        })
      })
    })
  }

  function buildText() {
    const fmtAr = n => Number(n || 0).toLocaleString('fr-FR') + ' Ar'
    return [
      `📄 *Reçu de Don — Young For Christ Madagascar*`,
      `N° ${receipt.receiptNumber}`,
      ``,
      `👤 Donateur : ${receipt.donorName}`,
      `📅 Date : ${fmtLocalDate(receipt.txDate || tx.date)}`,
      `💚 Montant : *${fmtAr(receipt.montant)}*`,
      `💳 Paiement : ${receipt.paymentMethod}`,
      receipt.reference ? `🔖 Référence : ${receipt.reference}` : '',
      `📝 Motif : ${receipt.motif}`,
      ``,
      `✍️ Reçu par : ${receipt.responsible}${receipt.role ? ` (${receipt.role})` : ''}`,
    ].filter(Boolean).join('\n')
  }

  async function copyText() {
    await navigator.clipboard.writeText(buildText())
    setFeedback('Copié !')
    setTimeout(() => setFeedback(''), 2500)
    await markReceiptSent(receipt.id, 'copy').catch(() => {})
  }

  function sendEmail() {
    const subject = encodeURIComponent(`Reçu de don YFC — ${receipt.receiptNumber}`)
    const body = encodeURIComponent(buildText().replace(/\*/g, ''))
    window.open(`mailto:?subject=${subject}&body=${body}`)
    markReceiptSent(receipt.id, 'email').catch(() => {})
  }

  function actionBtn(key, icon, label, col, onClick) {
    const loading = actionLoading === key
    return (
      <button
        key={key}
        onClick={onClick}
        disabled={!!actionLoading}
        style={{
          flex: 1, padding: '10px 4px', borderRadius: 12,
          border: `1px solid ${col}28`,
          background: `${col}12`,
          color: col, cursor: actionLoading ? 'default' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
          opacity: actionLoading && !loading ? 0.45 : 1,
          transition: 'opacity 0.15s',
          minWidth: 0,
        }}
      >
        {loading
          ? <Loader size={17} style={{ animation: 'spin 0.8s linear infinite' }} />
          : icon}
        {label}
      </button>
    )
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480, maxHeight: '92dvh',
        background: C.bg, borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Reçu de don</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              {tx.motif} · {Number(tx.montant || 0).toLocaleString('fr-FR')} Ar
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: C.surf, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>

          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.t3, fontSize: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid ${C.teal}`, borderTopColor: 'transparent', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              Vérification...
            </div>
          )}

          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {receipt ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.amber, background: C.amberD, borderRadius: 10, padding: '10px 14px' }}>
                  Modification du reçu {receipt.receiptNumber}
                  <button onClick={() => setStep('view')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.amber, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
                    Annuler
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.teal, background: C.tealD, borderRadius: 10, padding: '10px 14px' }}>
                  Aucun reçu pour cette entrée. Remplissez les informations pour en générer un.
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, display: 'block', marginBottom: 6 }}>Nom du donateur *</label>
                <input
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  className="form-input"
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, display: 'block', marginBottom: 6 }}>Mode de paiement</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                >
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, display: 'block', marginBottom: 6 }}>Référence / Bordereau (optionnel)</label>
                <input
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="Ex: REF-12345"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, display: 'block', marginBottom: 6 }}>Responsable</label>
                  <input
                    value={responsible}
                    onChange={e => setResponsible(e.target.value)}
                    placeholder="Nom"
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, display: 'block', marginBottom: 6 }}>Rôle</label>
                  <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="Ex: Trésorier"
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={saving}
                className="w-full rounded-12 font-700 text-14 cursor-pointer text-white border-none"
                style={{ padding: '13px', background: 'var(--btn-primary-bg)', marginTop: 4, opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
              >
                {saving ? 'Enregistrement...' : receipt ? 'Enregistrer les modifications' : 'Générer le reçu'}
              </button>
            </div>
          )}

          {step === 'view' && receipt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Preview */}
              <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}>
                <DonationReceiptPreview ref={previewRef} receipt={receipt} tx={tx} />
              </div>

              {/* Feedback */}
              {feedback && (
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.teal }}>{feedback}</div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {actionBtn('pdf', <Download size={17} />, 'PDF', C.teal, downloadPDF)}
                {actionBtn('img', <Image size={17} />, 'Image', C.violet, downloadImage)}
                {actionBtn('share', <Share2 size={17} />, 'Partager', C.amber, shareReceipt)}
                {actionBtn('email', <Mail size={17} />, 'Email', C.coral, sendEmail)}
                {actionBtn('copy', <Copy size={17} />, 'Copier', C.t2, copyText)}
              </div>

              {/* Edit link */}
              <button
                onClick={openEditForm}
                style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: '4px 0', textAlign: 'center' }}
              >
                Modifier le reçu
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
