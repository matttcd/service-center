// ============================================
// Badge reutilizable con tonos de color
// ============================================

const tones = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  darkred: 'bg-red-900 text-red-50 dark:bg-red-950 dark:text-red-200',
  yellow: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400',
  slate: 'bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
}

export default function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone] || tones.slate} ${className}`}
    >
      {children}
    </span>
  )
}
