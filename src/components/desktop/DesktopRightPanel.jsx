import { useEffect, useState } from 'react'
import { BookOpen, RefreshCw, Sparkles } from 'lucide-react'
import { generateNewVerse, getVerseOfDay } from '../../services/verseOfDay'

export default function DesktopRightPanel() {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getVerseOfDay().then(setVerse)
  }, [])

  async function refreshVerse() {
    if (loading) return
    setLoading(true)
    const next = await generateNewVerse()
    if (next) setVerse(next)
    setLoading(false)
  }

  return (
    <aside className="desktop-right-panel">
      <div className="desktop-right-card desktop-verse-card">
        <div className="desktop-verse-head">
          <span><BookOpen size={16} /> Verset du jour</span>
          <button type="button" onClick={refreshVerse} disabled={loading} aria-label="Renouveler le verset">
            <RefreshCw size={15} />
          </button>
        </div>

        {verse ? (
          <>
            <p className="desktop-verse-text">{verse.text}</p>
            <strong>{verse.ref}</strong>
            {verse.explanation && <small>{verse.explanation}</small>}
          </>
        ) : (
          <div className="desktop-verse-empty">
            <Sparkles size={20} />
            <p>Le verset sera disponible après la connexion aux fonctions Firebase.</p>
          </div>
        )}
      </div>
    </aside>
  )
}
