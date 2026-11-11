// Turns raw platform_readiness blocker strings into something an operator can act on.
// The gate itself is unchanged: this only explains it.
const SHARED_ONLY_EVIDENCE = ['deployment', 'admin_acceptance', 'account_protection', 'support']

const HELP = {
  'Provision workspace': { action: 'Workspace provisioning has not been recorded. Provisioning is not completed in this deployment mode.' },
  'Set up administrator': { action: 'The administrator has no login yet. Create the user in Supabase (Authentication, Users) or have them register from the sign-in page, then record acceptance.' },
  'Eligible subscription required': { action: 'Assign this hospital a plan under Subscriptions.', link: '/platform/subscriptions' },
}

export function describeBlocker(raw, { sharedMode = false } = {}) {
  const text = String(raw || '').trim()
  const evidence = /^Evidence required:\s*(\w+)/i.exec(text)
  if (evidence) {
    const kind = evidence[1]
    const unavailable = !sharedMode && SHARED_ONLY_EVIDENCE.includes(kind)
    return {
      text,
      action: unavailable
        ? `Cannot be recorded in this deployment mode. It becomes available after the shared-tenancy conversion.`
        : `Record ${kind.replace(/_/g, ' ')} evidence under Verification or Training.`,
      blockedByMode: unavailable,
    }
  }
  const help = HELP[text]
  return { text, action: help?.action || 'Resolve this requirement, then save the draft to re-check.', link: help?.link, blockedByMode: false }
}

export function summarizeReadiness(blockers, options) {
  const items = (blockers || []).map(blocker => describeBlocker(blocker, options))
  return { items, total: items.length, blockedByMode: items.filter(item => item.blockedByMode).length }
}
