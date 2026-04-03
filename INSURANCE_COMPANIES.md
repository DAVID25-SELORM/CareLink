# Private Health Insurance Companies in Ghana

## Overview
This document lists the private health insurance companies available in the CareLink HMS system for patient registration.

## Supported Insurance Companies

The following private health insurance companies are integrated into the patient registration system:

1. **Activa International Insurance**
2. **Allianz Life Insurance Ghana**
3. **Area Life Assurance**
4. **Donewell Life Assurance**
5. **Enterprise Life Assurance**
6. **Express Life Insurance**
7. **Glico Life Insurance**
8. **GN Life Insurance**
9. **Hollard Insurance Ghana**
10. **Imperial General Assurance**
11. **Libra Life Insurance**
12. **Metropolitan Life Insurance**
13. **Phoenix Life Assurance**
14. **Premier Life Insurance**
15. **Provident Life Assurance**
16. **Prudential Life Insurance Ghana**
17. **Quality Insurance Company**
18. **Saham Life Insurance**
19. **Star Life Assurance**
20. **SIC Life Company**
21. **Vanguard Life Assurance**
22. **Other** (for companies not listed)

## Insurance Types

The system supports three insurance types:

### 1. None
- Patient has no insurance coverage
- Full cash payment required

### 2. NHIS (National Health Insurance Scheme)
- Ghana's national health insurance
- Requires NHIS number
- Covers basic healthcare services

### 3. Private Insurance
- Private health insurance providers
- Select from dropdown list
- Better coverage and faster service

## Usage in Patient Registration

### For Reception/Records Staff

When registering a new patient:

1. **Select Insurance Type**
   - Choose from: None, NHIS, or Private Insurance

2. **If NHIS selected:**
   - Enter the patient's NHIS number

3. **If Private Insurance selected:**
   - Select insurance company from dropdown (required)
   - The dropdown contains all 21 insurance companies plus "Other"

4. **Data Validation:**
   - Insurance company name is required when "Private Insurance" is selected
   - Ensures data consistency across the system

## Benefits of Dropdown Selection

### 1. **Data Consistency**
- Standardized company names across all records
- No typos or variations (e.g., "Glico" vs "GLICO" vs "Glico Life")
- Easy to generate reports and statistics

### 2. **Quick Selection**
- Faster than typing
- Searchable dropdown
- Common companies at the top

### 3. **Better Reporting**
- Accurate insurance usage statistics
- Identify most common insurance providers
- Track billing patterns by insurance type

## Adding New Insurance Companies

If a new insurance company needs to be added:

### Option 1: Use "Other"
- Temporary solution for unlisted companies
- Can be used immediately

### Option 2: Update the System (Developer Task)
1. Open `src/pages/PatientRegistration.jsx`
2. Locate the `PRIVATE_INSURANCE_COMPANIES` array
3. Add the new company name alphabetically
4. Deploy the update

```javascript
const PRIVATE_INSURANCE_COMPANIES = [
  'Activa International Insurance',
  // ... existing companies ...
  'New Insurance Company Name',  // Add here
  'Other'
]
```

## Data Storage

### Database Schema
Insurance information is stored in the `patients` table:

```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  phone TEXT,
  nhis_number TEXT,          -- For NHIS patients
  insurance_type TEXT,       -- 'nhis', 'private', or null
  insurance_name TEXT,       -- Company name for private insurance
  address TEXT,
  -- ... other fields
)
```

### Data Examples

**Patient with NHIS:**
```json
{
  "name": "John Doe",
  "insurance_type": "nhis",
  "nhis_number": "123456789012",
  "insurance_name": null
}
```

**Patient with Private Insurance:**
```json
{
  "name": "Jane Smith",
  "insurance_type": "private",
  "nhis_number": null,
  "insurance_name": "Glico Life Insurance"
}
```

**Patient with No Insurance:**
```json
{
  "name": "Bob Wilson",
  "insurance_type": null,
  "nhis_number": null,
  "insurance_name": null
}
```

## Impact on Other Modules

### Billing System
- Automatically detects insurance type
- Applies appropriate billing rules
- NHIS patients get subsidized rates

### Cashier Module
- Payment method defaults based on insurance
- Insurance claim generation for NHIS/Private
- Separate reporting by insurance type

### Reports  
- Insurance utilization statistics
- Revenue by insurance provider
- Claims processing reports

## Quality Assurance

### Testing Checklist
- [ ] Dropdown displays all 22 options
- [ ] "Private Insurance" selection shows company dropdown
- [ ] Company selection is required when private insurance chosen
- [ ] Data saves correctly to database
- [ ] Insurance info displays in patient list
- [ ] Billing system recognizes insurance type
- [ ] Can search/filter patients by insurance

## Support

For questions or issues with insurance configuration:
- **Developer:** David Gabion Selorm
- **Email:** gabiondavidselorm@gmail.com

---

**Last Updated:** April 3, 2026  
**Version:** 1.0.0  
**Status:** ✅ Active
