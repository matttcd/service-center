// Recuperación de bajas lógicas. El historial anterior permanece intacto.
export function registerTrashRoutes(app, { prisma, auth, adminOnly, commit, audit }) {
  app.get('/api/trash', auth, adminOnly, async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = 50
    const deleted = { deletedAt: { not: null } }
    const [orders, customers, orderCount, customerCount] = await Promise.all([
      prisma.order.findMany({ where: deleted, select: { id: true, orderNumber: true, brand: true, model: true, deletedAt: true, customer: { select: { fullName: true } } }, orderBy: { deletedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.customer.findMany({ where: deleted, select: { id: true, fullName: true, dni: true, deletedAt: true }, orderBy: { deletedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.order.count({ where: deleted }), prisma.customer.count({ where: deleted }),
    ])
    res.json({ orders, customers, orderCount, customerCount, page, limit })
  })

  app.post('/api/trash/orders/:id/restore', auth, adminOnly, async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { customer: true } })
    if (!order?.deletedAt) return res.status(404).json({ error: 'La orden no está en la papelera.' })
    await commit(async (db) => {
      if (order.customer.deletedAt) await db.customer.update({ where: { id: order.customerId }, data: { deletedAt: null } })
      await db.order.update({ where: { id: order.id }, data: { deletedAt: null, history: { create: { status: order.status, by: req.user.id, note: 'Restaurada desde la papelera' } } } })
      await audit('restore', 'orders', order.id, req.user.id, `Restauración de ${order.orderNumber}`, db)
    }, { useTransaction: true })
    res.json({ ok: true })
  })

  app.post('/api/trash/customers/:id/restore', auth, adminOnly, async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } })
    if (!customer?.deletedAt) return res.status(404).json({ error: 'El cliente no está en la papelera.' })
    await commit(async (db) => {
      await db.customer.update({ where: { id: customer.id }, data: { deletedAt: null } })
      // Solo recupera órdenes eliminadas junto a este cliente, no bajas previas.
      await db.order.updateMany({ where: { customerId: customer.id, deletedAt: customer.deletedAt }, data: { deletedAt: null } })
      await audit('restore', 'customers', customer.id, req.user.id, `Restauración de cliente ${customer.fullName}`, db)
    }, { useTransaction: true })
    res.json({ ok: true })
  })
}
