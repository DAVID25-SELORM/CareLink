-- ============================================
-- CareLink HMS - Sample Data Script
-- Author: David Gabion Selorm
-- Email: gabiondavidselorm@gmail.com
-- Date: April 2, 2026
-- ============================================
--
-- This script populates your database with realistic sample data
-- including patients, drugs, prescriptions, appointments, and more.
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create New Query
-- 4. Copy and paste this ENTIRE script
-- 5. Click "Run" or press Ctrl+Enter
--
-- ============================================

-- ============================================
-- 1. PATIENTS (10 Sample Patients)
-- ============================================

INSERT INTO patients (name, age, gender, phone, email, address, nhis_number, insurance_type, insurance_name, emergency_contact, emergency_phone, blood_group, allergies)
VALUES 
  ('Kwame Mensah', 45, 'male', '+233244123456', 'kwame.mensah@email.com', 'East Legon, Accra', 'NHIS2024001', 'nhis', 'NHIS', 'Ama Mensah', '+233244123457', 'O+', 'Penicillin'),
  ('Akua Asante', 32, 'female', '+233501234567', 'akua.asante@email.com', 'Osu, Accra', 'NHIS2024002', 'nhis', 'NHIS', 'Kofi Asante', '+233501234568', 'A+', 'None'),
  ('Emmanuel Boateng', 28, 'male', '+233241234567', 'emmanuel.b@email.com', 'Kumasi, Ashanti', 'NHIS2024003', 'private', 'Prudential Life Insurance', 'Grace Boateng', '+233241234568', 'B+', 'Sulfa drugs'),
  ('Abena Osei', 55, 'female', '+233201234567', 'abena.osei@email.com', 'Tema, Greater Accra', 'NHIS2024004', 'nhis', 'NHIS', 'Yaw Osei', '+233201234568', 'AB+', 'None'),
  ('David Gabion', 38, 'male', '+233247654381', 'gabiondavidselorm@gmail.com', 'Madina, Accra', 'NHIS2024005', 'private', 'Star Life Assurance', 'Rebecca Gabion', '+233247654382', 'O+', 'None'),
  ('Efua Adjei', 62, 'female', '+233551234567', 'efua.adjei@email.com', 'Cape Coast, Central', 'NHIS2024006', 'nhis', 'NHIS', 'Kwabena Adjei', '+233551234568', 'A-', 'Aspirin'),
  ('Kofi Frimpong', 42, 'male', '+233261234567', 'kofi.frimpong@email.com', 'Takoradi, Western', 'NHIS2024007', 'private', 'Enterprise Life', 'Adwoa Frimpong', '+233261234568', 'B-', 'None'),
  ('Ama Tetteh', 19, 'female', '+233271234567', 'ama.tetteh@email.com', 'Achimota, Accra', 'NHIS2024008', 'nhis', 'NHIS', 'Martha Tetteh', '+233271234568', 'O-', 'Latex'),
  ('Yaw Appiah', 50, 'male', '+233281234567', 'yaw.appiah@email.com', 'Kasoa, Central', 'NHIS2024009', 'none', NULL, 'Sarah Appiah', '+233281234568', 'A+', 'None'),
  ('Grace Owusu', 35, 'female', '+233291234567', 'grace.owusu@email.com', 'Spintex, Accra', 'NHIS2024010', 'private', 'Allianz Life Insurance', 'Samuel Owusu', '+233291234568', 'B+', 'Iodine')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. DRUGS (30 Common Medicines)
-- ============================================

