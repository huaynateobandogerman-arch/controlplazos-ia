import React, { useEffect, useRef, useState } from 'react'
import { calculateIndicators, parseCases, requiredFields } from './csv.js'
import Assistant from './Assistant.jsx'

const columns = ['Caso', 'Unidad', 'Responsable', 'Fecha de vencimiento', 'Estado', 'Observación']
const initialIndicators = [
  { label: 'Total de casos', tone: 'total', value: 0 },
  { label: 'Vencidos', tone: 'overdue', value: 0 },
  { label: 'Próximos a vencer', tone: 'upcoming', value: 0 },
  { label: 'Ejecutados', tone: 'done', value: 0 },
]

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(false)
  const [storageStatus, setStorageStatus] = useState('Recuperando casos guardados…')
  const uploading = useRef(false)
  const loadId = useRef(0)
  const counts = calculateIndicators(cases)

  async function retrieveCases(signal) {
    const response = await fetch('/api/casos', { signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudieron recuperar los casos guardados.')
    if (!Array.isArray(data.records)) throw new Error('No se pudieron recuperar los casos guardados.')
    return data.records
  }

  useEffect(() => {
    const controller = new AbortController()
    const version = loadId.current
    retrieveCases(controller.signal).then(records => {
      if (controller.signal.aborted || loadId.current !== version) return
      setCases(records)
      setStorageStatus(`${records.length} casos recuperados de Supabase.`)
    }).catch(() => {
      if (!controller.signal.aborted && loadId.current === version) setStorageStatus('No se pudieron recuperar los casos. Configura Supabase y crea la tabla para habilitar la persistencia.')
    })
    return () => controller.abort()
  }, [])

  async function selectFile(files) {
    if (!files?.length || uploading.current) return
    const id = ++loadId.current
    setCases([])
    setSelectedFile(null)
    setError('')
    setLoading(false)
    setStorageStatus('')
    if (files.length !== 1 || !files[0].name.toLowerCase().endsWith('.csv')) {
      setError('Selecciona un único archivo con extensión .csv.')
      return
    }
    const file = files[0]
    uploading.current = true
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      if (id !== loadId.current) return
      let text
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
      catch { throw new Error('No se pudo leer el archivo como UTF-8. Guárdalo como CSV UTF-8 e inténtalo otra vez.') }
      const records = parseCases(text)
      setCases(records)
      setSelectedFile(file)
      setStorageStatus(`${records.length} registros procesados. Guardando en Supabase…`)
      let saved = false
      try {
        const response = await fetch('/api/casos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No se pudieron guardar los casos.')
        saved = true
        const persisted = await retrieveCases()
        setCases(persisted)
        setStorageStatus(`${records.length} registros procesados · ${data.saved} casos guardados o actualizados · ${persisted.length} casos en Supabase.`)
      } catch (saveError) {
        setStorageStatus(saved ? 'Los casos se guardaron, pero no se pudo actualizar la tabla desde Supabase. Actualiza el navegador.' : 'Datos disponibles solo en esta sesión. No se confirmó el guardado en Supabase.')
        setError(saveError.message || 'No se pudo completar el guardado en Supabase.')
      }
    } catch (err) {
      if (id === loadId.current) setError(err.message || 'No se pudo leer el archivo CSV.')
    } finally {
      if (id === loadId.current) setLoading(false)
      uploading.current = false
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand-mark" aria-hidden="true">CP<span>•</span></div>
        <div>
          <h1>CONTROLPLAZOS <span>IA</span></h1>
          <p>Control inteligente de casos y fechas de vencimiento</p>
        </div>
      </header>

      <main>
        <div className="section-heading"><div><p className="eyebrow">PANEL DE CONTROL</p><h2>Resumen de casos</h2></div><span className="local-badge">{['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'Entorno local' : 'En línea'}</span></div>

        <section className={`upload-zone ${isDragging ? 'dragging' : ''}`} aria-labelledby="upload-title"
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files) }}>
          <div className="upload-icon" aria-hidden="true">↑</div>
          <h3 id="upload-title">Tus casos empiezan aquí</h3>
          <p>Arrastra tu archivo CSV o selecciónalo desde tu equipo.</p>
          <label className="file-button">Seleccionar archivo CSV<input type="file" accept=".csv,text/csv" disabled={loading} aria-label="Seleccionar archivo CSV" onChange={(event) => { selectFile(event.target.files); event.target.value = '' }} /></label>
          <p className="file-status" role="status">{selectedFile ? `Archivo cargado: ${selectedFile.name} · ` : ''}{storageStatus || (loading ? 'Procesando archivo CSV…' : 'Formato CSV UTF-8 · Fechas: AAAA-MM-DD o DD/MM/AAAA.')}</p>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section className="indicators" aria-label="Indicadores de casos">
          {initialIndicators.map((indicator) => <article className={`indicator ${indicator.tone}`} key={indicator.label}><p><span className="dot" />{indicator.label}</p><strong>{counts[indicator.tone]}</strong><span className="indicator-note">{cases.length ? 'Según los casos cargados' : 'Sin datos cargados'}</span></article>)}
        </section>

        <div className="workspace">
          <section className="panel cases" aria-labelledby="cases-title">
            <div className="panel-heading"><h2 id="cases-title">Listado de casos</h2><span className="count">{cases.length} casos</span></div>
            <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{cases.map((row, index) => <tr className="case-row" key={index}>{requiredFields.map((field) => <td key={field}>{row[field]}</td>)}</tr>)}{cases.length === 0 && <tr><td colSpan={columns.length}><div className="empty-state"><span aria-hidden="true">▤</span><h3>Aún no hay casos para mostrar</h3><p>Selecciona o arrastra un CSV para cargar tus casos.</p></div></td></tr>}</tbody></table></div>
          </section>
          <Assistant key={`${loadId.current}-${storageStatus}`} records={cases} />
        </div>
        <footer>CONTROLPLAZOS IA <span>·</span> Checkpoint 5</footer>
      </main>
    </div>
  )
}
