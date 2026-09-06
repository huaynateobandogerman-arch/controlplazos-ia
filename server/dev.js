import http from 'node:http'
import { createServer } from 'vite'
import handler from '../api/chat.js'
import casesHandler from '../api/casos.js'

try { process.loadEnvFile('.env') } catch (error) { if (error.code !== 'ENOENT') throw new Error('No se pudo cargar el archivo .env.') }
const backend = http.createServer(async (req, res) => {
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)) }
  const route = { '/api/chat': handler, '/api/casos': casesHandler }[req.url]
  if (!route) return res.status(404).json({ error: 'Ruta no disponible.' })
  try {
    let size = 0
    const chunks = []
    for await (const chunk of req) {
      size += chunk.length
      if (size > 200000) { res.status(413).json({ error: 'El CSV es demasiado grande para esta consulta. Usa un archivo más pequeño.' }); return }
      chunks.push(chunk)
    }
    req.body = Buffer.concat(chunks).toString('utf8')
    await route(req, res)
  } catch { if (!res.writableEnded) res.status(400).json({ error: 'No se pudo leer la consulta.' }) }
})
let vite
try {
  await new Promise((resolve, reject) => { backend.once('error', reject); backend.listen(3001, '127.0.0.1', resolve) })
  vite = await createServer()
  await vite.listen()
  vite.printUrls()
  console.log('Backend local preparado. Ctrl+C detiene frontend y backend.')
} catch {
  console.error('No se pudo iniciar. Comprueba que los puertos 5173 y 3001 estén libres.')
  backend.close()
  await vite?.close()
  process.exit(1)
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { backend.close(); await vite.close(); process.exit(0) })
