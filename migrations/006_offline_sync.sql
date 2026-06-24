-- ============================================
-- CareLink HMS — Migration 006: Offline Sync Infrastructure
-- Server-side sync tables for offline-first PWA capability
-- Depends on: 005_interop_fhir.sql (hospitals)
-- ============================================

-- ============================================
-- 1. SYNC QUEUE
-- Receives batched mutations from offline clients on reconnect
-- ============================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload JSONB NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'applied', 'conflict', 'rejected')),
  error_message TEXT,
  batch_id TEXT,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_hospital ON sync_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_client ON sync_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_queue_batch ON sync_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at DESC);

COMMENT ON TABLE sync_queue IS 'Receives offline client mutations for server-side application';

-- ============================================
-- 2. SYNC CONFLICTS
-- Tracks version conflicts for manual resolution
-- ============================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_queue_id UUID NOT NULL REFERENCES sync_queue(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_version JSONB NOT NULL,
  server_version JSONB NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_update', 'update_delete', 'delete_update')),
  resolution TEXT CHECK (resolution IN ('client_wins', 'server_wins', 'merged', 'manual')),
  resolved_version JSONB,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_hospital ON sync_conflicts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_table ON sync_conflicts(table_name);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolution ON sync_conflicts(resolution);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;

COMMENT ON TABLE sync_conflicts IS 'Tracks offline sync version conflicts with resolution history';

-- ============================================
-- 3. OFFLINE CACHE MANIFEST
-- Defines which data subsets sync per hospital/department/role
-- ============================================

CREATE TABLE IF NOT EXISTS offline_cache_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('server_to_client', 'client_to_server', 'bidirectional')),
  filter_column TEXT,
  filter_value TEXT,
  role_filter TEXT[],
  department_filter TEXT[],
  max_records INTEGER DEFAULT 1000,
  sync_frequency_minutes INTEGER DEFAULT 15,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  include_columns TEXT[],
  exclude_columns TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  last_full_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_manifest_hospital ON offline_cache_manifest(hospital_id);
