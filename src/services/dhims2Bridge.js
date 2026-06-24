import { supabase } from '../supabaseClient'
import { logAuditEvent } from './auditLog'

// ─── DHIMS2 Bridge Service ───────────────────────────────────────────
// Auto-generates DHIMS2-format reports from CareLink data.
// Eliminates double data entry into the Ghana Health Service DHIMS2 portal.

// DHIMS2 Indicator IDs mapped to CareLink queries
const DHIMS2_INDICATORS = {
  // OPD Attendance
  'OPD_TOTAL': {
    name: 'Total OPD Attendance',
    query: async (period) => {
      const { count } = await supabase
        .from('encounters')
        .select('*', { count: 'exact', head: true })
        .eq('encounter_type', 'outpatient')
        .gte('encounter_date', period.start)
        .lte('encounter_date', period.end)
      return count || 0
    },
  },
  'OPD_NEW': {
    name: 'New OPD Attendances',
    query: async (period) => {
      const { count } = await supabase
        .from('encounters')
        .select('*', { count: 'exact', head: true })
        .eq('encounter_type', 'outpatient')
        .eq('is_new_case', true)
        .gte('encounter_date', period.start)
        .lte('encounter_date', period.end)
      return count || 0
    },
  },
  'OPD_REVISIT': {
    name: 'OPD Re-attendances',
    query: async (period) => {
      const { count } = await supabase
        .from('encounters')
        .select('*', { count: 'exact', head: true })
        .eq('encounter_type', 'outpatient')
        .eq('is_new_case', false)
        .gte('encounter_date', period.start)
        .lte('encounter_date', period.end)
      return count || 0
    },
  },

  // IPD
  'IPD_ADMISSIONS': {
    name: 'Total Admissions',
    query: async (period) => {
      const { count } = await supabase
        .from('admissions')
        .select('*', { count: 'exact', head: true })
        .gte('admission_date', period.start)
        .lte('admission_date', period.end)
      return count || 0
    },
  },
  'IPD_DISCHARGES': {
    name: 'Total Discharges',
    query: async (period) => {
      const { count } = await supabase
        .from('admissions')
        .select('*', { count: 'exact', head: true })
        .not('discharge_date', 'is', null)
        .gte('discharge_date', period.start)
        .lte('discharge_date', period.end)
      return count || 0
    },
  },

  // Laboratory
  'LAB_TOTAL_TESTS': {
    name: 'Total Lab Tests Performed',
    query: async (period) => {
      const { count } = await supabase
        .from('lab_tests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', period.start)
        .lte('created_at', period.end)
      return count || 0
    },
  },
  'LAB_MALARIA_RDT_POSITIVE': {
    name: 'Malaria RDT Positive',
    query: async (period) => {
      const { count } = await supabase
        .from('lab_tests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .ilike('test_type', '%malaria%')
        .ilike('result', '%positive%')
        .gte('created_at', period.start)
        .lte('created_at', period.end)
      return count || 0
    },
  },

  // Maternal Health
  'ANC_FIRST_VISITS': {
    name: 'ANC First Visits',
    query: async (period) => {
      const { count } = await supabase
        .from('anc_visits')
        .select('*', { count: 'exact', head: true })
        .eq('visit_number', 1)
        .gte('visit_date', period.start)
        .lte('visit_date', period.end)
      return count || 0
    },
  },
  'DELIVERIES_NORMAL': {
    name: 'Normal Deliveries',
    query: async (period) => {
      const { count } = await supabase
        .from('delivery_records')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_type', 'normal_vaginal')
        .gte('delivery_date', period.start)
        .lte('delivery_date', period.end)
      return count || 0
    },
  },
  'DELIVERIES_CS': {
    name: 'Caesarean Sections',
    query: async (period) => {
      const { count } = await supabase
        .from('delivery_records')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_type', 'caesarean_section')
        .gte('delivery_date', period.start)
        .lte('delivery_date', period.end)
      return count || 0
    },
  },

  // Top 10 OPD Morbidities (requires diagnosis join)
  'TOP10_OPD_MORBIDITIES': {
    name: 'Top 10 OPD Morbidities',
    query: async (period) => {
      const { data } = await supabase
        .from('diagnoses')
        .select('icd10_code, description')
        .gte('created_at', period.start)
        .lte('created_at', period.end)
      if (!data) return []

      // Group and count
      const counts = {}
      data.forEach(d => {
        const key = `${d.icd10_code}|${d.description}`
        counts[key] = (counts[key] || 0) + 1
      })

      return Object.entries(counts)
        .map(([key, count]) => {
          const [code, description] = key.split('|')
          return { icd10_code: code, description, count }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    },
  },
}

// ─── Generate Full DHIMS2 Monthly Report ─────────────────────────────

export async function generateDHIMS2Report(year, month, userId) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0) // Last day of month
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  const period = { start, end }

  const report = {
    report_type: 'DHIMS2_MONTHLY',
    period: { year, month, start, end },
    generated_at: new Date().toISOString(),
    generated_by: userId,
    indicators: {},
    status: 'draft',
  }

  for (const [key, indicator] of Object.entries(DHIMS2_INDICATORS)) {
    try {
      const value = await indicator.query(period)
      report.indicators[key] = {
        name: indicator.name,
        value,
        status: 'computed',
      }
    } catch (err) {
      report.indicators[key] = {
        name: indicator.name,
        value: null,
        status: 'error',
        error: err.message,
      }
    }
  }

  // Save report to database
  const { data, error } = await supabase.from('dhims2_reports').insert({
    report_period: start,
    report_type: 'monthly',
    report_data: report.indicators,
    status: 'draft',
    generated_by: userId,
  }).select().single()

  if (!error && data) {
    await logAuditEvent(userId, null, 'dhims2_report_generated', 'dhims2_reports', data.id)
  }

  return { report, saved: data, error }
}

// ─── Export to DHIMS2 CSV Format ─────────────────────────────────────

export function exportDHIMS2CSV(report) {
  const lines = ['Indicator ID,Indicator Name,Value']

  for (const [key, ind] of Object.entries(report.indicators)) {
    if (key === 'TOP10_OPD_MORBIDITIES') {
      // Special handling for top 10
      const items = Array.isArray(ind.value) ? ind.value : []
      items.forEach((item, i) => {
        lines.push(`TOP10_${i + 1},"${item.icd10_code} - ${item.description}",${item.count}`)
      })
    } else {
      lines.push(`${key},"${ind.name}",${ind.value ?? 'N/A'}`)
    }
  }

  return lines.join('\n')
}

// ─── Mark Report as Submitted ────────────────────────────────────────

export async function markReportSubmitted(reportId, userId) {
  const { data, error } = await supabase
    .from('dhims2_reports')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: userId })
    .eq('id', reportId)
    .select()
    .single()

  if (!error && data) {
    await logAuditEvent(userId, null, 'dhims2_report_submitted', 'dhims2_reports', reportId)
  }

  return { data, error }
}
