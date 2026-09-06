import Papa from 'papaparse'

export const requiredFields = ['caso', 'unidad', 'responsable', 'fecha_vencimiento', 'estado', 'observacion']

// Se construye con componentes locales, nunca interpretando una cadena como UTC.
export function parseLocalDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const latin = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!iso && !latin) return null
  const [year, month, day] = iso ? iso.slice(1).map(Number) : [Number(latin[3]), Number(latin[2]), Number(latin[1])]
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function parseCases(text) {
  if (!text.replace(/^\uFEFF/, '').trim()) throw new Error('El archivo está vacío. Agrega los encabezados y al menos un registro.')
  const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (field) => field.trim(), transform: (value) => value.trim() })
  const fields = result.meta.fields ?? []
  const missing = requiredFields.filter((field) => !fields.includes(field))
  if (missing.length) throw new Error(`Faltan columnas requeridas: ${missing.join(', ')}. No se cargaron datos.`)
  if (fields.length !== requiredFields.length || new Set(fields).size !== fields.length) throw new Error(`El CSV debe contener exactamente estas columnas, sin duplicados: ${requiredFields.join(', ')}.`)
  if (result.errors.length) throw new Error('El CSV tiene un formato incorrecto. Revisa las comillas y la cantidad de campos de cada registro. No se cargaron datos.')
  if (!result.data.length) throw new Error('El archivo no contiene registros; solo tiene encabezados.')
  result.data.forEach((row, index) => {
    if (!parseLocalDate(row.fecha_vencimiento)) throw new Error(`Fecha de vencimiento inválida en el registro ${index + 1}. Usa AAAA-MM-DD o DD/MM/AAAA con una fecha válida. No se cargaron datos.`)
  })
  return result.data
}

export function calculateIndicators(cases, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 3)
  const counts = { total: cases.length, overdue: 0, upcoming: 0, done: 0 }
  for (const row of cases) {
    if (row.estado.trim().toLowerCase() === 'ejecutado') { counts.done++; continue }
    const due = parseLocalDate(row.fecha_vencimiento)
    if (!due) continue
    if (due < today) counts.overdue++
    else if (due <= limit) counts.upcoming++
  }
  return counts
}
