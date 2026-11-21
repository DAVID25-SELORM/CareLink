import { describe, it, expect } from 'vitest'
import { criticalFlag } from '../lib/labCritical'

describe('criticalFlag', () => {
  it('flags dangerous values in the expected unit', () => {
    expect(criticalFlag('Haemoglobin', 5.8, 'g/dL')).toBe('CRITICAL_LOW')
    expect(criticalFlag('Potassium', 6.8, 'mmol/L')).toBe('CRITICAL_HIGH')
    expect(criticalFlag('Creatinine', 650, 'µmol/L')).toBe('CRITICAL_HIGH')
    expect(criticalFlag('Platelets', 12, 'x10^9/L')).toBe('CRITICAL_LOW')
  })

  it('converts known alternative units', () => {
    expect(criticalFlag('Hb', 60, 'g/L')).toBe('CRITICAL_LOW')
    expect(criticalFlag('Glucose', 30, 'mg/dL')).toBe('CRITICAL_LOW')
    expect(criticalFlag('Random blood sugar', 600, 'mg/dL')).toBe('CRITICAL_HIGH')
  })

  it('returns null for normal values, unknown tests and unknown units', () => {
    expect(criticalFlag('Haemoglobin', 12.5, 'g/dL')).toBeNull()
    expect(criticalFlag('Haemoglobin', 3, 'furlongs')).toBeNull()
    expect(criticalFlag('Malaria parasite', 5, 'g/dL')).toBeNull()
    expect(criticalFlag('Sodium', '', 'mmol/L')).toBeNull()
    expect(criticalFlag('Sodium', 'abc', 'mmol/L')).toBeNull()
  })
})
