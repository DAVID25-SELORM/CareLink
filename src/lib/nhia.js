/**
 * NHIA (National Health Insurance Authority) Tariff Library for CareLink HMS
 * Ghana NHIS standard tariffs for common healthcare services
 */

export const NHIA_TARIFFS = [
  // Consultation & OPD
  { code: 'OPD-001', description: 'General OPD consultation', category: 'Consultation', priceGHS: 15.00 },
  { code: 'OPD-002', description: 'Specialist consultation', category: 'Consultation', priceGHS: 30.00 },
  { code: 'OPD-003', description: 'Follow-up visit', category: 'Consultation', priceGHS: 10.00 },
  { code: 'OPD-004', description: 'Emergency consultation', category: 'Consultation', priceGHS: 50.00 },

  // Laboratory
  { code: 'LAB-001', description: 'Full blood count (FBC)', category: 'Laboratory', priceGHS: 25.00 },
  { code: 'LAB-002', description: 'Malaria rapid diagnostic test (RDT)', category: 'Laboratory', priceGHS: 12.00 },
  { code: 'LAB-003', description: 'Blood film for malaria parasites', category: 'Laboratory', priceGHS: 15.00 },
  { code: 'LAB-004', description: 'Urinalysis', category: 'Laboratory', priceGHS: 10.00 },
  { code: 'LAB-005', description: 'Blood glucose (fasting)', category: 'Laboratory', priceGHS: 12.00 },
  { code: 'LAB-006', description: 'Lipid profile', category: 'Laboratory', priceGHS: 40.00 },
  { code: 'LAB-007', description: 'Liver function tests (LFTs)', category: 'Laboratory', priceGHS: 45.00 },
  { code: 'LAB-008', description: 'Renal function tests', category: 'Laboratory', priceGHS: 45.00 },
  { code: 'LAB-009', description: 'HIV screening test', category: 'Laboratory', priceGHS: 20.00 },
  { code: 'LAB-010', description: 'Hepatitis B surface antigen', category: 'Laboratory', priceGHS: 20.00 },
  { code: 'LAB-011', description: 'Widal test', category: 'Laboratory', priceGHS: 15.00 },
  { code: 'LAB-012', description: 'Stool routine examination', category: 'Laboratory', priceGHS: 10.00 },

  // Imaging / Radiology
  { code: 'RAD-001', description: 'Chest X-ray (PA view)', category: 'Radiology', priceGHS: 40.00 },
  { code: 'RAD-002', description: 'Abdominal ultrasound', category: 'Radiology', priceGHS: 60.00 },
  { code: 'RAD-003', description: 'Pelvic ultrasound', category: 'Radiology', priceGHS: 60.00 },
  { code: 'RAD-004', description: 'Obstetric ultrasound', category: 'Radiology', priceGHS: 60.00 },
  { code: 'RAD-005', description: 'CT scan (head)', category: 'Radiology', priceGHS: 350.00 },

  // Procedures
  { code: 'PROC-001', description: 'Wound dressing (minor)', category: 'Procedures', priceGHS: 15.00 },
  { code: 'PROC-002', description: 'Wound suturing', category: 'Procedures', priceGHS: 50.00 },
  { code: 'PROC-003', description: 'Incision and drainage', category: 'Procedures', priceGHS: 80.00 },
  { code: 'PROC-004', description: 'Circumcision', category: 'Procedures', priceGHS: 120.00 },
  { code: 'PROC-005', description: 'Normal delivery', category: 'Procedures', priceGHS: 300.00 },
  { code: 'PROC-006', description: 'Caesarean section', category: 'Procedures', priceGHS: 1200.00 },

  // Ward / Bed Charges
  { code: 'WARD-001', description: 'General ward (per day)', category: 'Ward', priceGHS: 30.00 },
  { code: 'WARD-002', description: 'Semi-private room (per day)', category: 'Ward', priceGHS: 80.00 },
  { code: 'WARD-003', description: 'Private room (per day)', category: 'Ward', priceGHS: 150.00 },
  { code: 'WARD-004', description: 'ICU bed (per day)', category: 'Ward', priceGHS: 500.00 },

  // Pharmacy
  { code: 'DRUG-001', description: 'Artemether-Lumefantrine (AL) course', category: 'Pharmacy', priceGHS: 8.00 },
  { code: 'DRUG-002', description: 'Amoxicillin 500mg (course)', category: 'Pharmacy', priceGHS: 6.00 },
  { code: 'DRUG-003', description: 'Metformin 500mg (30 tabs)', category: 'Pharmacy', priceGHS: 10.00 },
  { code: 'DRUG-004', description: 'Amlodipine 5mg (30 tabs)', category: 'Pharmacy', priceGHS: 8.00 },
  { code: 'DRUG-005', description: 'Paracetamol 500mg (20 tabs)', category: 'Pharmacy', priceGHS: 3.00 },
]

/** Format a number as Ghana Cedis */
export function formatGHS(amount) {
  return `GH₵ ${Number(amount).toFixed(2)}`
}

/** Search tariffs by code or description keyword */
export function searchTariffs(query, limit = 20) {
  if (!query || query.trim().length === 0) return NHIA_TARIFFS.slice(0, limit)
  const q = query.toLowerCase().trim()
  return NHIA_TARIFFS.filter(
    (t) =>
      t.code.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
  ).slice(0, limit)
}

/** Find a single tariff by exact code */
export function findTariff(code) {
  if (!code) return null
  return NHIA_TARIFFS.find((t) => t.code.toUpperCase() === code.toUpperCase()) || null
}

/** Get unique category names */
export function getCategories() {
  return [...new Set(NHIA_TARIFFS.map((t) => t.category))]
}