INSERT INTO drugs (name, category, description, price, stock, unit, reorder_level, manufacturer, expiry_date)
VALUES 
  -- Pain & Fever
  ('Paracetamol 500mg', 'Analgesics', 'Pain relief and fever reducer', 2.50, 500, 'tablets', 50, 'Ernest Chemists Ltd', '2026-12-31'),
  ('Ibuprofen 400mg', 'Analgesics', 'Anti-inflammatory and pain relief', 3.00, 300, 'tablets', 50, 'Danadams Pharmaceutical', '2026-10-31'),
  ('Aspirin 300mg', 'Analgesics', 'Pain relief and blood thinner', 2.00, 250, 'tablets', 40, 'Kinapharma Ltd', '2026-11-30'),
  ('Diclofenac 50mg', 'Analgesics', 'Strong pain relief', 4.50, 200, 'tablets', 30, 'Ayrton Drug Manufacturing', '2027-01-31'),
  
  -- Antibiotics
  ('Amoxicillin 500mg', 'Antibiotics', 'Broad-spectrum antibiotic', 5.00, 400, 'capsules', 60, 'Phyto-Riker', '2026-09-30'),
  ('Ciprofloxacin 500mg', 'Antibiotics', 'Fluoroquinolone antibiotic', 8.00, 250, 'tablets', 40, 'LaGray Chemical', '2026-08-31'),
  ('Azithromycin 250mg', 'Antibiotics', 'Macrolide antibiotic', 12.00, 180, 'tablets', 30, 'Ernest Chemists Ltd', '2027-02-28'),
  ('Metronidazole 400mg', 'Antibiotics', 'Antibiotic and antiprotozoal', 4.00, 300, 'tablets', 50, 'Entrance Pharmaceuticals', '2026-12-15'),
  
  -- Antimalarials
  ('Artemether-Lumefantrine', 'Antimalarial', 'First-line malaria treatment', 15.00, 350, 'tablets', 60, 'Danadams Pharmaceutical', '2027-03-31'),
  ('Artesunate 50mg', 'Antimalarial', 'Severe malaria treatment', 20.00, 200, 'tablets', 40, 'LaGray Chemical', '2026-11-30'),
  ('Quinine 300mg', 'Antimalarial', 'Malaria treatment', 6.00, 180, 'tablets', 30, 'Kinapharma Ltd', '2026-10-31'),
  
  -- Gastrointestinal
  ('Omeprazole 20mg', 'Antacids', 'Proton pump inhibitor for ulcers', 5.50, 280, 'capsules', 40, 'Ayrton Drug Manufacturing', '2027-01-15'),
  ('Ranitidine 150mg', 'Antacids', 'Reduces stomach acid', 3.50, 250, 'tablets', 40, 'Phyto-Riker', '2026-12-31'),
  ('ORS (Oral Rehydration Salts)', 'Rehydration', 'Treats dehydration', 2.00, 500, 'sachets', 80, 'Ernest Chemists Ltd', '2028-06-30'),
  ('Loperamide 2mg', 'Antidiarrheal', 'Stops diarrhea', 4.00, 200, 'tablets', 30, 'Entrance Pharmaceuticals', '2027-02-28'),
  
  -- Cardiovascular
  ('Lisinopril 10mg', 'Antihypertensives', 'Lowers blood pressure', 8.00, 220, 'tablets', 35, 'LaGray Chemical', '2027-04-30'),
  ('Atenolol 50mg', 'Antihypertensives', 'Beta blocker for hypertension', 6.50, 200, 'tablets', 30, 'Danadams Pharmaceutical', '2026-11-30'),
  ('Amlodipine 5mg', 'Antihypertensives', 'Calcium channel blocker', 7.00, 250, 'tablets', 40, 'Kinapharma Ltd', '2027-01-31'),
  ('Atorvastatin 20mg', 'Statins', 'Lowers cholesterol', 12.00, 180, 'tablets', 30, 'Ayrton Drug Manufacturing', '2026-12-31'),
  
  -- Diabetes
  ('Metformin 500mg', 'Antidiabetic', 'Blood sugar control', 5.00, 300, 'tablets', 50, 'Phyto-Riker', '2027-03-31'),
  ('Glibenclamide 5mg', 'Antidiabetic', 'Stimulates insulin release', 4.50, 220, 'tablets', 35, 'Ernest Chemists Ltd', '2026-10-31'),
  
  -- Respiratory
  ('Salbutamol Inhaler', 'Bronchodilators', 'Asthma relief', 18.00, 100, 'inhalers', 20, 'LaGray Chemical', '2027-06-30'),
  ('Cetirizine 10mg', 'Antihistamines', 'Allergy relief', 3.00, 300, 'tablets', 50, 'Entrance Pharmaceuticals', '2027-02-28'),
  ('Ambroxol 30mg', 'Expectorants', 'Cough suppressant', 4.50, 250, 'tablets', 40, 'Danadams Pharmaceutical', '2026-12-15'),
  
  -- Supplements
  ('Multivitamin', 'Vitamins', 'Daily vitamin supplement', 10.00, 200, 'tablets', 30, 'Ernest Chemists Ltd', '2028-12-31'),
  ('Vitamin C 1000mg', 'Vitamins', 'Immune booster', 8.00, 250, 'tablets', 40, 'Kinapharma Ltd', '2028-06-30'),
  ('Iron Tablets (Ferrous Sulfate)', 'Minerals', 'Treats anemia', 5.00, 200, 'tablets', 30, 'Phyto-Riker', '2027-12-31'),
  
  -- Topical
  ('Gentamicin Cream', 'Topical Antibiotics', 'Skin infection treatment', 6.00, 150, 'tubes', 25, 'Ayrton Drug Manufacturing', '2026-11-30'),
  ('Hydrocortisone Cream 1%', 'Corticosteroids', 'Anti-inflammatory cream', 7.50, 120, 'tubes', 20, 'LaGray Chemical', '2027-01-31'),
  ('Clotrimazole Cream', 'Antifungal', 'Treats fungal infections', 8.00, 140, 'tubes', 25, 'Entrance Pharmaceuticals', '2027-03-31')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. APPOINTMENTS (8 Sample Appointments)
