-- ============================================================
-- CareLink HMS - Migration 014: Structured Lab Result Parameters
-- Adds sample/result workflow columns and seeds analyte-level lab
-- catalog metadata for common panels such as FBC, LFT, RFT, etc.
-- Safe to re-run.
-- ============================================================

-- ============================================================
-- 1. LAB TEST WORKFLOW COLUMNS
-- ============================================================

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS accession_number TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS clinical_notes TEXT,
  ADD COLUMN IF NOT EXISTS specimen_type TEXT,
  ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collection_notes TEXT,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS result_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_abnormal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_tests_accession
  ON lab_tests(accession_number)
  WHERE accession_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_tests_priority
  ON lab_tests(priority);

CREATE INDEX IF NOT EXISTS idx_lab_tests_collected_at
  ON lab_tests(collected_at DESC)
  WHERE collected_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_tests_completed_at
  ON lab_tests(completed_at DESC)
  WHERE completed_at IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE lab_tests
    DROP CONSTRAINT IF EXISTS lab_tests_priority_check;

  ALTER TABLE lab_tests
    ADD CONSTRAINT lab_tests_priority_check
    CHECK (priority IN ('routine', 'urgent', 'stat', 'emergency'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE lab_tests
    DROP CONSTRAINT IF EXISTS lab_tests_status_check;

  ALTER TABLE lab_tests
    ADD CONSTRAINT lab_tests_status_check
    CHECK (status IN (
      'pending',
      'ordered',
      'in_progress',
      'collected',
      'processing',
      'completed',
      'cancelled'
    ));
END $$;

-- Optional structured result columns for simple single-analyte tests.
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES lab_test_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS panel_id UUID REFERENCES lab_panels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numeric_value NUMERIC(10, 3),
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS reference_range TEXT,
  ADD COLUMN IF NOT EXISTS result_flag TEXT;

DO $$
BEGIN
  ALTER TABLE lab_tests
    DROP CONSTRAINT IF EXISTS lab_tests_result_flag_check;

  ALTER TABLE lab_tests
    ADD CONSTRAINT lab_tests_result_flag_check
    CHECK (result_flag IS NULL OR result_flag IN (
      'normal',
      'low',
      'high',
      'critical_low',
      'critical_high',
      'abnormal'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_tests_catalog
  ON lab_tests(catalog_id);

CREATE INDEX IF NOT EXISTS idx_lab_tests_panel
  ON lab_tests(panel_id);

-- ============================================================
-- 2. CATALOG METADATA COLUMNS
-- ============================================================

ALTER TABLE lab_test_catalog
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS specimen_type TEXT,
  ADD COLUMN IF NOT EXISTS turnaround_hours NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS analytes JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_test_catalog_code_unique
  ON lab_test_catalog(UPPER(code))
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_active
  ON lab_test_catalog(is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_category
  ON lab_test_catalog(category);

-- ============================================================
-- 3. SEED COMMON STRUCTURED LAB TESTS
-- ============================================================

WITH catalog_seed(code, name, category, price, specimen_type, turnaround_hours, description, analytes) AS (
  VALUES
    (
      'FBC',
      'Full Blood Count',
      'Haematology',
      75.00,
      'blood',
      2.00,
      'Complete blood count with red cells, white cells, platelets, and indices',
      '[
        {"name":"WBC","unit":"x10^9/L","refLow":4.0,"refHigh":11.0},
        {"name":"RBC","unit":"x10^12/L","refLow":4.5,"refHigh":5.5},
        {"name":"Haemoglobin","unit":"g/dL","refLow":12.0,"refHigh":17.5},
        {"name":"Haematocrit","unit":"%","refLow":36,"refHigh":50},
        {"name":"Platelets","unit":"x10^9/L","refLow":150,"refHigh":400},
        {"name":"MCV","unit":"fL","refLow":80,"refHigh":100},
        {"name":"MCH","unit":"pg","refLow":27,"refHigh":33},
        {"name":"MCHC","unit":"g/dL","refLow":32,"refHigh":36}
      ]'::jsonb
    ),
    (
      'BMP',
      'Basic Metabolic Panel',
      'Chemistry',
      80.00,
      'blood',
      4.00,
      'Electrolytes, renal markers, and glucose',
      '[
        {"name":"Sodium","unit":"mmol/L","refLow":136,"refHigh":145},
        {"name":"Potassium","unit":"mmol/L","refLow":3.5,"refHigh":5.1},
        {"name":"Chloride","unit":"mmol/L","refLow":98,"refHigh":106},
        {"name":"Bicarbonate","unit":"mmol/L","refLow":22,"refHigh":29},
        {"name":"BUN","unit":"mg/dL","refLow":7,"refHigh":20},
        {"name":"Creatinine","unit":"mg/dL","refLow":0.6,"refHigh":1.2},
        {"name":"Glucose","unit":"mg/dL","refLow":70,"refHigh":100}
      ]'::jsonb
    ),
    (
      'LFT',
      'Liver Function Tests',
      'Chemistry',
      95.00,
      'blood',
      4.00,
      'Liver enzymes, bilirubin, and proteins',
      '[
        {"name":"ALT","unit":"U/L","refLow":7,"refHigh":56},
        {"name":"AST","unit":"U/L","refLow":10,"refHigh":40},
        {"name":"ALP","unit":"U/L","refLow":44,"refHigh":147},
        {"name":"GGT","unit":"U/L","refLow":9,"refHigh":48},
        {"name":"Total Bilirubin","unit":"mg/dL","refLow":0.1,"refHigh":1.2},
        {"name":"Direct Bilirubin","unit":"mg/dL","refLow":0.0,"refHigh":0.3},
        {"name":"Albumin","unit":"g/dL","refLow":3.5,"refHigh":5.5},
        {"name":"Total Protein","unit":"g/dL","refLow":6.0,"refHigh":8.3}
      ]'::jsonb
    ),
    (
      'RFT',
      'Renal Function Tests',
      'Chemistry',
      90.00,
      'blood',
      4.00,
      'Renal markers and estimated filtration',
      '[
        {"name":"BUN","unit":"mg/dL","refLow":7,"refHigh":20},
        {"name":"Creatinine","unit":"mg/dL","refLow":0.6,"refHigh":1.2},
        {"name":"Uric Acid","unit":"mg/dL","refLow":3.4,"refHigh":7.0},
        {"name":"eGFR","unit":"mL/min/1.73m2","refLow":90,"refHigh":null}
      ]'::jsonb
    ),
    (
      'LIPID',
      'Lipid Profile',
      'Chemistry',
      85.00,
      'blood',
      4.00,
      'Cholesterol and triglyceride profile',
      '[
        {"name":"Total Cholesterol","unit":"mg/dL","refLow":null,"refHigh":200},
        {"name":"LDL Cholesterol","unit":"mg/dL","refLow":null,"refHigh":100},
        {"name":"HDL Cholesterol","unit":"mg/dL","refLow":40,"refHigh":null},
        {"name":"Triglycerides","unit":"mg/dL","refLow":null,"refHigh":150}
      ]'::jsonb
    ),
    (
      'FBS',
      'Fasting Blood Sugar',
      'Chemistry',
      25.00,
      'blood',
      1.00,
      'Fasting glucose measurement',
      '[
        {"name":"Glucose (fasting)","unit":"mg/dL","refLow":70,"refHigh":100}
      ]'::jsonb
    ),
    (
      'URINE',
      'Urinalysis',
      'Microbiology',
      45.00,
      'urine',
      1.00,
      'Urine dipstick and basic microscopy parameters',
      '[
        {"name":"pH","unit":"","refLow":4.5,"refHigh":8.0},
        {"name":"Specific Gravity","unit":"","refLow":1.005,"refHigh":1.030},
        {"name":"Protein","unit":"","qualitativeRef":"Negative"},
        {"name":"Glucose","unit":"","qualitativeRef":"Negative"},
        {"name":"Blood","unit":"","qualitativeRef":"Negative"},
        {"name":"Leukocytes","unit":"","qualitativeRef":"Negative"},
        {"name":"Nitrites","unit":"","qualitativeRef":"Negative"}
      ]'::jsonb
    ),
    (
      'MPRDT',
      'Malaria Rapid Diagnostic Test',
      'Parasitology',
      30.00,
      'blood',
      0.50,
      'Rapid malaria antigen screening',
      '[
        {"name":"P. falciparum","unit":"","qualitativeRef":"Negative"},
        {"name":"Pan-species","unit":"","qualitativeRef":"Negative"}
      ]'::jsonb
    ),
    (
      'BF',
      'Blood Film for Malaria Parasites',
      'Parasitology',
      35.00,
      'blood',
      1.00,
      'Microscopy for malaria parasites and parasite density',
      '[
        {"name":"Malaria Parasites","unit":"","qualitativeRef":"Not seen"},
        {"name":"Parasite density","unit":"/uL","refLow":null,"refHigh":null}
      ]'::jsonb
    ),
    (
      'WIDAL',
      'Widal Test',
      'Serology',
      40.00,
      'blood',
      2.00,
      'Salmonella typhi O and H titres',
      '[
        {"name":"Salmonella typhi O","unit":"titre","qualitativeRef":"<1:80"},
        {"name":"Salmonella typhi H","unit":"titre","qualitativeRef":"<1:80"}
      ]'::jsonb
    ),
    (
      'HIV',
      'HIV Screening',
      'Serology',
      50.00,
      'blood',
      1.00,
      'HIV 1/2 screening result',
      '[
        {"name":"HIV 1/2 Antibody","unit":"","qualitativeRef":"Non-reactive"}
      ]'::jsonb
    ),
    (
      'HBSAG',
      'Hepatitis B Surface Antigen',
      'Serology',
      45.00,
      'blood',
      1.00,
      'Hepatitis B surface antigen screening',
      '[
        {"name":"HBsAg","unit":"","qualitativeRef":"Non-reactive"}
      ]'::jsonb
    ),
    (
      'SICK',
      'Sickling Test',
      'Haematology',
      35.00,
      'blood',
      1.00,
      'Sickle cell screening test',
      '[
        {"name":"Sickling","unit":"","qualitativeRef":"Negative"}
      ]'::jsonb
    ),
    (
      'G6PD',
      'G6PD Screening',
      'Haematology',
      60.00,
      'blood',
      2.00,
      'G6PD activity and qualitative screening',
      '[
        {"name":"G6PD Activity","unit":"U/g Hb","refLow":6.97,"refHigh":20.5},
        {"name":"G6PD Qualitative","unit":"","qualitativeRef":"Normal"}
      ]'::jsonb
    ),
    (
      'VDRL',
      'VDRL / RPR',
      'Serology',
      40.00,
      'blood',
      1.00,
      'Syphilis screening test',
      '[
        {"name":"VDRL/RPR","unit":"","qualitativeRef":"Non-reactive"}
      ]'::jsonb
    ),
    (
      'PREG',
      'Pregnancy Test',
      'Chemistry',
      25.00,
      'urine',
      0.50,
      'Urine hCG pregnancy test',
      '[
        {"name":"hCG","unit":"","qualitativeRef":"Negative"}
      ]'::jsonb
    ),
    (
      'AFB',
      'AFB Smear',
      'Microbiology',
      60.00,
      'sputum',
      4.00,
      'Acid-fast bacilli smear for tuberculosis screening',
      '[
        {"name":"AFB Smear 1","unit":"","qualitativeRef":"No AFB seen"},
        {"name":"AFB Smear 2","unit":"","qualitativeRef":"No AFB seen"}
      ]'::jsonb
    ),
    (
      'HBA1C',
      'HbA1c',
      'Chemistry',
      90.00,
      'blood',
      2.00,
      'Glycated haemoglobin for diabetes monitoring',
      '[
        {"name":"HbA1c","unit":"%","refLow":null,"refHigh":5.7},
        {"name":"HbA1c (IFCC)","unit":"mmol/mol","refLow":null,"refHigh":39}
      ]'::jsonb
    )
)
INSERT INTO lab_test_catalog (
  code,
  name,
  category,
  price,
  specimen_type,
  turnaround_hours,
  description,
  analytes,
  is_active
)
SELECT
  s.code,
  s.name,
  s.category,
  s.price,
  s.specimen_type,
  s.turnaround_hours,
  s.description,
  s.analytes,
  TRUE
