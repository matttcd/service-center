import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export async function verifyAdminRecovery({ payload, env, settings, envFile, restartServer }) {
  const base = 'http://127.0.0.1:8181'
  const password = 'Recuperación-local-Ñ-2026'
  const cli = (mode, input, status = 0) => {
    const result = spawnSync(path.join(payload, 'runtime/node/node.exe'), [path.join(payload, 'server/admin-recovery-cli.js'), mode], {
      env, input, windowsHide: true, encoding: 'utf8', timeout: 45000,
    })
    assert.equal(result.status, status, 'El CLI debe terminar con el resultado esperado sin exponer secretos.')
    const value = JSON.parse(result.stdout)
    assert.equal(result.stderr, '')
    assert.equal(result.stdout.includes(password), false)
    assert.equal('token' in value, false)
    return value
  }
  const encoded = (value) => JSON.stringify({ passwordBase64: Buffer.from(value).toString('base64') })
  const login = (value) => fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: value }),
  })
  const old = await login('Verification-admin-2026').then((response) => response.json())
  assert.ok(old.token)
  const before = await fetch(base + '/api/orders', { headers: { Authorization: `Bearer ${old.token}` } }).then((response) => response.json())
  assert.equal(cli('reset', encoded('admin123'), 1).invalidPassword, true)
  assert.equal(cli('reset', '{', 1).changed, false)
  assert.equal(cli('reset', 'x'.repeat(3000), 1).changed, false)
  assert.equal(cli('unknown', encoded(password), 1).changed, false)
  const original = fs.readFileSync(envFile)
  try {
    fs.writeFileSync(envFile, JSON.stringify({ ...settings, INSTANCE_ID: 'otra-instalacion' }))
    assert.equal(cli('reset', encoded(password), 1).changed, false)
  } finally { fs.writeFileSync(envFile, original) }
  assert.equal((await login('Verification-admin-2026')).status, 200)
  const reset = cli('reset', encoded(password))
  assert.equal(reset.ok, true)
  assert.equal(reset.changed, true)
  assert.equal(reset.loginStatus, 200)
  assert.equal((await fetch(base + '/api/bootstrap', { headers: { Authorization: `Bearer ${old.token}` } })).status, 401)
  assert.equal((await login('Verification-admin-2026')).status, 401)
  const fresh = await login(password).then((response) => response.json())
  assert.ok(fresh.token)
  const headers = { Authorization: `Bearer ${fresh.token}` }
  const after = await fetch(base + '/api/orders', { headers }).then((response) => response.json())
  assert.equal(after.total, before.total, 'La recuperación conserva las órdenes.')
  const audit = await fetch(base + '/api/audit', { headers }).then((response) => response.json())
  assert.equal(audit.logs.filter((log) => log.action === 'password_reset_local').length, 1)
  assert.equal(cli('verify', encoded(password)).changed, false)
  assert.equal((await fetch(base + '/api/bootstrap', { headers })).status, 200)
  // Un bloqueo vigente no implica repetir la mutación: reiniciar y verificar.
  for (let n = 0; n < 5; n++) await login('Intento-incorrecto')
  const blocked = cli('reset', encoded(password))
  assert.equal(blocked.changed, true)
  assert.equal(blocked.needsRestart, true)
  await restartServer()
  const verified = cli('verify', encoded(password))
  assert.equal(verified.ok, true)
  assert.equal(verified.changed, false)
  console.log('✓ Recuperación local: identidad, contraseñas Unicode, validación, auditoría, sesiones invalidadas y bloqueo por intentos fallidos.')
}
