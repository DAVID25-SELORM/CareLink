import { describe, it, expect } from 'vitest'
import { buildChildSchedule, summarizeSchedule, dueDateFor, ageText } from '../lib/epiSchedule'

const status = (rows, code) => rows.find((r) => r.code === code)?.status

describe('epi schedule', () => {
  it('computes due dates from the birth date', () => {
    expect(dueDateFor('2026-01-01', { weeks: 6 })).toBe('2026-02-12')
    expect(dueDateFor('2026-01-31', { months: 1 })).toBe('2026-02-28')
    expect(dueDateFor('2026-03-15', { months: 9 })).toBe('2026-12-15')
  })

  it('marks given, due, overdue and upcoming doses', () => {
    const rows = buildChildSchedule({
      dateOfBirth: '2026-09-01',
      today: '2026-11-17',
      given: [{ vaccine_code: 'BCG', given_date: '2026-09-02' }],
    })
    expect(status(rows, 'BCG')).toBe('given')
    expect(status(rows, 'OPV0')).toBe('overdue')
    expect(status(rows, 'PENTA1')).toBe('overdue')
    expect(status(rows, 'PENTA2')).toBe('due')
    expect(status(rows, 'PENTA3')).toBe('upcoming')
    expect(status(buildChildSchedule({ dateOfBirth: '2026-09-01', today: '2026-12-01' }), 'PENTA3')).toBe('due_soon')
    expect(status(rows, 'MR1')).toBe('upcoming')
    expect(summarizeSchedule(rows).given).toBe(1)
  })

  it('stops offering rotavirus after the age limit', () => {
    const rows = buildChildSchedule({ dateOfBirth: '2026-01-01', today: '2026-11-17' })
    expect(status(rows, 'ROTA1')).toBe('too_late')
    expect(status(rows, 'ROTA3')).toBe('too_late')
    expect(status(rows, 'PENTA1')).toBe('overdue')
  })

  it('formats age', () => {
    expect(ageText('2026-11-10', '2026-11-17')).toBe('7 days')
    expect(ageText('2026-10-01', '2026-11-17')).toBe('6 weeks')
    expect(ageText('2026-03-10', '2026-11-17')).toBe('8 months')
    expect(ageText('2023-07-01', '2026-11-17')).toBe('3 years 4 months')
  })

  it('returns nothing without a birth date', () => {
    expect(buildChildSchedule({ dateOfBirth: '' })).toEqual([])
  })
})
