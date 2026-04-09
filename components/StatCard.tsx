type StatCardProps = {
  label: string
  value: string
  helper?: string
  emphasis?: boolean
}

export function StatCard({ label, value, helper, emphasis = false }: StatCardProps) {
  return (
    <div className={`stat-card ${emphasis ? 'stat-card-emphasis' : ''}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {helper ? <p className="stat-helper">{helper}</p> : null}
    </div>
  )
}