FROM catalog_seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM lab_test_catalog c
  WHERE UPPER(COALESCE(c.code, '')) = s.code
     OR LOWER(c.name) = LOWER(s.name)
);

WITH catalog_seed(code, name, category, price, specimen_type, turnaround_hours, description, analytes) AS (
  VALUES
    ('FBC', 'Full Blood Count', 'Haematology', 75.00, 'blood', 2.00, 'Complete blood count with red cells, white cells, platelets, and indices', '[
      {"name":"WBC","unit":"x10^9/L","refLow":4.0,"refHigh":11.0},
      {"name":"RBC","unit":"x10^12/L","refLow":4.5,"refHigh":5.5},
      {"name":"Haemoglobin","unit":"g/dL","refLow":12.0,"refHigh":17.5},
      {"name":"Haematocrit","unit":"%","refLow":36,"refHigh":50},
      {"name":"Platelets","unit":"x10^9/L","refLow":150,"refHigh":400},
      {"name":"MCV","unit":"fL","refLow":80,"refHigh":100},
      {"name":"MCH","unit":"pg","refLow":27,"refHigh":33},
      {"name":"MCHC","unit":"g/dL","refLow":32,"refHigh":36}
    ]'::jsonb),
    ('BMP', 'Basic Metabolic Panel', 'Chemistry', 80.00, 'blood', 4.00, 'Electrolytes, renal markers, and glucose', '[
      {"name":"Sodium","unit":"mmol/L","refLow":136,"refHigh":145},
      {"name":"Potassium","unit":"mmol/L","refLow":3.5,"refHigh":5.1},
      {"name":"Chloride","unit":"mmol/L","refLow":98,"refHigh":106},
      {"name":"Bicarbonate","unit":"mmol/L","refLow":22,"refHigh":29},
      {"name":"BUN","unit":"mg/dL","refLow":7,"refHigh":20},
      {"name":"Creatinine","unit":"mg/dL","refLow":0.6,"refHigh":1.2},
      {"name":"Glucose","unit":"mg/dL","refLow":70,"refHigh":100}
    ]'::jsonb),
    ('LFT', 'Liver Function Tests', 'Chemistry', 95.00, 'blood', 4.00, 'Liver enzymes, bilirubin, and proteins', '[
      {"name":"ALT","unit":"U/L","refLow":7,"refHigh":56},
      {"name":"AST","unit":"U/L","refLow":10,"refHigh":40},
      {"name":"ALP","unit":"U/L","refLow":44,"refHigh":147},
      {"name":"GGT","unit":"U/L","refLow":9,"refHigh":48},
      {"name":"Total Bilirubin","unit":"mg/dL","refLow":0.1,"refHigh":1.2},
      {"name":"Direct Bilirubin","unit":"mg/dL","refLow":0.0,"refHigh":0.3},
      {"name":"Albumin","unit":"g/dL","refLow":3.5,"refHigh":5.5},
      {"name":"Total Protein","unit":"g/dL","refLow":6.0,"refHigh":8.3}
    ]'::jsonb),
    ('RFT', 'Renal Function Tests', 'Chemistry', 90.00, 'blood', 4.00, 'Renal markers and estimated filtration', '[
      {"name":"BUN","unit":"mg/dL","refLow":7,"refHigh":20},
      {"name":"Creatinine","unit":"mg/dL","refLow":0.6,"refHigh":1.2},
      {"name":"Uric Acid","unit":"mg/dL","refLow":3.4,"refHigh":7.0},
      {"name":"eGFR","unit":"mL/min/1.73m2","refLow":90,"refHigh":null}
    ]'::jsonb),
    ('LIPID', 'Lipid Profile', 'Chemistry', 85.00, 'blood', 4.00, 'Cholesterol and triglyceride profile', '[
      {"name":"Total Cholesterol","unit":"mg/dL","refLow":null,"refHigh":200},
      {"name":"LDL Cholesterol","unit":"mg/dL","refLow":null,"refHigh":100},
      {"name":"HDL Cholesterol","unit":"mg/dL","refLow":40,"refHigh":null},
      {"name":"Triglycerides","unit":"mg/dL","refLow":null,"refHigh":150}
    ]'::jsonb),
    ('FBS', 'Fasting Blood Sugar', 'Chemistry', 25.00, 'blood', 1.00, 'Fasting glucose measurement', '[{"name":"Glucose (fasting)","unit":"mg/dL","refLow":70,"refHigh":100}]'::jsonb),
    ('URINE', 'Urinalysis', 'Microbiology', 45.00, 'urine', 1.00, 'Urine dipstick and basic microscopy parameters', '[
      {"name":"pH","unit":"","refLow":4.5,"refHigh":8.0},
      {"name":"Specific Gravity","unit":"","refLow":1.005,"refHigh":1.030},
      {"name":"Protein","unit":"","qualitativeRef":"Negative"},
      {"name":"Glucose","unit":"","qualitativeRef":"Negative"},
      {"name":"Blood","unit":"","qualitativeRef":"Negative"},
      {"name":"Leukocytes","unit":"","qualitativeRef":"Negative"},
      {"name":"Nitrites","unit":"","qualitativeRef":"Negative"}
    ]'::jsonb),
    ('MPRDT', 'Malaria Rapid Diagnostic Test', 'Parasitology', 30.00, 'blood', 0.50, 'Rapid malaria antigen screening', '[{"name":"P. falciparum","unit":"","qualitativeRef":"Negative"},{"name":"Pan-species","unit":"","qualitativeRef":"Negative"}]'::jsonb),
    ('BF', 'Blood Film for Malaria Parasites', 'Parasitology', 35.00, 'blood', 1.00, 'Microscopy for malaria parasites and parasite density', '[{"name":"Malaria Parasites","unit":"","qualitativeRef":"Not seen"},{"name":"Parasite density","unit":"/uL","refLow":null,"refHigh":null}]'::jsonb),
    ('WIDAL', 'Widal Test', 'Serology', 40.00, 'blood', 2.00, 'Salmonella typhi O and H titres', '[{"name":"Salmonella typhi O","unit":"titre","qualitativeRef":"<1:80"},{"name":"Salmonella typhi H","unit":"titre","qualitativeRef":"<1:80"}]'::jsonb),
    ('HIV', 'HIV Screening', 'Serology', 50.00, 'blood', 1.00, 'HIV 1/2 screening result', '[{"name":"HIV 1/2 Antibody","unit":"","qualitativeRef":"Non-reactive"}]'::jsonb),
    ('HBSAG', 'Hepatitis B Surface Antigen', 'Serology', 45.00, 'blood', 1.00, 'Hepatitis B surface antigen screening', '[{"name":"HBsAg","unit":"","qualitativeRef":"Non-reactive"}]'::jsonb),
    ('SICK', 'Sickling Test', 'Haematology', 35.00, 'blood', 1.00, 'Sickle cell screening test', '[{"name":"Sickling","unit":"","qualitativeRef":"Negative"}]'::jsonb),
    ('G6PD', 'G6PD Screening', 'Haematology', 60.00, 'blood', 2.00, 'G6PD activity and qualitative screening', '[{"name":"G6PD Activity","unit":"U/g Hb","refLow":6.97,"refHigh":20.5},{"name":"G6PD Qualitative","unit":"","qualitativeRef":"Normal"}]'::jsonb),
    ('VDRL', 'VDRL / RPR', 'Serology', 40.00, 'blood', 1.00, 'Syphilis screening test', '[{"name":"VDRL/RPR","unit":"","qualitativeRef":"Non-reactive"}]'::jsonb),
    ('PREG', 'Pregnancy Test', 'Chemistry', 25.00, 'urine', 0.50, 'Urine hCG pregnancy test', '[{"name":"hCG","unit":"","qualitativeRef":"Negative"}]'::jsonb),
    ('AFB', 'AFB Smear', 'Microbiology', 60.00, 'sputum', 4.00, 'Acid-fast bacilli smear for tuberculosis screening', '[{"name":"AFB Smear 1","unit":"","qualitativeRef":"No AFB seen"},{"name":"AFB Smear 2","unit":"","qualitativeRef":"No AFB seen"}]'::jsonb),
    ('HBA1C', 'HbA1c', 'Chemistry', 90.00, 'blood', 2.00, 'Glycated haemoglobin for diabetes monitoring', '[{"name":"HbA1c","unit":"%","refLow":null,"refHigh":5.7},{"name":"HbA1c (IFCC)","unit":"mmol/mol","refLow":null,"refHigh":39}]'::jsonb)
)
UPDATE lab_test_catalog c
SET
  code = COALESCE(c.code, s.code),
  specimen_type = COALESCE(c.specimen_type, s.specimen_type),
  turnaround_hours = COALESCE(c.turnaround_hours, s.turnaround_hours),
  analytes = CASE
    WHEN c.analytes IS NULL OR c.analytes = '[]'::jsonb THEN s.analytes
    ELSE c.analytes
  END,
  description = COALESCE(c.description, s.description),
  updated_at = NOW()
