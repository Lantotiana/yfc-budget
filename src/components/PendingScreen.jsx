import { CheckCircle, Clock, Mail } from 'lucide-react'
import logoYfc from '../assets/logo_yfc.png'

const T = '--teal'
const teal = 'var(--teal)'
const tealD = 'rgba(22,181,163,0.10)'
const tealB = 'rgba(22,181,163,0.18)'

function StatusItem({ icon: Icon, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: tealD, border: `1.5px solid ${tealB}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} color={teal} strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </div>
  )
}

export default function PendingScreen({ nom = 'Toi', onBack }) {
  const prenom = (nom || '').split(' ')[0]
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-body)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 18px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo + titre */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
            margin: '0 auto 18px',
            boxShadow: '0 4px 20px rgba(22,181,163,0.20)',
            border: `2px solid ${tealB}`,
          }}>
            <img src={logoYfc} alt="YFC" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: teal, marginBottom: 10,
          }}>
            Demande envoyée
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0 }}>
            Merci, <span style={{ color: teal }}>{prenom}</span>&nbsp;!
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            Nous avons bien reçu votre demande d'inscription.
          </p>
        </div>

        {/* Étapes */}
        <div style={{
          background: 'var(--surf)',
          border: '1px solid var(--border-light)',
          borderRadius: 20,
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          marginBottom: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <StatusItem
            icon={CheckCircle}
            title="Compte créé avec succès"
            desc="Vos informations ont bien été enregistrées dans notre système."
          />
          <div style={{ height: 1, background: 'var(--border-light)' }} />
          <StatusItem
            icon={Clock}
            title="En attente d'approbation"
            desc="L'administrateur va examiner votre demande et l'approuver très prochainement."
          />
          <div style={{ height: 1, background: 'var(--border-light)' }} />
          <StatusItem
            icon={Mail}
            title="Notification par email"
            desc="Vous recevrez un email dès que votre compte sera approuvé."
          />
        </div>

        {/* Bénédiction */}
        <div style={{
          background: tealD,
          border: `1px solid ${tealB}`,
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 20,
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: teal }}>Que Dieu vous bénisse&nbsp;!</span><br />
            L'équipe Young For Christ vous accueille chaleureusement.
          </p>
        </div>

        {/* Bouton retour */}
        <button
          onClick={onBack}
          style={{
            width: '100%', padding: '13px',
            borderRadius: 12, border: '1.5px solid var(--border-input)',
            background: 'var(--surf)', color: 'var(--text-primary)',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Retour à la connexion
        </button>

      </div>
    </div>
  )
}
