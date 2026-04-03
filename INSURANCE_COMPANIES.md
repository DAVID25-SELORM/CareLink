# Private Health Insurance Companies in Ghana

## Overview
This document lists the **health insurance** companies available in the CareLink HMS system for patient registration.

**Note:** This list includes only health/medical insurance providers. Life insurance and life assurance companies have been excluded as they do not provide health coverage.

## Supported Health Insurance Companies

The following private **health insurance** companies are integrated into the patient registration system:

1. **Acacia Health Insurance**
2. **Ace Medical Insurance**
3. **Apex Health Insurance**
4. **Best Assurance Health Insurance**
5. **Cosmopolitan Health Insurance**
6. **Dosh Health Insurance**
7. **Emple Health Insurance**
8. **Equity Health Insurance**
9. **Glico Healthcare**
10. **Healthnet Insurance Ghana**
11. **International Health Insurance Ghana**
12. **Nationwide Medical Insurance**
13. **Nova Health Insurance**
14. **Petra Health Insurance**
15. **Premier Health Insurance**
16. **Ultimate Health Insurance**
17. **UnitedHealthcare Ghana**
18. **Other** (for companies not listed)

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
  'Acacia Health Insurance',
  'Ace Medical Insurance',
  // ... existing health insurance companies ...
  'New Health Insurance Company Name',  // Add here
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
- [ ] Dropdown displays all 39 options
- [ ] "Private Insurance" se18 health insurance options
- [ ] "Private Insurance" selection shows company dropdown
- [ ] Company selection is required when private insurance chosen
- [ ] Data saves correctly to database
- [ ] Insurance info displays in patient list
- [ ] Billing system recognizes insurance type
- [ ] Can search/filter patients by insurance
- [ ] Only health insurance companies appear (no life insurance)
## Support

For questions or issues with insurance configuration:
- **Developer:** David Gabion Selorm
- **Email:** gabiondavidselorm@gmail.com

---

**Last Updated:** April 3, 2026  
**Version:** 1.0.0  
**Status:** ✅ Active
