// ============================================
// Badge reutilizable con tonos de color
// ============================================

const tones = {
  green: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300/70 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/40',
  red: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-300/70 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-500/40',
  darkred: 'bg-red-900 text-red-50 ring-1 ring-inset ring-red-700 dark:bg-red-950 dark:text-red-200 dark:ring-red-800',
  yellow: 'bg-accent-100 text-accent-800 ring-1 ring-inset ring-accent-300/70 dark:bg-accent-500/20 dark:text-accent-300 dark:ring-accent-500/40',
  orange: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300/70 dark:bg-orange-500/20 dark:text-orange-300 dark:ring-orange-500/40',
  primary: 'bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-300/70 dark:bg-primary-500/20 dark:text-primary-300 dark:ring-primary-500/40',
  slate: 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400/50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-500/40',
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
