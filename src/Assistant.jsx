import React, { useEffect, useRef, useState } from 'react'

export default function Assistant({ records }) {
  const [history, setHistory] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  const log = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [history, busy, error])

  async function send(event) {
    event.preventDefault()
    if (busy || !question.trim() || !records.length) return
    const text = question.trim()
    setHistory(items => [...items, { role: 'user', text }])
    setQuestion(''); setError(''); setBusy(true)
    controller.current = new AbortController()
    const timeout = setTimeout(() => controller.current?.abort(), 100000)
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, records, today }), signal: controller.current.signal })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'No se pudo completar la consulta. Vuelve a intentarlo.'); return }
      if (typeof data.answer !== 'string') throw new Error()
      setHistory(items => [...items, { role: 'assistant', text: data.answer }])
    } catch { setError('No se pudo completar la consulta. Verifica tu conexión y vuelve a intentarlo.') }
    finally { clearTimeout(timeout); setBusy(false) }
  }

  return <aside className="panel assistant" aria-labelledby="assistant-title">
    <div className="panel-heading"><h2 id="assistant-title">Asistente IA</h2><span className="assistant-symbol" aria-hidden="true">✦</span></div>
    <div className="chat-body">
      <div className="chat-history" role="log" aria-live="polite" aria-label="Historial de conversación" ref={log}>
        {!history.length && <p className="chat-hint">{records.length ? 'Consulta los casos de tu CSV.' : 'Primero carga un archivo CSV para consultar los casos.'}</p>}
        {history.map((message, index) => <div className={`chat-message ${message.role}`} key={index}><strong>{message.role === 'user' ? 'Tú' : 'Asistente IA'}</strong><p>{message.text}</p></div>)}
        {busy && <p role="status" className="chat-hint">Analizando...</p>}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <form className="chat-form" onSubmit={send}>
        <textarea aria-label="Pregunta sobre los casos" placeholder="Escribe tu pregunta…" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={3} disabled={busy || !records.length} />
        <button type="submit" disabled={busy || !records.length || !question.trim()}>Enviar</button>
      </form>
    </div>
  </aside>
}
