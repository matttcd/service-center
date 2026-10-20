// ============================================
// Metrics: KPIs del negocio (solo admin)
// ============================================
import { useState } from 'react'
import { Wallet, Timer, PackageCheck, PackageOpen, TrendingUp, Smartphone } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import StatCard from '../components/StatCard.jsx'
import { formatMoney, formatDate } from '../utils/helpers.js'

const DAY_LABEL = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function dayLabel(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number)
  return DAY_LABEL[new Date(y, m - 1, d).getDay()]
}

export default function Metrics() {
  const { adminMetrics, adminMetricsError } = useData()
  if (adminMetricsError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Métricas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Indicadores del negocio</p>
        </div>
        <Card className="p-10">
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            No se pudieron cargar las métricas. {adminMetricsError}
          </p>
        </Card>
      </div>
    )
  }
  if (!adminMetrics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Métricas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Indicadores del negocio</p>
        </div>
        <Card className="p-10">
          <p className="text-center text-sm text-slate-400">Todavía no hay métricas para mostrar.</p>
        </Card>
      </div>
    )
  }

  const { income, avgRepairDaysByTech, deliveredByDay, devicesByPeriod, topBrands, topModels, totals } = adminMetrics
  const maxDay = Math.max(1, ...deliveredByDay.map((d) => d.count))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Métricas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Indicadores del negocio</p>
      </div>

      {/* Ingresos */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <Wallet size={16} /> Ingresos (entregados)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Wallet} label="Hoy" value={formatMoney(income.today)} accent="primary" />
          <StatCard icon={Wallet} label="Esta semana" value={formatMoney(income.week)} accent="primary" />
          <StatCard icon={Wallet} label="Este mes" value={formatMoney(income.month)} sub={`${totals.deliveredMonth} entregados`} accent="amber" />
        </div>
      </div>

      {/* Entregas por día */}
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <PackageCheck size={16} /> Entregas últimos 7 días
        </h2>
        <div className="flex items-end gap-2">
          {deliveredByDay.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{d.count}</span>
              <div
                className="w-full rounded-t-md bg-primary-500/80 transition hover:bg-primary-600 dark:bg-primary-500/70"
                style={{ height: `${Math.max(4, (d.count / maxDay) * 80)}px` }}
              />
              <span className="text-[10px] text-slate-400">{dayLabel(d.date)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Dispositivos recibidos por semana / mes */}
      <DispositivosRecibidos devices={devicesByPeriod} />

      {/* Tiempo promedio por técnico */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <Timer size={16} /> Tiempo promedio de reparación
        </h2>
        {avgRepairDaysByTech.length === 0 ? (
          <Card className="p-6">
            <p className="text-center text-sm text-slate-400">No hay entregas registradas todavía.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {avgRepairDaysByTech.map((t) => (
              <StatCard
                key={t.technicianId}
                icon={Timer}
                label={t.name}
                value={`${t.avgDays} días`}
                sub={`${t.count} entrega(s)`}
                accent="primary"
              />
            ))}
          </div>
        )}
      </div>

      {/* Marcas y modelos más reparados */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <TrendingUp size={16} /> Marcas más reparadas
          </h2>
          {topBrands.length === 0 ? (
            <p className="text-center text-sm text-slate-400">Sin datos.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {topBrands.map((b, i) => (
                <li key={b.name} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 text-sm font-bold text-slate-300 dark:text-slate-600">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{b.name}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <PackageOpen size={16} /> Modelos más reparados
          </h2>
          {topModels.length === 0 ? (
            <p className="text-center text-sm text-slate-400">Sin datos.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {topModels.map((m, i) => (
                <li key={m.name} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 text-sm font-bold text-slate-300 dark:text-slate-600">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{m.name}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{m.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-right text-xs text-slate-400">
        Actualizado al {formatDate(new Date().toISOString().slice(0, 10))}
      </p>
    </div>
  )
}

function DispositivosRecibidos({ devices }) {
  const [mode, setMode] = useState('week')
  const items = mode === 'week' ? devices.weeks : devices.months
  const max = Math.max(1, ...items.map((d) => d.count))
  const btn = (active) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'bg-primary-600 text-white'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
    }`

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <Smartphone size={16} /> Dispositivos recibidos
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setMode('week')} className={btn(mode === 'week')}>
            Por semana
          </button>
          <button onClick={() => setMode('month')} className={btn(mode === 'month')}>
            Por mes
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-sm text-slate-400">Sin datos.</p>
      ) : (
        <div className="flex items-end gap-2">
          {items.map((d) => (
            <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5" title={d.label}>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{d.count}</span>
              <div
                className="w-full rounded-t-md bg-accent-500/80 transition group-hover:bg-accent-500 dark:bg-accent-500/70"
                style={{ height: `${Math.max(4, (d.count / max) * 80)}px` }}
              />
              <span className="max-w-full truncate text-[10px] text-slate-400">
                {mode === 'week' ? d.label.split(' - ').map((s) => s.split('/').slice(0, 2).join('/')).join(' - ') : d.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}