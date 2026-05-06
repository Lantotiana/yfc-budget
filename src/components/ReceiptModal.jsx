import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, Share2, Mail, Copy, Image, Loader } from 'lucide-react'
import emailjs from '@emailjs/browser'
import logoYfcAsset from '../assets/logo_yfc.png'
import { useTheme } from '../context/ThemeContext'
import DonationReceiptPreview from './DonationReceiptPreview'
import { getReceiptByEntryId, generateReceiptNumber, createReceipt, updateReceipt, markReceiptSent } from '../services/receiptService'

const EMAILJS_SERVICE_ID   = 'service_q55ivrp'
const EMAILJS_PUBLIC_KEY   = 'DBkP2rCi6WMgXW9kq'
const EMAILJS_TEMPLATE_ID  = 'template_pjghhy9' // à créer dans EmailJS dashboard

const PAYMENT_METHODS = ['Espèces', 'Mobile Money', 'Virement bancaire', 'Chèque', 'Autre']

/* ── helpers ── */
function fmtDate(str) {
  if (!str) return '—'
  const s = String(str)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtLocalDate(str) {
  if (!str) return '—'
  const s = String(str)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR')
  }
  return new Date(s).toLocaleDateString('fr-FR')
}

const _ONES = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
  'dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf']
function _b100(n) {
  if (n < 20) return _ONES[n]
  const t = Math.floor(n/10), u = n%10
  if (t===7) return u===1?'soixante-et-onze':'soixante-'+_ONES[10+u]
  if (t===8) return u===0?'quatre-vingts':'quatre-vingt-'+_ONES[u]
  if (t===9) return 'quatre-vingt-'+_ONES[10+u]
  const b=['','','vingt','trente','quarante','cinquante','soixante'][t]
  if (u===0) return b; if (u===1) return b+'-et-un'; return b+'-'+_ONES[u]
}
function _b1000(n) {
  if (n<100) return _b100(n)
  const h=Math.floor(n/100), r=n%100
  if (h===1) return r===0?'cent':'cent '+_b100(r)
  return _ONES[h]+' cent'+(r===0?'s':' '+_b100(r))
}
function toWords(n) {
  n = Math.floor(Math.abs(n||0)); if (!n) return 'zéro'
  const p=[]; if (n>=1e6){const m=Math.floor(n/1e6);p.push(m===1?'un million':_b1000(m)+' millions');n%=1e6}
  if (n>=1000){const k=Math.floor(n/1000);p.push(k===1?'mille':_b1000(k)+' mille');n%=1000}
  if (n>0) p.push(_b1000(n)); return p.join(' ')
}

