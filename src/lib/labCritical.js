// Critical ("panic") value limits for common adult tests. A critical value needs urgent action by a clinician,
// so these are reported separately from ordinary HIGH/LOW flags.
//
// Safety rule: a limit is applied only when the result unit is recognised. An unknown unit is never guessed,
// so no false alarm is raised, but the normal HIGH/LOW flag still applies.

const RULES = [
  { match: /^(haemoglobin|hemoglobin|hb|hgb)\b/, low: 7, high: 20, unit: 'g/dl', convert: { 'g/l': 0.1 } },
  { match: /^(platelet|plt)/, low: 20, high: 1000, unit: '10^9/l', convert: { 'x10^9/l': 1, '10*9/l': 1, '10^3/ul': 1, 'x10^3/ul': 1, 'k/ul': 1, 'g/l': 1 } },
  { match: /^(wbc|white (blood )?cell|leucocyte|leukocyte)/, low: 2, high: 30, unit: '10^9/l', convert: { 'x10^9/l': 1, '10*9/l': 1, '10^3/ul': 1, 'x10^3/ul': 1, 'k/ul': 1, 'g/l': 1 } },
  { match: /^potassium|^k\+?$/, low: 2.8, high: 6.2, unit: 'mmol/l', convert: { 'meq/l': 1 } },
  { match: /^sodium|^na\+?$/, low: 120, high: 160, unit: 'mmol/l', convert: { 'meq/l': 1 } },
  { match: /glucose|^fbs|^rbs|blood sugar/, low: 2.5, high: 25, unit: 'mmol/l', convert: { 'mg/dl': 1 / 18 } },
  { match: /^calcium|^ca\b/, low: 1.6, high: 3.5, unit: 'mmol/l', convert: { 'mg/dl': 0.2495 } },
  { match: /^creatinine/, low: null, high: 500, unit: 'umol/l', convert: { 'µmol/l': 1, 'mg/dl': 88.4 } },
]

const clean = (unit) => String(unit || '').toLowerCase().replace(/\s+/g, '').replace('μ', 'µ').replace('µmol', 'umol')

/**
 * @returns {'CRITICAL_LOW'|'CRITICAL_HIGH'|null}
 */
export function criticalFlag(analyteName, value, unit) {
  const number = Number(value)
  if (value === '' || value == null || Number.isNaN(number)) return null
  const name = String(analyteName || '').trim().toLowerCase()
  const rule = RULES.find((r) => r.match.test(name))
  if (!rule) return null

  const u = clean(unit)
  let factor
  if (u === rule.unit) factor = 1
  else if (rule.convert) {
    const key = Object.keys(rule.convert).find((k) => clean(k) === u)
    if (key) factor = rule.convert[key]
  }
  if (factor === undefined) return null

  const converted = number * factor
  if (rule.low != null && converted < rule.low) return 'CRITICAL_LOW'
  if (rule.high != null && converted > rule.high) return 'CRITICAL_HIGH'
  return null
}
