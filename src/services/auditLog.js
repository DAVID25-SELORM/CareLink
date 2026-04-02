import { supabase } from '../supabaseClient'

const sanitizeAuditValue = (value) => {
  if (value === undefined) {
    return null
  }

  if (value === null) {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    console.warn('Unable to sanitize audit payload:', error)
    return null
  }
}

export const logAuditEvent = async ({
  user,
  action,
  tableName,
  recordId = null,
  oldValues = null,
  newValues = null,
}) => {
  try {
    const { error } = await supabase
      .from('audit_log')
      .insert([
        {
          user_id: user?.id || null,
          user_email: user?.email || null,
          action,
          table_name: tableName,
          record_id: recordId,
          old_values: sanitizeAuditValue(oldValues),
          new_values: sanitizeAuditValue(newValues),
        },
      ])

    if (error) throw error
  } catch (error) {
    // Audit logging should not block the main workflow if the table or policy is unavailable.
    console.warn('Audit log write skipped:', error?.message || error)
  }
}
