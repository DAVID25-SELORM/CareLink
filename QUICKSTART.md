# ⚡ CareLink HMS - Quick Start Guide

Get your Hospital Management System running in 10 minutes!

---

## 🚀 Fast Setup (5 Steps)

### Step 1: Install Dependencies (2 min)

```bash
npm install
```

### Step 2: Setup Supabase (3 min)

1. **Create Supabase Project**
   - Go to [https://supabase.com](https://supabase.com)
   - Click **New Project**
   - Name: `carelink-hms`
   - Choose region close to Ghana
   - Set strong database password

2. **Get Your Keys**
   - Go to **Settings** → **API**
   - Copy **Project URL**
   - Copy **anon public** key

### Step 3: Configure Environment (1 min)

Create `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Create Database Tables (2 min)

1. Go to Supabase **SQL Editor**
2. Copy SQL from `DATABASE_SETUP.md`
3. Run each section (users, patients, drugs, etc.)
4. Verify tables created

### Step 5: Start the App (1 min)

```bash
npm run dev
```

Open: **http://localhost:5173**

---

## 🎯 First Login

### Create Admin User

**In Supabase Dashboard:**

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Email: `admin@carelink.com`
4. Password: (choose strong password)
5. Click **Create User**

**In SQL Editor:**

```sql
INSERT INTO users (email, role, full_name)
VALUES ('admin@carelink.com', 'admin', 'Admin User');
```

**Now Login:**
- Email: `admin@carelink.com`
- Password: (your password)

---

## ✅ Test Your System (5 min)

### 1. Register a Patient

1. Click **Patients** → **Register New Patient**
2. Fill in:
   - Name: `John Doe`
   - Age: `35`
   - Gender: `Male`
   - Phone: `0244123456`
   - NHIS: `NHIS123456`
   - Insurance: `NHIS`
3. Click **Register**

### 2. Add Some Drugs

1. Click **Drugs** → **Add New Drug**
2. Add these drugs:

```
Name: Paracetamol 500mg
Category: Analgesics
Price: 2.50
Stock: 500
Unit: tablets
```

```
Name: Amoxicillin 500mg
Category: Antibiotics
Price: 5.00
Stock: 200
Unit: capsules
```

### 3. Create a Prescription

1. Click **Pharmacy** (if you have doctor access)
2. Or manually insert in Supabase SQL Editor:

```sql
-- Get patient ID first
SELECT id FROM patients WHERE name = 'John Doe';

-- Create prescription (replace patient_id)
INSERT INTO prescriptions (patient_id, doctor_name, notes, status)
VALUES (
  'patient-uuid-here',
  'Dr. Smith',
  'Fever and headache',
  'pending'
);

-- Get prescription ID
SELECT id FROM prescriptions WHERE patient_id = 'patient-uuid-here';

-- Get drug IDs
SELECT id, name FROM drugs;

-- Add prescription items
INSERT INTO prescription_items (prescription_id, drug_id, drug_name, quantity, dosage, frequency)
VALUES 
  ('prescription-uuid', 'drug-uuid-paracetamol', 'Paracetamol 500mg', 10, '1 tablet', 'Twice daily'),
  ('prescription-uuid', 'drug-uuid-amoxicillin', 'Amoxicillin 500mg', 6, '1 capsule', 'Three times daily');
```

### 4. Dispense & Bill

1. **Pharmacy** → Select prescription → **Dispense**
2. **Billing** → Select patient → Process payment
3. Choose payment method (Cash/MoMo/Insurance)

### 5. View Reports

1. Click **Reports**
2. See dashboard statistics
3. View revenue, patients, claims

---

## 🎨 Customize Branding

### Update App Name

In `index.html`:
```html
<title>Your Hospital Name - HMS</title>
```

### Update Colors

In `tailwind.config.js`:
```js
colors: {
  primary: '#1E88E5',  // Your primary color
  medical: '#2ECC71',  // Your secondary color
}
```

### Add Hospital Logo

1. Add logo to `public/logo.png`
2. Update in `DashboardLayout.jsx`

---

## 🚀 Deploy to Production

### Option 1: Vercel (Recommended)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/carelink-hms.git
git push -u origin main

# Go to vercel.com
# Import repository
# Add environment variables
# Deploy!
```

### Option 2: Manual Deploy

```bash
npm run build
# Upload dist/ folder to your hosting
```

---

## 📱 Mobile App (Optional)

Coming soon! React Native app for doctors and patients.

---

## 📞 Need Help?

**Developer**: David Gabion Selorm  
**Email**: gabiondavidselorm@gmail.com  
**Phone**: +233 24 765 4381

---

## 📚 Full Documentation

- **README.md** - Complete overview
- **DATABASE_SETUP.md** - Detailed database setup
- **USER_GUIDE.md** - How to use each feature
- **DEPLOYMENT.md** - Production deployment guide
- **PROJECT_CHECKLIST.md** - Complete project checklist
- **PITCH_DECK.md** - Business pitch for hospitals

---

## 🎯 Quick Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run setup script (Windows)
.\setup.ps1
```

---

## 🔐 Default Ports

- Development: `http://localhost:5173`
- Preview: `http://localhost:4173`

---

## ✅ Success!

If you see the CareLink HMS login page, you're all set! 🎉

**Next Steps:**
1. Add more sample data
2. Test all features
3. Invite team members
4. Deploy to production
5. Start onboarding hospitals!

---

**Welcome to CareLink HMS!**  
*Connecting Care, Simplifying Healthcare* 🏥

Built with ❤️ in Ghana 🇬🇭