FROM catalog_seed s
WHERE LOWER(c.name) = LOWER(s.name)
   OR UPPER(COALESCE(c.code, '')) = s.code;

-- ============================================================
-- 4. PANEL TABLE SEEDING
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_panels_code_unique
  ON lab_panels(UPPER(code))
  WHERE code IS NOT NULL;

WITH panel_seed(code, name, category, price, turnaround_hours, tests) AS (
  SELECT
    code,
    name,
    category,
    price,
    turnaround_hours::INTEGER,
    analytes
  FROM lab_test_catalog
  WHERE code IN (
    'FBC',
    'BMP',
    'LFT',
    'RFT',
    'LIPID',
    'URINE',
    'MPRDT',
    'BF',
    'WIDAL',
    'G6PD',
    'HBA1C'
  )
)
INSERT INTO lab_panels (
  code,
  name,
  category,
  price,
  turnaround_hours,
  tests,
  is_active
)
SELECT
  p.code,
  p.name,
  p.category,
  p.price,
  p.turnaround_hours,
  p.tests,
  TRUE
FROM panel_seed p
WHERE NOT EXISTS (
  SELECT 1
  FROM lab_panels lp
  WHERE UPPER(COALESCE(lp.code, '')) = p.code
     OR LOWER(lp.name) = LOWER(p.name)
);

