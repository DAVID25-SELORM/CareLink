# 📖 CareLink HMS - User Guide

Complete guide for healthcare professionals using CareLink Hospital Management System.

---

## 👥 User Roles

CareLink HMS supports different user roles with specific permissions:

### 🔐 Admin
- Full system access
- User management
- System configuration
- All reports and analytics

### 👨‍⚕️ Doctor
- Patient management
- Create prescriptions
- View lab results
- Appointments

### 💊 Pharmacist
- Pharmacy dashboard
- Dispense medications
- Drug inventory management
- Stock alerts

### 👩‍⚕️ Nurse (Future)
- Patient vitals
- Lab test requests
- Appointment scheduling

---

## 🏥 Getting Started

### First Login

1. Open CareLink HMS in your browser
2. Enter your email and password
3. Click **Sign In**
4. You'll be redirected to the Dashboard

### Default Credentials (Demo)

```
Email: admin@carelink.com
Password: [Set by admin]
```

---

## 📊 Dashboard

The dashboard provides a quick overview of your hospital operations.

### Key Metrics

- **Total Patients** - All registered patients
- **Total Prescriptions** - Prescriptions created
- **Total Claims** - Insurance claims filed
- **Pending Claims** - Claims awaiting approval
- **Total Revenue** - Revenue collected
- **Low Stock Drugs** - Drugs below reorder level

### Quick Actions

- View recent activities
- Navigate to modules
- Check notifications

---

## 👨‍👩‍👧‍👦 Patient Management

### Register New Patient

1. Click **Patients** → **Register New Patient**
2. Fill in patient details:
   - **Name** (required)
   - **Age** (required)
   - **Gender** (required)
   - **Phone Number** (required)
   - **Email** (optional)
   - **Address** (optional)
   - **NHIS Number** (if applicable)
   - **Insurance Type**: NHIS, Private, or None
   - **Insurance Name** (for private insurance)
   - **Emergency Contact**
   - **Blood Group**
   - **Allergies**

3. Click **Register Patient**
4. Success! Patient is now in the system

### View Patients

1. Click **Patients** in the sidebar
2. See list of all registered patients
3. Use search bar to find specific patients
4. Search by: Name, Phone, or NHIS Number

### Patient Information Displayed

- Name
- Age & Gender
- Phone number
- NHIS number (if available)
- Insurance type
- Registration date

---

## 💊 Prescription Management

### Create Prescription (Doctor)

1. Go to **Pharmacy** → **Prescriptions**
2. Click **Create New Prescription**
3. Select patient
4. Add diagnosis
5. Add medications:
   - Select drug from dropdown
   - Enter quantity
   - Specify dosage (e.g., "1 tablet")
   - Specify frequency (e.g., "3 times daily")
   - Specify duration (e.g., "7 days")
   - Add instructions
6. Click **Save Prescription**

### View Prescriptions

1. Navigate to **Pharmacy**
2. See all prescriptions
3. Filter by status:
   - **Pending** - Not yet dispensed
   - **Dispensed** - Medications given
   - **Cancelled** - Cancelled prescriptions

---

## 🏪 Pharmacy Module

### Pharmacy Dashboard

**For Pharmacists**

1. Click **Pharmacy** in sidebar
2. View all pending prescriptions
3. See patient details
4. Check drug availability

### Dispense Medications

1. Select a prescription
2. Review drugs and quantities
3. Verify stock availability
4. Click **Dispense**
5. System automatically:
   - Deducts from drug stock
   - Updates prescription status
   - Creates billing record

### Stock Alerts

- Red badge shows drugs with low stock (< 10 units)
- Click to view low stock drugs
- Reorder immediately

---

## 💊 Drug Management

### Add New Drug

1. Go to **Drugs**
2. Click **Add New Drug**
3. Enter drug information:
   - **Name** (e.g., "Paracetamol 500mg")
   - **Category** (e.g., "Analgesics")
   - **Description**
   - **Price** (in GH₵)
   - **Initial Stock**
   - **Unit** (tablets, capsules, etc.)
   - **Manufacturer**
   - **Expiry Date**

4. Click **Add Drug**

### Update Drug Stock

1. Go to **Drugs**
2. Find the drug
3. Click **Update Stock**
4. Enter new stock quantity
5. Save

### Stock Monitoring

