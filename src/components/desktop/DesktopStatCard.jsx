export default function DesktopStatCard({ label, value, detail, color = '#0cc0df', Icon, onClick }) {
  const Element = onClick ? 'button' : 'div'

  return (
    <Element type={onClick ? 'button' : undefined} onClick={onClick} className="desktop-stat-card">
      <div className="desktop-stat-icon" style={{ '--stat-color': color }}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="desktop-stat-body">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </Element>
  )
}
