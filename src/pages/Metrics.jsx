import { useState } from 'react'
import { Wallet, Timer, PackageCheck, PackageOpen, TrendingUp, Smartphone } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import PageHeading from '../components/PageHeading.jsx'
import { formatMoney, formatDate } from '../utils/helpers.js'

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const INCOME_PERIODS = [['today', 'Hoy'], ['week', 'Esta semana'], ['month', 'Este mes']]

function Bars({ items, accent = false }) {
  const max = Math.max(1, ...items.map(({ count }) => count))
  return items.length ? <ul className={`sc-metric-bars ${accent ? 'accent' : ''}`}>
    {items.map(({ label, shortLabel, count }) => <li key={label} title={`${label} · ${count}`}>
      <span className="sc-metric-count">{count}</span>
      <span className="sc-metric-bar" aria-hidden="true" style={{ height: `${count ? Math.max(3, count / max * 64) : 2}px` }} />
      <span className="sc-metric-label">{shortLabel || label}</span>
    </li>)}
  </ul> : <p className="sc-secondary">Sin datos.</p>
}

function Ranking({ title, icon: Icon, items }) {
  return <Card className="sc-metric-panel sc-metric-ranking-panel">
    <h2><Icon size={16} aria-hidden="true" />{title}</h2>
    {items.length ? <ol className="sc-metric-ranking">
      {items.map(({ name, count }, index) => <li key={name}><span aria-hidden="true">{index + 1}</span><span>{name}</span><strong>{count}</strong></li>)}
    </ol> : <p className="sc-secondary">Sin datos.</p>}
  </Card>
}

function DispositivosRecibidos({ devices }) {
  const [mode, setMode] = useState('week')
  const items = mode === 'week' ? devices.weeks.map((item) => ({
    ...item,
    shortLabel: item.label.split(' - ')[0].split('/').slice(0, 2).join('/'),
  })) : devices.months
  return <Card className="sc-metric-panel sc-metric-chart">
    <header>
      <h2><Smartphone size={16} aria-hidden="true" />Equipos recibidos</h2>
      <select className="ws-button" aria-label="Período de equipos recibidos" value={mode} onChange={(event) => setMode(event.target.value)}>
        <option value="week">Por semana</option>
        <option value="month">Por mes</option>
      </select>
    </header>
    <Bars items={items} accent />
  </Card>
}

export default function Metrics() {
  const { adminMetrics, adminMetricsError } = useData()
  return <div>
    <PageHeading title="Métricas" description="Indicadores del negocio" />
    {adminMetricsError ? <Card className="sc-metric-panel"><p role="alert">No se pudieron cargar las métricas. {adminMetricsError}</p></Card>
      : adminMetrics ? <MetricsContent metrics={adminMetrics} />
        : <Card className="sc-metric-panel"><p className="sc-secondary">Todavía no hay métricas para mostrar.</p></Card>}
  </div>
}

function MetricsContent({ metrics }) {
  const { income, avgRepairDaysByTech, deliveredByDay, devicesByPeriod, topBrands, topModels, totals } = metrics
  return <div className="sc-metrics">
    <Card className="sc-metric-panel sc-metric-wide">
      <h2><Wallet size={16} aria-hidden="true" />Ingresos por entregas</h2>
      <dl className="sc-metric-income">
        {INCOME_PERIODS.map(([key, label]) => <div key={key}>
          <dt>{label}</dt><dd>{formatMoney(income[key])}</dd>
          {key === 'month' && <dd className="sc-secondary">{totals.deliveredMonth} entregados</dd>}
        </div>)}
      </dl>
    </Card>
    <Card className="sc-metric-panel sc-metric-chart">
      <h2><PackageCheck size={16} aria-hidden="true" />Entregas de los últimos 7 días</h2>
      <Bars items={deliveredByDay.map(({ date, count }) => ({
        label: formatDate(date), shortLabel: DAYS[new Date(`${date}T12:00:00`).getDay()], count,
      }))} />
    </Card>
    <DispositivosRecibidos devices={devicesByPeriod} />
    <Ranking title="Marcas más reparadas" icon={TrendingUp} items={topBrands} />
    <Ranking title="Modelos más reparados" icon={PackageOpen} items={topModels} />
    <Card className="sc-metric-panel sc-metric-people">
      <h2><Timer size={16} aria-hidden="true" />Tiempo promedio de reparación</h2>
      {avgRepairDaysByTech.length ? <table className="sc-metric-tech">
        <thead><tr><th scope="col">Técnico</th><th scope="col">Entregas</th><th scope="col">Promedio</th></tr></thead>
        <tbody>{avgRepairDaysByTech.map(({ technicianId, name, count, avgDays }) => <tr key={technicianId}><th scope="row">{name}</th><td>{count}</td><td>{avgDays} días</td></tr>)}</tbody>
      </table> : <p className="sc-secondary">No hay entregas registradas todavía.</p>}
    </Card>
    <p className="sc-secondary sc-metric-wide text-right">Actualizado al {formatDate(new Date().toISOString().slice(0, 10))}</p>
  </div>
}
