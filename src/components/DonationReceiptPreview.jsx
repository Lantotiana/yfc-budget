import { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import logoYfc from '../assets/logo_yfc.png'

const ONES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf']

function belowHundred(n) {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10), u = n % 10
  if (t === 7) return u === 1 ? 'soixante-et-onze' : 'soixante-' + ONES[10 + u]
  if (t === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + ONES[u]
  if (t === 9) return 'quatre-vingt-' + ONES[10 + u]
  const base = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'][t]
  if (u === 0) return base
  if (u === 1) return base + '-et-un'
  return base + '-' + ONES[u]
}

function belowThousand(n) {
  if (n < 100) return belowHundred(n)
  const h = Math.floor(n / 100), rest = n % 100
  if (h === 1) return rest === 0 ? 'cent' : 'cent ' + belowHundred(rest)
  return ONES[h] + ' cent' + (rest === 0 ? 's' : ' ' + belowHundred(rest))
}

function toFrenchWords(n) {
  n = Math.floor(Math.abs(n || 0))
  if (n === 0) return 'zéro'
  const parts = []
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000)
    parts.push(m === 1 ? 'un million' : belowThousand(m) + ' millions')
    n %= 1000000
  }
  if (n >= 1000) {
    const k = Math.floor(n / 1000)
    parts.push(k === 1 ? 'mille' : belowThousand(k) + ' mille')
    n %= 1000
  }
  if (n > 0) parts.push(belowThousand(n))
  return parts.join(' ')
}

const DonationReceiptPreview = forwardRef(function DonationReceiptPreview({ receipt, tx }, ref) {
  const blue = '#0CC0DF'
  const orange = '#FFBD59'
  const dark = '#1A1C2E'
  const mid = '#6B6F8A'
  const light = '#A0A4BE'
  const bg = '#FFFFFF'
  const surf = '#F9FAFB'
  const grayBg = '#F3F4F6'
  const border = 'rgba(0,0,0,0.07)'
  const borderStrong = 'rgba(0,0,0,0.10)'

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

  const words = toFrenchWords(montant)
  const wordsCapital = words.charAt(0).toUpperCase() + words.slice(1)

  const qrValue = receipt?.receiptNumber
    ? `https://yfc-budget.vercel.app/verify/${receipt.receiptNumber}`
    : 'https://yfc-budget.vercel.app'

  return (
    <div ref={ref} style={{
      width: '100%',
      fontFamily: 'Arial, sans-serif',
      background: bg,
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${borderStrong}`,
      position: 'relative',
    }}>

      {/* Watermark */}
      <img
        src={logoYfc}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 240, height: 240,
          objectFit: 'contain',
          opacity: 0.10,
          filter: 'grayscale(1)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Top bar */}
      <div style={{ background: blue, height: 7 }} />

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', textAlign: 'center', borderBottom: `1px solid ${border}`, background: bg }}>
        <img
          src={logoYfc}
          alt="YFC"
          style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 10px', display: 'block' }}
        />
        <div style={{ fontSize: 9, fontWeight: 700, color: light, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 5 }}>
          YOUNG FOR CHRIST ITAOSY
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: dark, letterSpacing: '-0.3px' }}>Reçu de Don</div>
        <div style={{
          display: 'inline-block', marginTop: 8, padding: '4px 14px',
          borderRadius: 20, background: orange,
          fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.5px',
        }}>
          {receipt?.receiptNumber || '—'}
        </div>
      </div>

      {/* Donor / Date */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
        <div style={{ flex: 2, padding: '14px 16px', borderRight: `1px solid ${border}`, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 5 }}>Donateur</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {receipt?.donorName || '—'}
          </div>
        </div>
        <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 5 }}>Date du don</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: dark }}>{donDate}</div>
        </div>
      </div>

      {/* Amount block */}
      <div style={{ background: grayBg, padding: '20px 20px 16px', textAlign: 'center', borderBottom: `1px solid ${borderStrong}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: mid, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 10 }}>
          Montant du don
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: dark, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {fmtAmount(montant)}
        </div>
        <div style={{ borderTop: `1px dashed rgba(0,0,0,0.10)`, margin: '12px 20px 0' }} />
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, color: light, fontStyle: 'italic', marginBottom: 4 }}>
            Arrêté le présent reçu à la somme de :
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: dark }}>
            {wordsCapital} Ariary
          </div>
        </div>
      </div>

      {/* Payment */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 5 }}>Mode de paiement</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: dark }}>{receipt?.paymentMethod || '—'}</div>
      </div>

      {/* Motif */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 5 }}>Objet du don</div>
        <div style={{ fontSize: 12, color: dark }}>{motif || '—'}</div>
      </div>

      {/* Attestation */}
      <div style={{ background: surf, padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{
          fontSize: 12, color: mid, fontStyle: 'italic', lineHeight: 1.65,
          borderLeft: `3px solid ${blue}`, paddingLeft: 10,
        }}>
          Nous certifions avoir bien reçu la somme indiquée ci-dessus à titre de don pour les activités de l'association Young For Christ Itaosy.
        </div>
      </div>

      {/* Responsible */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, textAlign: 'right' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: light, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 5 }}>Responsable</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: dark }}>{receipt?.responsible || '—'}</div>
        {receipt?.role && <div style={{ fontSize: 11, color: mid, marginTop: 2 }}>{receipt.role}</div>}
      </div>

      {/* Footer with QR code */}
      <div style={{ background: surf, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: light, marginBottom: 2 }}>Généré le {genDate}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: mid, marginTop: 4 }}>Young For Christ Itaosy</div>
          <div style={{ fontSize: 8, color: light, marginTop: 1 }}>Généré via YFC Management System</div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <QRCodeSVG
            value={qrValue}
            size={60}
            level="M"
            bgColor="transparent"
            fgColor={dark}
            style={{ display: 'block' }}
          />
          <div style={{ fontSize: 8, color: light, marginTop: 4, letterSpacing: '0.5px' }}>AUTHENTIFICATION</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: blue, height: 5 }} />
    </div>
  )
})

export default DonationReceiptPreview
