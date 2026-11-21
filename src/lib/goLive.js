// Go-live readiness: checks the facility's own data (automatic) and lists the sign-offs only people can give (manual).

export const MIN_ROLES = [
  ['admin', 'Administrator'], ['doctor', 'Doctor'], ['nurse', 'Nurse'], ['pharmacist', 'Pharmacist'], ['cashier', 'Cashier'],
]

/** @param c {profile, roles:{role:count}, drugs, batches, fees, patients, smsSent, dayCloses} */
export function evaluateReadiness(c) {
  const profileOk = Boolean(c.profile?.hospital_name?.trim() && (c.profile?.contact_phone?.trim() || c.profile?.contact_email?.trim()))
  const missingRoles = MIN_ROLES.filter(([role]) => !(c.roles?.[role] > 0)).map(([, label]) => label)
  return [
    { id: 'profile', label: 'Facility name and contact details are filled in', ok: profileOk, hint: 'Open Hospital Profile. Receipts and SMS use these.', to: '/hospital-profile' },
    { id: 'roles', label: 'At least one active user for each key role', ok: missingRoles.length === 0, hint: missingRoles.length ? `Missing: ${missingRoles.join(', ')}` : '', to: '/users' },
    { id: 'drugs', label: 'Drug catalogue loaded', ok: c.drugs > 0, hint: 'Pharmacy and prescribing need it.', to: '/drugs' },
    { id: 'stock', label: 'Opening stock entered as batches with expiry dates', ok: c.batches > 0, hint: 'Pharmacy > Batches.', to: '/pharmacy' },
    { id: 'fees', label: 'Services and fees configured', ok: c.fees > 0, hint: 'Cashier and billing price from these.', to: '/services-catalog' },
    { id: 'patients', label: 'Patients registered or imported', ok: c.patients > 0, hint: '', to: '/patients' },
    { id: 'sms', label: 'A test SMS has been sent successfully', ok: c.smsSent > 0, hint: 'Send one to your own phone from the SMS page.', to: '/notifications' },
    { id: 'dayclose', label: 'Cashier has rehearsed one day close', ok: c.dayCloses > 0, hint: 'Cashier > Day close.', to: '/cashier' },
  ]
}

export const MANUAL_ITEMS = [
  ['lab', 'Lab lead has signed off the reference ranges and critical limits used'],
  ['epi', 'Immunisation lead has confirmed the schedule against the current GHS schedule'],
  ['consent', 'The patient consent wording was approved by the facility (Data Protection Act, 2012)'],
  ['training', 'Each role has been trained and has practised on test patients'],
  ['downtime', 'A paper procedure exists for power or internet failure, and staff know it'],
  ['backup', 'Backups are on and one restore has been rehearsed'],
  ['accounts', 'Every staff member has their own login; no shared accounts'],
  ['owner', 'A named person owns support questions during the first weeks'],
]
