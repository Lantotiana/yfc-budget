export default function DesktopSectionCard({ title, action, children, className = '' }) {
  return (
    <section className={`desktop-section-card ${className}`}>
      <div className="desktop-section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