-- ============================================

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Kwame Mensah'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-05',
  '09:00:00',
  'General checkup and hypertension follow-up',
  'scheduled'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Kwame Mensah');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Akua Asante'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-05',
  '10:30:00',
  'Prenatal care consultation',
  'scheduled'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Akua Asante');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Emmanuel Boateng'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-03',
  '14:00:00',
  'Sports injury - knee pain',
  'completed'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Emmanuel Boateng');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Abena Osei'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-08',
  '11:00:00',
  'Diabetes management review',
  'scheduled'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Abena Osei');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'David Gabion'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-02',
  '15:30:00',
  'Annual health screening',
  'completed'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'David Gabion');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Efua Adjei'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-06',
  '09:30:00',
  'Back pain consultation',
  'scheduled'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Efua Adjei');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Ama Tetteh'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-07',
  '13:00:00',
  'Skin rash examination',
  'scheduled'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Ama Tetteh');

INSERT INTO appointments (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, reason, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Grace Owusu'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  '2026-04-01',
  '16:00:00',
  'Cold and flu symptoms',
  'completed'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Grace Owusu');

-- ============================================
-- 4. PRESCRIPTIONS (5 Sample Prescriptions)
-- ============================================

-- Prescription 1: Kwame Mensah (Hypertension)
INSERT INTO prescriptions (patient_id, doctor_id, doctor_name, diagnosis, notes, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Kwame Mensah'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'Hypertension (High Blood Pressure)',
  'Patient advised to reduce salt intake, exercise regularly, and return in 2 weeks for follow-up.',
  'dispensed'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Kwame Mensah');

-- Prescription 2: Emmanuel Boateng (Injury)
INSERT INTO prescriptions (patient_id, doctor_id, doctor_name, diagnosis, notes, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Emmanuel Boateng'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'Knee Sprain - Sports Injury',
  'Rest for 1 week. Apply ice. Avoid strenuous activities.',
  'dispensed'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Emmanuel Boateng');

-- Prescription 3: Grace Owusu (Cold/Flu)
INSERT INTO prescriptions (patient_id, doctor_id, doctor_name, diagnosis, notes, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Grace Owusu'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'Upper Respiratory Tract Infection (Common Cold)',
  'Drink plenty of fluids. Rest well. Symptoms should improve in 3-5 days.',
  'dispensed'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Grace Owusu');

-- Prescription 4: Abena Osei (Diabetes)
INSERT INTO prescriptions (patient_id, doctor_id, doctor_name, diagnosis, notes, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Abena Osei'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'Type 2 Diabetes Mellitus',
  'Monitor blood sugar levels daily. Diet modification recommended. Regular exercise.',
  'pending'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Abena Osei');

-- Prescription 5: Akua Asante (Prenatal)
INSERT INTO prescriptions (patient_id, doctor_id, doctor_name, diagnosis, notes, status)
SELECT 
  (SELECT id FROM patients WHERE name = 'Akua Asante'),
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'Prenatal Care - Iron Deficiency Anemia',
  'Continue prenatal vitamins. Iron supplements for anemia. Follow-up ultrasound scheduled.',
  'pending'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Akua Asante');

-- ============================================
-- 5. PRESCRIPTION ITEMS (Detailed medications)
-- ============================================

-- For Prescription 1 (Kwame - Hypertension)
INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Kwame Mensah') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Lisinopril 10mg'),
  'Lisinopril 10mg',
  30,
  '10mg',
  'Once daily',
  '30 days',
  'Take in the morning with water. Do not skip doses.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Kwame Mensah'));

INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Kwame Mensah') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Amlodipine 5mg'),
  'Amlodipine 5mg',
  30,
  '5mg',
  'Once daily',
  '30 days',
  'Take in the evening. Monitor blood pressure regularly.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Kwame Mensah'));

-- For Prescription 2 (Emmanuel - Injury)
INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Emmanuel Boateng') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Ibuprofen 400mg'),
  'Ibuprofen 400mg',
  20,
  '400mg',
  'Twice daily',
  '10 days',
  'Take after meals to avoid stomach upset.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Emmanuel Boateng'));

INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Emmanuel Boateng') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Diclofenac 50mg'),
  'Diclofenac 50mg',
  15,
  '50mg',
  'Once daily at night',
  '15 days',
  'Apply ice pack to knee for 15 minutes before bedtime.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Emmanuel Boateng'));

