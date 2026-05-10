import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Link2, Package2, Plus } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useTheme } from '../context/ThemeContext'
import DocumentsPanel from '../components/documents/DocumentsPanel'
import MaterielsTab from '../components/materiels/MaterielsTab'

const TABS = [
  { key: 'materiel', label: 'Matériel', Icon: Package2 },
  { key: 'documents', label: 'Documents', Icon: FileText },
]

export default function Documents({ user, userData }) {
  const { C } = useTheme()
  const [activeTab, setActiveTab] = useState('materiel')
  const [searchParams, setSearchParams] = useSearchParams()
  const [addFn, setAddFn] = useState(null)
  const [addLinkFn, setAddLinkFn] = useState(null)
  const [materielCount, setMaterielCount] = useState(null)

  const highlightDocId = searchParams.get('doc') || ''
  const highlightLienId = searchParams.get('lien') || ''

  useEffect(() => {
    if (highlightDocId || highlightLienId) setActiveTab('documents')
  }, [highlightDocId, highlightLienId])

  function clearHighlightParams() {
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      n.delete('doc')
      n.delete('lien')
      return n
    }, { replace: true })
  }

  useEffect(() => {
    return onSnapshot(collection(db, 'materiels'), snap => {
      setMaterielCount(snap.docs.filter(d => d.data().statut !== 'archive').length)
    })
  }, [])

  const HEADERS = {
    materiel:  { title: 'Matériels',  subtitle: materielCount === null ? '…' : `${materielCount} matériel${materielCount !== 1 ? 's' : ''} enregistré${materielCount !== 1 ? 's' : ''}`, addLabel: 'Ajouter' },
    documents: { title: 'Documents',  subtitle: 'Retrouvez ici les fichiers importants de YFC.',        addLabel: 'Ajouter' },
  }

  const { title, subtitle, addLabel } = HEADERS[activeTab]

  const registerAdd = useCallback(fn => setAddFn(fn ? () => fn : null), [])
  const registerAddLink = useCallback(fn => setAddLinkFn(fn ? () => fn : null), [])

  return (
    <div className="page-container-locked" style={{ background: C.bg }}>
      <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#06b6d4', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>{title}</div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {addLinkFn && activeTab === 'documents' && (
            <button
              type="button"
              onClick={addLinkFn}
              title="Ajouter un lien"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(124,58,237,0.15)', color: '#7c3aed', cursor: 'pointer' }}
            >
              <Link2 size={16} />
            </button>
          )}
          {addFn && (
            <button
              type="button"
              onClick={addFn}
              style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Plus size={14} />
              {addLabel}
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 20px 0' }}>
        <div className="documents-materials-tabs" data-active={activeTab} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 6, borderRadius: 18, background: C.surf2, border: `1px solid ${C.bord}`, marginBottom: 16, flexShrink: 0 }}>
          <div className="documents-materials-indicator" />
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => setActiveTab(tab.key)}
              style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: activeTab === tab.key ? '#fff' : C.t2, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <tab.Icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'documents' ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>
            <DocumentsPanel
            user={user}
            userData={userData}
            embedded
            onAddReady={registerAdd}
            onAddLinkReady={registerAddLink}
            highlightDocId={highlightDocId}
            highlightLienId={highlightLienId}
            onHighlightDone={clearHighlightParams}
          />
          </div>
        ) : (
          <MaterielsTab user={user} userData={userData} C={C} onAddReady={registerAdd} />
        )}
      </div>
    </div>
  )
}
