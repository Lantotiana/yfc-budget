import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { getReceiptByNumber } from '../services/receiptService'
import logoYfc from '../assets/logo_yfc.png'

function fmtDate(str) {
  if (!str) return '—'
  const s = String(str)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtAmount(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ fontSize: 12, color: '#6B6F8A', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1A1C2E', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function VerifyReceipt() {
  const { receiptNumber } = useParams()
  const [status, setStatus] = useState('loading') // loading | found | notfound | error
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    if (!receiptNumber) { setStatus('notfound'); return }
    getReceiptByNumber(receiptNumber)
      .then(r => {
        if (r) { setReceipt(r); setStatus('found') }
        else setStatus('notfound')
      })
      .catch(() => setStatus('error'))
  }, [receiptNumber])

  return (
    <div style={{
      minHeight: '100dvh', background: '#F4F5FB',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 20px 48px', fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <img src={logoYfc} alt="YFC" style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A0A4BE', letterSpacing: '2px', textTransform: 'uppercase' }}>
          YOUNG FOR CHRIST ITAOSY
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1C2E', marginTop: 4 }}>
          Vérification de reçu
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6B6F8A' }}>
            <Loader size={32} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            Vérification en cours...
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ background: '#FFF', borderRadius: 18, padding: '28px 24px', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <XCircle size={40} color="#E05555" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1C2E', marginBottom: 6 }}>Erreur de vérification</div>
            <div style={{ fontSize: 13, color: '#6B6F8A' }}>Impossible de contacter la base de données. Réessayez plus tard.</div>
          </div>
        )}

        {/* Not found */}
        {status === 'notfound' && (
          <div style={{ background: '#FFF', borderRadius: 18, padding: '28px 24px', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <XCircle size={40} color="#E05555" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1C2E', marginBottom: 6 }}>Reçu introuvable</div>
            <div style={{ fontSize: 13, color: '#6B6F8A' }}>
              Le reçu <strong>{receiptNumber}</strong> n'existe pas dans notre système ou a été supprimé.
            </div>
          </div>
        )}

        {/* Found */}
        {status === 'found' && receipt && (
          <div style={{ background: '#FFF', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            {/* Authentic badge */}
            <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', padding: '20px 24px', textAlign: 'center' }}>
              <CheckCircle size={36} color="#fff" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>REÇU AUTHENTIQUE</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', marginTop: 4 }}>
                Ce document est enregistré dans le système YFC
              </div>
            </div>

            {/* Receipt number */}
            <div style={{ background: '#FFFBF0', padding: '12px 24px', textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, color: '#A0A4BE', marginBottom: 3 }}>Numéro de reçu</div>
              <div style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: 20,
                background: '#FFBD59', fontSize: 13, fontWeight: 700, color: '#fff',
              }}>
                {receipt.receiptNumber}
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '4px 24px 16px' }}>
              <Row label="Donateur"        value={receipt.donorName} />
              <Row label="Date du don"     value={fmtDate(receipt.txDate)} />
              <Row label="Montant"         value={fmtAmount(receipt.montant)} />
              <Row label="Mode paiement"   value={receipt.paymentMethod} />
              <Row label="Objet"           value={receipt.note || receipt.objetDon || '—'} />
              <Row label="Responsable"     value={`${receipt.responsible}${receipt.role ? ` — ${receipt.role}` : ''}`} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingTop: 11 }}>
                <span style={{ fontSize: 12, color: '#6B6F8A', fontWeight: 500 }}>Émis le</span>
                <span style={{ fontSize: 13, color: '#1A1C2E', fontWeight: 700 }}>{fmtDate(receipt.createdAt?.slice?.(0, 10) || receipt.createdAt)}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ background: '#F9FAFB', padding: '12px 24px', textAlign: 'center', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 10, color: '#A0A4BE' }}>Young For Christ Itaosy · YFC Management System</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
