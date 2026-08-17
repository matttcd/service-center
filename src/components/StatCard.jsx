// ============================================
// StatCard: tarjeta de métrica del dashboard
// ============================================
import Card from './Card.jsx'

const accents = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  amber: 'bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  primary: 'bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400',
}

export default function StatCard({ icon: Icon, label, value, sub, accent = 'primary' }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-3 ${accents[accent] || accents.primary}`}>
          <Icon size={22} />
        </div>
      </div>
    </Card>
  )
}
