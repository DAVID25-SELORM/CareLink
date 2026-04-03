# 🔄 CareLink HMS - Referral & Appointment Booking System Guide

**Author:** David Gabion Selorm  
**Date:** April 3, 2026  
**Status:** ✅ Active & Deployed

---

## 🎯 Overview

All 36 medical specialties can now:
1. **Book appointments** for patients
2. **Refer patients** to other specialists in the hospital

---

## 📅 APPOINTMENT BOOKING

### How to Book an Appointment:

1. **Login as any doctor** (doctor@carelink.com, cardiologist@carelink.com, etc.)
2. Navigate to your **Doctor Dashboard**
3. Click **"📅 Book Appointment"** button (green button in header)
4. Fill in the form:
   - **Select Patient:** Choose from all hospital patients
   - **Date:** Select appointment date (today or future)
   - **Time:** Choose appointment time
   - **Reason:** Describe purpose of visit
5. Click **"Book Appointment"**

### What Happens:
- ✅ Appointment created with status "scheduled"
- ✅ Automatically assigned to you as the doctor
- ✅ Appears in your "Today's Schedule" if scheduled for today
- ✅ Visible in Appointments page
- ✅ Audit log created

---

## 🔄 PATIENT REFERRAL SYSTEM

### How to Refer a Patient:

1. **Login as any doctor**
2. Navigate to your **Doctor Dashboard**
3. Click **"🔄 Refer Patient"** button (purple button in header)
4. Fill in the referral form:
   - **Select Patient:** Choose patient to refer
   - **Refer to Specialist:** Select from 36 specialties (grouped by specialty)
   - **Urgency Level:**
     - **Routine** - Within 2 weeks
     - **Urgent** - Within 3 days
     - **Emergency** - Same day
   - **Reason for Referral:** Why patient needs specialist care
   - **Clinical Notes:** Patient history, findings, test results
5. Click **"Submit Referral"**

### What Happens:
- ✅ Referral created with status "pending"
- ✅ Records both referring and receiving doctor details
- ✅ Receiving doctor can view referral
- ✅ Tracks urgency and clinical notes
- ✅ Audit log created

---

## 🧪 TESTING GUIDE

### Test #1: Book an Appointment

```
Login: doctor@carelink.com
Password: Doctor123!

Steps:
1. Go to Doctor Dashboard
2. Click "📅 Book Appointment"
3. Select Patient: "Kwame Mensah"
4. Date: Tomorrow
5. Time: 10:00 AM
6. Reason: "Follow-up consultation for hypertension"
7. Submit
```

**Expected Result:** Success notification, appointment appears in schedule

---

### Test #2: Refer a Patient to Specialist

```
Login: doctor@carelink.com (General Practitioner)

Steps:
1. Go to Doctor Dashboard
2. Click "🔄 Refer Patient"
3. Select Patient: "Kwame Mensah"
4. Refer to: Cardiologist (if available)
5. Urgency: "Urgent - Within 3 days"
6. Reason: "Suspected cardiac arrhythmia"
7. Notes: "Patient reports irregular heartbeat, abnormal ECG"
8. Submit
```

**Expected Result:** Success notification confirming referral created

---

### Test #3: Create Multiple Specialists (using Admin)

```
Login: admin@carelink.com
Password: Admin123!

Steps:
1. Go to "Users" page
2. Create multiple doctors with different specialties:
   - Cardiologist (cardio@carelink.com)
   - Dentist (dentist@carelink.com)
   - Dietician (dietician@carelink.com)
   - Optometrist (optometrist@carelink.com)
   - Physiotherapist (physio@carelink.com)
3. Each gets their specialty-specific dashboard
```

---

### Test #4: Cross-Specialty Referral

```
1. Login as Cardiologist
2. Refer patient to Dietician for weight management
3. Logout

4. Login as Dietician
5. Check referrals (future feature - referral management page)
```

---

## 📊 DATABASE VERIFICATION

### Check Referrals Table:

```sql
-- View all referrals
SELECT 
  r.id,
  p.name AS patient_name,
  r.referring_doctor_name,
  r.referring_doctor_specialty,
  r.referred_to_doctor_name,
  r.referred_to_doctor_specialty,
  r.reason,
  r.urgency,
  r.status,
  r.created_at
FROM referrals r
JOIN patients p ON r.patient_id = p.id
ORDER BY r.created_at DESC;
```

### Check Appointments Created by Doctors:

```sql
-- View appointments booked by doctors
SELECT 
  a.id,
  p.name AS patient_name,
  a.doctor_name,
  a.appointment_date,
  a.appointment_time,
  a.reason,
  a.status,
  a.created_at
FROM appointments a
JOIN patients p ON a.patient_id = p.id
ORDER BY a.created_at DESC
LIMIT 10;
```

---

## 🎨 UI FEATURES

### Doctor Dashboard Now Has:

**Header Actions (3 buttons):**
1. **📅 Book Appointment** (Green) - Quick appointment booking
2. **🔄 Refer Patient** (Purple) - Specialist referrals
3. **📋 New Prescription** (Blue) - Write prescriptions

**Modal Forms:**
- Clean, professional design
- Patient search with details (age, gender, phone)
- Specialty-grouped doctor selection
- Urgency indicators
- Clinical notes field
- Real-time validation
- Success/error notifications

---

## 🔐 SECURITY

### Row Level Security (RLS):

**Referrals Table:**
- ✅ Doctors can only view referrals they made or received
- ✅ Doctors can create new referrals
- ✅ Receiving doctors can update referral status
- ✅ Admins have full access
- ✅ All actions are audit logged

**Appointments Table:**
- ✅ Existing RLS policies apply
- ✅ Doctors can book appointments for their patients
- ✅ All actions are audit logged

---

## 🚀 FUTURE ENHANCEMENTS

### Coming Soon:
1. **Referral Management Page**
   - View received referrals
   - Accept/Reject referrals
   - Add follow-up notes

2. **Email Notifications**
   - Notify receiving doctor of new referral
   - Remind about urgent referrals
   - Confirmation emails

3. **Referral Dashboard Stats**
   - Pending referrals count
   - Accepted vs rejected ratio
   - Urgency breakdown

4. **Referral History**
   - View patient's referral chain
   - See which specialists patient has seen
   - Track outcomes

---

## 🌐 LIVE SYSTEM

- **URL:** https://care-link-l6u9.vercel.app
- **Status:** ✅ Live and deployed
- **Referrals Table:** ✅ Created
- **Features:** ✅ Fully functional

---

## 📞 SUPPORT

**Developer:** David Gabion Selorm  
**Email:** gabiondavidselorm@gmail.com  
**Phone:** +233247654381

---

## ✅ SYSTEM STATUS

- [x] Referrals table created
- [x] RLS policies active
- [x] Appointment booking component
- [x] Patient referral component
- [x] Doctor dashboard updated
- [x] 36 specialties supported
- [x] Deployed to production
- [x] Database setup complete

**System is ready for production use!** 🎉
