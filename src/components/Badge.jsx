// ============================================
// Badge reutilizable con tonos de color
// ============================================

const tones = {
  green: 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/50',
  red: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/25 dark:text-red-300 dark:border-red-500/50',
  darkred: 'bg-red-900 text-red-50 border border-red-700 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
  yellow: 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/50',
  orange: 'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/25 dark:text-orange-300 dark:border-orange-500/50',
  primary: 'bg-primary-100 text-primary-800 border border-primary-300 dark:bg-primary-500/25 dark:text-primary-300 dark:border-primary-500/50',
  slate: 'bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
}

export default function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tones[tone] || tones.slate} ${className}`}
    >
      {children}
    </span>
  )
}
