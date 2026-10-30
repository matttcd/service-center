import { describe, expect, it } from 'vitest'
import { groupNotes } from '../../src/utils/helpers.js'

const note = (id, by, at = '2026-10-30T12:01:10Z') => ({ id, by, byName: by || 'Sin autor', at, text: id })

describe('Mensajes del técnico', () => {
  it('agrupa mensajes consecutivos del mismo autor y minuto sin modificar las notas', () => {
    const notes = [note('one', 'tech'), note('two', 'tech', '2026-10-30T12:01:59Z')]
    const original = structuredClone(notes)
    expect(groupNotes(notes).map(g => g.entries.map(n => n.id))).toEqual([['one', 'two']])
    expect(notes).toEqual(original)
  })
  it('separa autores aunque tengan el mismo nombre', () => {
    const notes = [note('one', 'tech'), { ...note('two', 'other'), byName: 'tech' }, note('three', 'tech')]
    expect(groupNotes(notes).map(g => g.entries.map(n => n.id))).toEqual([['one'], ['two'], ['three']])
  })
  it('separa minutos y días distintos sin inventar una hora compartida', () => {
    const notes = [note('one', 'tech'), note('two', 'tech', '2026-10-30T12:02:00Z'), note('three', 'tech', '2026-10-31T12:02:00Z')]
    expect(groupNotes(notes)).toHaveLength(3)
  })
  it('no agrupa autores desconocidos ni fechas ausentes', () => {
    expect(groupNotes([note('one', null), note('two', null), note('three', 'tech', null), note('four', 'tech', null)])).toHaveLength(4)
    expect(groupNotes([])).toEqual([])
  })
})
