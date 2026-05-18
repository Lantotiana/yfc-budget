import { LogIn, ShieldCheck, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Seo from '../components/Seo'
import logoYfc from '../assets/logo_yfc.png'

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Young For Christ',
  alternateName: 'YFC',
  url: 'https://young-for-christ.com/',
  logo: 'https://young-for-christ.com/logo_yfc.png',
  description: "Young For Christ (YFC) utilise son application officielle pour organiser l'espace interne des Staffs autorisés.",
}

export default function PublicLanding() {
  const navigate = useNavigate()

  return (
    <main className="public-landing">
      <Seo structuredData={organizationJsonLd} />

      <section className="public-hero" aria-labelledby="public-title">
        <div className="public-hero-content">
          <img src={logoYfc} alt="Logo Young For Christ" className="public-logo" />
          <p className="public-eyebrow">Application officielle YFC</p>
          <h1 id="public-title">Young For Christ</h1>
          <p className="public-lead">
            L'application Young For Christ centralise les outils internes YFC pour les Staffs autorisés :
            organisation, tâches, présences, documents et communication d'équipe.
          </p>
          <div className="public-actions">
            <button type="button" onClick={() => navigate('/login')}>
              <LogIn size={18} />
              Se connecter
            </button>
          </div>
        </div>
      </section>

      <section className="public-info" aria-label="Informations sur l'application YFC">
        <article>
          <ShieldCheck size={22} />
          <h2>Espace réservé</h2>
          <p>Les données internes sont protégées et accessibles uniquement aux Staffs YFC approuvés.</p>
        </article>
        <article>
          <UsersRound size={22} />
          <h2>Outil d'équipe</h2>
          <p>Cette plateforme aide Young For Christ à mieux coordonner ses activités et responsabilités.</p>
        </article>
      </section>
    </main>
  )
}
