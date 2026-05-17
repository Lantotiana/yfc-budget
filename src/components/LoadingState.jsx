export default function LoadingState({ label = 'Chargement...', compact = false, className = '' }) {
  return (
    <div className={`loading-state${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <div className="loading-state-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
