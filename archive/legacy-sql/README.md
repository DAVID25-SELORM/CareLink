# Legacy SQL — DO NOT RUN

Historical ad-hoc scripts, superseded by the ordered files in `/migrations`.
Several are one-off fixes (e.g. `ultimate-owner-fix.sql`, `force-drop-phone-constraint.sql`)
that can alter or destroy data. Kept for reference only; never run against production.
`/migrations` is the single source of truth for schema.
