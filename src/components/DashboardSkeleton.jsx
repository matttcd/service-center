// ============================================
// DashboardSkeleton: Esqueleto de carga con shimmer
// que replica la estructura del Dashboard para
// evitar saltos visuales durante la carga inicial.
// ============================================
import Card from './Card.jsx'

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Cargando contenido">
      {/* Encabezado */}
      <div>
        <div className="h-7 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="mt-1.5 h-4 w-28 rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-2">
              <div className="h-6 w-10 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
          </Card>
        ))}
      </div>

      {/* Pestañas y cola de órdenes */}
      <Card className="!p-0 overflow-hidden">
        {/* Barra de pestañas simulada */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <div key={t} className="flex flex-1 items-center justify-center gap-2 py-3.5">
              <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="hidden sm:block h-3.5 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
              <div className="h-4 w-5 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>

        {/* Filas simuladas */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {[1, 2, 3, 4].map((r) => (
            <div key={r} className="flex items-center justify-between px-5 py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
                <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800/40" />
              </div>
              <div className="h-6 w-16 rounded-full bg-slate-200/70 dark:bg-slate-800/80" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
