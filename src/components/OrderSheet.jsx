import { formatDni } from '../utils/helpers.js'
import { Link } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, KeyRound, IdCard, Grid3X3, Smartphone, Cable } from 'lucide-react'
import { PatternPreview } from './PatternPad.jsx'
import { ORDER_STATUS_LABEL, orderStatusTone } from '../utils/helpers.js'
import { acceptanceDate } from '../../shared/order-workspace.js'

const formatDateTime = (value) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value)) : '—'

export function OrderStatus({ order }) {
  return <span className={`ws-status ws-status-${orderStatusTone(order.status)}`}><span />{ORDER_STATUS_LABEL[order.status] || order.status}</span>
}

export default function OrderSheet({ order, customer, onBack, tools, children, footer, technical }) {
  const name = customer?.fullName || order.customerName || 'Cliente sin registrar'
  const fact = (label, value, Icon) => <div key={label} className={label === 'Patrón' ? 'ws-pattern' : undefined}><dt>{Icon && <Icon size={14} aria-hidden="true" />}{label}</dt><dd>{value || '—'}</dd></div>
  const event = (at, by) => [at && formatDateTime(at), by].filter(Boolean).join(' · ')
  const accepted = acceptanceDate(order)
  const priorState = [...(order.history || [])].reverse().find((entry) => entry.status !== 'entregado')
  const completed = !order.rejectedAt && (order.status === 'terminado' || order.status === 'entregado' && priorState?.status === 'terminado') && !priorState?.note?.startsWith('Equipo devuelto por ')
  return <article className={`ws-order ws-sheet ${technical ? 'ws-technical' : ''}`} aria-label={`Orden ${order.orderNumber}`}>
    <header className="ws-order-header">
      {onBack && <button className="ws-icon-button ws-back" onClick={onBack} aria-label="Volver a la cola"><ArrowLeft size={18} /></button>}
      <div className="ws-identity"><h2>{order.brand} {order.model}</h2><p>{order.orderNumber} · {order.deviceType} · {order.isSimpleService ? 'Servicio simple' : order.diagnosisType === 'revision' ? 'Para revisión' : 'Reparación definida'}{order.warrantyReturn && ' · Garantía'}</p></div>
      <OrderStatus order={order} />
      {order.externalTech && <p className="ws-external">Externo: {order.externalTech}{order.externalSentAt && ` · Envío ${formatDateTime(order.externalSentAt)}`}{order.externalReturnAt && ` · Regreso ${formatDateTime(order.externalReturnAt)}`}</p>}
    </header>
    <div className="ws-order-body">
      <div className="ws-tools">{tools}</div>
      <dl className="ws-equipment">
        {fact('Contraseña o PIN', order.noPin ? 'Sin contraseña informada' : order.pin || 'Sin contraseña informada', KeyRound)}
        {order.pattern?.length > 0 && fact('Patrón', <div role="img" aria-label={`Patrón: ${order.pattern.map((n) => n + 1).join(', ')}`}><PatternPreview value={order.pattern} size={96} /></div>, Grid3X3)}
        {fact('Estado del equipo', order.conditions || 'Sin registrar', Smartphone)}
        {fact('Accesorios', order.accessories || 'Sin accesorios', Cable)}
      </dl>
      <div className="ws-context">{children}</div>
    </div>
    <aside className="ws-reference" aria-label="Cliente y seguimiento">
      <div className="ws-customer"><span className="ws-avatar" aria-hidden="true">{name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span><div><h3><Link to={`/clientes/${order.customerId}`}>{name}</Link></h3><p><IdCard size={14} /> DNI: {formatDni(customer?.dni) || '—'}</p></div></div>
      <dl className="ws-contact-list">{order.noContact && fact('Comunicación', 'Sin medio de comunicación · confirma en el local', Phone)}{fact('Teléfono', customer?.phone, Phone)}{fact('Teléfono 2', customer?.phone2, Phone)}{fact('Teléfono 3', customer?.phone3, Phone)}{fact('Correo', customer?.email, Mail)}{fact('Domicilio', customer?.address, MapPin)}</dl>
      <dl className="ws-tracking">
        {fact('Ingreso', formatDateTime(order.createdAt))}{fact('Recibió', order.receivedByName)}{fact('Técnico', order.assignedToName || 'Sin asignar')}{fact('Aceptado', accepted ? formatDateTime(accepted) : 'Sin fecha registrada')}
        {fact('Aviso al cliente', order.notified ? <>Avisado<span>{event(order.notifiedAt, order.notifiedByName)}</span></> : order.noContact ? 'Sin medio de comunicación' : 'Sin avisar')}
        {fact('Respuesta', order.rejectedAt ? <>Rechazado<span>{event(order.rejectedAt, order.rejectedByName)}</span></> : order.confirmed ? <>Aprobado<span>{event(order.confirmedAt, order.confirmedByName)}</span></> : 'Sin respuesta')}
        {completed && order.repairedBy && fact(order.isSimpleService ? 'Finalizó' : 'Reparó', order.repairedByName)}
        {order.deliveredAt && <>{fact('Entrega', event(order.deliveredAt, order.deliveredByName))}{fact('Retiró', order.pickupBy === 'third' ? `${order.pickupName} · DNI: ${formatDni(order.pickupDni)}` : 'Cliente titular')}</>}
      </dl>
    </aside>
    <footer className="ws-footer">{footer}</footer>
  </article>
}
