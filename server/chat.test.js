import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/chat.js'

const body = { question: '¿Qué casos tiene Ana?', today: '2026-09-05', records: [{ caso: '001', unidad: 'A', responsable: 'Ana', fecha_vencimiento: '2026-09-04', estado: 'Pendiente', observacion: 'Revisar' }] }
async function call(payload = body, method = 'POST') {
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } }
  await handler({ method, headers: { 'content-type': 'application/json' }, body: payload }, res)
  return res
}
test('Backend: validación, clave ausente, éxito y errores sin filtrar secretos', async () => {
  const originalKey = process.env.OLLAMA_API_KEY
  const originalFetch = globalThis.fetch
  try {
    process.env.OLLAMA_API_KEY = 'PEGA_AQUI_TU_CLAVE'
    assert.equal((await call()).code, 503)
    assert.equal((await call({ ...body, records: [] })).code, 400)
    assert.equal((await call(body, 'GET')).code, 405)
    assert.equal((await call({ ...body, today: '2026-02-30' })).code, 400)
    assert.equal((await call({ ...body, question: ' ' })).code, 400)
    assert.equal((await call({ ...body, question: 'x'.repeat(200001) })).code, 413)
    process.env.OLLAMA_API_KEY = 'synthetic-test-secret'
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://ollama.com/api/chat')
      assert.equal(options.headers.Authorization, 'Bearer synthetic-test-secret')
      const sent = JSON.parse(options.body)
      assert.equal(sent.model, 'gpt-oss:120b')
      assert.equal(sent.stream, false)
      assert.equal(JSON.parse(sent.messages[1].content).indicadores.overdue, 1)
      assert.ok(!options.body.includes('synthetic-test-secret'))
      return { ok: true, json: async () => ({ message: { content: 'Ana tiene el caso 001. synthetic-test-secret' } }) }
    }
    const success = await call()
    assert.equal(success.code, 200)
    assert.ok(success.data.answer.includes('001'))
    assert.ok(!success.data.answer.includes('synthetic-test-secret'))
    globalThis.fetch = async () => { throw new Error('synthetic-test-secret') }
    const failed = await call()
    assert.equal(failed.code, 502)
    assert.ok(!failed.data.error.includes('synthetic-test-secret'))
    globalThis.fetch = async () => ({ ok: false })
    assert.equal((await call()).code, 502)
    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
    assert.equal((await call()).code, 502)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OLLAMA_API_KEY
    else process.env.OLLAMA_API_KEY = originalKey
  }
})
