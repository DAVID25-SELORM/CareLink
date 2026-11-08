// Catalog-only schema replica. Never copies records, auth credentials or secrets.
import { readFileSync, writeFileSync } from 'node:fs'
const root = new URL('./', import.meta.url)
const schema = JSON.parse(readFileSync(new URL('schema-catalog.json', root)))
const access = JSON.parse(readFileSync(new URL('access-catalog.json', root)))
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const out = [
  '-- Disposable database only. Generated from schema metadata; contains no row data.',
  'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;',
  'CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);',
  'CREATE SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
  "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;',
  'SET check_function_bodies=off;',
]
for (const seq of schema.sequences) out.push(`CREATE SEQUENCE public.${quote(seq.sequencename)};`)
const tables = [...new Set(schema.columns.map(c => c.tab))]
for (const tab of tables) {
  const columns = schema.columns.filter(c => c.tab === tab).map(c => {
    const identitySequence = schema.sequences.find(s => s.sequencename === `${tab}_${c.col}_seq`)
    const defaultSql = c.default_sql || (identitySequence ? `nextval('public.${identitySequence.sequencename}'::regclass)` : null)
    return `${quote(c.col)} ${c.type}${defaultSql ? ` DEFAULT ${defaultSql}` : ''}${c.required ? ' NOT NULL' : ''}`
  })
  out.push(`CREATE TABLE public.${quote(tab)}(${columns.join(',\n')});`)
}
for (const kind of ['p','u','c','f']) for (const c of schema.constraints.filter(c => c.kind === kind)) out.push(`ALTER TABLE public.${quote(c.tab.replace(/^public\./,''))} ADD CONSTRAINT ${quote(c.name)} ${c.definition};`)
for (const f of access.functions) out.push(f.definition + ';')
for (const t of schema.triggers) out.push(t.definition + ';')
for (const v of access.views) out.push(`CREATE VIEW public.${quote(v.viewname)} WITH(security_invoker=true) AS ${v.definition}`)
for (const tab of tables) out.push(`ALTER TABLE public.${quote(tab)} ENABLE ROW LEVEL SECURITY;`)
for (const p of access.policies.filter(p => p.schemaname === 'public')) out.push(`CREATE POLICY ${quote(p.policyname)} ON public.${quote(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(quote).join(',')}${p.qual ? ` USING(${p.qual})` : ''}${p.with_check ? ` WITH CHECK(${p.with_check})` : ''};`)
out.push('-- Fixture grants are deliberately broad to exercise restrictive isolation, not a production grant replica.', 'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;')
writeFileSync(new URL('schema-fixture.sql',root), out.join('\n')+'\n')
console.log(`Generated ${tables.length}-table schema fixture`)
