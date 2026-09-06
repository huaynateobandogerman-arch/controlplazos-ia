import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateIndicators, parseCases, parseLocalDate, requiredFields } from './csv.js'

const header = requiredFields.join(',')
test('CSV UTF-8 con BOM, comillas, comas, saltos de línea y filas vacías', () => {
  const rows = parseCases(`\uFEFF${header}\r\n001,Área,José,2026-09-05,Pendiente,"Revisión, urgente\nsegunda línea"\r\n\r\n`)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].caso, '001')
  assert.equal(rows[0].responsable, 'José')
  assert.equal(rows[0].observacion, 'Revisión, urgente\nsegunda línea')
})
test('Rechaza archivos vacíos, encabezados incorrectos y registros malformados', () => {
  for (const text of ['', ' \n', header, 'caso,unidad\n1,A', `${header},extra\n1,A,B,2026-09-05,Pendiente,x,y`, `${header}\n1,A,B`, `${header}\n1,A,B,2026-02-30,Pendiente,x`]) {
    assert.throws(() => parseCases(text))
  }
})
test('Fechas locales válidas, sin interpretar como UTC ni normalizar días inválidos', () => {
  const date = parseLocalDate('2026-09-05')
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 8)
  assert.equal(date.getDate(), 5)
  assert.equal(date.getHours(), 0)
  assert.equal(parseLocalDate('05/09/2026').getTime(), date.getTime())
  assert.ok(parseLocalDate('2024-02-29'))
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '', '2026-09-05T00:00:00Z']) assert.equal(parseLocalDate(value), null)
})
test('Indicadores incluyen hoy y día +3, excluyen +4 y ejecutados', () => {
  const rows = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-08', '2026-09-09'].map((fecha_vencimiento) => ({ fecha_vencimiento, estado: 'Pendiente' }))
  rows.push({ fecha_vencimiento: '2026-01-01', estado: 'Ejecutado' }, { fecha_vencimiento: '2026-09-06', estado: ' ejecutado ' })
  assert.deepEqual(calculateIndicators(rows, new Date(2026, 8, 5, 23, 59)), { total: 7, overdue: 1, upcoming: 3, done: 2 })
  assert.deepEqual(calculateIndicators([], new Date()), { total: 0, overdue: 0, upcoming: 0, done: 0 })
})
test('Ventana de calendario cruza fin de mes y cambio de horario', () => {
  const rows = ['2026-11-01', '2026-11-02', '2026-11-03'].map((fecha_vencimiento) => ({ fecha_vencimiento, estado: 'Pendiente' }))
  assert.equal(calculateIndicators(rows, new Date(2026, 9, 30, 23)).upcoming, 2)
})
