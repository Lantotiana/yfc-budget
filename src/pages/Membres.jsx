import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
const EMPTY = { nom: '', prenoms: '', adresse: '', telephone: '', email: '' }

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function Membres({ user, userData }) {
  const navigate = useNavigate()
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sheet, setSheet] = useState(null) // null | 'add' | membre object
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

  function openAdd() {
    setForm(EMPTY)
    setSheet('add')
  }

  function openEdit(m) {
    setForm({ nom: m.nom || '', prenoms: m.prenoms || '', adresse: m.adresse || '', telephone: m.telephone || '', email: m.email || '' })
    setSheet(m)
  }

  function closeSheet() {
    setSheet(null)
    setForm(EMPTY)
  }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    try {
      if (sheet === 'add') {
        await addDoc(collection(db, 'membres'), {
          ...form,
          nom: form.nom.trim(),
          prenoms: form.prenoms.trim(),
          dateAjout: new Date().toISOString().slice(0, 10),
        })
      } else {
        await updateDoc(doc(db, 'membres', sheet.id), {
          nom: form.nom.trim(),
          prenoms: form.prenoms.trim(),
          adresse: form.adresse.trim(),
          telephone: form.telephone.trim(),
          email: form.email.trim(),
        })
      }
      closeSheet()
    } catch(e) {
      console.error(e)
    }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!confirmDel) return
    await deleteDoc(doc(db, 'membres', confirmDel.id))
    setConfirmDel(null)
  }

  const term = normalize(search)
  const filtered = membres.filter(m =>
    normalize(m.nom).includes(term) ||
    normalize(m.prenoms).includes(term) ||
    normalize(m.telephone).includes(term)
  )

  const inp = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid var(--border-input)',
    borderRadius: '12px',
    fontSize: '14px',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const isEditing = sheet && sheet !== 'add'

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-body)'}}>
      {/* Header */}
      <div style={{background:'var(--hero-bg)', padding:'1rem 1rem 1.5rem', paddingTop:'max(1rem, env(safe-area-inset-top))'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'1rem'}}>
          <button
            onClick={() => navigate('/')}
            style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', color:'#fff', fontSize:'16px', fontFamily:'inherit', flexShrink:0}}
          >
            ‹
          </button>
          <div style={{flex:1}}>
            <h1 style={{margin:0, fontSize:'18px', fontWeight:'700', color:'#fff'}}>Membres</h1>
            <p style={{margin:0, fontSize:'11px', color:'rgba(255,255,255,0.5)'}}>
              {membres.length} membre{membres.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div style={{position:'relative'}}>
          <span style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.4)', fontSize:'14px'}}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            style={{width:'100%', padding:'10px 14px 10px 36px', border:'none', borderRadius:'12px', fontSize:'13px', background:'rgba(255,255,255,0.12)', color:'#fff', fontFamily:'inherit', outline:'none', boxSizing:'border-box'}}
          />
        </div>
      </div>

      {/* List */}
      <div style={{padding:'1rem'}}>
        {loading ? (
          <div style={{textAlign:'center', color:'var(--text-secondary)', padding:'2rem', fontSize:'13px'}}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center', color:'var(--text-secondary)', padding:'2rem', fontSize:'13px'}}>
            {search ? 'Aucun résultat' : 'Aucun membre enregistré'}
          </div>
        ) : filtered.map(m => (
          <div
            key={m.id}
            style={{display:'flex', alignItems:'center', gap:'12px', background:'var(--card-bg)', borderRadius:'14px', padding:'12px', marginBottom:'8px', cursor:'pointer'}}
            onClick={() => openEdit(m)}
          >
            <div style={{width:'40px', height:'40px', borderRadius:'50%', background:'var(--input-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'14px', color:'var(--text-primary)', flexShrink:0}}>
              {(m.nom || '?')[0].toUpperCase()}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'14px', fontWeight:'600', color:'var(--text-primary)'}}>
                {m.nom} {m.prenoms}
              </div>
              {m.telephone && (
                <div style={{fontSize:'12px', color:'var(--text-secondary)', marginTop:'1px'}}>{m.telephone}</div>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDel(m) }}
              style={{background:'var(--del-btn-bg)', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#be123c', fontSize:'13px'}}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{position:'fixed', bottom:'1.5rem', right:'1.5rem', width:'54px', height:'54px', borderRadius:'50%', background:'var(--btn-primary-bg)', color:'#fff', border:'none', fontSize:'24px', cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10}}
      >
        +
      </button>

      {/* Bottom sheet */}
      {sheet !== null && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end'}} onClick={closeSheet}>
          <div style={{width:'100%', background:'var(--card-bg)', borderRadius:'20px 20px 0 0', padding:'1.5rem', paddingBottom:'max(1.5rem, env(safe-area-inset-bottom))', maxHeight:'85vh', overflowY:'auto'}} onClick={e => e.stopPropagation()}>

            <div style={{width:'36px', height:'4px', background:'var(--border-light)', borderRadius:'2px', margin:'0 auto 1.5rem'}} />

            <h2 style={{margin:'0 0 1.25rem', fontSize:'16px', fontWeight:'700', color:'var(--text-primary)'}}>
              {isEditing ? 'Modifier le membre' : 'Nouveau membre'}
            </h2>

            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              {[
                { key: 'nom', label: 'Nom *', placeholder: 'Nom de famille' },
                { key: 'prenoms', label: 'Prénoms', placeholder: 'Prénoms' },
                { key: 'telephone', label: 'Téléphone', placeholder: '034 xx xxx xx' },
                { key: 'email', label: 'Email', placeholder: 'nom@email.com', type: 'email' },
                { key: 'adresse', label: 'Adresse', placeholder: 'Quartier, ville...' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{fontSize:'11px', fontWeight:'600', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>
                    {f.label}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={inp}
                  />
                </div>
              ))}
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'1.5rem'}}>
              <button
                onClick={closeSheet}
                style={{flex:1, padding:'13px', border:'1.5px solid var(--border-input)', borderRadius:'12px', background:'transparent', color:'var(--text-secondary)', fontWeight:'600', fontSize:'14px', cursor:'pointer', fontFamily:'inherit'}}
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !form.nom.trim()}
                style={{flex:2, padding:'13px', border:'none', borderRadius:'12px', background:'var(--btn-primary-bg)', color:'#fff', fontWeight:'700', fontSize:'14px', cursor:'pointer', fontFamily:'inherit', opacity: (saving || !form.nom.trim()) ? 0.6 : 1}}
              >
                {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
          <div style={{background:'var(--card-bg)', borderRadius:'20px', padding:'1.5rem', width:'100%', maxWidth:'320px'}}>
            <h3 style={{margin:'0 0 8px', fontSize:'16px', fontWeight:'700', color:'var(--text-primary)'}}>Supprimer ce membre ?</h3>
            <p style={{margin:'0 0 1.5rem', fontSize:'13px', color:'var(--text-secondary)'}}>
              {confirmDel.nom} {confirmDel.prenoms} sera définitivement supprimé.
            </p>
            <div style={{display:'flex', gap:'10px'}}>
              <button
                onClick={() => setConfirmDel(null)}
                style={{flex:1, padding:'12px', border:'1.5px solid var(--border-input)', borderRadius:'12px', background:'transparent', color:'var(--text-secondary)', fontWeight:'600', cursor:'pointer', fontFamily:'inherit'}}
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                style={{flex:1, padding:'12px', border:'none', borderRadius:'12px', background:'#be123c', color:'#fff', fontWeight:'700', cursor:'pointer', fontFamily:'inherit'}}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
