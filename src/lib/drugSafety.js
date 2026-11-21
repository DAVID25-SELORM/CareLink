// Prescribing safety checks: drug allergies and well-established serious interactions.
// This is decision support, not a substitute for a full drug database: it covers common
// high-risk cases and always lets the prescriber override after seeing the warning.

const ALLERGY_CLASSES = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'flucloxacillin', 'cloxacillin', 'amoxiclav', 'co-amoxiclav', 'augmentin', 'piperacillin', 'benzylpenicillin', 'phenoxymethylpenicillin'],
  cephalosporin: ['cef', 'ceph'],
  sulfa: ['sulfa', 'sulpha', 'sulfonamide', 'cotrimoxazole', 'co-trimoxazole', 'sulfamethoxazole', 'septrin', 'sulfadoxine', 'fansidar'],
  nsaid: ['nsaid', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'ketorolac', 'indomethacin', 'piroxicam', 'meloxicam'],
  macrolide: ['macrolide', 'erythromycin', 'azithromycin', 'clarithromycin'],
  quinolone: ['quinolone', 'ciprofloxacin', 'levofloxacin', 'ofloxacin', 'norfloxacin'],
  tetracycline: ['tetracycline', 'doxycycline', 'minocycline'],
  opioid: ['opioid', 'morphine', 'codeine', 'tramadol', 'pethidine', 'fentanyl'],
}

// Pairs are matched on whole-word substrings of the lowercase drug name.
const INTERACTIONS = [
  { a: ['warfarin'], b: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen', 'ketorolac', 'metronidazole', 'ciprofloxacin', 'fluconazole', 'cotrimoxazole', 'erythromycin'], level: 'severe', note: 'raises bleeding risk' },
  { a: ['sildenafil', 'tadalafil'], b: ['isosorbide', 'glyceryl trinitrate', 'gtn', 'nitroglycerin'], level: 'severe', note: 'can cause a dangerous drop in blood pressure' },
  { a: ['methotrexate'], b: ['cotrimoxazole', 'co-trimoxazole', 'trimethoprim', 'ibuprofen', 'naproxen', 'diclofenac'], level: 'severe', note: 'raises methotrexate toxicity' },
  { a: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'losartan', 'valsartan'], b: ['spironolactone', 'potassium chloride', 'amiloride'], level: 'moderate', note: 'risk of high potassium' },
  { a: ['simvastatin', 'atorvastatin'], b: ['erythromycin', 'clarithromycin', 'itraconazole', 'ketoconazole'], level: 'moderate', note: 'raises risk of muscle damage' },
  { a: ['digoxin'], b: ['amiodarone', 'verapamil', 'erythromycin', 'clarithromycin'], level: 'severe', note: 'raises digoxin levels' },
  { a: ['tramadol', 'morphine', 'codeine', 'pethidine'], b: ['diazepam', 'lorazepam', 'midazolam', 'phenobarbital'], level: 'severe', note: 'risk of serious sedation and breathing depression' },
  { a: ['metformin'], b: ['contrast'], level: 'moderate', note: 'review before contrast imaging' },
  { a: ['rifampicin', 'rifampin'], b: ['efavirenz', 'nevirapine', 'warfarin', 'levonorgestrel'], level: 'moderate', note: 'rifampicin lowers the other drug effect' },
  { a: ['artemether', 'lumefantrine', 'coartem'], b: ['quinine', 'halofantrine'], level: 'severe', note: 'combined QT prolongation risk' },
]

const norm = (value) => String(value || '').toLowerCase().trim()
const hasAny = (name, terms) => terms.some((term) => name.includes(term))

const classesOf = (text) => {
  const lower = norm(text)
  return Object.entries(ALLERGY_CLASSES)
    .filter(([cls, members]) => lower.includes(cls) || hasAny(lower, members))
    .map(([cls]) => cls)
}

/**
 * @param {{drugNames: string[], allergies: Array<{allergen_type?: string, allergen_name: string, reaction?: string, severity?: string, status?: string}>}} input
 * @returns {Array<{kind: 'allergy'|'interaction', level: 'severe'|'moderate'|'mild', message: string}>}
 */
export function checkPrescriptionSafety({ drugNames = [], allergies = [] }) {
  const drugs = [...new Set(drugNames.map(norm).filter(Boolean))]
  const findings = []

  const active = allergies.filter((a) => a && norm(a.allergen_name) && (!a.status || a.status === 'active'))
  for (const allergy of active) {
    if (allergy.allergen_type && allergy.allergen_type !== 'drug') continue
    const allergen = norm(allergy.allergen_name)
    const allergenClasses = classesOf(allergen)
    for (const drug of drugs) {
      const direct = drug.includes(allergen) || allergen.includes(drug)
      const sameClass = classesOf(drug).some((cls) => allergenClasses.includes(cls))
      if (!direct && !sameClass) continue
      const severity = allergy.severity === 'severe' || allergy.severity === 'life_threatening' ? 'severe' : 'moderate'
      const reaction = allergy.reaction ? ` (reaction: ${allergy.reaction})` : ''
      findings.push({
        kind: 'allergy',
        level: severity,
        message: `${drug} may conflict with the recorded ${allergy.severity || ''} allergy to ${allergy.allergen_name}${reaction}.`.replace(/\s+/g, ' '),
      })
    }
  }

  for (const rule of INTERACTIONS) {
    for (const first of drugs.filter((d) => hasAny(d, rule.a))) {
      for (const second of drugs.filter((d) => d !== first && hasAny(d, rule.b))) {
        findings.push({ kind: 'interaction', level: rule.level, message: `${first} with ${second}: ${rule.note}.` })
      }
    }
  }

  const seen = new Set()
  return findings
    .filter((f) => (seen.has(f.message) ? false : seen.add(f.message)))
    .sort((x, y) => (x.level === y.level ? 0 : x.level === 'severe' ? -1 : 1))
}
