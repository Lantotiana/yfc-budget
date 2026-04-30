import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Plus, Search, Trash2, Download } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
const EMPTY = { nom: '', prenoms: '', nomPrefere: '', adresse: '', telephone: '', email: '', tailleTshirt: '' }
const TAILLES_TSHIRT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function Membres({ user, userData }) {
  const { C } = useTheme()
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    const unsub = onSnapshot(q, snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  function openAdd()  { setForm(EMPTY); setSheet('add') }
  function openEdit(m) {
    setForm({ nom: m.nom || '', prenoms: m.prenoms || '', nomPrefere: m.nomPrefere || '', adresse: m.adresse || '', telephone: m.telephone || '', email: m.email || '', tailleTshirt: m.tailleTshirt || '' })
    setSheet(m)
  }
  function closeSheet() { setSheet(null); setForm(EMPTY) }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    try {
      if (sheet === 'add') {
        await addDoc(collection(db, 'membres'), {
          nom: form.nom.trim(), prenoms: form.prenoms.trim(), nomPrefere: form.nomPrefere.trim(),
          adresse: form.adresse.trim(), telephone: form.telephone.trim(), email: form.email.trim(),
          tailleTshirt: form.tailleTshirt,
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
        })
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
      "Date d'ajout": toDisplayDate(m.dateAjout),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Membres')
    XLSX.writeFile(wb, `membres_yfc_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const term = normalize(search)
  const filtered = membres.filter(m =>
    normalize(m.nom).includes(term) ||
    normalize(m.prenoms).includes(term) ||
    normalize(m.telephone).includes(term)
  )

  const isEditing = sheet && sheet !== 'add'

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 14px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Membres</div>
            <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>{membres.length} membre{membres.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {membres.length > 0 && (
              <button onClick={exportExcel} style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={16} />
              </button>
            )}
            <button onClick={openAdd} style={{ width: 36, height: 36, borderRadius: 12, border: 'none', background: C.amber, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.amberD.replace('0.13','0.5').replace('0.12','0.5')}` }}>
              <Plus size={16} color="#fff" />
            </button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none', display: 'flex' }}><Search size={15} /></span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre..." style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: `1px solid ${C.bord2}`, background: C.surf2, color: C.t1, fontSize: 14, outline: 'none' }} />
        </div>
      </div>

      {/* Liste */}
      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.t2, fontSize: 13 }}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.t2, fontSize: 13 }}>{search ? 'Aucun résultat' : 'Aucun membre enregistré'}</div>
        ) : filtered.map(m => (
          <div key={m.id} onClick={() => openEdit(m)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '13px 14px', marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: C.violetD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: C.violet }}>
              {(m.nom || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom} {m.prenoms}</div>
              {m.telephone && <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>{m.telephone}</div>}
              {m.email && <div style={{ fontSize: 11, color: C.t3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
            </div>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(m) }} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={14} color={C.coral} />
            </button>
          </div>
        ))}
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
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
              <button onClick={closeSheet} style={{ flex: 1, padding: 13, border: `1.5px solid ${C.bord2}`, borderRadius: 12, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={save} disabled={saving || !form.nom.trim()} style={{ flex: 2, padding: 13, border: 'none', borderRadius: 12, background: C.amber, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !form.nom.trim()) ? 0.6 : 1 }}>
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
            <p style={{ margin: '0 0 1.5rem', fontSize: 13, color: C.t2 }}>{confirmDel.nom} {confirmDel.prenoms} sera définitivement supprimé.</p>
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
