// Herramienta local del instalador. No expone una ruta HTTP de recuperación.
// El llamador elevado entrega la contraseña por stdin, nunca por argumentos.
let prisma, changed = false
try {
  const mode = process.argv[2]
  if (!['reset', 'verify'].includes(mode) || !process.env.SERVICE_CENTER_ENV_FILE) throw new Error()
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
    if (input.length > 2048) throw new Error()
  }
  const data = JSON.parse(input)
  if (typeof data.passwordBase64 !== 'string') throw new Error()
  const password = Buffer.from(data.passwordBase64, 'base64').toString('utf8')
  const { passwordError } = await import('./security.js')
  if (passwordError(password)) {
    console.log(JSON.stringify({ ok: false, changed, invalidPassword: true }))
    process.exitCode = 1
  } else {
    await import('./env.js')
    const port = Number(process.env.PORT)
    if (!process.env.INSTANCE_ID || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error()
    const base = `http://127.0.0.1:${port}`
    const health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(10000) }).then((response) => response.json())
    if (health.status !== 'ok' || health.instance !== process.env.INSTANCE_ID) throw new Error()
    ;({ prisma } = await import('./db.js'))
    const admin = await prisma.user.findFirst({ where: { email: 'admin@local.com', role: 'admin', active: true }, select: { id: true } })
    if (!admin) throw new Error()
    if (mode === 'reset') {
      const { default: bcrypt } = await import('bcryptjs')
      const hash = await bcrypt.hash(password, 12)
      await prisma.$transaction(async (db) => {
        const updated = await db.user.updateMany({ where: { id: admin.id, email: 'admin@local.com', role: 'admin', active: true }, data: { password: hash } })
        if (updated.count !== 1) throw new Error()
        await db.auditLog.create({ data: { userId: admin.id, action: 'password_reset_local', table: 'users', recordId: admin.id, details: 'Recuperación del administrador autorizada mediante permisos de Windows.' } })
      })
      changed = true
    }
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: admin.id, password }), signal: AbortSignal.timeout(10000),
    })
    // No devolver el token, los datos de conexión ni el hash al proceso llamador.
    console.log(JSON.stringify({ ok: response.status === 200, changed, loginStatus: response.status, needsRestart: response.status === 429 }))
    if (response.status !== 200 && response.status !== 429) process.exitCode = 1
  }
} catch {
  console.log(JSON.stringify({ ok: false, changed, recoveryError: true }))
  process.exitCode = 1
} finally { if (prisma) await prisma.$disconnect().catch(() => {}) }