- View all drugs and current stock
- Filter by category
- Search by drug name
- See drugs below reorder level

---

## 💰 Billing & Payments

### Create Bill

1. After dispensing prescription
2. System auto-generates bill
3. Review total amount
4. Select payment method

### Payment Methods

#### 💵 Cash Payment

1. Select **Cash**
2. Enter amount paid
3. Confirm payment
4. Print receipt

#### 📱 Mobile Money (MoMo)

1. Select **Mobile Money**
2. Choose provider:
   - MTN Mobile Money
   - Telecel Cash
   - AirtelTigo Money
3. Enter phone number
4. Get transaction reference
5. Confirm payment

#### 🏥 Insurance Payment

1. Select **Insurance**
2. Verify patient has insurance
3. System creates claim automatically
4. Claim goes to **Claims** module

---

## 🧾 Claims Management

### View Claims

1. Click **Claims** in sidebar
2. See all insurance claims
3. Filter by status

### Claim Statuses

- **Pending** - Awaiting submission
- **Submitted** - Sent to insurance company
- **Approved** - Claim approved
- **Rejected** - Claim denied
- **Paid** - Payment received

### Process Claim

1. Select pending claim
2. Review details:
   - Patient information
   - Insurance type (NHIS/Private)
   - Claim amount
   - Services provided
3. Click **Submit Claim**
4. Enter claim number from insurance company
5. Update status as needed

### Track Claims

- View submission date
- Monitor approval status
- Check payment status
- View rejection reasons (if rejected)

---

## 🧪 Laboratory Module

### Request Lab Test

1. Go to **Laboratory**
2. Click **New Lab Test**
3. Select patient
4. Choose test type:
   - Blood Test
   - Urine Test
   - X-Ray
   - Ultrasound
   - Other
5. Add notes/instructions
6. Submit request

### Enter Lab Results

1. View pending lab tests
2. Select test
3. Click **Enter Results**
4. Enter result data
5. Upload result file (PDF, image)
6. Mark as completed

### View Lab Results

- Search by patient
- Filter by test type
- Filter by status
- View result history

---

## 📅 Appointments

### Book Appointment

1. Click **Appointments**
2. Click **Book New Appointment**
3. Select patient
4. Choose doctor
5. Select date and time
6. Enter reason for visit
7. Click **Book Appointment**

### Manage Appointments

**View Appointments**
- Today's appointments
- Upcoming appointments
- Past appointments

**Update Status**
- Confirmed
- Completed
- Cancelled
- No Show

### Appointment Calendar

- Daily view
- Weekly view
- Monthly view
- Filter by doctor

---

## 📊 Reports & Analytics

### Available Reports

1. **Revenue Report**
   - Daily revenue
   - Monthly revenue
   - Revenue by payment method

2. **Patient Statistics**
   - Total patients
   - New patients (monthly)
   - Patient demographics

3. **Prescription Analytics**
   - Most prescribed drugs
   - Prescription trends
   - Doctor activity

4. **Claims Report**
   - Total claims
   - Claims by status
   - NHIS vs Private claims
   - Approval rate

5. **Inventory Report**
   - Current stock levels
   - Low stock alerts
   - Drug usage statistics

### Generate Report

1. Go to **Reports**
2. Select report type
3. Choose date range
4. Click **Generate**
5. View charts and tables
6. Export to PDF/Excel (coming soon)

---

## 🔍 Search & Filters

### Global Search

Use the search bar to find:
- Patients (by name, phone, NHIS)
- Drugs (by name, category)
- Prescriptions (by patient)

### Advanced Filters

Each module has filters:
- Date range
- Status
- Category
- Payment method

---

## 🔔 Notifications

### System Notifications

You'll receive notifications for:
- ⚠️ Low stock alerts
- 📝 New prescriptions (pharmacists)
- 💰 Payment received
- 🧾 Claim status updates
- 📅 Upcoming appointments

### Notification Center

- Click bell icon (top right)
- View all notifications
- Mark as read
- Clear notifications

---

## ⚙️ Settings (Admin Only)

### User Management

1. Go to **Settings** → **Users**
2. Add new users
3. Assign roles
4. Manage permissions
5. Deactivate users

### System Configuration

- Hospital name and logo
- Contact information
- Email templates
- Receipt templates
- Backup schedule

---

## 📱 Mobile Access

