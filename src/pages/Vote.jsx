import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Send, Trophy, UserRound, Utensils, X } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import Seo from '../components/Seo'
import { cloudFunctions } from '../firebaseFunctions'
import entree11 from '../assets/Vote/Entree 11.jpg'
import entree12 from '../assets/Vote/Entree 12.jpg'
import entree13 from '../assets/Vote/Entree 13.jpg'
import entree14 from '../assets/Vote/Entree 14.jpg'
import entree15 from '../assets/Vote/Entree 15.jpg'
import entree21 from '../assets/Vote/Entree 21.jpg'
import entree22 from '../assets/Vote/Entree 22.jpg'
import entree23 from '../assets/Vote/Entree 23.jpg'
import entree24 from '../assets/Vote/Entree 24.jpg'
import entree25 from '../assets/Vote/Entree 25.jpg'

const firstEntries = [
  { value: '1', title: 'Entrée 1', accent: '#e23d7f', image: entree11 },
  { value: '2', title: 'Entrée 2', accent: '#171017', image: entree12 },
  { value: '3', title: 'Entrée 3', accent: '#c9f24d', image: entree13 },
  { value: '4', title: 'Entrée 4', accent: '#ff8fb8', image: entree14 },
  { value: '5', title: 'Entrée 5', accent: '#7c3f58', image: entree15 },
]

const secondEntries = [
  { value: '1', title: 'Entrée 1', accent: '#e23d7f', image: entree21 },
  { value: '2', title: 'Entrée 2', accent: '#171017', image: entree22 },
  { value: '3', title: 'Entrée 3', accent: '#c9f24d', image: entree23 },
  { value: '4', title: 'Entrée 4', accent: '#ff8fb8', image: entree24 },
  { value: '5', title: 'Entrée 5', accent: '#7c3f58', image: entree25 },
]

function emptyCounts() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

