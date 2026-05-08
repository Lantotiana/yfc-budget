export default function DesktopTableCard({ title, columns = [], rows = [], empty = 'Aucune donnee', renderRow }) {
  return (
    <section className="desktop-section-card desktop-table-card">
      <div className="desktop-section-head">
        <h2>{title}</h2>
      </div>
      <div className="desktop-table-wrap">
        <table>
          <thead>
            <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length}>{empty}</td></tr>
            ) : rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </section>
  )
}