### Mobile-Friendly Design

CareLink HMS works on mobile devices:
- Responsive layout
- Touch-friendly buttons
- Mobile-optimized tables

### Recommended Devices

- Tablets (best for bedside use)
- Smartphones
- Laptops
- Desktop computers

---

## 💡 Tips & Best Practices

### Daily Workflow

**Morning**
1. Check dashboard for overview
2. Review today's appointments
3. Check low stock alerts

**During Day**
1. Register walk-in patients
2. Create prescriptions
3. Dispense medications
4. Process payments

**End of Day**
1. Review pending claims
2. Check stock levels
3. Backup important data

### Data Entry Tips

- ✅ Always enter NHIS numbers correctly
- ✅ Double-check drug quantities
- ✅ Verify patient phone numbers
- ✅ Add emergency contacts
- ✅ Document allergies

### Stock Management

- Set reorder levels for all drugs
- Monitor expiry dates
- Check stock before dispensing
- Update stock immediately after receiving supplies

---

## 🆘 Troubleshooting

### Can't Login

- **Check email and password**
- **Contact admin** to reset password
- **Clear browser cache**

### Patient Not Found

- Check spelling of name
- Search by phone number
- Use NHIS number

### Drug Out of Stock

- Check stock in Drug Management
- Update stock if supplies received
- Inform patient of alternatives

### Payment Issues

- Verify amount
- Check payment method selected
- Get transaction reference for MoMo
- Contact admin if persistent

### Slow Performance

- **Check internet connection**
- **Clear browser cache**
- **Use modern browser** (Chrome, Firefox)
- **Close unused tabs**

---

## 📞 Support

### Need Help?

**Contact Support:**
- 📧 Email: support@carelink.com.gh
- 📱 Phone: +233 24 765 4381
- 💬 WhatsApp: +233 24 765 4381

**Email Support:**
gabiondavidselorm@gmail.com

**Business Inquiries:**
zittechgh@gmail.com

### Training

Request on-site training for your team:
- 1-day basic training
- Advanced features workshop
- Custom training for your needs

---

## 🔐 Security & Privacy

### Data Protection

- All data encrypted
- Secure HTTPS connection
- Regular backups
- Access logs maintained

### User Responsibilities

- **Don't share passwords**
- **Log out after use**
- **Report suspicious activity**
- **Follow HIPAA/GDPR guidelines**

### Patient Privacy

- Patient data is confidential
- Access only when necessary
- Follow hospital privacy policies

---

## 📚 Quick Reference

### Keyboard Shortcuts

- `Ctrl + K` - Quick search
- `Ctrl + N` - New entry (context-aware)
- `Ctrl + S` - Save form
- `Esc` - Close modal

### Common Actions

| Action | Navigation |
|--------|-----------|
| Register patient | Patients → Register New |
| Create prescription | Pharmacy → New Prescription |
| Dispense drugs | Pharmacy → Select Prescription |
| Add drug | Drugs → Add New Drug |
| Generate bill | Billing → New Bill |
| Submit claim | Claims → Select → Submit |
| Book appointment | Appointments → Book New |

---

## 🎓 Training Checklist

**Day 1: Basics**
- [ ] Login and navigation
- [ ] Register patient
- [ ] Search patients
- [ ] View dashboard

**Day 2: Clinical**
- [ ] Create prescription
- [ ] Dispense drugs
- [ ] Book appointments
- [ ] Request lab tests

**Day 3: Financial**
- [ ] Process payments
- [ ] Submit claims
- [ ] Generate reports
- [ ] Track revenue

**Day 4: Inventory**
- [ ] Add drugs
- [ ] Update stock
- [ ] Monitor alerts
- [ ] Reorder drugs

---

## 📖 Glossary

- **NHIS** - National Health Insurance Scheme
- **MoMo** - Mobile Money
- **RLS** - Row Level Security
- **HMS** - Hospital Management System
- **Prescription** - Doctor's order for medication
- **Claim** - Insurance reimbursement request
- **Dispense** - Give medication to patient

---

**CareLink HMS User Guide**  
Version 1.0 - April 2026

**Author**: David Gabion Selorm  
**Email**: gabiondavidselorm@gmail.com  
**Phone**: +233 24 765 4381

---

*Connecting Care, Simplifying Healthcare* 🏥
