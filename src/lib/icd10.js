/**
 * ICD-10 Code Library for CareLink HMS
 * Common diagnosis codes used in Ghanaian healthcare facilities
 */

export const ICD10_CODES = [
  // Infectious and parasitic diseases (A00-B99)
  { code: 'A00.9', description: 'Cholera, unspecified', chapter: 'Infectious' },
  { code: 'A01.0', description: 'Typhoid fever', chapter: 'Infectious' },
  { code: 'A06.9', description: 'Amoebiasis, unspecified', chapter: 'Infectious' },
  { code: 'A09', description: 'Infectious gastroenteritis and colitis', chapter: 'Infectious' },
  { code: 'A15.0', description: 'Tuberculosis of lung', chapter: 'Infectious' },
  { code: 'A15.9', description: 'Respiratory tuberculosis, unspecified', chapter: 'Infectious' },
  { code: 'A46', description: 'Erysipelas', chapter: 'Infectious' },
  { code: 'A90', description: 'Dengue fever', chapter: 'Infectious' },
  { code: 'B15.9', description: 'Hepatitis A without hepatic coma', chapter: 'Infectious' },
  { code: 'B16.9', description: 'Acute hepatitis B without delta-agent', chapter: 'Infectious' },
  { code: 'B17.1', description: 'Acute hepatitis C', chapter: 'Infectious' },
  { code: 'B20', description: 'HIV disease', chapter: 'Infectious' },
  { code: 'B50.9', description: 'Plasmodium falciparum malaria, unspecified', chapter: 'Infectious' },
  { code: 'B51.9', description: 'Plasmodium vivax malaria', chapter: 'Infectious' },
  { code: 'B54', description: 'Unspecified malaria', chapter: 'Infectious' },
  { code: 'B82.9', description: 'Intestinal parasitism, unspecified', chapter: 'Infectious' },

  // Neoplasms (C00-D49)
  { code: 'C50.9', description: 'Breast cancer, unspecified', chapter: 'Neoplasms' },
  { code: 'C53.9', description: 'Cervical cancer, unspecified', chapter: 'Neoplasms' },
  { code: 'C61', description: 'Malignant neoplasm of prostate', chapter: 'Neoplasms' },
  { code: 'C34.9', description: 'Lung cancer, unspecified', chapter: 'Neoplasms' },
  { code: 'D50.9', description: 'Iron deficiency anaemia, unspecified', chapter: 'Neoplasms' },

  // Endocrine, nutritional and metabolic (E00-E89)
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', chapter: 'Endocrine' },
  { code: 'E05.9', description: 'Thyrotoxicosis, unspecified', chapter: 'Endocrine' },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus', chapter: 'Endocrine' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus', chapter: 'Endocrine' },
  { code: 'E46', description: 'Unspecified protein-calorie malnutrition', chapter: 'Endocrine' },
  { code: 'E55.9', description: 'Vitamin D deficiency, unspecified', chapter: 'Endocrine' },
  { code: 'E78.5', description: 'Hyperlipidaemia, unspecified', chapter: 'Endocrine' },
  { code: 'E86.0', description: 'Dehydration', chapter: 'Endocrine' },
  { code: 'E87.6', description: 'Hypokalaemia', chapter: 'Endocrine' },

  // Mental and behavioural (F00-F99)
  { code: 'F10.2', description: 'Alcohol dependence syndrome', chapter: 'Mental' },
  { code: 'F20.9', description: 'Schizophrenia, unspecified', chapter: 'Mental' },
  { code: 'F32.9', description: 'Depressive episode, unspecified', chapter: 'Mental' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified', chapter: 'Mental' },

  // Diseases of the nervous system (G00-G99)
  { code: 'G40.9', description: 'Epilepsy, unspecified', chapter: 'Nervous' },
  { code: 'G43.9', description: 'Migraine, unspecified', chapter: 'Nervous' },

  // Circulatory system (I00-I99)
  { code: 'I10', description: 'Essential (primary) hypertension', chapter: 'Circulatory' },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', chapter: 'Circulatory' },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', chapter: 'Circulatory' },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', chapter: 'Circulatory' },
  { code: 'I25.9', description: 'Chronic ischaemic heart disease', chapter: 'Circulatory' },
  { code: 'I48.9', description: 'Atrial fibrillation, unspecified', chapter: 'Circulatory' },
  { code: 'I50.9', description: 'Heart failure, unspecified', chapter: 'Circulatory' },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified', chapter: 'Circulatory' },
  { code: 'I64', description: 'Stroke, not specified', chapter: 'Circulatory' },

  // Respiratory system (J00-J99)
  { code: 'J00', description: 'Acute nasopharyngitis (common cold)', chapter: 'Respiratory' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', chapter: 'Respiratory' },
  { code: 'J06.9', description: 'Acute upper respiratory infection', chapter: 'Respiratory' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', chapter: 'Respiratory' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', chapter: 'Respiratory' },
  { code: 'J45.9', description: 'Asthma, unspecified', chapter: 'Respiratory' },

  // Digestive system (K00-K95)
  { code: 'K21.0', description: 'Gastro-oesophageal reflux with oesophagitis', chapter: 'Digestive' },
  { code: 'K25.9', description: 'Gastric ulcer, unspecified', chapter: 'Digestive' },
  { code: 'K29.7', description: 'Gastritis, unspecified', chapter: 'Digestive' },
  { code: 'K35.9', description: 'Acute appendicitis, unspecified', chapter: 'Digestive' },
  { code: 'K40.9', description: 'Inguinal hernia, unspecified', chapter: 'Digestive' },
  { code: 'K59.0', description: 'Constipation', chapter: 'Digestive' },
  { code: 'K76.0', description: 'Fatty liver, not elsewhere classified', chapter: 'Digestive' },

  // Musculoskeletal (M00-M99)
  { code: 'M54.5', description: 'Low back pain', chapter: 'Musculoskeletal' },
  { code: 'M79.3', description: 'Panniculitis, unspecified', chapter: 'Musculoskeletal' },

  // Genitourinary (N00-N99)
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified', chapter: 'Genitourinary' },
  { code: 'N30.0', description: 'Acute cystitis', chapter: 'Genitourinary' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', chapter: 'Genitourinary' },

  // Pregnancy (O00-O9A)
  { code: 'O80', description: 'Single spontaneous delivery', chapter: 'Pregnancy' },
  { code: 'O82', description: 'Delivery by caesarean section', chapter: 'Pregnancy' },

  // Symptoms and signs (R00-R99)
  { code: 'R05', description: 'Cough', chapter: 'Symptoms' },
  { code: 'R10.4', description: 'Other and unspecified abdominal pain', chapter: 'Symptoms' },
  { code: 'R50.9', description: 'Fever, unspecified', chapter: 'Symptoms' },
  { code: 'R51', description: 'Headache', chapter: 'Symptoms' },

  // Injury and poisoning (S00-T88)
  { code: 'S06.9', description: 'Intracranial injury, unspecified', chapter: 'Injury' },
  { code: 'T78.4', description: 'Allergy, unspecified', chapter: 'Injury' },

  // External causes (V00-Y99)
  { code: 'W19', description: 'Unspecified fall', chapter: 'External' },
]

/** Search ICD-10 codes by code prefix or description keyword */
export function searchIcd(query, limit = 20) {
  if (!query || query.trim().length === 0) return ICD10_CODES.slice(0, limit)
  const q = query.toLowerCase().trim()
  return ICD10_CODES.filter(
    (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  ).slice(0, limit)
}

/** Find a single ICD-10 entry by exact code */
export function findIcd(code) {
  if (!code) return null
  return ICD10_CODES.find((c) => c.code.toUpperCase() === code.toUpperCase()) || null
}

/** Get unique chapter names */
export function getChapters() {
  return [...new Set(ICD10_CODES.map((c) => c.chapter))]
}
