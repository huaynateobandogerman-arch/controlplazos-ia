import { parseLocalDate, requiredFields } from '../src/csv.js'

function configuration() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key || url.startsWith('PEGA_AQUI') || key.startsWith('PEGA_AQUI')) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null
    return { url: parsed.origin, key }
  } catch { return null }
}

export function normalizeRecords(records) {
  if (!Array.isArray(records) || !records.length) throw new Error('Registros inválidos')
  const unique = new Map()
  for (const row of records) {
    if (!row || !requiredFields.every(field => typeof row[field] === 'string')) throw new Error('Registros inválidos')
    const clean = Object.fromEntries(requiredFields.map(field => [field, row[field].trim()]))
    const date = parseLocalDate(clean.fecha_vencimiento)
    if (!clean.caso || !date) throw new Error('Registros inválidos')
    clean.fecha_vencimiento = `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    unique.set(clean.caso, clean)
  }
  return [...unique.values()]
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const fail = (status, error) => res.status(status).json({ error })
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return fail(405, 'Operación no disponible.') }
  let records
  if (req.method === 'POST') {
    if (!req.headers['content-type']?.includes('application/json')) return fail(415, 'Formato de consulta inválido.')
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (Buffer.byteLength(JSON.stringify(body) ?? '') > 200000) return fail(413, 'El CSV es demasiado grande para guardarlo. Usa un archivo más pequeño.')
      records = normalizeRecords(body?.records)
    } catch { return fail(400, 'Revisa el CSV: cada registro debe tener un caso no vacío, las seis columnas y una fecha válida.') }
  }
  const config = configuration()
  if (!config) return fail(503, 'Falta configurar Supabase en el archivo .env y reiniciar la aplicación.')
  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' }
  try {
    if (records) {
      const response = await fetch(`${config.url}/rest/v1/casos?on_conflict=caso`, {
        method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(records), signal: AbortSignal.timeout(30000), redirect: 'error',
      })
      if (!response.ok) return fail(502, 'No se pudieron guardar los casos. Revisa la configuración de Supabase y que la tabla casos esté creada.')
      return res.status(200).json({ saved: records.length })
    }
    // Paginar hasta agotar resultados; no asumir el límite de filas del proyecto.
    const all = []
    let offset = 0
    while (true) {
      const response = await fetch(`${config.url}/rest/v1/casos?select=${requiredFields.join(',')}&order=caso.asc&offset=${offset}&limit=1000`, { headers, signal: AbortSignal.timeout(30000), redirect: 'error' })
      if (!response.ok) return fail(502, 'No se pudieron recuperar los casos. Revisa la configuración de Supabase y que la tabla casos esté creada.')
      const page = await response.json()
      if (!Array.isArray(page)) throw new Error()
      if (!page.length) break
      all.push(...page)
      offset += page.length
    }
    return res.status(200).json({ records: all })
  } catch { return fail(502, 'No se pudo completar la conexión con Supabase. Verifica tu conexión y vuelve a intentarlo.') }
}
