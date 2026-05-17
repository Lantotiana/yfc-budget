import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useMediaQuery from '../hooks/useMediaQuery'
import Admin from '../components/Admin'
import ProfilePhotoCropper from '../components/ProfilePhotoCropper'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'
import { SETTINGS_SECTIONS } from '../components/desktop/SettingsSubPanel'
import { Eye, EyeOff, Trash2, Share2, Check, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { auth } from '../auth'
import { db } from '../firebase'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { collection, doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useTheme } from '../context/ThemeContext'
import { createNotification } from '../notifications'
import { normalizeAccessText, sameEmail } from '../utils/access'
import { ADMIN_EMAIL, DEFAULT_MEMBRE_TAGS } from '../constants'
import { disablePushNotifications, enablePushNotifications, getPushAvailability, syncPushNotifications } from '../services/pushNotifications'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const CLOUDINARY_CLOUD = 'dtthz84ie'
const CLOUDINARY_PRESET = 'yfc_profiles'
const SHEET_SYNC_ROLES = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

function getPushErrorMessage(reason) {
  switch (reason) {
    case 'missing-vapid-key':
      return 'Cle Web Push manquante cote projet'
    case 'permission-denied':
      return 'Autorisation de notification refusee'
    case 'permission-not-granted':
      return 'Autorisation de notification non accordee'
    case 'unsupported':
      return 'Navigateur ou telephone non compatible'
    case 'insecure-context':
      return 'Les notifications push demandent un site HTTPS'
    case 'functions-not-deployed':
      return 'Cloud Functions non deployees pour les notifications'
    case 'functions-unavailable':
      return 'Cloud Functions indisponibles pour le moment'
    case 'service-worker-registration-failed':
      return 'Impossible d enregistrer le service worker'
    case 'token-subscribe-failed':
      return 'Impossible de creer le token de notification'
    case 'missing-token':
      return 'Token de notification introuvable'
    case 'token-sync-failed':
      return 'Impossible de synchroniser cet appareil'
    default:
      return 'Impossible d activer les notifications'
  }
}

function withPushErrorDetail(base, detail) {
  const clean = String(detail || '').replace(/\s+/g, ' ').trim()
  if (!clean) return base
  return `${base} (${clean.slice(0, 90)})`
}

export default function Parametres({ user, userData, setUserData }) {
  const navigate = useNavigate()
  const { dark, toggle, C } = useTheme()
  const { t } = useTranslation()
  const fileRef = useRef()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [searchParams] = useSearchParams()
  const activeSection = isDesktop ? (searchParams.get('section') || 'profil') : null
  const show = key => !activeSection || activeSection === key
  const { setToolbar } = useDesktopToolbar()

  useEffect(() => {
    if (!isDesktop) return
    const label = SETTINGS_SECTIONS.find(s => s.key === (activeSection || 'profil'))?.label || 'Paramètres'
    setToolbar(prev => ({ ...prev, title: label }))
    return () => setToolbar(prev => ({ ...prev, title: null }))
  }, [isDesktop, activeSection, setToolbar])

  const [nom, setNom] = useState(userData?.nom || '')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoURL, setPhotoURL] = useState(userData?.photoURL || '')
  const [cropSrc, setCropSrc] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [memberRole, setMemberRole] = useState({ staff: false, staffRole: '' })
  const [msg, setMsg] = useState({ text: '', ok: true })

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pushStatus, setPushStatus] = useState({ supported: false, enabled: false, permission: 'default', configured: false })
  const [pushLoading, setPushLoading] = useState(false)
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)
  const [newTagInput, setNewTagInput] = useState('')
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const appUrl = 'https://young-for-christ.com/'

  const isAdmin = user?.email === ADMIN_EMAIL
  const canOpenAdminTools = isAdmin || SHEET_SYNC_ROLES.includes(normalizeAccessText(memberRole.staffRole))

  function flash(text, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg({ text: '', ok: true }), 3000)
  }

  useEffect(() => {
    if (!user?.email) return
    const unsub = onSnapshot(collection(db, 'membres'), snap => {
      const member = snap.docs.map(d => d.data()).find(m => sameEmail(m.email, user.email))
      setMemberRole({
        staff: member?.staff === true,
        staffRole: member?.staffRole || '',
      })
    })
    return () => unsub()
  }, [user?.email])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'appSettings', 'membreTags'), snap => {
      const raw = snap.exists() && Array.isArray(snap.data().list) ? snap.data().list : []
      setAvailableTags(['Membre', ...raw.filter(t => t !== 'Membre')])
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    getPushAvailability().then(setPushStatus).catch(() => {
      setPushStatus({ supported: false, enabled: false, permission: 'unsupported', configured: false })
    })
  }, [])

  async function addNewTag() {
    const tag = newTagInput.trim()
    if (!tag || availableTags.includes(tag)) return
    const next = ['Membre', ...availableTags.filter(t => t !== 'Membre'), tag]
    setNewTagInput('')
    await setDoc(doc(db, 'appSettings', 'membreTags'), { list: next })
  }

  async function shareAppLink() {
    if (navigator.share) {
      try { await navigator.share({ title: 'YFC Budget', url: appUrl }) } catch {}
    } else {
      await navigator.clipboard.writeText(appUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  async function handleEnablePush() {
    setPushLoading(true)
    try {
      const result = await enablePushNotifications()
      const status = await getPushAvailability()
      setPushStatus(status)

      if (result.ok) flash('Notifications telephone activees')
      else flash(withPushErrorDetail(getPushErrorMessage(result.reason), result.error), false)
    } catch {
      flash('Impossible d activer les notifications', false)
    }
    setPushLoading(false)
  }

  async function handleDisablePush() {
    setPushLoading(true)
    try {
      await disablePushNotifications()
      const status = await getPushAvailability()
      setPushStatus(status)
      flash('Notifications telephone desactivees sur cet appareil')
    } catch {
      flash('Impossible de desactiver les notifications', false)
    }
    setPushLoading(false)
  }

  async function handleRefreshPush() {
    setPushLoading(true)
    try {
      const result = await syncPushNotifications()
      const status = await getPushAvailability()
      setPushStatus(status)
      if (result.ok) flash('Notifications telephone synchronisees')
      else flash(withPushErrorDetail(getPushErrorMessage(result.reason), result.error), false)
    } catch {
      flash('Impossible de synchroniser les notifications', false)
    }
    setPushLoading(false)
  }

  async function removeTag(tag) {
    if (tag === 'Membre') return
    const next = availableTags.filter(t => t !== tag)
    setConfirmDeleteTag(null)
    await setDoc(doc(db, 'appSettings', 'membreTags'), { list: next })
  }

  async function saveProfile() {
    if (!nom.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { nom: nom.trim(), photoURL })
      setUserData(prev => ({ ...prev, nom: nom.trim(), photoURL }))
      await createNotification({
        type: 'profil',
        titre: t('parametres.notifProfilMaj'),
        detail: nom.trim(),
        cible: user.uid,
        route: '/parametres',
      })
      flash(t('parametres.profilMisAJour'))
    } catch { flash(t('parametres.erreurSauvegarde'), false) }
    setSaving(false)
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { flash(t('parametres.erreurPhoto'), false); return }
    if (file.size > 10 * 1024 * 1024) { flash('Image trop lourde (max 10 Mo)', false); return }
    const src = URL.createObjectURL(file)
    setCropSrc(src)
    setShowCropper(true)
  }

  async function handleCropConfirm(blob) {
    setShowCropper(false)
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setUploadingPhoto(true)
    try {
      const file = new File([blob], 'avatar.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', CLOUDINARY_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setPhotoURL(data.secure_url)
        await updateDoc(doc(db, 'users', user.uid), { photoURL: data.secure_url })
        setUserData(prev => ({ ...prev, photoURL: data.secure_url }))
        await createNotification({
          type: 'profil',
          titre: t('parametres.notifPhotoMaj'),
          detail: userData?.nom || user.email,
          cible: user.uid,
          route: '/parametres',
        })
        flash(t('parametres.photoMisAJour'))
      } else { flash(t('parametres.erreurPhoto'), false) }
    } catch { flash(t('parametres.erreurPhoto'), false) }
    setUploadingPhoto(false)
  }

  function handleCropCancel() {
    setShowCropper(false)
    if (cropSrc && cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  function openCropper() {
    if (photoURL) {
      setCropSrc(photoURL)
      setShowCropper(true)
    } else {
      fileRef.current?.click()
    }
  }

  async function savePassword() {
    if (newPwd.length < 6) { flash(t('parametres.mdpTropCourt'), false); return }
    if (newPwd !== confirmPwd) { flash(t('parametres.mdpNonCorrespondant'), false); return }
    setSavingPwd(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, oldPwd)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, newPwd)
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      await createNotification({
        type: 'profil',
        titre: t('parametres.notifMdpMaj'),
        detail: userData?.nom || user.email,
        cible: user.uid,
        route: '/parametres',
      })
      flash(t('parametres.mdpModifie'))
    } catch(e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        flash(t('parametres.mdpActuelIncorrect'), false)
      } else { flash(t('common.error') + ' : ' + e.message, false) }
    }
    setSavingPwd(false)
  }

  function changeLanguage(lang) {
    i18n.changeLanguage(lang)
    localStorage.setItem('yfc-lang', lang)
  }

  const inp = {
    width: '100%', padding: '11px 14px',
    border: `1.5px solid ${C.bord2}`, borderRadius: 12,
    fontSize: 'var(--font-sm)', background: C.surf2, color: C.t1,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  const section = {
    background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16,
    padding: '1.25rem', marginBottom: 12,
  }

  const sectionLabel = {
    fontSize: 'var(--font-xs)', fontWeight: 700, color: C.t3,
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14,
    ...(isDesktop ? { display: 'none' } : {}),
  }

  const roleLabel = memberRole.staffRole || (memberRole.staff ? t('parametres.staffSansRole') : t('membres.membre'))
  const sectionStyle = key => activeSection && activeSection !== key
    ? { ...section, display: 'none' }
    : section

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#64748b', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>{t('parametres.title')}</div>
      </div>

      <div className="page-content" style={{ padding: '16px 20px', paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>

        {/* Flash */}
        {msg.text && (
          <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 12, fontSize: 'var(--font-sm)', fontWeight: 600, background: msg.ok ? C.tealD : C.coralD, color: msg.ok ? C.teal : C.coral }}>
            {msg.text}
          </div>
        )}

        {/* Apparence */}
        <div style={sectionStyle('apparence')}>
          <div style={sectionLabel}>{t('parametres.apparence')}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1 }}>{t('parametres.modeSombre')}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 1 }}>{dark ? t('parametres.active') : t('parametres.desactive')}</div>
            </div>
            <button
              onClick={toggle}
              style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', padding: 0, background: dark ? C.amber : C.bord2, position: 'relative', transition: 'background 0.2s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: dark ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
            </button>
          </div>
        </div>


        {/* Profil */}
        <div style={sectionStyle('profil')}>
          <div style={sectionLabel}>{t('parametres.profil')}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              onClick={openCropper}
              style={{ width: 64, height: 64, borderRadius: '50%', background: C.surf2, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-md)', color: C.t1, flexShrink: 0 }}
            >
              {uploadingPhoto ? '...' : photoURL
                ? <img src={photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (nom || user?.email || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, marginBottom: 2 }}>{t('parametres.photoProfile')}</div>
              <button
                onClick={openCropper}
                style={{ fontSize: 'var(--font-xs)', color: C.amber, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}
              >
                {uploadingPhoto ? t('parametres.uploading') : t('parametres.modifierPhoto')}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label">{t('parametres.nomComplet')}</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder={t('parametres.namePlaceholder')} style={inp} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{t('parametres.email')}</label>
            <input type="email" value={user?.email || ''} disabled style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{t('parametres.role')}</label>
            <input type="text" value={roleLabel} disabled style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <button
            className="params-action-btn"
            onClick={saveProfile}
            disabled={saving || !nom.trim()}
            style={{ padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !nom.trim()) ? 0.6 : 1 }}
          >
            {saving ? t('parametres.enregistrement') : t('parametres.sauvegarder')}
          </button>
        </div>

        
        {/* Application */}
        <div style={sectionStyle('application')}>
          <div style={sectionLabel}>{t('parametres.application')}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: C.surf2, border: `1px solid ${C.bord}` }}>
            <span style={{ flex: 1, fontSize: 'var(--font-xs)', color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appUrl}</span>
            <button
              onClick={() => setShowQR(true)}
              style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.bord2}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <QrCode size={15} />
            </button>
            <button
              onClick={shareAppLink}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {linkCopied ? <Check size={13} /> : <Share2 size={13} />}
              {linkCopied ? t('common.copied') : t('common.share')}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 8 }}>
            {[
              {
                label: 'YouTube',
                url: 'https://www.youtube.com/@YFCTanora_hoani_KristyJMItaosy',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                  </svg>
                ),
              },
              {
                label: 'Facebook',
                url: 'https://www.facebook.com/groups/1877840085786311',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                ),
              },
            ].map(({ label, url, icon }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: C.t3, textDecoration: 'none', fontSize: 'var(--font-sm)' }}
              >
                <span style={{ flexShrink: 0, color: C.t3 }}>{icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ))}
          </div>

          {showQR && (
            <div className="modal-overlay" onClick={() => setShowQR(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 280, textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: C.t1, marginBottom: 16 }}>{t('parametres.scanner')}</div>
                <div style={{ display: 'inline-block', padding: 12, borderRadius: 16, background: '#fff' }}>
                  <QRCodeSVG value={appUrl} size={180} fgColor="#0f172a" bgColor="#ffffff" />
                </div>
                <div style={{ marginTop: 12, fontSize: 'var(--font-xs)', color: C.t3 }}>{appUrl}</div>
                <button onClick={() => setShowQR(false)} style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 12, border: `1.5px solid ${C.bord2}`, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('common.close')}</button>
              </div>
            </div>
          )}
        </div>
        <div style={sectionStyle('notifications')}>
          {msg.text && (
            <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 14, fontSize: 'var(--font-sm)', fontWeight: 600, background: msg.ok ? C.tealD : C.coralD, color: msg.ok ? C.teal : C.coral }}>
              {msg.text}
            </div>
          )}
          <div style={sectionLabel}>Notifications téléphone</div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, marginBottom: 4 }}>
            Recevoir les notifications même quand l’app est fermée
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginBottom: 14, lineHeight: 1.5 }}>
            {!pushStatus.configured
              ? 'La clé Web Push Firebase n’est pas encore configurée.'
              : !pushStatus.supported
                ? 'Ce téléphone ou ce navigateur ne supporte pas les notifications push web.'
                : pushStatus.enabled
                  ? 'Autorisation accordee sur cet appareil. Appuie sur Synchroniser pour finaliser le push.'
                  : pushStatus.permission === 'denied'
                    ? 'Les notifications sont bloquées dans le navigateur.'
                    : 'Les notifications push ne sont pas encore activées sur cet appareil.'}
          </div>

          <button
            className="params-action-btn"
            type="button"
            onClick={handleEnablePush}
            disabled={pushLoading || !pushStatus.configured || !pushStatus.supported || pushStatus.permission === 'denied' || pushStatus.enabled}
            style={{ padding: '12px 14px', borderRadius: 12, border: 'none', background: pushStatus.enabled ? C.tealD : C.teal, color: pushStatus.enabled ? C.teal : '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, opacity: (pushLoading || !pushStatus.configured || !pushStatus.supported || pushStatus.permission === 'denied' || pushStatus.enabled) ? 0.72 : 1 }}
          >
            {pushLoading ? 'Activation...' : pushStatus.enabled ? 'Autorise' : 'Activer'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={handleRefreshPush}
              disabled={pushLoading || !pushStatus.configured || !pushStatus.supported || !pushStatus.enabled}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.bord2}`, background: C.surf2, color: C.t1, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (pushLoading || !pushStatus.configured || !pushStatus.supported || !pushStatus.enabled) ? 0.6 : 1 }}
            >
              Synchroniser
            </button>
            <button
              type="button"
              onClick={handleDisablePush}
              disabled={pushLoading || !pushStatus.supported || !pushStatus.enabled}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.coralD}`, background: C.coralD, color: C.coral, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (pushLoading || !pushStatus.supported || !pushStatus.enabled) ? 0.6 : 1 }}
            >
              Désactiver
            </button>
          </div>
        </div>

        {/* Mot de passe */}
        {canOpenAdminTools && (
          isDesktop
            ? (activeSection === 'administration' && <Admin user={user} userData={userData} />)
            : (
              <div style={section}>
                <div style={sectionLabel}>{t('parametres.administration')}</div>
                <button
                  className="params-action-btn"
                  onClick={() => navigate('/admin')}
                  style={{ padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t('parametres.ouvrirAdmin')}
                </button>
              </div>
            )
        )}

        {/* Tags des membres */}
        {isAdmin && (
          <div style={sectionStyle('tags')}>
            <div style={sectionLabel}>{t('parametres.tagsMembres')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {availableTags.map(tag => (
                <div key={tag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: C.surf2, border: `1px solid ${C.bord}` }}>
                  <span style={{ fontSize: 'var(--font-sm)', color: C.t1 }}>{tag}</span>
                  {tag !== 'Membre' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTag(confirmDeleteTag === tag ? null : tag)}
                      style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: C.coral, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: C.t3, fontStyle: 'italic' }}>{t('common.protected')}</span>
                  )}
                </div>
              ))}
            </div>

            {confirmDeleteTag && (
              <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, marginBottom: 4 }}>
                  {t('parametres.supprimerTag', { tag: confirmDeleteTag })}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginBottom: 12 }}>
                  {t('parametres.supprimerTagDesc')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDeleteTag(null)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1.5px solid ${C.bord2}`, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)' }}>{t('common.cancel')}</button>
                  <button onClick={() => removeTag(confirmDeleteTag)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: C.coral, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)' }}>{t('common.delete')}</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewTag())}
                placeholder={t('parametres.nouveauTag')}
                style={{ ...inp, flex: 1 }}
              />
              <button
                type="button"
                onClick={addNewTag}
                disabled={!newTagInput.trim() || availableTags.includes(newTagInput.trim())}
                style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-sm)', opacity: (newTagInput.trim() && !availableTags.includes(newTagInput.trim())) ? 1 : 0.5, whiteSpace: 'nowrap' }}
              >
                {t('parametres.ajouterTag')}
              </button>
            </div>
          </div>
        )}

        {/* Mot de passe */}
        <div style={sectionStyle('securite')}>
          <div style={sectionLabel}>{t('parametres.changerMdp')}</div>

          {[
            { label: t('parametres.mdpActuel'),   val: oldPwd,     set: setOldPwd,     show: showOld, toggleShow: () => setShowOld(p => !p) },
            { label: t('parametres.nouveauMdp'),  val: newPwd,     set: setNewPwd,     show: showNew, toggleShow: () => setShowNew(p => !p) },
            { label: t('parametres.confirmerMdp'), val: confirmPwd, set: setConfirmPwd, show: showNew, toggleShow: null },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <label className="form-label">{f.label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder="••••••"
                  style={{ ...inp, paddingRight: f.toggleShow ? 44 : 14 }}
                />
                {f.toggleShow && (
                  <button
                    onClick={f.toggleShow}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    {f.show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            className="params-action-btn"
            onClick={savePassword}
            disabled={savingPwd || !oldPwd || !newPwd || !confirmPwd}
            style={{ padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit', opacity: (savingPwd || !oldPwd || !newPwd || !confirmPwd) ? 0.6 : 1 }}
          >
            {savingPwd ? t('parametres.modification') : t('parametres.modifierMdp')}
          </button>
        </div>

        {/* Déconnexion — hidden on desktop (button lives in SettingsSubPanel) */}
        {!isDesktop && (
          <button
            className="params-action-btn"
            onClick={() => signOut(auth)}
            style={{ padding: 13, border: `1.5px solid ${C.coralD}`, borderRadius: 12, background: C.coralD, color: C.coral, fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('parametres.deconnecter')}
          </button>
        )}
      </div>

      {showCropper && cropSrc && (
        <ProfilePhotoCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}





