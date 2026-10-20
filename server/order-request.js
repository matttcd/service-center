import { createHash } from 'node:crypto'

export function orderRequest(body, userId) {
  if (!body.requestId) return null
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId)) {
    throw Object.assign(new Error('Identificador de solicitud inválido.'), { status: 400 })
  }
  const fields = Object.entries(body).filter(([key]) => key !== 'requestId').sort(([a], [b]) => a.localeCompare(b))
  return { key: `order-request:${body.requestId}`, userId, hash: createHash('sha256').update(JSON.stringify([userId, fields])).digest('hex') }
}

export async function previousOrderRequest(db, request, include) {
  if (!request) return null
  const stored = await db.config.findUnique({ where: { key: request.key } })
  if (!stored) return null
  if (stored.value.hash !== request.hash || stored.value.userId !== request.userId) {
    throw Object.assign(new Error('Esta solicitud ya creó una orden con otros datos. Revisá el listado antes de crear otra.'), { status: 409 })
  }
  const order = await db.order.findUnique({ where: { id: stored.value.orderId }, include })
  if (!order || order.deletedAt) throw Object.assign(new Error('La orden original ya no está disponible. Revisá la papelera.'), { status: 409 })
  return order
}
