import { describe, it, expect, vi } from 'vitest'
import { createRefreshQueue } from '../../src/utils/refreshQueue.js'

describe('sincronización después de guardar', () => {
  it('espera la descarga compartida y devuelve el resultado a todos', async () => {
    let complete
    const task = vi.fn(() => new Promise((resolve) => { complete = resolve }))
    const queue = createRefreshQueue(task, 1)
    const first = queue.schedule({ silent: true })
    const second = queue.schedule({ silent: true, immediate: true })
    let finished = false
    first.then(() => { finished = true })
    await Promise.resolve()
    expect(task).toHaveBeenCalledTimes(1)
    expect(finished).toBe(false)
    complete({ orders: [1] })
    expect(await first).toEqual({ orders: [1] })
    expect(await second).toEqual({ orders: [1] })
  })
  it('no oculta una recarga visible al combinarla con un evento silencioso', async () => {
    const task = vi.fn()
    const queue = createRefreshQueue(task)
    const first = queue.schedule()
    await queue.schedule({ silent: true, immediate: true })
    await first
    expect(task).toHaveBeenCalledWith(expect.objectContaining({ silent: false }))
  })
  it('cancelar al salir resuelve las esperas y no descarga datos', async () => {
    const task = vi.fn()
    const queue = createRefreshQueue(task)
    const pending = queue.schedule()
    queue.cancel()
    await pending
    expect(task).not.toHaveBeenCalled()
  })
  it('propaga un error a quienes esperan la misma descarga', async () => {
    const queue = createRefreshQueue(() => { throw new Error('offline') })
    await expect(queue.schedule({ immediate: true })).rejects.toThrow('offline')
  })
})