/* ── HTML email builder ── */
function buildEmailHtml(receipt, tx, logoUrl = 'https://yfc-budget.vercel.app/logo_yfc.png') {
  const fmtAr = n => Number(n||0).toLocaleString('fr-FR')+' Ar'
  const montant = receipt.montant
  const motif   = receipt.motif
  const donDate = fmtDate(receipt.txDate || tx?.date)
  const genDate = fmtDate(new Date().toISOString().slice(0,10))
  const w = toWords(montant)
  const wordsCapital = w.charAt(0).toUpperCase()+w.slice(1)
  const verifyUrl = `https://yfc-budget.vercel.app/verify/${receipt.receiptNumber}`

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reçu de don YFC</title></head>
<body style="margin:0;padding:24px 16px 40px;background:#F4F5FB;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto">
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.10)">

  <!-- top bar -->
  <tr><td height="7" style="background:#0CC0DF;font-size:0">&nbsp;</td></tr>

  <!-- header -->
  <tr><td style="padding:22px 24px 16px;text-align:center;border-bottom:1px solid rgba(0,0,0,0.07)">
    <img src="${logoUrl}" width="60" height="60"
      style="display:block;margin:0 auto 10px;object-fit:contain" alt="YFC">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#A0A4BE;
      letter-spacing:2.5px;text-transform:uppercase">YOUNG FOR CHRIST ITAOSY</p>
    <p style="margin:0;font-size:21px;font-weight:800;color:#1A1C2E">Reçu de Don</p>
    <div style="margin-top:8px">
      <span style="display:inline-block;padding:4px 14px;border-radius:20px;
        background:#FFBD59;font-size:11px;font-weight:700;color:#fff">
        ${receipt.receiptNumber}
      </span>
    </div>
  </td></tr>

  <!-- donateur / date -->
  <tr><td style="padding:0;border-bottom:1px solid rgba(0,0,0,0.07)">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="62%" style="padding:14px 16px;border-right:1px solid rgba(0,0,0,0.07)">
        <p style="margin:0 0 5px;font-size:9px;font-weight:700;color:#A0A4BE;
          text-transform:uppercase;letter-spacing:1.5px">Donateur</p>
        <p style="margin:0;font-size:13px;font-weight:700;color:#1A1C2E">${receipt.donorName}</p>
      </td>
      <td width="38%" style="padding:14px 16px">
        <p style="margin:0 0 5px;font-size:9px;font-weight:700;color:#A0A4BE;
          text-transform:uppercase;letter-spacing:1.5px">Date du don</p>
        <p style="margin:0;font-size:12px;font-weight:700;color:#1A1C2E">${donDate}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- montant -->
  <tr><td style="background:#F3F4F6;padding:20px 24px;text-align:center;
    border-bottom:1px solid rgba(0,0,0,0.10)">
    <p style="margin:0 0 10px;font-size:9px;font-weight:700;color:#6B6F8A;
      text-transform:uppercase;letter-spacing:2px">Montant du don</p>
    <p style="margin:0;font-size:28px;font-weight:800;color:#1A1C2E;letter-spacing:-0.5px">
      ${fmtAr(montant)}
    </p>
    <hr style="border:none;border-top:1px dashed rgba(0,0,0,0.10);margin:12px 30px 0">
    <p style="margin:10px 0 4px;font-size:9px;color:#A0A4BE;font-style:italic">
      Arrêté le présent reçu à la somme de :</p>
    <p style="margin:0;font-size:12px;font-weight:700;color:#1A1C2E">
      ${wordsCapital} Ariary
    </p>
  </td></tr>

  <!-- mode paiement -->
  <tr><td style="padding:14px 16px;border-bottom:1px solid rgba(0,0,0,0.07)">
    <p style="margin:0 0 5px;font-size:9px;font-weight:700;color:#A0A4BE;
      text-transform:uppercase;letter-spacing:1.5px">Mode de paiement</p>
    <p style="margin:0;font-size:12px;font-weight:600;color:#1A1C2E">${receipt.paymentMethod}</p>
  </td></tr>

  <!-- objet -->
  <tr><td style="padding:14px 16px;border-bottom:1px solid rgba(0,0,0,0.07)">
    <p style="margin:0 0 5px;font-size:9px;font-weight:700;color:#A0A4BE;
      text-transform:uppercase;letter-spacing:1.5px">Objet du don</p>
    <p style="margin:0;font-size:12px;color:#1A1C2E">${motif}</p>
  </td></tr>

  <!-- attestation -->
  <tr><td style="background:#F9FAFB;padding:14px 16px;border-bottom:1px solid rgba(0,0,0,0.07)">
    <p style="margin:0;font-size:12px;color:#6B6F8A;font-style:italic;line-height:1.65;
      border-left:3px solid #0CC0DF;padding-left:10px">
      Nous certifions avoir bien reçu la somme indiquée ci-dessus à titre de don
      pour les activités de l'association Young For Christ Itaosy.
    </p>
  </td></tr>

  <!-- responsable -->
  <tr><td style="padding:14px 16px;border-bottom:1px solid rgba(0,0,0,0.07);text-align:right">
    <p style="margin:0 0 5px;font-size:9px;font-weight:700;color:#A0A4BE;
      text-transform:uppercase;letter-spacing:1.5px">Responsable</p>
    <p style="margin:0;font-size:12px;font-weight:700;color:#1A1C2E">${receipt.responsible}</p>
    ${receipt.role ? `<p style="margin:2px 0 0;font-size:11px;color:#6B6F8A">${receipt.role}</p>` : ''}
  </td></tr>

  <!-- footer -->
  <tr><td style="background:#F9FAFB;padding:14px 24px;text-align:center;
    border-bottom:1px solid rgba(0,0,0,0.07)">
    <p style="margin:0 0 2px;font-size:9px;color:#A0A4BE">Généré le ${genDate}</p>
    <p style="margin:4px 0 1px;font-size:9px;font-weight:600;color:#6B6F8A">Young For Christ Itaosy</p>
    <p style="margin:1px 0 0;font-size:8px;color:#A0A4BE">Généré via YFC Management System</p>
  </td></tr>

  <!-- verify link -->
  <tr><td style="background:#F4F5FB;padding:12px 24px;text-align:center">
    <a href="${verifyUrl}"
      style="font-size:11px;color:#0CC0DF;text-decoration:none;font-weight:600">
      ✓ Vérifier l'authenticité de ce reçu
    </a>
  </td></tr>

  <!-- bottom bar -->
  <tr><td height="5" style="background:#0CC0DF;font-size:0">&nbsp;</td></tr>