function VoteResults({ title, entries, counts, winner }) {
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0)
  const winningEntry = entries.find(entry => entry.value === winner) || entries[0]

  return (
    <section className="vote-results-card">
      <div className="vote-results-head">
        <div>
          <span>Résultat en direct</span>
          <h2>{title}</h2>
        </div>
        <strong><Trophy size={17} /> {winningEntry.title}</strong>
      </div>

      <div className="vote-result-bars">
        {entries.map(entry => {
          const count = Number(counts?.[entry.value] || 0)
          const percent = total ? Math.round((count / total) * 100) : 0
          return (
            <div className="vote-result-row" key={entry.value} style={{ '--vote-accent': entry.accent }}>
              <span>{entry.title}</span>
              <div aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>
              <em>{count}</em>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function VoteOption({ option, selected, onSelect, groupLabel }) {
  return (
    <button
      type="button"
      className={`vote-option${selected ? ' selected' : ''}`}
      onClick={() => onSelect(option.value)}
      style={{ '--vote-accent': option.accent }}
      aria-pressed={selected}
    >
      <span className="vote-option-image">
        <img src={option.image} alt={`${groupLabel} - ${option.title}`} loading="lazy" />
      </span>
      <span className="vote-option-text">
        <strong>{option.title}</strong>
        <small>{groupLabel}</small>
      </span>
      <span className="vote-option-check">
        <CheckCircle2 size={19} />
      </span>
    </button>
  )
}

function WinnerCard({ label, entry, count }) {
  return (
    <article className="vote-winner-card" style={{ '--vote-accent': entry.accent }}>
      <img src={entry.image} alt={`${label} - ${entry.title}`} />
      <div>
        <span>{label}</span>
        <strong>{entry.title}</strong>
        <em>{Number(count || 0)} vote{Number(count || 0) > 1 ? 's' : ''}</em>
      </div>
    </article>
  )
}

export default function Vote() {
  const [name, setName] = useState('')
  const [firstChoice, setFirstChoice] = useState('')
  const [secondChoice, setSecondChoice] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [showResultsPopup, setShowResultsPopup] = useState(false)
  const [results, setResults] = useState({
    first: emptyCounts(),
    second: emptyCounts(),
    firstWinner: '1',
    secondWinner: '1',
    total: 0,
  })

  const canSubmit = useMemo(
    () => name.trim() && firstChoice && secondChoice && status !== 'submitting',
    [name, firstChoice, secondChoice, status],
  )
  const firstWinnerEntry = firstEntries.find(entry => entry.value === results.firstWinner) || firstEntries[0]
  const secondWinnerEntry = secondEntries.find(entry => entry.value === results.secondWinner) || secondEntries[0]

  async function refreshResults() {
    try {
      const getVoteResults = httpsCallable(cloudFunctions, 'getVoteResults')
      const response = await getVoteResults()
      setResults({
        first: { ...emptyCounts(), ...(response.data?.first || {}) },
        second: { ...emptyCounts(), ...(response.data?.second || {}) },
        firstWinner: response.data?.firstWinner || '1',
        secondWinner: response.data?.secondWinner || '1',
        total: Number(response.data?.total || 0),
      })
    } catch {
      // Results are helpful, but voting must stay usable if the summary is temporarily unavailable.
    }
  }

  useEffect(() => {
    refreshResults()
    const id = window.setInterval(refreshResults, 5000)
    return () => window.clearInterval(id)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!name.trim() || !firstChoice || !secondChoice) {
      setError('Ampidiro ny anaranao ary safidio ny entrée roa.')
      return
    }

    try {
      setStatus('submitting')
      const submitVote = httpsCallable(cloudFunctions, 'submitVote')
      await submitVote({
        name: name.trim(),
        firstChoice: `1ère entrée - ${firstChoice}`,
        secondChoice: `2ème entrée - ${secondChoice}`,
        userAgent: navigator.userAgent,
      })
      refreshResults()
      setStatus('success')
    } catch (err) {
      setStatus('idle')
      const code = String(err?.code || '').toLowerCase()
      if (code.includes('not-found') || code.includes('internal')) {
        setError("Le service de vote n'est pas encore disponible. Il faut deployer la fonction Firebase submitVote.")
      } else if (code.includes('failed-precondition') || code.includes('permission-denied')) {
        setError("Le Google Sheet n'est pas encore pret pour recevoir les votes.")
      } else {
        setError(err?.message || 'Tsy tafavoaka ny vote. Andramo indray azafady.')
      }
    }
  }

  return (
    <main className="vote-page">
      <Seo
        title="Vote - Choix menu"
        description="Vote public pour choisir les entrées du menu."
        canonical="https://young-for-christ.com/vote"
        robots="noindex, nofollow"
      />

      <section className="vote-shell">
        <div className="vote-hero">
          <div>
            <h1>Choix menu Entrée Espace Fitsikiana - 30 mai</h1>
            <span>Misafidiana izay entrée mahafinaritra anao. 1ère entrée iray ary 2ème entrée iray.</span>
          </div>
        </div>

        <div className="vote-results-grid">
          <VoteResults
            title="1ère entrée"
            entries={firstEntries}
            counts={results.first}
            winner={results.firstWinner}
          />
          <VoteResults
            title="2ème entrée"
            entries={secondEntries}
            counts={results.second}
            winner={results.secondWinner}
          />
        </div>

        <button
          type="button"
          className="vote-show-results"
          onClick={() => {
            refreshResults()
            setShowResultsPopup(true)
          }}
        >
          <Trophy size={18} />
          Afficher résultat
        </button>

        {status === 'success' ? (
          <div className="vote-success">
            <CheckCircle2 size={42} />
            <h2>Misaotra betsaka!</h2>
            <p>Voaray tsara ny valinteninao.</p>
          </div>
        ) : (
          <form className="vote-form" onSubmit={handleSubmit}>
            <label className="vote-name-field">
              <span><UserRound size={18} /> Nom</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Soraty eto ny anaranao..."
                autoComplete="name"
              />
            </label>

            <section className="vote-section">
              <div className="vote-section-head">
                <Utensils size={18} />
                <h2>1ère entrée</h2>
              </div>
              <div className="vote-options-grid">
                {firstEntries.map(option => (
                  <VoteOption
                    key={option.value}
                    option={option}
                    selected={firstChoice === option.value}
                    onSelect={setFirstChoice}
                    groupLabel="Choix 1"
                  />
                ))}
              </div>
            </section>

            <section className="vote-section">
              <div className="vote-section-head">
                <Utensils size={18} />
                <h2>2ème entrée</h2>
              </div>
              <div className="vote-options-grid">
                {secondEntries.map(option => (
                  <VoteOption
                    key={option.value}
                    option={option}
                    selected={secondChoice === option.value}
                    onSelect={setSecondChoice}
                    groupLabel="Choix 2"
                  />
                ))}
              </div>
            </section>

            {error ? <p className="vote-error">{error}</p> : null}

            <button type="submit" className="vote-submit" disabled={!canSubmit}>
              <Send size={18} />
              {status === 'submitting' ? 'Envoi...' : 'Envoyer mon choix'}
            </button>
          </form>
        )}
      </section>

      {showResultsPopup && (
        <div className="vote-result-modal-overlay" onClick={() => setShowResultsPopup(false)}>
          <div className="vote-result-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="vote-result-modal-close" onClick={() => setShowResultsPopup(false)} aria-label="Fermer">
              <X size={20} />
            </button>
            <div className="vote-result-modal-head">
              <Trophy size={26} />
              <span>Résultats gagnants</span>
              <h2>Entrées sélectionnées</h2>
            </div>
            <div className="vote-winner-grid">
              <WinnerCard label="1ère entrée" entry={firstWinnerEntry} count={results.first?.[firstWinnerEntry.value]} />
              <WinnerCard label="2ème entrée" entry={secondWinnerEntry} count={results.second?.[secondWinnerEntry.value]} />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
