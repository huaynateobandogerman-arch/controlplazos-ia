import test from 'node:test'
import assert from 'node:assert/strict'
import handler, { normalizeRecords } from '../api/casos.js'

const row = { caso: '001', unidad: 'A', responsable: 'Ana', fecha_vencimiento: '05/09/2026', estado: 'Pendiente', observacion: '' }
async function call(method, body) {
  const res = { setHeader() {}, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } }
  await handler({ method, body, headers: { 'content-type': 'application/json' } }, res)
  return res
}
test('Normaliza fechas y duplicados; rechaza casos vacíos y fechas inválidas', () => {
  const records = normalizeRecords([row, { ...row, responsable: 'Luis' }])
  assert.equal(records.length, 1)
  assert.equal(records[0].responsable, 'Luis')
  assert.equal(records[0].fecha_vencimiento, '2026-09-05')
  assert.throws(() => normalizeRecords([{ ...row, caso: ' ' }]))
  assert.throws(() => normalizeRecords([{ ...row, fecha_vencimiento: '2026-02-30' }]))
})
test('Persistencia: configuración, upsert, paginación y errores seguros', async () => {
  const originalFetch = globalThis.fetch
  const previous = [process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY]
  try {
    delete process.env.SUPABASE_URL
    assert.equal((await call('GET')).code, 503)
    assert.equal((await call('DELETE')).code, 405)
    assert.equal((await call('POST', { records: [] })).code, 400)
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-secret'
    globalThis.fetch = async (url, options) => {
      assert.ok(url.endsWith('?on_conflict=caso'))
      assert.equal(options.headers.apikey, 'synthetic-secret')
      assert.equal(options.headers.Prefer, 'resolution=merge-duplicates,return=minimal')
      assert.equal(JSON.parse(options.body).length, 1)
      return { ok: true }
    }
    assert.deepEqual((await call('POST', { records: [row, row] })).data, { saved: 1 })
    let requests = 0
    globalThis.fetch = async (url) => {
      assert.ok(url.includes(`offset=${requests}`))
      requests++
      return { ok: true, json: async () => requests < 3 ? [{ ...row, caso: String(requests) }] : [] }
    }
    assert.equal((await call('GET')).data.records.length, 2)
    assert.equal(requests, 3)
    globalThis.fetch = async () => { throw new Error('synthetic-secret') }
    const failed = await call('GET')
    assert.equal(failed.code, 502)
    assert.ok(!JSON.stringify(failed.data).includes('synthetic-secret'))
  } finally {
    globalThis.fetch = originalFetch
    for (const [i, key] of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].entries()) {
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]
    }
  }
})