CREATE INDEX IF NOT EXISTS idx_cache_manifest_table ON offline_cache_manifest(table_name);
CREATE INDEX IF NOT EXISTS idx_cache_manifest_active ON offline_cache_manifest(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE offline_cache_manifest IS 'Defines offline data sync rules per hospital, department, and role';

-- Seed default cache manifest entries
INSERT INTO offline_cache_manifest (table_name, sync_direction, max_records, priority, role_filter) VALUES
  ('patients', 'bidirectional', 5000, 10, ARRAY['doctor', 'nurse', 'records_officer', 'pharmacist', 'cashier']),
  ('drugs', 'server_to_client', 2000, 9, ARRAY['doctor', 'nurse', 'pharmacist']),
  ('encounters', 'bidirectional', 2000, 9, ARRAY['doctor', 'nurse']),
  ('vitals', 'bidirectional', 5000, 8, ARRAY['doctor', 'nurse']),
  ('prescriptions', 'bidirectional', 2000, 8, ARRAY['doctor', 'pharmacist']),
  ('prescription_items', 'bidirectional', 5000, 8, ARRAY['doctor', 'pharmacist']),
  ('appointments', 'bidirectional', 1000, 7, ARRAY['doctor', 'nurse', 'records_officer']),
  ('queue_management', 'bidirectional', 500, 7, ARRAY['doctor', 'nurse', 'pharmacist', 'cashier']),
  ('lab_tests', 'bidirectional', 2000, 7, ARRAY['doctor', 'nurse']),
  ('diagnoses', 'bidirectional', 3000, 7, ARRAY['doctor']),
  ('nhia_tariff_catalog', 'server_to_client', 5000, 6, ARRAY['cashier']),
  ('blood_inventory', 'server_to_client', 20, 5, ARRAY['doctor', 'nurse'])
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. SYNC CHECKPOINT
-- Tracks last sync position per client for delta sync
-- ============================================

CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_record_version INTEGER DEFAULT 0,
  records_synced INTEGER DEFAULT 0,
  sync_duration_ms INTEGER,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_client ON sync_checkpoints(client_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_user ON sync_checkpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_table ON sync_checkpoints(table_name);

COMMENT ON TABLE sync_checkpoints IS 'Delta sync markers — tracks last sync position per client per table';

-- ============================================
-- 5. DEVICE REGISTRY
-- Track registered offline-capable devices
-- ============================================

CREATE TABLE IF NOT EXISTS registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('tablet', 'phone', 'laptop', 'desktop')),
  os TEXT,
  browser TEXT,
  app_version TEXT,
  push_subscription JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  storage_quota_mb INTEGER DEFAULT 500,
  storage_used_mb INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_hospital ON registered_devices(hospital_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON registered_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON registered_devices(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE registered_devices IS 'Registry of offline-capable devices with sync and storage tracking';

-- ============================================
-- 6. SYNC BATCH PROCESSING FUNCTION
-- Applies a batch of sync operations atomically
-- ============================================

CREATE OR REPLACE FUNCTION process_sync_batch(p_batch_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_result JSONB := '{"applied": 0, "conflicts": 0, "errors": 0}';
  v_server_version JSONB;
  v_applied INTEGER := 0;
  v_conflicts INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  FOR v_item IN
    SELECT * FROM sync_queue
    WHERE batch_id = p_batch_id
    AND status = 'pending'
    ORDER BY sequence_number ASC
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE sync_queue SET status = 'processing', server_timestamp = NOW()
      WHERE id = v_item.id;

      -- Check for conflicts (server record was modified after client's timestamp)
      IF v_item.operation IN ('update', 'delete') THEN
        EXECUTE format(
          'SELECT to_jsonb(t.*) FROM %I t WHERE id = $1 AND updated_at > $2',
          v_item.table_name
        ) INTO v_server_version USING v_item.record_id, v_item.client_timestamp;

        IF v_server_version IS NOT NULL THEN
          -- Conflict detected
          INSERT INTO sync_conflicts (
            sync_queue_id, hospital_id, table_name, record_id,
            client_version, server_version,
            client_timestamp, server_timestamp,
            conflict_type
          ) VALUES (
            v_item.id, v_item.hospital_id, v_item.table_name, v_item.record_id,
            v_item.payload, v_server_version,
            v_item.client_timestamp, NOW(),
            CASE v_item.operation
              WHEN 'update' THEN 'update_update'
              WHEN 'delete' THEN 'delete_update'
              ELSE 'update_update'
            END
          );

          UPDATE sync_queue SET status = 'conflict' WHERE id = v_item.id;
          v_conflicts := v_conflicts + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Apply the operation
      CASE v_item.operation
        WHEN 'insert' THEN
          EXECUTE format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) ON CONFLICT (id) DO NOTHING',
            v_item.table_name, v_item.table_name
          ) USING v_item.payload;
        WHEN 'update' THEN
          EXECUTE format(
            'UPDATE %I SET %s WHERE id = $1',
            v_item.table_name,
            (SELECT string_agg(format('%I = ($2->>%L)::%s', key, key,
              CASE
                WHEN pg_typeof IS NOT NULL THEN pg_typeof::TEXT
                ELSE 'TEXT'
              END
            ), ', ')
            FROM jsonb_each_text(v_item.payload) AS j(key, value)
            WHERE key != 'id')
          ) USING v_item.record_id, v_item.payload;
        WHEN 'delete' THEN
          EXECUTE format('DELETE FROM %I WHERE id = $1', v_item.table_name)
          USING v_item.record_id;
      END CASE;

      UPDATE sync_queue SET status = 'applied' WHERE id = v_item.id;
      v_applied := v_applied + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE sync_queue SET status = 'rejected', error_message = SQLERRM WHERE id = v_item.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  v_result := jsonb_build_object(
    'batch_id', p_batch_id,
    'applied', v_applied,
    'conflicts', v_conflicts,
    'errors', v_errors,
    'total', v_applied + v_conflicts + v_errors
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_sync_batch IS 'Atomically processes a batch of offline sync operations with conflict detection';

-- ============================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_cache_manifest_timestamp ON offline_cache_manifest;
CREATE TRIGGER update_cache_manifest_timestamp
  BEFORE UPDATE ON offline_cache_manifest
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkpoints_timestamp ON sync_checkpoints;
CREATE TRIGGER update_checkpoints_timestamp
  BEFORE UPDATE ON sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_devices_timestamp ON registered_devices;
CREATE TRIGGER update_devices_timestamp
  BEFORE UPDATE ON registered_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_cache_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;

-- Users can view/manage their own sync data
DROP POLICY IF EXISTS "Users manage own sync queue" ON sync_queue;
CREATE POLICY "Users manage own sync queue"
  ON sync_queue FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin view all sync conflicts" ON sync_conflicts;
CREATE POLICY "Admin view all sync conflicts"
  ON sync_conflicts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin manage cache manifest" ON offline_cache_manifest;
CREATE POLICY "Admin manage cache manifest"
  ON offline_cache_manifest FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Authenticated read cache manifest" ON offline_cache_manifest;
CREATE POLICY "Authenticated read cache manifest"
  ON offline_cache_manifest FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Users manage own checkpoints" ON sync_checkpoints;
CREATE POLICY "Users manage own checkpoints"
  ON sync_checkpoints FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own devices" ON registered_devices;
CREATE POLICY "Users manage own devices"
  ON registered_devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin view all devices" ON registered_devices;
CREATE POLICY "Admin view all devices"
  ON registered_devices FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- ============================================
-- MIGRATION 006 COMPLETE
-- Tables created: sync_queue, sync_conflicts, offline_cache_manifest,
--                 sync_checkpoints, registered_devices
-- Functions:      process_sync_batch(batch_id) — applies offline mutations with conflict detection
-- Seed data:      12 default cache manifest entries for core tables
-- ============================================
