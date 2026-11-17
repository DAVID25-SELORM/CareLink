import { describe, it, expect } from 'vitest'
import { checkPrescriptionSafety } from '../lib/drugSafety'

const pen = { allergen_type: 'drug', allergen_name: 'Penicillin', severity: 'severe', reaction: 'anaphylaxis', status: 'active' }

describe('checkPrescriptionSafety', () => {
  it('flags a drug in the same class as a recorded allergy', () => {
    const out = checkPrescriptionSafety({ drugNames: ['Amoxicillin 500mg'], allergies: [pen] })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'allergy', level: 'severe' })
    expect(out[0].message).toMatch(/anaphylaxis/)
  })

  it('ignores resolved allergies, food allergies and unrelated drugs', () => {
    expect(checkPrescriptionSafety({ drugNames: ['Amoxicillin'], allergies: [{ ...pen, status: 'resolved' }] })).toEqual([])
    expect(checkPrescriptionSafety({ drugNames: ['Peanut oil'], allergies: [{ allergen_type: 'food', allergen_name: 'Peanut' }] })).toEqual([])
    expect(checkPrescriptionSafety({ drugNames: ['Paracetamol'], allergies: [pen] })).toEqual([])
  })

  it('flags serious interactions once, severe first', () => {
    const out = checkPrescriptionSafety({ drugNames: ['Lisinopril', 'Spironolactone', 'Warfarin', 'Ibuprofen'], allergies: [] })
    expect(out[0].level).toBe('severe')
    expect(out.map((f) => f.kind)).toEqual(['interaction', 'interaction'])
    expect(new Set(out.map((f) => f.message)).size).toBe(out.length)
  })

  it('returns nothing for a safe single drug', () => {
    expect(checkPrescriptionSafety({ drugNames: ['Paracetamol'], allergies: [] })).toEqual([])
  })
})
