// Colapsa pedidos de sincronización y conserva las promesas de quienes esperan.
export function createRefreshQueue(task, delay = 120) {
  let timer
  let pending = []
  let options = {}
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const waiting = pending
    const current = options
    pending = []
    options = {}
    Promise.resolve().then(() => task(current)).then(
      (result) => waiting.forEach(({ resolve }) => resolve(result)),
      (error) => waiting.forEach(({ reject }) => reject(error)),
    )
  }
  return {
    schedule(next = {}) {
      options = { ...options, ...next, silent: pending.length ? options.silent === true && next.silent === true : next.silent === true }
      const promise = new Promise((resolve, reject) => pending.push({ resolve, reject }))
      clearTimeout(timer)
      if (next.immediate) flush()
      else timer = setTimeout(flush, delay)
      return promise
    },
    cancel() {
      clearTimeout(timer)
      timer = undefined
      pending.forEach(({ resolve }) => resolve())
      pending = []
      options = {}
    },
  }
}