-- For Prescription 3 (Grace - Cold/Flu)
INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Grace Owusu') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Paracetamol 500mg'),
  'Paracetamol 500mg',
  12,
  '500mg',
  'Three times daily',
  '4 days',
  'Take with warm water. Use for fever and body aches.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Grace Owusu'));

INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Grace Owusu') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Cetirizine 10mg'),
  'Cetirizine 10mg',
  5,
  '10mg',
  'Once daily at night',
  '5 days',
  'For runny nose and sneezing.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Grace Owusu'));

INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Grace Owusu') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Ambroxol 30mg'),
  'Ambroxol 30mg',
  10,
  '30mg',
  'Twice daily',
  '5 days',
  'For cough relief. Take after meals.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Grace Owusu'));

-- For Prescription 4 (Abena - Diabetes)
INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Abena Osei') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Metformin 500mg'),
  'Metformin 500mg',
  60,
  '500mg',
  'Twice daily',
  '30 days',
  'Take with breakfast and dinner. Monitor blood sugar levels.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Abena Osei'));

INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Abena Osei') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Glibenclamide 5mg'),
  'Glibenclamide 5mg',
  30,
  '5mg',
  'Once daily',
  '30 days',
  'Take before breakfast. Avoid skipping meals.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Abena Osei'));

-- For Prescription 5 (Akua - Prenatal)
INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Akua Asante') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Iron Tablets (Ferrous Sulfate)'),
  'Iron Tablets (Ferrous Sulfate)',
  60,
  '200mg',
  'Twice daily',
  '30 days',
  'Take with orange juice for better absorption. May cause dark stools (normal).'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Akua Asante'));

INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency, duration, instructions)
SELECT 
  (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Akua Asante') LIMIT 1),
  (SELECT id FROM drugs WHERE name = 'Multivitamin'),
  'Multivitamin',
  30,
  '1 tablet',
  'Once daily',
  '30 days',
  'Prenatal vitamin. Take with breakfast.'
WHERE EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE name = 'Akua Asante'));

-- ============================================
-- 6. LAB TESTS (4 Sample Tests)
-- ============================================

INSERT INTO lab_tests (patient_id, test_name, test_type, requested_by, doctor_name, status, result, notes)
SELECT 
  (SELECT id FROM patients WHERE name = 'Kwame Mensah'),
  'Blood Pressure Monitoring',
  'Cardiovascular',
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'completed',
  'BP: 145/92 mmHg (High) - Continue medication and lifestyle modifications.',
  'Patient requires regular monitoring. Recheck in 2 weeks.'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Kwame Mensah');

INSERT INTO lab_tests (patient_id, test_name, test_type, requested_by, doctor_name, status, result, notes)
SELECT 
  (SELECT id FROM patients WHERE name = 'Abena Osei'),
  'Fasting Blood Sugar',
  'Diabetes',
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'completed',
  'FBS: 8.2 mmol/L (Elevated) - Continue diabetic medication.',
  'HbA1c test recommended for long-term glucose control assessment.'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Abena Osei');

INSERT INTO lab_tests (patient_id, test_name, test_type, requested_by, doctor_name, status, notes)
SELECT 
  (SELECT id FROM patients WHERE name = 'Akua Asante'),
  'Hemoglobin Level Test',
  'Hematology',
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'pending',
  'Sample collected. Results pending.'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'Akua Asante');

INSERT INTO lab_tests (patient_id, test_name, test_type, requested_by, doctor_name, status, notes)
SELECT 
  (SELECT id FROM patients WHERE name = 'David Gabion'),
  'Complete Blood Count (CBC)',
  'General',
  (SELECT id FROM users WHERE email = 'doctor@carelink.com'),
  'Dr. Sarah Johnson',
  'in_progress',
  'Sample being processed. Results available tomorrow.'
WHERE EXISTS (SELECT 1 FROM patients WHERE name = 'David Gabion');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check counts
SELECT 'Patients' as Item, COUNT(*) as Count FROM patients
UNION ALL
SELECT 'Drugs', COUNT(*) FROM drugs
UNION ALL
SELECT 'Appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'Prescriptions', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'Prescription Items', COUNT(*) FROM prescription_items
UNION ALL
SELECT 'Lab Tests', COUNT(*) FROM lab_tests;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

-- If you see no errors above, your sample data has been successfully loaded!
-- 
-- Summary:
-- ✅ 10 Sample Patients
-- ✅ 30 Common Drugs
-- ✅ 8 Appointments
-- ✅ 5 Prescriptions with detailed medication items
-- ✅ 4 Lab Tests
--
-- Next steps:
-- 1. Refresh your CareLink dashboard
-- 2. Explore the different modules
-- 3. Test the system functionality
--
-- Enjoy using CareLink HMS!
-- ============================================
