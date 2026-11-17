import { describe, it, expect } from 'vitest'
import { resolveAnalyte, patientContext } from '../lib/labRanges'

const hb = { name: 'Haemoglobin', unit: 'g/dL', refLow: 12, refHigh: 17.5 }
const pick = (a) => [a.refLow, a.refHigh, a.rangeBasis]

describe('resolveAnalyte', () => {
  it('uses sex- and age-specific ranges', () => {
    expect(pick(resolveAnalyte(hb, patientContext({ gender: 'Male', age: 30 })))).toEqual([13, 17.5, 'male'])
    expect(pick(resolveAnalyte(hb, patientContext({ gender: 'F', age: 30 })))).toEqual([12, 15.5, 'female'])
    expect(pick(resolveAnalyte(hb, patientContext({ gender: 'male', age: 6 })))).toEqual([11, 14.5, 'child under 12'])
  })

  it('keeps the catalog default when sex/age are unknown or the unit differs', () => {
    expect(pick(resolveAnalyte(hb, patientContext({})))).toEqual([12, 17.5, undefined])
    expect(pick(resolveAnalyte(hb, patientContext({ age: 30 })))).toEqual([12, 17.5, undefined])
    expect(pick(resolveAnalyte({ ...hb, unit: 'g/L' }, patientContext({ gender: 'male', age: 30 })))).toEqual([12, 17.5, undefined])
  })

  it('handles unit spellings and open-ended ranges', () => {
    expect(pick(resolveAnalyte({ name: 'Creatinine', unit: 'µmol/L', refLow: 1, refHigh: 2 }, patientContext({ gender: 'female', age: 40 })))).toEqual([53, 97, 'female'])
    expect(pick(resolveAnalyte({ name: 'HDL Cholesterol', unit: 'mg/dL', refLow: 40, refHigh: null }, patientContext({ gender: 'female', age: 40 })))).toEqual([50, null, 'female'])
  })
})