</table>
</td></tr></table>
</body></html>`
}

/* ══════════════════════════════════════════════════════ */

export default function ReceiptModal({ tx, onClose, user, userData, currentMember }) {
  const { C } = useTheme()
  const previewRef = useRef(null)
  const [step, setStep] = useState('loading')
  const [receipt, setReceipt] = useState(null)
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Espèces')
  const [responsible, setResponsible] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [feedback, setFeedback] = useState('')
  const [emailPrompt, setEmailPrompt] = useState(false)
  const [emailTarget, setEmailTarget] = useState('')

  useEffect(() => {
    getReceiptByEntryId(tx.id)
      .then(existing => {
        if (existing) { setReceipt(existing); setStep('view') }
        else {
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
    setDonorEmail(receipt?.donorEmail || '')
    setPaymentMethod(receipt?.paymentMethod || 'Espèces')
    setResponsible(receipt?.responsible || currentMember?.nom || userData?.nom || user?.displayName || '')
    setRole(receipt?.role || currentMember?.staffRole || '')
    setStep('form')
  }

  async function handleGenerate() {
    if (!donorName.trim()) { alert('Veuillez saisir le nom du donateur.'); return }
    setSaving(true)
    try {
      const base = {
        donorName: donorName.trim(),
        donorEmail: donorEmail.trim(),
        paymentMethod,
        responsible: responsible.trim(),
        role: role.trim(),
      }
      if (receipt) {
        await updateReceipt(receipt.id, base)
        setReceipt(prev => ({ ...prev, ...base }))
      } else {
        const receiptNumber = await generateReceiptNumber()
        const created = await createReceipt({
          budgetEntryId: tx.id,
          receiptNumber,
          ...base,
          montant: tx.montant,
          motif: tx.motif,
          txDate: tx.date,
          createdBy: { uid: user?.uid||null, nom: userData?.nom||user?.displayName||'', email: user?.email||'' },
        })
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
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff', logging: false,
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
      const w = canvas.width/2, h = canvas.height/2
      const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:[w,h] })
      pdf.addImage(imgData,'PNG',0,0,w,h)
      pdf.save(`recu-${receipt.receiptNumber}.pdf`)
      await markReceiptSent(receipt.id,'pdf')
    })
  }

  async function downloadImage() {
    await doAction('img', async () => {
      const canvas = await captureCanvas()
      const link = document.createElement('a')
      link.download = `recu-${receipt.receiptNumber}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      await markReceiptSent(receipt.id,'image')
    })
  }

  async function shareReceipt() {
    await doAction('share', async () => {
      if (!navigator.share) {
        await navigator.clipboard.writeText(buildText())
        setFeedback('Copié !'); setTimeout(()=>setFeedback(''),2500); return
      }
      const canvas = await captureCanvas()
      await new Promise((resolve, reject) => {
        canvas.toBlob(async blob => {
          try {
            const file = new File([blob],`recu-${receipt.receiptNumber}.png`,{type:'image/png'})
            const sd = { files:[file], title:`Reçu de don ${receipt.receiptNumber}` }
            if (navigator.canShare?.(sd)) await navigator.share(sd)
            else await navigator.share({ title:'Reçu YFC', text: buildText() })
            await markReceiptSent(receipt.id,'share')
            resolve()
          } catch(e){ reject(e) }
        })
      })
    })
  }

  function buildText() {
    const fmtAr = n => Number(n||0).toLocaleString('fr-FR')+' Ar'
    return [
      `📄 *Reçu de Don — Young For Christ Itaosy*`,
      `N° ${receipt.receiptNumber}`,``,
      `👤 Donateur : ${receipt.donorName}`,
      `📅 Date : ${fmtLocalDate(receipt.txDate||tx.date)}`,
      `💚 Montant : *${fmtAr(receipt.montant)}*`,
      `💳 Paiement : ${receipt.paymentMethod}`,
      `📝 Motif : ${receipt.motif}`,``,
      `✍️ Reçu par : ${receipt.responsible}${receipt.role?` (${receipt.role})`:''}`,
    ].filter(Boolean).join('\n')
  }

  async function copyText() {
    await navigator.clipboard.writeText(buildText())
    setFeedback('Copié !'); setTimeout(()=>setFeedback(''),2500)
    await markReceiptSent(receipt.id,'copy').catch(()=>{})
  }

  async function sendEmail() {
    const target = receipt.donorEmail || emailTarget
    if (!target) { setEmailPrompt(true); return }
    await doAction('email', async () => {
      const logoUrl = logoYfcAsset.startsWith('/')
        ? `https://yfc-budget.vercel.app${logoYfcAsset}`
        : logoYfcAsset
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email:       target,
          receipt_number: receipt.receiptNumber,
          donor_name:     receipt.donorName,
          html_body:      buildEmailHtml(receipt, tx, logoUrl),
        },
        EMAILJS_PUBLIC_KEY
      )
      setFeedback('Email envoyé !')
      setTimeout(()=>setFeedback(''),3000)
      setEmailPrompt(false)
      setEmailTarget('')
      await markReceiptSent(receipt.id,'email')
    })
  }

  function actionBtn(key, icon, label, col, onClick) {
    const loading = actionLoading === key
    return (
      <button key={key} onClick={onClick} disabled={!!actionLoading} style={{
        flex:1, padding:'10px 4px', borderRadius:12,
        border:`1px solid ${col}28`, background:`${col}12`,
        color:col, cursor:actionLoading?'default':'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', gap:5,
        fontSize:11, fontWeight:700, fontFamily:'inherit',
        opacity: actionLoading&&!loading ? 0.45 : 1, transition:'opacity 0.15s', minWidth:0,
      }}>
        {loading ? <Loader size={17} style={{animation:'spin 0.8s linear infinite'}}/> : icon}
        {label}
      </button>
    )
  }

  return createPortal(
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}
    >
      <div style={{
        width:'100%', maxWidth:480, maxHeight:'92dvh',
        background:C.bg, borderRadius:'20px 20px 0 0',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 12px',borderBottom:`1px solid ${C.bord}`,flexShrink:0}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.t1}}>Reçu de don</div>
            <div style={{fontSize:12,color:C.t3,marginTop:2}}>
              {tx.motif} · {Number(tx.montant||0).toLocaleString('fr-FR')} Ar
            </div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:10,border:`1px solid ${C.bord}`,background:C.surf,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.t2}}>
            <X size={16}/>
          </button>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',paddingBottom:'calc(16px + env(safe-area-inset-bottom))'}}>

          {/* Loading */}
          {step==='loading' && (
            <div style={{textAlign:'center',padding:'40px 0',color:C.t3,fontSize:14}}>
              <div style={{width:30,height:30,borderRadius:'50%',border:`3px solid ${C.teal}`,borderTopColor:'transparent',margin:'0 auto 12px',animation:'spin 0.8s linear infinite'}}/>
              Vérification...
            </div>
          )}

          {/* Form */}
          {step==='form' && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {receipt ? (
                <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:C.amber,background:C.amberD,borderRadius:10,padding:'10px 14px'}}>
                  Modification du reçu {receipt.receiptNumber}
                  <button onClick={()=>setStep('view')} style={{marginLeft:'auto',background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',padding:0}}>Annuler</button>
                </div>
              ) : (
                <div style={{fontSize:13,color:C.teal,background:C.tealD,borderRadius:10,padding:'10px 14px'}}>
                  Aucun reçu pour cette entrée. Remplissez les informations pour en générer un.
                </div>
              )}

              <div>
                <label style={{fontSize:12,fontWeight:600,color:C.t2,display:'block',marginBottom:6}}>Nom du donateur *</label>
                <input value={donorName} onChange={e=>setDonorName(e.target.value)} placeholder="Ex: Jean Dupont" className="form-input" style={{width:'100%'}} autoFocus/>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:C.t2,display:'block',marginBottom:6}}>Email du donateur <span style={{color:C.t3,fontWeight:400}}>(pour envoi automatique)</span></label>
                <input value={donorEmail} onChange={e=>setDonorEmail(e.target.value)} type="email" placeholder="Ex: jean@email.com" className="form-input" style={{width:'100%'}}/>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:C.t2,display:'block',marginBottom:6}}>Mode de paiement</label>
                <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="form-input" style={{width:'100%'}}>
                  {PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:C.t2,display:'block',marginBottom:6}}>Responsable</label>
                  <input value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="Nom" className="form-input" style={{width:'100%'}}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:C.t2,display:'block',marginBottom:6}}>Rôle</label>
                  <input value={role} onChange={e=>setRole(e.target.value)} placeholder="Ex: Trésorier" className="form-input" style={{width:'100%'}}/>
                </div>
              </div>

              <button onClick={handleGenerate} disabled={saving}
                className="w-full rounded-12 font-700 text-14 cursor-pointer text-white border-none"
                style={{padding:'13px',background:'var(--btn-primary-bg)',marginTop:4,opacity:saving?0.6:1,fontFamily:'inherit'}}>
                {saving ? 'Enregistrement...' : receipt ? 'Enregistrer les modifications' : 'Générer le reçu'}
              </button>
            </div>
          )}

          {/* View */}
          {step==='view' && receipt && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{borderRadius:14,overflow:'hidden',boxShadow:'0 2px 16px rgba(0,0,0,0.10)'}}>
                <DonationReceiptPreview ref={previewRef} receipt={receipt} tx={tx}/>
              </div>

              {/* Email prompt inline */}
              {emailPrompt && (
                <div style={{background:C.surf,borderRadius:12,padding:'12px 14px',border:`1px solid ${C.bord}`}}>
                  <div style={{fontSize:12,color:C.t2,marginBottom:8,fontWeight:600}}>Email du destinataire</div>
                  <div style={{display:'flex',gap:8}}>
                    <input
                      value={emailTarget}
                      onChange={e=>setEmailTarget(e.target.value)}
                      type="email"
                      placeholder="email@exemple.com"
                      className="form-input"
                      style={{flex:1}}
                      autoFocus
                    />
                    <button onClick={sendEmail} disabled={!emailTarget.trim()||!!actionLoading}
                      style={{padding:'0 14px',borderRadius:10,background:'var(--btn-primary-bg)',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',opacity:!emailTarget.trim()?0.5:1}}>
                      {actionLoading==='email' ? <Loader size={14} style={{animation:'spin 0.8s linear infinite'}}/> : 'Envoyer'}
                    </button>
                    <button onClick={()=>{setEmailPrompt(false);setEmailTarget('')}}
                      style={{padding:'0 10px',borderRadius:10,background:C.surf,color:C.t2,border:`1px solid ${C.bord}`,cursor:'pointer',fontFamily:'inherit'}}>
                      <X size={14}/>
                    </button>
                  </div>
                </div>
              )}

              {feedback && (
                <div style={{textAlign:'center',fontSize:13,fontWeight:700,color:C.teal}}>{feedback}</div>
              )}

              <div style={{display:'flex',gap:8}}>
                {actionBtn('pdf',   <Download size={17}/>, 'PDF',     C.teal,   downloadPDF)}
                {actionBtn('img',   <Image size={17}/>,    'Image',   C.violet, downloadImage)}
                {actionBtn('share', <Share2 size={17}/>,   'Partager',C.amber,  shareReceipt)}
                {actionBtn('email', <Mail size={17}/>,     'Email',   C.coral,  sendEmail)}
                {actionBtn('copy',  <Copy size={17}/>,     'Copier',  C.t2,     copyText)}
              </div>

              <button onClick={openEditForm}
                style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:12,fontFamily:'inherit',padding:'4px 0',textAlign:'center'}}>
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
