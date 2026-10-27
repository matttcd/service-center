// ============================================
// Card: contenedor con sombra y bordes redondeados
// ============================================

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      {...props}
      className={`sc-card rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  )
}
