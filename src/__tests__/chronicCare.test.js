import { describe, it, expect } from 'vitest'
import { chronicLabel, overdueChronicPatients, buildChronicRecallMessage } from '../lib/chronicCare'
import { toCsv } from '../lib/csvExport'

const NOW = new Date('2026-11-18T12:00:00Z').getTime()
describe('chronic care', () => {
  it('labels chronic diagnoses and ignores others', () => {
    expect(chronicLabel({ icd10_code: 'I10' })).toBe('Hypertension')
    expect(chronicLabel({ icd10_code: 'e11.9' })).toBe('Diabetes')
    expect(chronicLabel({ icd10_code: 'B50' })).toBe('')
    expect(chronicLabel({ icd10_code: 'B20' })).toBe('')
    expect(chronicLabel({ icd10_code: 'Z99', is_chronic: true, icd10_description: 'Other' })).toBe('Other')
  })
  it('lists patients not seen within the interval, longest first', () => {
    const lastSeen = new Map([['a', NOW - 200 * 86400000], ['b', NOW - 30 * 86400000], ['c', NOW - 100 * 86400000]])
    const list = overdueChronicPatients({
      now: NOW, lastSeen,
      diagnoses: [
        { patient_id: 'a', icd10_code: 'I10' }, { patient_id: 'a', icd10_code: 'E11' },
        { patient_id: 'b', icd10_code: 'I10' }, { patient_id: 'c', icd10_code: 'J45' },
        { patient_id: 'd', icd10_code: 'I10' }, { patient_id: 'e', icd10_code: 'I10', resolved_date: '2026-01-01' },
      ],
    })
    expect(list.map((x) => x.patientId)).toEqual(['d', 'a', 'c'])
    expect(list.find((x) => x.patientId === 'a').conditions).toEqual(['Diabetes', 'Hypertension'])
  })
  it('keeps the condition out of the text', () => {
    expect(buildChronicRecallMessage({ name: 'Kofi Asare', hospital: 'Grace Clinic' })).not.toMatch(/diabet|hypertens|asthma/i)
  })
  it('exports csv safely', () => {
    expect(toCsv([{ label: 'Name', key: 'n' }], [{ n: '=SUM(A1)' }, { n: 'A, "B"' }])).toBe("Name\r\n'=SUM(A1)\r\n\"A, \"\"B\"\"\"")
  })
})
