import { useEffect } from 'react'

const SITE_URL = 'https://young-for-christ.com'
const DEFAULT_TITLE = 'Young For Christ - Application officielle YFC'
const DEFAULT_DESCRIPTION = "Application officielle Young For Christ (YFC) pour accompagner l'organisation interne des Staffs autorisés."
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`

function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = `${SITE_URL}/`,
  robots = 'index, follow',
  image = DEFAULT_IMAGE,
  structuredData = null,
}) {
  useEffect(() => {
    document.title = title

    setMeta('meta[name="description"]', { name: 'description', content: description })
    setMeta('meta[name="robots"]', { name: 'robots', content: robots })
    setMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#16B5A3' })
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    setMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Young For Christ' })
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    setLink('canonical', canonical)

    const id = 'seo-json-ld'
    let script = document.getElementById(id)
    if (structuredData) {
      if (!script) {
        script = document.createElement('script')
        script.id = id
        script.type = 'application/ld+json'
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(structuredData)
    } else if (script) {
      script.remove()
    }
  }, [canonical, description, image, robots, structuredData, title])

  return null
}

export function PrivateSeo() {
  return (
    <Seo
      title="Young For Christ - Espace Staff"
      description="Espace interne Young For Christ réservé aux Staffs autorisés."
      canonical={`${SITE_URL}/login`}
      robots="noindex, nofollow"
      structuredData={null}
    />
  )
}

