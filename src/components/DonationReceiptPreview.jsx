import { forwardRef } from 'react'

const DonationReceiptPreview = forwardRef(function DonationReceiptPreview({ receipt, tx }, ref) {
  const green = '#10B981'
  const darkGreen = '#059669'
  const greenBg = 'rgba(16,185,129,0.10)'
  const dark = '#1A1C2E'
  const mid = '#6B6F8A'
  const light = '#A0A4BE'
  const bg = '#FFFFFF'
  const surf = '#F9FAFB'
  const border = 'rgba(0,0,0,0.07)'

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

  const donDate = fmtDate(tx?.date || receipt?.txDate)
  const genDate = fmtDate(new Date().toISOString().slice(0, 10))
  const montant = tx?.montant ?? receipt?.montant
  const motif = tx?.motif ?? receipt?.motif

  return (
    <div ref={ref} style={{
      width: '100%',
      fontFamily: 'Arial, sans-serif',
      background: bg,
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${border}`,
    }}>
      {/* Top bar */}
      <div style={{ background: green, height: 7 }} />

      {/* Header */}
      <div style={{ padding: '18px 20px 14px', textAlign: 'center', borderBottom: `1px solid ${border}`, background: bg }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: green, margin: '0 auto 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px',
        }}>YFC</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: light, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 4 }}>
          YOUNG FOR CHRIST — MADAGASCAR
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Reçu de Don</div>
        <div style={{
          display: 'inline-block', marginTop: 6, padding: '3px 12px',
          borderRadius: 20, background: greenBg,
          fontSize: 11, fontWeight: 700, color: darkGreen,
        }}>
          {receipt?.receiptNumber || '—'}
        </div>
      </div>

      {/* Donor / Date */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
        <div style={{ flex: 1, padding: '12px 16px', borderRight: `1px solid ${border}`, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>Donateur</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {receipt?.donorName || '—'}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>Date du don</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>{donDate}</div>
        </div>
      </div>

      {/* Amount */}
      <div style={{ background: greenBg, padding: '18px 20px', textAlign: 'center', borderBottom: `1px solid rgba(16,185,129,0.15)` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: darkGreen, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 8 }}>
          Montant du don
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: green, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {fmtAmount(montant)}
        </div>
      </div>

      {/* Payment / Reference */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
        <div style={{ flex: 1, padding: '12px 16px', borderRight: `1px solid ${border}`, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>Mode de paiement</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: dark }}>{receipt?.paymentMethod || '—'}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>Référence</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: dark }}>{receipt?.reference || '—'}</div>
        </div>
      </div>

      {/* Motif */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>Objet du don</div>
        <div style={{ fontSize: 12, color: dark }}>{motif || '—'}</div>
      </div>

      {/* Attestation */}
      <div style={{ background: surf, padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{
          fontSize: 10, color: mid, fontStyle: 'italic', lineHeight: 1.6,
          borderLeft: `3px solid ${green}`, paddingLeft: 10,
        }}>
          Nous certifions avoir bien reçu la somme indiquée ci-dessus à titre de don pour les activités de l'association Young For Christ — Madagascar.
        </div>
      </div>

      {/* Responsible */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>Responsable</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: dark }}>{receipt?.responsible || '—'}</div>
        {receipt?.role && <div style={{ fontSize: 11, color: mid, marginTop: 2 }}>{receipt.role}</div>}
      </div>

      {/* Footer */}
      <div style={{ padding: '9px 20px', background: surf, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: light }}>Généré le {genDate}</div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: green, height: 5 }} />
    </div>
  )
})

export default DonationReceiptPreview
