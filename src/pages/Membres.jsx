import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query, where, setDoc } from 'firebase/firestore'
import { Plus, Search, Trash2, Download, X } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
import { ADMIN_EMAIL, STAFF_ROLES, DEFAULT_MEMBRE_TAGS } from '../constants'

const EMPTY = { nom: '', prenoms: '', nomPrefere: '', adresse: '', telephone: '', email: '', tailleTshirt: '', staff: false, staffRole: '', tags: [] }
const TAILLES_TSHIRT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const AVATAR_COLORS = ['#2563eb', '#10b981', '#7c3aed', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#8b5cf6', '#ef4444']

const TAG_PALETTE = {
  'Mpitarika YFC': { bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
  'Logistique':    { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  'Autre':         { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}
const DEFAULT_TAG_STYLE = { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' }
function tagStyle(tag) { return TAG_PALETTE[tag] || DEFAULT_TAG_STYLE }

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

function getAvatarColor(member) {
  const seed = `${member.id || ''}${member.nom || ''}${member.prenoms || ''}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function Membres({ user, userData }) {
  const { C } = useTheme()
  const [membres, setMembres] = useState([])
  const [staffEmails, setStaffEmails] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)
  const [newTagInput, setNewTagInput] = useState('')
  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    const unsub = onSnapshot(q, snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const emails = snap.docs
        .map(d => d.data())
        .filter(u => u.approuve === true && u.email)
        .map(u => normalizeEmail(u.email))
      setStaffEmails(new Set(emails))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'appSettings', 'membreTags'), snap => {
      if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
        setAvailableTags(snap.data().list)
      }
    })
    return () => unsub()
  }, [])

  function openAdd()  { setForm(EMPTY); setSheet('add') }
  function openEdit(m) {
    setForm({ nom: m.nom || '', prenoms: m.prenoms || '', nomPrefere: m.nomPrefere || '', adresse: m.adresse || '', telephone: m.telephone || '', email: m.email || '', tailleTshirt: m.tailleTshirt || '', staff: m.staff === true || isApprovedUserEmail(m.email), staffRole: m.staffRole || '', tags: Array.isArray(m.tags) ? m.tags : [] })
    setSheet(m)
  }
  function closeSheet() { setSheet(null); setForm(EMPTY) }

  function getStaffRoleToSave(isStaff) {
    if (!isStaff) return ''
    if (isAdmin) return form.staffRole || ''
    return sheet && sheet !== 'add' ? (sheet.staffRole || '') : ''
  }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    try {
      const isStaff = form.staff === true || isApprovedUserEmail(form.email)
      const staffRole = getStaffRoleToSave(isStaff)
      if (sheet === 'add') {
        await addDoc(collection(db, 'membres'), {
          nom: form.nom.trim(), prenoms: form.prenoms.trim(), nomPrefere: form.nomPrefere.trim(),
          adresse: form.adresse.trim(), telephone: form.telephone.trim(), email: form.email.trim(),
          tailleTshirt: form.tailleTshirt,
          staff: isStaff,
          staffRole,
          tags: form.tags,
          dateAjout: new Date().toISOString().slice(0, 10),
        })
        await createNotification({
          type: 'membre',
          titre: 'Nouveau membre ajouté',
          detail: `${form.nom.trim()} ${form.prenoms.trim()}`.trim(),
          cible: form.nom.trim(),
          route: '/membres',
        })
      } else {
        await updateDoc(doc(db, 'membres', sheet.id), {
          nom: form.nom.trim(), prenoms: form.prenoms.trim(), nomPrefere: form.nomPrefere.trim(),
          adresse: form.adresse.trim(), telephone: form.telephone.trim(), email: form.email.trim(),
          tailleTshirt: form.tailleTshirt,
          staff: isStaff,
          staffRole,
          tags: form.tags,
        })
        if (isAdmin && form.email.trim()) {
          const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', form.email.trim())))
          if (!userSnap.empty) await updateDoc(userSnap.docs[0].ref, { staffRole })
        }
        await createNotification({
          type: 'membre',
          titre: 'Membre modifié',
          detail: `${form.nom.trim()} ${form.prenoms.trim()}`.trim(),
          cible: form.nom.trim(),
          route: '/membres',
        })
      }
      closeSheet()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!confirmDel) return
    await deleteDoc(doc(db, 'membres', confirmDel.id))
    await createNotification({
      type: 'membre',
      titre: 'Membre supprimé',
      detail: `${confirmDel.nom || ''} ${confirmDel.prenoms || ''}`.trim(),
      cible: confirmDel.nom || '',
      route: '/membres',
    })
    setConfirmDel(null)
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = membres.map(m => ({
      'Nom': m.nom || '',
      'Prénoms': m.prenoms || '',
      'Nom préféré': m.nomPrefere || '',
      'Téléphone': m.telephone || '',
      'Email': m.email || '',
      'Adresse': m.adresse || '',
      'Taille T-shirt': m.tailleTshirt || '',
      'Staff': isStaffMember(m) ? 'Oui' : 'Non',
      'Rôle staff': isStaffMember(m) ? (m.staffRole || '') : '',
      "Date d'ajout": toDisplayDate(m.dateAjout),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Membres')
    XLSX.writeFile(wb, `membres_yfc_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const term = normalize(search)
  const isApprovedUserEmail = email => Boolean(normalizeEmail(email) && staffEmails.has(normalizeEmail(email)))
  const isFormApprovedUser = isApprovedUserEmail(form.email)
  const isFormStaff = form.staff === true || isFormApprovedUser
  const isStaffMember = m => m.staff === true || isApprovedUserEmail(m.email)

  const filtered = membres.filter(m => {
    const matchesSearch =
      normalize(m.nom).includes(term) ||
      normalize(m.prenoms).includes(term) ||
      normalize(m.telephone).includes(term) ||
      normalize(m.email).includes(term)

    if (!matchesSearch) return false
    if (roleFilter === 'staff') return isStaffMember(m)
    if (roleFilter === 'membre') return !isStaffMember(m)
    return true
  })

  const staffCount = membres.filter(isStaffMember).length
  const memberOnlyCount = membres.length - staffCount

  const isEditing = sheet && sheet !== 'add'

  async function addNewTag() {
    const tag = newTagInput.trim()
    if (!tag || availableTags.includes(tag)) return
    const next = [...availableTags, tag]
    setAvailableTags(next)
    setNewTagInput('')
    setForm(f => ({ ...f, tags: [...f.tags, tag] }))
    await setDoc(doc(db, 'appSettings', 'membreTags'), { list: next })
  }

  async function removeAvailableTag(tag) {
    const next = availableTags.filter(t => t !== tag)
    setAvailableTags(next)
    await setDoc(doc(db, 'appSettings', 'membreTags'), { list: next })
  }

  function toggleTag(tag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header" style={{ '--header-color': '#f43f5e', padding: '20px 20px 14px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="header-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Membres</div>
            <div className="header-subtitle" style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{membres.length} membre{membres.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {membres.length > 0 && (
              <button className="header-action" onClick={exportExcel} style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={16} />
              </button>
            )}
            <button className="header-action" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
              <Plus size={14} color="#fff" /> Ajouter
            </button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none', display: 'flex' }}><Search size={15} /></span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre..." style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: `1px solid ${C.bord2}`, background: C.surf2, color: C.t1, fontSize: 'var(--font-sm)', outline: 'none' }} />
        </div>
        <div className="member-role-filter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10, padding: 4, borderRadius: 14, background: C.surf2, border: `1px solid ${C.bord}` }}>
          {[
            { key: 'all', label: 'Tous', count: membres.length },
            { key: 'membre', label: 'Membres', count: memberOnlyCount },
            { key: 'staff', label: 'Staff', count: staffCount },
          ].map(item => {
            const active = roleFilter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setRoleFilter(item.key)}
                style={{
                  minWidth: 0,
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 6px',
                  background: active ? C.teal : 'transparent',
                  color: active ? '#fff' : C.t2,
                  fontSize: 'var(--font-xs)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {item.label} <span style={{ opacity: active ? 0.9 : 0.65 }}>{item.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Liste */}
      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.t2, fontSize: 'var(--font-sm)' }}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.t2, fontSize: 'var(--font-sm)' }}>{search || roleFilter !== 'all' ? 'Aucun résultat' : 'Aucun membre enregistré'}</div>
        ) : filtered.map(m => {
          const avatarColor = getAvatarColor(m)
          const isStaff = isStaffMember(m)
          return (
          <div key={m.id} onClick={() => openEdit(m)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '13px 14px', marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: `${avatarColor}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-sm)', color: avatarColor }}>
              {(m.nom || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom} {m.prenoms}</div>
                {isStaff && (
                  <span style={{ flexShrink: 0, padding: '3px 7px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: C.teal, fontSize: 'var(--font-xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>
                    Staff
                  </span>
                )}
                {isStaff && m.staffRole && (
                  <span style={{ flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '3px 7px', borderRadius: 999, background: C.surf2, color: C.t2, fontSize: 'var(--font-xs)', fontWeight: 800 }}>
                    {m.staffRole}
                  </span>
                )}
              </div>
              {m.telephone && <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 1 }}>{m.telephone}</div>}
              {m.email && <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
              {Array.isArray(m.tags) && m.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {m.tags.map(tag => (
                    <span key={tag} style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 'var(--font-xs)', fontWeight: 700 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(m) }} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={14} color={C.coral} />
            </button>
          </div>
          )
        })}
      </div>

      {/* Bottom sheet */}
      {sheet !== null && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title" style={{ marginBottom: '1.25rem' }}>{isEditing ? 'Modifier le membre' : 'Nouveau membre'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="form-label">Nom *</label><input type="text" value={form.nom} onChange={e => setForm(prev => ({ ...prev, nom: e.target.value }))} placeholder="Nom de famille" className="form-input" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="form-label">Prénoms</label><input type="text" value={form.prenoms} onChange={e => setForm(prev => ({ ...prev, prenoms: e.target.value }))} placeholder="Prénoms" className="form-input" /></div>
                <div><label className="form-label">Nom préféré</label><input type="text" value={form.nomPrefere} onChange={e => setForm(prev => ({ ...prev, nomPrefere: e.target.value }))} placeholder="Surnom..." className="form-input" /></div>
              </div>
              {[{ key: 'telephone', label: 'Téléphone', placeholder: '034 xx xxx xx' }, { key: 'email', label: 'Email', placeholder: 'nom@email.com', type: 'email' }, { key: 'adresse', label: 'Adresse', placeholder: 'Quartier, ville...' }].map(f => (
                <div key={f.key}><label className="form-label">{f.label}</label><input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} className="form-input" /></div>
              ))}
              <div><label className="form-label">Taille T-shirt</label><select value={form.tailleTshirt} onChange={e => setForm(prev => ({ ...prev, tailleTshirt: e.target.value }))} className="form-input" style={{ cursor: 'pointer' }}><option value="">Non spécifiée</option>{TAILLES_TSHIRT.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isFormStaff}
                  onChange={e => setForm(prev => ({ ...prev, staff: e.target.checked }))}
                  disabled={isFormApprovedUser}
                  style={{ width: 18, height: 18, accentColor: C.teal }}
                />
                <span style={{ color: C.t1, fontSize: 'var(--font-sm)', fontWeight: 400 }}>
                  Cette personne est Staff
                  {isFormApprovedUser && <span style={{ color: C.t2, fontSize: 'var(--font-xs)', fontWeight: 400 }}> (user approuvé)</span>}
                </span>
              </label>
              {isFormStaff && (
                <div>
                  <label className="form-label">Rôle</label>
                  {isAdmin ? (
                    <select
                      value={form.staffRole}
                      onChange={e => setForm(prev => ({ ...prev, staffRole: e.target.value }))}
                      className="form-input"
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">Aucun rôle attribué</option>
                      {STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={form.staffRole || 'Non attribué'}
                        disabled
                        className="form-input"
                        style={{ color: C.t2 }}
                      />
                      <div style={{ marginTop: 5, fontSize: 'var(--font-xs)', color: C.t3 }}>
                        Seul l'admin peut attribuer un rôle.
                      </div>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="form-label">Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {availableTags.map(tag => {
                    const selected = form.tags.includes(tag)
                    return (
                      <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                        <button
                          type="button"
                          onClick={() => toggleTag(tag)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: isAdmin ? '999px 0 0 999px' : 999,
                            border: `1.5px solid ${selected ? '#6366f1' : C.bord}`,
                            borderRight: isAdmin ? 'none' : undefined,
                            background: selected ? 'rgba(99,102,241,0.12)' : C.surf2,
                            color: selected ? '#6366f1' : C.t2,
                            fontSize: 'var(--font-xs)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {tag}
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => removeAvailableTag(tag)}
                            style={{
                              width: 26, height: 32,
                              borderRadius: '0 999px 999px 0',
                              border: `1.5px solid ${selected ? '#6366f1' : C.bord}`,
                              borderLeft: 'none',
                              background: selected ? 'rgba(99,102,241,0.12)' : C.surf2,
                              color: selected ? '#6366f1' : C.t3,
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewTag())}
                      placeholder="Nouveau tag..."
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={addNewTag}
                      disabled={!newTagInput.trim()}
                      style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)', opacity: newTagInput.trim() ? 1 : 0.5 }}
                    >
                      + Ajouter
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
              <button onClick={closeSheet} style={{ flex: 1, padding: 13, border: `1.5px solid ${C.bord2}`, borderRadius: 12, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={save} disabled={saving || !form.nom.trim()} style={{ flex: 2, padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !form.nom.trim()) ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title" style={{ marginBottom: 8 }}>Supprimer ce membre ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: 'var(--font-sm)', color: C.t2 }}>{confirmDel.nom} {confirmDel.prenoms} sera définitivement supprimé.</p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: 12, border: `1.5px solid ${C.bord2}`, borderRadius: 12, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 12, background: C.coral, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