WITH panel_seed(code, name, category, price, turnaround_hours, tests) AS (
  SELECT
    code,
    name,
    category,
    price,
    turnaround_hours::INTEGER,
    analytes
  FROM lab_test_catalog
  WHERE code IN (
    'FBC',
    'BMP',
    'LFT',
    'RFT',
    'LIPID',
    'URINE',
    'MPRDT',
    'BF',
    'WIDAL',
    'G6PD',
    'HBA1C'
  )
)
UPDATE lab_panels lp
SET
  tests = CASE
    WHEN lp.tests IS NULL OR lp.tests = '[]'::jsonb THEN p.tests
    ELSE lp.tests
  END,
  category = COALESCE(lp.category, p.category),
  price = COALESCE(lp.price, p.price),
  turnaround_hours = COALESCE(lp.turnaround_hours, p.turnaround_hours),
  updated_at = NOW()
FROM panel_seed p
WHERE LOWER(lp.name) = LOWER(p.name)
   OR UPPER(COALESCE(lp.code, '')) = p.code;

-- ============================================================
-- 5. API CACHE REFRESH
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- MIGRATION 014 COMPLETE
-- Lab attendants can now store structured analyte results in:
--   lab_tests.result_details->'analytes'
-- Catalog/panel parameters live in:
--   lab_test_catalog.analytes
--   lab_panels.tests
-- ============================================================
