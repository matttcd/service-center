import { ArrowLeft, Clock3, Phone, Mail, MapPin, KeyRound, IdCard, Grid3X3, Smartphone, Cable } from 'lucide-react'
import { PatternPreview } from '../components/PatternPad.jsx'
import { STATUS_LABELS } from './preview-model.js'

const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format

export function Status({ order }) {
  const tone = order.status === 'entregado' || order.status === 'terminado' ? 'green'
    : ['presupuesto', 'falta_repuestos', 'presupuesto_rechazado'].includes(order.status) ? 'amber'
      : order.status === 'recibido' ? 'neutral' : 'blue'
  return <span className={`fp-status fp-status-${tone}`}><span />{STATUS_LABELS[order.status]}</span>
}

export default function OrderSheet({ order, customer, users, onBack, tools, children, footer, className = '' }) {
  const person = (id, name) => name || users?.find((user) => user.id === id)?.name || 'Sin registrar'
  const eventInfo = (at, id, name) => [at && date(at), (id || name) && person(id, name)].filter(Boolean).join(' · ')
  const name = customer?.name || order.customer
  return <article className={`fp-order fp-order-sheet ${className}`} aria-label={`Orden ${order.number}`}>
    <header className="fp-order-header">
      <button className="fp-back fp-link" onClick={onBack}><ArrowLeft size={18} /><span className="sr-only">Volver a la cola</span></button>
      <div className="fp-reception-identity">
        <div><h2>{order.brand} {order.model}</h2>
          <dl className="fp-reception-header-facts"><div><dt className="sr-only">Orden</dt><dd>{order.number}</dd></div><div><dt className="sr-only">Tipo de dispositivo</dt><dd>{order.deviceType || 'Sin registrar'}</dd></div><div><dt className="sr-only">Tipo de ingreso</dt><dd>{order.isSimpleService ? 'Servicio simple' : order.entry === 'repair' ? 'Reparación definida' : order.entry === 'review' ? 'Para revisión' : 'Sin registrar'}{order.warrantyReturn && ' · Garantía'}</dd></div></dl>
        </div>
      </div>
      <Status order={order} />
      {order.externalTech && <section className="fp-reception-external" aria-label="Técnico externo"><dl><div><dt>Externo</dt><dd>{order.externalTech}</dd></div><div><dt>Envío</dt><dd>{order.externalSentAt ? date(order.externalSentAt) : '—'}</dd></div><div><dt>Regreso</dt><dd>{order.externalReturnAt ? date(order.externalReturnAt) : '—'}</dd></div></dl></section>}
    </header>
    <div className="fp-order-body">
      <div className="fp-reception-secondary">{tools}</div>
      <section className="fp-reception-device" aria-labelledby="reception-ingress"><h3 id="reception-ingress" className="sr-only">Datos del equipo</h3><dl className="fp-reception-facts">
        <div className="fp-reception-access"><dt><KeyRound size={14} />Contraseña o PIN</dt><dd>{order.noPin ? 'Sin bloqueo' : order.access || 'Sin contraseña informada'}</dd></div>
        {!order.noPin && order.pattern?.length > 0 && <div className="fp-reception-pattern"><dt><Grid3X3 size={14} aria-hidden="true" />Patrón</dt><dd><div role="img" aria-label={`Patrón de desbloqueo: ${order.pattern.map((n) => n + 1).join(', ')}`}><PatternPreview value={order.pattern} size={96} /></div></dd></div>}
        <div><dt><Smartphone size={14} aria-hidden="true" />Estado del equipo</dt><dd>{order.conditions || 'Sin registrar'}</dd></div><div><dt><Cable size={14} aria-hidden="true" />Accesorios</dt><dd>{order.accessories || 'Sin accesorios'}</dd></div>
      </dl></section>
      <div className="fp-reception-context">{children}</div>
    </div>
    <aside className="fp-reception-reference" aria-label="Cliente y seguimiento">
      <section aria-labelledby="reception-customer">
        <div className="fp-reception-customer-identity"><span className="fp-avatar" aria-hidden="true">{name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('')}</span><div><h3 id="reception-customer"><span className="sr-only">Cliente: </span>{name}</h3><dl className="fp-reception-customer-id"><div><dt><IdCard size={14} aria-hidden="true" />DNI</dt><dd>{customer?.dni || '—'}</dd></div></dl></div></div>
        <dl className="fp-reception-contacts">
          <div><dt><Phone size={14} />Teléfono</dt><dd>{customer?.phone || order.phone || '—'}</dd></div><div><dt><Phone size={14} aria-hidden="true" />Teléfono 2</dt><dd>{customer?.phone2 || '—'}</dd></div><div><dt><Phone size={14} aria-hidden="true" />Teléfono 3</dt><dd>{customer?.phone3 || '—'}</dd></div>
          <div className="fp-contact-address"><dt><Mail size={14} />Correo</dt><dd>{customer?.email || '—'}</dd></div><div className="fp-contact-address"><dt><MapPin size={14} />Domicilio</dt><dd>{customer?.address || '—'}</dd></div>
        </dl>
      </section>
      <section className="fp-reception-tracking" aria-labelledby="reception-followup"><h3 id="reception-followup" className="sr-only"><Clock3 size={16} />Seguimiento</h3><dl>
        <div><dt>Ingreso</dt><dd>{date(order.createdAt)}</dd></div><div><dt>Recibió</dt><dd>{person(order.receivedBy, order.receivedByName)}</dd></div>
        <div><dt>Técnico</dt><dd>{order.assignedTo ? person(order.assignedTo) : 'Sin asignar'}</dd></div><div><dt>Aceptado</dt><dd>{order.acceptedAt ? date(order.acceptedAt) : 'Sin aceptar'}</dd></div>
        <div><dt>Aviso al cliente</dt><dd>{order.notified ? 'Avisado' : 'Sin avisar'}{order.notified && <span className="fp-data-event">{eventInfo(order.notifiedAt, order.notifiedBy, order.notifiedByName)}</span>}</dd></div>
        <div><dt>Respuesta</dt><dd>{order.rejectedCharge !== null ? 'Rechazado' : order.confirmed ? 'Aprobado' : 'Sin respuesta'}{order.confirmed && <span className="fp-data-event">{eventInfo(order.confirmedAt, order.confirmedBy, order.confirmedByName)}</span>}</dd></div>
        {(order.repairedBy || order.repairedByName) && <div><dt>Reparó</dt><dd>{person(order.repairedBy, order.repairedByName)}</dd></div>}

        {order.deliveredAt && <><div><dt>Entrega</dt><dd>{eventInfo(order.deliveredAt, order.deliveredBy, order.deliveredByName)}</dd></div><div><dt>Retiró</dt><dd>{order.pickup ? order.pickup.by === 'third' ? `${order.pickup.name} · DNI: ${order.pickup.dni}` : 'Cliente titular' : 'Sin registrar'}</dd></div><div><dt>Comprobante de retiro</dt><dd>{order.pickup ? order.pickup.withoutReceipt ? 'Sin comprobante' : 'Con comprobante' : 'Sin registrar'}</dd></div></>}
      </dl></section>
    </aside>
    <footer className="fp-action-dock">{footer}</footer>
  </article>
}
