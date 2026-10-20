import { prisma } from './db.js'
import { getPrintConfig, validatePrintConfig, listPrinters, printPdf, printRawLabel, printTransport } from './printing.js'
import { htmlToPdf } from './pdf/puppeteerPdf.js'
import { buildLabelHtml } from './pdf/labelTemplate.js'
import { businessDate } from '../shared/dates.js'

export async function labelPdf(order, customer, config) {
  return htmlToPdf(buildLabelHtml(order, customer, config), { width: config.labelWidthMm, height: config.labelHeightMm })
}

export async function sendLabel(order, customer, config) {
  if (config.labelFormat === 'pdf') return printPdf(await labelPdf(order, customer, config), config.labelPrinter, { label: true })
  return printRawLabel({ orderNumber: order.orderNumber, model: `${order.brand} ${order.model}`.trim(), customerName: customer?.fullName || '', date: businessDate(order.createdAt) }, config.labelPrinter)
}

export function registerPrintRoutes(app, { auth, adminOnly, commit }) {
  app.get('/api/printing/config', auth, adminOnly, async (_req, res) => {
    const result = await listPrinters()
    res.json({ config: await getPrintConfig(), transport: printTransport(), printers: result.printers || [], account: result.account || null, error: result.ok ? null : result.error })
  })
  app.put('/api/printing/config', auth, adminOnly, async (req, res) => {
    let config
    try { config = validatePrintConfig(req.body) }
    catch (error) { return res.status(400).json({ error: error.message }) }
    if (config.orderPrinter || config.labelPrinter) {
      const available = await listPrinters()
      if (!available.ok) return res.status(503).json({ error: available.error })
      if ([config.orderPrinter, config.labelPrinter].some((name) => name && !available.printers.includes(name))) return res.status(400).json({ error: 'La cuenta del servicio no puede acceder a una de las impresoras seleccionadas.' })
    }
    await commit((db) => db.config.upsert({ where: { key: 'printing' }, create: { key: 'printing', value: config }, update: { value: config } }))
    res.json({ ok: true, config })
  })
  app.post('/api/printing/test', auth, adminOnly, async (req, res) => {
    const kind = req.body?.kind
    if (!['order', 'label'].includes(kind)) return res.status(400).json({ error: 'Tipo de prueba inválido.' })
    const config = await getPrintConfig()
    if (!(kind === 'order' ? config.orderPrinter : config.labelPrinter)) return res.status(400).json({ error: 'Guardá primero la impresora para esta prueba.' })
    const result = kind === 'label'
      ? await sendLabel({ orderNumber: 'TEST0001', brand: 'Prueba', model: 'de etiqueta', createdAt: new Date() }, { fullName: 'Servicio técnico' }, config)
      : await printPdf(await htmlToPdf('<!doctype html><meta charset="utf-8"><style>body{font:16pt Arial;padding:20mm}</style><h1>Prueba de impresión</h1><p>Servicio técnico · Orden A4</p><p>Verificá que el texto se vea completo y legible.</p>'), config.orderPrinter)
    res.status(result.ok ? 200 : 502).json(result.ok ? { ok: true, status: 'submitted' } : { error: result.error })
  })
  app.get('/api/orders/:id/label-pdf', auth, async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { customer: true } })
    if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
    const buffer = await labelPdf(order, order.customer, await getPrintConfig())
    res.type('application/pdf').set('Content-Disposition', `inline; filename="etiqueta-${order.orderNumber}.pdf"`).send(buffer)
  })
}
