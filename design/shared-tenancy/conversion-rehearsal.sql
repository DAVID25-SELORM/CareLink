\set ON_ERROR_STOP on
\ir schema-fixture.sql
\ir conversion-rehearsal-seed.sql
\ir conversion-bundle.rehearsal.sql
BEGIN;
\ir conversion-rehearsal-test.sql
ROLLBACK;
