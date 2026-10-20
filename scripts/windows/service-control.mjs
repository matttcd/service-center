import '../../server/env.js'
import net from 'node:net'
const command = process.argv[2] || 'status'
if (!['status', 'shutdown', 'maintenance', 'resume', 'printers'].includes(command)) throw new Error('Comando de servicio inválido.')
const token = process.env.SERVICE_CONTROL_TOKEN
if (!token || !process.env.SERVICE_CONTROL_PIPE) throw new Error('Falta la configuración de control del servicio.')
await new Promise((resolve, reject) => {
  const socket = net.connect(process.env.SERVICE_CONTROL_PIPE, () => socket.write(JSON.stringify({ command, token }) + '\n'))
  socket.setTimeout(command === 'printers' ? 75000 : command === 'maintenance' ? 35000 : 15000)
  socket.on('timeout', () => socket.destroy(new Error('El servicio no respondió.')))
  socket.on('error', reject)
  let response = ''
  socket.on('close', () => { if (!response.includes('\n')) reject(new Error('El servicio cerró la conexión sin confirmar el comando.')) })
  socket.on('data', (chunk) => {
    response += chunk
    if (response.length > 2 * 1024 * 1024) return socket.destroy(new Error('Respuesta de control demasiado grande.'))
    if (response.includes('\n')) {
      socket.end()
      try {
        const result = JSON.parse(response)
        if (!result.ok) reject(new Error(result.error || 'El servicio rechazó el control.'))
        else { if (command === 'printers') console.log(JSON.stringify(result)); resolve() }
      } catch (error) { reject(error) }
    }
  })
})
