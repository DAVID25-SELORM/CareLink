# 🏥 CareLink HMS - Hospital Management System

**Connecting Care, Simplifying Healthcare**

A modern, comprehensive Hospital Management System designed for healthcare facilities in Ghana. Built with React, Supabase, and deployed on Vercel.

---

## 👨‍💻 Developer

**David Gabion Selorm**  
📧 gabiondavidselorm@gmail.com  
📱 +233247654381  
🏢 Business: zittechgh@gmail.com

---

## 🚀 Features

### ✅ Core Modules

- **Patient Management** - Register, search, and manage patient records
- **Pharmacy System** - Prescription management, drug dispensing, inventory
- **Drug Management** - Stock tracking, low-stock alerts, drug catalog
- **Billing System** - Payment processing (Cash, MoMo, Insurance)
- **Claims Management** - NHIS & Private insurance claims tracking
- **Laboratory** - Lab test requests and results management
- **Appointments** - Schedule and manage patient appointments
- **Reports & Analytics** - Revenue trends, claims analytics, system insights

### 🔐 Security Features

- Role-based access control (Admin, Doctor, Pharmacist)
- Supabase authentication
- Protected routes
- Secure API calls

### 🇬🇭 Ghana-Specific Features

- NHIS number tracking
- Mobile Money payment support (MTN, Telecel, AirtelTigo)
- Private insurance integration
- Claims submission workflow

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **React Toastify** - Notifications

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL Database
  - Authentication
  - Real-time subscriptions
  - RESTful API

### Deployment
- **Vercel** - Frontend hosting
- **Supabase Cloud** - Backend hosting

---

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd CareLink
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key
4. Run the SQL commands from `DATABASE_SETUP.md` in your Supabase SQL editor

### Step 4: Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Step 5: Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📊 Database Schema

CareLink HMS uses the following main tables:

- **patients** - Patient records with NHIS and insurance info
- **users** - User accounts with roles
- **drugs** - Drug inventory
- **prescriptions** - Doctor prescriptions
- **prescription_items** - Prescription line items
- **payments** - Payment records
- **claims** - Insurance claims
- **lab_tests** - Laboratory tests
- **appointments** - Patient appointments

See `DATABASE_SETUP.md` for complete SQL schema.

---

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

See `DEPLOYMENT.md` for detailed instructions.

---

## 📖 User Guide

### Default Login

After setting up the database, create a user in Supabase:

```sql
-- Example: Create admin user
INSERT INTO users (email, role)
VALUES ('admin@carelink.com', 'admin');
```

Then use Supabase Auth to create the authentication account.

### Workflow

1. **Register Patient** - Add patient with NHIS/insurance info
2. **Doctor Creates Prescription** - Add drugs and quantities
3. **Pharmacy Dispenses** - Mark as dispensed, deduct stock
4. **Billing** - Generate bill, process payment
5. **Claims** - If insurance, create and track claim

---

## 🎯 Key Features Explained

### Pharmacy Module
- View all prescriptions
- Dispense medications
- Automatic stock deduction
- Low stock alerts (< 10 units)

### Billing System
- Cash payments
- Mobile Money (MTN, Telecel, AirtelTigo)
- Insurance claims routing

### Claims Management
- Track NHIS claims
- Private insurance claims
- Status workflow: Pending → Submitted → Approved

### Reports Dashboard
- Total patients
- Revenue trends
- Claims analytics
- Drug usage statistics

---

## 🔧 Configuration

### Role-Based Access

Modify user roles in Supabase `users` table:
- `admin` - Full access
- `doctor` - Prescriptions, patients
- `pharmacist` - Pharmacy, drug management

### Customization

Update colors in `tailwind.config.js`:

```js
colors: {
  primary: '#1E88E5',  // CareLink Blue
  medical: '#2ECC71',  // Medical Green
}
```

---

## 📱 Mobile App (Coming Soon)

React Native mobile app for doctors and patients.

Features:
- Mobile prescription entry
- Patient lookup
- Appointment booking
- Push notifications

---

## 🤝 Contributing

This is a commercial project by David Gabion Selorm. For collaboration inquiries, contact:

📧 gabiondavidselorm@gmail.com  
🏢 zittechgh@gmail.com

---

## 📄 License

Copyright © 2026 David Gabion Selorm. All rights reserved.

---

## 🙏 Support

For support and inquiries:

- **Email**: gabiondavidselorm@gmail.com
- **Phone**: +233247654381
- **Business**: zittechgh@gmail.com

---

## 🎓 About

**CareLink HMS** is built by David Gabion Selorm, a developer with hands-on healthcare experience. The system is designed specifically for Ghanaian hospitals and clinics, with features like NHIS integration, mobile money payments, and claims management.

### Vision

To digitize healthcare in Ghana and across Africa, making hospital operations efficient, transparent, and patient-centered.

---

**Built with ❤️ in Ghana 🇬🇭**

*Connecting Care, Simplifying Healthcare*
